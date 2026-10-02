import { indexMap } from "./mapIndex";
import type { GameContext, GameState, PlayerId } from "./types";

export interface IncomeBreakdown {
  territories: number;
  buildings: number;
  capital: number;
  provinces: number;
  upkeep: number;
  net: number;
}

export function upkeepFor(ctx: GameContext, territoryCount: number): number {
  const e = ctx.rules.economy;
  const over = Math.max(0, territoryCount - e.upkeepFreeTerritories);
  return Math.round(e.upkeepRate * Math.pow(over, e.upkeepExponent));
}

export function incomeFor(ctx: GameContext, state: GameState, player: PlayerId): IncomeBreakdown {
  const idx = indexMap(ctx.map);
  const { rules } = ctx;
  let territories = 0, buildings = 0, count = 0;
  for (const id of idx.ids) {
    const t = state.territories[id]!;
    if (t.owner !== player) continue;
    count++;
    territories += rules.terrain[idx.byId.get(id)!.terrain].income;
    if (t.building) buildings += rules.buildings[t.building].income;
  }
  const p = state.players.find((x) => x.id === player)!;
  const capital = state.territories[p.capital]?.owner === player ? rules.economy.capitalIncome : 0;
  let provinces = 0;
  for (const prov of ctx.map.provinces) {
    const members = idx.provinceMembers.get(prov.id) ?? [];
    if (members.length && members.every((m) => state.territories[m]!.owner === player)) provinces += prov.bonus;
  }
  const upkeep = upkeepFor(ctx, count);
  return { territories, buildings, capital, provinces, upkeep, net: territories + buildings + capital + provinces - upkeep };
}

/** Score used for conquest mode and turn-cap endings. */
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
