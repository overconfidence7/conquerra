import { describe, expect, it } from "vitest";
import { defaultRules, maps, suggestedMode } from "../src";

describe("content", () => {
  it("rules parse", () => {
    expect(defaultRules.combat.luck).toBe(0.3);
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
