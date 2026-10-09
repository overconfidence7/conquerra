import { describe, expect, it } from "vitest";
import { defaultRules, MapDef, type Rules } from "@conquerra/content";
import {
  allWalls,
  createGame,
  makeSave,
  previewAttack,
  readSave,
  replayFor,
  resolveTurn,
  shareWallLosses,
  stateFingerprint,
  TurnVision,
  viewFor,
  type GameContext,
  type GameState,
  type Order,
  type StepEvent,
} from "../src";
import { mv } from "./helpers";

/**
 * Walls (session 20b, Nate's idea; design additions §16). A line of six, with a seventh off b:
 *   a - b - c - d - e - f
 *       |
 *       x
 * p1's capital is a, p2's is f.
 */
const mapWith = (sea?: [string, string]) =>
  MapDef.parse({
    id: "wall-line",
    name: "Wall line",
    minPlayers: 2,
    maxPlayers: 2,
    recommendedPlayers: { min: 2, max: 2 },
    territories: ["a", "b", "c", "d", "e", "f", "x"].map((id, i) => ({ id, name: id.toUpperCase(), province: `p${i}`, terrain: "plains", x: i * 100, y: id === "x" ? 100 : 0 })),
    provinces: [0, 1, 2, 3, 4, 5, 6].map((i) => ({ id: `p${i}`, name: `Province ${i}`, bonus: 1 })),
    borders: ["ab", "bc", "cd", "de", "ef", "bx"].map(([a, b]) => ({ a: a!, b: b!, ...(sea && ((sea[0] === a && sea[1] === b) || (sea[0] === b && sea[1] === a)) ? { type: "sea" as const } : {}) })),
    capitalSlots: ["a", "f"],
  });

const rulesWith = (walls: Partial<NonNullable<Rules["walls"]>> = {}): Rules => ({ ...defaultRules, walls: { ...defaultRules.walls!, ...walls } });
const ctxOf = (walls: Partial<NonNullable<Rules["walls"]>> = {}, map = mapWith()): GameContext => ({ map, rules: rulesWith(walls) });
const ctx = ctxOf();

type Spot = [owner: string | null, troops: number, opts?: { wall?: boolean; culture?: number; fort?: boolean; siege?: boolean }];

/** A board: unlisted land is neutral with 1 troop. `wall`: culture 5, a fort, and walled (as at the end of a turn). */
function game(layout: Record<string, Spot>, c: GameContext = ctx): GameState {
  const s = createGame(c, { gameId: "walls", seed: "walls", players: [{ id: "p1", name: "One" }, { id: "p2", name: "Two" }], settings: { luck: 0, fate: false, spies: false, diplomacy: false } });
  let n = 1;
  for (const t of Object.keys(s.territories)) s.territories[t] = { owner: null, troops: 1, specialists: [], building: null, construction: null, culture: 0 };
  for (const [t, [owner, troops, o = {}]] of Object.entries(layout)) {
    const wall = !!o.wall;
    s.territories[t] = {
      owner,
      troops,
      specialists: o.siege ? [{ id: `s${n++}`, type: "siege" }] : [],
      building: wall || o.fort ? "fort" : null,
      construction: null,
      culture: wall ? 5 : (o.culture ?? 0),
      ...(wall ? { walled: true } : {}),
    };
  }
  for (const p of s.players) {
    p.capital = p.id === "p1" ? "a" : "f";
    p.leader = { alive: true, territory: p.capital };
  }
  s.intel = { p1: {}, p2: {} };
  return s;
}

const battles = (ev: StepEvent[]) => ev.filter((e): e is Extract<StepEvent, { type: "battle" }> => e.type === "battle");
const walledNow = (s: GameState) => Object.keys(s.territories).filter((t) => s.territories[t]!.walled).sort();

/** The replay's own board after the turn (from the start and the event log) matches the real game. */
function replayMatches(c: GameContext, before: GameState, r: { state: GameState; events: StepEvent[] }) {
  const tv = new TurnVision(c, before, r.events, []);
  for (const e of r.events) tv.step(e);
  for (const t of Object.keys(before.territories)) {
    const a = tv.board.territories[t]!, b = r.state.territories[t]!;
    expect({ t, owner: a.owner, troops: a.troops, walled: !!a.walled }).toEqual({ t, owner: b.owner, troops: b.troops, walled: !!b.walled });
  }
}

describe("walls: when a territory is walled", () => {
  it("culture 5 and a fort make it walled at the end of the turn the last piece is finished, and not before", () => {
    // a: a fort, culture 4 (the last level bought this turn); b: already walled; c: culture 5, no fort.
    const s = game({ a: ["p1", 4, { culture: 4, fort: true }], b: ["p1", 4, { wall: true }], c: ["p1", 4, { culture: 5 }], d: ["p2", 30], f: ["p2", 1] });
    const invest: Order = { id: "i1", kind: "invest", territory: "a" };
    // p2 hits b in the same turn: a isn't walled yet, so it lends nothing (b's only wall neighbour).
    const r = resolveTurn(ctx, s, { p1: [invest], p2: [mv("d", "c", 3)] });
    expect(r.state.territories.a!.culture).toBe(5);
    expect(walledNow(r.state)).toEqual(["a", "b"]);
    expect(r.events.filter((e) => e.type === "walled")).toEqual([expect.objectContaining({ type: "walled", player: "p1", territories: ["a"] })]);
    // c (culture 5, no fort) isn't walled.
    expect(r.state.territories.c!.walled).toBeUndefined();
  });

  it("a fort that finishes at the end of the turn on culture-5 land: walled that same end of turn", () => {
    const s = game({ a: ["p1", 4, { culture: 5 }], f: ["p2", 1] });
    s.territories.a!.construction = { building: "fort", doneAtEndOfTurn: s.turn };
    const r = resolveTurn(ctx, s, {});
    expect(r.state.territories.a).toMatchObject({ building: "fort", walled: true });
  });

  it("no walls with walls switched off (or in an older game's rules)", () => {
    const off = ctxOf({ on: false });
    const s = game({ a: ["p1", 4, { culture: 5, fort: true }], b: ["p1", 4, { culture: 5, fort: true }], d: ["p2", 30], f: ["p2", 1] }, off);
    const r = resolveTurn(off, s, {});
    expect(walledNow(r.state)).toEqual([]);
    const { walls: _w, ...older } = defaultRules;
    const old: GameContext = { map: ctx.map, rules: older as Rules };
    expect(walledNow(resolveTurn(old, s, {}).state)).toEqual([]);
  });
});

describe("walls: joining and splitting", () => {
  it("touching walled territories of one House form one wall; land of another House, or across water, doesn't join", () => {
    const s = game({ a: ["p1", 4, { wall: true }], b: ["p1", 4, { wall: true }], c: ["p1", 4, { wall: true }], d: ["p2", 4, { wall: true }], e: ["p2", 4, { wall: true }], f: ["p2", 1] });
    expect(allWalls(ctx, s.territories)).toEqual([
      { owner: "p1", territories: ["a", "b", "c"] },
      { owner: "p2", territories: ["d", "e"] },
    ]);
    // Across water: b - c is a sea lane, so a-b and c are two walls.
    const sea = ctxOf({}, mapWith(["b", "c"]));
    expect(allWalls(sea, s.territories).filter((w) => w.owner === "p1")).toEqual([
      { owner: "p1", territories: ["a", "b"] },
      { owner: "p1", territories: ["c"] },
    ]);
  });

  it("the wall falls with the land: b captured splits a-b-c into a and c, and b leaves with its culture", () => {
    const s = game({ a: ["p1", 2, { wall: true }], b: ["p1", 2, { wall: true }], c: ["p1", 2, { wall: true }], x: ["p2", 60], f: ["p2", 1] });
    const r = resolveTurn(ctx, s, { p2: [mv("x", "b", 59)] });
    const fight = battles(r.events)[0]!;
    expect(fight.captured).toBe(true);
    expect(r.state.territories.b).toMatchObject({ owner: "p2", culture: 0, building: "fort" });
    expect(r.state.territories.b!.walled).toBeUndefined();
    expect(allWalls(ctx, r.state.territories)).toEqual([
      { owner: "p1", territories: ["a"] },
      { owner: "p1", territories: ["c"] },
    ]);
    replayMatches(ctx, s, r);
  });
});

describe("walls: shared defenders", () => {
  /** Nate's example: three walled territories with 4 troops each. */
  const nate = () => game({ a: ["p1", 4, { wall: true }], b: ["p1", 4, { wall: true }], c: ["p1", 4, { wall: true }], d: ["p2", 40], f: ["p2", 1] });

  it("Nate's example: three walled territories with 4 troops each, one attacked: the attacker faces 10", () => {
    const s = nate();
    const r = resolveTurn(ctx, s, { p2: [mv("d", "c", 30)] });
    const fight = battles(r.events)[0]!;
    expect(fight.defenders.troops).toBe(10);
    expect(fight.wall).toEqual({ lent: [{ territory: "b", troops: 3, lost: 3 }, { territory: "a", troops: 3, lost: 3 }] });
    // 30 against a walled 10 (a fort, culture 5): taken, and every lender is down to its last troop.
    expect(fight.captured).toBe(true);
    expect([r.state.territories.a!.troops, r.state.territories.b!.troops]).toEqual([1, 1]);
    replayMatches(ctx, s, r);
  });

  it("losses fall on the attacked territory first (down to 1), then on the lenders in proportion", () => {
    const s = nate();
    // 8 attack strength kills 8 at luck 0: c loses 3 (to its last troop), then 5 shared by b and a (3 and 2).
    const r = resolveTurn(ctx, s, { p2: [mv("d", "c", 8)] });
    const fight = battles(r.events)[0]!;
    expect(fight.captured).toBe(false);
    expect(fight.result.defenderLosses).toBe(8);
    expect(fight.wall!.lent).toEqual([{ territory: "b", troops: 3, lost: 3 }, { territory: "a", troops: 3, lost: 2 }]);
    expect(["a", "b", "c"].map((t) => r.state.territories[t]!.troops)).toEqual([2, 1, 1]);
    replayMatches(ctx, s, r);
  });

  it("shareWallLosses: the attacked land first, then in proportion, and its last troop only when everyone else is gone", () => {
    expect(shareWallLosses(4, [{ territory: "b", troops: 3 }, { territory: "a", troops: 3 }], 8)).toEqual({ own: 3, lent: [3, 2] });
    expect(shareWallLosses(4, [{ territory: "b", troops: 6 }, { territory: "a", troops: 2 }], 7)).toEqual({ own: 3, lent: [3, 1] });
    expect(shareWallLosses(4, [{ territory: "b", troops: 3 }], 2)).toEqual({ own: 2, lent: [0] });
    expect(shareWallLosses(4, [{ territory: "b", troops: 3 }], 7)).toEqual({ own: 4, lent: [3] });
    expect(shareWallLosses(1, [{ territory: "b", troops: 5 }], 5)).toEqual({ own: 0, lent: [5] });
  });

  it("with one battle a turn, each territory lends only to the first; by default (Nate), to every battle, its losses carried over", () => {
    const s = nate();
    const orders = { p2: [mv("d", "c", 8), mv("d", "c", 3)] };
    const r = resolveTurn(ctxOf({ oneBattleATurn: true }), s, orders);
    const [first, second] = battles(r.events);
    expect(first!.defenders.troops).toBe(10);
    // b and a already lent this turn: c (down to 1) stands alone.
    expect(second!.defenders.troops).toBe(1);
    expect(second!.wall).toBeUndefined();
    expect(second!.captured).toBe(true);
    const any = ctxOf({ oneBattleATurn: false });
    const r2 = resolveTurn(any, nate(), orders);
    // a still has 1 spare after the first battle (b has none): it lends again.
    expect(battles(r2.events)[1]!.defenders.troops).toBe(2);
    // Nate's decoy: a 1-troop attack first no longer uses up the wall's help; the main army faces the whole garrison,
    // less the one defender the decoy killed (the losses are real and carry over).
    const decoy = resolveTurn(any, nate(), { p2: [mv("d", "c", 1), mv("d", "c", 20)] });
    expect(battles(decoy.events).map((b) => b.defenders.troops)).toEqual([10, 9]);
  });

  it("only within reach steps along the wall; half the spare troops when the wall doesn't lend all", () => {
    const four = () => game({ a: ["p1", 5, { wall: true }], b: ["p1", 5, { wall: true }], c: ["p1", 5, { wall: true }], d: ["p1", 5, { wall: true }], e: ["p2", 40], f: ["p2", 1] });
    const hit = (c: GameContext) => battles(resolveTurn(c, four(), { p2: [mv("e", "d", 3)] }).events)[0]!;
    expect(hit(ctx).defenders.troops).toBe(5 + 4 + 4 + 4);
    expect(hit(ctxOf({ reach: 2 })).defenders.troops).toBe(5 + 4 + 4);
    expect(hit(ctxOf({ reach: null })).defenders.troops).toBe(17);
    expect(hit(ctxOf({ lendAll: false })).defenders.troops).toBe(5 + 2 + 2 + 2);
  });

  it("Siege cuts the fort's bonus, not the shared defenders; walls never attack (a walled army attacks with its own)", () => {
    const s = game({ a: ["p1", 4, { wall: true }], b: ["p1", 4, { wall: true }], c: ["p1", 4, { wall: true }], d: ["p2", 40, { siege: true }], f: ["p2", 1] });
    const r = resolveTurn(ctx, s, { p2: [mv("d", "c", 8)] });
    const fight = battles(r.events)[0]!;
    expect(fight.defenders.troops).toBe(10);
    expect(fight.defense.fort).toBe(false);
    const out = resolveTurn(ctx, game({ a: ["p1", 4, { wall: true }], b: ["p1", 4, { wall: true }], c: ["p1", 4, { wall: true }], d: ["p2", 1], f: ["p2", 1] }), { p1: [mv("c", "d", "all")] });
    expect(battles(out.events)[0]!.attackers.troops).toBe(3);
    expect(out.state.territories.b!.troops).toBe(4);
  });
});

describe("walls: what each player sees, and the odds preview", () => {
  it("anyone who sees part of a wall sees all of it and its shared garrison; nobody else sees anything of it", () => {
    // p2 at f sees e and f only: nothing of p1's wall.
    const far = game({ a: ["p1", 4, { wall: true }], b: ["p1", 4, { wall: true }], c: ["p1", 4, { wall: true }], f: ["p2", 5] });
    expect(viewFor(ctx, far, "p2").walls).toBeUndefined();
    // p2 at d sees c: the whole wall (a and b stay fogged otherwise), "Walled: 10 defend" on each.
    const near = game({ a: ["p1", 4, { wall: true }], b: ["p1", 4, { wall: true }], c: ["p1", 4, { wall: true }], d: ["p2", 5], f: ["p2", 5] });
    const v = viewFor(ctx, near, "p2");
    expect(v.territories.a!.detail).toBe("fogged");
    expect(v.walls).toEqual([{ owner: "p1", territories: ["a", "b", "c"], defend: { a: 10, b: 10, c: 10 }, with: { a: ["b", "c"], b: ["a", "c"], c: ["b", "a"] } }]);
    // Fog off: everyone sees every wall.
    near.settings.fog = false;
    expect(viewFor(ctx, near, "p2").walls).toHaveLength(1);
  });

  it("the odds preview uses the shared garrison and matches the engine exactly", () => {
    for (const troops of [3, 8, 14, 22, 30, 40]) {
      const s = game({ a: ["p1", 4, { wall: true }], b: ["p1", 4, { wall: true }], c: ["p1", 4, { wall: true }], d: ["p2", 41], f: ["p2", 1] });
      const p = previewAttack(ctx, viewFor(ctx, s, "p2"), { from: "d", to: "c", troops })!;
      const fight = battles(resolveTurn(ctx, s, { p2: [mv("d", "c", troops)] }).events)[0]!;
      expect(Math.round(p.defenseStrength * 100) / 100).toBe(fight.result.defenseStrength);
      expect(Math.round(p.expectedDefenderLosses * 100) / 100).toBe(fight.result.expectedDefenderLosses);
      expect(p.captureLikely).toBe(fight.captured);
    }
  });

  it("a remembered wall: land seen walled stays remembered walled in the fog", () => {
    const s = game({ a: ["p1", 4, { wall: true }], b: ["p1", 4, { wall: true }], c: ["p1", 4, { wall: true }], d: ["p2", 5], f: ["p2", 5] });
    // p2 sees c, then pulls back out of sight: c is remembered walled.
    const r = resolveTurn(ctx, s, { p2: [mv("d", "e", "all")] });
    // (d still sees c with 1 troop left; take d away too.)
    r.state.territories.d = { owner: null, troops: 1, specialists: [], building: null, construction: null, culture: 0 };
    const v = viewFor(ctx, r.state, "p2");
    expect(v.territories.c).toMatchObject({ detail: "fogged", lastSeen: { owner: "p1", building: "fort", walled: true } });
    expect(v.walls).toBeUndefined();
  });

  it("a battle at a wall shows in the replay with its lenders; a new wall shows to whoever sees it", () => {
    const s = game({ a: ["p1", 4, { wall: true }], b: ["p1", 4, { wall: true }], c: ["p1", 4, { culture: 4, fort: true }], d: ["p2", 40], f: ["p2", 1] });
    const r = resolveTurn(ctx, s, { p1: [{ id: "i", kind: "invest", territory: "c" }], p2: [mv("d", "b", 1)] });
    const p2 = replayFor(ctx, s, r, "p2");
    expect(p2.some((e) => e.type === "walled")).toBe(true);
    replayMatches(ctx, s, r);
  });
});

describe("walls: determinism and saves", () => {
  it("is deterministic: the same game and orders give exactly the same turn", () => {
    const s = game({ a: ["p1", 4, { wall: true }], b: ["p1", 4, { wall: true }], c: ["p1", 4, { wall: true }], d: ["p2", 40], f: ["p2", 1] });
    s.settings.luck = 0.3;
    const orders = { p2: [mv("d", "c", 12), mv("d", "c", 6)] };
    const one = resolveTurn(ctx, s, orders), two = resolveTurn(ctx, s, orders);
    expect(stateFingerprint(one.state)).toBe(stateFingerprint(two.state));
    expect(JSON.stringify(one.events)).toBe(JSON.stringify(two.events));
  });

  it("an older save (state version 11) loads: land with culture 5 and a fort is walled straight away", () => {
    const s = game({ a: ["p1", 4, { culture: 5, fort: true }], b: ["p1", 4, { culture: 5 }], f: ["p2", 1] });
    const save = makeSave(ctx, s, "p1", 0);
    const old = JSON.parse(JSON.stringify({ ...save, state: { ...save.state, version: 11 } }));
    const read = readSave(old);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.migrated).toBe(true);
    expect(read.save.state.version).toBe(12);
    expect(read.save.state.territories.a!.walled).toBe(true);
    expect("walled" in read.save.state.territories.b!).toBe(false);
  });
});
