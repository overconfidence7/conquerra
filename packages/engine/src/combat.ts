import type { BorderType, BuildingType, Rules, Terrain } from "@conquerra/content";
import type { Rng } from "./rng";
import type { Units } from "./types";
import { total } from "./units";

export interface BattleInput {
  attackers: Units;
  attackerLeader: boolean;
  defenders: Units;
  defenderLeader: boolean;
  terrain: Terrain;
  building: BuildingType | null;
  border: BorderType;
  luck: number;
}

export interface BattleExpectation {
  attackStrength: number;
  defenseStrength: number;
  expectedDefenderLosses: number;
  expectedAttackerLosses: number;
  /** Lowest / highest possible losses given the luck setting. */
  defenderLossRange: [number, number];
  attackerLossRange: [number, number];
  /** Attacker takes the territory even with the worst luck. */
  captureGuaranteed: boolean;
  /** Attacker takes the territory on an average roll. */
  captureLikely: boolean;
  /** Attacker cannot take it even with the best luck. */
  captureImpossible: boolean;
}

/** Pure math: what should happen on average. Used for previews, bots and resolution. */
export function expectBattle(rules: Rules, b: BattleInput): BattleExpectation {
  const borderMult = rules.borders[b.border].attackMult;
  const leaderA = b.attackerLeader ? 1 + rules.leader.strengthBonus : 1;
  const leaderD = b.defenderLeader ? 1 + rules.leader.strengthBonus : 1;

  let attackStrength = 0;
  for (const u of ["infantry", "cavalry", "siege"] as const) {
    const s = rules.units[u];
    attackStrength += b.attackers[u] * s.attack * (s.attackTerrain[b.terrain] ?? 1);
  }
  attackStrength *= borderMult * leaderA;

  let fortMult = 1;
  if (b.building) {
    const base = rules.buildings[b.building].defenseMult;
    const breakBy = b.attackers.siege * rules.units.siege.fortBreak;
    fortMult = Math.max(1, base - breakBy);
  }
  let defenseStrength = 0;
  for (const u of ["infantry", "cavalry", "siege"] as const) defenseStrength += b.defenders[u] * rules.units[u].defense;
  defenseStrength *= rules.terrain[b.terrain].defenseMult * fortMult * leaderD;

  const eDef = attackStrength * rules.combat.attackKillRate;
  const eAtk = defenseStrength * rules.combat.defenseKillRate;
  const L = b.luck;
  const dTot = total(b.defenders);
  const aTot = total(b.attackers);
  const clampD = (x: number) => Math.min(dTot, Math.max(0, x));
  const clampA = (x: number) => Math.min(aTot, Math.max(0, x));
  const defenderLossRange: [number, number] = [clampD(Math.floor(eDef * (1 - L))), clampD(Math.ceil(eDef * (1 + L)))];
  const attackerLossRange: [number, number] = [clampA(Math.floor(eAtk * (1 - L))), clampA(Math.ceil(eAtk * (1 + L)))];
  return {
    attackStrength,
    defenseStrength,
    expectedDefenderLosses: clampD(eDef),
    expectedAttackerLosses: clampA(eAtk),
    defenderLossRange,
    attackerLossRange,
    captureGuaranteed: defenderLossRange[0] >= dTot && attackerLossRange[1] < aTot,
    captureLikely: eDef >= dTot && eAtk < aTot,
    captureImpossible: defenderLossRange[1] < dTot || attackerLossRange[0] >= aTot,
  };
}

/**
 * Roll one side's losses. With luck L the result is spread across
 * expected * (1 - L) .. expected * (1 + L), peaking at the expected value
 * (average of two uniform draws). Fractions are rounded up or down at random
 * in proportion, so the long-run average equals the expected value.
 * With luck 0 the result is the plainly rounded expected value: no randomness at all.
 */
export function rollLosses(expected: number, luck: number, cap: number, rng: Rng): number {
  if (luck <= 0) return Math.min(cap, Math.round(expected));
  const u = (rng.next() + rng.next()) / 2;
  const raw = expected * (1 - luck + 2 * luck * u);
  const whole = Math.floor(raw);
  const n = whole + (rng.next() < raw - whole ? 1 : 0);
  return Math.min(cap, Math.max(0, n));
}
