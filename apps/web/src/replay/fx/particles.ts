import { rand } from "./random";
import { RECIPES, type EmitterInput, type RecipeName } from "./recipes";

/**
 * Particles worked out from the replay's clock (session 21): every particle's position, size, turn and fade at a
 * moment are a formula of its seed and the time, never a step-by-step simulation, so the replay can be drawn at any
 * moment and "Watch again" matches exactly. Pure: no Pixi, no DOM (tested on its own).
 */

/** How much of the show: Full, Light (half the particles, no shake, no flashes) or Off (the info layer only). */
export type FxLevel = "full" | "light" | "off";

/** Particles at once, at most (docs/09: about 600 on a phone, 2,000 on a laptop). */
export const BUDGET = { phone: 600, desktop: 2000 } as const;

/** One effect playing: a recipe at a spot on the map, for a while. */
export interface FxInstance {
  /** Stable while it plays (for tests and debugging). */
  key: string;
  recipe: RecipeName;
  seed: number;
  /** Where (map units). */
  x: number;
  y: number;
  /** The other side (map units): where a volley flies to, what the attackers fall back toward. */
  tx?: number;
  ty?: number;
  /** The army's way over the effect's time (map units, x, y pairs evenly spaced in time), for dust behind a march. */
  path?: number[];
  /** ms since it started, and how long it lasts. */
  age: number;
  span: number;
  troops: number;
  /** Colours for "house", "attacker", "defender" and "ground" tints. */
  tints: Partial<Record<"house" | "attacker" | "defender" | "ground", number>>;
}

/** One particle at one moment. Drawn at the map spot (mx, my) plus an offset in Mid-zoom pixels. */
export interface ParticleState {
  texture: string;
  blend: "normal" | "add" | "screen";
  mx: number;
  my: number;
  dx: number;
  dy: number;
  /** Longest side, Mid-zoom pixels. */
  size: number;
  rotation: number;
  alpha: number;
  tint: number;
}

const DEG = Math.PI / 180;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const hex = (s: string) => parseInt(s.slice(1), 16);

/** How many particles an emitter makes for this many troops, before Light and the budget. */
export function rawCount(e: EmitterInput, troops: number): number {
  return Math.min(e.max, Math.round(e.count + (e.perTroop ?? 0) * Math.max(0, troops)));
}

/** All the particles an effect would make, before Light and the budget. */
export function instanceCount(inst: FxInstance, level: FxLevel): number {
  if (level === "off") return 0;
  let n = 0;
  for (const e of RECIPES[inst.recipe].emitters as readonly EmitterInput[]) if (!(level === "light" && e.flash)) n += rawCount(e, inst.troops);
  return n;
}

/** A point along a time-spaced path (x, y pairs) at share u of its time. */
function along(path: readonly number[], u: number): [number, number] {
  const n = path.length / 2;
  if (n < 2) return [path[0] ?? 0, path[1] ?? 0];
  const f = Math.max(0, Math.min(1, u)) * (n - 1);
  const i = Math.min(n - 2, Math.floor(f)), k = f - i;
  return [lerp(path[2 * i]!, path[2 * i + 2]!, k), lerp(path[2 * i + 1]!, path[2 * i + 3]!, k)];
}

/**
 * The particles of one effect at its age, appended to `out`. `share` scales every count (Light, the budget);
 * `pxPerUnit` is Mid-zoom pixels per map unit (to aim flights and point arrows along their arc).
 */
export function particlesOf(inst: FxInstance, level: FxLevel, share: number, pxPerUnit: number, out: ParticleState[]): void {
  if (level === "off" || share <= 0) return;
  const emitters = RECIPES[inst.recipe].emitters as readonly EmitterInput[];
  emitters.forEach((e, ei) => {
    if (level === "light" && e.flash) return;
    const raw = rawCount(e, inst.troops);
    const n = raw > 0 ? Math.max(1, Math.round(raw * share)) : 0;
    const spreadY = e.spreadY ?? e.spread * 0.6;
    const fadeIn = e.fadeIn ?? 0.1, fadeOut = e.fadeOut ?? 0.4, grow = e.grow ?? 1;
    const [spin0, spin1] = e.spin ?? [0, 0];
    const tint = e.tint === undefined ? 0xffffff : e.tint.startsWith("#") ? hex(e.tint) : (inst.tints[e.tint as keyof FxInstance["tints"]] ?? 0xffffff);
    for (let i = 0; i < n; i++) {
      const r = (j: number) => rand(inst.seed, ei, i, j);
      const birth = lerp(e.at[0], e.at[1], r(0)) * inst.span;
      const life = lerp(e.life[0], e.life[1], r(1));
      const tau = inst.age - birth;
      if (tau < 0 || tau > life) continue;
      const u = tau / life, ts = tau / 1000;
      const [mx0, my0] = e.alongPath && inst.path ? along(inst.path, birth / inst.span) : [inst.x, inst.y];
      const ang0 = r(2) * Math.PI * 2, rad = Math.sqrt(r(3));
      const ox = Math.cos(ang0) * e.spread * rad, oy = Math.sin(ang0) * spreadY * rad;
      let mx = mx0, my = my0, dx = ox, dy = oy, rotation: number;
      if (e.flight && inst.tx !== undefined && inst.ty !== undefined) {
        // An arc from here to the target: along the line on the map, lifted by the arc in pixels.
        const h = lerp(e.flight.height[0], e.flight.height[1], r(4));
        mx = lerp(mx0, inst.tx, u);
        my = lerp(my0, inst.ty, u);
        dy -= h * 4 * u * (1 - u);
        const vx = (inst.tx - mx0) * pxPerUnit, vy = (inst.ty - my0) * pxPerUnit - h * 4 * (1 - 2 * u);
        rotation = e.faceTravel ? Math.atan2(vy, vx) : r(5) * Math.PI * 2 + lerp(spin0, spin1, r(6)) * DEG * ts;
      } else {
        let a = lerp(e.angle[0], e.angle[1], r(4)) * DEG;
        if ((e.aim === "toward" || e.aim === "away") && inst.tx !== undefined && inst.ty !== undefined) a += Math.atan2(inst.ty - my0, inst.tx - mx0) + (e.aim === "away" ? Math.PI : 0);
        const s = lerp(e.speed[0], e.speed[1], r(5));
        const vx = Math.cos(a) * s, vy = Math.sin(a) * s;
        const d = e.drag ?? 0;
        // Closed form: slowing down exponentially, falling with gravity.
        const f = d > 0 ? (1 - Math.exp(-d * ts)) / d : ts;
        const g = e.gravity ?? 0;
        dx += vx * f;
        dy += vy * f + 0.5 * g * ts * ts;
        rotation = e.faceTravel ? Math.atan2(vy * (d > 0 ? Math.exp(-d * ts) : 1) + g * ts, vx * (d > 0 ? Math.exp(-d * ts) : 1)) : r(6) * Math.PI * 2 + lerp(spin0, spin1, r(7)) * DEG * ts;
      }
      const env = u < fadeIn ? u / fadeIn : u > 1 - fadeOut ? (1 - u) / fadeOut : 1;
      out.push({
        texture: e.textures[Math.floor(r(8) * e.textures.length)]!,
        blend: e.blend,
        mx,
        my,
        dx,
        dy,
        size: lerp(e.size[0], e.size[1], r(9)) * (1 + (grow - 1) * u),
        rotation,
        alpha: e.alpha * Math.max(0, Math.min(1, env)),
        tint,
      });
    }
  });
}

/**
 * Every particle on screen at a moment: Light halves the counts, and past the budget everything is thinned together
 * (the same way every time, so a moment always looks the same). Returns the particles and the share used.
 */
export function particlesAt(instances: readonly FxInstance[], level: FxLevel, budget: number, pxPerUnit: number): { particles: ParticleState[]; share: number } {
  const particles: ParticleState[] = [];
  if (level === "off") return { particles, share: 0 };
  const base = level === "light" ? 0.5 : 1;
  const total = instances.reduce((n, i) => n + instanceCount(i, level), 0) * base;
  const share = total > budget ? (base * budget) / total : base;
  for (const inst of instances) particlesOf(inst, level, share, pxPerUnit, particles);
  return { particles, share };
}
