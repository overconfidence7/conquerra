import { BIOME_CODES, MapDef, type Biome, type BuildingType, type Rules, type SpecialistType, type Terrain } from "@conquerra/content";
import { createGame, viewFor, type GameContext, type PlayerView, type TerritoryDetail } from "@conquerra/engine";

/**
 * Made-up maps for the art test bench (`?lab=bench`): plain map data, built here from a grid of tiles, so the game's
 * own renderer draws every ground, House, sprite and symbol at true game size. The renderer treats them like any
 * other map (no special cases). Session 11 judges its new art on these.
 */

export type DecorKind = "tree-conifer" | "tree-broadleaf" | "peak" | "hill" | "village" | "town";

export interface Tile {
  /** Shown as the territory's name (Near zoom and the card): what this tile is showing. */
  name: string;
  terrain: Terrain;
  /** The ground everywhere in the tile, or at each point (u and v from 0 to 1 across the tile). */
  ground: Biome | ((u: number, v: number) => Biome);
  /** Sprites, at (u, v) in the tile. */
  decor?: { kind: DecorKind; v: number; u: number; w: number }[];
  /** Province id (default: one province per row). */
  province?: string;
}

export interface GridSpec {
  id: string;
  name: string;
  /** Tile size in map units (a typical territory on Embervale is about 90 across). */
  tile: number;
  rows: Tile[][];
  /** Province names by id (default "Row 1", "Row 2", ...). */
  provinceNames?: Record<string, string>;
  /** Tiles (row, col) that can be capitals, one per player; they get a castle. */
  capitals?: [number, number][];
  /** A river: tile (row, col) it runs down through, into the sea below. */
  river?: [number, number];
}

const LAND_GROUNDS: Biome[] = ["grass", "farmland", "forest", "hills", "rock", "snow", "swamp", "sand"];
export const GROUNDS = LAND_GROUNDS;
export const TERRAIN_OF: Record<string, Terrain> = { grass: "plains", farmland: "plains", forest: "forest", hills: "hills", rock: "mountains", snow: "mountains", swamp: "swamp", sand: "plains" };
const HEIGHT_OF: Record<string, number> = { grass: 100, farmland: 98, forest: 106, hills: 140, rock: 180, snow: 210, swamp: 90, sand: 86, shallow: 66, deep: 36 };

/** A small repeatable wobble (so tile edges look drawn, and neighbours share exactly the same line). */
const hash = (a: number, b: number) => {
  let h = Math.imul(Math.round(a * 10) ^ 0x9e3779b1, 0x85ebca6b) ^ Math.imul(Math.round(b * 10) + 0x7f4a7c15, 0xc2b2ae35);
  h ^= h >>> 13;
  h = Math.imul(h, 0x27d4eb2f);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
};

/** Points along an edge from (x0, y0) to (x1, y1), wobbling sideways; the same points (reversed) either way. */
function edge(x0: number, y0: number, x1: number, y1: number, amp: number): number[] {
  const flip = x0 > x1 || (x0 === x1 && y0 > y1);
  const [ax, ay, bx, by] = flip ? [x1, y1, x0, y0] : [x0, y0, x1, y1];
  const n = 8, len = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / len, ny = (bx - ax) / len;
  const pts: number[] = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n, w = k === 0 || k === n ? 0 : (hash(ax + bx * 3 + k, ay + by * 7) - 0.5) * 2 * amp * Math.sin(Math.PI * t);
    pts.push(Math.round((ax + (bx - ax) * t + nx * w) * 10) / 10, Math.round((ay + (by - ay) * t + ny * w) * 10) / 10);
  }
  if (!flip) return pts;
  const r: number[] = [];
  for (let i = pts.length - 2; i >= 0; i -= 2) r.push(pts[i]!, pts[i + 1]!);
  return r;
}

const b64 = (bytes: Uint8Array) => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};

/** Build a whole MapDef (game data and drawing data) from a grid of tiles, ringed by sea. */
export function gridMap(spec: GridSpec): MapDef {
  const T = spec.tile, M = 70; // sea margin
  const rows = spec.rows.length, cols = spec.rows[0]!.length;
  const width = cols * T + 2 * M, height = rows * T + 2 * M;
  const id = (r: number, c: number) => `t${String(r * cols + c).padStart(3, "0")}`;
  const x0 = (c: number) => M + c * T, y0 = (r: number) => M + r * T;
  // Inside edges wobble; the coast is straight (the sea margin is drawn by the ground grid).
  const amp = (inside: boolean) => (inside ? T * 0.06 : 0);
  const ringOf = (r: number, c: number) => {
    const X0 = x0(c), X1 = x0(c + 1), Y0 = y0(r), Y1 = y0(r + 1);
    const top = edge(X0, Y0, X1, Y0, amp(r > 0)), right = edge(X1, Y0, X1, Y1, amp(c < cols - 1)), bottom = edge(X1, Y1, X0, Y1, amp(r < rows - 1)), left = edge(X0, Y1, X0, Y0, amp(c > 0));
    const ring = [...top, ...right.slice(2), ...bottom.slice(2), ...left.slice(2, -2)];
    return ring;
  };
  const prov = (r: number, c: number) => spec.rows[r]![c]!.province ?? `p${r}`;
  const capitals = spec.capitals ?? [];
  const isCapital = (r: number, c: number) => capitals.some(([a, b]) => a === r && b === c);

  // The ground grid and height map.
  const cell = 10;
  const gc = Math.ceil(width / cell), gr = Math.ceil(height / cell);
  let data = "";
  const heights = new Uint8Array(gc * gr);
  for (let j = 0; j < gr; j++)
    for (let i = 0; i < gc; i++) {
      const x = (i + 0.5) * cell, y = (j + 0.5) * cell;
      const c = Math.floor((x - M) / T), r = Math.floor((y - M) / T);
      let b: Biome;
      if (c < 0 || r < 0 || c >= cols || r >= rows) {
        const d = Math.max(M - x, x - (width - M), M - y, y - (height - M));
        b = d < 28 ? "shallow" : "deep";
      } else {
        const t = spec.rows[r]![c]!;
        b = typeof t.ground === "string" ? t.ground : t.ground((x - x0(c)) / T, (y - y0(r)) / T);
      }
      data += BIOME_CODES[b];
      heights[j * gc + i] = Math.max(0, Math.min(255, HEIGHT_OF[b]! + Math.round((hash(i, j) - 0.5) * 10)));
    }
  const territories: MapDef["territories"] = [];
  const geoT: NonNullable<MapDef["geometry"]>["territories"] = [];
  const decorations: NonNullable<MapDef["geometry"]>["decorations"] = [];
  const borders: MapDef["borders"] = [];
  const borderLines: NonNullable<MapDef["geometry"]>["borderLines"] = [];
  spec.rows.forEach((row, r) =>
    row.forEach((t, c) => {
      const cx = x0(c) + T / 2;
      territories.push({ id: id(r, c), name: t.name, province: prov(r, c), terrain: t.terrain, x: cx, y: y0(r) + T * 0.3 });
      geoT.push({
        id: id(r, c),
        rings: [ringOf(r, c)],
        label: { x: cx, y: y0(r) + T * 0.3, r: T * 0.22 },
        site: { x: x0(c) + T * 0.74, y: y0(r) + T * 0.5 },
        ...(isCapital(r, c) ? { castle: { x: x0(c) + T * 0.26, y: y0(r) + T * 0.52 } } : {}),
      });
      for (const d of t.decor ?? []) decorations.push({ kind: d.kind, v: d.v, x: Math.round((x0(c) + d.u * T) * 10) / 10, y: Math.round((y0(r) + d.w * T) * 10) / 10 });
      if (c + 1 < cols) {
        borders.push({ a: id(r, c), b: id(r, c + 1), type: "normal" });
        borderLines.push({ a: id(r, c), b: id(r, c + 1), lines: [edge(x0(c + 1), y0(r), x0(c + 1), y0(r + 1), amp(true))] });
      }
      if (r + 1 < rows) {
        borders.push({ a: id(r, c), b: id(r + 1, c), type: "normal" });
        borderLines.push({ a: id(r, c), b: id(r + 1, c), lines: [edge(x0(c), y0(r + 1), x0(c + 1), y0(r + 1), amp(true))] });
      }
    }),
  );
  decorations.sort((a, b) => a.y - b.y || a.x - b.x);
  const provIds = [...new Set(spec.rows.flatMap((row, r) => row.map((_, c) => prov(r, c))))];
  const provinceLabels = provIds.map((p) => {
    const cells = spec.rows.flatMap((row, r) => row.map((_, c) => [r, c] as const)).filter(([r, c]) => prov(r, c) === p);
    const xs = cells.map(([, c]) => c), ys = cells.map(([r]) => r);
    const xa = x0(Math.min(...xs)) + T * 0.15, xb = x0(Math.max(...xs) + 1) - T * 0.15, y = y0((Math.min(...ys) + Math.max(...ys) + 1) / 2) + T * 0.12;
    return { id: p, path: [xa, y, (xa + xb) / 2, y - T * 0.08, xb, y] };
  });
  const slots = capitals.length >= 2 ? capitals.map(([r, c]) => id(r, c)) : [id(0, 0), id(rows - 1, cols - 1)];
  const river = spec.river
    ? [{ id: "r0", name: "The Bench Water", path: [x0(spec.river[1]) + T * 0.5, y0(spec.river[0]) + T * 0.05, x0(spec.river[1]) + T * 0.42, y0(spec.river[0]) + T * 0.4, x0(spec.river[1]) + T * 0.58, y0(spec.river[0]) + T * 0.75, x0(spec.river[1]) + T * 0.5, height - M + 30] }]
    : [];
  return MapDef.parse({
    id: spec.id,
    name: spec.name,
    minPlayers: 2,
    maxPlayers: slots.length,
    recommendedPlayers: { min: 2, max: slots.length },
    territories,
    provinces: provIds.map((p, i) => ({ id: p, name: spec.provinceNames?.[p] ?? `Row ${i + 1}`, bonus: 2 })),
    borders,
    capitalSlots: slots,
    capitalLayouts: [{ players: slots.length, slots }],
    geometry: {
      width,
      height,
      biome: { cellSize: cell, cols: gc, rows: gr, data },
      heightMap: { cellSize: cell, cols: gc, rows: gr, seaLevel: 79, data: b64(heights) },
      provinceLabels,
      territories: geoT,
      water: [{ id: "w0", name: "The Bench Sea", kind: "sea", rings: [[0, 0, width, 0, width, height, 0, height], [M, M, M, height - M, width - M, height - M, width - M, M]], label: { x: width / 2, y: M / 2 } }],
      mountains: [],
      passes: [],
      rivers: river,
      seaLanes: [],
      borderLines,
      decorations,
    },
  });
}

/** Sprites of one kind scattered over a tile, every variant in turn. */
const scatter = (kind: DecorKind, variants: number, n: number, seed: number): Tile["decor"] =>
  Array.from({ length: n }, (_, i) => ({ kind, v: 1 + (i % variants), u: 0.14 + 0.72 * hash(seed, i), w: 0.5 + 0.42 * hash(i, seed + 3) }));

/** What a ground usually carries, for the House grid. */
function usualDecor(g: Biome, seed: number): Tile["decor"] {
  if (g === "forest") return [...scatter("tree-conifer", 3, 5, seed)!, ...scatter("tree-broadleaf", 3, 5, seed + 1)!];
  if (g === "hills") return scatter("hill", 3, 4, seed);
  if (g === "rock" || g === "snow") return scatter("peak", 4, 3, seed);
  if (g === "grass") return [{ kind: "village", v: 1 + (seed % 3), u: 0.32, w: 0.68 }, ...scatter("tree-broadleaf", 3, 2, seed)!];
  if (g === "farmland") return [{ kind: "village", v: 1 + ((seed + 1) % 3), u: 0.3, w: 0.7 }];
  return [];
}

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

/** Every House over every ground: one row per House, one column per ground. */
export function houseGridMap(houseNames: readonly string[]): MapDef {
  return gridMap({
    id: "bench-houses",
    name: "Bench: Houses on grounds",
    tile: 130,
    rows: houseNames.map((h, r) => LAND_GROUNDS.map((g, c) => ({ name: `${h} on ${g}`, terrain: TERRAIN_OF[g]!, ground: g, decor: usualDecor(g, r * 11 + c) }))),
    provinceNames: Object.fromEntries(houseNames.map((h, r) => [`p${r}`, h])),
    capitals: houseNames.map((_, r) => [r, 0] as [number, number]),
  });
}

/** Every pair of grounds touching (28 tiles), then a row of coasts with a river running down through hills. */
export function groundSamplerMap(): MapDef {
  const pairs: [Biome, Biome][] = [];
  for (let i = 0; i < LAND_GROUNDS.length; i++) for (let j = i + 1; j < LAND_GROUNDS.length; j++) pairs.push([LAND_GROUNDS[i]!, LAND_GROUNDS[j]!]);
  const COLS = 7;
  const rows: Tile[][] = [];
  for (let k = 0; k < pairs.length; k += COLS)
    rows.push(
      pairs.slice(k, k + COLS).map(([a, b], i) => ({
        name: `${cap(a)} | ${cap(b)}`,
        terrain: TERRAIN_OF[a]!,
        // A wavy diagonal split, so each pair meets along a long natural-looking line.
        ground: (u: number, v: number) => (u + 0.08 * Math.sin(v * 11 + i) + 0.05 * Math.sin(v * 27 + k) < 1 - v ? a : b),
      })),
    );
  // The coast row: each ground running down to a beach and the sea; the river runs through the hills.
  const coastGrounds: Biome[] = ["grass", "forest", "farmland", "hills", "rock", "snow", "swamp"];
  rows.push(
    coastGrounds.map((g, i) => ({
      name: g === "hills" ? "River through hills" : `${cap(g)} coast`,
      terrain: TERRAIN_OF[g]!,
      ground: (u: number, v: number) => (v > 0.82 + 0.06 * Math.sin(u * 9 + i) && g !== "rock" && g !== "snow" ? "sand" : g),
      ...(g === "hills" ? { decor: [{ kind: "hill" as const, v: 1, u: 0.22, w: 0.45 }, { kind: "hill" as const, v: 2, u: 0.8, w: 0.6 }] } : {}),
    })),
  );
  return gridMap({ id: "bench-grounds", name: "Bench: grounds", tile: 150, rows, river: [rows.length - 1, 3], provinceNames: { p0: "Pairs I", p1: "Pairs II", p2: "Pairs III", p3: "Pairs IV", p4: "Coasts" } });
}

export const DECOR_VARIANTS: Record<DecorKind, number> = { "tree-conifer": 3, "tree-broadleaf": 3, peak: 4, hill: 3, village: 3, town: 2 };
export const BUILDINGS: BuildingType[] = ["fort", "market", "barracks", "watchtower"];
export const SPECIALISTS: SpecialistType[] = ["cavalry", "siege", "scouts", "engineers", "healers"];

/**
 * The sprite sheet: one row per ground. Columns: each decoration kind (every variant in a line), each building
 * built, each building under construction, and the army with every specialist (Near zoom shows the figures).
 */
export const SHEET_COLUMNS = [...(Object.keys(DECOR_VARIANTS) as DecorKind[]).map((k) => ({ decor: k })), ...BUILDINGS.map((b) => ({ building: b, built: true })), ...BUILDINGS.map((b) => ({ building: b, built: false })), { figures: true }] as const;

export function spriteSheetMap(): MapDef {
  return gridMap({
    id: "bench-sprites",
    name: "Bench: sprite sheet",
    tile: 120,
    rows: LAND_GROUNDS.map((g) =>
      SHEET_COLUMNS.map((col) => {
        if ("decor" in col) {
          const n = DECOR_VARIANTS[col.decor];
          return { name: `${col.decor} on ${g}`, terrain: TERRAIN_OF[g]!, ground: g, decor: Array.from({ length: n }, (_, i) => ({ kind: col.decor, v: i + 1, u: (i + 0.5) / n, w: 0.82 })) };
        }
        if ("building" in col) return { name: `${col.building}${col.built ? "" : " (being built)"} on ${g}`, terrain: TERRAIN_OF[g]!, ground: g };
        return { name: `Army and specialists on ${g}`, terrain: TERRAIN_OF[g]!, ground: g };
      }),
    ),
    provinceNames: Object.fromEntries(LAND_GROUNDS.map((g, r) => [`p${r}`, cap(g)])),
    // A capital in each row's last tile (the army), so every row can show its own House.
    capitals: LAND_GROUNDS.map((_, r) => [r, SHEET_COLUMNS.length - 1] as [number, number]),
  });
}

/**
 * The view the bench shows: a new game on the map, with every territory set by `patch` (owner by seat number,
 * buildings, construction, specialists, culture). Seat i plays House i.
 */
export function benchView(map: MapDef, rules: Rules, patch: (id: string, index: number) => Partial<TerritoryDetail> & { seat?: number | null }): { ctx: GameContext; view: PlayerView } {
  const ctx: GameContext = { map, rules };
  const n = map.maxPlayers;
  const state = createGame(ctx, { gameId: "bench", seed: "bench", players: Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `Seat ${i + 1}` })), settings: { fog: false } });
  const view = viewFor(ctx, state, "p1");
  const territories: PlayerView["territories"] = {};
  map.territories.forEach((t, i) => {
    const base = view.territories[t.id]!;
    if (base.detail !== "full") return void (territories[t.id] = base);
    const { seat, ...rest } = patch(t.id, i);
    const owner = seat === undefined ? base.owner : seat === null ? null : `p${seat + 1}`;
    territories[t.id] = { ...base, troops: 6, owner, capitalOf: owner && base.capitalOf ? owner : null, leaders: [], ...rest };
  });
  return { ctx, view: { ...view, territories } };
}
