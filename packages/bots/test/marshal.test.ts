import { defaultRules, marshalData, type PersonalityId } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { createGame, replayFor, resolveTurn, viewFor, type GameContext, type GameState, type Order, type OrdersByPlayer, type PlayerView, type ReplayEvent } from "@conquerra/engine";
import { describe, expect, it } from "vitest";
import {
  agreedIn,
  dealPersonalities,
  estimateLand,
  freshMemory,
  judgeBy,
  makeMarshalBot,
  negotiate,
  personality,
  PERSONALITY_IDS,
  planMarshal,
  readRunaway,
  withAgreed,
  type MarshalBot,
  type MarshalMemory,
} from "../src";
import { scenario } from "./scenario";

const ember: GameContext = { map: maps.embervale!, rules: defaultRules };
const J = marshalData.judgement;

/** Play a game of Marshals (one bot per seat), with diplomacy, recording every order and what each seat watched. */
function play(seed: string, bots: MarshalBot[], turns = 40) {
  let s = createGame(ember, { gameId: seed, seed, players: bots.map((_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}` })) });
  let last = new Map<string, ReplayEvent[]>();
  const transcript: string[] = [];
  const snapshots: { s: GameState; last: Map<string, ReplayEvent[]> }[] = [];
  for (let i = 0; i < turns && !s.winner; i++) {
    snapshots.push({ s, last });
    const living = s.players.filter((p) => p.eliminatedTurn === null);
    const views = new Map(living.map((p) => [p.id, viewFor(ember, s, p.id)]));
    const bot = (id: string) => bots[s.players.findIndex((p) => p.id === id)]!;
    const talk = negotiate(ember, living.map((p) => ({ id: p.id, level: bot(p.id).diplomat })), (id) => views.get(id)!, (id) => last.get(id), null);
    const agreed = agreedIn(talk.orders);
    const orders: OrdersByPlayer = {};
    for (const p of living) orders[p.id] = [...(talk.orders[p.id] ?? []), ...bot(p.id).plan(ember, withAgreed(views.get(p.id)!, agreed), last.get(p.id))];
    transcript.push(JSON.stringify(orders));
    const before = s;
    const r = resolveTurn(ember, s, orders);
    s = r.state;
    last = new Map(s.players.map((p) => [p.id, replayFor(ember, before, r, p.id)]));
  }
  return { s, transcript: transcript.join("\n"), snapshots };
}

const fourOf = (ids: readonly PersonalityId[] = ["conqueror", "schemer", "turtle", "opportunist"]) => ids.map((p) => makeMarshalBot(p));

describe("the Marshal: fair play", () => {
  it("is deterministic: the same seed gives the same game, deals and all", () => {
    expect(play("m-det", fourOf()).transcript).toBe(play("m-det", fourOf()).transcript);
  });

  it("no pooled sight: one Marshal bot playing every seat plans exactly as a separate bot for each seat", () => {
    const one = makeMarshalBot("schemer");
    expect(play("m-pool", [one, one, one, one], 20).transcript).toBe(play("m-pool", fourOf(["schemer", "schemer", "schemer", "schemer"]), 20).transcript);
  });

  it("never reads beyond its view: hidden changes, and a view with everything it shouldn't know removed, give the same orders and answers", () => {
    const { snapshots } = play("m-fog", fourOf(), 12);
    let checked = 0;
    for (const { s, last } of snapshots.slice(3)) {
      for (const p of s.players.filter((x) => x.eliminatedTurn === null)) {
        const view = viewFor(ember, s, p.id);
        // Everything p can't see changed: armies in the fog, everyone else's gold, spies and memories.
        const twisted: GameState = JSON.parse(JSON.stringify(s));
        for (const t of Object.keys(view.territories)) if (view.territories[t]!.detail === "fogged") twisted.territories[t]!.troops += 17;
        for (const q of twisted.players) if (q.id !== p.id) q.gold = 999;
        twisted.spies = twisted.spies.filter((x) => x.owner === p.id);
        for (const q of twisted.players) if (q.id !== p.id) twisted.intel[q.id] = {};
        const tview = viewFor(ember, twisted, p.id);
        expect(tview).toEqual(view);
        // The view with only what a person in that seat could know: no game record, the public player facts only.
        const bare = knowable(view);
        const memory: MarshalMemory = freshMemory();
        const plan = (v: PlayerView) => planMarshal({ ctx: ember, view: v, personality: personality("schemer"), judgement: J, memory, lastTurn: last.get(p.id) }).orders;
        expect(plan(tview)).toEqual(plan(view));
        expect(plan(bare)).toEqual(plan(view));
        const bot = makeMarshalBot("turtle");
        const offers = (v: PlayerView) => makeMarshalBot("turtle").diplomat.propose(ember, v, last.get(p.id));
        expect(offers(bare)).toEqual(offers(view));
        const other = s.players.find((q) => q.id !== p.id && q.eliminatedTurn === null)!;
        const offer = { id: "o1", from: other.id, to: p.id, terms: { kind: "truce" as const, scope: { kind: "all" as const }, turns: 3 }, bond: "handshake" as const };
        expect(judgeBy(ember, bot.diplomat, bare, offer, last.get(p.id))).toEqual(judgeBy(ember, makeMarshalBot("turtle").diplomat, view, offer, last.get(p.id)));
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(20);
  });
});

/** A view with only what a person in that seat could know: no game record, players' public facts, and nothing else. */
function knowable(view: PlayerView): PlayerView {
  const v = JSON.parse(JSON.stringify(view)) as PlayerView;
  delete v.history;
  delete v.stats;
  v.seedCommitment = "";
  v.players = v.players.map(({ id, name, eliminatedTurn, eliminatedBy, spoils, oathbreaker, house }) => ({ id, name, eliminatedTurn, eliminatedBy, spoils, oathbreaker, house }));
  return v;
}

describe("the Marshal's planner: a scope and a purse (for session 18's leaders)", () => {
  const { snapshots } = play("m-scope", fourOf(), 8);
  const { s, last } = snapshots[6]!;
  const view = viewFor(ember, s, "p1");
  const req = { ctx: ember, view, personality: personality("conqueror"), judgement: J, memory: freshMemory(), lastTurn: last.get("p1") };
  const realm = planMarshal(req).orders;
  const ids = (os: Order[]) => os.map((o) => o.id);

  it("the realm's building is its spending, and nothing else", () => {
    const build = planMarshal({ ...req, scope: { kind: "build" } }).orders;
    expect(build.length).toBeGreaterThan(0);
    expect(build.every((o) => ["recruit", "build", "invest", "hire", "hireSpy", "spy", "spoils"].includes(o.kind))).toBe(true);
    expect(ids(realm)).toEqual(expect.arrayContaining(ids(build)));
  });

  it("one army: only orders that army sets out with (its attack and the chain on from it)", () => {
    const first = realm.find((o) => o.kind === "move")!;
    const at = (first as Extract<Order, { kind: "move" }>).from;
    const mine = planMarshal({ ...req, scope: { kind: "army", at } }).orders;
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.some((o) => o.kind === "move" && o.from === at)).toBe(true);
    expect(mine.every((o) => o.kind === "move" || o.kind === "retreat")).toBe(true);
  });

  it("a purse limits what it spends", () => {
    const spent = (os: Order[]) => os.filter((o) => o.kind === "recruit").reduce((a, o) => a + (o.kind === "recruit" && typeof o.count === "number" ? o.count : 0), 0);
    const small = planMarshal({ ...req, purse: 4, scope: { kind: "build" } }).orders;
    expect(spent(small)).toBeLessThanOrEqual(2);
    expect(planMarshal({ ...req, purse: 0, scope: { kind: "build" } }).orders.filter((o) => o.kind !== "spoils" && o.kind !== "spy")).toEqual([]);
  });
});

describe("the Marshal's personalities", () => {
  it("are dealt from the game's seed: no two the same until all six are used", () => {
    const seats = Array.from({ length: 8 }, (_, i) => `b${i}`);
    const d = dealPersonalities("seed-1", seats);
    expect(new Set(seats.slice(0, 6).map((s) => d[s])).size).toBe(6);
    expect(dealPersonalities("seed-1", seats)).toEqual(d);
    expect(dealPersonalities("seed-2", seats)).not.toEqual(d);
    expect(PERSONALITY_IDS).toHaveLength(6);
  });

  it("answer in their own voice when their style decides", () => {
    // Four players (not yet the endgame), and p2 big enough not to be a rival worth finishing off.
    const sc = scenario({ line: "abcdefghijkl", layout: { a: ["p1", 6], b: ["p1", 6], c: ["p2", 6], d: ["p2", 6], e: ["p2", 6], f: ["p2", 6], g: ["p3", 6], h: ["p3", 6], i: ["p3", 6], j: ["p4", 6], k: ["p4", 6], l: ["p4", 6] }, memory: { d: ["p2", 6], e: ["p2", 6], f: ["p2", 6], g: ["p3", 6], h: ["p3", 6], i: ["p3", 6], j: ["p4", 6], k: ["p4", 6], l: ["p4", 6] }, caps: ["a", "f", "i", "l"], gold: 20 });
    const offer = { id: "x1", from: "p2", to: "p1", terms: { kind: "truce" as const, scope: { kind: "all" as const }, turns: 3 }, bond: "handshake" as const };
    const turtle = judgeBy(sc.ctx, makeMarshalBot("turtle").diplomat, viewFor(sc.ctx, sc.s, "p1"), offer);
    expect(turtle).toEqual({ accept: true, reason: "Peace suits me; my walls aren't finished." });
    const blitzer = judgeBy(sc.ctx, makeMarshalBot("blitzer").diplomat, viewFor(sc.ctx, sc.s, "p1"), offer);
    expect(blitzer.accept).toBe(false);
  });
});

describe("the Marshal's reading of the board", () => {
  it("gives land it can't see to whoever holds the nearest land it knows of, and a knocked-out player's land to who knocked them out", () => {
    // a b | c d e f g h: p1 holds a, b; it remembers p2 at d and p3 at g (p3 knocked out by p2... see below).
    const sc = scenario({ line: "abcdefgh", layout: { a: ["p1", 5], b: ["p1", 5], c: [null, 1], d: ["p2", 5], e: ["p2", 5], f: ["p2", 5], g: ["p3", 3], h: ["p3", 3] }, memory: { d: ["p2", 5], g: ["p3", 3] }, caps: ["a", "e", "h"], players: 3 });
    const view = viewFor(sc.ctx, sc.s, "p1");
    const a = estimateLand(sc.ctx, view, J);
    // It sees c (neutral) and remembers d (p2) and g (p3): e, f go to p2 (nearer d) and h to p3, scaled by how much
    // of the land it can see is held (c: none of it), so only what it knows counts... with half of the unseen as a floor.
    expect(a.known.get("p2")).toBe(1);
    expect(a.est.get("p2")!).toBeGreaterThanOrEqual(a.known.get("p2")!);
    sc.s.players[2]!.eliminatedTurn = 1;
    sc.s.players[2]!.eliminatedBy = "p2";
    const b = estimateLand(sc.ctx, viewFor(sc.ctx, sc.s, "p1"), J);
    expect(b.est.has("p3")).toBe(false);
    expect(b.known.get("p2")).toBe(2);
  });

  it("names a runaway by size (a lower bar at a big table), by pace, and keeps naming it for a few turns", () => {
    const mem = freshMemory();
    const est = new Map([["p2", 30], ["p3", 14], ["p4", 12]]);
    // 120 territories: 30 is a quarter, and 2.1 times the next: a runaway at 6 players (bigLead 1.5), and at 4 (lead 1.75).
    expect(readRunaway(J.runaway, est, 12, 120, 6, 4, new Map(), mem, 10)).toEqual({ runaway: "p2", why: "size" });
    // 24 of 120 at 6 players: 20%, 1.7 times the next: the big-table bar names it; at 4 players it doesn't.
    const est2 = new Map([["p2", 24], ["p3", 14], ["p4", 12]]);
    expect(readRunaway(J.runaway, est2, 12, 120, 6, 4, new Map(), mem, 10).runaway).toBe("p2");
    expect(readRunaway(J.runaway, est2, 12, 120, 4, 4, new Map(), mem, 10).runaway).toBeNull();
    // Pace: p3 took 9 territories lately, the next fastest 2, and already holds 20 of 120.
    const est3 = new Map([["p2", 22], ["p3", 20], ["p4", 12]]);
    expect(readRunaway(J.runaway, est3, 15, 120, 4, 4, new Map([["p3", 9], ["p2", 2]]), mem, 10)).toEqual({ runaway: "p3", why: "pace" });
    // Still: named two turns ago, still the biggest.
    expect(readRunaway(J.runaway, est3, 15, 120, 4, 4, new Map(), { ...mem, runaway: { player: "p2", since: 7, last: 8, named: 9 } }, 10)).toEqual({ runaway: "p2", why: "still" });
    expect(readRunaway(J.runaway, est3, 15, 120, 4, 4, new Map(), { ...mem, runaway: { player: "p2", since: 2, last: 4, named: 5 } }, 10).runaway).toBeNull();
  });
});
