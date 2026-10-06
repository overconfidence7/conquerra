import { investCost } from "./economy";
import type { MapIndex } from "./mapIndex";
import type { GameContext, GameEvent, GameState, LandChange, PlayerId, PlayerState, Purse, PurseGoal, TerritoryId } from "./types";

/**
 * "Govern this province" (session 15, design additions §4): a fifth instruction for any general (your Leader or a
 * captured one) standing in a province where you hold most of the land.
 *
 *  - Its army stays in the province and defends it (the general's orders are written by the bots' brain, as for Hold
 *    here, across the whole province).
 *  - **It keeps a share of the province's own income** (`rules.generals.govern.share`, 25%: its territories and its
 *    holding bonus) as the turn ends, and spends it on the province the same turn: a fort on the most threatened
 *    frontier territory first, else culture where the province is most exposed, else troops where the general stands.
 *  - **No second pot:** what it can't spend yet is held toward its next purchase (the general's `purse`), shown only as
 *    progress on the province ("A fort at Pinemark: 5 of 8 gold"). If the general leaves the province, is lost, or is
 *    given another instruction, that progress goes home.
 *  - Generals never spend your own gold: the share is the province's own income. The rest goes home as usual.
 */

/** What the engine's turn gives the governing rules. */
export interface GovernHost {
  ctx: GameContext;
  s: GameState;
  idx: MapIndex;
  emit(e: GameEvent): void;
}

const provinceOf = (idx: MapIndex, t: TerritoryId) => idx.byId.get(t)!.province;

/** Does `p` hold most (more than half) of this province's land? */
export function holdsMost(idx: MapIndex, s: GameState, p: PlayerId, province: string): boolean {
  const members = idx.provinceMembers.get(province) ?? [];
  return members.length > 0 && members.filter((t) => s.territories[t]!.owner === p).length * 2 > members.length;
}

/** Can this general govern where it stands (a province where its owner holds most of the land)? */
export function canGovern(idx: MapIndex, s: GameState, p: PlayerId, at: TerritoryId | null): boolean {
  return !!at && s.territories[at]?.owner === p && holdsMost(idx, s, p, provinceOf(idx, at));
}

/** The province's own income for `p`: its territories (terrain and culture) and, held whole, its holding bonus. */
export function provinceIncome(ctx: GameContext, idx: MapIndex, s: GameState, p: PlayerId, province: string): number {
  const { rules, map } = ctx;
  const members = idx.provinceMembers.get(province) ?? [];
  let sum = 0;
  for (const t of members) {
    const x = s.territories[t]!;
    if (x.owner !== p) continue;
    sum += rules.terrain[idx.byId.get(t)!.terrain].income + x.culture * rules.culture.incomePerLevel;
  }
  if (members.length && members.every((t) => s.territories[t]!.owner === p)) {
    const avg = members.reduce((a, t) => a + s.territories[t]!.culture, 0) / members.length;
    sum += (map.provinces.find((x) => x.id === province)?.bonus ?? 0) + avg * rules.culture.provinceBonusPerLevel;
  }
  return sum;
}

/** Rival troops next to `t` (what makes it threatened, or exposed). */
function pressure(idx: MapIndex, s: GameState, p: PlayerId, t: TerritoryId): number {
  return (idx.neighbors.get(t) ?? []).reduce((a, n) => {
    const x = s.territories[n]!;
    return a + (x.owner && x.owner !== p ? x.troops : 0);
  }, 0);
}

/**
 * What the general buys next for the province: a fort on its most threatened frontier territory (one without a
 * building), else culture where it's most exposed (not at the top yet), else troops where the general stands.
 */
export function nextGoal(ctx: GameContext, idx: MapIndex, s: GameState, p: PlayerId, province: string, at: TerritoryId): PurseGoal {
  const { rules } = ctx;
  const mine = (idx.provinceMembers.get(province) ?? []).filter((t) => s.territories[t]!.owner === p);
  const ranked = (ts: TerritoryId[]) => ts.map((t) => ({ t, w: pressure(idx, s, p, t) })).sort((a, b) => b.w - a.w || (a.t < b.t ? -1 : 1));
  const fortAt = ranked(mine.filter((t) => !s.territories[t]!.building && !s.territories[t]!.construction)).filter((x) => x.w > 0)[0];
  if (fortAt) return { what: "fort", territory: fortAt.t, cost: rules.buildings.fort.cost };
  const cultureAt = mine
    .filter((t) => investCost(rules, s.territories[t]!.culture) !== null)
    .map((t) => ({ t, w: pressure(idx, s, p, t), c: s.territories[t]!.culture }))
    .sort((a, b) => b.w - a.w || a.c - b.c || (a.t < b.t ? -1 : 1))[0];
  if (cultureAt) return { what: "culture", territory: cultureAt.t, cost: investCost(rules, cultureAt.c)! };
  return { what: "troops", territory: at, cost: rules.troops.cost };
}

/** Where each of a player's generals stands, with its instruction. */
function generals(p: PlayerState): { general: PlayerId; at: TerritoryId | null; governs: boolean }[] {
  return [
    { general: p.id, at: p.leader.alive ? p.leader.territory : null, governs: p.command?.kind === "govern" },
    ...p.captured.map((g) => ({ general: g.of, at: g.territory, governs: g.instruction?.kind === "govern" })),
  ];
}

/**
 * As income comes in (the turn's economy step): each governing general keeps its share of the province's income and
 * spends it there; progress of a general that left, was lost or stopped governing goes home. Returns the gold kept
 * this turn (taken out of the player's income).
 */
export function governEndOfTurn(h: GovernHost, p: PlayerState): number {
  const { ctx, s, idx } = h;
  const g = ctx.rules.generals.govern;
  if (!g) return 0;
  let kept = 0;
  const purses = (p.purse ??= []);
  const gens = generals(p);
  // Progress goes home when its general left the province, was lost, or was given another instruction.
  for (const purse of [...purses]) {
    const gen = gens.find((x) => x.general === purse.general);
    if (gen?.governs && gen.at && provinceOf(idx, gen.at) === purse.province) continue;
    purses.splice(purses.indexOf(purse), 1);
    if (purse.saved > 0) p.gold += purse.saved;
    h.emit({ type: "purseHome", player: p.id, general: purse.general, province: purse.province, gold: purse.saved });
  }
  for (const gen of gens) {
    if (!gen.governs || !gen.at || !canGovern(idx, s, p.id, gen.at)) continue;
    const province = provinceOf(idx, gen.at);
    let purse = purses.find((x) => x.general === gen.general);
    if (!purse) purses.push((purse = { general: gen.general, province, saved: 0, goal: null }));
    const share = Math.floor(g.share * provinceIncome(ctx, idx, s, p.id, province));
    purse.saved += share;
    kept += share;
    const spent: { what: PurseGoal["what"]; territory: TerritoryId; gold: number; troops?: number }[] = [];
    const land = new Map<TerritoryId, LandChange>();
    for (let i = 0; i < 4; i++) {
      const goal = nextGoal(ctx, idx, s, p.id, province, gen.at);
      if (purse.saved < goal.cost) break;
      const t = s.territories[goal.territory]!;
      if (goal.what === "fort") {
        purse.saved -= goal.cost;
        t.construction = { building: "fort", doneAtEndOfTurn: s.turn + Math.max(0, ctx.rules.buildings.fort.buildTurns - 1) };
        spent.push({ what: "fort", territory: goal.territory, gold: goal.cost });
        land.set(goal.territory, { territory: goal.territory, construction: { ...t.construction } });
      } else if (goal.what === "culture") {
        purse.saved -= goal.cost;
        t.culture += 1;
        spent.push({ what: "culture", territory: goal.territory, gold: goal.cost });
        land.set(goal.territory, { territory: goal.territory, culture: t.culture });
      } else {
        const troops = Math.floor(purse.saved / goal.cost);
        purse.saved -= troops * goal.cost;
        t.troops += troops;
        spent.push({ what: "troops", territory: goal.territory, gold: troops * goal.cost, troops });
        land.set(goal.territory, { territory: goal.territory, troops: t.troops });
        break;
      }
    }
    purse.goal = nextGoal(ctx, idx, s, p.id, province, gen.at);
    h.emit({ type: "governed", player: p.id, general: gen.general, province, kept: share, spent, toward: { ...purse.goal, saved: purse.saved }, land: [...land.values()] });
  }
  return kept;
}

/** Names for the governing lines: a general ("Your Leader", or the captured general's name), places and provinces. */
export interface GovernNames {
  general(id: PlayerId): string;
  place(t: TerritoryId): string;
  province(id: string): string;
}

/** "A fort at Pinemark: 5 of 8 gold" (what a governing general is saving toward, as progress). */
export function goalLine(goal: PurseGoal & { saved: number }, n: Pick<GovernNames, "place">): string {
  const what = goal.what === "fort" ? `A fort at ${n.place(goal.territory)}` : goal.what === "culture" ? `Culture at ${n.place(goal.territory)}` : `Troops at ${n.place(goal.territory)}`;
  return `${what}: ${Math.min(goal.saved, goal.cost)} of ${goal.cost} gold`;
}

/** "Your Leader governs Old March: kept 3 gold, raised culture in Pinemark." (and what it's saving toward). */
export function governLine(e: Extract<GameEvent, { type: "governed" | "purseHome" }>, n: GovernNames): string {
  const who = n.general(e.general);
  if (e.type === "purseHome") return `${who} no longer governs ${n.province(e.province)}${e.gold ? `: the ${e.gold} gold it was saving went home` : ""}.`;
  const did = e.spent.map((x) =>
    x.what === "fort" ? `began a fort at ${n.place(x.territory)}` : x.what === "culture" ? `raised culture in ${n.place(x.territory)}` : `raised ${x.troops} troop${x.troops === 1 ? "" : "s"} at ${n.place(x.territory)}`,
  );
  const saving = !did.length && e.toward ? ` (${goalLine(e.toward, n).replace(/^A /, "a ").replace(/^Culture/, "culture").replace(/^Troops/, "troops")})` : "";
  return `${who} governs ${n.province(e.province)}: kept ${e.kept} gold${did.length ? `, ${did.join(", ")}` : saving}.`;
}
