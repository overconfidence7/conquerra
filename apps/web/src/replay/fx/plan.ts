import type { MapDef } from "@conquerra/content";
import type { ReplayEvent } from "@conquerra/engine";
import { borderPoints, routePoint, type Pt } from "../route";
import { MARCH_SHARE, RESULT_AT, type Beat, type Timeline } from "../timeline";
import type { FxInstance } from "./particles";
import { fxSeed } from "./random";
import type { RecipeName } from "./recipes";

/**
 * Which effects play at a moment of the replay (session 21), worked out from the timeline alone, like the replay
 * itself: so it can't show anything the fog hides. A fogged event is a "surface" event (a kind and a province, no
 * more) and gets no effect here: the replay layer draws the same soft rings for every one of them.
 *
 * Effects play inside each beat; what a result leaves behind (smoke over a fallen capital) may drift on for a moment
 * while the next beat plays, but never makes the replay longer.
 */

/** What a result's effects may run on for after its beat ends (ms). */
export const LINGER_MS = 1600;
/** A battle this big (troops on both sides) shakes the camera a little (not on Light). */
export const BIG_BATTLE = 14;
/** How long a Siege stone flies (ms): the recipe's stone lives this long. */
export const STONE_FLIGHT_MS = 620;

/** The dust's colour on each kind of ground: snow powder in the mountains, mud in the swamps. */
const GROUND: Record<string, number> = { plains: 0xd8c49a, forest: 0xa89870, hills: 0xc4ad80, mountains: 0xeef2f6, swamp: 0x7d6a48 };

export interface FxContext {
  gameId: string;
  turn: number;
  /** Each territory's label point (map units). */
  spot: (id: string) => Pt | undefined;
  /** Where two neighbours' armies meet. */
  borderPoint: (a: string, b: string) => Pt | null;
  terrain: (id: string) => string;
  border: (a: string, b: string) => "normal" | "river" | "pass" | "sea";
  /** A House's colour (hex number) for a player. */
  colour: (player: string | null) => number;
  /** Capitals this player's view knows of (their own and any shown). */
  isCapital: (id: string) => boolean;
  /** A fort or a wall behind the defenders (the volleys come from the walls). */
  fortified: (id: string) => boolean;
  /** Most a curve bends (map units). */
  bendCap: number;
  /** Each event's place in the turn's events (its seed). */
  indexOf: ReadonlyMap<ReplayEvent, number>;
}

export function fxContext(map: MapDef, gameId: string, turn: number, events: readonly ReplayEvent[], colour: FxContext["colour"], isCapital: FxContext["isCapital"], fortified: FxContext["fortified"]): FxContext {
  const spots = new Map(map.geometry!.territories.map((t) => [t.id, { x: t.label.x, y: t.label.y }]));
  const terrain = new Map(map.territories.map((t) => [t.id, t.terrain]));
  const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const borders = new Map(map.borders.map((b) => [key(b.a, b.b), b.type]));
  const span = Math.sqrt((map.geometry!.width * map.geometry!.height) / Math.max(1, map.territories.length));
  return {
    gameId,
    turn,
    spot: (id) => spots.get(id),
    borderPoint: borderPoints(map),
    terrain: (id) => terrain.get(id) ?? "plains",
    border: (a, b) => borders.get(key(a, b)) ?? "normal",
    colour,
    isCapital,
    fortified,
    bendCap: span * 0.35,
    indexOf: new Map(events.map((e, i) => [e, i])),
  };
}

export interface FxPlan {
  instances: FxInstance[];
  /** Camera shake (Mid-zoom pixels) for big battles; the renderer drops it on Light. */
  shake: number;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);

/** An army's way over time, sampled for the dust behind it (map units, evenly spaced in time). */
function pathOf(stops: Pt[], bendCap: number, from: number, to: number, steps = 10): number[] {
  const out: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const [x, y] = routePoint(stops, from + (to - from) * ease(i / steps), bendCap);
    out.push(x, y);
  }
  return out;
}

/** The meeting point of a battle: on the border between the land it attacked from and the land it attacked. */
export function clashPoint(ctx: FxContext, e: Extract<ReplayEvent, { type: "battle" }>): Pt | null {
  const from = e.through?.length ? e.through[e.through.length - 1]! : e.from;
  const a = ctx.spot(from), b = ctx.spot(e.to);
  if (!a || !b) return null;
  return ctx.borderPoint(from, e.to) ?? { x: a.x + (b.x - a.x) * 0.6, y: a.y + (b.y - a.y) * 0.6 };
}

/** The effects playing at `t` ms into the replay. */
export function fxAt(tl: Timeline, t: number, ctx: FxContext): FxPlan {
  const instances: FxInstance[] = [];
  let shake = 0;
  const add = (index: number, part: string, recipe: RecipeName, at: Pt, age: number, span: number, extra: Partial<FxInstance> = {}) => {
    if (age < 0 || age > span + LINGER_MS) return;
    instances.push({ key: `${index}:${part}`, recipe, seed: fxSeed(ctx.gameId, ctx.turn, index, part), x: at.x, y: at.y, age, span, troops: 0, tints: {}, ...extra });
  };

  for (const b of tl.beats) {
    if (t < b.start) break;
    if (t > b.start + b.duration + LINGER_MS) continue;
    const n = b.events.length;
    const lagMax = n > 1 ? 0.35 : 0;
    b.events.forEach((e, k) => {
      const idx = ctx.indexOf.get(e) ?? 0;
      const lag = n > 1 ? (k / n) * 0.35 : 0;
      const local = t - b.start - lag * b.duration;
      if (e.type === "moved") marchFx(ctx, add, idx, "march", e.from, e.to, e.through, e.player, e.army.troops, e.army.specialists, local, b.duration * (1 - lagMax), 1, true);
      else if (e.type === "battle") shake = Math.max(shake, battleFx(ctx, add, idx, e, t - b.start, b));
      else if (e.type === "eliminated") eliminatedFx(ctx, add, idx, e, tl, b, t - b.start);
    });
  }
  return { instances, shake };
}

type Add = (index: number, part: string, recipe: RecipeName, at: Pt, age: number, span: number, extra?: Partial<FxInstance>) => void;

/** Dust behind a march (or a wake on a sea lane, mud flecks in a swamp, a splash at a ford). */
function marchFx(ctx: FxContext, add: Add, idx: number, part: string, from: string, to: string | Pt, through: readonly string[] | undefined, player: string, troops: number, specialists: readonly string[], age: number, span: number, reach: number, live: boolean) {
  if (!live) return;
  const a = ctx.spot(from);
  const end = typeof to === "string" ? ctx.spot(to) : to;
  if (!a || !end) return;
  const stops = [a, ...(through ?? []).map((id) => ctx.spot(id)!).filter(Boolean), end];
  const toId = typeof to === "string" ? to : null;
  const last = through?.length ? through[through.length - 1]! : from;
  const sea = toId ? ctx.border(last, toId) === "sea" : false;
  const path = pathOf(stops, ctx.bendCap, 0, reach);
  const tints = { ground: GROUND[ctx.terrain(from)] ?? GROUND.plains!, house: ctx.colour(player) };
  if (sea) return add(idx, `${part}:wake`, "wake", a, age, span, { path, troops, tints });
  add(idx, `${part}:dust`, specialists.includes("cavalry") ? "cavalryDust" : "marchDust", a, age, span, { path, troops, tints });
  if (ctx.terrain(from) === "swamp" || (toId && ctx.terrain(toId) === "swamp")) add(idx, `${part}:mud`, "mudFlecks", a, age, span, { path, troops, tints });
  if (toId && ctx.border(last, toId) === "river") {
    const ford = ctx.borderPoint(last, toId);
    if (ford) add(idx, `${part}:ford`, "fordSplash", ford, age, span, { troops, tints });
  }
}

/** A battle: the march to the border, the fight there, then the result. Returns the camera shake for a big one. */
function battleFx(ctx: FxContext, add: Add, idx: number, e: Extract<ReplayEvent, { type: "battle" }>, sinceStart: number, b: Beat): number {
  const meet = clashPoint(ctx, e);
  const target = ctx.spot(e.to);
  if (!meet || !target) return 0;
  const D = b.duration;
  const marchMs = D * MARCH_SHARE, fightMs = D * (RESULT_AT - MARCH_SHARE), resultMs = D * (1 - RESULT_AT);
  const troops = e.attackers.troops + e.defenders.troops;
  const tints = { ground: GROUND[ctx.terrain(e.to)] ?? GROUND.plains!, attacker: ctx.colour(e.player), defender: ctx.colour(e.defender), house: ctx.colour(e.player) };
  // The march up to the border.
  if (sinceStart < marchMs + LINGER_MS) marchFx(ctx, add, idx, "march", e.from, meet, e.through, e.player, e.attackers.troops, e.attackers.specialists, sinceStart, marchMs, 1, true);
  const fightAge = sinceStart - marchMs;
  // (The smoke drifts on a moment after the fight: on a busy turn the fight itself is only a third of a second.)
  if (fightAge >= 0) add(idx, "clash", "clash", meet, fightAge, fightMs, { troops, tints });
  if (fightAge >= 0) {
    // Arrows from the defenders, from the walls when there's a fort or a wall behind them.
    if (e.defenders.troops > 0) {
      const from = ctx.fortified(e.to) ? { x: target.x, y: target.y - 6 } : target;
      add(idx, "volley", "volley", from, fightAge, fightMs, { tx: meet.x, ty: meet.y, troops: e.defenders.troops, tints });
    }
    // A Siege engine's stone, and where it lands a puff of debris (the moment it lands, however short the fight).
    if (e.attackers.specialists.includes("siege")) {
      add(idx, "siege", "siegeStone", meet, fightAge, STONE_FLIGHT_MS, { tx: target.x, ty: target.y, troops, tints });
      add(idx, "impact", "stoneImpact", target, fightAge - STONE_FLIGHT_MS, 700, { troops, tints });
    }
  }
  const resultAge = sinceStart - marchMs - fightMs;
  if (resultAge >= 0) {
    const from = ctx.spot(e.through?.length ? e.through[e.through.length - 1]! : e.from)!;
    if (e.captured) {
      add(idx, "captured", "captured", target, resultAge, resultMs, { troops, tints: { ...tints, house: tints.attacker } });
      if (ctx.isCapital(e.to)) add(idx, "capital", "capitalFalls", { x: target.x, y: target.y - 4 }, resultAge, resultMs, { troops, tints });
    } else {
      add(idx, "held", "heldBack", meet, resultAge, resultMs, { tx: from.x, ty: from.y, troops: e.attackers.troops, tints });
      add(idx, "shield", "shieldFlash", target, resultAge, resultMs, { troops, tints });
    }
  }
  // A light shake on big battles, while they fight.
  if (troops >= BIG_BATTLE && fightAge >= 0 && fightAge <= fightMs) {
    const u = fightAge / fightMs;
    return Math.min(3.5, 1.2 + troops / 20) * Math.sin(Math.PI * clamp01(u));
  }
  return 0;
}

/** A House knocked out: its last banner burns, where its last land was taken (when you saw it). */
function eliminatedFx(ctx: FxContext, add: Add, idx: number, e: Extract<ReplayEvent, { type: "eliminated" }>, tl: Timeline, b: Beat, age: number) {
  const at = lastLandOf(tl, e.player, b);
  const p = at ? ctx.spot(at) : null;
  if (!p) return;
  add(idx, "burn", "bannerBurns", { x: p.x, y: p.y - 10 }, age, b.duration, { tints: { house: ctx.colour(e.player) } });
}

/** The last land of a House you saw taken this turn, before its knock-out beat (null: it fell out of your sight). */
export function lastLandOf(tl: Timeline, player: string, before: Beat): string | null {
  let at: string | null = null;
  for (const b of tl.beats) {
    if (b === before) break;
    for (const e of b.events) if (e.type === "battle" && e.captured && e.defender === player) at = e.to;
  }
  return at;
}
