import { mapCatalog } from "@conquerra/content";
import type { NewOnlineGame, OnlineGameInfo } from "../src/host/protocol";
import { newSeed } from "../src/host/roomCore";
import { accessKeys, verifyAccess, type SignedIn } from "./access";
import type { Env } from "./env";
import { cleanNewGame, nameFromEmail, newGameId } from "./online";

/**
 * The Worker `conquerra`'s API (session 26): it serves the game's static files as before, and the online API under /api.
 * Every API call and WebSocket is checked against Cloudflare Access's signed token first. These handlers do almost no
 * work (the Free plan gives them 10 ms of CPU): check the sign-in, read or write a row, open the game's room. The
 * engine and the bots only ever run inside the room.
 *
 *   GET  /api/me                  who you are signed in as
 *   GET  /api/games               your online games (the lobby's list)
 *   POST /api/games               make a game: { settings, leadersRun } → { id }
 *   GET  /api/games/:id/ws        open a game (a WebSocket to its room)
 */

let keys: ReturnType<typeof accessKeys> | null = null;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const problem = (status: number, error: string) => json({ error }, status);

/**
 * Who's asking: the email in a valid Access token. Under `wrangler dev` only, DEV_EMAIL stands in (it lives in the
 * git-ignored apps/web/.dev.vars, which Wrangler never uploads; a test checks the deployed config never sets it).
 */
async function signedIn(request: Request, env: Env): Promise<SignedIn | null> {
  if (env.DEV_EMAIL) return { email: env.DEV_EMAIL.toLowerCase(), sub: "dev" };
  keys ??= accessKeys(env.ACCESS_TEAM);
  const result = await verifyAccess(request.headers.get("Cf-Access-Jwt-Assertion"), { team: env.ACCESS_TEAM, aud: env.ACCESS_AUD ?? "" }, keys, Date.now());
  if (!result.ok) console.log(`sign-in refused: ${result.why}`);
  return result.ok ? result.user : null;
}

interface UserRow {
  id: string;
  email: string;
  name: string;
}

/** The account for this email, made the first time it signs in. */
async function userFor(env: Env, who: SignedIn): Promise<UserRow> {
  const found = await env.DB.prepare("SELECT id, email, name FROM users WHERE email = ?").bind(who.email).first<UserRow>();
  if (found) return found;
  const row: UserRow = { id: crypto.randomUUID(), email: who.email, name: nameFromEmail(who.email) };
  await env.DB.prepare("INSERT INTO users (id, email, name, created) VALUES (?, ?, ?, ?) ON CONFLICT(email) DO NOTHING").bind(row.id, row.email, row.name, Date.now()).run();
  return (await env.DB.prepare("SELECT id, email, name FROM users WHERE email = ?").bind(who.email).first<UserRow>())!;
}

interface GameRow {
  id: string;
  map: string;
  status: "playing" | "over";
  turn: number;
  waiting: string;
  deadline: number | null;
  created: number;
  winner: string | null;
  seat: string;
  leaders_run: number;
}

interface SeatRow {
  game: string;
  seat: string;
  user: string | null;
  bot: string | null;
  name: string;
}

async function listGames(env: Env, user: UserRow): Promise<OnlineGameInfo[]> {
  const games = await env.DB.prepare(
    "SELECT g.id, g.map, g.status, g.turn, g.waiting, g.deadline, g.created, g.winner, s.seat, s.leaders_run FROM games g JOIN seats s ON s.game = g.id WHERE s.user = ? ORDER BY g.updated DESC LIMIT 20",
  )
    .bind(user.id)
    .all<GameRow>();
  const rows = games.results ?? [];
  if (!rows.length) return [];
  const seats = await env.DB.prepare(`SELECT game, seat, user, bot, name FROM seats WHERE game IN (${rows.map(() => "?").join(",")}) ORDER BY rowid`)
    .bind(...rows.map((g) => g.id))
    .all<SeatRow>();
  return rows.map((g) => {
    const table = (seats.results ?? []).filter((s) => s.game === g.id);
    const nameOf = (seat: string) => (seat === g.seat ? "you" : (table.find((s) => s.seat === seat)?.name ?? seat));
    let waiting: string[] = [];
    try {
      waiting = (JSON.parse(g.waiting) as string[]).map(nameOf);
    } catch {
      waiting = [];
    }
    return {
      id: g.id,
      mapId: g.map,
      mapName: mapCatalog.find((m) => m.id === g.map)?.name ?? g.map,
      turn: g.turn,
      status: g.status,
      waitingOn: waiting,
      deadline: g.deadline,
      players: table.map((s) => ({ name: s.name, bot: !!s.bot, you: s.seat === g.seat })),
      created: g.created,
      leadersRun: !!g.leaders_run,
      ...(g.winner ? { winner: nameOf(g.winner) } : {}),
    };
  });
}

async function createGame(env: Env, user: UserRow, body: unknown): Promise<Response> {
  const clean = cleanNewGame(body);
  if ("error" in clean) return problem(400, clean.error);
  const { settings, leadersRun } = clean;
  const id = newGameId();
  const seed = newSeed();
  const now = Date.now();
  // The game's row first (the room fills in the turn and the clock as it goes).
  await env.DB.prepare("INSERT INTO games (id, map, settings, status, host_user, created, turn, updated, seed_hash) VALUES (?, ?, ?, 'playing', ?, ?, 1, ?, '')")
    .bind(id, settings.mapId, JSON.stringify(settings), user.id, now, now)
    .run();
  try {
    const room = env.GAME_ROOM.getByName(id);
    const made = await room.create({
      gameId: id,
      settings,
      seed,
      people: [
        {
          id: "p1",
          name: user.name,
          house: settings.house ?? 0,
          ...(settings.leaderName ? { leaderName: settings.leaderName } : {}),
          ...(settings.stewardName ? { stewardName: settings.stewardName } : {}),
          leaderPersonality: settings.leaderPersonality ?? null,
          stewardPersonality: settings.stewardPersonality ?? null,
          leadersRun,
        },
      ],
    });
    const level = settings.botLevel;
    await env.DB.batch([
      env.DB.prepare("UPDATE games SET seed_hash = ?, deadline = ?, waiting = ? WHERE id = ?").bind(made.info.seedHash, made.info.deadline, JSON.stringify(made.info.waitingOn), id),
      ...made.players.map((p) =>
        env.DB.prepare("INSERT INTO seats (game, seat, user, bot, colour, name, leaders_run) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(id, p.id, p.id === "p1" ? user.id : null, p.id === "p1" ? null : level, p.house, p.name, p.id === "p1" ? (leadersRun ? 1 : 0) : 0),
      ),
    ]);
  } catch (e) {
    await env.DB.prepare("DELETE FROM games WHERE id = ?").bind(id).run();
    console.log(`making game ${id} failed: ${e instanceof Error ? e.message : String(e)}`);
    return problem(500, "The game couldn't be made. Try again in a moment.");
  }
  return json({ id });
}

async function openGame(env: Env, user: UserRow, id: string, request: Request): Promise<Response> {
  if (request.headers.get("Upgrade") !== "websocket") return problem(426, "Expected a WebSocket");
  const seat = await env.DB.prepare("SELECT seat FROM seats WHERE game = ? AND user = ?").bind(id, user.id).first<{ seat: string }>();
  if (!seat) return problem(404, "You don't have a seat in that game.");
  const room = env.GAME_ROOM.getByName(id);
  return room.fetch(new Request("https://room/ws", { headers: { Upgrade: "websocket", "X-Seat": seat.seat } }));
}

/** The Worker's handler (index.ts). No Cloudflare-only imports here, so tests run it in Node with a fake room and database. */
export const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    if (!env.ACCESS_AUD && !env.DEV_EMAIL) return problem(503, "Online play isn't switched on yet.");
    const who = await signedIn(request, env);
    if (!who) return problem(403, "Sign in to play online.");
    const user = await userFor(env, who);
    const path = url.pathname.replace(/\/+$/, "");
    if (path === "/api/me" && request.method === "GET") return json({ email: user.email, name: user.name });
    if (path === "/api/games" && request.method === "GET") return json({ games: await listGames(env, user) });
    if (path === "/api/games" && request.method === "POST") {
      let body: NewOnlineGame | null = null;
      try {
        body = (await request.json()) as NewOnlineGame;
      } catch {
        return problem(400, "That request couldn't be read.");
      }
      return createGame(env, user, body);
    }
    const ws = /^\/api\/games\/([a-z0-9]{6,24})\/ws$/.exec(path);
    if (ws && request.method === "GET") return openGame(env, user, ws[1]!, request);
    return problem(404, "Not found");
  },
};
