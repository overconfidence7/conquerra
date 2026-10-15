import { maps } from "@conquerra/content/maps";
import { lines } from "@conquerra/content/lines";
import { defaultRules } from "@conquerra/content";
import type { GameContext, Offer, PlayerView, ReplayEvent } from "@conquerra/engine";
import { describe, expect, it } from "vitest";
import { ASK_TEXT, chatVoiceOf, tableTalk, type ChatBot } from "../src/host/botChat";
import { CHAT_TEXT } from "../src/host/chatRoom";
import type { ChatSync, RoomMessage } from "../src/host/protocol";
import { BOT_CHAT_TEXT } from "../src/host/roomCore";
import { hostSeat, KIT, NATE, settings, testRoom, WREN } from "./roomHelpers";

/**
 * Session 29, Part 1: the bots in the chat. A bot speaks in the table chat when something calls for it, each line
 * written for one reader from that reader's own replay; within the limits; it answers your multiple-choice lines (two a
 * turn), joins a group's scheme only through a deal, and its offers show in your one-to-one with it.
 */

const ctx: GameContext = { map: maps.embervale!, rules: defaultRules };
const name = (id: string) => maps.embervale!.territories.find((t) => t.id === id)!.name;
const players = ["p1", "p2", "bA", "bB", "bC", "bD", "bE"].map((id, i) => ({ id, name: `Name ${id}`, eliminatedTurn: null, eliminatedBy: null, spoils: 0, oathbreaker: 0, house: i }));
const viewAt = (turn: number, reader: string, capital = "t00", capitalOf: Record<string, string> = {}): PlayerView =>
  ({ gameId: "g", turn, me: { id: reader, capital }, players, deals: [], territories: Object.fromEntries(Object.entries(capitalOf).map(([t, p]) => [t, { detail: "full", owner: p, capitalOf: p, troops: 3 }])) }) as unknown as PlayerView;
const took = (player: string, defender: string, to: string): ReplayEvent => ({ type: "battle", player, defender, to, from: "t40", captured: true }) as unknown as ReplayEvent;
const BOTS: ChatBot[] = [
  { id: "bA", name: "Name bA", house: 2, voice: "merchant" },
  { id: "bB", name: "Name bB", house: 3, voice: "conqueror" },
  { id: "bC", name: "Name bC", house: 4, voice: "schemer" },
  { id: "bD", name: "Name bD", house: 5, voice: "plain" },
  { id: "bE", name: "Name bE", house: 6, voice: null },
];
const talk = (reader: string, events: ReplayEvent[], last: Record<string, number> = {}, before = viewAt(10, reader)) => tableTalk({ ctx, game: "g", reader, before, after: before, events, bots: BOTS, last });

describe("the bots in the table chat (session 29)", () => {
  it("each Marshal's voice is its personality's; the Captain speaks plainly; the Recruit never chats; a seat a Marshal took is Neutral", () => {
    expect(chatVoiceOf("marshal", "turtle")).toBe("turtle");
    expect(chatVoiceOf("marshal", "neutral")).toBe("neutral");
    expect(chatVoiceOf("captain")).toBe("plain");
    expect(chatVoiceOf("recruit")).toBeNull();
  });

  it("the limits: one line a bot, two bots a turn, the biggest first; the Recruit never, the Captain only of big things", () => {
    const events = [took("bA", "p1", "t05"), took("bB", "p1", "t07"), took("bC", "p1", "t08"), took("bD", "p1", "t03"), took("bE", "p1", "t02"), took("bA", "p1", "t04")];
    const said = talk("p1", events);
    expect(said).toHaveLength(lines.limits.chatPerTurn);
    expect(new Set(said.map((s) => s.bot)).size).toBe(said.length);
    expect(said.map((s) => s.bot)).not.toContain("bE");
    expect(said.map((s) => s.bot)).not.toContain("bD");
    // The Merchant names both places it took from you.
    expect(said.find((s) => s.bot === "bA")?.text).toMatch(new RegExp(`${name("t05")} and ${name("t04")}`));
    // Your capital is the biggest thing: that bot goes first, even the Captain (but only after six quiet turns).
    const cap = talk("p1", [took("bB", "p1", "t05"), took("bD", "p1", "t00")]);
    expect(cap[0]).toMatchObject({ bot: "bD", situation: "bragCapital" });
    expect(talk("p1", [took("bD", "p1", "t00")], { bD: 7 })).toEqual([]);
  });

  it("a bot's lines to you at least three turns apart, unless a deal between you was made or broken", () => {
    const events = [took("bA", "p1", "t05")];
    expect(talk("p1", events, { bA: 8 })).toEqual([]);
    expect(talk("p1", events, { bA: 7 })).toHaveLength(1);
    const deal = { type: "dealStarted", deal: { a: "p1", b: "bA", terms: { kind: "truce" } } } as unknown as ReplayEvent;
    expect(talk("p1", [deal], { bA: 9 })).toMatchObject([{ bot: "bA", situation: "dealMade", deal: true }]);
    const broke = { type: "dealBroken", kind: "truce", a: "p1", b: "bB", by: "p1", at: "t05", how: "attack" } as unknown as ReplayEvent;
    expect(talk("p1", [broke], { bB: 10 })[0]).toMatchObject({ bot: "bB", situation: "broke" });
    expect(talk("p1", [broke])[0]!.text).toContain(name("t05"));
  });

  it("one bot, two readers, two lines: each built from that reader's own replay, naming only what they saw", () => {
    // The same turn: bA took t05 from Nate; Kit took t07 from bA. Each reader's replay has their own fight only.
    const nate = talk("p1", [took("bA", "p1", "t05")]);
    const kit = talk("p2", [took("p2", "bA", "t07")], {}, viewAt(10, "p2", "t30"));
    expect(nate).toMatchObject([{ bot: "bA", situation: "brag" }]);
    expect(kit).toMatchObject([{ bot: "bA", situation: "needle" }]);
    expect(nate[0]!.text).toContain(name("t05"));
    expect(nate[0]!.text).not.toContain(name("t07"));
    expect(kit[0]!.text).toContain(name("t07"));
    expect(kit[0]!.text).not.toContain(name("t05"));
    // A capital taken in a fight you saw, and a bot's own capital taken back (a comeback), from what you saw before.
    const seen = viewAt(10, "p2", "t30", { t11: "p1", t12: "bC" });
    expect(talk("p2", [took("bB", "p1", "t11")], {}, seen)).toMatchObject([{ bot: "bB", situation: "capitalTaken" }]);
    expect(talk("p2", [took("bC", "p1", "t12")], {}, seen)).toMatchObject([{ bot: "bC", situation: "comeback" }]);
    // A rival a bot finished is public.
    expect(talk("p2", [{ type: "eliminated", player: "p1", by: "bA" } as unknown as ReplayEvent])).toMatchObject([{ bot: "bA", situation: "finished" }]);
    // No numbers in any of it.
    for (const s of [...nate, ...kit]) expect(s.text).not.toMatch(/\d/);
  });
});

const chatsOf = (msgs: RoomMessage[]): ChatSync[] => msgs.flatMap((m) => ("chat" in m ? [m.chat] : "start" in m && m.start.chat ? [m.start.chat] : []));
const answerOf = (m: RoomMessage | null): ChatSync => {
  if (!m || !("chat" in m)) throw new Error(`no chat: ${JSON.stringify(m)}`);
  return m.chat;
};

async function table(botLevel: "marshal" | "recruit" = "marshal") {
  const t = testRoom();
  await t.room.createTable({ gameId: "botchat", code: "b0tch4t001", settings: { ...settings, bots: 3, botLevel }, seed: "bots-in-the-chat", host: hostSeat(NATE, 0) });
  await t.table(NATE);
  await t.act(KIT, { do: "sit", house: 3, leadersRun: true });
  await t.act(WREN, { do: "sit", house: 5, leadersRun: true });
  await t.act(NATE, { do: "start" });
  return t;
}

describe("talking to a bot (session 29)", () => {
  it("one-to-one: three lines of yours to pick from; the bot answers two a turn, then has nothing more to say", async () => {
    const t = await table();
    const bot = t.room.table!.chatBots()[0]!;
    const pair = answerOf(await t.askAs(NATE, { type: "chat", act: { do: "pair", with: bot.id } })).chats[0]!;
    expect(pair).toMatchObject({ kind: "pair", members: [{ name: "Nate", you: true }, { name: bot.name, seat: bot.id, bot: true }], free: 2 });
    expect(pair.say).toHaveLength(3);
    // No free text to a bot.
    expect(await t.askAs(NATE, { type: "chat", act: { do: "send", chat: pair.id, text: "Surrender?" } })).toMatchObject({ ok: false, error: CHAT_TEXT.botsDontRead });
    const one = answerOf(await t.askAs(NATE, { type: "chat", act: { do: "say", chat: pair.id, pick: 1 } }));
    expect(one.lines.map((l) => [l.from.name, l.text])).toEqual([
      ["Nate", pair.say![1]],
      [bot.name, expect.any(String)],
    ]);
    expect(one.chats[0]).toMatchObject({ id: pair.id, free: 1 });
    await t.askAs(NATE, { type: "chat", act: { do: "say", chat: pair.id, pick: 0 } });
    expect(await t.askAs(NATE, { type: "chat", act: { do: "say", chat: pair.id, pick: 2 } })).toMatchObject({ ok: false, error: BOT_CHAT_TEXT.nothingMore(bot.name) });
    // Kit never hears of Nate's chat with the bot.
    expect(JSON.stringify(t.inbox(KIT.user))).not.toContain(pair.id);
    // Next turn, two more.
    for (const s of ["p1", "p2", "p3"]) await t.ask(s, { type: "lockIn", orders: [], turn: 1 });
    const again = answerOf(await t.askAs(NATE, { type: "chat", act: { do: "pair", with: bot.id } })).chats[0]!;
    expect(again).toMatchObject({ id: pair.id, free: 2 });
  });

  it("a group with a bot: it answers the asker's prompt in character, with the deal ready to send (its words never bind it)", async () => {
    const t = await table();
    const bot = t.room.table!.chatBots()[0]!;
    const group = answerOf(await t.askAs(NATE, { type: "chat", act: { do: "group", with: ["p2", bot.id] } })).chats[0]!;
    expect(group.members!.map((p) => [p.name, !!p.bot])).toEqual([
      ["Nate", false],
      ["Kit", false],
      [bot.name, true],
    ]);
    t.clear();
    const asked = answerOf(await t.askAs(NATE, { type: "chat", act: { do: "ask", chat: group.id, ask: "war", target: "p3" } }));
    const wren = t.room.table!.fullState.players.find((p) => p.id === "p3")!.name;
    expect(asked.lines[0]).toMatchObject({ text: ASK_TEXT.war(wren), from: { name: "Nate" } });
    expect(asked.lines[1]).toMatchObject({ from: { name: bot.name, bot: true }, propose: { to: bot.id, kind: "war", target: "p3", for: "p1" } });
    // Kit reads the same lines; Wren, the target, hears nothing at all.
    expect(chatsOf(t.inbox(KIT.user)).flatMap((c) => c.lines.map((l) => l.text))).toEqual(asked.lines.map((l) => l.text));
    expect(t.inbox(WREN.user)).toEqual([]);
    // A rival in the group, or nobody, can't be the target.
    expect(await t.askAs(NATE, { type: "chat", act: { do: "ask", chat: group.id, ask: "war", target: "p2" } })).toMatchObject({ ok: false, error: BOT_CHAT_TEXT.noTarget });
    // "Peace among us?": a truce, ready made.
    const peace = answerOf(await t.askAs(KIT, { type: "chat", act: { do: "ask", chat: group.id, ask: "peace" } }));
    expect(peace.lines[1]).toMatchObject({ propose: { to: bot.id, kind: "truce", for: "p2" } });
    // The bot's word changed nothing: no deal, no order.
    expect(t.room.table!.fullState.deals).toEqual([]);
  });

  it("a bot's offer to you shows in your one-to-one with it too, and your answer there gets one line back", async () => {
    const t = await table();
    const g = t.room.table!;
    // (Bots offer people deals only now and then: this turn, one of them offers Nate a truce, as `negotiate` would.)
    const bot = g.chatBots()[0]!;
    const internals = g as unknown as { talk: { toHuman: Offer[] } };
    internals.talk.toHuman.push({ id: `${bot.id}-t1-o0`, from: bot.id, to: "p1", terms: { kind: "truce", scope: { kind: "all" }, turns: 3 }, bond: "handshake", note: "Peace on our border. I'll show you the math if you like." });
    await (t.room as unknown as { botsTalk(): Promise<void> }).botsTalk();
    const offers = g.botOffersTo("p1");
    expect(offers.length).toBe(1);
    const o = offers[0]!;
    const start = await t.hello("p1");
    const pair = start.chat!.chats.find((c) => c.kind === "pair" && c.members?.some((p) => p.seat === o.from))!;
    expect(pair).toBeDefined();
    expect(start.chat!.lines.filter((l) => l.chat === pair.id).map((l) => l.text)).toContain(o.note);
    const answered = answerOf(await t.askAs(NATE, { type: "chat", act: { do: "answered", chat: pair.id, offer: o.id, accept: true } }));
    expect(answered.lines).toHaveLength(1);
    expect(answered.lines[0]!.from.bot).toBe(true);
    // Once per offer.
    expect(answerOf(await t.askAs(NATE, { type: "chat", act: { do: "answered", chat: pair.id, offer: o.id, accept: false } })).lines).toEqual([]);
  });

  it("a room that woke from hibernation knows its bots before anyone says hello (found against wrangler dev)", async () => {
    const t = await table();
    const bot = t.room.table!.chatBots()[0]!;
    await t.room.flush();
    // The same storage, a fresh room (the Durable Object was evicted between messages).
    const woke = testRoom(t.store);
    const made = answerOf(await woke.askAs(NATE, { type: "chat", act: { do: "group", with: [bot.id] } }));
    expect(made.chats[0]!.members!.some((p) => p.bot && p.seat === bot.id)).toBe(true);
  });

  it("a bot knocked out keeps its name in your chats with it, but can't be added to a new one", async () => {
    const t = await table();
    const g = t.room.table!;
    const bot = g.chatBots()[0]!;
    const pair = answerOf(await t.askAs(NATE, { type: "chat", act: { do: "pair", with: bot.id } })).chats[0]!;
    g.fullState.players.find((p) => p.id === bot.id)!.eliminatedTurn = 1;
    const again = (await t.hello("p1")).chat!.chats.find((c) => c.id === pair.id)!;
    expect(again.members!.find((p) => p.bot)).toMatchObject({ name: bot.name, seat: bot.id });
    expect(await t.askAs(NATE, { type: "chat", act: { do: "group", with: [bot.id] } })).toMatchObject({ ok: false, error: CHAT_TEXT.notPerson });
  });

  it("the Recruit doesn't chat: deals only", async () => {
    const t = await table("recruit");
    const bot = t.room.table!.chatBots()[0]!;
    const pair = answerOf(await t.askAs(NATE, { type: "chat", act: { do: "pair", with: bot.id } })).chats[0]!;
    expect(pair).toMatchObject({ quiet: true });
    expect(pair.say).toBeUndefined();
    expect(await t.askAs(NATE, { type: "chat", act: { do: "say", chat: pair.id, pick: 0 } })).toMatchObject({ ok: false, error: BOT_CHAT_TEXT.quiet(bot.name) });
  });

  it("after a turn the bots speak in the table chat, each line to its own reader (nobody reads another's)", async () => {
    const t = await table();
    const g = t.room.table!;
    const heard = new Map<string, { id: number; text: string }[]>();
    for (let turn = 1; turn <= 10 && !g.over; turn++) {
      t.clear();
      for (const s of ["p1", "p2", "p3"]) if (!g.isOut(s)) await t.ask(s, { type: "lockIn", orders: g.generalOrders({}, undefined, s), turn });
      for (const who of [NATE, KIT, WREN]) for (const l of chatsOf(t.inbox(who.user)).flatMap((c) => c.lines).filter((l) => l.chat === "table" && l.from.bot)) (heard.get(who.user) ?? heard.set(who.user, []).get(who.user)!).push({ id: l.id, text: l.text });
    }
    const all = [...heard.values()].flat();
    expect(all.length).toBeGreaterThan(0);
    // A line written for one reader reaches that reader only.
    const ids = all.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    // And a page that comes back reads its own bot lines again, and no one else's.
    const back = await t.hello("p1");
    const mine = new Set((heard.get(NATE.user) ?? []).map((l) => l.id));
    for (const l of back.chat!.lines.filter((x) => x.chat === "table" && x.from.bot)) expect(mine.has(l.id)).toBe(true);
  });
});
