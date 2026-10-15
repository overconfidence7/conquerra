import { maps } from "@conquerra/content/maps";
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { API_TEXT, worker } from "../server/api";
import { mirrorGame, mirrorTable } from "../server/mirror";
import { cleanNewGame, nameFromEmail, newInviteCode } from "../server/online";
import type { Env } from "../server/env";
import type { OnlineGameInfo } from "../src/host/protocol";
import { RoomCore, type TableSetup } from "../src/host/roomCore";
import { accessKeyPair, AUD, goodClaims, TEAM } from "./accessHelpers";
import { memoryRoomStore, settings } from "./roomHelpers";
// @ts-expect-error: a plain .mjs script (the generator of server/maps.json)
import { slimMaps } from "../scripts/server-maps.mjs";

const web = join(__dirname, "..");
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");

/** D1's API over Node's SQLite, with the real migration applied (the same SQL the Worker runs). */
function d1() {
  const db = new DatabaseSync(":memory:");
  // Every migration, in order (session 27 added the tables).
  for (const f of readdirSync(join(web, "migrations")).filter((f) => f.endsWith(".sql")).sort()) db.exec(readFileSync(join(web, "migrations", f), "utf8"));
  type V = string | number | null;
  const stmt = (sql: string, params: V[] = []) => ({
    bind: (...p: V[]) => stmt(sql, p),
    first: async <T>() => (db.prepare(sql).get(...params) ?? null) as T | null,
    all: async <T>() => ({ results: db.prepare(sql).all(...params) as T[] }),
    run: async () => (db.prepare(sql).run(...params), { success: true }),
  });
  // (D1 runs a batch in order, as one transaction.)
  return { db, d1: { prepare: (sql: string) => stmt(sql), batch: async (list: { run(): Promise<unknown> }[]) => { const out = []; for (const s of list) out.push(await s.run()); return out; } } };
}

describe("the server's files (session 26)", () => {
  it("the room's slim maps are exactly the official maps without their drawing data (run `node apps/web/scripts/server-maps.mjs` after changing a map)", () => {
    const committed = readFileSync(join(web, "server/maps.json"), "utf8");
    expect(committed).toBe(slimMaps());
    const slim = JSON.parse(committed) as Record<string, { geometry?: unknown; territories: unknown[]; generator?: { version: number } }>;
    for (const [id, m] of Object.entries(maps)) {
      expect(slim[id]!.geometry).toBeUndefined();
      expect(slim[id]!.territories).toEqual(m.territories);
      expect(slim[id]!.generator?.version).toBe(m.generator?.version);
    }
  });

  it("the deployed config: the API behind the Worker, the room on SQLite, never the local sign-in stand-in", () => {
    const raw = readFileSync(join(web, "wrangler.jsonc"), "utf8");
    const cfg = JSON.parse(raw.replace(/^\s*\/\/.*$/gm, "")) as Record<string, unknown> & { assets: { run_worker_first: string[] }; migrations: { new_sqlite_classes: string[] }[]; vars: Record<string, string> };
    expect(cfg.workers_dev).toBe(false);
    expect(cfg.preview_urls).toBe(false);
    expect(cfg.assets.run_worker_first).toEqual(["/api/*", "/assets/*"]);
    expect(cfg.migrations[0]!.new_sqlite_classes).toEqual(["GameRoom"]);
    expect(cfg.vars.ACCESS_TEAM).toBe("keel-nkurtz.cloudflareaccess.com");
    expect(raw).not.toContain("DEV_EMAIL");
  });

  it("a name for a new account from its email, and a new game's settings checked", () => {
    expect(nameFromEmail("nkurtz@gmail.com")).toBe("Nkurtz");
    expect(nameFromEmail("jo.smith42@x.org")).toBe("Jo");
    expect(cleanNewGame({ settings: { ...settings, mapId: "atlantis" } })).toEqual({ error: "That map isn't one of the game's maps." });
    expect(cleanNewGame({ settings: { ...settings, bots: 12 } })).toEqual({ error: `Embervale takes 1 to ${maps.embervale!.maxPlayers - 1} bots.` });
    expect(cleanNewGame({ settings: { ...settings, turnSeconds: null } })).toMatchObject({ error: expect.stringContaining("timer") });
    expect(cleanNewGame({ settings: { ...settings, turnSeconds: 60 } })).toMatchObject({ error: expect.stringContaining("timer") });
    const ok = cleanNewGame({ settings: { ...settings, turnSeconds: 86_400, house: 99, leaderName: "  Lord Ash  " }, leadersRun: false });
    expect(ok).toMatchObject({ settings: { mapId: "embervale", bots: 3, turnSeconds: 86_400, house: 0, leaderName: "Lord Ash" }, leadersRun: false });
  });

  it("a missing built file answers 404 that nobody keeps, never the lobby's HTML (session 28)", async () => {
    const lobby = "<!doctype html><title>Conquerra</title>";
    // The assets binding as Cloudflare configures it: the single-page fallback answers any path it lacks with the lobby.
    const files: Record<string, [string, string]> = { "/assets/index-abc.js": ["export {}", "text/javascript"], "/assets/style-abc.css": ["body{}", "text/css"], "/index.html": [lobby, "text/html"] };
    const asked: string[] = [];
    const ASSETS = {
      fetch: async (req: Request) => {
        const path = new URL(req.url).pathname;
        asked.push(path);
        const [body, type] = files[path] ?? [lobby, "text/html"];
        return new Response(body, { status: 200, headers: { "content-type": type, "cache-control": "public, max-age=31536000, immutable" } });
      },
    };
    const env = { ASSETS, ACCESS_TEAM: TEAM } as unknown as Env;
    const get = (path: string) => worker.fetch(new Request(`https://conquerra.overconfidenceonline.com${path}`), env);
    const real = await get("/assets/index-abc.js");
    expect(real.status).toBe(200);
    expect(await real.text()).toBe("export {}");
    expect(real.headers.get("cache-control")).toContain("immutable");
    expect((await get("/assets/style-abc.css")).status).toBe(200);
    for (const missing of ["/assets/nothing.js", "/assets/GameScreen-old.js", "/assets/style-old.css", "/assets/cinzel-latin-600.woff2", "/assets/x.webp"]) {
      const res = await get(missing);
      expect(res.status, missing).toBe(404);
      expect(res.headers.get("cache-control")).toBe("no-store");
      expect(await res.text()).not.toContain("<");
    }
    // A plain 404 from the binding too.
    const notFound = { ...env, ASSETS: { fetch: async () => new Response("gone", { status: 404 }) } } as unknown as Env;
    const res = await worker.fetch(new Request("https://conquerra.overconfidenceonline.com/assets/a.js"), notFound);
    expect([res.status, res.headers.get("cache-control")]).toEqual([404, "no-store"]);
    // Pages still get the lobby (the single-page app's own routes).
    expect(await (await get("/")).text()).toBe(lobby);
    expect(await (await get("/?game=abc")).text()).toBe(lobby);
  });
});

describe("the API (sessions 26 and 27): sign-in first, then tables and games in the database and rooms", async () => {
  const { pub, sign } = await accessKeyPair();
  const { db, d1: DB } = d1();
  const rooms = new Map<string, RoomCore>();
  const opened: { id: string; seat: string | null; user: string | null; name: string | null }[] = [];
  /** Each room's pages (by account), as the stand-in room delivers them. */
  const pages = new Map<string, unknown[]>();
  const roomFor = (id: string) => {
    let room = rooms.get(id);
    if (!room) {
      const r: RoomCore = new RoomCore(memoryRoomStore(), async (m) => maps[m]!, {
        send: (seat, msg) => (pages.get(r.userOf(seat) ?? seat) ?? pages.set(r.userOf(seat) ?? seat, []).get(r.userOf(seat) ?? seat)!).push(msg) > 0,
        sendUser: (user, msg) => (pages.get(user) ?? pages.set(user, []).get(user)!).push(msg) > 0,
        users: () => [...pages.keys()],
        // The real copy, on the real database.
        tableChanged: (m) => void mirrorTable(DB as unknown as D1Database, m),
        wakeAt: () => {},
        listed: (info) => void mirrorGame(DB as unknown as D1Database, info),
        log: () => {},
      });
      room = r;
      rooms.set(id, room);
    }
    return room;
  };
  const env = {
    ACCESS_TEAM: TEAM,
    ACCESS_AUD: AUD,
    DB,
    GAME_ROOM: {
      getByName: (id: string) => ({
        createTable: (setup: TableSetup) => roomFor(id).createTable(setup),
        resignUser: (user: string, seat: string | null) => roomFor(id).resignUser(user, seat),
        // (Node can't make a 101 response: the stand-in room says who the Worker opened it for.)
        fetch: async (req: Request) => (opened.push({ id, seat: req.headers.get("X-Seat"), user: req.headers.get("X-User"), name: req.headers.get("X-Name") }), new Response("room")),
      }),
    },
  } as unknown as Env;

  beforeAll(() => {
    vi.stubGlobal("fetch", async (url: string) => (String(url) === `https://${TEAM}/cdn-cgi/access/certs` ? new Response(JSON.stringify({ keys: [pub] })) : new Response("no", { status: 404 })));
  });
  afterAll(() => vi.unstubAllGlobals());

  const call = async (path: string, init: RequestInit = {}, email: string | null = "nate@example.com") => {
    const headers = new Headers(init.headers);
    if (email) headers.set("Cf-Access-Jwt-Assertion", await sign({ ...goodClaims(Date.now()), email }));
    return worker.fetch(new Request(`https://conquerra.overconfidenceonline.com${path}`, { ...init, headers }), env);
  };
  const userId = (email: string) => (db.prepare("SELECT id FROM users WHERE email = ?").get(email) as { id: string }).id;
  const whoOf = (email: string) => {
    const u = db.prepare("SELECT id, name, colour FROM users WHERE email = ?").get(email) as { id: string; name: string; colour: number | null };
    return { user: u.id, name: u.name, colour: u.colour };
  };
  const list = async (email = "nate@example.com") => ((await (await call("/api/games", {}, email)).json()) as { games: OnlineGameInfo[] }).games;

  it("no Access token: refused; online play off until the AUD tag is set", async () => {
    expect((await call("/api/me", {}, null)).status).toBe(403);
    const off = await worker.fetch(new Request("https://conquerra.overconfidenceonline.com/api/me"), { ...env, ACCESS_AUD: "" } as Env);
    expect(off.status).toBe(503);
  });

  it("make a table: it waits for players, with its link's code; your list says so; you open it in your seat", async () => {
    expect(await (await call("/api/me")).json()).toEqual({ email: "nate@example.com", name: "Nate", colour: null });
    const made = await call("/api/games", { method: "POST", body: JSON.stringify({ settings: { ...settings, house: 2 }, leadersRun: true }) });
    expect(made.status).toBe(200);
    const { id, code } = (await made.json()) as { id: string; code: string };
    expect(id).toMatch(/^[a-z0-9]{12}$/);
    expect(code).toMatch(/^[a-z2-9]{10}$/);
    const row = db.prepare("SELECT * FROM games WHERE id = ?").get(id) as Record<string, unknown>;
    expect(row).toMatchObject({ map: "embervale", status: "waiting", invite: code, size: 4, seed: null });
    // The colour you made it with is your usual one now.
    expect(((await (await call("/api/me")).json()) as { colour: number }).colour).toBe(2);
    const [g] = await list();
    expect(g).toMatchObject({ id, status: "waiting", seats: 4, seated: 1, host: true, code, players: [{ name: "Nate", bot: false, you: true }] });
    expect((await call(`/api/games/${id}/ws`, { headers: { Upgrade: "websocket" } })).status).toBe(200);
    expect(opened.at(-1)).toEqual({ id, seat: "p1", user: userId("nate@example.com"), name: "Nate" });
  });

  it("a friend's link: the table it's for; they open its screen with the code, sit, the host starts; the database follows; late friends can't join", async () => {
    const { id, code } = (await (await call("/api/games", { method: "POST", body: JSON.stringify({ settings: { ...settings, bots: 2 }, leadersRun: true }) })).json()) as { id: string; code: string };
    // Kit (on the guest list) opens the link: the join route finds the table; the screen opens with the code only.
    expect(await (await call(`/api/join/${code}`, {}, "kit@example.com")).json()).toEqual({ id });
    expect((await call(`/api/games/${id}/ws`, { headers: { Upgrade: "websocket" } }, "kit@example.com")).status).toBe(404);
    expect((await call(`/api/games/${id}/ws?code=${code}`, { headers: { Upgrade: "websocket" } }, "kit@example.com")).status).toBe(200);
    expect(opened.at(-1)).toMatchObject({ id, seat: null, user: userId("kit@example.com"), name: "Kit" });
    // A wrong code, or a made-up link: no.
    expect((await call(`/api/games/${id}/ws?code=zzzzzzzzzz`, { headers: { Upgrade: "websocket" } }, "kit@example.com")).status).toBe(404);
    expect((await call(`/api/join/zzzzzzzzzz`, {}, "kit@example.com")).status).toBe(404);
    // Kit sits (in the room, the authority), and the database copies it: the seat, and Kit's usual colour.
    const room = rooms.get(id)!;
    const kit = whoOf("kit@example.com");
    await room.receive(kit, { id: 1, type: "table", act: { do: "sit", house: 6, leadersRun: false } });
    await new Promise((r) => setTimeout(r, 10));
    expect(db.prepare("SELECT seat, user, colour, leaders_run, state FROM seats WHERE game = ? ORDER BY seat").all(id)).toEqual([
      { seat: "p1", user: userId("nate@example.com"), colour: 0, leaders_run: 1, state: "in" },
      { seat: "p2", user: kit.user, colour: 6, leaders_run: 0, state: "in" },
    ]);
    expect(((await (await call("/api/me", {}, "kit@example.com")).json()) as { colour: number }).colour).toBe(6);
    expect((await list("kit@example.com"))[0]).toMatchObject({ id, status: "waiting", seated: 2, seats: 3, host: false });
    expect((await list("kit@example.com"))[0]!.code).toBeUndefined();
    // Kit's next visit opens with the seat (no code needed).
    await call(`/api/games/${id}/ws`, { headers: { Upgrade: "websocket" } }, "kit@example.com");
    expect(opened.at(-1)).toMatchObject({ seat: "p2" });
    // The host starts: the game is under way in the database, with the bot in the empty seat.
    await room.receive(whoOf("nate@example.com"), { id: 2, type: "table", act: { do: "start" } });
    await new Promise((r) => setTimeout(r, 10));
    const row = db.prepare("SELECT status, turn, seed_hash, deadline FROM games WHERE id = ?").get(id) as Record<string, unknown>;
    expect(row).toMatchObject({ status: "playing", turn: 1 });
    expect(String(row.seed_hash)).toMatch(/^[0-9a-f]{64}$/);
    expect(db.prepare("SELECT seat, bot FROM seats WHERE game = ? ORDER BY rowid").all(id)).toEqual([
      { seat: "p1", bot: null },
      { seat: "p2", bot: null },
      { seat: "bot1", bot: "marshal" },
    ]);
    const kitsList = await list("kit@example.com");
    expect(kitsList[0]).toMatchObject({ id, status: "playing", waitingOn: ["Nate", "you"], players: [{ name: "Nate" }, { name: "Kit", you: true }, { name: "Lady Morwen", bot: true }] });
    // Wren had the link but was late: the join route and the screen both say it started.
    const late = await call(`/api/join/${code}`, {}, "wren@example.com");
    expect(late.status).toBe(409);
    expect(((await late.json()) as { error: string }).error).toBe(API_TEXT.started);
    expect((await call(`/api/games/${id}/ws?code=${code}`, { headers: { Upgrade: "websocket" } }, "wren@example.com")).status).toBe(409);
    // Kit, seated, still gets the game from the link.
    expect(await (await call(`/api/join/${code}`, {}, "kit@example.com")).json()).toEqual({ id });
    // Kit leaves the game from the lobby's list: the room hands the seat to a Marshal; the list moves it to Finished.
    expect((await call(`/api/games/${id}/resign`, { method: "POST" }, "kit@example.com")).status).toBe(200);
    await new Promise((r) => setTimeout(r, 10));
    expect(rooms.get(id)!.table!.leftSeats).toEqual({ p2: { why: "resigned", turn: 1 } });
    expect(db.prepare("SELECT state, bot, left_turn FROM seats WHERE game = ? AND seat = 'p2'").get(id)).toEqual({ state: "resigned", bot: "marshal", left_turn: 1 });
    expect((await list("kit@example.com"))[0]).toMatchObject({ id, status: "playing", left: "resigned", leftTurn: 1, waitingOn: ["Nate"] });
    // Twice is fine (nothing more happens); someone without a seat can't.
    expect((await call(`/api/games/${id}/resign`, { method: "POST" }, "kit@example.com")).status).toBe(200);
    expect((await call(`/api/games/${id}/resign`, { method: "POST" }, "wren@example.com")).status).toBe(404);
  });

  it("a cancelled table leaves the lists; its link says so", async () => {
    const { id, code } = (await (await call("/api/games", { method: "POST", body: JSON.stringify({ settings, leadersRun: true }) })).json()) as { id: string; code: string };
    await rooms.get(id)!.receive(whoOf("nate@example.com"), { id: 1, type: "table", act: { do: "cancel" } });
    await new Promise((r) => setTimeout(r, 10));
    expect((await list()).some((g) => g.id === id)).toBe(false);
    expect((await call(`/api/join/${code}`, {}, "kit@example.com")).status).toBe(410);
  });

  it("your name: Settings changes it (cleaned), the next table uses it", async () => {
    const bad = await call("/api/me", { method: "PATCH", body: JSON.stringify({ name: "  <> 42 " }) });
    expect(bad.status).toBe(400);
    const ok = await call("/api/me", { method: "PATCH", body: JSON.stringify({ name: "  Lord   Nate  " }) });
    expect(await ok.json()).toMatchObject({ name: "Lord Nate" });
    const { id } = (await (await call("/api/games", { method: "POST", body: JSON.stringify({ settings, leadersRun: true }) })).json()) as { id: string };
    expect(db.prepare("SELECT name FROM seats WHERE game = ? AND seat = 'p1'").get(id)).toEqual({ name: "Lord Nate" });
    // A name travels to the room encoded (a header holds only plain characters).
    await call("/api/me", { method: "PATCH", body: JSON.stringify({ name: "Æthelflæd" }) });
    await call(`/api/games/${id}/ws`, { headers: { Upgrade: "websocket" } });
    expect(decodeURIComponent(opened.at(-1)!.name!)).toBe("Æthelflæd");
    expect((await call("/api/me", { method: "PATCH", body: JSON.stringify({ colour: 12 }) })).status).toBe(400);
  });

  it("a game that can't be made says so, and leaves nothing behind", async () => {
    const bad = await call("/api/games", { method: "POST", body: JSON.stringify({ settings: { ...settings, turnSeconds: null } }) });
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { error: string }).error).toContain("timer");
  });

  it("the invite code: ten letters and digits from a random source, a different one each time", () => {
    const codes = new Set(Array.from({ length: 2000 }, () => newInviteCode()));
    expect(codes.size).toBe(2000);
    for (const c of codes) expect(c).toMatch(/^[a-z2-9]{10}$/);
  });
});
