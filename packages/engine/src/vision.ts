import { indexMap } from "./mapIndex";
import type { GameContext, GameState, PlayerId, TerritoryId } from "./types";

/**
 * Why a player can see a territory in detail. Fog rule (design v0.2 §8): full detail on your own land and
 * the land bordering it; watchtowers and scouts reach further. Everything else shows only the public map.
 *
 * Built as a list of sources so spies (M3) slot in as one more source ("spy") without a rewrite:
 * a spy's infiltration adds "spy" to every territory of the country it's in. A fooled spy (3 defenders)
 * will get a forged detail for those territories; the view code takes details through one function,
 * so forging is a swap there, and the viewer is never told which source was fooled.
 */
export type VisionSource = "own" | "border" | "watchtower" | "scouts" | "fogOff" | "spectator" | "spy";

export type Vision = Map<TerritoryId, VisionSource[]>;

/** Every territory the player sees in detail, with the reasons. */
export function visionFor(ctx: GameContext, state: GameState, player: PlayerId): Vision {
  const idx = indexMap(ctx.map);
  const { rules } = ctx;
  const me = state.players.find((p) => p.id === player);
  const vision: Vision = new Map();
  const all = (src: VisionSource) => {
    for (const id of idx.ids) vision.set(id, [src]);
    return vision;
  };
  if (!state.settings.fog) return all("fogOff");
  if (!me || me.eliminatedTurn !== null || state.winner) return all("spectator");

  const add = (id: TerritoryId, src: VisionSource) => {
    const list = vision.get(id);
    if (!list) vision.set(id, [src]);
    else if (!list.includes(src)) list.push(src);
  };
  const reach = (start: TerritoryId, radius: number, src: VisionSource) => {
    let frontier = [start];
    const seen = new Set(frontier);
    for (let r = 0; r < radius; r++) {
      const next: TerritoryId[] = [];
      for (const f of frontier)
        for (const n of idx.neighbors.get(f) ?? [])
          if (!seen.has(n)) {
            seen.add(n);
            next.push(n);
            add(n, src);
          }
      frontier = next;
    }
  };

  for (const id of idx.ids) {
    const t = state.territories[id]!;
    if (t.owner !== player) continue;
    add(id, "own");
    reach(id, rules.vision.base, "border");
    if (t.building === "watchtower") reach(id, rules.vision.base + rules.buildings.watchtower.vision, "watchtower");
    if (t.specialists.some((s) => s.type === "scouts")) reach(id, rules.vision.base + rules.specialists.scouts.vision, "scouts");
  }
  return vision;
}

/** Just the set of territories the player sees in detail. */
export function visibleTerritories(ctx: GameContext, state: GameState, player: PlayerId): Set<TerritoryId> {
  return new Set(visionFor(ctx, state, player).keys());
}
