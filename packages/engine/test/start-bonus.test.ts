import { describe, expect, it } from "vitest";
import { defaultRules, MapDef } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { createGame, makeSave, readSave, stateFingerprint, STATE_VERSION, viewFor, type GameContext } from "../src";

/** Session 23 (Nate, Oct 9 and 10): a harder capital spot starts with extra troops, set per map, table size and spot. */
const base = maps.embervale!;
const layout = base.capitalLayouts!.find((l) => l.players === 4)!;
const weak = layout.slots[1]!;
const map: MapDef = { ...base, capitalLayouts: base.capitalLayouts!.map((l) => (l.players === 4 ? { ...l, bonus: { [weak]: 4 } } : l)) };
const ctx: GameContext = { map, rules: defaultRules };
const players = [1, 2, 3, 4].map((i) => ({ id: `p${i}`, name: `P${i}` }));
const start = (seed: string, startBonus = true) => createGame(ctx, { gameId: "g", seed, players, ...(startBonus ? { startBonus } : {}) });

describe("the start bonus", () => {
  it("the spot's capital starts with the extra troops, whoever sits there, and the player knows it", () => {
    for (const seed of ["a", "b", "c", "d", "e"]) {
      const s = start(seed);
      const at = s.players.find((p) => p.capital === weak)!;
      expect(s.territories[weak]!.troops).toBe(defaultRules.setup.startTroops + 4);
      expect(at.startBonus).toBe(4);
      expect(viewFor(ctx, s, at.id).me.startBonus).toBe(4);
      // Nobody else gets one, and no spot ever gets less than today.
      for (const p of s.players.filter((x) => x !== at)) {
        expect(p.startBonus).toBeUndefined();
        expect(s.territories[p.capital]!.troops).toBe(defaultRules.setup.startTroops);
      }
    }
  });

  it("is deterministic: the same seed, the same game", () => {
    expect(stateFingerprint(start("same"))).toBe(stateFingerprint(start("same")));
  });

  it("a setup that doesn't ask for it (an older save's history) starts exactly as before, so it replays as it was played", () => {
    const old = start("hist", false);
    expect(old.territories[weak]!.troops).toBe(defaultRules.setup.startTroops);
    expect(old.players.every((p) => p.startBonus === undefined)).toBe(true);
    const plain = createGame({ map: base, rules: defaultRules }, { gameId: "g", seed: "hist", players });
    expect(stateFingerprint(old)).toBe(stateFingerprint(plain));
  });

  it("saves carry it; an older save (state version 12) loads as before", () => {
    const s = start("save");
    const save = makeSave(ctx, s, "p1", 0);
    const back = readSave(JSON.parse(JSON.stringify(save)));
    expect(back.ok && back.save.state.players.map((p) => p.startBonus)).toEqual(s.players.map((p) => p.startBonus));
    expect(STATE_VERSION).toBe(13);
    const older = readSave(JSON.parse(JSON.stringify({ ...save, state: { ...start("save", false), version: 12 } })));
    expect(older.ok).toBe(true);
    if (older.ok) expect(older.save.state.players.every((p) => p.startBonus === undefined)).toBe(true);
  });

  it("the map data: a bonus only on a spot of that layout, 1 to 6 troops", () => {
    const bad = (bonus: Record<string, number>) => MapDef.safeParse({ ...base, capitalLayouts: [{ ...layout, bonus }] }).success;
    expect(bad({ [weak]: 6 })).toBe(true);
    expect(bad({ [weak]: 7 })).toBe(false);
    expect(bad({ [weak]: 0 })).toBe(false);
    expect(bad({ [base.territories.find((t) => !layout.slots.includes(t.id))!.id]: 2 })).toBe(false);
  });
});
