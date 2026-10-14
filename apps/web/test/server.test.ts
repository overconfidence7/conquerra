import { maps } from "@conquerra/content/maps";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { worker } from "../server/api";
import { cleanNewGame, nameFromEmail } from "../server/online";
import type { Env } from "../server/env";
import type { OnlineGameInfo } from "../src/host/protocol";
import { RoomCore, type RoomSetup } from "../src/host/roomCore";
import { accessKeyPair, AUD, goodClaims, TEAM } from "./accessHelpers";
import { memoryRoomStore, settings } from "./roomHelpers";
// @ts-expect-error: a plain .mjs script (the generator of server/maps.json)
import { slimMaps } from "../scripts/server-maps.mjs";

const web = join(__dirname, "..");
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");

/** D1's API over Node's SQLite, with the real migration applied (the same SQL the Worker runs). */
function d1() {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(join(web, "migrations/0001_online.sql"), "utf8"));
  type V = string | number | null;
  const stmt = (sql: string, params: V[] = []) => ({
    bind: (...p: V[]) => stmt(sql, p),
    first: async <T>() => (db.prepare(sql).get(...params) ?? null) as T | null,
    all: async <T>() => ({ results: db.prepare(sql).all(...params) as T[] }),
    run: async () => (db.prepare(sql).run(...params), { success: true }),
  });
  return { db, d1: { prepare: (sql: string) => stmt(sql), batch: async (list: { run(): Promise<unknown> }[]) => Promise.all(list.map((s) => s.run())) } };
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
    expect(cfg.assets.run_worker_first).toEqual(["/api/*"]);
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
});

describe("the API (session 26): sign-in first, then games in the database and rooms", async () => {
  const { pub, sign } = await accessKeyPair();
  const { db, d1: DB } = d1();
  const rooms = new Map<string, RoomCore>();
  const opened: { id: string; seat: string | null }[] = [];
  const env = {
    ACCESS_TEAM: TEAM,
    ACCESS_AUD: AUD,
    DB,
    GAME_ROOM: {
      getByName: (id: string) => ({
        async create(setup: RoomSetup) {
          const room = new RoomCore(memoryRoomStore(), async (m) => maps[m]!, { send: () => false, wakeAt: () => {}, listed: () => {}, log: () => {} });
          rooms.set(id, room);
          const info = await room.create(setup);
          return { info, players: room.hello(setup.people[0]!.id).view.players.map((p) => ({ id: p.id, name: p.name, house: p.house })) };
        },
        // (Node can't make a 101 response: the stand-in room says which seat the Worker opened.)
        fetch: async (req: Request) => (opened.push({ id, seat: req.headers.get("X-Seat") }), new Response("room")),
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

  it("no Access token: refused; online play off until the AUD tag is set", async () => {
    expect((await call("/api/me", {}, null)).status).toBe(403);
    const off = await worker.fetch(new Request("https://conquerra.overconfidenceonline.com/api/me"), { ...env, ACCESS_AUD: "" } as Env);
    expect(off.status).toBe(503);
  });

  it("the first sign-in makes the account; make a game; it's in your list; you open it in your seat", async () => {
    expect(await (await call("/api/me")).json()).toEqual({ email: "nate@example.com", name: "Nate" });
    const made = await call("/api/games", { method: "POST", body: JSON.stringify({ settings, leadersRun: true }) });
    expect(made.status).toBe(200);
    const { id } = (await made.json()) as { id: string };
    expect(id).toMatch(/^[a-z0-9]{12}$/);
    const row = db.prepare("SELECT * FROM games WHERE id = ?").get(id) as Record<string, unknown>;
    expect(row).toMatchObject({ map: "embervale", status: "playing", turn: 1, seed: null });
    expect(String(row.seed_hash)).toMatch(/^[0-9a-f]{64}$/);
    const { games } = (await (await call("/api/games")).json()) as { games: OnlineGameInfo[] };
    expect(games).toHaveLength(1);
    expect(games[0]).toMatchObject({ id, mapName: "Embervale", turn: 1, status: "playing", waitingOn: ["you"], leadersRun: true });
    expect(games[0]!.players).toEqual([
      { name: "Nate", bot: false, you: true },
      { name: "Lady Morwen", bot: true, you: false },
      { name: "Baron Krell", bot: true, you: false },
      { name: "Queen Isolde", bot: true, you: false },
    ]);
    const ws = await call(`/api/games/${id}/ws`, { headers: { Upgrade: "websocket" } });
    expect(ws.status).toBe(200);
    expect(opened.at(-1)).toEqual({ id, seat: "p1" });
    // Someone else (signed in, but with no seat at that table) can't open it.
    expect((await call(`/api/games/${id}/ws`, { headers: { Upgrade: "websocket" } }, "stranger@example.com")).status).toBe(404);
    expect(((await (await call("/api/games", {}, "stranger@example.com")).json()) as { games: unknown[] }).games).toEqual([]);
  });

  it("a game that can't be made says so, and leaves nothing behind", async () => {
    const bad = await call("/api/games", { method: "POST", body: JSON.stringify({ settings: { ...settings, turnSeconds: null } }) });
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { error: string }).error).toContain("timer");
  });
});
