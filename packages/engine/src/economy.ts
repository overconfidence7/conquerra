import type { Rules, SpecialistType } from "@conquerra/content";
import { indexMap } from "./mapIndex";
import type { GameContext, GameState, PlayerId, TerritoryId } from "./types";

export interface IncomeBreakdown {
  territories: number;
  culture: number;
  buildings: number;
  capital: number;
  provinces: number;
  upkeep: number;
  specialistUpkeep: number;
  net: number;
}

export function upkeepFor(ctx: GameContext, territoryCount: number): number {
  const e = ctx.rules.economy;
  const over = Math.max(0, territoryCount - e.upkeepFreeTerritories);
  return Math.round(e.upkeepRate * Math.pow(over, e.upkeepExponent));
}

// ---------- Culture ----------

/** Gold to raise a territory's culture from `level` to `level + 1`, or null if it's maxed. */
export function investCost(rules: Rules, level: number): number | null {
  if (level >= rules.culture.max) return null;
  return rules.culture.investCost[level] ?? null;
}

/**
 * Share of a bad effect that culture blocks (0..maxProtection).
 * Used now for unrest when upkeep can't be paid; Fate events and uprisings (M3) will use the same number.
 */
export function cultureProtection(rules: Rules, level: number): number {
  return Math.min(rules.culture.maxProtection, level * rules.culture.protectionPerLevel);
}

/** Total culture a player holds in a province. Unlocks the fancier specialists there. */
export function provinceCulture(ctx: GameContext, state: GameState, player: PlayerId, territory: TerritoryId): number {
  const idx = indexMap(ctx.map);
  const prov = idx.byId.get(territory)?.province;
  if (!prov) return 0;
  let sum = 0;
  for (const m of idx.provinceMembers.get(prov) ?? []) {
    const t = state.territories[m]!;
    if (t.owner === player) sum += t.culture;
  }
  return sum;
}

export function specialistUnlocked(ctx: GameContext, state: GameState, player: PlayerId, territory: TerritoryId, type: SpecialistType): boolean {
  const need = ctx.rules.specialists[type].cultureRequired;
  return need <= 0 || provinceCulture(ctx, state, player, territory) >= need;
}

// ---------- Income ----------

export function incomeFor(ctx: GameContext, state: GameState, player: PlayerId): IncomeBreakdown {
  const idx = indexMap(ctx.map);
  const { rules } = ctx;
  let territories = 0, culture = 0, buildings = 0, count = 0, specialistUpkeep = 0;
  for (const id of idx.ids) {
    const t = state.territories[id]!;
    if (t.owner !== player) continue;
    count++;
    territories += rules.terrain[idx.byId.get(id)!.terrain].income;
    culture += t.culture * rules.culture.incomePerLevel;
    if (t.building === "market") buildings += rules.buildings.market.income;
    for (const s of t.specialists) specialistUpkeep += rules.specialists[s.type].upkeep;
  }
  const p = state.players.find((x) => x.id === player)!;
  const capital = state.territories[p.capital]?.owner === player ? rules.economy.capitalIncome : 0;
  let provinces = 0;
  for (const prov of ctx.map.provinces) {
    const members = idx.provinceMembers.get(prov.id) ?? [];
    if (!members.length || !members.every((m) => state.territories[m]!.owner === player)) continue;
    const avgCulture = members.reduce((a, m) => a + state.territories[m]!.culture, 0) / members.length;
    provinces += prov.bonus + avgCulture * rules.culture.provinceBonusPerLevel;
  }
  culture = Math.floor(culture);
  provinces = Math.floor(provinces);
  const upkeep = upkeepFor(ctx, count);
  return {
    territories,
    culture,
    buildings,
    capital,
    provinces,
    upkeep,
    specialistUpkeep,
    net: territories + culture + buildings + capital + provinces - upkeep - specialistUpkeep,
  };
}

/** Score used for conquest mode and turn-cap endings: land first, then provinces, a little for gold. */
export function scoreFor(ctx: GameContext, state: GameState, player: PlayerId): number {
  const idx = indexMap(ctx.map);
  let owned = 0;
  for (const id of idx.ids) if (state.territories[id]!.owner === player) owned++;
  let provinces = 0;
  for (const prov of ctx.map.provinces) {
    const members = idx.provinceMembers.get(prov.id) ?? [];
    if (members.every((m) => state.territories[m]!.owner === player)) provinces++;
  }
  const gold = state.players.find((p) => p.id === player)!.gold;
  return owned + provinces * 3 + Math.floor(gold / 10);
}
