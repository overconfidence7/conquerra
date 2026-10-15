import { mapCatalog } from "@conquerra/content";
import type { NewOnlineGame, OnlineGameInfo } from "../src/host/protocol";
import { newSeed } from "../src/host/roomCore";
import { AccessCache, accessKeys, verifyAccess, type SignedIn } from "./access";
import { cleanSub } from "./webPush";
import type { Env } from "./env";
import { cleanName, cleanNewGame, nameFromEmail, newGameId, newInviteCode } from "./online";

/**
 * The Worker `conquerra`'s API (session 26): it serves the game's static files as before, and the online API under /api.
 * Every API call and WebSocket is checked against Cloudflare Access's signed token first. These handlers do almost no
 * work (the Free plan gives them 10 ms of CPU): check the sign-in, read or write a row, open the game's room. The
 * engine and the bots only ever run inside the room.
 *
 *   GET   /api/me                 who you are signed in as (your name and usual colour)
 *   PATCH /api/me                 change your name or usual colour: { name?, colour? }
 *   GET   /api/games              your online games (the lobby's list)
 *   POST  /api/games              make a table: { settings, leadersRun } → { id, code } (session 27: it starts when its host says so)
 *   GET   /api/join/:code         the table a link is for → { id } (or why you can't join it)
 *   POST  /api/games/:id/resign   leave a game for good: a Marshal plays your seat (session 27)
 *   GET   /api/games/:id/ws       open a game (a WebSocket to its room): your seat, or with ?code= the table's screen
 *
 * Sign-in is Access and nothing else: someone whose email isn't in the Access policy never reaches any of this. The
 * invite code grants a seat at one table, never a sign-in.
 */

let keys: ReturnType<typeof accessKeys> | null = null;
/** Session 29: checked tokens and imported keys, for this isolate's life (in memory only). */
const accessCache = new AccessCache();

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const problem = (status: number, error: string) => json({ error }, status);

/** The sentences the API answers with (the voice guide applies). */
export const API_TEXT = {
  noGame: "That link isn't a game. Check you have the whole link, or ask for it again.",
  started: "This game has started. Games can't be joined once they're under way, so ask the host to make a new table for the next one.",
  cancelled: "The host cancelled this table.",
  noSeat: "You don't have a seat in that game.",
} as const;

/** A finished game stays in "Your online games" (under Finished) for a week. */
const FINISHED_KEPT_MS = 7 * 24 * 3600 * 1000;

/**
 * Who's asking: the email in a valid Access token. Under `wrangler dev` only, DEV_EMAIL stands in (it lives in the
 * git-ignored apps/web/.dev.vars, which Wrangler never uploads; a test checks the deployed config never sets it).
 * Session 27: `wrangler dev` also takes another email from the X-Dev-Email header (the headless table test plays two
 * people), never in the deployed Worker, where DEV_EMAIL is never set.
 */
async function signedIn(request: Request, env: Env): Promise<SignedIn | null> {
  if (env.DEV_EMAIL) {
    // (A browser can't set a header on a WebSocket: a `dev_email` cookie does it there, one account per host name.)
    const cookie = /(?:^|;\s*)dev_email=([^;]+)/.exec(request.headers.get("Cookie") ?? "")?.[1];
    return { email: (request.headers.get("X-Dev-Email") || (cookie ? decodeURIComponent(cookie) : "") || env.DEV_EMAIL).toLowerCase(), sub: "dev" };
  }
  keys ??= accessKeys(env.ACCESS_TEAM);
  const result = await verifyAccess(request.headers.get("Cf-Access-Jwt-Assertion"), { team: env.ACCESS_TEAM, aud: env.ACCESS_AUD ?? "" }, keys, Date.now(), accessCache);
  if (!result.ok) console.log(`sign-in refused: ${result.why}`);
  return result.ok ? result.user : null;
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  colour: number | null;
  /** Session 29: an email when it's their turn in a long game. */
  turn_email?: number;
}

/** The account for this email, made the first time it signs in. */
async function userFor(env: Env, who: SignedIn): Promise<UserRow> {
  const found = await env.DB.prepare("SELECT id, email, name, colour, turn_email FROM users WHERE email = ?").bind(who.email).first<UserRow>();
  if (found) return found;
  const row = { id: crypto.randomUUID(), email: who.email, name: nameFromEmail(who.email) };
  await env.DB.prepare("INSERT INTO users (id, email, name, created) VALUES (?, ?, ?, ?) ON CONFLICT(email) DO NOTHING").bind(row.id, row.email, row.name, Date.now()).run();
  return (await env.DB.prepare("SELECT id, email, name, colour, turn_email FROM users WHERE email = ?").bind(who.email).first<UserRow>())!;
}

interface GameRow {
  id: string;
  map: string;
  status: "waiting" | "playing" | "over" | "cancelled";
  turn: number;
  waiting: string;
  deadline: number | null;
  created: number;
  updated: number;
  winner: string | null;
  seat: string;
  leaders_run: number;
  state: "in" | "resigned" | "taken";
  left_turn: number | null;
  host_user: string;
  invite: string | null;
  size: number | null;
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
    "SELECT g.id, g.map, g.status, g.turn, g.waiting, g.deadline, g.created, g.updated, g.winner, g.host_user, g.invite, g.size, s.seat, s.leaders_run, s.state, s.left_turn FROM games g JOIN seats s ON s.game = g.id WHERE s.user = ? AND g.status != 'cancelled' AND (g.status != 'over' OR g.updated > ?) ORDER BY g.updated DESC LIMIT 30",
  )
    .bind(user.id, Date.now() - FINISHED_KEPT_MS)
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
    const host = g.host_user === user.id;
    return {
      id: g.id,
      mapId: g.map,
      mapName: mapCatalog.find((m) => m.id === g.map)?.name ?? g.map,
      turn: g.turn,
      status: g.status === "cancelled" ? "over" : g.status,
      waitingOn: g.status === "playing" && g.state === "in" ? waiting : g.status === "playing" ? waiting.filter((w) => w !== "you") : [],
      deadline: g.deadline,
      players: table.map((s) => ({ name: s.name, bot: !!s.bot, you: s.seat === g.seat })),
      created: g.created,
      leadersRun: !!g.leaders_run,
      ...(g.status === "waiting" ? { seats: g.size ?? table.length, seated: table.filter((s) => s.user).length, host, ...(host && g.invite ? { code: g.invite } : {}) } : {}),
      ...(g.state !== "in" ? { left: g.state, ...(g.left_turn ? { leftTurn: g.left_turn } : {}) } : {}),
      ...(g.winner ? { winner: nameOf(g.winner) } : {}),
    };
  });
}

/** Make a table (session 27): the host sits in the first seat; friends join from the link; the host starts it. */
async function createGame(env: Env, user: UserRow, body: unknown): Promise<Response> {
  const clean = cleanNewGame(body);
  if ("error" in clean) return problem(400, clean.error);
  const { settings, leadersRun } = clean;
  const id = newGameId();
  const code = newInviteCode();
  const now = Date.now();
  const house = settings.house ?? 0;
  const size = settings.bots + 1;
  // The game's row first (the room keeps it up to date from here on).
  await env.DB.batch([
    env.DB.prepare("INSERT INTO games (id, map, settings, status, host_user, created, turn, updated, seed_hash, invite, size) VALUES (?, ?, ?, 'waiting', ?, ?, 1, ?, '', ?, ?)").bind(id, settings.mapId, JSON.stringify(settings), user.id, now, now, code, size),
    env.DB.prepare("INSERT INTO seats (game, seat, user, bot, colour, name, leaders_run) VALUES (?, 'p1', ?, NULL, ?, ?, ?)").bind(id, user.id, house, user.name, leadersRun ? 1 : 0),
    env.DB.prepare("UPDATE users SET colour = ? WHERE id = ?").bind(house, user.id),
  ]);
  try {
    await env.GAME_ROOM.getByName(id).createTable({
      gameId: id,
      code,
      settings,
      seed: newSeed(),
      host: {
        user: user.id,
        name: user.name,
        house,
        leadersRun,
        ...(settings.leaderName ? { leaderName: settings.leaderName } : {}),
        ...(settings.stewardName ? { stewardName: settings.stewardName } : {}),
        leaderPersonality: settings.leaderPersonality ?? null,
        stewardPersonality: settings.stewardPersonality ?? null,
      },
    });
  } catch (e) {
    await env.DB.batch([env.DB.prepare("DELETE FROM seats WHERE game = ?").bind(id), env.DB.prepare("DELETE FROM games WHERE id = ?").bind(id)]);
    console.log(`making game ${id} failed: ${e instanceof Error ? e.message : String(e)}`);
    return problem(500, "The game couldn't be made. Try again in a moment.");
  }
  return json({ id, code });
}

/** The table a link is for. A game that has started is only for the people sitting at it. */
async function join(env: Env, user: UserRow, code: string): Promise<Response> {
  const game = await env.DB.prepare("SELECT id, status FROM games WHERE invite = ?").bind(code).first<{ id: string; status: string }>();
  if (!game) return problem(404, API_TEXT.noGame);
  if (game.status === "cancelled") return problem(410, API_TEXT.cancelled);
  if (game.status !== "waiting") {
    const seat = await env.DB.prepare("SELECT seat FROM seats WHERE game = ? AND user = ?").bind(game.id, user.id).first<{ seat: string }>();
    if (!seat) return problem(409, API_TEXT.started);
  }
  return json({ id: game.id });
}

async function openGame(env: Env, user: UserRow, id: string, request: Request): Promise<Response> {
  if (request.headers.get("Upgrade") !== "websocket") return problem(426, "Expected a WebSocket");
  const seat = await env.DB.prepare("SELECT seat FROM seats WHERE game = ? AND user = ?").bind(id, user.id).first<{ seat: string }>();
  if (!seat) {
    // No seat yet: only with the table's code, and only while it's waiting for players.
    const code = new URL(request.url).searchParams.get("code") ?? "";
    const game = code ? await env.DB.prepare("SELECT status FROM games WHERE id = ? AND invite = ?").bind(id, code).first<{ status: string }>() : null;
    if (!game) return problem(404, API_TEXT.noSeat);
    if (game.status !== "waiting") return problem(409, game.status === "cancelled" ? API_TEXT.cancelled : API_TEXT.started);
  }
  const room = env.GAME_ROOM.getByName(id);
  // (The name travels encoded: a header holds only plain characters.)
  const headers: Record<string, string> = { Upgrade: "websocket", "X-User": user.id, "X-Name": encodeURIComponent(user.name) };
  if (user.colour !== null && user.colour !== undefined) headers["X-Colour"] = String(user.colour);
  if (seat) headers["X-Seat"] = seat.seat;
  return room.fetch(new Request("https://room/ws", { headers }));
}

/**
 * The lobby's "Leave this game" (session 27): you resign. The room decides (a Marshal takes the seat; the game moves
 * to Finished in your list); the database copies it here too, for games from session 26 that have no table.
 */
async function resign(env: Env, user: UserRow, id: string): Promise<Response> {
  const seat = await env.DB.prepare("SELECT seat, state FROM seats WHERE game = ? AND user = ?").bind(id, user.id).first<{ seat: string; state: string }>();
  if (!seat) return problem(404, API_TEXT.noSeat);
  if (seat.state !== "in") return json({ ok: true });
  const done = await env.GAME_ROOM.getByName(id).resignUser(user.id, seat.seat);
  if (!done) return problem(409, "You can't resign from that game now (it's over, or you're already out).");
  await env.DB.prepare("UPDATE seats SET state = 'resigned', bot = 'marshal', left_turn = COALESCE(left_turn, (SELECT turn FROM games WHERE id = ?)) WHERE game = ? AND user = ?").bind(id, id, user.id).run();
  return json({ ok: true });
}

/** Who you are, for the page: your name and usual colour, and (session 29) what "your turn" needs. */
const meOf = (env: Env, user: UserRow) => ({ email: user.email, name: user.name, colour: user.colour, turnEmail: !!user.turn_email, ...(env.VAPID_PUBLIC ? { push: env.VAPID_PUBLIC } : {}) });

/**
 * Session 29: this browser's push subscription ("Tell me when it's my turn"), checked (a real push service, keys of the
 * right size), or taken away. One row per browser: subscribing again replaces it.
 */
async function pushSub(env: Env, user: UserRow, request: Request): Promise<Response> {
  const b = await body<{ endpoint?: unknown; keys?: unknown }>(request);
  if (request.method === "DELETE") {
    if (typeof b?.endpoint === "string") await env.DB.prepare("DELETE FROM push_subs WHERE endpoint = ? AND user = ?").bind(b.endpoint, user.id).run();
    return json({ ok: true });
  }
  const sub = cleanSub(b);
  if (!sub) return problem(400, "That browser's subscription couldn't be read.");
  await env.DB.prepare("INSERT INTO push_subs (endpoint, user, p256dh, auth, made) VALUES (?, ?, ?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET user = excluded.user, p256dh = excluded.p256dh, auth = excluded.auth, made = excluded.made")
    .bind(sub.endpoint, user.id, sub.p256dh, sub.auth, Date.now())
    .run();
  return json({ ok: true });
}

/** Change your name or usual colour (Settings, session 27), or (session 29) whether you get turn emails. */
async function updateMe(env: Env, user: UserRow, body: unknown): Promise<Response> {
  const b = (body && typeof body === "object" ? body : {}) as { name?: unknown; colour?: unknown; turnEmail?: unknown };
  if (typeof b.turnEmail === "boolean") {
    await env.DB.prepare("UPDATE users SET turn_email = ? WHERE id = ?").bind(b.turnEmail ? 1 : 0, user.id).run();
    user = { ...user, turn_email: b.turnEmail ? 1 : 0 };
  }
  if (b.name !== undefined) {
    const name = cleanName(b.name);
    if (!name) return problem(400, "A name needs at least one letter (24 characters at most).");
    await env.DB.prepare("UPDATE users SET name = ? WHERE id = ?").bind(name, user.id).run();
    user = { ...user, name };
  }
  if (b.colour !== undefined) {
    if (!Number.isInteger(b.colour) || (b.colour as number) < 0 || (b.colour as number) > 9) return problem(400, "That isn't one of the ten House colours.");
    await env.DB.prepare("UPDATE users SET colour = ? WHERE id = ?").bind(b.colour, user.id).run();
    user = { ...user, colour: b.colour as number };
  }
  return json(meOf(env, user));
}

async function body<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

/**
 * A built file under /assets/ (session 28). The single-page fallback answers a path it doesn't have with the lobby's
 * HTML, and `_headers` gives /assets/* a year's immutable cache: one miss during a deploy was kept as HTML by the edge,
 * the browser and the service worker, and the page came up blank. So the Worker runs first for /assets/* too, and
 * anything that isn't the file itself (a 404, or HTML for a .js, .css, .woff2… path) answers 404 that nobody keeps.
 */
export async function serveAsset(request: Request, env: Env, path: string): Promise<Response> {
  const res = await env.ASSETS.fetch(request);
  const html = (res.headers.get("content-type") ?? "").includes("text/html");
  if (res.status === 404 || (res.status === 200 && html && !/\.html?$/i.test(path))) {
    await res.body?.cancel();
    return new Response("Not found", { status: 404, headers: { "content-type": "text/plain", "cache-control": "no-store" } });
  }
  return res;
}

/** The Worker's handler (index.ts). No Cloudflare-only imports here, so tests run it in Node with a fake room and database. */
export const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/assets/")) return serveAsset(request, env, url.pathname);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    if (!env.ACCESS_AUD && !env.DEV_EMAIL) return problem(503, "Online play isn't switched on yet.");
    const who = await signedIn(request, env);
    if (!who) return problem(403, "Sign in to play online.");
    const user = await userFor(env, who);
    const path = url.pathname.replace(/\/+$/, "");
    if (path === "/api/me" && request.method === "GET") return json(meOf(env, user));
    if (path === "/api/push" && (request.method === "POST" || request.method === "DELETE")) return pushSub(env, user, request);
    if (path === "/api/me" && request.method === "PATCH") return updateMe(env, user, await body(request));
    if (path === "/api/games" && request.method === "GET") return json({ games: await listGames(env, user) });
    if (path === "/api/games" && request.method === "POST") {
      const b = await body<NewOnlineGame>(request);
      if (!b) return problem(400, "That request couldn't be read.");
      return createGame(env, user, b);
    }
    const code = /^\/api\/join\/([a-z0-9]{6,24})$/.exec(path);
    if (code && request.method === "GET") return join(env, user, code[1]!);
    const quit = /^\/api\/games\/([a-z0-9]{6,24})\/resign$/.exec(path);
    if (quit && request.method === "POST") return resign(env, user, quit[1]!);
    const ws = /^\/api\/games\/([a-z0-9]{6,24})\/ws$/.exec(path);
    if (ws && request.method === "GET") return openGame(env, user, ws[1]!, request);
    return problem(404, "Not found");
  },
};
