import type { MarshalJudgement } from "@conquerra/content";
import { indexMap, type GameContext, type PlayerId, type PlayerView, type ReplayEvent } from "@conquerra/engine";
import { estimateLand, observe, pace, type MarshalMemory } from "./memory";

/** Why a Marshal named a runaway leader: it looks too big, it's growing fastest, or it named it lately and nothing changed. */
export type RunawayWhy = "size" | "pace" | "still";

/** What a Marshal makes of the board before it plans or talks, from its own view and memory only. */
export interface Insight {
  /** Each living rival's land as it estimates it, and what it sees or remembers of it. */
  est: Map<PlayerId, number>;
  known: Map<PlayerId, number>;
  mine: number;
  /** Land each rival gained lately (estimates, and what it watched them take). */
  gains: Map<PlayerId, number>;
  runaway: PlayerId | null;
  why: RunawayWhy | null;
  /** Rivals it watched fight last turn (in a battle it could see, attacking or defending): the Opportunist's prey. */
  fought: Set<PlayerId>;
  /** Rivals it's in a joint war against (the war's target), and its partners in them. */
  warTargets: Set<PlayerId>;
}

/**
 * The Marshal's runaway rule, the same for every seat (people and bots alike), on its estimate of everyone's land:
 *  - size: the leader holds `share` of the map, or `minShare` and `lead` times anyone else (us included); from
 *    `bigTable` players up the bar is lower (a big map hides more of a runaway from any one seat);
 *  - pace: it gained the most land lately, `paceLead` times the next fastest, and already holds `paceMinShare`;
 *  - it sticks: once named, a runaway stays named for `stickTurns` turns while it's still the biggest.
 * Only with at least three players left (head to head the other player is always the target anyway).
 */
export function readRunaway(
  j: MarshalJudgement["runaway"],
  est: ReadonlyMap<PlayerId, number>,
  mine: number,
  total: number,
  players: number,
  living: number,
  gains: ReadonlyMap<PlayerId, number>,
  memory: MarshalMemory,
  turn: number,
): { runaway: PlayerId | null; why: RunawayWhy | null } {
  if (living < 3) return { runaway: null, why: null };
  const ranked = [...est].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  const [top, land] = ranked[0] ?? [null, 0];
  if (!top) return { runaway: null, why: null };
  const runnerUp = Math.max(mine, ranked[1]?.[1] ?? 0);
  const big = players >= j.bigTable;
  const share = big ? j.bigShare : j.share, minShare = big ? j.bigMinShare : j.minShare, lead = big ? j.bigLead : j.lead;
  if (land >= share * total || (land >= minShare * total && land >= lead * runnerUp)) return { runaway: top, why: "size" };
  // Pace: the fastest grower, by a clear margin, already among the biggest (never someone smaller than us).
  const fastest = [...gains].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  const [fast, gain] = fastest[0] ?? [null, 0];
  const next = Math.max(1, fastest[1]?.[1] ?? 0);
  const fastLand = fast ? (est.get(fast) ?? 0) : 0;
  if (fast && gain >= j.paceLead * next && gain >= 3 && fastLand >= j.paceMinShare * total && fastLand >= mine && fastLand >= 0.8 * land)
    return { runaway: fast, why: "pace" };
  const prev = memory.runaway;
  if (prev && turn - prev.last <= j.stickTurns && prev.player === top && est.has(prev.player)) return { runaway: prev.player, why: "still" };
  return { runaway: null, why: null };
}

/**
 * Take in the turn and make sense of it: the land estimates, pace, the runaway, who just fought. Returns the insight
 * and the memory to keep (with this turn taken in). Calling it again on the same turn gives the same answer.
 */
export function think(ctx: GameContext, view: PlayerView, j: MarshalJudgement, memory: MarshalMemory, lastTurn?: readonly ReplayEvent[]): { insight: Insight; memory: MarshalMemory } {
  const { est, known, mine } = estimateLand(ctx, view, j);
  let mem = observe(memory, view, est, lastTurn);
  const gains = pace(mem, view.turn, j.runaway.paceTurns);
  const living = view.players.filter((p) => p.eliminatedTurn === null).length;
  const total = indexMap(ctx.map).ids.length;
  const { runaway, why } = readRunaway(j.runaway, est, mine, total, view.players.length, living, gains, mem, view.turn);
  if (runaway) mem = { ...mem, runaway: { player: runaway, since: mem.runaway?.player === runaway ? mem.runaway.since : view.turn, last: why === "still" ? (mem.runaway?.last ?? view.turn) : view.turn, named: view.turn } };
  const fought = new Set<PlayerId>();
  for (const e of lastTurn ?? [])
    if (e.type === "battle") {
      if (e.player !== view.me.id) fought.add(e.player);
      if (e.defender && e.defender !== view.me.id) fought.add(e.defender);
    }
  const me = view.me.id;
  const warTargets = new Set(view.deals.filter((d) => d.kind === "war" && (d.a === me || d.b === me) && d.target).map((d) => d.target!));
  return { insight: { est, known, mine, gains, runaway, why, fought, warTargets }, memory: mem };
}
