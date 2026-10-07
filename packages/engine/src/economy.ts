import type { Rules, SpecialistType } from "@conquerra/content";
import { indexMap } from "./mapIndex";
import type { GameContext, GameState, PlayerId, Spy, TerritoryId } from "./types";

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

/**
 * A spy's gold a turn (session 16, Nate): nothing while it stays in your own land (at home, or guarding a province you
 * hold), `rules.spies.upkeep` while it's travelling (sent somewhere) or inside land you don't hold. Judged where it
 * stands as the turn's income comes in.
 */
export function spyUpkeep(rules: Rules, s: Pick<GameState, "territories">, spy: Pick<Spy, "owner" | "at" | "target">): number {
  return spy.target === null && s.territories[spy.at]?.owner === spy.owner ? rules.spies.upkeepAtHome : rules.spies.upkeep;
}

/** The culture a territory keeps when it changes hands (session 16: none, by default). */
export const cultureKept = (rules: Rules, level: number) => Math.floor(level * rules.culture.keptOnCapture);

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

/** Does `player` hold every territory of the province `territory` is in? */
export function holdsWholeProvince(ctx: GameContext, state: GameState, player: PlayerId, territory: TerritoryId): boolean {
  const idx = indexMap(ctx.map);
  const prov = idx.byId.get(territory)?.province;
  const members = prov ? (idx.provinceMembers.get(prov) ?? []) : [];
  return members.length > 0 && members.every((m) => state.territories[m]?.owner === player);
}

/**
 * Recruit sites: your capital, any barracks, and any territory in a province you hold completely.
 * (Hiring specialists stays at the capital and barracks.)
 */
export function canRecruitAt(ctx: GameContext, state: GameState, player: PlayerId, territory: TerritoryId): boolean {
  const t = state.territories[territory];
  if (!t || t.owner !== player) return false;
  const p = state.players.find((x) => x.id === player);
  return territory === p?.capital || t.building === "barracks" || holdsWholeProvince(ctx, state, player, territory);
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
  // Spies (session 15) are paid with the specialists: only while away (session 16).
  for (const spy of state.spies ?? []) if (spy.owner === player) specialistUpkeep += spyUpkeep(rules, state, spy);
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
  // Leaders' purses are your gold too (session 18).
  const p = state.players.find((x) => x.id === player)!;
  const gold = p.gold + (p.leaders ?? []).reduce((a, l) => a + l.purse, 0);
  return owned + provinces * 3 + Math.floor(gold / 10);
}
