import type { BorderType, BuildingType, Rules, SpecialistType, Terrain } from "@conquerra/content";
import type { Rng } from "./rng";

export interface BattleInput {
  attackers: number;
  attackerSpecialists: readonly SpecialistType[];
  attackerLeader: boolean;
  defenders: number;
  defenderSpecialists: readonly SpecialistType[];
  defenderLeader: boolean;
  terrain: Terrain;
  /** Only a finished building counts (a fort under construction gives no bonus). */
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

const count = (list: readonly SpecialistType[], t: SpecialistType) => list.filter((s) => s === t).length;

/** Share of losses healers prevent for one side. */
export function healerReduction(rules: Rules, specialists: readonly SpecialistType[]): number {
  const h = rules.specialists.healers;
  return Math.min(h.maxLossReduction, count(specialists, "healers") * h.lossReduction);
}

/** Pure math: what should happen on average. Used for previews, bots, presets and resolution. */
export function expectBattle(rules: Rules, b: BattleInput): BattleExpectation {
  const borderMult = rules.borders[b.border].attackMult;
  const leaderA = b.attackerLeader ? 1 + rules.leader.strengthBonus : 1;
  const leaderD = b.defenderLeader ? 1 + rules.leader.strengthBonus : 1;
  const attackStrength = b.attackers * rules.troops.attack * borderMult * leaderA;

  // Forts multiply defense; each siege specialist cancels part of the fort's bonus.
  let fortMult = 1;
  if (b.building === "fort") {
    const bonus = rules.buildings.fort.defenseMult - 1;
    const broken = count(b.attackerSpecialists, "siege") * rules.specialists.siege.fortBreak;
    fortMult = 1 + Math.max(0, bonus * (1 - broken));
  }
  const defenseStrength = b.defenders * rules.troops.defense * rules.terrain[b.terrain].defenseMult * fortMult * leaderD;

  const eDef = attackStrength * rules.combat.attackKillRate * (1 - healerReduction(rules, b.defenderSpecialists));
  const eAtk = defenseStrength * rules.combat.defenseKillRate * (1 - healerReduction(rules, b.attackerSpecialists));
  const L = b.luck;
  const clampD = (x: number) => Math.min(b.defenders, Math.max(0, x));
  const clampA = (x: number) => Math.min(b.attackers, Math.max(0, x));
  const defenderLossRange: [number, number] = [clampD(Math.floor(eDef * (1 - L))), clampD(Math.ceil(eDef * (1 + L)))];
  const attackerLossRange: [number, number] = [clampA(Math.floor(eAtk * (1 - L))), clampA(Math.ceil(eAtk * (1 + L)))];
  return {
    attackStrength,
    defenseStrength,
    expectedDefenderLosses: clampD(eDef),
    expectedAttackerLosses: clampA(eAtk),
    defenderLossRange,
    attackerLossRange,
    captureGuaranteed: defenderLossRange[0] >= b.defenders && attackerLossRange[1] < b.attackers,
    captureLikely: eDef >= b.defenders && eAtk < b.attackers,
    captureImpossible: defenderLossRange[1] < b.defenders || attackerLossRange[0] >= b.attackers,
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
