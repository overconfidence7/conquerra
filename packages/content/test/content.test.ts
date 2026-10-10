import { describe, expect, it } from "vitest";
import { defaultRules, mapCatalog, marshalData, suggestedMode } from "../src";
import { maps } from "../src/maps";

describe("content", () => {
  it("rules parse", () => {
    expect(defaultRules.combat.luck).toBe(0.3);
  });
  it("the Marshal's six personalities parse (session 17; their voices are in the line library since session 22)", () => {
    expect(marshalData.personalities.map((p) => p.id)).toEqual(["conqueror", "blitzer", "turtle", "schemer", "opportunist", "merchant"]);
    for (const p of marshalData.personalities) expect(p.title).toMatch(/^the [A-Z]/);
  });
  it("every map lists the player counts it suits (about 6–7 territories each at the top end)", () => {
    for (const m of Object.values(maps)) {
      const r = m.recommendedPlayers;
      expect(r.min).toBeGreaterThanOrEqual(m.minPlayers);
      expect(r.max).toBeLessThanOrEqual(m.maxPlayers);
      expect(r.min).toBeLessThanOrEqual(r.max);
      expect(m.territories.length / r.max).toBeGreaterThanOrEqual(6);
    }
    expect(maps.embervale!.recommendedPlayers).toEqual({ min: 4, max: 6 });
  });
  it("suggests Conquest for 8+ players and Classic below", () => {
    expect(suggestedMode(2)).toBe("classic");
    expect(suggestedMode(7)).toBe("classic");
    expect(suggestedMode(8)).toBe("conquest");
    expect(suggestedMode(10)).toBe("conquest");
    expect(suggestedMode(4, { ...defaultRules, game: { ...defaultRules.game, conquestSuggestedFromPlayers: 4 } })).toBe("conquest");
  });
  it("embervale map is connected", () => {
    const m = maps.embervale!;
    const adj = new Map<string, string[]>();
    for (const b of m.borders) {
      adj.set(b.a, [...(adj.get(b.a) ?? []), b.b]);
      adj.set(b.b, [...(adj.get(b.b) ?? []), b.a]);
    }
    const seen = new Set([m.territories[0]!.id]);
    const q = [m.territories[0]!.id];
    while (q.length) for (const n of adj.get(q.shift()!) ?? []) if (!seen.has(n)) (seen.add(n), q.push(n));
    expect(seen.size).toBe(m.territories.length);
  });
});

describe("map catalog", () => {
  it("lists every built-in map exactly as the full map files describe them", () => {
    expect(mapCatalog.map((m) => m.id).sort()).toEqual(Object.keys(maps).sort());
    for (const c of mapCatalog) {
      const m = maps[c.id]!;
      expect(c).toEqual({ id: m.id, name: m.name, territories: m.territories.length, minPlayers: m.minPlayers, maxPlayers: m.maxPlayers, recommendedPlayers: m.recommendedPlayers });
    }
  });
});
