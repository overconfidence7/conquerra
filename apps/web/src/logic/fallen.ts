import { WORLD_EVENT_KINDS, type GameContext, type PlayerId, type PlayerView, type WorldEventKind } from "@conquerra/engine";

/** Influence each of the Fallen earns a turn, with this many Fallen. */
export const influencePerTurn = (ctx: GameContext, view: PlayerView) =>
  ctx.rules.fallen.influenceBase + ctx.rules.fallen.influencePerOtherFallen * Math.max(0, view.players.filter((p) => p.eliminatedTurn !== null).length - 1);

/** The world events you could play right now with `left` Influence (not resting), cheapest first. */
export function readyEvents(ctx: GameContext, view: PlayerView, left: number): WorldEventKind[] {
  return WORLD_EVENT_KINDS.filter((k) => view.eventCooldowns[k] === 0 && left >= ctx.rules.fallen.events[k].cost).sort((a, b) => ctx.rules.fallen.events[a].cost - ctx.rules.fallen.events[b].cost);
}

/** Who holds the most land on the political map the Fallen see (null with nobody clearly ahead or no one left). */
export function landLeader(ctx: GameContext, view: PlayerView): { player: PlayerId; land: number } | null {
  const land = new Map<PlayerId, number>();
  for (const t of ctx.map.territories) {
    const v = view.territories[t.id];
    const o = v ? (v.detail === "full" ? v.owner : (v.lastSeen?.owner ?? null)) : null;
    if (o && view.players.some((p) => p.id === o && p.eliminatedTurn === null)) land.set(o, (land.get(o) ?? 0) + 1);
  }
  const [first, second] = [...land].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  if (!first || (second && second[1] === first[1])) return null;
  return { player: first[0], land: first[1] };
}
