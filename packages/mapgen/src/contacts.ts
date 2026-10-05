import type { Mesh } from "./mesh";

/** Key for an unordered pair of territories (the same as barriers.ts' pairKey). */
const pairKey = (a: number, b: number) => (a < b ? a * 10000 + b : b * 10000 + a);

/** Length of a mesh edge (map units). */
export const edgeLength = (mesh: Mesh, e: number) =>
  Math.hypot(mesh.cornerX[mesh.edgeA[e]!]! - mesh.cornerX[mesh.edgeB[e]!]!, mesh.cornerY[mesh.edgeA[e]!]! - mesh.cornerY[mesh.edgeB[e]!]!);

/** Every pair of territories that touch, with the mesh edges along their shared border. */
export function contactEdges(mesh: Mesh, owner: Int32Array): Map<number, number[]> {
  const out = new Map<number, number[]>();
  for (let e = 0; e < mesh.edgeA.length; e++) {
    const a = mesh.edgeCellA[e]!, b = mesh.edgeCellB[e]!;
    if (b < 0) continue;
    const ta = owner[a]!, tb = owner[b]!;
    if (ta < 0 || tb < 0 || ta === tb) continue;
    const k = pairKey(ta, tb);
    let l = out.get(k);
    if (!l) out.set(k, (l = []));
    l.push(e);
  }
  return out;
}

/** How long each pair's shared border is (map units). */
export function contactLengths(mesh: Mesh, owner: Int32Array): Map<number, number> {
  const out = new Map<number, number>();
  for (const [k, edges] of contactEdges(mesh, owner)) out.set(k, edges.reduce((a, e) => a + edgeLength(mesh, e), 0));
  return out;
}

/** Is territory `t` still in one piece (and not too small) if `without` is taken away? */
function staysWhole(mesh: Mesh, owner: Int32Array, t: number, without: number, minCells: number): boolean {
  const cells: number[] = [];
  for (let c = 0; c < mesh.cells; c++) if (owner[c] === t && c !== without) cells.push(c);
  if (cells.length < minCells) return false;
  const seen = new Set([cells[0]!]);
  const q = [cells[0]!];
  for (let h = 0; h < q.length; h++)
    for (const m of mesh.neighbors[q[h]!]!) if (m !== without && owner[m] === t && !seen.has(m)) (seen.add(m), q.push(m));
  return seen.size === cells.length;
}

/**
 * No hairline borders. Two territories that touch along less than `minLength` map units read as "not touching"
 * to the eye, so the map maker makes the map agree with the eye. One cell at a time, it either hands a cell where
 * they meet to a third neighbour that already surrounds it (filling the corner in, so the two stop touching), or
 * gives one side a cell of a third territory next to both (widening the contact), whichever helps most. Every move
 * must leave the map with fewer hairlines than before (measured as how far short each one falls), and never splits
 * or shrinks a territory too far. `fixed` cells (pass openings) never move, and `keep` pairs (passes) are left to
 * the pass rule. Returns false if it gets stuck (the map maker then tries the next seed).
 */
export function fixHairlines(
  mesh: Mesh,
  owner: Int32Array,
  fixed: ReadonlySet<number>,
  minLength: number,
  keep: (k: number) => boolean,
  /** Water next to a narrow neck of land that may be filled in to widen it (never mountain rock); `fill` makes it land. */
  water: { canFill: (c: number) => boolean; fill: (c: number) => void; unfill: (c: number) => void },
  log?: (...a: unknown[]) => void,
): boolean {
  const minCells = 6;
  const badness = () => {
    let bad = 0, worst: [number, number] | null = null;
    for (const [k, l] of contactLengths(mesh, owner)) {
      if (l >= minLength || keep(k)) continue;
      bad += minLength - l;
      if (!worst || l < worst[1]) worst = [k, l];
    }
    return { bad, worst };
  };
  /** Moves that might fix the contact between two territories: [cell, new owner]. */
  const movesFor = (k: number): [number, number][] => {
    const edges = contactEdges(mesh, owner).get(k);
    if (!edges) return [];
    const a = owner[mesh.edgeCellA[edges[0]!]!]!, b = owner[mesh.edgeCellB[edges[0]!]!]!;
    const pair = new Set([a, b]);
    const out: [number, number][] = [];
    const seen = new Set<string>();
    const add = (cell: number, to: number) => {
      const key = `${cell}>${to}`;
      if (fixed.has(cell) || seen.has(key) || !staysWhole(mesh, owner, owner[cell]!, cell, minCells)) return;
      seen.add(key);
      out.push([cell, to]);
    };
    for (const e of edges)
      for (const cell of [mesh.edgeCellA[e]!, mesh.edgeCellB[e]!]) {
        // Fill the corner: a meeting cell goes to a third territory around it.
        for (const m of mesh.neighbors[cell]!) if (owner[m]! >= 0 && !pair.has(owner[m]!)) add(cell, owner[m]!);
        // Widen: a third territory's cell next to both sides joins this side.
        const other = owner[cell] === a ? b : a;
        for (const m of mesh.neighbors[cell]!)
          if (owner[m]! >= 0 && !pair.has(owner[m]!) && mesh.neighbors[m]!.some((x) => owner[x] === other)) add(m, owner[cell]!);
        // A narrow neck between two waters: fill in a water cell next to both sides.
        for (const m of mesh.neighbors[cell]!)
          if (owner[m]! < 0 && !fixed.has(m) && water.canFill(m) && mesh.neighbors[m]!.some((x) => owner[x] === other) && !seen.has(`${m}>${owner[cell]}`)) {
            seen.add(`${m}>${owner[cell]}`);
            out.push([m, owner[cell]!]);
          }
      }
    return out;
  };
  const apply = (cell: number, to: number) => {
    if (owner[cell]! < 0) water.fill(cell);
    owner[cell] = to;
  };
  const tryMove = ([cell, to]: [number, number], then: () => number): number => {
    const from = owner[cell]!;
    apply(cell, to);
    const r = then();
    owner[cell] = from;
    if (from < 0) water.unfill(cell);
    return r;
  };
  for (let round = 0; round < 200; round++) {
    const now = badness();
    if (!now.worst) return true;
    const [k, len] = now.worst;
    log?.("hairline", round, k, len.toFixed(1), now.bad.toFixed(1));
    // The single move that helps most; if none helps, the best pair of moves (the second one fixing whatever is
    // worst after the first).
    let best: { moves: [number, number][]; bad: number } | null = null;
    const consider = (moves: [number, number][], bad: number) => {
      if (bad < now.bad - 1e-9 && (!best || bad < best.bad - 1e-9)) best = { moves, bad };
    };
    const first = movesFor(k);
    for (const m of first) consider([m], tryMove(m, () => badness().bad));
    if (!best)
      for (const m1 of first)
        tryMove(m1, () => {
          const mid = badness();
          if (mid.worst) for (const m2 of movesFor(mid.worst[0])) if (m2[0] !== m1[0]) consider([m1, m2], tryMove(m2, () => badness().bad));
          return 0;
        });
    if (!best) {
      log?.("stuck", k);
      return false;
    }
    for (const [cell, to] of (best as { moves: [number, number][] }).moves) apply(cell, to);
  }
  return false;
}
