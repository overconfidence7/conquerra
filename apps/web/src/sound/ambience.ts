import type { MapDef } from "@conquerra/content";
import type { Camera, Viewport } from "../map/camera";
import { duckLevel } from "./duck";
import { busGains, useSound } from "./settings";
import { audioPool, unlockedAudio } from "./unlock";

/**
 * A quiet bed under the map while you plan (session 24, Part 4): wind always, the sea when the camera shows coast,
 * birds now and then. Closer in is a little louder. It sits under Music's volume (no setting of its own), well under
 * the effects (its files are 8 LU quieter, and it fades out while the replay plays), and stops while the tab is
 * hidden. It streams like the music.
 */

export type Bed = "wind" | "sea" | "birds";
/** Each bed's volume before Settings (the cue list's, kept here so the planning screen needn't load it). */
export const BED_VOLUME: Record<Bed, number> = { wind: 0.5, sea: 0.5, birds: 0.35 };
/** Birds sing for this long out of every BIRD_CYCLE_MS. */
export const BIRD_CYCLE_MS = 70_000;
export const BIRD_ON_MS = 25_000;
/** On-screen territory sizes (px) for "far" and "near": closeness runs 0 to 1 between them. */
const FAR_PX = 48;
const NEAR_PX = 260;

export interface AmbienceScene {
  /** 0 far out, 1 close in. */
  closeness: number;
  /** Share of the view that's water (0 to 1). */
  water: number;
}

/** How close the camera is: from how big a typical territory is on screen. */
export function closenessOf(cam: Camera, territorySize: number): number {
  return Math.max(0, Math.min(1, (cam.scale * territorySize - FAR_PX) / (NEAR_PX - FAR_PX)));
}

/** The share of the view that's water, from the map's ground grid (sampled on a 16 by 10 grid over the screen). */
export function waterInView(map: MapDef, cam: Camera, vp: Viewport): number {
  const b = map.geometry?.biome;
  if (!b) return 0;
  let water = 0, n = 0;
  for (let i = 0; i < 16; i++)
    for (let j = 0; j < 10; j++) {
      const x = ((vp.width * (i + 0.5)) / 16 - cam.x) / cam.scale;
      const y = ((vp.height * (j + 0.5)) / 10 - cam.y) / cam.scale;
      const c = Math.floor(x / b.cellSize), r = Math.floor(y / b.cellSize);
      // Off the map's edge is open sea.
      const code = c < 0 || r < 0 || c >= b.cols || r >= b.rows ? "O" : b.data[r * b.cols + c];
      if (code === "o" || code === "O") water++;
      n++;
    }
  return n ? water / n : 0;
}

/** How loud each bed is (0 to 1, before its own volume and Settings) for a scene, at a moment (the birds come and go). */
export function bedLevels(s: AmbienceScene, now: number): Record<Bed, number> {
  const near = 0.7 + 0.3 * s.closeness;
  // The sea where there's coast in view: louder the more water, up to half the view.
  const sea = Math.min(1, s.water * 2) * near;
  const phase = now % BIRD_CYCLE_MS;
  const birdsOn = phase < BIRD_ON_MS ? Math.min(1, phase / 3000, (BIRD_ON_MS - phase) / 3000) : 0;
  return {
    wind: near * (1 - 0.4 * sea),
    sea,
    birds: birdsOn * (0.3 + 0.7 * s.closeness) * (1 - s.water),
  };
}

const FADE_PER_MS = 1 / 1500;

class Ambience {
  private beds = new Map<Bed, { el: HTMLAudioElement; gain: GainNode | null; level: number }>();
  private scene: AmbienceScene | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private last = 0;
  private hooked = false;

  /** The scene while planning, or null (the replay, or off the game screen): the bed fades out. */
  set(scene: AmbienceScene | null): void {
    this.scene = scene;
    if (scene && !this.timer) {
      if (!unlockedAudio() && !navigator.userActivation?.hasBeenActive) return;
      this.hook();
      this.last = performance.now();
      this.timer = setInterval(() => this.tick(), 100);
    }
  }

  /** What each bed plays at now, for the scripts. */
  state(): Record<string, { level: number; playing: boolean }> {
    return Object.fromEntries([...this.beds].map(([k, b]) => [k, { level: Math.round(b.level * 100) / 100, playing: !b.el.paused }]));
  }

  private bed(name: Bed) {
    let b = this.beds.get(name);
    if (b) return b;
    const el = audioPool.pop() ?? new Audio();
    el.preload = "auto";
    el.loop = true;
    el.src = `${import.meta.env.BASE_URL}sound/amb-${name}.mp3`;
    let gain: GainNode | null = null;
    const ctx = unlockedAudio();
    try {
      if (ctx) {
        gain = ctx.createGain();
        gain.gain.value = 0;
        ctx.createMediaElementSource(el).connect(gain).connect(ctx.destination);
      }
    } catch {
      gain = null;
    }
    if (!gain) el.volume = 0;
    b = { el, gain, level: 0 };
    this.beds.set(name, b);
    return b;
  }

  private tick() {
    const now = performance.now();
    const ms = now - this.last;
    this.last = now;
    const bus = busGains(useSound.getState()).ambience;
    const want = this.scene && bus > 0 && !document.hidden ? bedLevels(this.scene, now) : { wind: 0, sea: 0, birds: 0 };
    const dip = duckLevel(now);
    let any = false;
    for (const name of ["wind", "sea", "birds"] as Bed[]) {
      const target = want[name];
      if (target <= 0 && !this.beds.has(name)) continue;
      const b = this.bed(name);
      b.level = b.level < target ? Math.min(target, b.level + FADE_PER_MS * ms) : Math.max(target, b.level - FADE_PER_MS * ms);
      const v = Math.max(0, Math.min(1, b.level * BED_VOLUME[name] * bus * dip));
      if (b.gain) b.gain.gain.value = v;
      else b.el.volume = v;
      if (b.level > 0 && b.el.paused && !document.hidden) void b.el.play().catch(() => {});
      if (b.level <= 0 && !b.el.paused) b.el.pause();
      if (b.level > 0 || target > 0) any = true;
    }
    if (!any && !this.scene && this.timer) (clearInterval(this.timer), (this.timer = null));
  }

  private hook() {
    if (this.hooked) return;
    this.hooked = true;
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) for (const b of this.beds.values()) b.el.pause();
    });
  }
}

/** The one ambience bed. */
export const ambience = new Ambience();
if (typeof window !== "undefined") (window as unknown as { __conquerraAmbience?: Ambience }).__conquerraAmbience = ambience;
