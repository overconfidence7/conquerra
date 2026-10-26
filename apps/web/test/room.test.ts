import type { Order } from "@conquerra/engine";
import { describe, expect, it } from "vitest";
import { ONLINE_GRACE_MS, type PersonSeat } from "../src/host/localGame";
import type { HostUpdate, RoomBody, RoomMessage, RoomStart } from "../src/host/protocol";
import { sha256Hex } from "../src/host/roomCore";
import { buildTimeline } from "../src/replay/timeline";
import { memoryRoomStore, nate, settings, testRoom } from "./roomHelpers";

const updateOf = (m: RoomMessage | null): HostUpdate => {
  if (!m || !("update" in m)) throw new Error(`no update: ${JSON.stringify(m)}`);
  return m.update;
};
const pushes = (msgs: RoomMessage[]) => msgs.flatMap((m) => ("pushed" in m ? [m.pushed] : []));

describe("the game room (session 26)", () => {
  it("makes a game: the person in their seat, bots in the rest, the seed committed to and never sent", async () => {
    const t = testRoom();
    const info = await t.room.create({ gameId: "g1", settings, people: [nate], seed: "secret-seed-1" });
    expect(info).toMatchObject({ gameId: "g1", turn: 1, status: "playing", waitingOn: ["p1"], winner: null });
    expect(info.seedHash).toBe(await sha256Hex("secret-seed-1"));
    expect(info.seed).toBeUndefined();
    const s: RoomStart = await t.hello("p1");
    expect(s.playerId).toBe("p1");
    expect(s.view.me.id).toBe("p1");
    expect(s.view.players.map((p) => p.name)).toEqual(["Nate", "Lady Morwen", "Baron Krell", "Queen Isolde"]);
    expect(s.mapId).toBe("embervale");
    expect(s.fair).toEqual({ seedHash: info.seedHash });
    // The map travels as its id: no drawing data on the wire, and never the seed or the full state.
    const wire = JSON.stringify(t.inbox("p1"));
    expect(wire).not.toContain('"geometry"');
    expect(wire).not.toContain("secret-seed-1");
    expect(wire).not.toContain('"rng"');
    // The clock: the first window opens at once.
    expect(s.clock).toEqual({ endsAt: t.now() + 300_000, turnMs: 300_000 });
    expect(t.alarm()).toBe(t.now() + 300_000);
    expect(t.listed()).toMatchObject({ turn: 1, deadline: t.now() + 300_000 });
  });

  it("orders in, lock in: the turn resolves at once (everyone at the table has locked in) and the game is saved", async () => {
    const t = testRoom();
    await t.room.create({ gameId: "g2", settings, people: [nate], seed: "s2" });
    const s = await t.hello("p1");
    const recruit: Order = { id: "o1", kind: "recruit", territory: s.view.me.capital, count: 2 };
    const u = updateOf(await t.ask("p1", { type: "lockIn", orders: [...s.generalOrders, recruit], turn: 1 }));
    expect(u.view.turn).toBe(2);
    expect(u.report!.turn).toBe(1);
    expect(u.report!.events.some((e) => e.type === "recruited" && e.player === "p1")).toBe(true);
    expect(u.autoLocked).toBeUndefined();
    expect(t.listed()).toMatchObject({ turn: 2, waitingOn: ["p1"] });
    // Saved: a room that wakes from sleep carries on at turn 2.
    const saved = JSON.parse(t.store.data.get("game")!);
    expect(saved.state.turn).toBe(2);
    // The log line the session reads in wrangler tail.
    expect(t.logs.some((l) => /turn 1 resolved and turn 2 planned in [\d.]+ ms/.test(l))).toBe(true);
    // A late lock-in for turn 1 changes nothing.
    const late = updateOf(await t.ask("p1", { type: "lockIn", orders: [], turn: 1 }));
    expect(late.view.turn).toBe(2);
    expect(late.report).toBeNull();
  });

  it("the next window opens after the replay's length plus 10 s, then the full timer", async () => {
    const t = testRoom();
    await t.room.create({ gameId: "g3", settings, people: [nate], seed: "s3" });
    t.advance(42_000);
    const u = updateOf(await t.ask("p1", { type: "lockIn", orders: [], turn: 1 }));
    const replay = buildTimeline(u.report!.events).total;
    expect(replay).toBeGreaterThan(0);
    expect(u.clock!.endsAt).toBe(t.now() + replay + ONLINE_GRACE_MS + 300_000);
    expect(t.alarm()).toBe(u.clock!.endsAt);
  });

  it("the clock runs out: the queue as you left it goes in, and the page is told", async () => {
    const t = testRoom();
    await t.room.create({ gameId: "g4", settings, people: [nate], seed: "s4" });
    const s = await t.hello("p1");
    const recruit: Order = { id: "o1", kind: "recruit", territory: s.view.me.capital, count: 3 };
    await t.ask("p1", { type: "saveOrders", orders: [recruit], turn: 1 });
    t.advance(299_000);
    await t.tick();
    expect(pushes(t.inbox("p1"))).toEqual([]);
    t.advance(1_000);
    await t.tick();
    const [u] = pushes(t.inbox("p1"));
    expect(u!.autoLocked).toBe(true);
    expect(u!.view.turn).toBe(2);
    expect(u!.report!.events.some((e) => e.type === "recruited" && e.player === "p1")).toBe(true);
    expect(u!.report!.ranByLeaders).toBeUndefined();
  });

  it("a missed turn with no orders: with the choice on, your Leader and Steward run your House (80/20), and the card says so", async () => {
    const t = testRoom();
    await t.room.create({ gameId: "g5", settings, people: [nate], seed: "s5" });
    t.offline.add("p1");
    t.advance(300_000);
    await t.tick();
    t.offline.delete("p1");
    const back = await t.hello("p1");
    expect(back.view.turn).toBe(2);
    expect(back.replay!.report.ranByLeaders).toEqual(["p1"]);
    const leader = back.view.me.leaders.find((l) => l.kind === "leader" && l.of === "p1")!;
    const steward = back.view.me.leaders.find((l) => l.kind === "steward" && l.of === "p1")!;
    expect(leader.command).toEqual({ kind: "military" });
    expect(leader.budget).toEqual({ share: 0.8 });
    expect(steward.command).toEqual({ kind: "realm" });
    expect(steward.budget).toEqual({ share: 0.2 });
    // The orders the room played for you: your leaders' (what changes in their commands and budgets (your Steward
    // already runs the realm), then their own orders).
    const played: Order[] = JSON.parse(t.store.data.get("game")!).history.turns[0].p1;
    expect(played.filter((o) => o.kind === "instruct").map((o) => o.kind === "instruct" && o.instruction)).toEqual([{ kind: "military" }]);
    expect(played.filter((o) => o.kind === "budget").length).toBe(2);
    expect(played.length).toBeGreaterThan(4);
  });

  it("after missed turns, your own commands and budgets come back when you play a turn yourself (session 27)", async () => {
    const t = testRoom();
    await t.room.create({ gameId: "g5b", settings, people: [nate], seed: "s5b" });
    const first = await t.hello("p1");
    const mine = (s: RoomStart | HostUpdate) => s.view.me.leaders.filter((l) => l.of === "p1").map((l) => ({ kind: l.kind, command: l.command ?? null, budget: l.budget }));
    const own = mine(first);
    expect(first.leadersBack).toBeUndefined();
    // Two missed turns in a row: the leaders run both at 80/20.
    t.offline.add("p1");
    for (let i = 0; i < 2; i++) {
      t.advance((t.room.table!.nextDeadline ?? t.now()) - t.now());
      await t.tick();
    }
    t.offline.delete("p1");
    const back = await t.hello("p1");
    expect(back.view.turn).toBe(3);
    expect(mine(back)).not.toEqual(own);
    // The page is handed the orders that put your own back (as changes of yours), and your leaders plan with them.
    expect(back.leadersBack!.length).toBeGreaterThan(0);
    for (const o of back.leadersBack!) expect(o.kind === "instruct" || o.kind === "budget").toBe(true);
    // You lock in a turn yourself (the page sends them with your orders): your own settings are back.
    const u = updateOf(await t.ask("p1", { type: "lockIn", orders: [...back.leadersBack!, ...back.generalOrders], turn: 3 }));
    expect(mine(u)).toEqual(own);
    expect(u.leadersBack).toBeUndefined();
    expect(u.report!.ranByLeaders).toBeUndefined();
    // And a room that slept in between keeps what to give back.
    const store = memoryRoomStore();
    const s = testRoom(store);
    await s.room.create({ gameId: "g5c", settings, people: [nate], seed: "s5c" });
    s.offline.add("p1");
    s.advance(300_000);
    await s.tick();
    const woke = testRoom(store, s.now() + 1000);
    expect((await woke.hello("p1")).leadersBack!.length).toBeGreaterThan(0);
  });

  it("a missed turn with no orders and the choice off: your House holds still", async () => {
    const t = testRoom();
    await t.room.create({ gameId: "g6", settings, people: [{ ...nate, leadersRun: false }], seed: "s6" });
    t.offline.add("p1");
    t.advance(300_000);
    await t.tick();
    t.offline.delete("p1");
    const back = await t.hello("p1");
    expect(back.view.turn).toBe(2);
    expect(back.replay!.report.ranByLeaders).toBeUndefined();
    // The orders the room played for you: none.
    expect(JSON.parse(t.store.data.get("game")!).history.turns[0].p1).toEqual([]);
    expect(back.view.me.leaders.find((l) => l.kind === "leader" && l.of === "p1")!.command).not.toEqual({ kind: "military" });
  });

  it("the room sleeps between turns and wakes with the same game, clock and queue", async () => {
    const store = memoryRoomStore();
    const t = testRoom(store);
    await t.room.create({ gameId: "g7", settings, people: [nate], seed: "s7" });
    const s = await t.hello("p1");
    const recruit: Order = { id: "o7", kind: "recruit", territory: s.view.me.capital, count: 1 };
    await t.ask("p1", { type: "saveOrders", orders: [recruit], turn: 1, now: true });
    // A fresh room on the same storage (the Durable Object was evicted), the same clock.
    const woke = testRoom(store, t.now() + 60_000);
    const again = await woke.hello("p1");
    expect(again.view.turn).toBe(1);
    expect(again.queued).toEqual({ orders: [recruit], paused: [] });
    expect(again.clock).toEqual(s.clock);
    // Nobody connected when the alarm fires: the turn resolves anyway.
    woke.offline.add("p1");
    woke.advance(240_000);
    await woke.room.alarm();
    await woke.room.flush();
    const third = testRoom(store, woke.now() + 1);
    const later = await third.hello("p1");
    expect(later.view.turn).toBe(2);
    expect(later.replay!.play).toBe(true);
    expect(later.replay!.report.events.some((e) => e.type === "recruited" && e.player === "p1")).toBe(true);
  });

  it("coming back: the replay you missed plays; one you were sent plays again only while the window hasn't opened", async () => {
    const t = testRoom();
    await t.room.create({ gameId: "g8", settings, people: [nate], seed: "s8" });
    const u = updateOf(await t.ask("p1", { type: "lockIn", orders: [], turn: 1 }));
    // Closed the tab mid-replay: still inside the replay and the 10 s, so it plays again.
    t.advance(1_000);
    expect((await t.hello("p1")).replay!.play).toBe(true);
    // Back after the window opened: you saw it; it's there for Watch again.
    t.advance(buildTimeline(u.report!.events).total + ONLINE_GRACE_MS);
    const s = await t.hello("p1");
    expect(s.replay!.play).toBe(false);
    expect(s.replay!.report.turn).toBe(1);
    expect(s.replay!.before.turn).toBe(1);
  });

  it("two people: the first to lock in waits; the turn resolves when the second does, and each gets their own update", async () => {
    const t = testRoom();
    const kit: PersonSeat = { id: "p2", name: "Kit", house: 3, leadersRun: true };
    await t.room.create({ gameId: "g9", settings: { ...settings, bots: 2 }, people: [nate, kit], seed: "s9" });
    await t.hello("p1");
    await t.hello("p2");
    expect(await t.ask("p1", { type: "lockIn", orders: [], turn: 1 })).toBeNull();
    expect(t.listed()!.waitingOn).toEqual(["p2"]);
    const second = updateOf(await t.ask("p2", { type: "lockIn", orders: [], turn: 1 }));
    expect(second.playerId).toBe("p2");
    const first = t.inbox("p1").find((m) => "update" in m)!;
    expect("update" in first && first.update.playerId).toBe("p1");
    expect("update" in first && first.update.view.turn).toBe(2);
    expect(t.listed()!.waitingOn).toEqual(["p1", "p2"]);
  });

  it("turns away a seat that isn't at the table, junk orders, and single-player requests", async () => {
    const t = testRoom();
    await t.room.create({ gameId: "g10", settings, people: [nate], seed: "s10" });
    const stranger = await t.ask("p9", { type: "hello" });
    expect(stranger).toMatchObject({ ok: false, error: "You don't have a seat in this game." });
    const junk = await t.ask("p1", { type: "lockIn", orders: [{ nope: 1 }] as unknown as Order[], turn: 1 });
    expect(junk).toMatchObject({ ok: false });
    const pause = await t.ask("p1", { type: "pause" } as unknown as RoomBody);
    // (Session 28: "pause" is the vote now; single player's plain pause, with no act, is still refused.)
    expect(pause).toMatchObject({ ok: false, error: "That can't be done with a pause." });
    expect((await t.hello("p1")).view.turn).toBe(1);
  });

  it("game over: the seed is revealed, and it matches the hash committed at the start", async () => {
    const t = testRoom();
    await t.room.create({ gameId: "g11", settings: { ...settings, botLevel: "captain" }, people: [{ ...nate, leadersRun: false }], seed: "the-seed-11" });
    let s = await t.hello("p1");
    // Do nothing until a bot knocks you out, then the bots play on to the end.
    for (let i = 0; i < 80 && !s.view.players.find((p) => p.id === "p1")!.eliminatedTurn; i++) {
      await t.ask("p1", { type: "lockIn", orders: [], turn: s.view.turn });
      s = await t.hello("p1");
    }
    const end = updateOf(await t.ask("p1", { type: "finish" }));
    expect(end.view.winner).not.toBeNull();
    expect(end.fair!.seed).toBe("the-seed-11");
    expect(await sha256Hex(end.fair!.seed!)).toBe(end.fair!.seedHash);
    expect(t.listed()).toMatchObject({ status: "over", seed: "the-seed-11" });
    expect(t.alarm()).toBeNull();
  }, 60_000);
});

describe("long turns (session 26, Part 4): 1, 8 and 24 hours, through the room's sleep", () => {
  it("a 24-hour game: nobody connected, the alarm resolves each day's turn; back two days later, you land in the replay you missed", async () => {
    const store = memoryRoomStore();
    const t = testRoom(store);
    await t.room.create({ gameId: "long1", settings: { ...settings, turnSeconds: 24 * 3600 }, people: [nate], seed: "long-game" });
    const first = await t.hello("p1");
    expect(first.clock!.endsAt - t.now()).toBe(24 * 3600 * 1000);
    const recruit: Order = { id: "o1", kind: "recruit", territory: first.view.me.capital, count: 2 };
    await t.ask("p1", { type: "saveOrders", orders: [recruit], turn: 1, now: true });
    // The page goes away. Each wake-up is a fresh room on the same storage (the Durable Object slept in between).
    let now = t.now();
    for (let day = 1; day <= 2; day++) {
      const room = testRoom(store, now);
      room.offline.add("p1");
      // An hour before the deadline nothing happens.
      const due = (await room.room.ensureLoaded()).nextDeadline!;
      room.advance(due - 3600_000 - room.now());
      await room.room.alarm();
      expect(room.room.table!.turn).toBe(day);
      room.advance(3600_000);
      await room.room.alarm();
      await room.room.flush();
      expect(room.room.table!.turn).toBe(day + 1);
      now = room.now();
    }
    // Two days later, back on the laptop: turn 3, the last turn's replay plays (you weren't there for it), and the
    // first day's queue went in as you left it.
    const back = testRoom(store, now + 60_000);
    const s = await back.hello("p1");
    expect(s.view.turn).toBe(3);
    expect(s.replay!.play).toBe(true);
    expect(s.replay!.report.turn).toBe(2);
    expect(s.replay!.report.ranByLeaders).toEqual(["p1"]);
    const saved = JSON.parse(store.data.get("game")!);
    expect(saved.history.turns[0].p1).toEqual([recruit]);
    // The clock: a full day from when the window opened.
    expect(s.clock!.turnMs).toBe(24 * 3600 * 1000);
    expect(s.clock!.endsAt).toBeGreaterThan(now + 23 * 3600 * 1000);
  });
});
