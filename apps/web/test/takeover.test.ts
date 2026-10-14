import type { Order } from "@conquerra/engine";
import { describe, expect, it } from "vitest";
import { SEAT_LEFT_TEXT, TAKEOVER_MISSES } from "../src/host/localGame";
import type { HostUpdate, RoomMessage, RoomStart } from "../src/host/protocol";
import { hostSeat, KIT, memoryRoomStore, NATE, settings, testRoom, WREN } from "./roomHelpers";

/**
 * Session 27, Part 2: the clock for several people, bot takeover, resigning, watching, and a trimmed "where are we".
 * Nate, Kit and Wren sit at a table; Wren sits down and never comes back.
 */

const notices = (msgs: RoomMessage[]) => msgs.flatMap((m) => ("notice" in m ? [m.notice] : []));
const pushes = (msgs: RoomMessage[]) => msgs.flatMap((m) => ("pushed" in m ? [m.pushed] : []));
/** Every turn update a page got: answers to its lock-in, and pushes. */
const turns = (msgs: RoomMessage[]) => msgs.flatMap((m) => ("pushed" in m ? [m.pushed] : "update" in m ? [m.update] : []));
const updateOf = (m: RoomMessage | null): HostUpdate => {
  if (!m || !("update" in m)) throw new Error(`no update: ${JSON.stringify(m)}`);
  return m.update;
};

async function threeAtTable(opts: { bots?: number; map?: string; store?: ReturnType<typeof memoryRoomStore> } = {}) {
  const t = testRoom(opts.store);
  await t.room.createTable({ gameId: "three", code: "thr33t4ble", settings: { ...settings, mapId: opts.map ?? "embervale", bots: opts.bots ?? 3 }, seed: "three-at-the-table", host: hostSeat(NATE, 0) });
  await t.act(KIT, { do: "sit", house: 3, leadersRun: true });
  await t.act(WREN, { do: "sit", house: 5, leadersRun: true });
  await t.act(NATE, { do: "start" });
  // Wren never connects again.
  t.offline.add(WREN.user);
  t.leave(WREN);
  return t;
}

/** Nate and Kit lock in (their leaders' orders); Wren doesn't. Returns once the turn has resolved (the clock if need be). */
async function playTurn(t: Awaited<ReturnType<typeof threeAtTable>>, who = ["p1", "p2"]) {
  const g = t.room.table!;
  const turn = g.turn;
  for (const seat of who) if (!g.isOut(seat) && !g.leftSeats[seat]) await t.ask(seat, { type: "lockIn", orders: g.generalOrders({}, undefined, seat), turn });
  if (g.turn === turn && !g.over) {
    t.advance(Math.max(0, (g.nextDeadline ?? t.now()) - t.now()));
    await t.tick();
  }
}

describe("the clock for several people (session 27)", () => {
  it("a turn waits for everyone still playing: Wren never connects, so it ends at the deadline; a page that comes back sees the true time left", async () => {
    const t = await threeAtTable();
    const g = t.room.table!;
    const deadline = g.nextDeadline!;
    expect(deadline).toBe(t.now() + 300_000);
    await t.ask("p1", { type: "lockIn", orders: [], turn: 1 });
    // Kit's page hears that Nate has locked in (a tick in the players panel: who, nothing more).
    expect(t.inbox(KIT.user).flatMap((m) => ("ready" in m ? [m.ready] : []))).toEqual([["p1"]]);
    await t.ask("p2", { type: "lockIn", orders: [], turn: 1 });
    expect(t.inbox(NATE.user).flatMap((m) => ("ready" in m ? [m.ready] : [])).at(-1)).toEqual(["p1", "p2"]);
    // Both locked in, Wren hasn't: the turn waits for her (or the clock).
    expect(g.turn).toBe(1);
    expect(t.listed()!.waitingOn).toEqual(["p3"]);
    // Kit's page comes back 100 s later: the deadline is the room's, so the time left is the true time left.
    t.advance(100_000);
    const back = await t.hello("p2");
    expect(back.clock!.endsAt).toBe(deadline);
    expect(back.lockedIn).toBe(true);
    expect(back.ready).toEqual(["p1", "p2"]);
    // The clock runs out: the turn resolves; Wren's leaders ran her House.
    t.advance(200_000);
    await t.tick();
    expect(g.turn).toBe(2);
    const [u] = turns(t.inbox(KIT.user)).slice(-1);
    expect(u!.report!.ranByLeaders).toEqual(["p3"]);
  });
});

describe("bot takeover after three missed turns, and coming back before it (session 27)", () => {
  it(`${TAKEOVER_MISSES} missed turns in a row: a Marshal (Neutral) takes the seat, the table is told, and the turn no longer waits on it`, async () => {
    const t = await threeAtTable();
    const g = t.room.table!;
    for (let i = 0; i < TAKEOVER_MISSES - 1; i++) await playTurn(t);
    expect(g.leftSeats).toEqual({});
    t.clear();
    await playTurn(t);
    // After the third miss: the seat is a Marshal's from turn 4 on.
    expect(g.leftSeats).toEqual({ p3: { why: "taken", turn: TAKEOVER_MISSES + 1 } });
    expect(notices(t.inbox(NATE.user))).toEqual(["Wren missed three turns in a row. Wren's seat is a Marshal's now."]);
    expect(notices(t.inbox(KIT.user))).toHaveLength(1);
    // Everyone's updates say so (the players panel shows "(bot)"); people are Nate and Kit now.
    const [u] = turns(t.inbox(KIT.user)).slice(-1);
    expect(u!.leftSeats).toEqual({ p3: { why: "taken", turn: 4 } });
    expect(u!.people).toEqual(["p1", "p2"]);
    // The database copy marks the seat (a Marshal's), and the lists move it to Finished for Wren.
    expect(t.mirrors.at(-1)!.seats.find((s) => s.seat === "p3")).toMatchObject({ user: WREN.user, bot: "marshal", state: "taken" });
    // The next turn waits only on Nate and Kit: it resolves the moment both lock in.
    expect(t.listed()!.waitingOn).toEqual(["p1", "p2"]);
    await t.ask("p1", { type: "lockIn", orders: [], turn: 4 });
    await t.ask("p2", { type: "lockIn", orders: [], turn: 4 });
    expect(g.turn).toBe(5);
    // The Marshal played turn 4 (not her leaders at 80/20), and sent her purses home first.
    const turn4 = g.snapshot().history!.turns[3]!;
    expect(turn4.p3!.length).toBeGreaterThan(0);
    expect(turns(t.inbox(KIT.user)).at(-1)!.report!.ranByLeaders).toBeUndefined();
    const wren = g.fullState.players.find((p) => p.id === "p3")!;
    for (const l of wren.leaders.filter((x) => x.of === "p3")) {
      expect(l.purse).toBe(0);
      expect(l.budget).toEqual({ share: 0 });
    }
    // The saved game keeps it (a room that slept wakes with the Marshal in the seat).
    const save = g.snapshot();
    expect((save.host as { seats: Record<string, unknown> }).seats.p3).toEqual({ level: "marshal", personality: "neutral" });
  }, 60_000);

  it("back before the third miss: the count starts again", async () => {
    const t = await threeAtTable();
    const g = t.room.table!;
    await playTurn(t);
    await playTurn(t);
    // Wren comes back on turn 3 (her page sends her queue) and goes again.
    t.offline.delete(WREN.user);
    const s = await t.hello("p3");
    await t.ask("p3", { type: "saveOrders", orders: s.generalOrders, turn: 3 });
    t.offline.add(WREN.user);
    await playTurn(t);
    await playTurn(t);
    await playTurn(t);
    expect(g.leftSeats).toEqual({});
    await playTurn(t);
    expect(g.leftSeats).toEqual({ p3: { why: "taken", turn: 7 } });
  }, 60_000);

  it("after the takeover, Wren can open the game and watch from her seat, but gives no orders", async () => {
    const t = await threeAtTable();
    for (let i = 0; i < TAKEOVER_MISSES; i++) await playTurn(t);
    t.offline.delete(WREN.user);
    const s = await t.hello("p3");
    expect(s.view.me.id).toBe("p3");
    expect(s.leftSeats!.p3).toEqual({ why: "taken", turn: 4 });
    expect(s.generalOrders).toEqual([]);
    expect(s.offers).toEqual([]);
    expect(await t.ask("p3", { type: "lockIn", orders: [], turn: 4 })).toMatchObject({ ok: false, error: SEAT_LEFT_TEXT });
    // She's sent each turn as it resolves (her seat's view and replay, nothing else).
    await playTurn(t);
    const [u] = pushes(t.inbox(WREN.user));
    expect(u!.playerId).toBe("p3");
    expect(u!.report!.turn).toBe(4);
    // Her chronicle went on while she was away (her seat's turns, as she'd have seen them).
    expect(s.chronicle!.map((r) => r.turn)).toEqual([1, 2, 3]);
  }, 60_000);
});

describe("resign (session 27)", () => {
  it("Kit resigns while Nate waits locked in: a Marshal takes the seat at once, the turn resolves, Nate is told, Kit watches", async () => {
    const t = testRoom();
    await t.room.createTable({ gameId: "two", code: "tw0p30p1e2", settings: { ...settings, bots: 2 }, seed: "two", host: hostSeat(NATE, 0) });
    await t.act(KIT, { do: "sit", house: 3, leadersRun: true });
    await t.act(NATE, { do: "start" });
    const g = t.room.table!;
    expect(await t.ask("p1", { type: "lockIn", orders: [], turn: 1 })).toBeNull();
    const kitOrders: Order[] = g.generalOrders({}, undefined, "p2");
    await t.ask("p2", { type: "saveOrders", orders: kitOrders, turn: 1 });
    t.clear();
    const answer = updateOf(await t.ask("p2", { type: "resign" }));
    // The turn resolved (Nate was the only one still playing, and he'd locked in).
    expect(g.turn).toBe(2);
    expect(answer.leftSeats).toEqual({ p2: { why: "resigned", turn: 1 } });
    expect(notices(t.inbox(NATE.user))).toEqual(["Kit resigned. Kit's seat is a Marshal's now."]);
    expect(notices(t.inbox(KIT.user))).toEqual([]);
    expect(updateOf(t.inbox(NATE.user).find((m) => "update" in m) ?? null).view.turn).toBe(2);
    // Kit's queue was dropped: the Marshal played the turn.
    const turn1 = g.snapshot().history!.turns[0]!;
    expect(turn1.p2!.some((o) => kitOrders.some((k) => k.id === o.id))).toBe(false);
    expect(t.mirrors.at(-1)!.seats.find((s) => s.seat === "p2")).toMatchObject({ state: "resigned", bot: "marshal" });
    // From now on the table waits on Nate alone; Kit can't give orders, or resign twice.
    expect(t.listed()!.waitingOn).toEqual(["p1"]);
    expect(await t.ask("p2", { type: "lockIn", orders: [], turn: 2 })).toMatchObject({ ok: false, error: SEAT_LEFT_TEXT });
    expect(await t.ask("p2", { type: "resign" })).toMatchObject({ ok: false });
    // Resigning from the lobby's list (the room's own call) works the same way, for another seat.
    expect(await t.room.resignUser(NATE.user)).toBe(true);
    expect(g.leftSeats.p1).toEqual({ why: "resigned", turn: 2 });
  });
});

describe("a trimmed 'where are we' (session 27)", () => {
  it("the page says which turns of the Chronicle it has: the hello is about the size of the turn itself, not the whole game", async () => {
    const t = await threeAtTable({ map: "rootholm", bots: 5 });
    const g = t.room.table!;
    for (let i = 0; i < 14 && !g.over; i++) await playTurn(t);
    const turn = g.turn;
    const full = await t.ask("p1", { type: "hello" });
    const trimmed = await t.ask("p1", { type: "hello", have: turn - 1 });
    const fullStart = (full as { start: RoomStart }).start;
    const trimmedStart = (trimmed as { start: RoomStart }).start;
    expect(fullStart.chronicle!.map((r) => r.turn)).toEqual(Array.from({ length: turn - 1 }, (_, i) => i + 1));
    expect(trimmedStart.chronicle).toEqual([]);
    expect(trimmedStart.chronicleAfter).toBe(turn - 1);
    // A page a few turns behind gets just those.
    const behind = ((await t.ask("p1", { type: "hello", have: turn - 4 })) as { start: RoomStart }).start;
    expect(behind.chronicle!.map((r) => r.turn)).toEqual([turn - 3, turn - 2, turn - 1]);
    // Sizes: the trimmed hello is the turn (the view, the last replay and the view before it), not the game so far.
    const bytes = (x: unknown) => JSON.stringify(x).length;
    const turnItself = bytes(fullStart.view) + bytes(fullStart.replay ?? null);
    expect(bytes(trimmed)).toBeLessThan(turnItself * 1.25 + 8_000);
    expect(bytes(trimmed)).toBeLessThan(bytes(full));
    console.log(`hello on Rootholm at turn ${turn}: ${(bytes(full) / 1024).toFixed(1)} KB whole, ${(bytes(trimmed) / 1024).toFixed(1)} KB trimmed (the turn itself ${(turnItself / 1024).toFixed(1)} KB)`);
  }, 120_000);
});

describe("nobody left playing (session 27)", () => {
  it("everyone resigns: the Marshals play on by themselves, a turn after each replay and the 10 s, until someone wins", async () => {
    const t = testRoom();
    await t.room.createTable({ gameId: "empty", code: "3mptyt4ble", settings: { ...settings, bots: 2, botLevel: "captain" }, seed: "empty-table", host: hostSeat(NATE, 0) });
    await t.act(KIT, { do: "sit", house: 3, leadersRun: true });
    await t.act(NATE, { do: "start" });
    expect(await t.room.resignUser(NATE.user)).toBe(true);
    expect(await t.room.resignUser(KIT.user)).toBe(true);
    const g = t.room.table!;
    // The last person resigning resolves the turn at once (nobody to wait for).
    expect(g.turn).toBe(2);
    // No planning window now: the deadline is when the window would open.
    expect(t.alarm()).not.toBeNull();
    for (let i = 0; i < 400 && !g.over; i++) {
      t.advance(Math.max(0, t.alarm()! - t.now()));
      await t.tick();
    }
    expect(g.over).toBe(true);
    expect(t.listed()).toMatchObject({ status: "over" });
    expect(t.alarm()).toBeNull();
  }, 120_000);
});

describe("a finished game's turns, watched again (session 27, Part 4)", () => {
  it("any turn comes back exactly as this seat saw it then (its view before, its events), and only once the game is over", async () => {
    const t = testRoom();
    await t.room.create({ gameId: "rewatch", settings: { ...settings, botLevel: "captain" }, people: [{ id: "p1", name: "Nate", house: 0, leadersRun: false }], seed: "rewatch-seed" });
    let s = await t.hello("p1");
    const seen = new Map<number, { before: unknown; events: unknown }>();
    expect(await t.ask("p1", { type: "turnReplay", turn: 1 })).toMatchObject({ ok: false });
    for (let i = 0; i < 80 && !s.view.players.find((p) => p.id === "p1")!.eliminatedTurn && !s.view.winner; i++) {
      const before = s.view;
      const u = updateOf(await t.ask("p1", { type: "lockIn", orders: [], turn: s.view.turn }));
      seen.set(u.report!.turn, { before, events: u.report!.events });
      s = await t.hello("p1");
    }
    if (!s.view.winner) await t.ask("p1", { type: "finish" });
    expect(t.room.table!.over).toBe(true);
    for (const turn of [1, 2, Math.max(...seen.keys())]) {
      const m = await t.ask("p1", { type: "turnReplay", turn });
      if (!m || !("turnReplay" in m)) throw new Error(JSON.stringify(m));
      expect(m.turnReplay.report.turn).toBe(turn);
      expect(m.turnReplay.report.events).toEqual(seen.get(turn)!.events);
      expect(m.turnReplay.before).toEqual(seen.get(turn)!.before);
    }
    expect(await t.ask("p1", { type: "turnReplay", turn: 999 })).toMatchObject({ ok: false });
  }, 120_000);
});

describe("a room that wakes (session 27, found on the preview)", () => {
  it("a game that ended wakes over (its last turn is saved), and a lost alarm is set again so a passed deadline still resolves", async () => {
    const store = memoryRoomStore();
    const t = testRoom(store);
    await t.room.create({ gameId: "wake", settings: { ...settings, bots: 2, botLevel: "captain" }, people: [{ id: "p1", name: "Nate", house: 0, leadersRun: false }], seed: "wake-seed" });
    // The clock runs out on turn 1 while the room is asleep, and its alarm was lost: the next wake sets it again.
    const deadline = t.room.table!.nextDeadline!;
    const woke = testRoom(store, deadline + 60_000);
    await woke.hello("p1");
    expect(woke.alarm()).toBe(deadline);
    await woke.tick();
    expect(woke.room.table!.turn).toBe(2);
    // Play it out (Nate resigns: the bots finish it), then wake a fresh room: the game is over in its storage too.
    await woke.room.resignUser("nobody", "p1");
    for (let i = 0; i < 400 && !woke.room.table!.over; i++) {
      woke.advance(Math.max(0, woke.alarm()! - woke.now()));
      await woke.tick();
    }
    expect(woke.room.table!.over).toBe(true);
    const after = testRoom(store, woke.now() + 1000);
    const s = await after.hello("p1");
    expect(s.view.winner).not.toBeNull();
    expect(after.alarm()).toBeNull();
  }, 120_000);
});
