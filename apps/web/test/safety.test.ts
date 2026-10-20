import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { joinGate, reportEmail, roomSafety, tableCap, blockList, unblock } from "../server/safety";
import { CHAT_GAP_MS } from "../src/host/chatRoom";
import type { ChatSync, RoomMessage } from "../src/host/protocol";
import type { LineReport } from "../src/host/roomCore";
import { SAFETY_LIMITS, SAFETY_TEXT } from "../src/host/safetyText";
import { hostSeat, KIT, NATE, ROOK, settings, testRoom, WREN } from "./roomHelpers";

const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as typeof import("node:sqlite");
const web = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Session 34, abuse limits: a report on a person's chat line (to Nate's email and D1, three a day, a line once), a block
 * list (the room filters a blocked person's lines before anything reaches the reader: fog-wire style, with a planted
 * bypass that must leak), and the caps (20 tables a day, 30 room messages in 10 s a page, 10 joins a minute an address).
 */

/** D1 over Node's SQLite with every migration applied (as the Worker's), with `changes` and RETURNING in a batch. */
function d1() {
  const db = new DatabaseSync(":memory:");
  for (const f of readdirSync(join(web, "migrations")).filter((f) => f.endsWith(".sql")).sort()) db.exec(readFileSync(join(web, "migrations", f), "utf8"));
  type V = string | number | null;
  const stmt = (sql: string, params: V[] = []) => ({
    bind: (...p: V[]) => stmt(sql, p),
    first: async <T>() => (db.prepare(sql).get(...params) ?? null) as T | null,
    all: async <T>() => ({ results: db.prepare(sql).all(...params) as T[] }),
    run: async () => {
      if (/\bRETURNING\b/i.test(sql)) return { success: true, results: db.prepare(sql).all(...params), meta: { changes: 1 } };
      const r = db.prepare(sql).run(...params);
      return { success: true, results: [], meta: { changes: Number(r.changes) } };
    },
  });
  const d = { prepare: (sql: string) => stmt(sql), batch: async (list: { run(): Promise<unknown> }[]) => { const out = []; for (const s of list) out.push(await s.run()); return out; } };
  return { db, d1: d as unknown as D1Database };
}

const user = (db: InstanceType<typeof DatabaseSync>, id: string, email: string, name: string) => db.prepare("INSERT INTO users (id, email, name, created) VALUES (?, ?, ?, 0)").run(id, email, name);

/** A table of Nate (host), Kit and Wren, Rook watching the link and never sitting; the real safety over SQLite. */
async function table(bypass = false) {
  const { db, d1: D } = d1();
  for (const w of [NATE, KIT, WREN, ROOK]) user(db, w.user, `${w.name.toLowerCase()}@example.test`, w.name);
  const mail: { to: string; raw: string }[] = [];
  const safety = roomSafety({ db: D, mail: async (to, raw) => void mail.push({ to, raw }), reportsTo: "nate@example.test", log: () => {} });
  const t = testRoom(undefined, 1_000_000, { safety });
  await t.room.createTable({ gameId: "safe1", code: "s4fety1234", settings: { ...settings, bots: 3 }, seed: "safety-seed", host: hostSeat(NATE, 0) });
  await t.table(NATE);
  await t.table(ROOK);
  await t.act(KIT, { do: "sit", house: 3, leadersRun: true });
  await t.act(WREN, { do: "sit", house: 5, leadersRun: true });
  const say = async (who: typeof NATE, chat: string, text: string) => {
    t.advance(CHAT_GAP_MS);
    return t.askAs(who, { type: "chat", act: { do: "send", chat, text } });
  };
  const chatAct = (who: typeof NATE, act: object) => {
    t.advance(CHAT_GAP_MS);
    return t.askAs(who, { type: "chat", act } as never);
  };
  return { ...t, db, D, mail, say, chatAct, bypass };
}

const chatOf = (m: RoomMessage | null): ChatSync => {
  if (!m || !("chat" in m)) throw new Error(`no chat: ${JSON.stringify(m)}`);
  return m.chat;
};

/** Nate blocks Kit; Kit writes everywhere Nate could read it and offers him a truce with a note. What reached Nate? */
async function blockScenario(bypass: boolean) {
  const t = await table(bypass);
  await t.act(NATE, { do: "start" });
  const blocked = chatOf(await t.chatAct(NATE, { do: "block", seat: "p2" }));
  expect(blocked.dropped).toEqual([]);
  // A planted bypass: the room forgets the block (as a filter that wasn't applied would).
  if (bypass) (t.room as unknown as { blocks: Map<string, Set<string>> }).blocks.clear();
  t.clear();
  await t.say(KIT, "table", "KIT-SECRET-table");
  const pair = chatOf(await t.chatAct(KIT, { do: "pair", with: "p1" })).chats[0]!.id;
  await t.say(KIT, pair, "KIT-SECRET-pair");
  const group = chatOf(await t.chatAct(KIT, { do: "group", with: ["p1", "p3"], name: "KIT-GROUP" })).chats[0]!.id;
  await t.say(KIT, group, "KIT-SECRET-group");
  const truce = { id: "p2-t1-1", from: "p2", to: "p1", terms: { kind: "truce", scope: { kind: "all" }, turns: 3 }, bond: "handshake", note: "KIT-NOTE: peace?" };
  const offered = await t.askAs(KIT, { type: "propose", offer: truce } as never);
  expect(offered).toMatchObject({ ok: true });
  // Nate comes back: his "where are we".
  const hello = await t.askAs(NATE, { type: "hello" });
  return { t, hello, nate: JSON.stringify(t.inbox(NATE.user)), wren: JSON.stringify(t.inbox(WREN.user)), kit: JSON.stringify(t.inbox(KIT.user)) };
}

describe("a block list (session 34): the room filters a blocked person's lines", () => {
  it("nothing Kit writes reaches Nate after Nate blocks him (the table, a one-to-one, a group, a hello); his offer does, without its note; Kit is never told", async () => {
    const { nate, wren, kit, hello } = await blockScenario(false);
    for (const secret of ["KIT-SECRET-table", "KIT-SECRET-pair", "KIT-SECRET-group", "KIT-NOTE"]) expect(nate).not.toContain(secret);
    // Wren reads Kit as before.
    expect(wren).toContain("KIT-SECRET-table");
    expect(wren).toContain("KIT-SECRET-group");
    // The deal still reaches Nate (deals are the game), Kit's name with it as always.
    expect(nate).toContain('"id":"p2-t1-1"');
    expect(hello && "start" in hello ? JSON.stringify(hello.start.chat?.lines ?? []) : "").not.toContain("KIT-SECRET");
    // Kit hears nothing of it.
    expect(kit).not.toMatch(/"blocked"|Blocked\./);
  }, 60_000);

  it("a room that slept (its memory gone, no page saying hello again) still filters: the block lists are in its own storage", async () => {
    const t = await table();
    await t.act(NATE, { do: "start" });
    await t.chatAct(NATE, { do: "block", seat: "p2" });
    await t.room.flush();
    // The same storage, a fresh room (a Durable Object that hibernated): Kit writes before anyone says hello.
    const woke = testRoom(t.store, 2_000_000, { safety: roomSafety({ db: t.D, mail: null, reportsTo: undefined, log: () => {} }) });
    await woke.askAs(KIT, { type: "chat", act: { do: "send", chat: "table", text: "KIT-AFTER-SLEEP" } });
    expect(JSON.stringify(woke.inbox(NATE.user))).not.toContain("KIT-AFTER-SLEEP");
    expect(JSON.stringify(woke.inbox(WREN.user))).toContain("KIT-AFTER-SLEEP");
  }, 60_000);

  it("the planted bypass: with the room's block list forgotten, Kit's lines and note do reach Nate (the check above would catch it)", async () => {
    const { nate } = await blockScenario(true);
    expect(nate).toContain("KIT-SECRET-table");
    expect(nate).toContain("KIT-SECRET-pair");
    expect(nate).toContain("KIT-NOTE");
  }, 60_000);

  it("a block outlives the game (kept by account in D1: a new room reads it on hello); Settings lists it by name; unblock", async () => {
    const t = await table();
    // At the table screen (no seats dealt yet): from Kit's line; the answer names his lines Nate has, to drop.
    const said = chatOf(await t.say(KIT, "table", "KIT-HELLO")).lines[0]!.id;
    expect(chatOf(await t.chatAct(NATE, { do: "block", line: said })).dropped).toEqual([said]);
    expect(await roomSafety({ db: t.D, mail: null, reportsTo: undefined, log: () => {} }).blocksOf(NATE.user)).toEqual([KIT.user]);
    const list = await blockList(t.D, NATE.user);
    expect(list.map((b) => b.name)).toEqual(["Kit"]);
    expect(JSON.stringify(list)).not.toContain(KIT.user);
    await unblock(t.D, KIT.user, list[0]!.id);
    expect(await blockList(t.D, NATE.user)).toHaveLength(1);
    await unblock(t.D, NATE.user, list[0]!.id);
    expect(await blockList(t.D, NATE.user)).toHaveLength(0);
    // Only people: not yourself, not a bot's seat.
    await t.act(NATE, { do: "start" });
    expect(await t.chatAct(NATE, { do: "block", seat: "p1" })).toMatchObject({ ok: false, error: SAFETY_TEXT.blockYourself });
    expect(await t.chatAct(NATE, { do: "block", seat: "bot1" })).toMatchObject({ ok: false, error: SAFETY_TEXT.peopleOnly });
  }, 60_000);
});

describe("report a line (session 34)", () => {
  it("the room reports the line as it has it: to Nate's email and D1; 'Reported. Nate reads these.'; once a line, three a day", async () => {
    const t = await table();
    await t.say(WREN, "table", "WREN-OTHER: nothing to see");
    const lines: number[] = [];
    for (const n of [1, 2, 3, 4]) lines.push(chatOf(await t.say(KIT, "table", `KIT-LINE-${n}`)).lines[0]!.id);
    const sent = chatOf(await t.chatAct(NATE, { do: "report", line: lines[0], reason: "abuse", words: "Rude to everyone." }));
    expect(sent.reported).toBe(true);
    expect(SAFETY_TEXT.reported).toBe("Reported. Nate reads these.");
    expect(t.mail).toHaveLength(1);
    const raw = t.mail[0]!.raw;
    expect(t.mail[0]!.to).toBe("nate@example.test");
    for (const want of ['Line: "KIT-LINE-1"', "Written by: Kit (kit@example.test)", "Reason: abuse", 'Their words: "Rude to everyone."', "Reported by: Nate (nate@example.test)", "game safe1 (Embervale)", "In: the table chat"]) expect(raw).toContain(want);
    // Nothing else of the game: no other line, no seed, no orders, no leader.
    for (const never of ["WREN-OTHER", "KIT-LINE-2", "safety-seed", "Lord Ash"]) expect(raw).not.toContain(never);
    expect(await t.chatAct(NATE, { do: "report", line: lines[0], reason: "spam" })).toMatchObject({ ok: false, error: SAFETY_TEXT.reportedAlready });
    expect(chatOf(await t.chatAct(NATE, { do: "report", line: lines[1], reason: "spam" })).reported).toBe(true);
    expect(chatOf(await t.chatAct(NATE, { do: "report", line: lines[2], reason: "other" })).reported).toBe(true);
    expect(await t.chatAct(NATE, { do: "report", line: lines[3], reason: "cheating" })).toMatchObject({ ok: false, error: SAFETY_TEXT.reportsToday });
    expect(t.db.prepare("SELECT COUNT(*) AS n FROM reports").get()).toEqual({ n: 3 });
    // Wren reports one too (her own three).
    expect(chatOf(await t.chatAct(WREN, { do: "report", line: lines[3], reason: "cheating" })).reported).toBe(true);
  }, 60_000);

  it("only someone else's line, one you could read, with a reason", async () => {
    const t = await table();
    await t.act(NATE, { do: "start" });
    const mine = chatOf(await t.say(NATE, "table", "NATE-LINE")).lines[0]!.id;
    expect(await t.chatAct(NATE, { do: "report", line: mine, reason: "abuse" })).toMatchObject({ ok: false, error: SAFETY_TEXT.ownLine });
    expect(await t.chatAct(NATE, { do: "report", line: 123, reason: "abuse" })).toMatchObject({ ok: false, error: SAFETY_TEXT.notALine });
    const kit = chatOf(await t.say(KIT, "table", "KIT-LINE")).lines[0]!.id;
    expect(await t.chatAct(NATE, { do: "report", line: kit, reason: "rude" })).toMatchObject({ ok: false, error: SAFETY_TEXT.pickReason });
    // A group Nate isn't in: he can't report what he never read.
    const group = chatOf(await t.chatAct(KIT, { do: "group", with: ["p3"] })).chats[0]!.id;
    const hidden = chatOf(await t.say(KIT, group, "KIT-PRIVATE")).lines[0]!.id;
    expect(await t.chatAct(NATE, { do: "report", line: hidden, reason: "abuse" })).toMatchObject({ ok: false, error: SAFETY_TEXT.notALine });
  }, 60_000);

  it("the email's shape: the line, who, the reason and the times, in plain text; a header never carries what a player typed", () => {
    const r: LineReport = { gameId: "g1", map: "random:80-island-quiet-heron", line: 5, chat: "group", text: "line\r\nBcc: x@y", writtenAt: Date.UTC(2026, 9, 19, 21, 5), author: "u1", authorName: "Kit", reporter: "u2", reporterName: "Nate", reason: "spam", at: Date.UTC(2026, 9, 19, 21, 7) };
    const { subject, raw } = reportEmail(r, { author: "kit@example.test", reporter: null }, "nate@example.test");
    expect(subject).toBe("Conquerra report: spam (Kit)");
    const head = raw.slice(0, raw.indexOf("\r\n\r\n")), body = raw.slice(raw.indexOf("\r\n\r\n") + 4);
    expect(head).not.toContain("Bcc");
    expect(body).toBe(['A chat line was reported.', '', 'Line: "line\r\nBcc: x@y"', "Written by: Kit (kit@example.test), 2026-10-19 21:05 UTC", "In: a group chat, game g1 (Random, 80 territories (quiet-heron))", "Reason: spam", "Reported by: Nate, 2026-10-19 21:07 UTC", ""].join("\r\n"));
  });
});

describe("the caps (session 34)", () => {
  it("20 tables a day: the 21st is refused, in the voice; one from yesterday doesn't count", async () => {
    const { db, d1: D } = d1();
    user(db, "u1", "a@example.test", "A");
    const now = 10 * 24 * 3600 * 1000;
    const add = (i: number, at: number) => db.prepare("INSERT INTO games (id, map, settings, status, host_user, created, turn, updated, seed_hash) VALUES (?, 'embervale', '{}', 'waiting', 'u1', ?, 1, ?, '')").run(`g${i}`, at, at);
    add(0, now - 25 * 3600 * 1000);
    for (let i = 1; i <= 19; i++) add(i, now - i * 60_000);
    expect(await tableCap(D, "u1", now)).toBeNull();
    add(20, now - 1000);
    expect(await tableCap(D, "u1", now)).toBe("You've made 20 tables today. Tomorrow.");
    expect(SAFETY_LIMITS.tablesPerDay).toBe(20);
    // The Worker asks before it makes the table (and before the room does any work).
    const api = readFileSync(join(web, "server/api.ts"), "utf8");
    expect(api.indexOf("tableCap(env.DB")).toBeLessThan(api.indexOf("createTable({"));
  });

  it("10 joins by invite code a minute an address; the 11th is refused; the next minute starts again", async () => {
    const { d1: D } = d1();
    const t0 = 1_000 * 60_000;
    for (let i = 0; i < 10; i++) expect(await joinGate(D, "203.0.113.9", t0 + i)).toBeNull();
    expect(await joinGate(D, "203.0.113.9", t0 + 20)).toBe(SAFETY_TEXT.joinsTooFast);
    expect(await joinGate(D, "198.51.100.1", t0 + 20)).toBeNull();
    expect(await joinGate(D, "203.0.113.9", t0 + 60_000)).toBeNull();
  });

  it("a page's room messages: 30 in 10 s, the 31st refused with one sentence (the chat's own limit inside it); a queue save is dropped quietly", async () => {
    const t = await table();
    t.advance(SAFETY_LIMITS.windowMs);
    for (let i = 0; i < SAFETY_LIMITS.messagesPerWindow - 1; i++) await t.askAs(KIT, { type: "hello" });
    expect(await t.askAs(KIT, { type: "hello" })).toMatchObject({ ok: true });
    expect(await t.askAs(KIT, { type: "hello" })).toMatchObject({ ok: false, error: SAFETY_TEXT.tooFast });
    // Someone else's page has its own allowance.
    expect(await t.askAs(WREN, { type: "hello" })).toMatchObject({ ok: true });
    t.advance(SAFETY_LIMITS.windowMs);
    expect(await t.askAs(KIT, { type: "hello" })).toMatchObject({ ok: true });
  }, 60_000);

  it("every new line in the voice: plain, no sarcasm, no exclamation", () => {
    const all = Object.values(SAFETY_TEXT).flatMap((v) => (typeof v === "string" ? [v] : typeof v === "function" ? [v("Kit")] : Object.values(v)));
    for (const line of all) {
      expect(line).not.toMatch(/!|\.\.\.|lol|oops/i);
      expect(line.length).toBeLessThan(140);
    }
    expect(SAFETY_TEXT.blockAsk("Kit")).toBe("Block Kit? Their messages won't reach you, here or in any game. Their deals still will. They aren't told.");
  });
});
