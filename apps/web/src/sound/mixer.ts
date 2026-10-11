import { REGISTRY } from "@conquerra/sound";
import { rand } from "../replay/fx/random";
import { CUE_SPECS, type CueName } from "./cues";
import { duck } from "./duck";
import { busGains, useSound } from "./settings";
import { unlockedAudio } from "./unlock";

/**
 * Plays the game's sounds (session 24). Sound effects on @pixi/sound v6 (MIT), loaded with the game screen: the
 * library is fetched only when the first sound is wanted, and handed the audio context the first tap woke
 * (sound/unlock.ts), so phones play it. Music streams from an audio element through the same context (Part 3).
 *
 * Never annoying: at most 6 sounds at once on a phone and 12 on a laptop (a more important one takes the place of the
 * least), the same cue never more than twice in 100 ms, nothing plays while the tab is hidden, and the music dips under
 * the big moments. Sound never carries game state: with it off, nothing is missing.
 */

type PixiSound = typeof import("@pixi/sound");
type Instance = import("@pixi/sound").IMediaInstance;

/** How many sounds may play at once. */
export const MAX_AT_ONCE = { phone: 6, laptop: 12 } as const;
/** The same cue at most this many times in STACK_MS. */
export const MAX_STACK = 2;
export const STACK_MS = 100;

const FILE_BYTES = new Map(REGISTRY.files.map((f) => [f.name, f.bytes]));
export const url = (name: string) => `${import.meta.env.BASE_URL}sound/${name}.mp3`;
const isPhone = () => typeof matchMedia === "function" && (matchMedia("(pointer: coarse)").matches || innerWidth < 768);

interface Playing {
  cue: CueName;
  priority: number;
  /** Null for the moment between taking its place and starting (its file is still being fetched). */
  inst: Instance | null;
}

/** What a cue's play decision depends on (pure, so the tests can check the caps and the stacking rule). */
export interface MixState {
  playing: readonly { cue: string; priority: number }[];
  /** When each recent sound started (ms), by cue. */
  recent: ReadonlyMap<string, readonly number[]>;
}
/** Play it, play it in place of a less important sound (its index in `playing`), or skip it. */
export function admit(state: MixState, cue: CueName, now: number, cap: number): { play: true; replace: number | null } | { play: false; why: "stacked" | "busy" } {
  const recent = (state.recent.get(cue) ?? []).filter((t) => now - t < STACK_MS);
  if (recent.length >= MAX_STACK) return { play: false, why: "stacked" };
  if (state.playing.length < cap) return { play: true, replace: null };
  const priority = CUE_SPECS[cue].priority;
  let lowest = -1;
  state.playing.forEach((p, i) => {
    if (p.priority < priority && (lowest < 0 || p.priority < state.playing[lowest]!.priority)) lowest = i;
  });
  return lowest < 0 ? { play: false, why: "busy" } : { play: true, replace: lowest };
}

/** The file and the pitch a seed picks for a cue. */
export function pick(cue: CueName, seed: number): { file: string; speed: number } {
  const c = CUE_SPECS[cue];
  const file = c.files[Math.floor(rand(seed, 1) * c.files.length)]!;
  const [lo, hi] = c.pitch;
  return { file, speed: lo + (hi - lo) * rand(seed, 2) };
}

class Mixer {
  private lib: PixiSound | null = null;
  private booting: Promise<PixiSound | null> | null = null;
  private loaded = new Map<string, Promise<import("@pixi/sound").Sound | null>>();
  private playing: Playing[] = [];
  private recent = new Map<string, number[]>();
  /** Bytes of sound asked for so far (the measurements read it). */
  bytes = 0;

  /** Fetches @pixi/sound and wakes it with the first tap's audio context. Never throws: no sound is fine. */
  boot(): Promise<PixiSound | null> {
    this.booting ??= (async () => {
      const w = window as unknown as { AudioContext?: unknown };
      const ctx = unlockedAudio();
      const own = w.AudioContext;
      try {
        // (The library makes its audio context as it loads: give it the one the first tap woke.)
        if (ctx) w.AudioContext = function () { return ctx; };
        const lib = await import("@pixi/sound");
        if (ctx) w.AudioContext = own;
        lib.sound.disableAutoPause = true;
        // Its master compressor squashes everything at its defaults: keep it as a gentle safety net only.
        const comp = (lib.sound.context as unknown as { compressor?: DynamicsCompressorNode }).compressor;
        if (comp) {
          comp.threshold.value = -8;
          comp.knee.value = 6;
          comp.ratio.value = 4;
          comp.attack.value = 0.003;
          comp.release.value = 0.2;
        }
        document.addEventListener("visibilitychange", () => (document.hidden ? lib.sound.pauseAll() : lib.sound.resumeAll()));
        this.lib = lib;
        return lib;
      } catch {
        if (ctx) w.AudioContext = own;
        return null;
      }
    })();
    return this.booting;
  }

  /** Loads files (sound effects first; music streams separately). */
  load(names: readonly string[]): Promise<void> {
    return Promise.all(
      names.map((name) => {
        let p = this.loaded.get(name);
        if (!p) {
          p = this.boot().then(
            (lib) =>
              lib &&
              new Promise((done) => {
                lib.Sound.from({
                  url: url(name),
                  preload: true,
                  loaded: (err, s) => done(err ? null : (s ?? null)),
                });
              }),
          );
          this.loaded.set(name, p);
          this.bytes += FILE_BYTES.get(name) ?? 0;
        }
        return p;
      }),
    ).then(() => {});
  }

  /** Every sound-effect file the cues use. */
  allEffects(): string[] {
    return [...new Set(Object.values(CUE_SPECS).flatMap((c) => (c.bus === "sfx" ? c.files : [])))];
  }

  /** Plays a cue now. `seed` picks the file and the pitch; `gain` scales its volume (troop counts). */
  play(cue: CueName, seed = 0, gain = 1): void {
    const levels = useSound.getState();
    const c = CUE_SPECS[cue];
    const bus = busGains(levels)[c.bus];
    if (bus <= 0 || !this.lib || (typeof document !== "undefined" && document.hidden)) return;
    const now = performance.now();
    const verdict = admit({ playing: this.playing, recent: this.recent }, cue, now, isPhone() ? MAX_AT_ONCE.phone : MAX_AT_ONCE.laptop);
    if (!verdict.play) return;
    const { file, speed } = pick(cue, seed);
    // (For the scripts: what played, and when.)
    (window as unknown as { __conquerraSoundLog?: { cue: string; at: number; file: string }[] }).__conquerraSoundLog?.push({ cue, at: Math.round(now), file });
    const loaded = this.loaded.get(file);
    if (!loaded) return void this.load([file]);
    // Its place is taken now, not once it starts: several sounds in one frame must all count against the cap.
    const out = verdict.replace !== null ? this.playing[verdict.replace] : undefined;
    if (out) this.drop(out);
    const entry: Playing = { cue, priority: c.priority, inst: null };
    this.playing.push(entry);
    void loaded.then((s) => {
      if (!s || !this.playing.includes(entry)) return this.drop(entry);
      const inst = s.play({ volume: Math.min(1, c.volume * gain * bus), speed }) as Instance;
      entry.inst = inst;
      inst.on("end", () => this.drop(entry));
      inst.on("stop", () => this.drop(entry));
      if (c.duck) this.duck(c.duck);
    });
    this.recent.set(cue, [...(this.recent.get(cue) ?? []).filter((t) => now - t < STACK_MS), now]);
  }

  private drop(p: Playing): void {
    this.playing = this.playing.filter((x) => x !== p);
    p.inst?.stop();
  }

  /** Plays one file as it is, at a volume (the sound bench: past the caps and the stacking rule). */
  playFile(name: string, volume: number): void {
    const bus = busGains(useSound.getState()).sfx;
    void this.loaded.get(name)?.then((s) => s?.play({ volume: Math.min(1, volume * bus) }));
  }

  /** Stops every sound effect (the music carries on). */
  stopEffects(): void {
    const all = this.playing;
    this.playing = [];
    for (const p of all) p.inst?.stop();
  }

  /** The music dips for `ms` (a capital falling, a House knocked out). */
  duck(ms: number): void {
    duck(ms);
  }
  /** How many sounds are playing (the bench shows it). */
  get busy(): number {
    return this.playing.length;
  }
  /** The audio context, once the library is up (music streams through it). */
  get context(): AudioContext | null {
    return (this.lib?.sound.context as unknown as { audioContext?: AudioContext } | undefined)?.audioContext ?? null;
  }
}

/** The one mixer. */
export const mixer = new Mixer();
// (For the scripts and the bench: how many sounds play, what was loaded.)
if (typeof window !== "undefined") (window as unknown as { __conquerraMixer?: Mixer }).__conquerraMixer = mixer;
