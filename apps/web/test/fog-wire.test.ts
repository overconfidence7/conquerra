import { replayFor, resolveTurn, viewFor, type GameState, type Order, type OrdersByPlayer, type PlayerId, type PlayerView, type TurnResult } from "@conquerra/engine";
import { recruitBot } from "@conquerra/bots";
import { describe, expect, it } from "vitest";
import type { PersonSeat } from "../src/host/localGame";
import type { HostUpdate, RoomMessage, RoomStart, TurnReport } from "../src/host/protocol";
import { chronicleOf } from "../src/logic/chronicleKeep";
import { nate, settings, testRoom } from "./roomHelpers";

/**
 * The fog on the wire (session 26, the plan §8): only `viewFor` leaves the room. A room with two people and two
 * Marshals plays a dozen turns (some locked in, some missed and run by the leaders, the clock running out); a
 * listener on each seat records every message. For every message to a seat:
 *
 *  - its view is exactly `viewFor(state, seat)`, its replay exactly the engine's fog-trimmed `replayFor` (worked out
 *    again here from the turn's recorded orders), and "your view before the turn" exactly `viewFor(before, seat)`;
 *  - everything else in it is that seat's own: its leaders' orders on its own land, its leaders' notes, offers made
 *    to it, its own queue, its own Chronicle;
 *  - no order the other person or a bot gave this game (their names for their orders) appears anywhere in it, and
 *    the seed never does until the game is over.
 *
 * Modelled on the engine's fog tests (packages/engine/test/fog.test.ts and replay-fog.test.ts), which prove `viewFor`
 * and `replayFor` themselves keep the fog.
 */

const kit: PersonSeat = { id: "p2", name: "Kit", house: 3, leaderName: "Lady Sorrel", leadersRun: true };
const SEATS = ["p1", "p2"] as const;
/** The fields a room message and its update may carry; anything else is a leak waiting to happen. */
const ENVELOPE = new Set(["id", "ok", "now", "start", "update", "pushed", "error", "orders", "plan", "answer"]);
const UPDATE = new Set(["playerId", "view", "report", "fastForwarded", "clock", "generalOrders", "leaderNotes", "offers", "seats", "fair", "before", "autoLocked", "queued", "people", "leadersBack"]);
const START = new Set([...UPDATE, "rules", "chronicle", "replay", "lockedIn", "gameId", "mapId", "mapVersion"]);
/** Diplomacy's own ids are public to its two sides (an offer to you names itself). */
const DIPLOMACY = /^(propose|answer|agreed|break)-|-t\d+-(o\d+|c-)/;

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

describe("the fog on the wire (session 26): only viewFor leaves the room", () => {
  it("two people and two Marshals, a dozen turns: every message to a seat is that seat's view and replay, and nothing of anyone else's", async () => {
    const t = testRoom();
    await t.room.create({ gameId: "fogwire", settings: { ...settings, bots: 2 }, people: [nate, kit], seed: "fog-on-the-wire" });
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
      expect(u.view).toEqual(viewFor(ctx, game().fullState, seat));
      // The replay: exactly the engine's fog-trimmed replay, worked out again from the turn's recorded orders.
      const report = u.report ?? ("replay" in u ? u.replay?.report : undefined) ?? null;
      if (report) {
        expect(last).not.toBeNull();
        expect(report.turn).toBe(last!.before.turn);
        expect(report.events).toEqual(replayFor(ctx, last!.before, last!.result, seat));
        rivalsSeen += report.events.filter((e) => "player" in e && e.player !== seat).length;
        if (report.ranByLeaders?.length) ranByLeaders++;
      }
      const before = u.before ?? ("replay" in u ? u.replay?.before : undefined);
      if (before) expect(before).toEqual(viewFor(ctx, last!.before, seat));
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
      // Your own commands and budgets coming back (session 27): orders for your own Leader and Steward only.
      for (const o of u.leadersBack ?? []) expect((o.kind === "instruct" || o.kind === "budget") && o.general === seat, `leadersBack ${o.id}`).toBe(true);
      if (u.queued) for (const o of u.queued.orders) expect(given.get(seat)?.has(o.id) || DIPLOMACY.test(o.id) || u.generalOrders.some((g) => g.id === o.id), `queued ${o.id}`).toBe(true);
      if ("chronicle" in u && u.chronicle) expect(u.chronicle).toEqual(chronicles.get(seat));
      if (u.fair) expect(u.fair.seed === undefined || game().over).toBe(true);
    };

    const checkInbox = (seat: PlayerId) => {
      const text = JSON.stringify(t.inbox(seat));
      // No other seat's order ever reaches this one, and never the seed while the game goes on.
      for (const id of others(seat)) expect(text.includes(JSON.stringify(id)), `${seat} was sent ${id}`).toBe(false);
      if (!game().over) expect(text).not.toContain(seed);
      for (const m of t.inbox(seat) as RoomMessage[]) {
        for (const k of Object.keys(m)) expect(ENVELOPE.has(k), `unexpected envelope field ${k}`).toBe(true);
        if ("start" in m) checkPayload(seat, m.start, START);
        if ("update" in m) checkPayload(seat, m.update, UPDATE);
        if ("pushed" in m) checkPayload(seat, m.pushed, UPDATE);
        if ("plan" in m) for (const key of Object.keys(m.plan.notes)) expect(m.plan.notes[key]).toBeDefined();
        checked++;
      }
      // What it was sent this turn goes into its Chronicle (as the page keeps it).
      for (const m of t.inbox(seat) as RoomMessage[]) {
        const r = "update" in m ? m.update.report : "pushed" in m ? m.pushed.report : null;
        if (r && !chronicles.get(seat)!.some((c) => c.turn === r.turn)) chronicles.get(seat)!.push(chronicleOf(r));
      }
    };

    // Turn 1: both pages say hello.
    for (const s of SEATS) await t.hello(s);
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
      for (const s of SEATS) await t.hello(s);
      for (const s of SEATS) checkInbox(s);
      turnsChecked++;
    }

    expect(turnsChecked).toBeGreaterThanOrEqual(8);
    expect(checked).toBeGreaterThan(50);
    // The test saw what it means to: rivals' events in the replays (with their order ids blanked), and missed turns.
    expect(rivalsSeen).toBeGreaterThan(0);
    expect(ranByLeaders).toBeGreaterThan(0);
    // Kit's secret orders were really given (so "never sent to Nate" means something).
    expect([...given.get("p2")!].filter((id) => id.startsWith("kit-secret")).length).toBeGreaterThan(5);
  }, 120_000);
});
