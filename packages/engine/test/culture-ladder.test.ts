import { MapDef, type SpecialistType, type Terrain } from "@conquerra/content";
import { describe, expect, it } from "vitest";
import { expectBattle, previewAttack, resolveTurn, viewFor, type GameContext, type Order } from "../src";
import { board, ctxWith, find, lineGame, lineMap, mv, player } from "./helpers";

/** The culture ladder (session 15): Rangers at culture 4 in a province, the Standard-bearer at 6. */
const hire = (territory: string, specialist: SpecialistType): Order => ({ id: `h-${specialist}`, kind: "hire", territory, specialist });

/** The line map with `c` on this terrain. */
function withTerrain(terrain: Terrain): GameContext {
  const map = MapDef.parse({ ...lineMap, territories: lineMap.territories.map((t) => (t.id === "c" ? { ...t, terrain } : t)) });
  return { ...ctxWith(), map };
}

const battle = (ctx: GameContext, attackers: SpecialistType[], terrain: Terrain) =>
  expectBattle(ctx.rules, { attackers: 20, attackerSpecialists: attackers, attackerLeader: false, defenders: 10, defenderSpecialists: [], defenderLeader: false, terrain, building: null, culture: 0, border: "normal", luck: 0 });

describe("the culture ladder", () => {
  it("unlocks Rangers at culture 4 in the province and the Standard-bearer at 6, for 9 and 12 gold", () => {
    const ctx = ctxWith();
    const r = ctx.rules.specialists;
    expect([r.rangers.cultureRequired, r.rangers.cost, r.rangers.upkeep, r.standardBearer.cultureRequired, r.standardBearer.cost, r.standardBearer.upkeep]).toEqual([4, 9, 1, 6, 12, 1]);
    const s = lineGame(ctx);
    player(s, "p1").gold = 100;
    // West (a, b) at culture 3: Rangers locked, and the report says what's needed.
    board(s, { a: ["p1", 5, [], { culture: 2 }], b: ["p1", 1, [], { culture: 1 }], e: ["p2", 5] });
    player(s, "p1").gold = 100;
    expect(find(resolveTurn(ctx, s, { p1: [hire("a", "rangers")] }).events, "fizzled")).toMatchObject({ reason: "cultureLocked", detail: { need: 4, have: 3 } });
    board(s, { a: ["p1", 5, [], { culture: 2 }], b: ["p1", 1, [], { culture: 2 }], e: ["p2", 5] });
    player(s, "p1").gold = 100;
    expect(find(resolveTurn(ctx, s, { p1: [hire("a", "rangers")] }).events, "hired")).toMatchObject({ specialist: "rangers", cost: 9 });
    expect(find(resolveTurn(ctx, s, { p1: [hire("a", "standardBearer")] }).events, "fizzled")).toMatchObject({ reason: "cultureLocked", detail: { need: 6, have: 4 } });
    board(s, { a: ["p1", 5, [], { culture: 3 }], b: ["p1", 1, [], { culture: 3 }], e: ["p2", 5] });
    player(s, "p1").gold = 100;
    expect(find(resolveTurn(ctx, s, { p1: [hire("a", "standardBearer")] }).events, "hired")).toMatchObject({ specialist: "standardBearer", cost: 12 });
  });

  it("Rangers: forest, hills and swamp defend like plains against their army; mountains still count", () => {
    const ctx = ctxWith();
    const plains = battle(ctx, [], "plains").defenseStrength;
    for (const t of ["forest", "hills", "swamp"] as const) {
      expect(battle(ctx, [], t).defenseStrength).toBeGreaterThan(plains);
      expect(battle(ctx, ["rangers"], t).defenseStrength).toBeCloseTo(plains);
    }
    expect(battle(ctx, ["rangers"], "mountains").defenseStrength).toBeCloseTo(battle(ctx, [], "mountains").defenseStrength);
    // Only when they attack: defending, rangers change nothing.
    const def = expectBattle(ctx.rules, { attackers: 20, attackerSpecialists: [], attackerLeader: false, defenders: 10, defenderSpecialists: ["rangers"], defenderLeader: false, terrain: "forest", building: null, culture: 0, border: "normal", luck: 0 });
    expect(def.defenseStrength).toBeCloseTo(battle(ctx, [], "forest").defenseStrength);
  });

  it("the Standard-bearer: its army attacks 10% stronger, and two don't stack", () => {
    const ctx = ctxWith();
    const base = battle(ctx, [], "plains").attackStrength;
    expect(battle(ctx, ["standardBearer"], "plains").attackStrength).toBeCloseTo(base * 1.1);
    expect(battle(ctx, ["standardBearer", "standardBearer"], "plains").attackStrength).toBeCloseTo(base * 1.1);
  });

  it("in a real battle, and the odds preview says exactly the same", () => {
    for (const terrain of ["forest", "hills"] as const) {
      const ctx = withTerrain(terrain);
      const s = lineGame(ctx);
      board(s, { a: ["p1", 1], b: ["p1", 12, ["rangers", "standardBearer"]], c: ["p2", 8], e: ["p2", 5] });
      const v = viewFor(ctx, s, "p1");
      const p = previewAttack(ctx, v, { from: "b", to: "c", troops: 11, specialists: ["rangers", "standardBearer"] })!;
      const b = find(resolveTurn(ctx, s, { p1: [mv("b", "c", 11)] }).events, "battle")!;
      expect(b.result.attackStrength).toBeCloseTo(p.attackStrength, 2);
      expect(b.result.defenseStrength).toBeCloseTo(p.defenseStrength, 2);
      // Forest or hills, but the rangers made it plains, and the banner made it 10% stronger.
      expect(p.defenseStrength).toBeCloseTo(8 * ctx.rules.terrain.plains.defenseMult);
      expect(p.attackStrength).toBeCloseTo(11 * 1.1);
      // Without them, the same attack faces the terrain.
      const plain = previewAttack(ctx, v, { from: "b", to: "c", troops: 11, specialists: [] })!;
      expect(plain.defenseStrength).toBeCloseTo(8 * ctx.rules.terrain[terrain].defenseMult);
    }
  });

  it("they cost their upkeep each turn like the others", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    board(s, { a: ["p1", 8, ["rangers", "standardBearer"]], e: ["p2", 5] });
    const none = lineGame(ctx);
    board(none, { a: ["p1", 8], e: ["p2", 5] });
    const up = (st: typeof s) => (resolveTurn(ctx, st, {}).events.find((e) => e.type === "income" && e.player === "p1") as { upkeep: number }).upkeep;
    expect(up(s) - up(none)).toBe(2);
  });
});
