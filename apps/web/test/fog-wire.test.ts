import { replayFor, resolveTurn, viewFor, type GameState, type Order, type OrdersByPlayer, type PlayerId, type PlayerView, type TurnResult } from "@conquerra/engine";
import { recruitBot } from "@conquerra/bots";
import { describe, expect, it } from "vitest";
import type { ChatSync, HostUpdate, PauseView, PeopleOffer, RoomMessage, RoomStart, TableView, TurnReport } from "../src/host/protocol";
import { newOffer } from "../src/logic/deals";
import { chronicleOf } from "../src/logic/chronicleKeep";
import { hostSeat, KIT, NATE, ROOK, settings, testRoom, WREN } from "./roomHelpers";

/**
 * The fog on the wire (session 26, the plan §8): only `viewFor` leaves the room. Session 27: a table of three people
 * (Nate the host, Kit, and Wren, who sits down and then never connects again) and a friend with the link who never
 * sits (Rook: his seat becomes a bot), two Marshals in all, made and started at the table screen; the game plays a
 * dozen turns (some locked in, some missed and run by the leaders, the clock running out); a listener on each page
 * records every message. Before the start, every message is the table screen's: names, colours, the host, empty
 * seats, and nothing of anyone's account. For every message to a seat after it:
 *
 *  - its view is exactly `viewFor(state, seat)`, its replay exactly the engine's fog-trimmed `replayFor` (worked out
 *    again here from the turn's recorded orders), and "your view before the turn" exactly `viewFor(before, seat)`;
 *  - everything else in it is that seat's own: its leaders' orders on its own land, its leaders' notes, offers made
 *    to it, its own queue, its own Chronicle;
 *  - no order the other person or a bot gave this game (their names for their orders) appears anywhere in it, and
 *    the seed never does until the game is over;
 *  - no account id or email ever appears in anything any page is sent.
 *
 * Modelled on the engine's fog tests (packages/engine/test/fog.test.ts and replay-fog.test.ts), which prove `viewFor`
 * and `replayFor` themselves keep the fog.
 */

const SEATS = ["p1", "p2", "p3"] as const;
/** Whose page each seat is (the room sends a seat's messages to the account sitting there). */
const PAGE: Record<string, string> = { p1: NATE.user, p2: KIT.user, p3: WREN.user };
const ACCOUNTS = [NATE, KIT, WREN, ROOK].map((w) => w.user);
/** The fields a room message and its update may carry; anything else is a leak waiting to happen. */
const ENVELOPE = new Set(["id", "ok", "now", "start", "update", "pushed", "error", "orders", "plan", "answer", "table", "notice", "calm", "ready", "talks", "chat", "pause", "clock"]);
/** What the table screen may say about anyone: what the players panel shows (session 27). */
const TABLE = new Set(["gameId", "code", "status", "mapId", "botLevel", "turnSeconds", "luck", "fog", "mode", "fate", "diplomacy", "seats", "you"]);
const TABLE_SEAT = new Set(["name", "house", "host", "you"]);
const TABLE_YOU = new Set(["seat", "host", "removed"]);
const UPDATE = new Set(["playerId", "view", "report", "fastForwarded", "clock", "generalOrders", "leaderNotes", "offers", "seats", "fair", "before", "autoLocked", "queued", "people", "leadersBack", "leftSeats", "talks"]);
/** Session 28: an offer between people, as its two sides are sent it. */
const TALK = new Set(["offer", "state", "counter", "counterState"]);
const START = new Set([...UPDATE, "rules", "chronicle", "replay", "lockedIn", "gameId", "mapId", "mapVersion", "chronicleAfter", "ready", "chat", "pause"]);
/** Session 28: a pause vote, as the whole table is told it. */
const PAUSE = new Set(["vote", "paused", "left", "news"]);
const PAUSE_PART = new Set(["by", "endsAt", "yes", "waiting", "ready"]);
const checkPause = (p: PauseView) => {
  for (const k of Object.keys(p)) expect(PAUSE.has(k), `unexpected pause field ${k}`).toBe(true);
  for (const part of [p.vote, p.paused]) for (const k of Object.keys(part ?? {})) expect(PAUSE_PART.has(k), `unexpected pause part field ${k}`).toBe(true);
};
/** Session 28: chat, as a member is sent it. */
const CHAT_SYNC = new Set(["chats", "lines", "canWrite", "after"]);
const CHAT_VIEW = new Set(["id", "kind", "name", "members"]);
const CHAT_PERSON = new Set(["name", "house", "seat", "you"]);
const CHAT_LINE = new Set(["id", "chat", "from", "text", "at"]);
const checkChat = (c: ChatSync) => {
  for (const k of Object.keys(c)) expect(CHAT_SYNC.has(k), `unexpected chat field ${k}`).toBe(true);
  for (const v of c.chats) {
    for (const k of Object.keys(v)) expect(CHAT_VIEW.has(k), `unexpected chat view field ${k}`).toBe(true);
    // A one-to-one or group you're sent is one you're in.
    if (v.kind !== "table") expect(v.members!.some((p) => p.you)).toBe(true);
    for (const p of v.members ?? []) for (const k of Object.keys(p)) expect(CHAT_PERSON.has(k), `unexpected chat person field ${k}`).toBe(true);
  }
  for (const l of c.lines) {
    for (const k of Object.keys(l)) expect(CHAT_LINE.has(k), `unexpected chat line field ${k}`).toBe(true);
    for (const k of Object.keys(l.from)) expect(CHAT_PERSON.has(k), `unexpected chat person field ${k}`).toBe(true);
  }
};
/** Diplomacy's own ids are public to its two sides (an offer to you names itself). */
const DIPLOMACY = /^(propose|answer|agreed|break)-|-t\d+-(o\d+|c-)/;

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

const checkTalk = (seat: PlayerId, r: PeopleOffer) => {
  for (const k of Object.keys(r)) expect(TALK.has(k), `unexpected talk field ${k}`).toBe(true);
  expect([r.offer.from, r.offer.to]).toContain(seat);
  if (r.counter) expect([r.counter.from, r.counter.to].sort()).toEqual([r.offer.from, r.offer.to].sort());
};

const checkTable = (v: TableView) => {
  for (const k of Object.keys(v)) expect(TABLE.has(k), `unexpected table field ${k}`).toBe(true);
  for (const s of v.seats) if (s) for (const k of Object.keys(s)) expect(TABLE_SEAT.has(k), `unexpected seat field ${k}`).toBe(true);
  for (const k of Object.keys(v.you)) expect(TABLE_YOU.has(k), `unexpected you field ${k}`).toBe(true);
};

describe("the fog on the wire (sessions 26 and 27): only viewFor leaves the room", () => {
  it("three people, a friend who never sat, two Marshals, a dozen turns: every message to a seat is that seat's view and replay, and nothing of anyone else's", async () => {
    const t = testRoom();
    // The table: Nate makes it, Kit and Wren sit down, Rook opens the link and never sits.
    await t.room.createTable({ gameId: "fogwire", code: "f0gw1recde", settings: { ...settings, bots: 4 }, seed: "fog-on-the-wire", host: hostSeat(NATE, 0) });
    await t.table(NATE);
    await t.table(ROOK);
    await t.act(KIT, { do: "sit", house: 3, leadersRun: true, leaderName: "Lady Sorrel" });
    await t.act(WREN, { do: "sit", house: 5, leadersRun: true });
    await t.act(KIT, { do: "colour", house: 4 });
    await t.act(NATE, { do: "start" });
    // Every message before turn 1 is the table screen's (and the start), and no account appears anywhere.
    for (const page of ACCOUNTS) {
      const text = JSON.stringify(t.inbox(page));
      for (const acc of ACCOUNTS) expect(text.includes(acc), `${page} was sent ${acc}`).toBe(false);
      expect(text).not.toContain("fog-on-the-wire");
      expect(text).not.toContain("@");
      for (const m of t.inbox(page)) if ("table" in m) checkTable(m.table);
    }
    expect(t.inbox(ROOK.user).every((m) => "table" in m)).toBe(true);
    expect(t.inbox(ROOK.user).at(-1)).toMatchObject({ table: { status: "started", you: { seat: null } } });
    // Wren never connects again: her leaders run her House.
    t.offline.add(WREN.user);
    const game = () => t.room.table!;
    const ctx = game().ctx;
    const seed = t.room.secretSeed;
    /** Every order id each seat has given this game (from the room's own record of the turns). */
    const given = new Map<PlayerId, Set<string>>();
    const chronicles = new Map<PlayerId, TurnReport[]>(SEATS.map((s) => [s, []]));
    let checked = 0;
    let turnsChecked = 0;
    let ranByLeaders = 0;
    let rivalsSeen = 0;

    /** One turn's truth, for checking what each seat was sent. */
    let last: { before: GameState; result: TurnResult } | null = null;

    const others = (seat: PlayerId) => {
      const theirs = new Set<string>();
      for (const [who, ids] of given) if (who !== seat) for (const id of ids) theirs.add(id);
      for (const id of given.get(seat) ?? []) theirs.delete(id);
      return [...theirs].filter((id) => !DIPLOMACY.test(id));
    };

    const checkPayload = (seat: PlayerId, u: HostUpdate | RoomStart, keys: Set<string>) => {
      for (const k of Object.keys(u)) expect(keys.has(k), `unexpected field ${k}`).toBe(true);
      expect(u.playerId).toBe(seat);
      // The view: exactly the engine's fogged view for this seat.
      expect(u.view).toEqual(clone(viewFor(ctx, game().fullState, seat)));
      // The replay: exactly the engine's fog-trimmed replay, worked out again from the turn's recorded orders.
      const report = u.report ?? ("replay" in u ? u.replay?.report : undefined) ?? null;
      if (report) {
        expect(last).not.toBeNull();
        expect(report.turn).toBe(last!.before.turn);
        // (As the wire carries it: JSON has no -0.)
        expect(report.events).toEqual(clone(replayFor(ctx, last!.before, last!.result, seat)));
        rivalsSeen += report.events.filter((e) => "player" in e && e.player !== seat).length;
        if (report.ranByLeaders?.length) ranByLeaders++;
      }
      const before = u.before ?? ("replay" in u ? u.replay?.before : undefined);
      if (before) expect(before).toEqual(clone(viewFor(ctx, last!.before, seat)));
      // Everything else is this seat's own.
      const view: PlayerView = u.view;
      const mine = (tid: string) => {
        const v = view.territories[tid];
        return v?.detail === "full" && v.owner === seat;
      };
      // (A leader chains its attacks: a later order can start where an earlier one lands.)
      const reached = new Set<string>();
      for (const o of u.generalOrders) {
        if (o.kind === "move" || o.kind === "advance") expect(mine(o.from) || reached.has(o.from), `a leader's move from ${o.from}`).toBe(true);
        if (o.kind === "move") reached.add(o.to);
        if (o.kind === "recruit" || o.kind === "build" || o.kind === "invest" || o.kind === "hire" || o.kind === "hireSpy") expect(mine(o.territory), `a leader's order at ${o.territory}`).toBe(true);
      }
      const myLeaders = new Set(view.me.leaders.map((l) => `${l.kind}:${l.of}`));
      for (const key of Object.keys(u.leaderNotes ?? {})) expect(myLeaders.has(key), `notes from ${key}`).toBe(true);
      for (const o of u.offers ?? []) expect(o.to).toBe(seat);
      // Session 28: offers between people, only the ones this seat is a side of.
      for (const r of u.talks ?? []) checkTalk(seat, r);
      // Your own commands and budgets coming back (session 27): orders for your own Leader and Steward only.
      for (const o of u.leadersBack ?? []) expect((o.kind === "instruct" || o.kind === "budget") && o.general === seat, `leadersBack ${o.id}`).toBe(true);
      if (u.queued) for (const o of u.queued.orders) expect(given.get(seat)?.has(o.id) || DIPLOMACY.test(o.id) || u.generalOrders.some((g) => g.id === o.id), `queued ${o.id}`).toBe(true);
      if ("chronicle" in u && u.chronicle) expect(u.chronicle).toEqual(chronicles.get(seat));
      // The people at the table: their seats, nothing more.
      for (const id of u.people ?? []) expect(SEATS as readonly string[]).toContain(id);
      if (u.fair) expect(u.fair.seed === undefined || game().over).toBe(true);
    };

    const checkInbox = (seat: PlayerId) => {
      const inbox = t.inbox(PAGE[seat]!);
      const text = JSON.stringify(inbox);
      for (const acc of ACCOUNTS) expect(text.includes(acc), `${seat} was sent ${acc}`).toBe(false);
      // No other seat's order ever reaches this one, and never the seed while the game goes on.
      for (const id of others(seat)) expect(text.includes(JSON.stringify(id)), `${seat} was sent ${id}`).toBe(false);
      if (!game().over) expect(text).not.toContain(seed);
      for (const m of inbox as RoomMessage[]) {
        for (const k of Object.keys(m)) expect(ENVELOPE.has(k), `unexpected envelope field ${k}`).toBe(true);
        if ("table" in m) checkTable(m.table);
        if ("start" in m) checkPayload(seat, m.start, START);
        if ("update" in m) checkPayload(seat, m.update, UPDATE);
        if ("pushed" in m) checkPayload(seat, m.pushed, UPDATE);
        if ("plan" in m) for (const key of Object.keys(m.plan.notes)) expect(m.plan.notes[key]).toBeDefined();
        if ("talks" in m) for (const r of m.talks) checkTalk(seat, r);
        if ("chat" in m) checkChat(m.chat);
        if ("start" in m && m.start.chat) checkChat(m.start.chat);
        checked++;
      }
      // What it was sent this turn goes into its Chronicle (as the page keeps it).
      for (const m of inbox as RoomMessage[]) {
        const r = "update" in m ? m.update.report : "pushed" in m ? m.pushed.report : null;
        if (r && !chronicles.get(seat)!.some((c) => c.turn === r.turn)) chronicles.get(seat)!.push(chronicleOf(r));
      }
    };

    // Turn 1: Nate's and Kit's pages say hello (Wren's never does).
    const ONLINE = ["p1", "p2"] as const;
    for (const s of ONLINE) await t.hello(s);
    for (const s of SEATS) checkInbox(s);

    for (let turn = 1; turn <= 12 && !game().over; turn++) {
      t.clear();
      const before = clone(game().fullState);
      const startOf = async (s: PlayerId) => (await t.hello(s)) as RoomStart;
      const a = await startOf("p1");
      const b = await startOf("p2");
      // (Checked against the board as it stands now, before the turn resolves.)
      for (const s of SEATS) checkInbox(s);
      t.clear();
      // Nate plans like a page: his leaders' orders and a bot's plan for the rest, from his own view.
      const nateOrders: Order[] = [...a.generalOrders, ...recruitBot.plan(ctx, a.view).map((o, i) => ({ ...o, id: `nate-${turn}-${i}` }))];
      await t.ask("p1", { type: "saveOrders", orders: nateOrders, turn });
      // Kit's secret plans: some turns locked in, some left in the queue, some missed altogether (her leaders run it).
      const kitOrders: Order[] = [...b.generalOrders, ...recruitBot.plan(ctx, b.view).map((o, i) => ({ ...o, id: `kit-secret-${turn}-${i}` }))];
      if (!game().isOut("p2")) {
        if (turn % 3 === 1) {
          await t.ask("p2", { type: "lockIn", orders: kitOrders, turn });
        } else if (turn % 3 === 2) await t.ask("p2", { type: "saveOrders", orders: kitOrders, turn });
        // (turn % 3 === 0: Kit is away. Her leaders play it.)
      }
      // Nate locks in on even turns; on odd ones the clock runs out.
      if (turn % 2 === 0 && !game().isOut("p1")) await t.ask("p1", { type: "lockIn", orders: nateOrders, turn });
      if (game().turn === turn) {
        t.advance(Math.max(0, (game().nextDeadline ?? t.now()) - t.now()));
        await t.tick();
      }
      // (A game that ends stays on its last turn.)
      expect(game().turn).toBe(game().over ? turn : turn + 1);
      // The turn's truth: resolve the recorded orders again from the board before it, and it must be the same game.
      const orders: OrdersByPlayer = game().snapshot().history!.turns.at(-1)!;
      const result = resolveTurn(ctx, before, orders);
      expect(result.state).toEqual(game().fullState);
      last = { before, result };
      for (const [who, list] of Object.entries(orders)) for (const o of list ?? []) (given.get(who) ?? given.set(who, new Set()).get(who)!).add(o.id);
      for (const s of SEATS) checkInbox(s);
      // And once more as each page comes back (a refresh: "where are we").
      t.clear();
      for (const s of ONLINE) await t.hello(s);
      for (const s of SEATS) checkInbox(s);
      turnsChecked++;
    }

    expect(turnsChecked).toBeGreaterThanOrEqual(8);
    expect(checked).toBeGreaterThan(50);
    // The test saw what it means to: rivals' events in the replays (with their order ids blanked), and missed turns.
    expect(rivalsSeen).toBeGreaterThan(0);
    expect(ranByLeaders).toBeGreaterThan(0);
    // Wren was never sent anything once she left, and her seat played on (her leaders, then a Marshal).
    expect(t.inbox(WREN.user)).toEqual([]);
    expect(given.get("p3")?.size).toBeGreaterThan(0);
    // Kit's secret orders were really given (so "never sent to Nate" means something).
    expect([...given.get("p2")!].filter((id) => id.startsWith("kit-secret")).length).toBeGreaterThan(5);
  }, 120_000);

  it("session 28: three people all online and a watcher who never sat: an offer and its counter, a group chat, reach their members only; a pause vote and the deal's news reach the table", async () => {
    const t = testRoom();
    await t.room.createTable({ gameId: "fogtalk", code: "f0gt4lkcde", settings: { ...settings, bots: 3 }, seed: "fog-on-the-wire-28", host: hostSeat(NATE, 0) });
    await t.table(ROOK);
    await t.act(KIT, { do: "sit", house: 3, leadersRun: true });
    await t.act(WREN, { do: "sit", house: 5, leadersRun: true });
    await t.act(NATE, { do: "start" });
    const g = t.room.table!;
    const ctx = g.ctx;
    for (const s of SEATS) await t.hello(s);
    t.clear();
    // Nate offers Kit a truce with a note; Kit counters with a trade of her own (gold her way) and a note.
    const truce = { ...newOffer(ctx, viewFor(ctx, g.fullState, "p1"), "p2", "truce", 7), note: "SECRET-NATE: hold the east" };
    await t.ask("p1", { type: "propose", offer: truce });
    const trade = { ...newOffer(ctx, viewFor(ctx, g.fullState, "p2"), "p1", "trade", 8), counterTo: truce.id, note: "SECRET-KIT: pay me", terms: { kind: "trade" as const, give: {}, get: { gold: 7, perTurn: 3 }, turns: 2 } };
    await t.ask("p2", { type: "propose", offer: trade });
    await t.ask("p1", { type: "answer", from: "p2", offer: trade.id, accept: true });
    // Wren offers Nate a truce he never answers (Kit must never hear of it).
    const wrens = { ...newOffer(ctx, viewFor(ctx, g.fullState, "p3"), "p1", "truce", 9), note: "SECRET-WREN: just us" };
    await t.ask("p3", { type: "propose", offer: wrens });
    // Nate and Kit make a group chat, name it and write in it; the table chat has a line everyone may read.
    const group = (await t.askAs(NATE, { type: "chat", act: { do: "group", with: ["p2"], name: "SECRET-GROUP" } })) as Extract<RoomMessage, { chat: ChatSync }>;
    const groupId = group.chat.chats[0]!.id;
    t.advance(2000);
    await t.askAs(KIT, { type: "chat", act: { do: "send", chat: groupId, text: "SECRET-CHAT: Wren's capital is thin" } });
    t.advance(2000);
    await t.askAs(NATE, { type: "chat", act: { do: "pair", with: "p2" } });
    await t.askAs(WREN, { type: "chat", act: { do: "send", chat: "table", text: "Good luck, everyone." } });
    // Wren asks for a pause: the whole table gets the vote (who asked, who has answered), and nothing else.
    await t.ask("p3", { type: "pause", act: "ask" });
    await t.ask("p1", { type: "pause", act: "yes" });
    await t.ask("p2", { type: "pause", act: "no" });
    for (const s of SEATS) await t.hello(s);
    const secretsOf = (seat: PlayerId) => [
      ...(seat === "p1" || seat === "p2" ? [] : ["SECRET-NATE", "SECRET-KIT", JSON.stringify(truce.id), JSON.stringify(trade.id), '"perTurn":3']),
      ...(seat === "p1" || seat === "p3" ? [] : ["SECRET-WREN", JSON.stringify(wrens.id)]),
      ...(seat === "p1" || seat === "p2" ? [] : ["SECRET-GROUP", "SECRET-CHAT", JSON.stringify(groupId), '"kind":"group"', '"kind":"pair"']),
    ];
    const check = (seat: PlayerId) => {
      const inbox = t.inbox(PAGE[seat]!);
      const text = JSON.stringify(inbox);
      for (const s of secretsOf(seat)) expect(text.includes(s), `${seat} was sent ${s}`).toBe(false);
      for (const m of inbox) {
        for (const k of Object.keys(m)) expect(ENVELOPE.has(k), `unexpected envelope field ${k}`).toBe(true);
        const u = "start" in m ? m.start : "update" in m ? m.update : "pushed" in m ? m.pushed : null;
        if (u) {
          for (const k of Object.keys(u)) expect(("start" in m ? START : UPDATE).has(k), `unexpected field ${k}`).toBe(true);
          for (const r of u.talks ?? []) checkTalk(seat, r);
          for (const o of u.offers ?? []) expect(o.to).toBe(seat);
        }
        if ("talks" in m) for (const r of m.talks) checkTalk(seat, r);
        if ("chat" in m) checkChat(m.chat);
        if ("start" in m && m.start.chat) checkChat(m.start.chat);
        if ("pause" in m) checkPause(m.pause);
        if ("start" in m && m.start.pause) checkPause(m.start.pause);
      }
      return text;
    };
    // Each side was told; the third person and the watcher heard nothing of the pair's offers.
    expect(check("p1")).toContain("SECRET-KIT");
    expect(check("p2")).toContain("SECRET-NATE");
    expect(check("p2")).not.toContain("SECRET-WREN");
    expect(check("p3")).toContain("SECRET-WREN");
    expect(check("p1")).toContain("SECRET-CHAT");
    expect(check("p2")).toContain("SECRET-GROUP");
    // Everyone reads the table chat; Rook, who never sat, nothing at all.
    expect(check("p1")).toContain("Good luck, everyone.");
    expect(JSON.stringify(t.inbox(ROOK.user))).not.toContain("SECRET");
    expect(JSON.stringify(t.inbox(ROOK.user))).not.toContain("Good luck");
    for (const s of SEATS) {
      const votes = t.inbox(PAGE[s]!).flatMap((m) => ("pause" in m ? [m.pause] : []));
      expect(votes.some((p) => p.vote?.by === "p3"), `${s} saw the vote`).toBe(true);
      expect(votes.at(-1)!.news).toEqual({ kind: "failed", why: "no", who: ["p2"] });
    }
    expect(JSON.stringify(t.inbox(ROOK.user))).not.toContain("pause");
    // The turn plays: the deal starts (Kit's trade), and the table hears that it did, without its terms.
    t.clear();
    for (const s of SEATS) await t.ask(s, { type: "lockIn", orders: g.generalOrders({}, undefined, s), turn: 1 });
    expect(g.turn).toBe(2);
    for (const s of SEATS) check(s);
    const started = (seat: PlayerId) => {
      const u = t.inbox(PAGE[seat]!).flatMap((m) => ("update" in m ? [m.update] : "pushed" in m ? [m.pushed] : []))[0]!;
      return u.report!.events.filter((e) => e.type === "dealStarted");
    };
    expect(started("p3")).toHaveLength(1);
    expect(started("p3")[0]).toMatchObject({ deal: { a: "p2", b: "p1", terms: { kind: "trade", give: {}, get: {} } } });
    expect(started("p1")[0]).toMatchObject({ deal: { terms: { get: { gold: 7, perTurn: 3 } } } });
    expect(JSON.stringify(t.inbox(ROOK.user))).toBe("[]");
  }, 60_000);
});
