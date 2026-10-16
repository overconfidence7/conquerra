import { defaultRules, type Rules } from "@conquerra/content";
import { MapDef } from "@conquerra/content/schemas";
import { describe, expect, it } from "vitest";
import {
  createGame,
  explainFizzle,
  indexMap,
  previewAttack,
  replayFor,
  resolveTurn,
  stateFingerprint,
  TurnVision,
  viewFor,
  type Deal,
  type GameContext,
  type GameState,
  type Order,
  type OrdersByPlayer,
  type StepEvent,
} from "../src";
import { mv } from "./helpers";

/**
 * Right of passage's moves (session 15). A line of seven territories:
 *   a - b - c - d - e - f - g
 * p1 holds a and c, p2 (the partner) b and d, p3 e, f and g. Capitals a, d, g.
 */
const map = MapDef.parse({
  id: "passage-line",
  name: "Passage line",
  minPlayers: 3,
  maxPlayers: 3,
  recommendedPlayers: { min: 3, max: 3 },
  territories: ["a", "b", "c", "d", "e", "f", "g"].map((id, i) => ({ id, name: id.toUpperCase(), province: `p${Math.floor(i / 2)}`, terrain: "plains", x: i * 100, y: 0 })),
  provinces: [0, 1, 2, 3].map((i) => ({ id: `p${i}`, name: `Province ${i}`, bonus: 1 })),
  borders: ["ab", "bc", "cd", "de", "ef", "fg"].map(([a, b]) => ({ a: a!, b: b! })),
  capitalSlots: ["a", "d", "g"],
});
const ctxWith = (f?: (r: Rules) => void): GameContext => {
  const rules = JSON.parse(JSON.stringify(defaultRules)) as Rules;
  f?.(rules);
  return { map, rules };
};
const ctx = ctxWith();
const idx = indexMap(map);

type Spot = [owner: string | null, troops: number];
function game(layout: Record<string, Spot> = {}): GameState {
  const s = createGame(ctx, { gameId: "pass", seed: "pass", players: ["p1", "p2", "p3"].map((id) => ({ id, name: id.toUpperCase() })), settings: { luck: 0, fate: false, spoils: false, fallen: false } });
  const base: Record<string, Spot> = { a: ["p1", 20], b: ["p2", 3], c: ["p1", 2], d: ["p2", 3], e: ["p3", 2], f: ["p3", 2], g: ["p3", 2] };
  for (const [t, [owner, troops]] of Object.entries({ ...base, ...layout })) s.territories[t] = { owner, troops, specialists: [], building: null, construction: null, culture: 0 };
  const caps: Record<string, string> = { p1: "a", p2: "d", p3: "g" };
  for (const p of s.players) {
    p.capital = caps[p.id]!;
    p.leader = { alive: true, territory: caps[p.id]! };
    p.gold = 50;
  }
  s.intel = Object.fromEntries(s.players.map((p) => [p.id, {}]));
  return s;
}
/** A passage deal in force: `a` may move through `b`'s land (both ways if mutual). */
function passage(s: GameState, a: string, b: string, opts: { mutual?: boolean; last?: number } = {}) {
  const d: Deal = { id: `d${s.nextDeal++}`, a, b, terms: { kind: "passage", turns: 4, mutual: !!opts.mutual }, bond: "handshake", start: s.turn, last: opts.last ?? s.turn + 3, size: 8 };
  s.deals.push(d);
  return d;
}
const of = <T extends StepEvent["type"]>(ev: readonly StepEvent[], type: T) => ev.filter((e): e is Extract<StepEvent, { type: T }> => e.type === type);
const through = (from: string, way: string[], to: string, troops: Extract<Order, { kind: "move" }>["troops"] = "all", extra: Partial<Order> = {}) => mv(from, to, troops, { through: way, ...extra } as Partial<Order>);

/** The replay's own board after the turn (from the start and the event log) matches the real game. */
function replayMatches(before: GameState, r: { state: GameState; events: StepEvent[] }) {
  const tv = new TurnVision(ctx, before, r.events, []);
  for (const e of r.events) tv.step(e);
  for (const t of idx.ids) expect({ t, owner: tv.board.territories[t]!.owner, troops: tv.board.territories[t]!.troops }).toEqual({ t, owner: r.state.territories[t]!.owner, troops: r.state.territories[t]!.troops });
}

describe("right of passage: moving through a partner's land", () => {
  it("with passage, an army marches through the partner's land and attacks beyond; it never stops there", () => {
    const s = game({ c: ["p2", 3] });
    passage(s, "p1", "p2");
    const r = resolveTurn(ctx, s, { p1: [through("a", ["b", "c", "d"], "e")] });
    const battle = of(r.events, "battle")[0]!;
    expect(battle).toMatchObject({ player: "p1", from: "a", to: "e", through: ["b", "c", "d"], defender: "p3", captured: true });
    expect(r.state.territories.e).toMatchObject({ owner: "p1", troops: 19 - battle.result.attackerLosses });
    // The partner's land is just as it was: nobody stopped there.
    for (const t of ["b", "c", "d"]) expect(r.state.territories[t]).toMatchObject({ owner: "p2", troops: 3 });
    replayMatches(s, r);
  });

  it("a move through it can end on your own land beyond", () => {
    const s = game({ e: ["p1", 1] });
    passage(s, "p1", "p2");
    const r = resolveTurn(ctx, s, { p1: [through("a", ["b"], "c", 5)] });
    expect(of(r.events, "moved")[0]).toMatchObject({ from: "a", to: "c", through: ["b"], army: { troops: 5 } });
    expect(r.state.territories.c!.troops).toBe(7);
    expect(r.state.territories.b).toMatchObject({ owner: "p2", troops: 3 });
  });

  it("it can't stop in the partner's land, or fight the partner whose land it crossed", () => {
    const s = game({ c: ["p2", 3] });
    passage(s, "p1", "p2");
    // Ending on the partner's own land: that's fighting them (an attack on the partner from inside its own land).
    const r = resolveTurn(ctx, s, { p1: [through("a", ["b"], "c")] });
    const f = of(r.events, "fizzled")[0]!;
    expect(f).toMatchObject({ reason: "passage", detail: { territory: "c", player: "p2" } });
    expect(explainFizzle(f, { place: (t) => t.toUpperCase(), player: (p) => p.toUpperCase() })).toContain("never stop or fight there");
    expect(r.state.territories.a!.troops).toBe(20);
  });

  it("without right of passage the move doesn't go; it only lets its proposer through, unless it's both ways", () => {
    const none = resolveTurn(ctx, game(), { p1: [through("a", ["b"], "c", 5)] });
    expect(of(none.events, "fizzled")[0]).toMatchObject({ reason: "passage", detail: { territory: "b" } });
    // p2 proposed passage through p1's land: p1 may not pass through p2's.
    const s = game();
    passage(s, "p2", "p1");
    expect(of(resolveTurn(ctx, s, { p1: [through("a", ["b"], "c", 5)] }).events, "fizzled")[0]).toMatchObject({ reason: "passage" });
    // Both ways: now it may.
    s.deals[0]!.terms = { kind: "passage", turns: 4, mutual: true };
    expect(of(resolveTurn(ctx, s, { p1: [through("a", ["b"], "c", 5)] }).events, "moved")[0]).toMatchObject({ to: "c", through: ["b"] });
  });

  it("a chain goes on from the land it took beyond (each hop in its own slot)", () => {
    const s = game({ c: ["p2", 3] });
    passage(s, "p1", "p2");
    const r = resolveTurn(ctx, s, { p1: [through("a", ["b", "c", "d"], "e"), mv("e", "f", "all")] });
    const battles = of(r.events, "battle");
    expect(battles.map((b) => [b.from, b.to, b.captured])).toEqual([
      ["a", "e", true],
      ["e", "f", true],
    ]);
    expect(battles[1]!.through).toBeUndefined();
  });

  it("land on the way that changed hands stops the army at your last territory before it", () => {
    // p1 holds c in the middle of the way; d has gone to p3.
    const s = game({ d: ["p3", 2] });
    passage(s, "p1", "p2");
    const r = resolveTurn(ctx, s, { p1: [through("a", ["b", "c", "d"], "e", 8)] });
    expect(of(r.events, "moved")[0]).toMatchObject({ from: "a", to: "c", through: ["b"], stopped: "e", army: { troops: 8 } });
    expect(of(r.events, "battle")).toEqual([]);
    expect(r.state.territories.c!.troops).toBe(10);
    replayMatches(s, r);
    // With none of your land before it, it doesn't go at all.
    const t = game({ b: ["p3", 2] });
    passage(t, "p1", "p2");
    const r2 = resolveTurn(ctx, t, { p1: [through("a", ["b", "c"], "d")] });
    expect(of(r2.events, "fizzled")[0]).toMatchObject({ reason: "passage", detail: { territory: "b" } });
    expect(r2.state.territories.a!.troops).toBe(20);
  });

  it("land that changes hands earlier in the same turn counts when the move comes up", () => {
    const s = game({ c: ["p2", 1], d: ["p2", 1], e: ["p3", 30] });
    passage(s, "p1", "p2");
    // p3 takes d first (Seize the Initiative), so p1's march through d stops at its own... nothing: b, c are p2's.
    const r = resolveTurn(ctx, s, { p3: [mv("e", "d", "all", { timing: "first" })], p1: [through("a", ["b", "c", "d"], "e")] });
    expect(r.state.territories.d!.owner).toBe("p3");
    expect(of(r.events, "fizzled").find((f) => f.player === "p1")).toMatchObject({ reason: "passage", detail: { territory: "d" } });
  });

  it("when the deal expires, the way closes", () => {
    const s = game();
    passage(s, "p1", "p2", { last: s.turn });
    const r1 = resolveTurn(ctx, s, { p1: [through("a", ["b"], "c", 2)] });
    expect(of(r1.events, "moved")[0]).toMatchObject({ through: ["b"] });
    expect(of(r1.events, "dealEnded")[0]).toMatchObject({ kind: "passage", why: "expired" });
    const r2 = resolveTurn(ctx, r1.state, { p1: [through("a", ["b"], "c", 2)] });
    expect(of(r2.events, "fizzled")[0]).toMatchObject({ reason: "passage" });
  });

  it("the way is checked: connected, no more than the limit, no storm-closed crossing", () => {
    const s = game({ c: ["p2", 3] });
    passage(s, "p1", "p2");
    expect(of(resolveTurn(ctx, s, { p1: [through("a", ["c"], "d")] }).events, "fizzled")[0]!.reason).toBe("notConnected");
    const short = ctxWith((r) => (r.diplomacy.passage.maxThrough = 2));
    expect(of(resolveTurn(short, s, { p1: [through("a", ["b", "c", "d"], "e")] }).events, "fizzled")[0]!.reason).toBe("invalid");
    const closed = structuredClone(s);
    closed.closures = [{ a: "c", b: "d", turn: closed.turn }];
    expect(of(resolveTurn(ctx, closed, { p1: [through("a", ["b", "c", "d"], "e")] }).events, "fizzled")[0]).toMatchObject({ reason: "storm", detail: { territory: "d" } });
  });

  it("a failed attack's survivors fall back to where they started, never into the partner's land", () => {
    const s = game({ c: ["p2", 3], e: ["p3", 40] });
    passage(s, "p1", "p2");
    const r = resolveTurn(ctx, s, { p1: [through("a", ["b", "c", "d"], "e", 10)] });
    const b = of(r.events, "battle")[0]!;
    expect(b.captured).toBe(false);
    expect(r.state.territories.a!.troops).toBe(10 + 10 - b.result.attackerLosses);
    for (const t of ["b", "c", "d"]) expect(r.state.territories[t]!.troops).toBe(3);
  });

  it("the odds use the last border crossed, the same in the preview and the engine", () => {
    const s = game({ c: ["p2", 3] });
    passage(s, "p1", "p2");
    const v = viewFor({ ...ctx }, { ...s, settings: { ...s.settings, fog: false } }, "p1");
    const p = previewAttack(ctx, v, { from: "a", to: "e", troops: 19, through: ["b", "c", "d"] })!;
    const r = resolveTurn(ctx, s, { p1: [through("a", ["b", "c", "d"], "e")] });
    expect(of(r.events, "battle")[0]!.result.attackStrength).toBeCloseTo(p.attackStrength, 2);
  });

  it("the partner watches the march through its land; everyone sees passage land where they can see it", () => {
    const s = game({ c: ["p2", 3] });
    passage(s, "p1", "p2");
    const r = resolveTurn(ctx, s, { p1: [through("a", ["b", "c", "d"], "e")] });
    // p2 holds the land it crossed: the battle is in p2's replay (it borders e anyway), with the way it came.
    expect(replayFor(ctx, s, r, "p2").find((e) => e.type === "battle")).toMatchObject({ through: ["b", "c", "d"] });
    const v1 = viewFor(ctx, s, "p1");
    const d = v1.deals.find((x) => x.kind === "passage")!;
    expect(d).toMatchObject({ mutual: false });
    // Only land p1 can see, and only the grantor's (p2's): b and d border p1's land; c doesn't show unless seen.
    for (const t of d.passage!) expect(v1.territories[t]!.detail).toBe("full");
    expect(d.passage!.every((t) => s.territories[t]!.owner === "p2")).toBe(true);
  });

  it("is deterministic: the same game and orders give the same result", () => {
    const run = () => {
      const s = game({ c: ["p2", 3] });
      s.settings.luck = 0.3;
      passage(s, "p1", "p2");
      const orders: OrdersByPlayer = { p1: [through("a", ["b", "c", "d"], "e", { share: 0.75 }), mv("e", "f", "all")], p3: [mv("g", "f", "all")] };
      return stateFingerprint(resolveTurn(ctx, s, orders).state);
    };
    expect(run()).toBe(run());
  });
});
