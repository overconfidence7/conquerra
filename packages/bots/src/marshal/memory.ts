import type { MarshalJudgement } from "@conquerra/content";
import { indexMap, type GameContext, type PlayerId, type PlayerView, type ReplayEvent, type TerritoryId } from "@conquerra/engine";

/**
 * What a Marshal remembers between turns (session 17). Only what a person in its seat could know: its own view each
 * turn, the replays it watched, and public facts. Plain JSON, so a host can keep it with a saved game (the web host
 * does) and a game carried on from a save plays on exactly as it would have.
 */
export interface MarshalMemory {
  /** The last turn it took in (taking in the same turn twice changes nothing). */
  turn: number;
  /** Its estimate of each rival's land, turn by turn (the last few turns), for pace. */
  land: { turn: number; est: Record<PlayerId, number> }[];
  /** Territories it watched each rival take in the replays, turn by turn (the last few turns). */
  taken: { turn: number; by: Record<PlayerId, number> }[];
  /** The runaway leader it named, since when, and the last turn it still named it. */
  runaway: { player: PlayerId; since: number; last: number } | null;
}

export const freshMemory = (): MarshalMemory => ({ turn: -1, land: [], taken: [], runaway: null });

const KEEP_TURNS = 8;

/**
 * Land each living rival holds, as this seat can best tell, and how sure it can be (`seen`: land it sees or remembers).
 *  - What it sees, else what it last saw (a rival's land stays a rival's; land it last saw neutral counts only for
 *    `neutralFreshTurns`, since neutral land is what everyone takes first).
 *  - Land last seen held by a player since knocked out: the player who knocked them out (public), if still in.
 *  - Land it knows nothing about: whoever holds the nearest land it knows of (walking the map's borders), scaled by
 *    how much of the land it can see is held by anyone at all (early on most of the map is still neutral).
 */
export function estimateLand(ctx: GameContext, view: PlayerView, judgement: MarshalJudgement): { est: Map<PlayerId, number>; known: Map<PlayerId, number>; mine: number } {
  const idx = indexMap(ctx.map);
  const me = view.me.id;
  const players = new Map(view.players.map((p) => [p.id, p]));
  const alive = (p: PlayerId) => players.get(p)?.eliminatedTurn === null;
  /** Who it now holds, as far as we know: knocked-out players' land goes to whoever knocked them out. */
  const heir = (p: PlayerId): PlayerId | null => {
    let q: PlayerId | null = p;
    for (let k = 0; q && !alive(q) && k < 10; k++) q = players.get(q)?.eliminatedBy ?? null;
    return q && alive(q) ? q : null;
  };
  // `undefined`: nothing known; `null`: neutral.
  const owner = new Map<TerritoryId, PlayerId | null>();
  let mine = 0, seenNow = 0, heldNow = 0;
  for (const t of idx.ids) {
    const v = view.territories[t]!;
    if (v.detail === "full") {
      const o = v.owner === null ? null : heir(v.owner);
      owner.set(t, o);
      if (v.owner === me) mine++;
      else {
        seenNow++;
        if (v.owner !== null) heldNow++;
      }
      continue;
    }
    const last = v.lastSeen;
    if (!last) continue;
    if (last.owner === null) {
      if (view.turn - last.turn <= judgement.neutralFreshTurns) owner.set(t, null);
      continue;
    }
    if (last.owner === me) continue; // our own land we lost and can't see: someone has it, we don't know who
    const o = heir(last.owner);
    if (o) owner.set(t, o);
  }
  const known = new Map<PlayerId, number>();
  for (const [, o] of owner) if (o && o !== me) known.set(o, (known.get(o) ?? 0) + 1);
  // Land it knows nothing about: the nearest land it knows of, through the map's borders (a multi-source walk).
  const near = new Map<TerritoryId, PlayerId | null>();
  const queue: TerritoryId[] = [];
  for (const t of idx.ids)
    if (owner.has(t)) {
      near.set(t, owner.get(t)!);
      queue.push(t);
    }
  for (let h = 0; h < queue.length; h++) {
    const t = queue[h]!;
    for (const nb of idx.neighbors.get(t)!)
      if (!near.has(nb)) {
        near.set(nb, near.get(t)!);
        queue.push(nb);
      }
  }
  const held = seenNow ? heldNow / seenNow : 0.5;
  const est = new Map(known);
  for (const t of idx.ids) {
    if (owner.has(t)) continue;
    const o = near.get(t);
    if (o && o !== me) est.set(o, (est.get(o) ?? 0) + held);
  }
  for (const [p] of est) if (!alive(p) || p === me) est.delete(p);
  return { est, known, mine };
}

/** Territories each rival took in the replay this seat watched (only battles it could see). */
export function takenIn(lastTurn: readonly ReplayEvent[] | undefined, me: PlayerId): Record<PlayerId, number> {
  const by: Record<PlayerId, number> = {};
  for (const e of lastTurn ?? []) if (e.type === "battle" && e.captured && e.player !== me) by[e.player] = (by[e.player] ?? 0) + 1;
  return by;
}

/**
 * Take in a new turn (once per turn): this turn's land estimate and what it watched last turn. Returns a new memory
 * (the old one is never changed), so planning and diplomacy can both call it.
 */
export function observe(memory: MarshalMemory, view: PlayerView, est: ReadonlyMap<PlayerId, number>, lastTurn: readonly ReplayEvent[] | undefined): MarshalMemory {
  if (memory.turn >= view.turn) return memory;
  const keep = <T extends { turn: number }>(xs: T[]) => xs.filter((x) => x.turn > view.turn - KEEP_TURNS);
  return {
    turn: view.turn,
    land: keep([...memory.land, { turn: view.turn, est: Object.fromEntries(est) }]),
    taken: keep([...memory.taken, { turn: view.turn - 1, by: takenIn(lastTurn, view.me.id) }]),
    runaway: memory.runaway,
  };
}

/** How much land each rival gained over the last `turns` turns, on the estimates (and what it watched them take). */
export function pace(memory: MarshalMemory, now: number, turns: number): Map<PlayerId, number> {
  const out = new Map<PlayerId, number>();
  const cur = memory.land.find((x) => x.turn === now);
  const then = [...memory.land].filter((x) => x.turn <= now - turns).pop() ?? memory.land[0];
  if (cur && then && then !== cur) for (const [p, n] of Object.entries(cur.est)) out.set(p, n - (then.est[p] ?? 0));
  // Land it watched them take counts too: a rival gained at least what it was seen taking.
  const watched = new Map<PlayerId, number>();
  for (const x of memory.taken) if (x.turn > now - 1 - turns) for (const [p, k] of Object.entries(x.by)) watched.set(p, (watched.get(p) ?? 0) + k);
  for (const [p, k] of watched) out.set(p, Math.max(out.get(p) ?? 0, k));
  return out;
}
