import { BIOME_CODES } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { describe, expect, it } from "vitest";
import { insideRings } from "../src/map/shapes";
import { LANDMARK_KINDS, sceneryFor } from "../src/render/pixi/scenery";

const all = Object.values(maps);
const biomeAt = (m: (typeof all)[number], x: number, y: number) => {
  const b = m.geometry!.biome;
  return b.data[Math.floor(y / b.cellSize) * b.cols + Math.floor(x / b.cellSize)];
};

describe("painted scenery (ranges, cliffs, bridges, gates, landmarks, forests)", () => {
  it("is the same every time for the same map, and never uses Math.random", () => {
    const real = Math.random;
    Math.random = () => {
      throw new Error("Math.random used");
    };
    try {
      const a = sceneryFor(maps.greatmarch!), b = sceneryFor(maps.greatmarch!);
      const flat = (s: ReturnType<typeof sceneryFor>) => JSON.stringify({ ...s, hidden: [...s.hidden], treeKind: [...s.treeKind] });
      expect(flat(a)).toBe(flat(b));
      expect(flat(a)).not.toBe(flat(sceneryFor(maps.embervale!)));
    } finally {
      Math.random = real;
    }
  });

  it.each(all.map((m) => [m.id, m] as const))("%s: ranges are chains of ridges and peaks that leave every pass open", (_, map) => {
    const g = map.geometry!;
    const s = sceneryFor(map);
    if (g.mountains.length) {
      expect(s.ranges.filter((r) => r.kind === "ridge").length).toBeGreaterThan(0);
      expect(s.ranges.filter((r) => r.kind === "peak").length).toBeGreaterThan(0);
    }
    for (const p of g.passes)
      for (const r of s.ranges) {
        const aspect = r.kind === "ridge" ? 0.55 : 0.82;
        const covers = p.x > r.x - r.w / 2 && p.x < r.x + r.w / 2 && p.y > r.y - r.w * aspect * 0.88 && p.y < r.y + r.w * aspect * 0.12;
        expect(covers, `${r.kind} at ${r.x},${r.y} covers the pass at ${p.x},${p.y}`).toBe(false);
      }
    // Every piece stands on its range, and the scattered peaks inside ranges give way to the chain.
    for (const r of s.ranges) expect(g.mountains.some((m) => insideRings(m.rings, r.x, r.y - 2) || insideRings(m.rings, r.x, r.y - r.w * 0.3))).toBe(true);
    g.decorations.forEach((d, i) => {
      if (d.kind === "peak" && g.mountains.some((m) => insideRings(m.rings, d.x, d.y))) expect(s.hidden.has(i)).toBe(true);
    });
    // One gate on every pass road.
    expect(s.gates.map((x) => [x.x, x.y])).toEqual(g.passes.map((p) => [p.x, p.y]));
  }, 30000); // (The 200-territory maps take a few seconds when the whole suite runs at once.)

  it.each(all.map((m) => [m.id, m] as const))("%s: landmarks are few, on suitable ground, and clear of capitals, sites, passes, banners and plaques", (_, map) => {
    const g = map.geometry!;
    const s = sceneryFor(map);
    const want = Math.max(1, Math.round(map.territories.length / 15));
    expect(s.landmarks.length).toBeGreaterThanOrEqual(1);
    expect(s.landmarks.length).toBeLessThanOrEqual(want);
    const ground: Record<string, string[]> = { lighthouse: ["g", "h", "d", "r"], windmill: ["a"], stones: ["g", "h"], ruins: ["g", "a", "h", "f", "d", "w"] };
    for (const l of s.landmarks) {
      expect(LANDMARK_KINDS).toContain(l.kind);
      expect(ground[l.kind]).toContain(biomeAt(map, l.x, l.y));
      for (const t of g.territories) {
        expect(Math.hypot(t.label.x - l.x, t.label.y - l.y)).toBeGreaterThan(Math.max(t.label.r, 24));
        expect(Math.hypot(t.site.x - l.x, t.site.y - l.y)).toBeGreaterThan(30);
        if (t.castle) expect(Math.hypot(t.castle.x - l.x, t.castle.y - l.y)).toBeGreaterThan(40);
      }
      for (const p of g.passes) expect(Math.hypot(p.x - l.x, p.y - l.y)).toBeGreaterThan(50);
    }
    // Lighthouses stand by the sea.
    for (const l of s.landmarks.filter((x) => x.kind === "lighthouse")) {
      const near = [0, 1, 2, 3, 4, 5, 6, 7].some((k) => {
        const c = biomeAt(map, l.x + Math.cos((k * Math.PI) / 4) * 24, l.y + Math.sin((k * Math.PI) / 4) * 24);
        return c === BIOME_CODES.shallow || c === BIOME_CODES.deep;
      });
      expect(near).toBe(true);
    }
  });

  it.each(all.map((m) => [m.id, m] as const))("%s: cliffs keep off sea lane landings; bridges sit on river borders; clearings are inside forests", (_, map) => {
    const g = map.geometry!;
    const s = sceneryFor(map);
    for (const c of s.cliffs)
      for (const l of g.seaLanes)
        for (const [x, y] of [[l.path[0]!, l.path[1]!], [l.path[l.path.length - 2]!, l.path[l.path.length - 1]!]] as const) expect(Math.hypot(c.x - x, c.y - y)).toBeGreaterThan(c.w);
    const riverBorders = map.borders.filter((b) => b.type === "river").length;
    expect(s.bridges.length).toBeLessThanOrEqual(riverBorders);
    if (riverBorders > 4) expect(s.bridges.length).toBeGreaterThan(0);
    for (const c of s.clearings) expect(biomeAt(map, c.x, c.y)).toBe(BIOME_CODES.forest);
  });

  it("most maps get a few cliffs on their high, rocky coasts, and there are both kinds of bridge", () => {
    const cliffs = all.map((m) => sceneryFor(m).cliffs.length);
    expect(cliffs.reduce((a, b) => a + b, 0)).toBeGreaterThan(15);
    expect(cliffs.filter((n) => n > 0).length).toBeGreaterThanOrEqual(6);
    const kinds = new Set(all.flatMap((m) => sceneryFor(m).bridges.map((b) => b.kind)));
    expect([...kinds].sort()).toEqual(["stone", "wood"]);
  }, 60_000); // (twelve maps since session 19, up to 200 territories)
});

describe("forests on the art test bench", () => {
  it("lone trees keep their kind (only trees inside a forest become pines or broadleaf by height and north)", async () => {
    const { spriteSheetMap } = await import("../src/lab/bench/benchMaps");
    const map = spriteSheetMap();
    expect(sceneryFor(map).treeKind.size).toBe(0);
    // ...while real forests do get the mix.
    expect(sceneryFor(maps.greatmarch!).treeKind.size).toBeGreaterThan(100);
  });
});
