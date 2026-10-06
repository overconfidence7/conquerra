import type { SpecialistType } from "@conquerra/content";
import type { LandChange, PlayerView, ReplayEvent, TerritoryId, TerritoryView } from "@conquerra/engine";
import { FATE_LABEL } from "../logic/cards";

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
  /**
   * For each event: how many events (in list order) the map shows once its result is in. Usually just past the event
   * itself; further when a vision event follows it (the fog lifts as the land is taken).
   */
  ends: number[];
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

/** The word over the land a world event hit, in the replay. */
const WORLD_EVENT_LABEL = { plague: "Plague", storm: "Storm", uprising: "Uprising", mercenaries: "Mercenaries", famine: "Famine" } as const;

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
    case "generalCaptured":
    case "generalLost":
    case "worldEvent":
    case "spoilsTurnedIn":
    case "fate":
    case "missionDone":
      return "pop";
    // A governing general's purchase pops on the map (only when it bought something).
    case "governed":
      return e.land.length ? "pop" : null;
    // Deals: a deal starting or broken gets a beat (its toast), with any land that changed hands or troops that
    // deserted popping on the map; a payment only if troops deserted for it.
    case "dealStarted":
    case "dealBroken":
      return "pop";
    case "tribute":
      return e.land.length ? "pop" : null;
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
    case "generalReleased":
    case "worldEventFailed":
    case "spoilsEarned":
    case "missionDrawn":
    case "missionFailed":
    case "dealEnded":
    case "dealFailed":
    case "offerLapsed":
    case "purseHome":
    // Spies report as the turn ends: in the turn report (their owner's eyes only).
    case "spyHired":
    case "spy":
    case "spyCaught":
    // The fog lifting (or falling) rides on the beat of the step that caused it.
    case "vision":
      return null;
  }
};

/** Kinds that fold neighbouring events of the same kind into one beat. */
const GROUPS: ReadonlySet<BeatKind> = new Set(["pop", "march", "pulse"]);

export function buildTimeline(events: readonly ReplayEvent[]): Timeline {
  const sorted = events.map((e, i) => ({ e, i })).sort((a, b) => a.e.step - b.e.step || a.i - b.i);
  const raw: { kind: BeatKind; events: ReplayEvent[]; ends: number[]; lastIndex: number; ms: number }[] = [];
  for (const { e, i } of sorted) {
    const prev = raw[raw.length - 1];
    // A vision event lands with the event just before it: for a capture, the fog lifts as the result shows.
    if (e.type === "vision") {
      if (prev) {
        prev.ends[prev.ends.length - 1] = i + 1;
        prev.lastIndex = i;
      }
      continue;
    }
    const kind = kindOf(e);
    if (!kind) continue;
    if (prev && prev.kind === kind && GROUPS.has(kind)) {
      prev.events.push(e);
      prev.ends.push(i + 1);
      prev.lastIndex = i;
      prev.ms += EXTRA_MS[kind] ?? 0;
    } else raw.push({ kind, events: [e], ends: [i + 1], lastIndex: i, ms: BEAT_MS[kind] });
  }
  const sum = raw.reduce((t, b) => t + b.ms, 0);
  const squeeze = sum > TARGET_MAX_MS ? TARGET_MAX_MS / sum : 1;
  let t = 0;
  const beats = raw.map((b) => {
    // (Rounded down when squeezed, so a long turn never runs past the target.)
    const duration = squeeze < 1 ? Math.floor(Math.max(b.ms * MIN_SHARE, b.ms * squeeze)) : b.ms;
    const beat: Beat = { kind: b.kind, start: t, duration, events: b.events, ends: b.ends, lastIndex: b.lastIndex };
    t += duration;
    return beat;
  });
  return { beats, total: t };
}

// ---------- What's on screen at a moment ----------

export interface MarchAnim {
  from: TerritoryId;
  to: TerritoryId;
  /** Right of passage: the partner's land it marches through on the way. */
  through?: TerritoryId[];
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
  what: "battle" | "leaderFell" | "fate";
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
      if (e.type === "moved") frame.marches.push({ from: e.from, to: e.to, ...(e.through ? { through: e.through } : {}), player: e.player, troops: e.army.troops, progress: ease(q), retreat: e.retreat });
      else if (e.type === "battle") {
        if (p < MARCH_SHARE) frame.marches.push({ from: e.from, to: e.to, ...(e.through ? { through: e.through } : {}), player: e.player, troops: e.attackers.troops, progress: ease(p / MARCH_SHARE) * (e.through ? 1 - 0.18 / (e.through.length + 1) : 0.82), retreat: false });
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
        // The land changes hands once the result shows (and the fog lifts around it, if it does).
        if (p >= RESULT_AT) frame.applied = Math.max(frame.applied, b.ends[k]!);
      } else if (e.type === "surface") frame.pulses.push({ province: e.province, what: e.what, progress: q });
      else if (e.type === "recruited") frame.pops.push({ at: e.territory, player: e.player, label: `+${e.count}`, progress: q });
      else if (e.type === "hired") frame.pops.push({ at: e.territory, player: e.player, label: "+1 specialist", progress: q });
      else if (e.type === "built" || e.type === "completed") frame.pops.push({ at: e.territory, player: e.player, label: e.building, progress: q });
      else if (e.type === "invested") frame.pops.push({ at: e.territory, player: e.player, label: "culture", progress: q });
      else if (e.type === "governed" && e.land[0]) frame.pops.push({ at: e.land[0].territory, player: e.player, label: e.spent[0]?.what === "fort" ? "fort" : e.spent[0]?.what === "culture" ? "culture" : "troops", progress: q });
      else if (e.type === "leaderReturned") frame.pops.push({ at: e.territory, player: e.player, label: "Leader", progress: q });
      else if (e.type === "generalCaptured") frame.pops.push({ at: e.territory, player: e.player, label: "Captured general", progress: q });
      else if (e.type === "generalLost") frame.pops.push({ at: e.territory, player: e.player, label: "General lost", progress: q });
      else if (e.type === "worldEvent") frame.pops.push({ at: e.target, player: e.against, label: WORLD_EVENT_LABEL[e.event], progress: q });
      else if (e.type === "spoilsTurnedIn") frame.pops.push({ at: e.at, player: e.player, label: "Spoils", progress: q });
      else if (e.type === "fate") frame.pops.push({ at: e.at, player: e.holder ?? "", label: FATE_LABEL[e.card] ?? "Fate", progress: q });
      else if (e.type === "missionDone" && e.at) frame.pops.push({ at: e.at, player: e.player, label: "Mission", progress: q });
      else if (e.type === "dealStarted" && e.land[0]) frame.pops.push({ at: e.land[0].territory, player: e.land[0].owner ?? "", label: "Traded", progress: q });
      else if ((e.type === "dealBroken" || e.type === "tribute") && e.land[0]) frame.pops.push({ at: e.land[0].territory, player: e.type === "dealBroken" ? e.by : e.from, label: "Unrest", progress: q });
    });
    break;
  }
  return frame;
}

// ---------- The map during the replay ----------

type Seen = Extract<TerritoryView, { detail: "full" }>;

/**
 * The view to draw part-way through the replay: the view from before the turn, with the first `applied` events
 * played onto it (troops marching out and in, land changing hands, recruits arriving, Leaders moving).
 *
 * The fog lifts during the replay: a "vision" event brings land into view with the detail it had at that moment, and
 * fogs over land you no longer see (it takes the "last seen" look). Only land you can see at that point changes;
 * by the end this matches the view after the turn, which then replaces it.
 */
export function replayView(before: PlayerView, events: readonly ReplayEvent[], applied: number): PlayerView {
  const territories: Record<TerritoryId, TerritoryView> = { ...before.territories };
  const edit = (id: TerritoryId, f: (t: Seen) => void) => {
    const t = territories[id];
    if (!t || t.detail !== "full") return;
    const copy: Seen = { ...t, specialists: [...t.specialists], leaders: [...t.leaders] };
    f(copy);
    copy.troops = Math.max(0, copy.troops);
    territories[id] = copy;
  };
  const specialistsAt = (id: TerritoryId) => {
    const t = territories[id];
    return t?.detail === "full" ? t.specialists : [];
  };
  /**
   * Specialists leaving with an army: the first of each listed type (the view has their ids, the event their types).
   * An army marching out of the fog brings specialists the view never had: they get stand-in ids.
   */
  const takeSpecialists = (from: TerritoryId, types: readonly SpecialistType[], step: number) => {
    const want = [...types];
    const out: Seen["specialists"] = [];
    for (const s of specialistsAt(from)) {
      const k = want.indexOf(s.type);
      if (k >= 0) (out.push(s), want.splice(k, 1));
    }
    const ids = new Set(out.map((s) => s.id));
    edit(from, (t) => (t.specialists = t.specialists.filter((s) => !ids.has(s.id))));
    return [...out, ...want.map((type, k) => ({ id: `replay-${step}-${k}`, type }))];
  };
  const moveLeader = (player: string, from: TerritoryId | null, to: TerritoryId | null) => {
    if (from) edit(from, (t) => (t.leaders = t.leaders.filter((p) => p !== player)));
    if (to) edit(to, (t) => (t.leaders = t.leaders.includes(player) ? t.leaders : [...t.leaders, player]));
  };
  /** A captured general (by whose Leader it was) moving with its army, appearing or gone. */
  const moveGeneral = (general: string, from: TerritoryId | null, to: TerritoryId | null) => {
    if (from) edit(from, (t) => (t.generals = t.generals.filter((p) => p !== general)));
    if (to) edit(to, (t) => (t.generals = t.generals.includes(general) ? t.generals : [...t.generals, general]));
  };
  /** A card's effect: the land as it is afterwards (only land you can see changes). */
  const applyLand = (land: readonly LandChange[]) => {
    for (const { territory, ...change } of land)
      edit(territory, (t) => {
        Object.assign(t, change);
        if (change.specialists) t.specialists = change.specialists.map((s) => ({ ...s }));
        if (change.owner !== undefined && change.owner === null) t.capitalOf = null;
      });
  };
  /** Where each House's Leader stands, as far as this view knows. */
  const leaderAt = (player: string) => Object.keys(territories).find((id) => {
    const t = territories[id]!;
    return t.detail === "full" && t.leaders.includes(player);
  }) ?? null;

  /** Capitals this view knows about: yours, and any it has shown (a capital is labelled once you see it). */
  const capitals = new Map<TerritoryId, string>([[before.me.capital, before.me.id]]);
  const noteCapitals = (list: Record<TerritoryId, TerritoryView>) => {
    for (const [id, t] of Object.entries(list)) if (t.detail === "full" && t.capitalOf) capitals.set(id, t.capitalOf);
  };
  noteCapitals(before.territories);

  events.slice(0, applied).forEach((e, i) => {
    switch (e.type) {
      case "recruited":
        edit(e.territory, (t) => (t.troops += e.count));
        break;
      case "hired":
        edit(e.territory, (t) => t.specialists.push({ id: `replay-${i}`, type: e.specialist }));
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
      case "invested":
        edit(e.territory, (t) => (t.culture = e.culture));
        break;
      case "moved": {
        const specs = takeSpecialists(e.from, e.army.specialists, e.step);
        edit(e.from, (t) => (t.troops -= e.army.troops));
        edit(e.to, (t) => ((t.troops += e.army.troops), t.specialists.push(...specs)));
        if (e.withLeader) moveLeader(e.player, e.from, e.to);
        if (e.withGeneral) moveGeneral(e.withGeneral, e.from, e.to);
        break;
      }
      case "battle": {
        const survivors = e.attackers.troops - e.result.attackerLosses;
        const specs = takeSpecialists(e.from, e.attackers.specialists, e.step);
        edit(e.from, (t) => {
          t.troops -= e.attackers.troops - (e.captured ? 0 : survivors);
          if (!e.captured && survivors > 0) t.specialists.push(...specs);
        });
        edit(e.to, (t) => {
          if (e.captured) {
            t.owner = e.player;
            t.troops = survivors;
            t.specialists = specs;
            // Taking back your own capital (or a rival's you've seen) makes it a capital again.
            t.capitalOf = capitals.get(e.to) === e.player ? e.player : null;
          } else {
            t.troops -= e.result.defenderLosses;
            if (t.troops <= 0) t.specialists = [];
          }
        });
        if (e.captured && e.withLeader) moveLeader(e.player, e.from, e.to);
        if (e.captured && e.withGeneral) moveGeneral(e.withGeneral, e.from, e.to);
        break;
      }
      case "generalCaptured":
        moveGeneral(e.general, null, e.territory);
        break;
      case "worldEvent":
        for (const l of e.losses ?? []) edit(l.territory, (t) => (t.troops -= l.troops));
        if (e.flipped) edit(e.target, (t) => ((t.owner = null), (t.troops = e.rebels!), (t.specialists = []), (t.capitalOf = null)));
        if (e.at) edit(e.at, (t) => (t.troops += e.troops!));
        break;
      case "generalLost":
        moveGeneral(e.general, e.territory, null);
        break;
      case "spoilsTurnedIn":
      case "fate":
      case "missionDone":
      case "dealStarted":
      case "dealBroken":
      case "tribute":
        applyLand(e.land);
        break;
      case "leaderKilled":
        moveLeader(e.player, leaderAt(e.player), null);
        break;
      case "leaderReturned":
        moveLeader(e.player, leaderAt(e.player), e.territory);
        break;
      case "income":
        // Your own deserters (you see your own land); nobody else's income is in your replay.
        for (const d of e.deserters) edit(d.territory, (t) => (t.troops -= d.troops));
        break;
      case "vision":
        noteCapitals(e.revealed);
        for (const [id, seen] of Object.entries(e.revealed)) territories[id] = { ...seen, specialists: [...seen.specialists], leaders: [...seen.leaders], generals: [...seen.generals] };
        for (const [id, last] of Object.entries(e.fogged)) territories[id] = { detail: "fogged", lastSeen: { ...last } };
        break;
      default:
        break;
    }
  });
  return { ...before, territories };
}
