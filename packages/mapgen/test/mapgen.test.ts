import { BIOME_CODES, defaultRules, type Biome, type MapDef } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { indexMap } from "@conquerra/engine";
import { beforeEach, describe, expect, it } from "vitest";

// Map making is a few seconds of solid work: let the test runner catch up before each test.
beforeEach(() => new Promise((r) => setTimeout(r, 0)));
import embervaleNames from "../names/embervale.json";
import greatmarchNames from "../names/greatmarch.json";
import { applyRenames, borderLengths, checkMap, DECORATION_BIOMES, MIN_BORDER_CHECK, MIN_PASS_CHECK, fromBase64, generateMap, insideRings, LABEL_CLEAR, MAP_CONFIGS, TERRAIN_BIOMES } from "../src";

const byCode = new Map(Object.entries(BIOME_CODES).map(([b, c]) => [c, b as Biome]));
const biomeAt = (m: MapDef, x: number, y: number): Biome => {
  const g = m.geometry!.biome;
  const c = Math.min(g.cols - 1, Math.floor(x / g.cellSize)), r = Math.min(g.rows - 1, Math.floor(y / g.cellSize));
  return byCode.get(g.data[r * g.cols + c]!)!;
};
const config = (id: string) => MAP_CONFIGS.find((m) => m.id === id)!;
// Every official map, in the lobby's order.
const testMaps = MAP_CONFIGS.map((c) => maps[c.id]!);

describe("map maker", () => {
  it("the same seed gives byte-identical output, and the committed maps are exactly what it makes (plus Nate's renames)", () => {
    const a = JSON.stringify(generateMap(config("embervale"), defaultRules).map);
    const b = JSON.stringify(generateMap(config("embervale"), defaultRules).map);
    expect(a).toBe(b);
    const built = (id: string, names: { renames: Record<string, string> }) => JSON.stringify(applyRenames(generateMap(config(id), defaultRules).map, names.renames).map);
    expect(built("embervale", embervaleNames)).toBe(JSON.stringify(maps.embervale));
    expect(built("greatmarch", greatmarchNames)).toBe(JSON.stringify(maps.greatmarch));
  }, 60_000);

  it("every official map's committed file is exactly what its recipe makes, and the lobby lists them all", () => {
    expect(MAP_CONFIGS.map((c) => c.id)).toEqual(["embervale", "greatmarch", "shattered-isles", "twin-realms", "moon-coast", "ringsea", "crownlands", "wyrmland", "ashwing", "sundered-crowns", "krakenmere", "rootholm"]);
    expect(Object.keys(maps).sort()).toEqual(MAP_CONFIGS.map((c) => c.id).sort());
    for (const c of MAP_CONFIGS.slice(2)) expect(JSON.stringify(generateMap(c, defaultRules).map), c.id).toBe(JSON.stringify(maps[c.id]));
  }, 180_000);

  it("renames places from the names file, and flags names that aren't on the map", () => {
    const m = maps.embervale!;
    const t = m.territories[0]!.name, p = m.provinces[0]!.name, w = m.geometry!.water[0]!.name;
    const { map, unknown } = applyRenames(m, { [t]: "Kingsbridge", [p]: "The Crownlands", [w]: "The Glass Sea", Nowhereville: "X" });
    expect(map.territories[0]!.name).toBe("Kingsbridge");
    expect(map.provinces[0]!.name).toBe("The Crownlands");
    expect(map.geometry!.water[0]!.name).toBe("The Glass Sea");
    expect(unknown).toEqual(["Nowhereville"]);
    expect(m.territories[0]!.name).toBe(t); // the original is untouched
    expect(() => applyRenames(m, { [t]: m.territories[1]!.name })).toThrow(/Two places/);
  });

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

  it("has no hairline borders, and every pass is wide enough to see at Mid zoom", () => {
    const lengths = borderLengths(map);
    for (const b of map.borders) {
      if (b.type === "sea") continue;
      const l = lengths.get(`${b.a}|${b.b}`)!;
      expect(l, `${b.a}|${b.b} (${b.type})`).toBeGreaterThanOrEqual(b.type === "pass" ? MIN_PASS_CHECK : MIN_BORDER_CHECK);
    }
  });

  it("the checks catch a hairline border and a narrow pass", () => {
    const c = config(id);
    const limits = { minChokePoints: c.minChokePoints!, minSeaLanes: c.minSeaLanes };
    const shrink = (type: "pass" | "normal") => {
      const b = map.borders.find((x) => x.type === type)!;
      const broken = structuredClone(map);
      const line = broken.geometry!.borderLines.find((l) => l.a === b.a && l.b === b.b)!;
      line.lines = [line.lines[0]!.slice(0, 4).map((v, i) => (i < 2 ? v : line.lines[0]![i - 2]! + 1))];
      return checkMap(broken, defaultRules, limits).problems.join("; ");
    };
    expect(shrink("normal")).toMatch(/hairline border/);
    expect(shrink("pass")).toMatch(/the pass between .* is only/);
  });

  it("has the territories and provinces its recipe asks for", () => {
    expect(map.territories.length).toBe(config(id).territories);
    expect(map.provinces.length).toBe(config(id).provinces);
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
    const problems: string[] = [];
    for (const d of geo.decorations) {
      const b = biomeAt(map, d.x, d.y);
      if (b === "shallow" || b === "deep") problems.push(`${d.kind} in water at ${d.x},${d.y}`);
      if (!DECORATION_BIOMES[d.kind].includes(b)) problems.push(`${d.kind} on ${b} at ${d.x},${d.y}`);
      for (const t of geo.territories)
        if (Math.hypot(t.label.x - d.x, t.label.y - d.y) < LABEL_CLEAR) problems.push(`${d.kind} on ${t.id}'s banner`);
    }
    expect(problems).toEqual([]);
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
    // The Crownlands has none: its recipe asks for 5, but the crown's land never finds a downhill run long enough.
    if (id !== "crownlands") expect(geo.rivers.length).toBeGreaterThan(0);
    for (const r of geo.rivers) {
      const heights: number[] = [];
      for (let i = 0; i < r.path.length; i += 2) {
        const v = h[Math.floor(r.path[i + 1]! / cellSize) * cols + Math.floor(r.path[i]! / cellSize)]!;
        if (v > seaLevel) heights.push(v);
      }
      for (let i = 1; i < heights.length; i++) expect(heights[i]).toBeLessThanOrEqual(heights[i - 1]!);
      expect(heights[heights.length - 1]).toBeLessThan(heights[0]!);
    }
    expect(map.borders.some((b) => b.type === "river")).toBe(geo.rivers.length > 0);
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
      // Only look at squares inside the territory's bounding box.
      const xs = t.rings.flatMap((r) => r.filter((_, i) => i % 2 === 0)), ys = t.rings.flatMap((r) => r.filter((_, i) => i % 2 === 1));
      const c0 = Math.max(0, Math.floor(Math.min(...xs) / cellSize)), c1 = Math.min(cols - 1, Math.floor(Math.max(...xs) / cellSize));
      const r0 = Math.max(0, Math.floor(Math.min(...ys) / cellSize)), r1 = Math.min(rows - 1, Math.floor(Math.max(...ys) / cellSize));
      let match = 0, total = 0;
      for (let r = r0; r <= r1; r++)
        for (let c = c0; c <= c1; c++) {
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
