import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { createGame, indexMap, viewFor, type GameContext } from "@conquerra/engine";
import { knownMap, provinceOpen } from "@conquerra/bots";
import { describe, expect, it } from "vitest";
import { provinceLine } from "../src/map/card";
import { isUnknown, provinceSize } from "../src/map/status";

/**
 * Session 32: under blackout a person can't count a province's land they've never seen. The card and the map's plaque
 * say "you hold 2 of ?" while a province's known land borders the cloud, and the bots count the same way.
 */
describe("a province reaching into the cloud (session 32)", () => {
  const ctx: GameContext = { map: maps.embervale!, rules: defaultRules };
  const game = (fog: true | "blackout") => createGame(ctx, { gameId: "g", seed: "known", players: ["p1", "p2", "p3", "p4"].map((id) => ({ id, name: id })), settings: { fog } });

  it("says \"of ?\" exactly when the bots count it as open, and its true size with standard fog", () => {
    const blackout = viewFor(ctx, game("blackout"), "p1");
    const standard = viewFor(ctx, game(true), "p1");
    const known = knownMap(ctx.map, blackout);
    const idx = indexMap(ctx.map);
    let open = 0;
    for (const p of ctx.map.provinces) {
      const all = ctx.map.territories.filter((t) => t.province === p.id).length;
      expect(provinceSize(ctx.map, standard, p.id)).toBe(all);
      const seen = ctx.map.territories.some((t) => t.province === p.id && !isUnknown(blackout, t.id));
      if (!seen) continue;
      const size = provinceSize(ctx.map, blackout, p.id);
      expect(size === null).toBe(provinceOpen(known, p.id));
      // A province with land you haven't seen is always open (provinces are joined up).
      if (ctx.map.territories.some((t) => t.province === p.id && isUnknown(blackout, t.id))) expect(size).toBeNull();
      if (size === null) open++;
    }
    expect(open).toBeGreaterThan(0);
    expect(idx.ids.length).toBe(ctx.map.territories.length);
    expect(provinceLine("The Oak Downs", 3, 2, null)).toBe("The Oak Downs +3: you hold 2 of ?");
    expect(provinceLine("The Oak Downs", 3, 0, null)).toBe("The Oak Downs +3: you hold none of ?");
    expect(provinceLine("The Oak Downs", 3, 5, 5)).toBe("The Oak Downs +3: you hold all 5");
  });
});
