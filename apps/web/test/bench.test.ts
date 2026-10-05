import { defaultRules } from "@conquerra/content";
import { describe, expect, it } from "vitest";
import { benchView, BUILDINGS, DECOR_VARIANTS, GROUNDS, groundSamplerMap, houseGridMap, SHEET_COLUMNS, SPECIALISTS, spriteSheetMap } from "../src/lab/bench/benchMaps";

describe("art test bench maps", () => {
  it("every House sits on every ground", () => {
    const houses = ["Azure", "Gules", "Or", "Vert", "Purpure", "Tenné", "Teal", "Murrey", "Argent", "Sable"];
    const map = houseGridMap(houses);
    expect(map.territories).toHaveLength(houses.length * GROUNDS.length);
    const { view } = benchView(map, defaultRules, (_, i) => ({ seat: Math.floor(i / GROUNDS.length) }));
    const owners = new Set(Object.values(view.territories).map((t) => (t.detail === "full" ? t.owner : null)));
    expect(owners.size).toBe(houses.length);
    // Each tile's ground is the one it's named after.
    const g = map.geometry!;
    for (const t of g.territories) {
      const name = map.territories.find((d) => d.id === t.id)!.name;
      const c = Math.floor(t.label.x / g.biome.cellSize), r = Math.floor(t.label.y / g.biome.cellSize);
      const code = g.biome.data[r * g.biome.cols + c];
      expect(name.endsWith(Object.entries({ g: "grass", a: "farmland", f: "forest", h: "hills", r: "rock", s: "snow", w: "swamp", d: "sand" }).find(([k]) => k === code)![1])).toBe(true);
    }
  });

  it("every pair of grounds touches in the sampler, plus coasts and a river", () => {
    const map = groundSamplerMap();
    const g = map.geometry!;
    const pairs = new Set<string>();
    const at = (i: number, j: number) => g.biome.data[j * g.biome.cols + i]!;
    for (let j = 0; j < g.biome.rows - 1; j++)
      for (let i = 0; i < g.biome.cols - 1; i++)
        for (const [a, b] of [[at(i, j), at(i + 1, j)], [at(i, j), at(i, j + 1)]] as const) if (a !== b) pairs.add([a, b].sort().join(""));
    const land = "gafhrswd";
    for (let x = 0; x < land.length; x++) for (let y = x + 1; y < land.length; y++) expect(pairs.has([land[x], land[y]].sort().join("")), `${land[x]}${land[y]}`).toBe(true);
    expect([...pairs].some((p) => p.includes("o"))).toBe(true); // a coast
    expect(g.rivers).toHaveLength(1);
  });

  it("the sprite sheet has every decoration variant, every building built and being built, and every specialist, on every ground", () => {
    const map = spriteSheetMap();
    const decor = map.geometry!.decorations;
    for (const [kind, n] of Object.entries(DECOR_VARIANTS)) for (let v = 1; v <= n; v++) expect(decor.filter((d) => d.kind === kind && d.v === v)).toHaveLength(GROUNDS.length);
    expect(SHEET_COLUMNS.filter((c) => "building" in c)).toHaveLength(BUILDINGS.length * 2);
    expect(map.maxPlayers).toBe(GROUNDS.length);
    expect(SPECIALISTS).toHaveLength(5);
  });
});
