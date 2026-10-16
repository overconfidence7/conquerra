import { defaultRules, type MapDef } from "@conquerra/content";
import type { OrderSpec, TutorialDef } from "@conquerra/content/tutorials";
import { updateIntel, updateWalls, type Order, type SaveFile, type SpoilsMark } from "@conquerra/engine";
import { LocalGame } from "../host/localGame";
import type { LobbySettings } from "../host/protocol";

/**
 * A tutorial's saved game, made from its recipe (session 31): a new single-player game on the recipe's map and seed
 * against its bots, then where things stand laid over it (`place`), then any scripted turns played (your orders from
 * the file, the bots' their own). Same recipe, same saved game, every time: nothing here draws a random number or
 * reads a clock but the one passed in. No tutorial rule lives in the engine; this only sets up an ordinary game.
 */

/** Your lobby choices that only change how it looks (your colour, your Leader's name), never how it plays. */
export interface TutorialLooks {
  house?: number;
  leaderName?: string;
}

/** A file's orders with ids, as the page's queue would number them. */
export const ordersOf = (specs: readonly OrderSpec[], turn: number): Order[] => specs.map((o, i) => ({ ...o, id: `t${turn}-${i + 1}` }) as unknown as Order);

export function tutorialSettings(def: TutorialDef, map: MapDef, looks: TutorialLooks = {}): LobbySettings {
  const r = def.recipe.rules;
  return {
    mapId: map.id,
    bots: def.recipe.bots,
    botLevel: def.recipe.botLevel,
    luck: defaultRules.combat.luck,
    fog: r.fog ?? true,
    mode: "classic",
    // No timer in a lesson.
    turnSeconds: null,
    fate: r.fate ?? false,
    diplomacy: r.diplomacy ?? false,
    ...(looks.house !== undefined ? { house: looks.house } : {}),
    ...(looks.leaderName ? { leaderName: looks.leaderName } : {}),
  };
}

/** Lay the recipe's `place` over a saved game's state (a copy), and bring the walls and what everyone has seen up to date. */
function placed(def: TutorialDef, map: MapDef, save: SaveFile): SaveFile {
  const p = def.recipe.place;
  if (!p) return save;
  const state = structuredClone(save.state);
  const ctx = { map, rules: defaultRules };
  for (const [id, t] of Object.entries(p.territories ?? {})) {
    const at = state.territories[id];
    if (!at) throw new Error(`Tutorial ${def.id}: no territory ${id} on ${map.id}`);
    if (t.owner !== undefined) {
      if (t.owner !== null && !state.players.some((x) => x.id === t.owner)) throw new Error(`Tutorial ${def.id}: no player ${t.owner}`);
      at.owner = t.owner;
    }
    if (t.troops !== undefined) at.troops = t.troops;
    if (t.culture !== undefined) at.culture = t.culture;
    if (t.building !== undefined) (at.building = t.building), (at.construction = null);
  }
  const you = state.players.find((x) => x.id === "you")!;
  if (p.you?.gold !== undefined) you.gold = p.you.gold;
  if (p.you?.spoils) you.spoils = p.you.spoils as SpoilsMark[];
  updateWalls(ctx, state.territories);
  updateIntel(ctx, state);
  // (The game from its setup no longer replays to this state, so the history goes.)
  const { history: _gone, ...rest } = save;
  return { ...rest, state };
}

/**
 * The saved game a tutorial starts from. `now` stamps the save (and the game's clock); it never changes the game.
 */
export function buildTutorial(def: TutorialDef, map: MapDef, looks: TutorialLooks = {}, now: () => number = () => 0): SaveFile {
  if (map.id !== def.recipe.map) throw new Error(`Tutorial ${def.id} is on ${def.recipe.map}, not ${map.id}`);
  const fresh = new LocalGame(map, tutorialSettings(def, map, looks), def.recipe.seed, now);
  let save = placed(def, map, fresh.snapshot());
  for (const [i, turn] of (def.recipe.turns ?? []).entries()) {
    const g = LocalGame.restore(map, save, now);
    g.lockIn(ordersOf(turn, -(i + 1)), g.turn);
    save = g.snapshot();
  }
  return save;
}
