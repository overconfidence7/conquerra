import type { Rules } from "@conquerra/content";
import { indexMap, type MapIndex } from "./mapIndex";
import type { GameContext, PlayerId, TerritoryId, TerritoryState } from "./types";

/**
 * Walls (session 20b, Nate's idea; design additions §16): the reward at the end of the culture and building path.
 *
 * - A territory with culture 5 and a fort (`rules.walls`) is **walled** from the end of the turn its last piece is
 *   finished (`updateWalls`, at the end of every turn). It stays walled while it keeps both and its owner; land that
 *   changes hands loses its culture, so it leaves its wall at once.
 * - Walled territories of one House that touch (not across water) form **one wall**.
 * - When a walled territory is attacked, every other territory of its wall within `reach` steps along the wall lends
 *   its **spare troops** (all but the 1 that holds its land) to the defence, each to one battle a turn. Losses fall on
 *   the attacked territory first (down to its last troop), then on the lenders in proportion to what they lent.
 * - Defence only: shared defenders never attack. Siege engines cut the fort's bonus as ever, not the shared defenders.
 *
 * Everything here is pure and works on any board (the live game, the replay's board, a test's).
 */

/** The parts of a territory walls look at. */
type Land = Pick<TerritoryState, "owner" | "troops" | "culture" | "building"> & { walled?: boolean };
type Board = Readonly<Record<TerritoryId, Land>>;

export type WallRules = NonNullable<Rules["walls"]>;

/** The wall rules, if walls are on in this game (an older game's rules have none: no walls). */
export const wallRules = (rules: Rules): WallRules | null => (rules.walls?.on ? rules.walls : null);

/** Has everything a wall needs (culture at the top, and a fort if the rules ask for one), on held land. */
export function qualifiesForWall(rules: Rules, t: Land): boolean {
  const w = wallRules(rules);
  return !!w && t.owner !== null && t.culture >= w.culture && (!w.needsFort || t.building === "fort");
}

/** Walled now: made a wall at the end of a turn, and still has everything it needs. */
export const isWalled = (rules: Rules, t: Land | undefined): boolean => !!t?.walled && qualifiesForWall(rules, t);

/** Walls join over land borders only (never across water). */
const joins = (idx: MapIndex, a: TerritoryId, b: TerritoryId) => idx.border(a, b) !== "sea";

/**
 * The wall `t` stands in: every walled territory of the same House connected to it through walled land, with its
 * distance from `t` in steps along the wall. Empty if `t` isn't walled.
 */
export function wallSteps(ctx: GameContext, board: Board, t: TerritoryId): Map<TerritoryId, number> {
  const out = new Map<TerritoryId, number>();
  const start = board[t];
  if (!isWalled(ctx.rules, start)) return out;
  const idx = indexMap(ctx.map);
  out.set(t, 0);
  const q = [t];
  while (q.length) {
    const cur = q.shift()!;
    for (const n of idx.neighbors.get(cur) ?? []) {
      if (out.has(n) || !joins(idx, cur, n)) continue;
      const x = board[n];
      if (!x || x.owner !== start!.owner || !isWalled(ctx.rules, x)) continue;
      out.set(n, out.get(cur)! + 1);
      q.push(n);
    }
  }
  return out;
}

/** Every wall on the board: its House and its territories (in map order). */
export function allWalls(ctx: GameContext, board: Board): { owner: PlayerId; territories: TerritoryId[] }[] {
  if (!wallRules(ctx.rules)) return [];
  const idx = indexMap(ctx.map);
  const seen = new Set<TerritoryId>();
  const out: { owner: PlayerId; territories: TerritoryId[] }[] = [];
  for (const t of idx.ids) {
    if (seen.has(t) || !isWalled(ctx.rules, board[t])) continue;
    const members = new Set(wallSteps(ctx, board, t).keys());
    for (const m of members) seen.add(m);
    out.push({ owner: board[t]!.owner!, territories: idx.ids.filter((x) => members.has(x)) });
  }
  return out;
}

/** One territory's share of a wall's defence: how many of its troops it lends. */
export interface Lend {
  territory: TerritoryId;
  troops: number;
}

/**
 * What the rest of `t`'s wall lends when `t` is attacked now: each walled territory within `reach` steps along the
 * wall, its spare troops (all but the garrison, or half of them), nearest first. `used`: territories that already lent
 * to a battle this turn (each lends to one a turn). Empty if `t` isn't walled.
 */
export function wallLenders(ctx: GameContext, board: Board, t: TerritoryId, used?: ReadonlySet<TerritoryId>): Lend[] {
  const w = wallRules(ctx.rules);
  if (!w) return [];
  const garrison = ctx.rules.setup.minGarrison;
  const out: Lend[] = [];
  const steps = [...wallSteps(ctx, board, t)].filter(([x, d]) => x !== t && (w.reach === null || d <= w.reach));
  // Nearest first, then map order (the BFS already visits in a fixed order; keep it stable).
  steps.sort((a, b) => a[1] - b[1]);
  for (const [x] of steps) {
    if (used?.has(x)) continue;
    const spare = Math.max(0, board[x]!.troops - garrison);
    const troops = w.lendAll ? spare : Math.floor(spare / 2);
    if (troops > 0) out.push({ territory: x, troops });
  }
  return out;
}

/** Everyone who defends `t` if it's attacked now: its own troops plus what its wall lends. */
export function wallDefenders(ctx: GameContext, board: Board, t: TerritoryId, used?: ReadonlySet<TerritoryId>): number {
  return (board[t]?.troops ?? 0) + wallLenders(ctx, board, t, used).reduce((a, l) => a + l.troops, 0);
}

/**
 * Share a battle's defender losses: the attacked territory first, down to its last troop; then the lenders in
 * proportion to what they lent (whole troops, the biggest remainders first, ties to the nearest); the attacked
 * territory's last troop only once everyone else is gone (that's the capture).
 */
export function shareWallLosses(own: number, lent: readonly Lend[], losses: number): { own: number; lent: number[] } {
  let ownLoss = Math.min(losses, Math.max(0, own - 1));
  let rest = losses - ownLoss;
  const total = lent.reduce((a, l) => a + l.troops, 0);
  const fromLent = Math.min(rest, total);
  const exact = lent.map((l) => (total ? (fromLent * l.troops) / total : 0));
  const out = exact.map(Math.floor);
  let left = fromLent - out.reduce((a, b) => a + b, 0);
  const order = exact.map((x, i) => ({ i, frac: x - Math.floor(x) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    if (out[i]! < lent[i]!.troops) (out[i]!++, left--);
  }
  rest -= fromLent;
  ownLoss = Math.min(own, ownLoss + rest);
  return { own: ownLoss, lent: out };
}

/**
 * The end of a turn: land with everything a wall needs becomes walled; land that lost it stops being walled. Returns
 * the newly walled land, by House (for the turn's events).
 */
export function updateWalls(ctx: GameContext, territories: Record<TerritoryId, TerritoryState>): { player: PlayerId; territories: TerritoryId[] }[] {
  const fresh = new Map<PlayerId, TerritoryId[]>();
  for (const id of indexMap(ctx.map).ids) {
    const t = territories[id]!;
    const ok = qualifiesForWall(ctx.rules, t);
    if (ok && !t.walled) {
      t.walled = true;
      fresh.set(t.owner!, [...(fresh.get(t.owner!) ?? []), id]);
    } else if (!ok && t.walled) delete t.walled;
  }
  return [...fresh].map(([player, list]) => ({ player, territories: list }));
}
