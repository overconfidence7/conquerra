/**
 * Session 25: the orchestrator's worry, worked out exactly (no dice): how many attackers it takes to break a wall a
 * person has stocked with troops, under each setting of the wall bonus. Plains, no specialists, normal luck; the
 * attacked territory and every lender hold `each` troops (each lends all but 1).
 *   npx tsx apps/sim/scripts/s25-stocked.ts
 */
import { defaultRules, type Rules } from "@conquerra/content";
import { expectBattle } from "@conquerra/engine";

const set = (per: number, max: number | null): Rules => ({ ...defaultRules, walls: { ...defaultRules.walls!, stackPerTerritory: per, stackMax: max } });
const SETTINGS: [string, Rules][] = [["off", set(0, 0)], ["A .05/.20", set(0.05, 0.2)], ["B .10/.40", set(0.1, 0.4)], ["C .10/none", set(0.1, null)], ["D .15/.60", set(0.15, 0.6)]];
const need = (r: Rules, size: number, each: number, kind: "captureLikely" | "captureGuaranteed") => {
  const defenders = each + (size - 1) * (each - 1);
  for (let a = 1; a < 5000; a++)
    if (expectBattle(r, { attackers: a, attackerSpecialists: [], attackerLeader: false, defenders, defenderSpecialists: [], defenderLeader: false, terrain: "plains", building: "fort", culture: 5, wallSize: size, border: "normal", luck: defaultRules.combat.luck })[kind]) return a;
  return Infinity;
};
console.log(`Attackers for a likely capture (and a guaranteed one), plains, luck ${defaultRules.combat.luck}:`);
console.log(`| Wall | Defend | ${SETTINGS.map(([n]) => n).join(" | ")} |`);
for (const [size, each] of [[1, 5], [3, 5], [5, 5], [5, 10], [8, 10], [12, 10]] as const)
  console.log(`| ${size} walled, ${each} in each | ${each + (size - 1) * (each - 1)} | ${SETTINGS.map(([, r]) => `${need(r, size, each, "captureLikely")} (${need(r, size, each, "captureGuaranteed")})`).join(" | ")} |`);
