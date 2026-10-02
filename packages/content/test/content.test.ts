import { describe, expect, it } from "vitest";
import { defaultRules, maps } from "../src";

describe("content", () => {
  it("rules parse", () => {
    expect(defaultRules.combat.luck).toBe(0.3);
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
