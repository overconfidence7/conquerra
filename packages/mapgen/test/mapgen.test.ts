import { BIOME_CODES, defaultRules, maps, type Biome, type MapDef } from "@conquerra/content";
import { indexMap } from "@conquerra/engine";
import { describe, expect, it } from "vitest";
import { checkMap, DECORATION_BIOMES, fromBase64, generateMap, insideRings, LABEL_CLEAR, MAP_CONFIGS, TERRAIN_BIOMES } from "../src";

const byCode = new Map(Object.entries(BIOME_CODES).map(([b, c]) => [c, b as Biome]));
const biomeAt = (m: MapDef, x: number, y: number): Biome => {
  const g = m.geometry!.biome;
  const c = Math.min(g.cols - 1, Math.floor(x / g.cellSize)), r = Math.min(g.rows - 1, Math.floor(y / g.cellSize));
  return byCode.get(g.data[r * g.cols + c]!)!;
};
const config = (id: string) => MAP_CONFIGS.find((m) => m.id === id)!;
const testMaps = [maps.embervale!, maps.greatmarch!];

describe("map maker", () => {
  it("the same seed gives byte-identical output, and the committed maps are exactly what it makes", () => {
    const a = JSON.stringify(generateMap(config("embervale"), defaultRules).map);
    const b = JSON.stringify(generateMap(config("embervale"), defaultRules).map);
    expect(a).toBe(b);
    expect(a).toBe(JSON.stringify(maps.embervale));
    expect(JSON.stringify(generateMap(config("greatmarch"), defaultRules).map)).toBe(JSON.stringify(maps.greatmarch));
  }, 60_000);

  it("never uses Math.random (only the seeded generator)", () => {
    const real = Math.random;
    Math.random = () => {
      throw new Error("Math.random used");
    };
    try {
      expect(() => generateMap({ ...config("embervale"), seed: "no-dice", maxAttempts: 3 }, defaultRules)).not.toThrow(/Math.random/);
    } finally {
      Math.random = real;
    }
  }, 60_000);

  it("a different seed gives a different map", () => {
    const m = generateMap({ ...config("embervale"), seed: "another-world" }, defaultRules).map;
    expect(JSON.stringify(m.geometry!.territories[0]!.rings)).not.toBe(JSON.stringify(maps.embervale!.geometry!.territories[0]!.rings));
  }, 60_000);
});

describe.each(testMaps.map((m) => [m.id, m] as const))("map %s", (id, map) => {
  const geo = map.geometry!;

  it("passes the map checks", () => {
    const c = config(id);
    const res = checkMap(map, defaultRules, { minChokePoints: c.minChokePoints!, minSeaLanes: c.minSeaLanes });
    expect(res.problems).toEqual([]);
  });

  it("keeps the territory count close to the old hand-made map", () => {
    expect(map.territories.length).toBe(id === "embervale" ? 40 : 80);
    expect(map.provinces.length).toBe(id === "embervale" ? 8 : 20);
  });

  it("sea lanes and passes come through as the right border types in the engine's graph", () => {
    const idx = indexMap(map);
    expect(geo.seaLanes.length).toBeGreaterThan(0);
    expect(geo.passes.length).toBeGreaterThan(0);
    for (const l of geo.seaLanes) expect(idx.border(l.a, l.b)).toBe("sea");
    for (const p of geo.passes) expect(idx.border(p.a, p.b)).toBe("pass");
    // ...and every sea or pass border in the graph is drawn.
    for (const b of map.borders) {
      if (b.type === "sea") expect(geo.seaLanes.some((l) => l.a === b.a && l.b === b.b)).toBe(true);
      if (b.type === "pass") expect(geo.passes.some((p) => p.a === b.a && p.b === b.b)).toBe(true);
    }
  });

  it("territories border only where they actually touch (sea lanes aside)", () => {
    const lines = new Set(geo.borderLines.map((l) => `${l.a}|${l.b}`));
    const land = new Set(map.borders.filter((b) => b.type !== "sea").map((b) => `${b.a}|${b.b}`));
    expect([...land].sort()).toEqual([...lines].sort());
  });

  it("decorations never sit in water or on a banner, and stay on their own kind of ground", () => {
    expect(geo.decorations.length).toBeGreaterThan(map.territories.length * 10);
    for (const d of geo.decorations) {
      const b = biomeAt(map, d.x, d.y);
      expect(b).not.toBe("shallow");
      expect(b).not.toBe("deep");
      expect(DECORATION_BIOMES[d.kind]).toContain(b);
      for (const t of geo.territories) expect(Math.hypot(t.label.x - d.x, t.label.y - d.y)).toBeGreaterThanOrEqual(LABEL_CLEAR);
    }
  });

  it("every label point is inside its territory with room for a banner", () => {
    for (const t of geo.territories) {
      expect(insideRings(t.rings, t.label.x, t.label.y)).toBe(true);
      expect(t.label.r).toBeGreaterThanOrEqual(14);
      expect(insideRings(t.rings, t.site.x, t.site.y)).toBe(true);
    }
    const slots = new Set(map.capitalSlots);
    for (const t of geo.territories) expect(t.castle !== undefined).toBe(slots.has(t.id));
  });

  it("rivers only flow downhill, and run along river borders", () => {
    const h = fromBase64(geo.heightMap.data);
    const { cols, cellSize, seaLevel } = geo.heightMap;
    expect(geo.rivers.length).toBeGreaterThan(0);
    for (const r of geo.rivers) {
      const heights: number[] = [];
      for (let i = 0; i < r.path.length; i += 2) {
        const v = h[Math.floor(r.path[i + 1]! / cellSize) * cols + Math.floor(r.path[i]! / cellSize)]!;
        if (v > seaLevel) heights.push(v);
      }
      for (let i = 1; i < heights.length; i++) expect(heights[i]).toBeLessThanOrEqual(heights[i - 1]!);
      expect(heights[heights.length - 1]).toBeLessThan(heights[0]!);
    }
    expect(map.borders.some((b) => b.type === "river")).toBe(true);
  });

  it("the height map agrees with the land: water at or below sea level, land above, mountains high", () => {
    const h = fromBase64(geo.heightMap.data);
    const { data } = geo.biome;
    expect(h.length).toBe(geo.heightMap.cols * geo.heightMap.rows);
    let rock = 0, rockN = 0, low = 0, lowN = 0;
    for (let i = 0; i < data.length; i++) {
      const b = byCode.get(data[i]!)!;
      if (b === "shallow" || b === "deep") expect(h[i]).toBeLessThanOrEqual(geo.heightMap.seaLevel);
      else expect(h[i]).toBeGreaterThan(geo.heightMap.seaLevel);
      if (b === "snow" || b === "rock") (rock += h[i]!), rockN++;
      if (b === "grass" || b === "farmland" || b === "sand") (low += h[i]!), lowN++;
    }
    expect(rock / rockN).toBeGreaterThan(low / lowN + 40);
  });

  it("the painting agrees with each territory's game terrain (most of its ground is that terrain's kind)", () => {
    const { cols, rows, cellSize } = geo.biome;
    for (const t of geo.territories) {
      const def = map.territories.find((x) => x.id === t.id)!;
      let match = 0, total = 0;
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const x = (c + 0.5) * cellSize, y = (r + 0.5) * cellSize;
          if (!insideRings(t.rings, x, y)) continue;
          total++;
          if (TERRAIN_BIOMES[def.terrain].includes(biomeAt(map, x, y))) match++;
        }
      expect(total).toBeGreaterThan(0);
      expect(match / total).toBeGreaterThanOrEqual(0.5);
    }
  });
});
