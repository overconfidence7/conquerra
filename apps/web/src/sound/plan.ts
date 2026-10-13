import type { ReplayEvent } from "@conquerra/engine";
import { STONE_FLIGHT_MS, SPY_MS } from "../replay/fx/plan";
import { fxSeed } from "../replay/fx/random";
import { MARCH_SHARE, RESULT_AT, type Timeline } from "../replay/timeline";
import { REGISTRY } from "@conquerra/sound";
import { CUE_SPECS, type CueName } from "./cues";
import { pick } from "./mixer";

/**
 * Which sounds play in a replay, and when (session 24), worked out from the timeline alone like the effects
 * (replay/fx/plan.ts), so it can't hint at anything the fog hides: a fogged event is a "surface" event (a kind and a
 * province, no more) and every one of them gets the same distant rumble. Driven by the replay's clock: "Watch again"
 * plays the same sounds at the same moments, and a variant (three sword clashes) is picked by a seed from the game's
 * public id, the turn and the event, never Math.random(). Session 25b made it much simpler: see REPLAY_SOUND.
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
  /** Cut off here (ms) by a more important sound, when there'd be more than two at once (the mixer cuts it then). */
  until?: number;
  cue: CueName;
  /** Picks the file and the pitch. */
  seed: number;
  /** Volume on top of the cue's own (troop counts, a building begun). */
  gain: number;
}

const FILE_MS = new Map(REGISTRY.files.map((f) => [f.name, f.durationMs]));

/**
 * How busy the replay's sound may get (session 25b, Nate: "much simpler and shorter"; the orchestrator's defaults, which
 * the bench can try others of): at most two effects sounding at once (a more important one cuts the least one off, as
 * the mixer does), one sound of each kind per beat, and an army marches to the drums only from 20 troops.
 */
export interface ReplaySoundRules {
  maxAtOnce: number;
  marchFrom: number;
  /** In place of a cue's own cooldown (the bench tries others). */
  cooldowns?: Partial<Record<CueName, number>>;
}
export const REPLAY_SOUND: ReplaySoundRules = { maxAtOnce: 2, marchFrom: 20 };

/** How a cue's volume grows with troops (1 when it doesn't). */
export function troopGain(cue: CueName, troops: number): number {
  const t = CUE_SPECS[cue].troops;
  if (!t) return 1;
  const u = Math.max(0, Math.min(1, (troops - t.from) / Math.max(1, t.to - t.from)));
  return t.scale[0] + (t.scale[1] - t.scale[0]) * u;
}

/** Every sound of the replay, in order. */
export function soundPlan(tl: Timeline, ctx: SoundContext, events: readonly ReplayEvent[], rules: ReplaySoundRules = REPLAY_SOUND): PlannedSound[] {
  const index = new Map(events.map((e, i) => [e, i]));
  const out: PlannedSound[] = [];
  // One of each kind per beat (session 25b): the beat's first battle clashes, the next ones are seen, not heard.
  let heard = new Set<CueName>();
  const add = (e: ReplayEvent, cue: CueName, at: number, gain = 1, part = "") => {
    if (heard.has(cue)) return;
    heard.add(cue);
    out.push({ at: Math.round(at), cue, seed: fxSeed(ctx.gameId, ctx.turn, index.get(e) ?? 0, `sound:${cue}${part}`), gain });
  };
  const cooldown = (cue: CueName) => rules.cooldowns?.[cue] ?? CUE_SPECS[cue].cooldown;
  const marches = (troops: number) => troops >= rules.marchFrom;

  for (const b of tl.beats) {
    const n = b.events.length;
    heard = new Set();
    b.events.forEach((e, k) => {
      // (Several things in one beat start a little apart, as their effects do.)
      const local = b.start + (n > 1 ? (k / n) * 0.35 : 0) * b.duration;
      switch (e.type) {
        case "surface":
          // The fog: one distant rumble for the beat, the same whatever it was (nine things stirring in a second
          // would be nine rumbles otherwise).
          return k === 0 ? add(e, "fog", local) : undefined;
        case "moved":
          // Only a big army marches to the drums; smaller ones move in silence (session 25b).
          return marches(e.army.troops) ? add(e, "march-large", local, troopGain("march-large", e.army.troops)) : undefined;
        case "battle": {
          const D = b.duration;
          const troops = e.attackers.troops + e.defenders.troops;
          const fight = b.start + D * MARCH_SHARE;
          if (marches(e.attackers.troops)) add(e, "march-large", b.start, 0.8 * troopGain("march-large", e.attackers.troops));
          // One short clash per battle (session 25b: no crowd of shouts on top).
          add(e, "battle", fight, troopGain("battle", troops));
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
    else if (e.type === "spoilsEarned") add(e, "card", Math.max(0, tl.total - 700));
    else if (e.type === "income" && e.player === ctx.me && e.income > 0) add(e, "coins-income", Math.max(0, tl.total - 450));
  }
  // Each cue's cooldown: not again within that long (worked out here, so Watch again is the same). Then at most
  // `maxAtOnce` sounding together: a newcomer more important than the least of them cuts it off (the mixer does the
  // same, with the same cap, so this is what's heard); otherwise the newcomer is left out.
  const last = new Map<CueName, number>();
  const sounding: { s: PlannedSound; end: number; priority: number }[] = [];
  const kept: PlannedSound[] = [];
  for (const s of out.sort((a, b) => a.at - b.at)) {
    const prev = last.get(s.cue);
    if (prev !== undefined && s.at - prev < cooldown(s.cue)) continue;
    for (let i = sounding.length - 1; i >= 0; i--) if (sounding[i]!.end <= s.at) sounding.splice(i, 1);
    const priority = CUE_SPECS[s.cue].priority;
    if (sounding.length >= rules.maxAtOnce) {
      let lowest = -1;
      sounding.forEach((x, i) => {
        if (x.priority < priority && (lowest < 0 || x.priority < sounding[lowest]!.priority)) lowest = i;
      });
      if (lowest < 0) continue;
      sounding[lowest]!.s.until = s.at;
      sounding.splice(lowest, 1);
    }
    last.set(s.cue, s.at);
    sounding.push({ s, end: s.at + soundLength(s), priority });
    kept.push(s);
  }
  return kept;
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

/** How long a planned sound lasts (ms): its file's length at its pitch. */
export function soundLength(s: PlannedSound): number {
  const { file, speed } = pick(s.cue, s.seed);
  return (FILE_MS.get(file) ?? 0) / speed;
}

/**
 * A replay's sound in three numbers (session 25b, the bench): how many sounds play, the most at once, and the seconds
 * of sound in all (overlaps counted once: the time anything at all is sounding).
 */
export function planStats(plan: readonly PlannedSound[]): { sounds: number; mostAtOnce: number; seconds: number } {
  const edges = plan.flatMap((s) => [
    [s.at, 1],
    [Math.min(s.until ?? Infinity, s.at + soundLength(s)), -1],
  ] as [number, number][]);
  edges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let now = 0, most = 0, sounding = 0, from = 0;
  for (const [t, d] of edges) {
    if (now > 0) sounding += t - from;
    now += d;
    from = t;
    most = Math.max(most, now);
  }
  return { sounds: plan.length, mostAtOnce: most, seconds: Math.round(sounding / 100) / 10 };
}
