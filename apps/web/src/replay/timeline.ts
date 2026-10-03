import type { PlayerView, ReplayEvent, TerritoryId, TerritoryView } from "@conquerra/engine";

/**
 * The animated replay's timing and sequencing (docs/04-design-additions.md §1, §8), kept out of the renderer so
 * it's tested on its own. Built only from `replayFor` events, so it can't show anything the fog hides:
 * a fogged event arrives as a "surface" event (just a kind and a province) and stays that way.
 *
 * Pacing: everything plays in step order; a typical turn lasts about 10–20 seconds. Small things that happen
 * together (recruits, buildings) pop in as one beat, marches overlap a little, battles get the most time.
 * No pause, play or speed controls (decided): only Skip, and Watch again in the turn report.
 */

export type BeatKind = "intro" | "pop" | "march" | "battle" | "pulse" | "leaderFell" | "eliminated" | "gameOver";

export interface Beat {
  kind: BeatKind;
  /** ms from the start of the replay. */
  start: number;
  duration: number;
  events: ReplayEvent[];
  /** Index (in the event list) of the last event this beat covers; the map shows everything up to it once done. */
  lastIndex: number;
}

export interface Timeline {
  beats: Beat[];
  /** Total length in ms. */
  total: number;
}

/** Base lengths in ms, before a long turn is squeezed. */
export const BEAT_MS: Record<BeatKind, number> = {
  intro: 900,
  pop: 1000,
  march: 1200,
  battle: 2300,
  pulse: 1000,
  leaderFell: 1000,
  eliminated: 1700,
  gameOver: 2000,
};
/** Extra time for each further item folded into the same beat. */
const EXTRA_MS: Partial<Record<BeatKind, number>> = { pop: 120, march: 380, pulse: 250 };
/** A replay longer than this is squeezed (each beat keeps at least `MIN_SHARE` of its length). */
export const TARGET_MAX_MS = 20000;
const MIN_SHARE = 0.35;

const kindOf = (e: ReplayEvent): BeatKind | null => {
  switch (e.type) {
    case "turnStart":
      return "intro";
    case "recruited":
    case "hired":
    case "built":
    case "completed":
    case "invested":
    case "leaderReturned":
      return "pop";
    case "moved":
      return "march";
    case "battle":
      return "battle";
    case "surface":
      return "pulse";
    case "leaderKilled":
      return "leaderFell";
    case "eliminated":
      return "eliminated";
    case "gameOver":
      return "gameOver";
    // Shown in the turn report, not on the map.
    case "income":
    case "initiative":
    case "fizzled":
      return null;
  }
};

/** Kinds that fold neighbouring events of the same kind into one beat. */
const GROUPS: ReadonlySet<BeatKind> = new Set(["pop", "march", "pulse"]);

export function buildTimeline(events: readonly ReplayEvent[]): Timeline {
  const sorted = events.map((e, i) => ({ e, i })).sort((a, b) => a.e.step - b.e.step || a.i - b.i);
  const raw: { kind: BeatKind; events: ReplayEvent[]; lastIndex: number; ms: number }[] = [];
  for (const { e, i } of sorted) {
    const kind = kindOf(e);
    if (!kind) continue;
    const prev = raw[raw.length - 1];
    if (prev && prev.kind === kind && GROUPS.has(kind)) {
      prev.events.push(e);
      prev.lastIndex = i;
      prev.ms += EXTRA_MS[kind] ?? 0;
    } else raw.push({ kind, events: [e], lastIndex: i, ms: BEAT_MS[kind] });
  }
  const sum = raw.reduce((t, b) => t + b.ms, 0);
  const squeeze = sum > TARGET_MAX_MS ? TARGET_MAX_MS / sum : 1;
  let t = 0;
  const beats = raw.map((b) => {
    const duration = Math.round(Math.max(b.ms * MIN_SHARE, b.ms * squeeze));
    const beat: Beat = { kind: b.kind, start: t, duration, events: b.events, lastIndex: b.lastIndex };
    t += duration;
    return beat;
  });
  return { beats, total: t };
}

// ---------- What's on screen at a moment ----------

export interface MarchAnim {
  from: TerritoryId;
  to: TerritoryId;
  player: string;
  troops: number;
  /** 0..1 along the way. */
  progress: number;
  retreat: boolean;
}

export interface ClashAnim {
  at: TerritoryId;
  from: TerritoryId;
  attacker: string;
  defender: string | null;
  /** 0..1 through the clash. */
  progress: number;
  /** Shown once the clash is over (progress past RESULT_AT). */
  captured: boolean;
  attackerLosses: number;
  defenderLosses: number;
}

export interface PopAnim {
  at: TerritoryId;
  player: string;
  label: string;
  progress: number;
}

export interface PulseAnim {
  province: string;
  what: "battle" | "leaderFell";
  progress: number;
}

export interface ReplayFrame {
  /** ms since the replay started. */
  t: number;
  done: boolean;
  /** How many events (in list order) the map should already show as having happened. */
  applied: number;
  marches: MarchAnim[];
  clashes: ClashAnim[];
  pops: PopAnim[];
  pulses: PulseAnim[];
  /** The beat on screen (for the toast). */
  beat: Beat | null;
}

/** In a battle beat: the army marches for this share of the beat, then the clash, then the result shows. */
export const MARCH_SHARE = 0.38;
export const RESULT_AT = 0.72;

const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function frameAt(tl: Timeline, t: number): ReplayFrame {
  const frame: ReplayFrame = { t, done: t >= tl.total, applied: 0, marches: [], clashes: [], pops: [], pulses: [], beat: null };
  for (const b of tl.beats) {
    if (t >= b.start + b.duration) {
      frame.applied = b.lastIndex + 1;
      continue;
    }
    if (t < b.start) break;
    frame.beat = b;
    const p = clamp01((t - b.start) / b.duration);
    const n = b.events.length;
    b.events.forEach((e, k) => {
      // Grouped items start a little after each other and share the beat.
      const lag = n > 1 ? (k / n) * 0.35 : 0;
      const q = clamp01((p - lag) / (1 - (n > 1 ? 0.35 : 0)));
      if (e.type === "moved") frame.marches.push({ from: e.from, to: e.to, player: e.player, troops: e.army.troops, progress: ease(q), retreat: e.retreat });
      else if (e.type === "battle") {
        if (p < MARCH_SHARE) frame.marches.push({ from: e.from, to: e.to, player: e.player, troops: e.attackers.troops, progress: ease(p / MARCH_SHARE) * 0.82, retreat: false });
        else
          frame.clashes.push({
            at: e.to,
            from: e.from,
            attacker: e.player,
            defender: e.defender,
            progress: (p - MARCH_SHARE) / (1 - MARCH_SHARE),
            captured: e.captured,
            attackerLosses: e.result.attackerLosses,
            defenderLosses: e.result.defenderLosses,
          });
        // The land changes hands once the result shows.
        if (p >= RESULT_AT) frame.applied = Math.max(frame.applied, eventIndexBefore(tl, b, e) + 1);
      } else if (e.type === "surface") frame.pulses.push({ province: e.province, what: e.what, progress: q });
      else if (e.type === "recruited") frame.pops.push({ at: e.territory, player: e.player, label: `+${e.count}`, progress: q });
      else if (e.type === "hired") frame.pops.push({ at: e.territory, player: e.player, label: "+1 specialist", progress: q });
      else if (e.type === "built" || e.type === "completed") frame.pops.push({ at: e.territory, player: e.player, label: e.building, progress: q });
      else if (e.type === "invested") frame.pops.push({ at: e.territory, player: e.player, label: "culture", progress: q });
      else if (e.type === "leaderReturned") frame.pops.push({ at: e.territory, player: e.player, label: "Leader", progress: q });
    });
    break;
  }
  return frame;
}

/** The index in the original event list of a beat's event (beats keep events in order, ending at lastIndex). */
function eventIndexBefore(tl: Timeline, b: Beat, e: ReplayEvent): number {
  return b.lastIndex - (b.events.length - 1 - b.events.indexOf(e));
}

// ---------- The map during the replay ----------

/**
 * The view to draw part-way through the replay: the view from before the turn, with the first `applied` events
 * played onto it (troops marching out and in, land changing hands, recruits arriving). Only territories you could
 * already see in detail change; everything else waits for the view after the turn, which replaces this at the end.
 */
export function replayView(before: PlayerView, events: readonly ReplayEvent[], applied: number): PlayerView {
  const territories: Record<TerritoryId, TerritoryView> = { ...before.territories };
  const edit = (id: TerritoryId, f: (t: Extract<TerritoryView, { detail: "full" }>) => void) => {
    const t = territories[id];
    if (!t || t.detail !== "full") return;
    const copy = { ...t, specialists: [...t.specialists] };
    f(copy);
    copy.troops = Math.max(0, copy.troops);
    territories[id] = copy;
  };
  for (const e of events.slice(0, applied)) {
    switch (e.type) {
      case "recruited":
        edit(e.territory, (t) => (t.troops += e.count));
        break;
      case "built":
        edit(e.territory, (t) => {
          if (e.doneAtEndOfTurn === null) t.building = e.building;
          else t.construction = { building: e.building, doneAtEndOfTurn: e.doneAtEndOfTurn };
        });
        break;
      case "completed":
        edit(e.territory, (t) => ((t.building = e.building), (t.construction = null)));
        break;
      case "moved":
        edit(e.from, (t) => (t.troops -= e.army.troops));
        edit(e.to, (t) => (t.troops += e.army.troops));
        break;
      case "battle": {
        const survivors = e.attackers.troops - e.result.attackerLosses;
        edit(e.from, (t) => (t.troops -= e.attackers.troops - (e.captured ? 0 : survivors)));
        edit(e.to, (t) => {
          if (e.captured) {
            t.owner = e.player;
            t.troops = survivors;
            t.specialists = [];
            t.capitalOf = null;
          } else t.troops -= e.result.defenderLosses;
        });
        break;
      }
      default:
        break;
    }
  }
  return { ...before, territories };
}
