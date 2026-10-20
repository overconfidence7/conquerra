import { type BorderType, type Rules, type Terrain } from "@conquerra/content";
import { MapDef } from "@conquerra/content/schemas";
import { Rng, seedRng } from "@conquerra/engine";
import { applyBarriers, pairKey, pairOf, planBarriers, touching } from "./barriers";
import { findLayout } from "./capitals";
import { allDistances, checkMap, fairnessOf, fairnessTable, territoryIncome, type CheckResult } from "./checks";
import { bfsSteps, components, makeLand } from "./land";
import { makeSeaLanes } from "./lanes";
import { fixHairlines } from "./contacts";
import { buildMesh } from "./mesh";
import { Namer } from "./names";
import { buildArcs, ringsOf, tidy } from "./outline";
import { labelLine, labelPoint, placeDecorations, siteIn, CASTLE_CLEAR, type Spot } from "./places";
import { makeProvinces } from "./provinces";
import { makeRivers } from "./rivers";
import { makeShapeField, type LandShape } from "./shapes";
import { makeTerritories } from "./territories";
import { assignBiomes, assignTerrain, buildGrids, carveRivers, cellHeights, toBase64 } from "./terrain";
import { clamp, dist, r1 } from "./util";

export { checkMap, borderLengths, MIN_BORDER_CHECK, MIN_PASS_CHECK, chokePoints, landBridgeBorders, shapeArea, fairness, fairnessTable, fairnessOf, allDistances, territoryIncome, adjacency, exposureOf, type Exposure } from "./checks";
export { fromBase64, TERRAIN_BIOMES } from "./terrain";
export { DECORATION_BIOMES, LABEL_CLEAR } from "./places";
export { insideRings } from "./util";
export { mapPreviewSvg } from "./preview";
export { MAP_CONFIGS } from "./configs";
export { applyRenames, type NameFile } from "./renames";
export { LAND_SHAPES, SHAPE_NAMES, type LandShape } from "./shapes";
export { allMasks, MASKS, IMAGE_MASKS, type MaskDef } from "./masks";
export { recipeFor, SIZES, type Recipe } from "./recipes";
export * from "./random";
export { explainChecks, fairnessRows, sizeSpread, mapFingerprint, recipeToJson, recipeFromJson, type CheckRow, type FairnessRow, type SizeSpread } from "./report";

/** Bump when a change to the map maker would change its output. */
export const MAPGEN_VERSION = 2;

/**
 * Shared borders shorter than this (map units) are hairlines: the two territories stop touching (see contacts.ts).
 * A typical border is about 90; the check allows a little for smoothing.
 */
export const MIN_BORDER = 24;
/** A pass is kept open at least this wide (map units; about 22 px at the start of Mid zoom), where its border allows. */
export const MIN_PASS = 38;

/**
 * The map maker's stages (session 30), in the order they run. Territories are drawn before the ranges and the water
 * that cut them (a range runs along territory borders), so they come second.
 */
export const MAP_STAGES = ["land", "territories", "ranges", "rivers", "provinces", "capitals", "places", "names"] as const;
export type MapStage = (typeof MAP_STAGES)[number];

/**
 * Where each stage's random numbers come from (session 30).
 *  - "staged": each stage has its own stream, made from the seed and the stage's name ("<seed>|rivers"), so changing
 *    one stage (or its seed) never re-rolls another's. Random maps use this.
 *  - "shared": one stream for the whole map, in the order the stages draw from it, as the map maker always worked
 *    (the shape and the names had their own already). The twelve official maps were made this way and stay so.
 */
export type MapStreams = "staged" | "shared";

/** The random stream for each stage: its own (staged), or the one shared stream. */
function streamsFor(seed: string, mode: MapStreams, over: Partial<Record<MapStage | "shape", string>> = {}): (stage: MapStage | "shape") => Rng {
  const shared = new Rng(seedRng(seed));
  const own = new Map<string, Rng>();
  return (stage) => {
    // The shape and the names always had their own streams.
    if (mode === "shared" && stage !== "shape" && stage !== "names") return shared;
    let r = own.get(stage);
    if (!r) own.set(stage, (r = new Rng(seedRng(over[stage] ?? `${seed}|${stage}`))));
    return r;
  };
}

export interface MapGenOptions {
  id: string;
  name: string;
  seed: string;
  territories: number;
  provinces: number;
  players: { min: number; max: number; recommended: { min: number; max: number } };
  /**
   * Capital layouts chosen by hand for some table sizes (session 19: picked from the map's own capital spots with the
   * simulator, `apps/sim/scripts/s19-fair-seats.ts`, because spots that look fair on paper can win far more or less
   * often than others). By player count; every spot must be one of the map's capital spots.
   */
  capitals?: Record<number, string[]>;
  /**
   * The start bonus (session 23, sized with `apps/sim/scripts/s23-bonus.ts`): extra troops at the capital for a spot
   * that wins under half its fair share among equal bots. By player count, then spot (one of that layout's).
   */
  startBonus?: Record<number, Record<string, number>>;
  /** Share of the map that is water (default 0.38). */
  water?: number;
  /** Inland seas or big gulfs (default 1). */
  seas?: number;
  lakes?: number;
  islandChains?: number;
  /** Impassable mountain ranges, each with at least one pass (default 2). */
  mountainRanges?: number;
  /** Narrow straits cutting into the land, leaving a land bridge (default 0). */
  straits?: number;
  /** Extra sea lanes beyond the ones that join up islands (default 2). */
  minSeaLanes?: number;
  /** Sea lanes to try to add beyond the ones that join up islands (default 2). */
  seaLanes?: number;
  rivers?: number;
  /** The map is rejected unless it has at least this many choke points (default 5). */
  minChokePoints?: number;
  /** Width / height (default 1.45, or the shape's own). */
  aspect?: number;
  /** The land's overall shape (default "continent": one rounded landmass, as Embervale and Greatmarch). */
  shape?: LandShape;
  /** Which silhouette, for shape "mask" (see masks.ts). */
  mask?: string;
  /** Archipelago: how many islands. Inland sea and crescent: isles in the middle. */
  islands?: number;
  /** Twin continents: join them with a narrow land bridge (default: a coin toss). */
  landBridge?: boolean;
  /** How much the coast noise bends a shape, 0–1 (default about 0.5). Not used by "continent". */
  roughness?: number;
  /** Session 31, crescent: the bay's size (default 0.7) and offset (default 0.4), as `ShapeOptions`. */
  bite?: number;
  biteOffset?: number;
  /** Longest sea lane, in mesh cells (default 16; extra lanes up to 4 less). */
  laneReach?: number;
  /** Return the first map even if it fails the checks (for looking at problems). */
  debug?: boolean;
  /** Where debug notes go (default: nowhere). */
  log?: (...args: unknown[]) => void;
  /** Seeds to try before giving up (default 40). */
  maxAttempts?: number;
  /** Session 30: one random stream per stage ("staged", random maps) or one for the whole map ("shared", the default). */
  streams?: MapStreams;
  /** Session 30: a check of the map maker's caller's own, after `checkMap` passes: a reason to reject the try, or null. */
  accept?: (map: MapDef) => string | null;
  /** Session 30, staged streams only: a stage's own seed instead of "<seed>|<stage>" (to show stages don't touch each other). */
  stageSeeds?: Partial<Record<MapStage, string>>;
  /**
   * Session 31: told as each step of a try starts (`step` of `MAP_STEPS`, the try's number from 1), for a "Making the
   * map…" line. Only watches: the map is the same with or without it.
   */
  onProgress?: (step: number, attempt: number) => void;
  /**
   * Session 33b: the try to start at (1 unless said). Each try is made from its own seed ("seed#3"), so a map that
   * passed on its third try is made again by starting there (the room and the online pages, told which try passed).
   */
  firstAttempt?: number;
  /** Session 33b: how many random starts the capital layout search gets (20 unless said; the big random maps more). */
  layoutStarts?: number;
  /**
   * Session 34: the most players a layout must pass the paper check for (every capital about as far from its nearest
   * rival, gold within 30%). Above it, the search's best layout stands and the map's own `accept` judges it (a random
   * map's exposure band), as the official 200s' layouts for 11 and up are judged. Every count when left out.
   */
  paperUpTo?: number;
}

/** The map maker's numbered steps in one try (its "step" notes run 2 to 13), for progress. */
export const MAP_STEPS = 13;

export interface MapGenResult {
  map: MapDef;
  attempt: number;
  check: CheckResult;
  /** Why each earlier attempt was rejected. */
  rejected: string[];
}

class Rejected extends Error {}

/** Make a map. Same options and seed, same map, byte for byte. Tries the next seed ("seed#2", ...) until one passes the checks. */
export function generateMap(opts: MapGenOptions, rules: Rules): MapGenResult {
  const rejected: string[] = [];
  const max = opts.maxAttempts ?? 40;
  for (let attempt = opts.firstAttempt ?? 1; attempt <= max; attempt++) {
    const seed = attempt === 1 ? opts.seed : `${opts.seed}#${attempt}`;
    let map: MapDef;
    // (Session 31: the step notes double as progress.)
    const watch = opts.onProgress;
    const log = watch ? (...a: unknown[]) => (opts.log?.(...a), a[0] === "step" && watch(parseInt(String(a[1]), 10) || 0, attempt)) : opts.log;
    try {
      watch?.(1, attempt);
      map = buildOnce(log === opts.log ? opts : { ...opts, log }, rules, seed, attempt);
    } catch (e) {
      if (!(e instanceof Rejected)) throw e;
      rejected.push(`${seed}: ${e.message}`);
      continue;
    }
    const check = checkMap(map, rules, { minChokePoints: opts.minChokePoints ?? 5, minSeaLanes: opts.minSeaLanes ?? 1 });
    const own = check.ok && opts.accept ? opts.accept(map) : null;
    if ((check.ok && !own) || opts.debug) return { map, attempt, check, rejected };
    rejected.push(`${seed}: ${own ?? check.problems.slice(0, 3).join("; ")}`);
  }
  throw new Error(`No map passed the checks in ${max} tries:\n${rejected.join("\n")}`);
}

function buildOnce(o: MapGenOptions, rules: Rules, seed: string, attempt: number): MapDef {
  const stream = streamsFor(seed, o.streams ?? "shared", o.stageSeeds);
  const T = o.territories;
  // A shape other than the original continent is drawn from its own random sequence, before anything else.
  const shape =
    o.shape && o.shape !== "continent"
      ? makeShapeField({ shape: o.shape, territories: T, ...(o.mask ? { mask: o.mask } : {}), ...(o.islands !== undefined ? { islands: o.islands } : {}), ...(o.landBridge !== undefined ? { landBridge: o.landBridge } : {}), ...(o.bite !== undefined ? { bite: o.bite } : {}), ...(o.biteOffset !== undefined ? { biteOffset: o.biteOffset } : {}) }, stream("shape"))
      : null;
  // A shape sets its own share of water (the sea around and between it) unless the recipe says otherwise.
  const waterShare = o.water ?? (shape ? clamp(1 - shape.insideShare, 0.25, 0.8) : 0.38);
  const spacing = 14;
  const cells = (T * 70) / (1 - waterShare);
  const aspect = o.aspect ?? shape?.aspect ?? 1.45;
  const width = Math.round(Math.sqrt(cells * spacing * spacing * aspect));
  const height = Math.round((cells * spacing * spacing) / width);
  // Stage "land": the mesh, land and height.
  const mesh = buildMesh(stream("land"), width, height, spacing);
  const N = mesh.cells;

  // 1. Land and water.
  const land = makeLand(mesh, stream("land"), {
    water: waterShare,
    seas: o.seas ?? 1,
    lakes: o.lakes ?? 2,
    islandChains: o.islandChains ?? 1,
    islandCells: 70,
    ...(shape ? { shape, roughness: o.roughness ?? 0.5 } : {}),
  });
  const water = land.water;

  o.log?.("step", "2. Territories.");
  // 2. Territories.
  let owner: Int32Array;
  try {
    owner = makeTerritories(mesh, stream("territories"), (c) => !water[c], T);
  } catch (e) {
    throw new Rejected((e as Error).message);
  }
  for (let c = 0; c < N; c++) if (!water[c] && owner[c]! < 0) water[c] = 1;

  o.log?.("step", "3. Mountain range");
  // 3. Mountain ranges and straits.
  const frameSea = (() => {
    const s = new Uint8Array(N);
    for (const comp of components(mesh, (c) => water[c] === 1))
      if (comp.some((c) => mesh.cellEdges[c]!.some((e) => mesh.edgeCellB[e] === -1))) for (const c of comp) s[c] = 1;
    return s;
  })();
  const rock = new Uint8Array(N);
  // Where ranges and capitals may go: the biggest landmass, or with a shape, every landmass of 3+ territories.
  const landmasses = components(mesh, (c) => owner[c]! >= 0);
  const mainCells = shape ? landmasses.filter((comp) => new Set(comp.map((c) => owner[c])).size >= 3).flat() : landmasses[0]!;
  const barriers = planBarriers(mesh, stream("ranges"), owner, T, land.elev, (c) => frameSea[c] === 1, {
    ranges: o.mountainRanges ?? 2,
    straits: o.straits ?? 0,
    length: 0.6,
    ...(shape ? { mainland: new Set(mainCells) } : {}),
  });
  o.log?.("barriers", barriers.map((b) => `${b.kind} cut ${b.cut.length} open ${b.open.length}`));
  const gaps = applyBarriers(mesh, owner, barriers, rock, water, MIN_PASS);

  // Pieces of a territory cut off by a barrier join the neighbour they touch most (or become rock / water).
  for (let t = 0; t < T; t++) {
    const pieces = components(mesh, (c) => owner[c] === t);
    if (!pieces.length) throw new Rejected(`territory ${t} vanished under a barrier`);
    for (const piece of pieces.slice(1)) {
      const touch = new Map<number, number>();
      for (const c of piece) for (const m of mesh.neighbors[c]!) if (owner[m]! >= 0 && owner[m] !== t) touch.set(owner[m]!, (touch.get(owner[m]!) ?? 0) + 1);
      const best = [...touch].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
      for (const c of piece) {
        if (best) owner[c] = best[0];
        else {
          owner[c] = -1;
          const r = mesh.neighbors[c]!.find((m) => rock[m]);
          if (r !== undefined) rock[c] = rock[r]!;
          else water[c] = 1;
        }
      }
    }
  }

  // No hairline borders: territories that barely touch stop touching (pass openings stay as they are).
  const openPairs = new Set(barriers.flatMap((b) => b.open));
  const shallows = { canFill: (c: number) => water[c] === 1 && !rock[c] && !mesh.cellEdges[c]!.some((e) => mesh.edgeCellB[e] === -1), fill: (c: number) => (water[c] = 0), unfill: (c: number) => (water[c] = 1),
    sink: (c: number) => {
      const r = mesh.neighbors[c]!.find((m) => rock[m]);
      if (r !== undefined) {
        rock[c] = rock[r]!;
        return () => void (rock[c] = 0);
      }
      if (!mesh.neighbors[c]!.some((m) => water[m] === 1 && !rock[m])) return null;
      water[c] = 1;
      return () => void (water[c] = 0);
    },
  };
  if (!fixHairlines(mesh, owner, new Set([...gaps.values()].flat()), MIN_BORDER, (k) => openPairs.has(k), shallows, o.log)) throw new Rejected("a hairline border couldn't be fixed");

  o.log?.("step", "4. Water bodies");
  // 4. Water bodies (seas and lakes) and mountain ranges as regions.
  const waterBodies = components(mesh, (c) => water[c] === 1);
  const isSeaBody = waterBodies.map((b) => b.some((c) => mesh.cellEdges[c]!.some((e) => mesh.edgeCellB[e] === -1)) || b.length > N * 0.04);
  // One region per mountain range (a range can be in several pieces where its passes cut through).
  const rangeCount = Math.max(0, ...rock);
  const rockBodies = Array.from({ length: rangeCount }, () => [] as number[]);
  for (let c = 0; c < N; c++) if (rock[c]) rockBodies[rock[c]! - 1]!.push(c);
  const label = new Int32Array(N).fill(-1);
  const sea = new Uint8Array(N);
  for (let c = 0; c < N; c++) if (owner[c]! >= 0) label[c] = owner[c]!;
  waterBodies.forEach((b, i) => {
    for (const c of b) {
      label[c] = T + i;
      if (isSeaBody[i]) sea[c] = 1;
    }
  });
  rockBodies.forEach((b, i) => {
    for (const c of b) label[c] = T + waterBodies.length + i;
  });
  const kinds = { owner, water, rock, sea };

  o.log?.("step", "5. Game terrain");
  // 5. Game terrain and the height of every cell.
  const terrain = assignTerrain(mesh, kinds, T, land.elev, land.moist);
  const heights = cellHeights(mesh, kinds, terrain, land.elev, land.detail);

  o.log?.("step", "6. Outlines and r");
  // 6. Outlines and rivers.
  const { arcs, isJunction } = buildArcs(mesh, label);
  const cornerCells = (v: number) => {
    const s = new Set<number>();
    for (const e of mesh.cornerEdges[v]!) {
      s.add(mesh.edgeCellA[e]!);
      if (mesh.edgeCellB[e]! >= 0) s.add(mesh.edgeCellB[e]!);
    }
    return [...s];
  };
  const cornerElev = new Float64Array(mesh.cornerX.length);
  for (let v = 0; v < cornerElev.length; v++) {
    const cs = cornerCells(v);
    cornerElev[v] = cs.reduce((a, c) => a + heights[c]!, 0) / cs.length;
  }
  const rivers = makeRivers(
    mesh,
    stream("rivers"),
    arcs,
    isJunction,
    T,
    cornerElev,
    (v, what) => cornerCells(v).some((c) => (what === "water" ? water[c] : rock[c]) !== 0),
    o.rivers ?? 3,
  );

  o.log?.("step", "7. The territory ");
  // 7. The territory graph: who touches whom, and across what.
  const openPass = new Set(barriers.filter((b) => b.kind === "rock").flatMap((b) => b.open));
  const cutByRock = new Set(barriers.filter((b) => b.kind === "rock").flatMap((b) => b.cut));
  const riverPairs = new Set(rivers.flatMap((r) => r.pairs.map(([a, b]) => pairKey(a, b))));
  const touch = touching(mesh, owner);
  const borderType = new Map<number, BorderType>();
  for (const k of touch.keys()) borderType.set(k, openPass.has(k) || cutByRock.has(k) ? "pass" : riverPairs.has(k) ? "river" : "normal");
  const landAdj: number[][] = Array.from({ length: T }, () => []);
  for (const k of touch.keys()) {
    const [a, b] = pairOf(k);
    landAdj[a]!.push(b);
    landAdj[b]!.push(a);
  }
  const lanes = makeSeaLanes(mesh, owner, (c) => water[c] === 1, T, landAdj, o.seaLanes ?? 2, o.laneReach ?? 16);
  for (const l of lanes) borderType.set(pairKey(l.a, l.b), "sea");

  o.log?.("step", "8. Provinces");
  // 8. Provinces: grown over ordinary and river borders.
  const innerAdj: number[][] = Array.from({ length: T }, () => []);
  const allAdj: number[][] = Array.from({ length: T }, () => []);
  for (const [k, type] of borderType) {
    const [a, b] = pairOf(k);
    allAdj[a]!.push(b);
    allAdj[b]!.push(a);
    if (type === "normal" || type === "river") innerAdj[a]!.push(b), innerAdj[b]!.push(a);
  }
  const province = makeProvinces(stream("provinces"), T, innerAdj, allAdj, o.provinces);
  if (province.some((x) => x < 0)) {
    o.log?.("orphans", [...province.keys()].filter((t) => province[t]! < 0).map((t) => ({ t, land: landAdj[t]!.length, all: allAdj[t]!.length })));
    throw new Rejected("a territory was left with no border to join a province by");
  }
  const provinceCount = Math.max(...province) + 1;

  o.log?.("step", "9. Outlines, labe");
  // 9. Outlines, label points, castles and building sites.
  const cellsOf: number[][] = Array.from({ length: T }, () => []);
  for (let c = 0; c < N; c++) if (owner[c]! >= 0) cellsOf[owner[c]!]!.push(c);
  const rings = Array.from({ length: T }, (_, t) => ringsOf(arcs, t));
  const labels = rings.map((r, t) => labelPoint(mesh, cellsOf[t]!, owner, r));

  o.log?.("step", "10. Names and ids");
  // 10. Names and ids. Territories are numbered in reading order (top to bottom, left to right).
  const order = Array.from({ length: T }, (_, t) => t).sort((a, b) => labels[a]!.y - labels[b]!.y || labels[a]!.x - labels[b]!.x);
  const newIndex = new Array<number>(T);
  order.forEach((t, i) => (newIndex[t] = i));
  const tid = (t: number) => `t${String(newIndex[t]).padStart(T > 100 ? 3 : 2, "0")}`;
  // Names have their own random sequence, so a change to the shapes doesn't rename every place.
  const namer = new Namer(stream("names"));
  const tName = order.map(() => namer.territory());
  const provOrder = Array.from({ length: provinceCount }, (_, p) => p).sort(
    (a, b) => Math.min(...order.map((t, i) => (province[t] === a ? i : 1e9))) - Math.min(...order.map((t, i) => (province[t] === b ? i : 1e9))),
  );
  const pid = (p: number) => `p${provOrder.indexOf(p)}`;

  o.log?.("step", "11. Capitals");
  // 11. Capitals: fair layouts for every player count, on mainland plains away from choke points.
  const draft = (): MapDef =>
    MapDef.parse({
      id: o.id,
      name: o.name,
      minPlayers: o.players.min,
      maxPlayers: o.players.max,
      recommendedPlayers: o.players.recommended,
      territories: order.map((t, i) => ({ id: tid(t), name: tName[i]!, province: pid(province[t]!), terrain: terrain[t]!, x: labels[t]!.x, y: labels[t]!.y })),
      provinces: provOrder.map((p) => ({ id: pid(p), name: "", bonus: 2 })),
      borders: [...borderType]
        .map(([k, type]) => {
          const [a, b] = pairOf(k);
          const [x, y] = [tid(a), tid(b)].sort() as [string, string];
          return { a: x, b: y, type };
        })
        .sort((p, q) => p.a.localeCompare(q.a) || p.b.localeCompare(q.b)),
      capitalSlots: order.slice(0, o.players.max).map(tid),
    });
  const base = draft();
  const dists = allDistances(base);
  // Capitals stand on the mainland (with a shape: any landmass of 3+ territories, so islands and twin continents get theirs).
  const mainland = new Set(
    (shape ? components(mesh, (c) => owner[c]! >= 0).filter((comp) => new Set(comp.map((c) => owner[c])).size >= 3).flat() : components(mesh, (c) => owner[c]! >= 0)[0]!).map((c) => owner[c]!),
  );
  const special = new Set(base.borders.filter((b) => b.type === "pass" || b.type === "sea").flatMap((b) => [b.a, b.b]));
  const candidates = order.filter((t) => mainland.has(t) && ["plains", "forest", "hills"].includes(terrain[t]!) && !special.has(tid(t))).map(tid);
  // Every capital stands on plains, so no capital starts with a defensive edge. Turning a slot into plains
  // changes the income around it, so keep searching until every layout is fair with the final terrain.
  const byId = new Map(order.map((t) => [tid(t), t]));
  const layouts = new Map<number, string[]>();
  for (let round = 0; round < 4; round++) {
    const tbl = fairnessTable(dists, territoryIncome(draft(), rules));
    let changed = false;
    for (let n = o.players.min; n <= o.players.max; n++) {
      const have = layouts.get(n);
      const paper = o.paperUpTo === undefined || n <= o.paperUpTo;
      if (have && (!paper || fairnessOf(have.map((id) => tbl.ids.indexOf(id)), tbl).fair)) continue;
      const found = findLayout(stream("capitals"), n, candidates, tbl, o.layoutStarts);
      o.log?.("capitals", n, candidates.length, found?.fairness);
      if (!found || (!found.fairness.fair && !o.debug && paper))
        throw new Rejected(`no fair capital layout for ${n} players${found ? ` (gaps ${found.fairness.nearest}, income ${found.fairness.income})` : ""}`);
      layouts.set(n, found.slots);
      changed = true;
      for (const id of found.slots) terrain[byId.get(id)!] = "plains";
    }
    if (!changed) break;
  }
  const slotSet = new Set([...layouts.values()].flat());

  const isLandCell = (c: number) => !water[c] && !rock[c];
  const castles = new Map<number, Spot>();
  const sites = new Map<number, Spot>();
  for (let t = 0; t < T; t++) {
    const avoid: Spot[] = [labels[t]!];
    if (slotSet.has(tid(t))) {
      const c = siteIn(mesh, cellsOf[t]!, rings[t]!, avoid, CASTLE_CLEAR + 4, isLandCell);
      castles.set(t, c);
      avoid.push(c);
    }
    sites.set(t, siteIn(mesh, cellsOf[t]!, rings[t]!, avoid, 18, isLandCell));
  }

  o.log?.("step", "12. Ground types");
  // 12. Ground types, height map and decorations.
  const biome = assignBiomes(mesh, kinds, T, terrain, land.elev, land.detail);
  const grids = buildGrids(mesh, biome, heights, spacing * 0.75);
  carveRivers(grids, rivers.map((r) => tidy(r.pts))); // carve along the line exactly as stored
  const codeToBiome = new Map(Object.entries({ g: "grass", a: "farmland", f: "forest", h: "hills", r: "rock", s: "snow", w: "swamp", d: "sand", o: "shallow", O: "deep" } as const));
  const biomeAt = (x: number, y: number) => {
    const c = Math.min(grids.cols - 1, Math.floor(x / grids.cellSize)), r = Math.min(grids.rows - 1, Math.floor(y / grids.cellSize));
    return codeToBiome.get(grids.biome[r * grids.cols + c]!)!;
  };
  const elevRanks = (() => {
    const all = Array.from({ length: N }, (_, c) => c).sort((a, b) => land.elev[a]! - land.elev[b]! || a - b);
    const r = new Float64Array(N);
    all.forEach((c, i) => (r[c] = i / (N - 1)));
    return r;
  })();
  const provinceTerritories = (p: number) => order.filter((t) => province[t] === p);
  const townIn = provOrder.map((p) => {
    const ts = provinceTerritories(p).filter((t) => !slotSet.has(tid(t)) && terrain[t] === "plains");
    return (ts.length ? ts : provinceTerritories(p)).sort((a, b) => cellsOf[b]!.length - cellsOf[a]!.length || a - b)[0]!;
  });
  const decorations = placeDecorations({
    mesh,
    rng: stream("places"),
    biomeAt,
    cellBiome: biome,
    elevRank: (c) => elevRanks[c]!,
    detail: land.detail,
    labels,
    sites: [...sites.values()],
    castles: [...castles.values()],
    territoryCells: cellsOf,
    villageOk: terrain.map((t: Terrain) => t !== "swamp" && t !== "mountains"),
    townIn,
  });

  o.log?.("step", "13. Names for pro");
  // 13. Names for provinces, water, ranges and rivers; province bonuses.
  const provinces = provOrder.map((p) => {
    const members = provinceTerritories(p);
    const outside = new Set(members.flatMap((t) => allAdj[t]!.filter((m) => province[m] !== p)));
    const bonus = Math.max(2, Math.min(4, Math.round(members.length * 0.35 + outside.size * 0.2)));
    return { id: pid(p), name: namer.province(), bonus };
  });
  const landDist = bfsSteps(mesh, Array.from({ length: N }, (_, c) => c).filter((c) => !water[c]), (c) => water[c] === 1);
  const waterOut = waterBodies.map((b, i) => {
    const kind = isSeaBody[i] ? ("sea" as const) : ("lake" as const);
    // Sea names sit a little way off the coast near the middle of the map; lake names in the middle of the lake.
    const spot = [...b].sort((p, q) =>
      kind === "lake"
        ? landDist[q]! - landDist[p]! || p - q
        : Math.abs(landDist[p]! - 4) - Math.abs(landDist[q]! - 4) ||
          dist(mesh.x[p]!, mesh.y[p]!, width / 2, height / 2) - dist(mesh.x[q]!, mesh.y[q]!, width / 2, height / 2) ||
          p - q,
    )[0]!;
    return { id: `w${i}`, name: namer.water(kind), kind, rings: ringsOf(arcs, T + i), label: { x: r1(mesh.x[spot]!), y: r1(mesh.y[spot]!) } };
  });
  const mountains = rockBodies.flatMap((b, i) => {
    if (!b.length) return [];
    let mx = 0, my = 0;
    for (const c of b) (mx += mesh.x[c]!), (my += mesh.y[c]!);
    mx /= b.length;
    my /= b.length;
    const spot = [...b].sort((p, q) => dist(mesh.x[p]!, mesh.y[p]!, mx, my) - dist(mesh.x[q]!, mesh.y[q]!, mx, my) || p - q)[0]!;
    return [{ id: `m${i}`, name: namer.range(), rings: ringsOf(arcs, T + waterBodies.length + i), label: { x: r1(mesh.x[spot]!), y: r1(mesh.y[spot]!) } }];
  });
  const rockOf = new Int32Array(N).fill(-1);
  rockBodies.forEach((b, i) => b.forEach((c) => (rockOf[c] = i)));
  const passes = [...borderType]
    .filter(([, type]) => type === "pass")
    .map(([k]) => {
      const [a, b] = pairOf(k);
      const cellsHere = gaps.get(k) ?? (touch.get(k) ?? []).flat();
      let x = 0, y = 0;
      for (const c of cellsHere) (x += mesh.x[c]!), (y += mesh.y[c]!);
      x /= cellsHere.length;
      y /= cellsHere.length;
      const near = new Map<number, number>();
      for (const c of cellsHere) for (const m of mesh.neighbors[c]!) if (rockOf[m]! >= 0) near.set(rockOf[m]!, (near.get(rockOf[m]!) ?? 0) + 1);
      const range = [...near].sort((p, q) => q[1] - p[1] || p[0] - q[0])[0]?.[0] ?? 0;
      const [ia, ib] = [tid(a), tid(b)].sort() as [string, string];
      return { a: ia, b: ib, range: `m${range}`, x: r1(x), y: r1(y) };
    })
    .sort((p, q) => p.a.localeCompare(q.a) || p.b.localeCompare(q.b));

  const borderLines = new Map<string, { a: string; b: string; lines: number[][] }>();
  for (const arc of arcs) {
    if (arc.lo < 0 || arc.hi >= T) continue;
    const [a, b] = [tid(arc.lo), tid(arc.hi)].sort() as [string, string];
    const key = `${a}|${b}`;
    const entry = borderLines.get(key) ?? { a, b, lines: [] };
    entry.lines.push(tidy(arc.pts));
    borderLines.set(key, entry);
  }

  const map = MapDef.parse({
    ...draft(),
    provinces,
    capitalSlots: [...slotSet].sort(),
    capitalLayouts: [...layouts].map(([players, slots]) => {
      const chosen = o.capitals?.[players] ? [...o.capitals[players]!] : slots;
      // (Only spots of this layout: a recipe tried with another seed makes other spots.)
      const bonus = Object.fromEntries(Object.entries(o.startBonus?.[players] ?? {}).filter(([t]) => chosen.includes(t)));
      return { players, slots: chosen, ...(Object.keys(bonus).length ? { bonus } : {}) };
    }),
    generator: { version: MAPGEN_VERSION, seed: o.seed, attempt },
    geometry: {
      width,
      height,
      biome: { cellSize: grids.cellSize, cols: grids.cols, rows: grids.rows, data: grids.biome },
      heightMap: { cellSize: grids.cellSize, cols: grids.cols, rows: grids.rows, seaLevel: grids.seaLevel, data: toBase64(grids.height) },
      provinceLabels: provOrder.map((p) => ({ id: pid(p), path: labelLine(mesh, provinceTerritories(p).flatMap((t) => cellsOf[t]!)) })),
      territories: order.map((t) => ({
        id: tid(t),
        rings: rings[t]!,
        label: labels[t]!,
        site: sites.get(t)!,
        ...(castles.has(t) ? { castle: castles.get(t)! } : {}),
      })),
      water: waterOut,
      mountains,
      passes,
      rivers: rivers.map((r) => ({ id: "", name: namer.river(), path: tidy(r.pts) })).map((r, i) => ({ ...r, id: `r${i}` })),
      seaLanes: lanes
        .map((l) => {
          const [a, b] = [tid(l.a), tid(l.b)];
          const flip = a > b;
          const p = l.pts.map(r1);
          return { a: flip ? b : a, b: flip ? a : b, path: flip ? [p[2]!, p[3]!, p[0]!, p[1]!] : p };
        })
        .sort((p, q) => p.a.localeCompare(q.a) || p.b.localeCompare(q.b)),
      borderLines: [...borderLines.values()].sort((p, q) => p.a.localeCompare(q.a) || p.b.localeCompare(q.b)),
      decorations,
    },
  });
  return map;
}
