import { describe, expect, it } from "vitest";
import { defaultRules } from "@conquerra/content";
import { cultureDefense, cultureProtection, expectBattle, incomeFor, investCost, previewAttack, resolveTurn, viewFor, type BattleInput, type Order, type StepEvent } from "../src";
import { board, ctxWith, lineGame, mv, player } from "./helpers";

const invest = (territory: string, id = `i-${territory}`): Order => ({ id, kind: "invest", territory });

describe("culture", () => {
  it("is raised one level at a time with gold, at a rising price, up to the max", () => {
    const ctx = ctxWith((r) => {
      r.culture.max = 2;
      r.culture.investCost = [4, 7];
    });
    const s = lineGame(ctx);
    board(s, { a: ["p1", 5], e: ["p2", 5] });
    player(s, "p1").gold = 100;
    const { state, events } = resolveTurn(ctx, s, { p1: [invest("a", "1"), invest("a", "2"), invest("a", "3"), invest("e", "4")] });
    expect(state.territories.a!.culture).toBe(2);
    const paid = events.filter((e) => e.type === "invested").map((e) => (e as { cost: number }).cost);
    expect(paid).toEqual([4, 7]);
    const fizz = events.filter((e) => e.type === "fizzled").map((e) => (e as { orderId: string }).orderId);
    expect(fizz).toEqual(["3", "4"]); // maxed out; not your territory
    expect(investCost(ctx.rules, 2)).toBeNull();
  });

  it("boosts holding bonuses: territory income and full-province bonus", () => {
    const ctx = ctxWith((r) => {
      r.culture.incomePerLevel = 1;
      r.culture.provinceBonusPerLevel = 1;
    });
    const s = lineGame(ctx);
    board(s, { a: ["p1", 1], b: ["p1", 1], e: ["p2", 1] });
    const plain = incomeFor(ctx, s, "p1");
    s.territories.a!.culture = 2;
    s.territories.b!.culture = 2;
    const cultured = incomeFor(ctx, s, "p1");
    expect(cultured.culture - plain.culture).toBe(4); // 2 territories x 2 levels x 1
    expect(cultured.provinces - plain.provinces).toBe(2); // average culture 2 x 1
  });

  it("passes to whoever captures the territory", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    board(s, { a: ["p1", 30], b: ["p2", 2, [], { culture: 3 }], e: ["p2", 3] });
    const { state } = resolveTurn(ctx, s, { p1: [mv("a", "b", "all")] });
    expect(state.territories.b!.owner).toBe("p1");
    expect(state.territories.b!.culture).toBe(3);
  });

  it("protects against unrest when upkeep can't be paid", () => {
    const ctx = ctxWith((r) => {
      r.economy.upkeepFreeTerritories = 0;
      r.economy.upkeepRate = 20;
      r.economy.upkeepExponent = 1;
      r.culture.protectionPerLevel = 0.25;
      r.culture.maxProtection = 1;
      r.culture.incomePerLevel = 0; // keep the shortfall identical across the comparison
    });
    const s = lineGame(ctx);
    const deserted = (culture: number) => {
      board(s, { a: ["p1", 50, [], { culture }], e: ["p2", 5] });
      player(s, "p1").gold = 0;
      const inc = resolveTurn(ctx, s, {}).events.find((e) => e.type === "income" && e.player === "p1") as Extract<StepEvent, { type: "income" }>;
      return inc.deserted;
    };
    const none = deserted(0);
    const half = deserted(2);
    const full = deserted(4);
    expect(none).toBeGreaterThan(0);
    expect(half).toBe(Math.floor(none * 0.5));
    expect(full).toBe(0);
    expect(cultureProtection(ctx.rules, 10)).toBe(1);
  });

  it("is hidden from players who can't see the territory", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    board(s, { a: ["p1", 5], e: ["p2", 5, [], { culture: 4 }] });
    expect(viewFor(ctx, s, "p1").territories.e).toEqual({ detail: "fogged" });
    expect(viewFor(ctx, s, "p2").territories.e).toMatchObject({ detail: "full", culture: 4 });
  });
});

describe("loyal land: culture defends", () => {
  const base: BattleInput = {
    attackers: 20,
    attackerSpecialists: [],
    attackerLeader: false,
    defenders: 10,
    defenderSpecialists: [],
    defenderLeader: false,
    terrain: "plains",
    building: null,
    culture: 0,
    border: "normal",
    luck: 0.3,
  };

  it("each level adds the rules' step to defense (+30% at level 5 with 6% a level), multiplying with terrain and forts", () => {
    const r = defaultRules;
    const step = r.culture.defensePerLevel;
    expect(step).toBeGreaterThanOrEqual(0.04);
    expect(step).toBeLessThanOrEqual(0.08);
    const plain = expectBattle(r, base).defenseStrength;
    for (let c = 0; c <= 5; c++) expect(expectBattle(r, { ...base, culture: c }).defenseStrength).toBeCloseTo(plain * (1 + c * step));
    expect(cultureDefense(r, 5)).toBeCloseTo(1 + 5 * step);
    const all = expectBattle(r, { ...base, culture: 3, terrain: "hills", building: "fort" }).defenseStrength;
    expect(all).toBeCloseTo(plain * r.terrain.hills.defenseMult * r.buildings.fort.defenseMult * (1 + 3 * step));
  });

  it("the odds preview counts it exactly as the engine does", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    board(s, { a: ["p1", 1], b: ["p1", 13], c: ["p2", 8, [], { culture: 4 }], e: ["p2", 1] });
    const preview = previewAttack(ctx, viewFor(ctx, s, "p1"), { from: "b", to: "c", troops: 12 })!;
    const { events } = resolveTurn(ctx, s, { p1: [mv("b", "c", 12)] });
    const battle = events.find((e) => e.type === "battle") as Extract<StepEvent, { type: "battle" }>;
    expect(battle.result.defenseStrength).toBeCloseTo(preview.defenseStrength, 2);
    expect(battle.result.expectedAttackerLosses).toBeCloseTo(preview.expectedAttackerLosses, 2);
    expect(battle.defense.culture).toBe(4);
  });

  it("a captured territory keeps its culture, and now defends its new owner", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    board(s, { a: ["p1", 1], b: ["p1", 40], c: ["p2", 1, [], { culture: 3 }], e: ["p2", 1] });
    const { state } = resolveTurn(ctx, s, { p1: [mv("b", "c", "all")] });
    expect(state.territories.c).toMatchObject({ owner: "p1", culture: 3 });
  });
});
