import { describe, expect, it } from "vitest";
import { defaultRules } from "@conquerra/content";
import { MapDef } from "@conquerra/content/schemas";
import { maps } from "@conquerra/content/maps";
import { createGame, layoutFor, replaySavedGame, resolveTurn, stateFingerprint, type GameContext } from "../src";

/**
 * Session 34b: layout versions. A later version replaces some table sizes' capital layouts; a game's setup records the
 * version it was dealt from, and a setup without one (every game made before) is dealt from version 1, so a running
 * game keeps its spots and its history replays as it was played.
 */
const base = maps.embervale!;
const own = base.capitalLayouts!.find((l) => l.players === 4)!;
const free = base.capitalSlots.filter((s) => !own.slots.includes(s));
const moved = { players: 4, slots: [free[0]!, ...own.slots.slice(1)], bonus: { [free[0]!]: 3 } };
const map: MapDef = MapDef.parse({ ...base, layoutVersions: [{ version: 2, layouts: [moved] }] });
const ctx: GameContext = { map, rules: defaultRules };
const players = [1, 2, 3, 4].map((i) => ({ id: `p${i}`, name: `P${i}` }));

describe("layout versions (session 34b)", () => {
  it("layoutFor: version 2 has the new layout, version 1 (and no version) the map's own; a count version 2 doesn't list falls back", () => {
    expect(layoutFor(map, 4, 2)).toEqual(moved);
    expect(layoutFor(map, 4, 1)).toEqual(own);
    expect(layoutFor(map, 4)).toEqual(own);
    expect(layoutFor(map, 4, 9)).toEqual(moved);
    expect(layoutFor(map, 5, 2)).toEqual(base.capitalLayouts!.find((l) => l.players === 5));
  });

  it("a new game dealt from version 2 sits on the new spots, with the new start bonus on turn 1", () => {
    for (const seed of ["a", "b", "c"]) {
      const s = createGame(ctx, { gameId: "g", seed, players, startBonus: true, layouts: 2 });
      expect(s.players.map((p) => p.capital).sort()).toEqual([...moved.slots].sort());
      const at = s.players.find((p) => p.capital === free[0])!;
      expect(s.territories[free[0]!]!.troops).toBe(defaultRules.setup.startTroops + 3);
      expect(at.startBonus).toBe(3);
    }
  });

  it("a setup without a version (a game made before) is dealt exactly as before: the same spots, the same game", () => {
    const old = createGame(ctx, { gameId: "g", seed: "run", players, startBonus: true });
    const before = createGame({ map: base, rules: defaultRules }, { gameId: "g", seed: "run", players, startBonus: true });
    expect(old.players.map((p) => p.capital)).toEqual(before.players.map((p) => p.capital));
    expect(stateFingerprint(old)).toBe(stateFingerprint(before));
    // Its history replays on the map with version 2 attached, turn after turn.
    let s = old;
    const turns = [{}, {}, {}];
    for (const orders of turns) s = resolveTurn(ctx, s, orders).state;
    expect(replaySavedGame(ctx, { setup: { gameId: "g", seed: "run", players, startBonus: true }, turns }, stateFingerprint(s)).matches).toBe(true);
  });

  it("the schema checks a later version's layouts like the map's own", () => {
    expect(() => MapDef.parse({ ...base, layoutVersions: [{ version: 2, layouts: [{ players: 4, slots: ["t01", "t01", "t02", "t03"] }] }] })).toThrow();
    expect(() => MapDef.parse({ ...base, layoutVersions: [{ version: 1, layouts: [moved] }] })).toThrow();
  });
});
