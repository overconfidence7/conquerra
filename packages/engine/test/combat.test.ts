import { describe, expect, it } from "vitest";
import { defaultRules } from "@conquerra/content";
import { expectBattle, Rng, seedRng } from "../src";
import { rollLosses } from "../src/combat";

const base = {
  attackers: { infantry: 10, cavalry: 0, siege: 0 },
  attackerLeader: false,
  defenders: { infantry: 4, cavalry: 0, siege: 0 },
  defenderLeader: false,
  terrain: "plains" as const,
  building: null,
  border: "normal" as const,
  luck: 0.3,
};

describe("combat math", () => {
  it("expected losses follow kill rates", () => {
    const e = expectBattle(defaultRules, base);
    expect(e.attackStrength).toBeCloseTo(10);
    expect(e.expectedDefenderLosses).toBeCloseTo(4); // 10 * 0.6 = 6, capped at 4 defenders
    expect(e.expectedAttackerLosses).toBeCloseTo(2.8); // 4 * 0.7
    expect(e.captureLikely).toBe(true);
    expect(e.captureGuaranteed).toBe(true); // worst luck still kills 4.2 -> 4
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
  it("siege breaks forts", () => {
    const noSiege = expectBattle(defaultRules, { ...base, building: "fort" });
    const withSiege = expectBattle(defaultRules, {
      ...base,
      building: "fort",
      attackers: { infantry: 6, cavalry: 0, siege: 4 },
    });
    expect(withSiege.defenseStrength).toBeLessThan(noSiege.defenseStrength);
  });
  it("cavalry is weak attacking into forest", () => {
    const cav = { infantry: 0, cavalry: 10, siege: 0 };
    const open = expectBattle(defaultRules, { ...base, attackers: cav });
    const forest = expectBattle(defaultRules, { ...base, attackers: cav, terrain: "forest" });
    expect(forest.attackStrength).toBeLessThan(open.attackStrength);
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
