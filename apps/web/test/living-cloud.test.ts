import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { createGame, viewFor, type GameContext } from "@conquerra/engine";
import { describe, expect, it } from "vitest";
import { hitTester } from "../src/map/shapes";
import { isUnknown } from "../src/map/status";
import { livingSites, shownOver } from "../src/render/pixi/livingLand";
import { sceneryFor } from "../src/render/pixi/scenery";

/**
 * Session 33b: the living map's sprites (boats, sails, beams, flags, chimney smoke) stood over blackout's cloud, so a
 * boat gave away a sea lane you'd never seen and a flag or smoke a settlement. Now each shows only over known land.
 */
describe("the living map under blackout (session 33b)", () => {
  it.each(["greatmarch", "embervale"])("%s: every sprite that shows stands on known land, and with standard fog all show", (id) => {
    const ctx: GameContext = { map: maps[id]!, rules: defaultRules };
    const game = (fog: true | "blackout") => createGame(ctx, { gameId: "g", seed: "living", players: ["p1", "p2", "p3", "p4"].map((p) => ({ id: p, name: p })), settings: { fog } });
    const blackout = viewFor(ctx, game("blackout"), "p1");
    const standard = viewFor(ctx, game(true), "p1");
    const unknown = ctx.map.territories.filter((t) => isUnknown(blackout, t.id)).length;
    expect(unknown).toBeGreaterThan(ctx.map.territories.length / 2);

    const sites = livingSites(ctx.map, sceneryFor(ctx.map).landmarks);
    const hit = hitTester(ctx.map.geometry!);
    const all = [
      ...sites.boats.map((b) => ({ ...b, kind: "boat" })),
      ...sites.windmills.map((w) => ({ x: w.landmark.x, y: w.landmark.y, lands: w.lands, kind: "sails" })),
      ...sites.lighthouses.map((w) => ({ x: w.landmark.x, y: w.landmark.y, lands: w.lands, kind: "beam" })),
      ...sites.flags.map((f) => ({ ...f, kind: "flag" })),
      ...sites.chimneys.map((c) => ({ ...c, kind: "chimney" })),
    ];
    expect(sites.flags.length).toBeGreaterThan(0);
    expect(sites.chimneys.length).toBeGreaterThan(0);
    let hidden = 0;
    for (const s of all) {
      expect(shownOver(standard, s.lands)).toBe(true);
      if (!shownOver(blackout, s.lands)) {
        hidden++;
        continue;
      }
      // Shown under blackout: the land it stands for is known, and so is the land right under it (if any).
      for (const t of s.lands) expect(isUnknown(blackout, t), `${s.kind} on ${t}`).toBe(false);
      const under = hit.at(s.x, s.y);
      if (under && s.kind !== "boat") expect(isUnknown(blackout, under), `${s.kind} over ${under}`).toBe(false);
    }
    expect(hidden).toBeGreaterThan(all.length / 2);
    // A boat shows only once both ends of its lane are known.
    for (const b of sites.boats) expect(shownOver(blackout, b.lands)).toBe(b.lands.every((t) => !isUnknown(blackout, t)));
  });
});
