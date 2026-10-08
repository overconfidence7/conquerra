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
    // 28 of 120 at 6 players: 23%, 2 times the next: the big-table bar names it; at 4 players it doesn't.
    const est2 = new Map([["p2", 28], ["p3", 14], ["p4", 12]]);
    expect(readRunaway(J.runaway, est2, 12, 120, 6, 4, new Map(), mem, 10).runaway).toBe("p2");
    expect(readRunaway(J.runaway, est2, 12, 120, 4, 4, new Map(), mem, 10).runaway).toBeNull();
    // Pace: p3 took 9 territories lately, the next fastest 2, and already holds 22 of 120.
    const est3 = new Map([["p2", 24], ["p3", 22], ["p4", 12]]);
    expect(readRunaway(J.runaway, est3, 15, 120, 4, 4, new Map([["p3", 9], ["p2", 2]]), mem, 10)).toEqual({ runaway: "p3", why: "pace" });
    // Still: named two turns ago, still the biggest.
    expect(readRunaway(J.runaway, est3, 15, 120, 4, 4, new Map(), { ...mem, runaway: { player: "p2", since: 7, last: 8, named: 9 } }, 10)).toEqual({ runaway: "p2", why: "still" });
    expect(readRunaway(J.runaway, est3, 15, 120, 4, 4, new Map(), { ...mem, runaway: { player: "p2", since: 2, last: 4, named: 5 } }, 10).runaway).toBeNull();
  });
});

describe("the Marshal against a runaway (Part 3)", () => {
  it("proposes a joint war against the runaway first, for as long as a war can run, and every Marshal says yes", () => {
    // p2 holds most of a 12-territory line; p1 and p3 sit either side of it.
    const sc = scenario({
      line: "abcdefghijkl",
      layout: { a: ["p1", 8], b: ["p1", 8], c: ["p2", 4], d: ["p2", 4], e: ["p2", 4], f: ["p2", 4], g: ["p2", 4], h: ["p2", 4], i: ["p2", 4], j: ["p3", 8], k: ["p3", 8], l: ["p4", 8] },
      memory: { d: ["p2", 4], e: ["p2", 4], f: ["p2", 4], g: ["p2", 4], h: ["p2", 4], i: ["p2", 4], j: ["p3", 8], k: ["p3", 8], l: ["p4", 8] },
      caps: ["a", "e", "k", "l"],
      gold: 20,
    });
    sc.s.turn = 5;
    const view = viewFor(sc.ctx, sc.s, "p1");
    const offers = makeMarshalBot("merchant").diplomat.propose(sc.ctx, view);
    expect(offers[0]).toMatchObject({ to: "p3", terms: { kind: "war", target: "p2", turns: defaultRules.diplomacy.war.maxTurns } });
    for (const p of PERSONALITY_IDS) {
      const a = judgeBy(sc.ctx, makeMarshalBot(p).diplomat, viewFor(sc.ctx, sc.s, "p3"), { ...offers[0]!, to: "p3" });
      expect(a.accept, p).toBe(true);
    }
  });
});


describe("the Marshal's queue (session 19)", () => {
  it("queues troops first, then its armies' moves, then everything else it buys (each order takes a round, so rivals would move first; session 20: a strike that's ready now goes before all of it)", () => {
    const { snapshots } = play("m-queue", fourOf(["turtle", "merchant", "schemer", "conqueror"]), 14);
    let mixed = 0;
    for (const { s, last } of snapshots.slice(2)) {
      for (const p of s.players.filter((x) => x.eliminatedTurn === null)) {
        for (const id of ["turtle", "merchant"] as const) {
          const orders = planMarshal({ ctx: ember, view: viewFor(ember, s, p.id), personality: personality(id), judgement: J, memory: freshMemory(), lastTurn: last.get(p.id) }).orders.filter((o) => o.kind !== "break");
          const rank = (o: Order) => (o.kind === "spoils" || o.kind === "recruit" ? 0 : o.kind === "move" || o.kind === "retreat" || o.kind === "advance" ? 1 : 2);
          // (Session 20: strikes ready before anyone can move, finishing a rival off, go first of all.)
          const lead = orders.findIndex((o) => o.kind !== "move");
          const ranks = orders.slice(Math.max(0, lead)).map(rank);
          expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
          if (ranks.includes(1) && ranks.includes(2)) mixed++;
        }
      }
    }
    // Plans with both moves and purchases, all in that order.
    expect(mixed).toBeGreaterThan(5);
  });
});

describe("the Marshal's capital guard (session 19)", () => {
  const sentFrom = (orders: Order[], t: string, troops: number) => orders.reduce((a, o) => a + (o.kind === "move" && o.from === t ? (o.troops === "all" ? troops : typeof o.troops === "number" ? o.troops : 0) : 0), 0);
  const firstTurn = (ctx: GameContext, players: number) => {
    const s = createGame(ctx, { gameId: "guard", seed: "guard", players: Array.from({ length: players }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}` })) });
    const view = viewFor(ctx, s, "p1");
    const orders = planMarshal({ ctx, view, personality: personality("blitzer"), judgement: J, memory: freshMemory() }).orders;
    const recruited = orders.reduce((a, o) => a + (o.kind === "recruit" && o.territory === view.me.capital && typeof o.count === "number" ? o.count : 0), 0);
    const stack = (view.territories[view.me.capital] as { troops: number }).troops + recruited;
    return { stack, sent: sentFrom(orders, view.me.capital, stack) };
  };

  it("even the Blitzer keeps half its capital's stack home in the first turns (Embervale, 4 players: capitals 3 steps apart)", () => {
    const { stack, sent } = firstTurn(ember, 4);
    expect(sent).toBeGreaterThan(0);
    expect(stack - sent).toBeGreaterThanOrEqual(Math.ceil(stack * J.capitalGuard!.opening));
  });

  it("so it does on a roomy table (Wyrmland, 6 players); limited to crowded tables, there it wouldn't", () => {
    const wyrm = { map: maps.wyrmland!, rules: defaultRules };
    const { stack, sent } = firstTurn(wyrm, 6);
    expect(stack - sent).toBeGreaterThanOrEqual(Math.ceil(stack * J.capitalGuard!.opening));
    const crowdedOnly = { ...J, capitalGuard: { ...J.capitalGuard!, crowded: 12 } };
    const s = createGame(wyrm, { gameId: "guard", seed: "guard", players: Array.from({ length: 6 }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}` })) });
    const view = viewFor(wyrm, s, "p1");
    const orders = planMarshal({ ctx: wyrm, view, personality: personality("blitzer"), judgement: crowdedOnly, memory: freshMemory() }).orders;
    const all = (view.territories[view.me.capital] as { troops: number }).troops + orders.reduce((a, o) => a + (o.kind === "recruit" && o.territory === view.me.capital && typeof o.count === "number" ? o.count : 0), 0);
    expect(all - sentFrom(orders, view.me.capital, all)).toBeLessThan(Math.ceil(all * J.capitalGuard!.opening));
  });

  it("keeps half of a rival army it knows of within reach of its capital (3 steps)", () => {
    const ctx = ember;
    const s = createGame(ctx, { gameId: "guard2", seed: "guard2", players: ["p1", "p2", "p3", "p4"].map((id) => ({ id, name: id })) });
    s.turn = 8;
    const view0 = viewFor(ctx, s, "p1");
    const cap = view0.me.capital;
    // A rival army of 24 two steps from the capital, in land p1 can see (it holds the land between).
    const idx = ctx.map.borders;
    const nbs = (t: string) => idx.flatMap((b) => (b.a === t ? [b.b] : b.b === t ? [b.a] : []));
    const mid = nbs(cap).find((t) => !Object.values(s.players).some((p) => p.capital === t))!;
    const far = nbs(mid).find((t) => t !== cap && !s.players.some((p) => p.capital === t))!;
    s.territories[mid] = { owner: "p1", troops: 2, specialists: [], building: null, construction: null, culture: 0 };
    s.territories[far] = { owner: "p2", troops: 24, specialists: [], building: null, construction: null, culture: 0 };
    s.territories[cap]!.troops = 30;
    s.players[0]!.gold = 0;
    const view = viewFor(ctx, s, "p1");
    const orders = planMarshal({ ctx, view, personality: personality("blitzer"), judgement: J, memory: freshMemory() }).orders;
    expect(30 - sentFrom(orders, cap, 30)).toBeGreaterThanOrEqual(Math.ceil(24 * J.capitalGuard!.reach));
  });
});
