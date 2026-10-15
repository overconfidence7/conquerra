import { maps } from "@conquerra/content/maps";
import { viewFor, type Offer, type Order, type PlayerId, type ReplayEvent } from "@conquerra/engine";
import { answerOrder } from "@conquerra/bots";
import { describe, expect, it } from "vitest";
import { NOTE_MAX, OFFERS_PER_PERSON, PEOPLE_DEAL_TEXT } from "../src/host/localGame";
import type { PeopleOffer, RoomMessage } from "../src/host/protocol";
import { RoomCore } from "../src/host/roomCore";
import { newOffer } from "../src/logic/deals";
import { myOfferState, openToMe, PEOPLE_DEAL_NEWS, talkNews } from "../src/logic/peopleDeals";
import { hostSeat, KIT, memoryRoomStore, NATE, settings, testRoom, WREN } from "./roomHelpers";

/**
 * Session 28, Part 1: deals between people. Nate (p1), Kit (p2) and Wren (p3) at a table with a bot. An offer to a
 * person is relayed by the room to that person alone; they accept, counter once, or decline, or it lapses when they
 * lock in; the proposer can withdraw it before locking in. The deal starts when the room holds both sides' orders.
 */

const talksOf = (msgs: RoomMessage[]): PeopleOffer[][] => msgs.flatMap((m) => ("talks" in m ? [m.talks] : []));
const lastTalks = (msgs: RoomMessage[]) => talksOf(msgs).at(-1) ?? [];
const errorOf = (m: RoomMessage | null) => (m && !m.ok ? m.error : null);

async function table(opts: { store?: ReturnType<typeof memoryRoomStore> } = {}) {
  const t = testRoom(opts.store);
  await t.room.createTable({ gameId: "deals", code: "d3alst4ble", settings: { ...settings, bots: 3 }, seed: "deals-between-people", host: hostSeat(NATE, 0) });
  await t.act(KIT, { do: "sit", house: 3, leadersRun: true });
  await t.act(WREN, { do: "sit", house: 5, leadersRun: true });
  await t.act(NATE, { do: "start" });
  const g = t.room.table!;
  const offer = (from: PlayerId, to: PlayerId, kind: "truce" | "trade" = "truce", n = 1): Offer => newOffer(g.ctx, viewFor(g.ctx, g.fullState, from), to, kind, n);
  /** Everyone locks in their leaders' orders (plus any extra), and the turn resolves. */
  const lockAll = async (extra: Record<PlayerId, Order[]> = {}) => {
    const turn = g.turn;
    for (const seat of ["p1", "p2", "p3"]) await t.ask(seat, { type: "lockIn", orders: [...g.generalOrders({}, undefined, seat), ...(extra[seat] ?? [])], turn });
    expect(g.turn).toBe(turn + 1);
  };
  const dealsNow = () => g.fullState.deals.map((d) => ({ a: d.a, b: d.b, kind: d.terms.kind }));
  return { ...t, g, offer, lockAll, dealsNow };
}

describe("deals between people (session 28)", () => {
  it("an offer reaches the other person at once, and only them; they accept; the deal starts as the turn plays and the table hears of it", async () => {
    const t = await table();
    t.clear();
    const o = { ...t.offer("p1", "p2"), note: "Peace in the east while we both deal with the bot?" };
    const sent = await t.ask("p1", { type: "propose", offer: o });
    expect(sent && "answer" in sent && sent.answer).toEqual({ accept: false, reason: "", waiting: true });
    // Kit's page hears of it at once (a push), with the note; Wren's page hears nothing of it.
    expect(lastTalks(t.inbox(KIT.user))).toEqual([{ offer: o, state: "open" }]);
    expect(talksOf(t.inbox(WREN.user))).toEqual([]);
    expect(JSON.stringify(t.inbox(WREN.user))).not.toContain(o.id);
    // Kit's "where are we" has it waiting (with the bots' offers), and Wren's doesn't.
    expect((await t.hello("p2")).offers).toContainEqual(o);
    expect((await t.hello("p3")).offers ?? []).not.toContainEqual(o);
    expect((await t.hello("p3")).talks).toBeUndefined();
    // Kit accepts: Nate is told at once.
    const yes = await t.ask("p2", { type: "answer", from: "p1", offer: o.id, accept: true });
    expect(yes && "talks" in yes && yes.talks).toEqual([{ offer: o, state: "accepted" }]);
    expect(lastTalks(t.inbox(NATE.user))).toEqual([{ offer: o, state: "accepted" }]);
    // The turn plays (nobody's queue needs the orders: the room holds both sides) and the deal starts.
    await t.lockAll();
    expect(t.dealsNow()).toEqual([{ a: "p1", b: "p2", kind: "truce" }]);
    // Public: Wren's report tells of it (as a bot's deal does).
    const started = (seat: PlayerId) => t.g.lastReplay(seat)!.report.events.filter((e): e is Extract<ReplayEvent, { type: "dealStarted" }> => e.type === "dealStarted");
    expect(started("p3").map((e) => [e.deal.a, e.deal.b])).toEqual([["p1", "p2"]]);
    expect(started("p1")).toHaveLength(1);
    // A new turn: last turn's offers are gone.
    expect((await t.hello("p2")).talks).toBeUndefined();
  });

  it("a page can't make a deal the room never relayed or never heard answered", async () => {
    const t = await table();
    const o = t.offer("p1", "p2");
    // Nate's queue has the offer (never sent through the room), Kit's queue accepts it.
    await t.lockAll({ p1: [{ id: `propose-${o.id}`, kind: "propose", offer: o }], p2: [answerOrder(o, true)] });
    expect(t.dealsNow()).toEqual([]);
    // Relayed, but Kit's acceptance only in Kit's queue (never answered through the room): no deal either.
    const o2 = t.offer("p1", "p2", "truce", 2);
    await t.ask("p1", { type: "propose", offer: o2 });
    await t.lockAll({ p2: [answerOrder(o2, true)] });
    expect(t.dealsNow()).toEqual([]);
  });

  it("counter once: Kit counters, Nate is told and accepts the counter (its terms make the deal); no second counter", async () => {
    const t = await table();
    const o = t.offer("p1", "p2");
    await t.ask("p1", { type: "propose", offer: o });
    t.clear();
    const counter: Offer = { ...o, id: "p2-t1-1", from: "p2", to: "p1", counterTo: o.id, terms: { ...o.terms, turns: 2 } as Offer["terms"] };
    expect(errorOf(await t.ask("p2", { type: "propose", offer: counter }))).toBeNull();
    expect(lastTalks(t.inbox(NATE.user))).toEqual([{ offer: o, state: "countered", counter, counterState: "open" }]);
    // The counter waits on Nate's answer: it's in his "where are we".
    expect((await t.hello("p1")).offers).toContainEqual(counter);
    // Nate can't counter the counter, and Kit can't answer her own counter.
    const again: Offer = { ...counter, id: "p1-t1-9", from: "p1", to: "p2", counterTo: counter.id };
    expect(errorOf(await t.ask("p1", { type: "propose", offer: again }))).toBe(PEOPLE_DEAL_TEXT.noSecondCounter);
    expect(errorOf(await t.ask("p2", { type: "answer", from: "p2", offer: counter.id, accept: true }))).toBe(PEOPLE_DEAL_TEXT.notOpen);
    // Nor can Kit accept the original now (she countered it).
    expect(errorOf(await t.ask("p2", { type: "answer", from: "p1", offer: o.id, accept: true }))).toBe(PEOPLE_DEAL_TEXT.notOpen);
    expect(errorOf(await t.ask("p1", { type: "answer", from: "p2", offer: counter.id, accept: true }))).toBeNull();
    expect(lastTalks(t.inbox(KIT.user)).at(-1)).toMatchObject({ counterState: "accepted" });
    await t.lockAll();
    const deal = t.g.fullState.deals[0]!;
    expect([deal.a, deal.b, deal.terms.kind, "turns" in deal.terms ? deal.terms.turns : null]).toEqual(["p2", "p1", "truce", 2]);
  });

  it("decline: Nate is told at once (no reason needed), and nothing starts", async () => {
    const t = await table();
    const o = t.offer("p1", "p2");
    await t.ask("p1", { type: "propose", offer: o });
    await t.ask("p2", { type: "answer", from: "p1", offer: o.id, accept: false });
    expect(lastTalks(t.inbox(NATE.user))).toEqual([{ offer: o, state: "declined" }]);
    await t.lockAll();
    expect(t.dealsNow()).toEqual([]);
    const lapsed = t.g.lastReplay("p1")!.report.events.find((e) => e.type === "offerLapsed");
    expect(lapsed).toMatchObject({ why: "declined" });
    // Only its two sides hear it lapsed.
    expect(t.g.lastReplay("p3")!.report.events.some((e) => e.type === "offerLapsed")).toBe(false);
  });

  it("withdraw before locking in: Kit is told, and her answer can't bring it back", async () => {
    const t = await table();
    const o = t.offer("p1", "p2");
    await t.ask("p1", { type: "propose", offer: o });
    await t.ask("p2", { type: "answer", from: "p1", offer: o.id, accept: true });
    t.clear();
    expect(errorOf(await t.ask("p1", { type: "withdraw", offer: o.id }))).toBeNull();
    expect(lastTalks(t.inbox(KIT.user))).toEqual([{ offer: o, state: "withdrawn" }]);
    expect(errorOf(await t.ask("p2", { type: "answer", from: "p1", offer: o.id, accept: true }))).toBe(PEOPLE_DEAL_TEXT.notOpen);
    await t.lockAll({ p1: [{ id: `propose-${o.id}`, kind: "propose", offer: o }] });
    expect(t.dealsNow()).toEqual([]);
  });

  it("silence lapses at lock-in: Nate is told; an offer to someone who has locked in isn't sent", async () => {
    const t = await table();
    const o = t.offer("p1", "p2");
    await t.ask("p1", { type: "propose", offer: o });
    t.clear();
    await t.ask("p2", { type: "lockIn", orders: [], turn: 1 });
    expect(lastTalks(t.inbox(NATE.user))).toEqual([{ offer: o, state: "lapsed" }]);
    const late = t.offer("p1", "p2", "truce", 2);
    expect(errorOf(await t.ask("p1", { type: "propose", offer: late }))).toBe(PEOPLE_DEAL_TEXT.lockedIn("Kit"));
    // Nate locked in: he can't send more either, and can't withdraw.
    await t.ask("p1", { type: "lockIn", orders: [], turn: 1 });
    expect(errorOf(await t.ask("p1", { type: "propose", offer: t.offer("p1", "p3") }))).toBe(PEOPLE_DEAL_TEXT.youLocked);
  });

  it("limits: three offers to one person a turn, a note of 120 characters, never to yourself or as someone else", async () => {
    const t = await table();
    for (let i = 1; i <= OFFERS_PER_PERSON; i++) expect(errorOf(await t.ask("p1", { type: "propose", offer: t.offer("p1", "p2", "truce", i) }))).toBeNull();
    expect(errorOf(await t.ask("p1", { type: "propose", offer: t.offer("p1", "p2", "truce", 9) }))).toBe(PEOPLE_DEAL_TEXT.tooMany("Kit"));
    // To Wren is a separate count.
    const long = { ...t.offer("p1", "p3", "truce", 10), note: "x".repeat(300) };
    await t.ask("p1", { type: "propose", offer: long });
    expect(t.g.peopleOffersFor("p3")[0]!.offer.note).toHaveLength(NOTE_MAX);
    expect(errorOf(await t.ask("p1", { type: "propose", offer: { ...t.offer("p2", "p3", "truce", 11) } }))).toBe(PEOPLE_DEAL_TEXT.cant);
    expect(errorOf(await t.ask("p1", { type: "propose", offer: { ...t.offer("p1", "p3", "truce", 12), to: "p1" } }))).not.toBeNull();
  });

  it("an offer survives the room going to sleep (a deploy): the other person still finds it waiting", async () => {
    const store = memoryRoomStore();
    const t = await table({ store });
    const o = t.offer("p1", "p2");
    await t.ask("p1", { type: "propose", offer: o });
    await t.ask("p1", { type: "saveOrders", orders: [{ id: `propose-${o.id}`, kind: "propose", offer: o }], turn: 1, now: true });
    await t.room.flush();
    const woke = new RoomCore(store, async (id) => maps[id]!, { send: () => true, sendUser: () => true, users: () => [], tableChanged: () => {}, wakeAt: () => {}, listed: () => {}, log: () => {} }, () => t.now());
    const g = await woke.ensureLoaded();
    expect(g.peopleOffersFor("p2")).toEqual([{ offer: o, state: "open" }]);
    expect(g.peopleOffersFor("p3")).toEqual([]);
  });

  it("the page's news: what changed, from each side (accepted, said no, a counter, lapsed, withdrawn)", async () => {
    const t = await table();
    const o = t.offer("p1", "p2");
    const names = (p: PlayerId) => ({ p1: "Nate", p2: "Kit" })[p as "p1"] ?? p;
    const open: PeopleOffer = { offer: o, state: "open" };
    expect(talkNews([], [open], "p1", names)).toEqual([]);
    expect(openToMe([open], "p2")).toEqual([o]);
    expect(talkNews([open], [{ offer: o, state: "accepted" }], "p1", names)).toEqual([PEOPLE_DEAL_NEWS.accepted("Kit")]);
    expect(talkNews([open], [{ offer: o, state: "declined" }], "p1", names)).toEqual(["Kit said no."]);
    expect(talkNews([open], [{ offer: o, state: "lapsed" }], "p1", names)).toEqual([PEOPLE_DEAL_NEWS.lapsed("Kit")]);
    expect(talkNews([open], [{ offer: o, state: "withdrawn" }], "p2", names)).toEqual(["Nate withdrew the offer."]);
    // (Kit's own answer isn't news to Kit.)
    expect(talkNews([open], [{ offer: o, state: "declined" }], "p2", names)).toEqual([]);
    const counter: Offer = { ...o, id: "p2-t1-4", from: "p2", to: "p1", counterTo: o.id };
    const countered: PeopleOffer = { offer: o, state: "countered", counter, counterState: "open" };
    expect(talkNews([open], [countered], "p1", names)).toEqual([PEOPLE_DEAL_NEWS.countered("Kit")]);
    expect(openToMe([countered], "p1")).toEqual([counter]);
    expect(talkNews([countered], [{ ...countered, counterState: "accepted" }], "p2", names)).toEqual([PEOPLE_DEAL_NEWS.accepted("Nate")]);
    expect(myOfferState([countered], counter.id, "p2")).toBe("open");
    expect(myOfferState([countered], o.id, "p1")).toBe("countered");
    expect(myOfferState([countered], o.id, "p2")).toBeNull();
  });

  it("a person's offer to a bot still gets the bot's answer at once, and a bot's offers to people are as before", async () => {
    const t = await table();
    const bot = t.g.fullState.players.find((p) => !["p1", "p2", "p3"].includes(p.id))!.id;
    const m = await t.ask("p1", { type: "propose", offer: t.offer("p1", bot) });
    expect(m && "answer" in m && typeof m.answer.reason).toBe("string");
    expect(m && "answer" in m && m.answer.waiting).toBeUndefined();
  });
});
