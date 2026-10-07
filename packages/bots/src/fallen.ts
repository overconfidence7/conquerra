import { indexMap, type GameContext, type Order, type PlayerId, type PlayerView, type TerritoryId, type WorldEventKind } from "@conquerra/engine";
import { landEstimates, runawayLeader } from "./board";
import type { Bot } from "./recruit";

/**
 * A Fallen bot (session 12): a knocked-out seat that spends its Influence on world events aimed at whoever looks to
 * be leading, judged with the Captain's runaway rule from its own view (the political map: who holds what, no troop
 * numbers). With nobody clearly ahead it saves its Influence, except on its first turn out, when it strikes whoever
 * holds the most land with what it can afford (session 19). Every Fallen bot sees the same map and judges the same
 * way, so they tend to pick the same event and place, and their Influence pools into a stronger one.
 *
 * Which event, best first, where the leader has a place for it and it isn't resting:
 *  - Uprising in its quietest land (deep inside its realm, where garrisons are thin; never its capital)
 *  - Plague in the province where it holds the most land
 *  - Famine
 *  - Mercenaries next to its land that borders neutral land (they block its growth there)
 *  - Storm on its longest border with another living player (a breather for whoever it's pressing)
 */
export function planFallen(ctx: GameContext, view: PlayerView): Order[] {
  const me = view.me;
  if (me.eliminatedTurn === null || view.winner) return [];
  const idx = indexMap(ctx.map);
  const owner = (t: TerritoryId): PlayerId | null => {
    const v = view.territories[t]!;
    return v.detail === "full" ? v.owner : (v.lastSeen?.owner ?? null);
  };
  const living = view.players.filter((p) => p.eliminatedTurn === null).map((p) => p.id);
  const land = new Map<PlayerId, number>();
  for (const t of idx.ids) {
    const o = owner(t);
    if (o) land.set(o, (land.get(o) ?? 0) + 1);
  }
  const est = landEstimates(land, living);
  // The runaway leader if there is one; with fewer players left, whoever leads by a clear margin; and on its very first
  // turn out (session 19: the Fallen act from their first turn), whoever holds the most land.
  const firstTurn = view.turn === me.eliminatedTurn + 1;
  const leader = runawayLeader(est, 0, idx.ids.length, living.length) ?? (est[0] && (firstTurn || est[0][1] >= CLEAR_LEAD * (est[1]?.[1] ?? 0)) ? est[0][0] : null);
  if (!leader) return [];
  const theirs = idx.ids.filter((t) => owner(t) === leader);
  const capital = (t: TerritoryId) => isKnownCapital(view, t);
  const nb = (t: TerritoryId) => idx.neighbors.get(t) ?? [];
  const cfg = ctx.rules.fallen;
  const ready = (k: WorldEventKind) => view.eventCooldowns[k] === 0 && me.influence >= cfg.events[k].cost;
  const byId = (a: TerritoryId, b: TerritoryId) => (a < b ? -1 : 1);

  let plan: { event: WorldEventKind; target: TerritoryId; across?: TerritoryId } | null = null;
  if (ready("uprising")) {
    // Its quietest land: every neighbour is its own (garrisons are thin deep inside a realm), and the realm goes on without it.
    const t = theirs.filter((x) => !capital(x) && nb(x).every((n) => owner(n) === leader)).sort(byId)[0];
    if (t && theirs.length > 1) plan = { event: "uprising", target: t };
  }
  if (!plan && ready("plague")) {
    const count = new Map<string, TerritoryId[]>();
    for (const t of theirs) if (!capital(t)) count.set(idx.byId.get(t)!.province, [...(count.get(idx.byId.get(t)!.province) ?? []), t]);
    const best = [...count].sort((a, b) => b[1].length - a[1].length || (a[0] < b[0] ? -1 : 1))[0];
    if (best) plan = { event: "plague", target: best[1].sort(byId)[0]! };
  }
  if (!plan && ready("famine")) {
    const t = theirs.filter((x) => !capital(x)).sort(byId)[0];
    if (t) plan = { event: "famine", target: t };
  }
  if (!plan && ready("mercenaries")) {
    const t = theirs.filter((x) => !capital(x) && nb(x).some((n) => owner(n) === null)).sort(byId)[0];
    if (t) plan = { event: "mercenaries", target: t };
  }
  if (!plan && ready("storm")) {
    const pairs = theirs
      .filter((x) => !capital(x))
      .flatMap((x) => nb(x).filter((n) => { const o = owner(n); return o !== null && o !== leader && living.includes(o) && !capital(n); }).map((n) => [x, n] as const))
      .sort((a, b) => byId(a[0], b[0]) || byId(a[1], b[1]));
    if (pairs[0]) plan = { event: "storm", target: pairs[0][0], across: pairs[0][1] };
  }
  if (!plan) return [];
  // Spend for strength: up to the most an event can use, never more than we have.
  const influence = Math.min(me.influence, Math.floor(cfg.events[plan.event].cost * cfg.maxStrength));
  return [{ id: `${me.id}-t${view.turn}-fallen`, kind: "worldEvent", ...plan, influence }];
}

/** With fewer than three players left, the leader is a target once it holds this many times the land of the next. */
const CLEAR_LEAD = 1.25;

/** A capital (the political map marks them): events can't touch one. */
function isKnownCapital(view: PlayerView, t: TerritoryId): boolean {
  const v = view.territories[t];
  return !!v && (v.detail === "full" ? v.capitalOf !== null : !!v.lastSeen?.capitalOf);
}

export const fallenBot: Bot = { id: "fallen", name: "Fallen", plan: (ctx, view) => planFallen(ctx, view) };
