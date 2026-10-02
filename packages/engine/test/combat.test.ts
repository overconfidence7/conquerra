import { describe, expect, it } from "vitest";
import { defaultRules } from "@conquerra/content";
import { expectBattle, Rng, seedRng, rollLosses, type BattleInput } from "../src";

const base: BattleInput = {
  attackers: 10,
  attackerSpecialists: [],
  attackerLeader: false,
  defenders: 4,
  defenderSpecialists: [],
  defenderLeader: false,
  terrain: "plains",
  building: null,
  border: "normal",
  luck: 0.3,
};

describe("combat math", () => {
  it("expected losses follow kill rates", () => {
    const r = defaultRules;
    const e = expectBattle(r, base);
    expect(e.attackStrength).toBeCloseTo(10 * r.troops.attack);
    expect(e.expectedDefenderLosses).toBeCloseTo(Math.min(4, 10 * r.troops.attack * r.combat.attackKillRate));
    expect(e.expectedAttackerLosses).toBeCloseTo(4 * r.troops.defense * r.combat.defenseKillRate);
    expect(e.captureLikely).toBe(true);
  });
  it("forts, terrain, rivers and leaders change the math", () => {
    const plain = expectBattle(defaultRules, base);
    const fort = expectBattle(defaultRules, { ...base, building: "fort" });
    const hills = expectBattle(defaultRules, { ...base, terrain: "hills" });
    const river = expectBattle(defaultRules, { ...base, border: "river" });
    const leader = expectBattle(defaultRules, { ...base, attackerLeader: true });
    expect(fort.defenseStrength).toBeGreaterThan(plain.defenseStrength);
    expect(hills.defenseStrength).toBeGreaterThan(plain.defenseStrength);
    expect(river.attackStrength).toBeLessThan(plain.attackStrength);
    expect(leader.attackStrength).toBeGreaterThan(plain.attackStrength);
  });
  it("only a finished fort counts, and siege cancels it", () => {
    const plain = expectBattle(defaultRules, base);
    const fort = expectBattle(defaultRules, { ...base, building: "fort" });
    const sieged = expectBattle(defaultRules, { ...base, building: "fort", attackerSpecialists: ["siege"] });
    expect(fort.defenseStrength).toBeGreaterThan(plain.defenseStrength);
    expect(sieged.defenseStrength).toBeCloseTo(plain.defenseStrength); // fortBreak 1.0 = fully cancelled
  });
  it("healers cut their own side's losses", () => {
    const plain = expectBattle(defaultRules, { ...base, defenders: 8 });
    const healed = expectBattle(defaultRules, { ...base, defenders: 8, attackerSpecialists: ["healers"] });
    const healedTwice = expectBattle(defaultRules, { ...base, defenders: 8, attackerSpecialists: ["healers", "healers"] });
    expect(healed.expectedAttackerLosses).toBeLessThan(plain.expectedAttackerLosses);
    // two healers are capped by maxLossReduction
    const h = defaultRules.specialists.healers;
    expect(healedTwice.expectedAttackerLosses).toBeCloseTo(plain.expectedAttackerLosses * (1 - Math.min(h.maxLossReduction, 2 * h.lossReduction)));
    const defHealed = expectBattle(defaultRules, { ...base, defenders: 8, defenderSpecialists: ["healers"] });
    expect(defHealed.expectedDefenderLosses).toBeLessThan(plain.expectedDefenderLosses);
  });
  it("other specialists don't change battle strength", () => {
    const plain = expectBattle(defaultRules, base);
    const flavoured = expectBattle(defaultRules, { ...base, attackerSpecialists: ["cavalry", "scouts"], defenderSpecialists: ["engineers"] });
    expect(flavoured).toEqual(plain);
  });
});

describe("luck rolls", () => {
  it("luck 0 is fully deterministic", () => {
    const r = new Rng(seedRng("x"));
    for (let i = 0; i < 100; i++) expect(rollLosses(5.6, 0, 100, r)).toBe(6);
  });
  it("luck 0.3 stays within +/-30% and averages to the expected value", () => {
    const r = new Rng(seedRng("luck"));
    const E = 20;
    let sum = 0;
    for (let i = 0; i < 5000; i++) {
      const n = rollLosses(E, 0.3, 1000, r);
      expect(n).toBeGreaterThanOrEqual(Math.floor(E * 0.7));
      expect(n).toBeLessThanOrEqual(Math.ceil(E * 1.3));
      sum += n;
    }
    expect(sum / 5000).toBeGreaterThan(19.7);
    expect(sum / 5000).toBeLessThan(20.3);
  });
  it("never exceeds the army size", () => {
    const r = new Rng(seedRng("cap"));
    for (let i = 0; i < 500; i++) expect(rollLosses(50, 0.5, 3, r)).toBeLessThanOrEqual(3);
  });
});
