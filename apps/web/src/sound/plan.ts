import type { ReplayEvent } from "@conquerra/engine";
import { STONE_FLIGHT_MS, SPY_MS } from "../replay/fx/plan";
import { fxSeed } from "../replay/fx/random";
import { MARCH_SHARE, RESULT_AT, type Timeline } from "../replay/timeline";
import { CUE_SPECS, type CueName } from "./cues";

/**
 * Which sounds play in a replay, and when (session 24), worked out from the timeline alone like the effects
 * (replay/fx/plan.ts), so it can't hint at anything the fog hides: a fogged event is a "surface" event (a kind and a
 * province, no more) and every one of them gets the same distant rumble. Driven by the replay's clock: "Watch again"
 * plays the same sounds at the same moments, and a variant (three sword clashes) is picked by a seed from the game's
 * public id, the turn and the event, never Math.random().
 */

export interface SoundContext {
  gameId: string;
  turn: number;
  /** You. */
  me: string;
  /** Capitals this view knows of: a capital falling gets the big sound. */
  isCapital: (id: string) => boolean;
  /** A fort or a wall behind the defenders: arrows from the walls. */
  fortified: (id: string) => boolean;
}

export interface PlannedSound {
  /** ms from the start of the replay. */
  at: number;
  cue: CueName;
  /** Picks the file and the pitch. */
  seed: number;
  /** Volume on top of the cue's own (troop counts, a building begun). */
  gain: number;
}

/** An army of this many or more marches to the bigger drums. */
export const MARCH_MEDIUM = 6;
export const MARCH_LARGE = 20;
/** A fight with this many troops in it (both sides) gets the shouts too. */
export const BIG_FIGHT = 15;

const march = (troops: number): CueName => (troops >= MARCH_LARGE ? "march-large" : troops >= MARCH_MEDIUM ? "march-medium" : "march-small");

/** How a cue's volume grows with troops (1 when it doesn't). */
export function troopGain(cue: CueName, troops: number): number {
  const t = CUE_SPECS[cue].troops;
  if (!t) return 1;
  const u = Math.max(0, Math.min(1, (troops - t.from) / Math.max(1, t.to - t.from)));
  return t.scale[0] + (t.scale[1] - t.scale[0]) * u;
}

/** Every sound of the replay, in order. */
export function soundPlan(tl: Timeline, ctx: SoundContext, events: readonly ReplayEvent[]): PlannedSound[] {
  const index = new Map(events.map((e, i) => [e, i]));
  const out: PlannedSound[] = [];
  const add = (e: ReplayEvent, cue: CueName, at: number, gain = 1, part = "") =>
    out.push({ at: Math.round(at), cue, seed: fxSeed(ctx.gameId, ctx.turn, index.get(e) ?? 0, `sound:${cue}${part}`), gain });

  for (const b of tl.beats) {
    const n = b.events.length;
    b.events.forEach((e, k) => {
      // (Several things in one beat start a little apart, as their effects do.)
      const local = b.start + (n > 1 ? (k / n) * 0.35 : 0) * b.duration;
      switch (e.type) {
        case "surface":
          // The fog: one distant rumble for the beat, the same whatever it was (nine things stirring in a second
          // would be nine rumbles otherwise).
          return k === 0 ? add(e, "fog", local) : undefined;
        case "moved":
          return add(e, march(e.army.troops), local, troopGain(march(e.army.troops), e.army.troops));
        case "battle": {
          const D = b.duration;
          const troops = e.attackers.troops + e.defenders.troops;
          const fight = b.start + D * MARCH_SHARE;
          add(e, march(e.attackers.troops), b.start, 0.8 * troopGain(march(e.attackers.troops), e.attackers.troops));
          add(e, "battle", fight, troopGain("battle", troops));
          if (troops >= BIG_FIGHT) add(e, "battle-big", fight + 60, troopGain("battle-big", troops));
          if (e.defenders.troops > 0 && ctx.fortified(e.to)) add(e, "arrows", fight + 120);
          if (e.attackers.specialists.includes("siege")) add(e, "siege", fight + STONE_FLIGHT_MS);
          const result = b.start + D * RESULT_AT;
          if (!e.captured) return add(e, "held", result);
          if (ctx.isCapital(e.to)) return add(e, "capital-falls", result);
          if (e.player === ctx.me) return add(e, "capture", result);
          // (A rival taking neutral land gets no horn: on the opening turns that's every other second.)
          return e.defender ? add(e, "capture-rival", result) : undefined;
        }
        case "leaderKilled":
          return add(e, "leader-falls", b.start);
        case "eliminated":
          return add(e, "knocked-out", b.start);
        case "recruited":
        case "hired":
          return add(e, "recruits", local);
        case "built":
          return add(e, "built", local, e.doneAtEndOfTurn === null ? 1 : 0.5);
        case "completed":
          return add(e, "built", local);
        case "invested":
          return add(e, "culture", local);
        case "walled":
          return add(e, "wall", local);
        case "spoilsTurnedIn":
          return add(e, "spoils", local);
        case "fate":
          return add(e, "fate", local);
        case "worldEvent":
          return add(e, "fallen", local);
        case "dealStarted":
          return add(e, "deal-sealed", local);
        case "dealBroken":
          return add(e, "deal-broken", local);
        default:
          return;
      }
    });
  }
  // As the turn ends: your spies' news (only you hear of them), and your gold coming in.
  const spyFrom = Math.max(0, tl.total - SPY_MS);
  for (const e of events) {
    if (e.type === "spy") add(e, e.outcome === "killed" ? "spy-caught" : "spy", spyFrom);
    else if (e.type === "spyCaught") add(e, "spy-caught", spyFrom);
    else if (e.type === "income" && e.player === ctx.me && e.income > 0) add(e, "coins-income", Math.max(0, tl.total - 450));
  }
  // Each cue's cooldown: not again within that long (worked out here, so Watch again is the same).
  const last = new Map<CueName, number>();
  return out
    .sort((a, b) => a.at - b.at)
    .filter((s) => {
      const prev = last.get(s.cue);
      if (prev !== undefined && s.at - prev < CUE_SPECS[s.cue].cooldown) return false;
      last.set(s.cue, s.at);
      return true;
    });
}

/** The sounds due between two moments of the replay (after `from`, up to and including `to`). */
export function soundsBetween(plan: readonly PlannedSound[], from: number, to: number): PlannedSound[] {
  const out: PlannedSound[] = [];
  for (const s of plan) {
    if (s.at > to) break;
    if (s.at > from) out.push(s);
  }
  return out;
}
