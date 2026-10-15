import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { worker } from "../server/api";
import type { Env } from "../server/env";
import { FROM, LONG_TURN_S, notifyTurn, TURN_TEXT, turnEmail, type TurnNotice } from "../server/notify";
import { fakeBrowser, testVapid } from "./pushHelpers";
import { hostSeat, KIT, NATE, settings, testRoom, WREN } from "./roomHelpers";

/**
 * Session 29, Part 3: "your turn". The room asks for one when a planning window opens for people whose page isn't
 * open, once a turn, for every timer; the shell sends a push to each browser they turned it on in (a 410 removes it)
 * and, in a long game, an email if they asked. Nothing fogged in either.
 */

const web = join(__dirname, "..");
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");
function d1() {
  const db = new DatabaseSync(":memory:");
  for (const f of readdirSync(join(web, "migrations")).filter((f) => f.endsWith(".sql")).sort()) db.exec(readFileSync(join(web, "migrations", f), "utf8"));
  type V = string | number | null;
  const stmt = (sql: string, params: V[] = []) => ({
    bind: (...p: V[]) => stmt(sql, p),
    first: async <T>() => (db.prepare(sql).get(...params) ?? null) as T | null,
    all: async <T>() => ({ results: db.prepare(sql).all(...params) as T[] }),
    run: async () => (db.prepare(sql).run(...params), { success: true }),
  });
  return { db, d1: { prepare: (sql: string) => stmt(sql), batch: async () => [] } as unknown as D1Database };
}

async function table(turnSeconds = 300) {
  const t = testRoom(undefined, 1_000_000, { notify: true });
  await t.room.createTable({ gameId: "notify", code: "n0t1fy0001", settings: { ...settings, turnSeconds, bots: 3 }, seed: "your-turn", host: hostSeat(NATE, 0) });
  await t.table(NATE);
  await t.act(KIT, { do: "sit", house: 3, leadersRun: true });
  await t.act(WREN, { do: "sit", house: 5, leadersRun: true });
  // Kit and Wren close their pages; Nate's stays open.
  t.leave(KIT);
  t.leave(WREN);
  await t.act(NATE, { do: "start" });
  return t;
}

describe("your turn, from the room (session 29)", () => {
  it("as the window opens: everyone whose page isn't open, once a turn; the open page gets none", async () => {
    const t = await table();
    const g = t.room.table!;
    // Turn 1 opens at once: Kit and Wren are told, Nate (here) isn't.
    expect(t.notices).toEqual([{ gameId: "notify", turn: 1, map: "Embervale", users: [KIT.user, WREN.user], turnSeconds: 300 }]);
    // Anything else this turn tells nobody again.
    await t.hello("p1");
    await t.ask("p2", { type: "saveOrders", orders: [], turn: 1 });
    expect(t.notices).toHaveLength(1);
    // Wren locks in (from the lobby's resend, say): when turn 2's window opens, only Kit and Wren again, once.
    for (const s of ["p1", "p2", "p3"]) await t.ask(s, { type: "lockIn", orders: [], turn: 1 });
    expect(g.turn).toBe(2);
    expect(t.notices).toHaveLength(1);
    // The room wakes as the window opens (the table's longest replay and its 10 s), not at the deadline.
    const opens = g.windowOpensAt!;
    expect(t.alarm()).toBe(opens);
    t.advance(opens - t.now());
    await t.tick();
    expect(t.notices.at(-1)).toMatchObject({ turn: 2, users: [KIT.user, WREN.user] });
    expect(t.alarm()).toBe(g.nextDeadline);
    await t.tick();
    expect(t.notices).toHaveLength(2);
  });

  it("a room the alarm wakes (no page open since) still tells them (found on the preview: it hadn't loaded its table)", async () => {
    const t = await table(3600);
    for (const s of ["p1", "p2", "p3"]) await t.ask(s, { type: "lockIn", orders: [], turn: 1 });
    const opens = t.room.table!.windowOpensAt!;
    await t.room.flush();
    // The same storage, a fresh room (the Durable Object slept), nobody connected: its alarm.
    const woke = testRoom(t.store, t.now(), { notify: true });
    woke.advance(opens - woke.now());
    await woke.room.alarm();
    expect(woke.notices).toEqual([{ gameId: "notify", turn: 2, map: "Embervale", users: [NATE.user, KIT.user, WREN.user], turnSeconds: 3600 }]);
  });

  it("someone who locked in, resigned or is out isn't told; with every timer (the 3-minute one too)", async () => {
    const t = await table(180);
    t.notices.length = 0;
    await t.room.resign("p3");
    await t.ask("p2", { type: "lockIn", orders: [], turn: 1 });
    await t.ask("p1", { type: "lockIn", orders: [], turn: 1 });
    const g = t.room.table!;
    t.advance(g.windowOpensAt! - t.now());
    await t.tick();
    // (Kit locked in turn 1, but turn 2 is new: she's told; Wren resigned: never.)
    expect(t.notices.map((n) => [n.turn, n.users, n.turnSeconds])).toEqual([[2, [KIT.user], 180]]);
  });

  it("the notice carries nothing fogged: the map's name and the turn", async () => {
    const t = await table();
    expect(Object.keys(t.notices[0]!).sort()).toEqual(["gameId", "map", "turn", "turnSeconds", "users"]);
  });
});

describe("your turn, sent (session 29)", () => {
  const notice = (users: string[], turnSeconds = 300): TurnNotice => ({ gameId: "g123", turn: 12, map: "Embervale", users, turnSeconds });

  it("a push to each browser, readable only there, saying only the map and the turn; a 410 removes the subscription", async () => {
    const { d1: db, db: raw } = d1();
    const vapid = await testVapid();
    const phone = await fakeBrowser();
    const laptop = await fakeBrowser();
    laptop.sub.endpoint = "https://updates.push.services.mozilla.com/wpush/v2/gone";
    raw.exec("INSERT INTO users (id, email, name, created) VALUES ('u1', 'nate@example.com', 'Nate', 0), ('u2', 'kit@example.com', 'Kit', 0)");
    for (const [b, user] of [[phone, "u1"], [laptop, "u1"]] as const) raw.prepare("INSERT INTO push_subs (endpoint, user, p256dh, auth, made) VALUES (?, ?, ?, ?, 0)").run(b.sub.endpoint, user, b.sub.p256dh, b.sub.auth);
    const sent: Request[] = [];
    const r = await notifyTurn(notice(["u1"]), {
      db,
      vapid,
      fetch: async (req) => (sent.push(req), new Response(null, { status: req.url.includes("gone") ? 410 : 201 })),
      mail: null,
      now: 1_800_000_000_000,
      log: () => undefined,
    });
    expect(r).toEqual({ pushed: 1, removed: 1, emailed: 0 });
    expect(sent.map((q) => q.url).sort()).toEqual([phone.sub.endpoint, laptop.sub.endpoint].sort());
    const toPhone = sent.find((q) => q.url === phone.sub.endpoint)!;
    expect(JSON.parse(await phone.read(new Uint8Array(await toPhone.arrayBuffer())))).toEqual({ title: TURN_TEXT.title, body: "Embervale, turn 12", url: "/?game=g123", tag: "turn-g123" });
    expect(toPhone.headers.get("TTL")).toBe("300");
    // The gone one is gone from the database; the other stays.
    expect(raw.prepare("SELECT endpoint FROM push_subs").all()).toEqual([{ endpoint: phone.sub.endpoint }]);
  });

  it("email: long games only (1 h and up), to people who asked; an address that can't be reached fails quietly, logged once", async () => {
    const { d1: db, db: raw } = d1();
    raw.exec("INSERT INTO users (id, email, name, created, turn_email) VALUES ('u1', 'nate@example.com', 'Nate', 0, 1), ('u2', 'kit@example.com', 'Kit', 0, 0), ('u3', 'wren@example.com', 'Wren', 0, 1)");
    const mails: { to: string; subject: string; raw: string }[] = [];
    const logs: string[] = [];
    const deps = {
      db,
      vapid: null,
      fetch: async () => new Response(null, { status: 201 }),
      mail: async (to: string, subject: string, raw: string) => {
        if (to.startsWith("wren")) throw new Error("destination address not verified");
        mails.push({ to, subject, raw });
      },
      now: 1_800_000_000_000,
      log: (l: string) => void logs.push(l),
    };
    expect((await notifyTurn(notice(["u1", "u2", "u3"], 300), deps)).emailed).toBe(0);
    expect(mails).toEqual([]);
    expect((await notifyTurn(notice(["u1", "u2", "u3"], LONG_TURN_S), deps)).emailed).toBe(1);
    expect(mails.map((m) => [m.to, m.subject])).toEqual([["nate@example.com", "Your turn in Conquerra: Embervale, turn 12"]]);
    expect(mails[0]!.raw).toContain(`From: Conquerra <${FROM}>`);
    expect(mails[0]!.raw).toContain("https://conquerra.overconfidenceonline.com/?game=g123");
    // Wren's address isn't verified: logged once, then skipped quietly.
    await notifyTurn(notice(["u3"], 8 * 3600), deps);
    expect(logs.filter((l) => l.includes("couldn't be sent"))).toHaveLength(1);
    expect(logs[0]).not.toContain("wren@example.com");
  });

  it("the email is plain text and says only the map, the turn and the link", () => {
    const m = turnEmail("nate@example.com", "Embervale", 12, "g123", 1_800_000_000_000);
    const body = m.raw.split("\r\n\r\n").slice(1).join("\r\n\r\n");
    expect(m.raw).toContain("Content-Type: text/plain; charset=utf-8");
    expect(body.split("\r\n").filter(Boolean)).toEqual(["Your turn in Conquerra: Embervale, turn 12", "https://conquerra.overconfidenceonline.com/?game=g123", TURN_TEXT.emailOff]);
  });
});

describe("your turn, the API (session 29)", () => {
  it("a browser's subscription is kept (checked), replaced, and removed; /api/me says the push key and the email choice", async () => {
    const { d1: db, db: raw } = d1();
    const env = { DB: db, DEV_EMAIL: "nate@example.com", ACCESS_TEAM: "x", VAPID_PUBLIC: "BPvN-test-key" } as unknown as Env;
    const call = (path: string, init: RequestInit = {}) => worker.fetch(new Request(`https://conquerra.overconfidenceonline.com${path}`, init), env);
    const me = (await (await call("/api/me")).json()) as { push?: string; turnEmail: boolean };
    expect(me).toMatchObject({ push: "BPvN-test-key", turnEmail: false });
    const { sub } = await fakeBrowser();
    const body = JSON.stringify({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } });
    expect((await call("/api/push", { method: "POST", body })).status).toBe(200);
    expect((await call("/api/push", { method: "POST", body })).status).toBe(200);
    expect(raw.prepare("SELECT COUNT(*) AS n FROM push_subs").get()).toEqual({ n: 1 });
    expect((await call("/api/push", { method: "POST", body: JSON.stringify({ endpoint: "https://evil.example.com/x", keys: { p256dh: sub.p256dh, auth: sub.auth } }) })).status).toBe(400);
    expect((await call("/api/push", { method: "DELETE", body: JSON.stringify({ endpoint: sub.endpoint }) })).status).toBe(200);
    expect(raw.prepare("SELECT COUNT(*) AS n FROM push_subs").get()).toEqual({ n: 0 });
    const on = (await (await call("/api/me", { method: "PATCH", body: JSON.stringify({ turnEmail: true }) })).json()) as { turnEmail: boolean };
    expect(on.turnEmail).toBe(true);
  });
});
