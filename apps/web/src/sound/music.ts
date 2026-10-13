import { setGain } from "./duck";
import { busGains, useSound, type SoundLevels } from "./settings";
import { audioPool, unlockedAudio } from "./unlock";

/**
 * The music (session 24; one loop since 25b): the game's loop from the lobby (after the first tap) through planning
 * and the replay alike, never switching or dipping (Nate: it kept fading in and out), then the victory or defeat sting. Each track streams from an audio element
 * (nothing is decoded whole, so an 80 s loop doesn't sit in memory), its volume set through the audio context the
 * first tap woke (a phone ignores an element's own volume). Changing track crossfades (about 1 s); a track you come
 * back to carries on where it was, so the music never starts over each turn. It dips under the big moments (duck.ts)
 * and stops while the tab is hidden. No sound effects library here: the lobby loads only this.
 */

export type MusicCue = "game" | "victory" | "defeat";
/** How loud each track is, before the volumes in Settings (the cue list's music volumes, kept here so the lobby doesn't load it). */
export const MUSIC_VOLUME: Record<MusicCue, number> = { game: 0.8, victory: 0.9, defeat: 0.9 };
const LOOPS = new Set<MusicCue>(["game"]);
export const CROSSFADE_MS = 1000;
const TICK_MS = 50;

interface Track {
  cue: MusicCue;
  el: HTMLAudioElement;
  gain: GainNode | null;
  /** Where its fade is now and where it's going (0 to 1), and how fast (per ms). */
  level: number;
  target: number;
  rate: number;
}

/**
 * A track's gain (0 to 1): its fade, its own volume and Settings. A slider move changes only `levels`, so the gain
 * follows it straight away and in the same direction. The music never dips under a big moment (session 25b, Nate: it
 * kept fading in and out).
 */
export function trackGain(fade: number, cue: MusicCue, levels: SoundLevels): number {
  return Math.max(0, Math.min(1, fade * MUSIC_VOLUME[cue] * busGains(levels).music));
}

/** One step of a fade: from `level` toward `target`, `ms` later, at `rate` per ms. */
export function fadeStep(level: number, target: number, rate: number, ms: number): number {
  return level < target ? Math.min(target, level + rate * ms) : Math.max(target, level - rate * ms);
}

class Music {
  private tracks = new Map<MusicCue, Track>();
  private current: MusicCue | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private last = 0;
  private hooked = false;

  /** Each track's state, for the scripts: where it is (s), its fade level, and whether it's playing. */
  state(): Record<string, { at: number; level: number; playing: boolean }> {
    return Object.fromEntries([...this.tracks.values()].map((t) => [t.cue, { at: Math.round(t.el.currentTime * 10) / 10, level: Math.round(t.level * 100) / 100, playing: !t.el.paused }]));
  }

  /** What's playing (or fading in). */
  get playing(): MusicCue | null {
    return this.current;
  }

  /** Plays a track, crossfading from the one before. The same track again does nothing: it carries on. */
  play(cue: MusicCue, fadeMs = CROSSFADE_MS): void {
    if (this.current === cue) return;
    const ctx = unlockedAudio();
    if (!ctx && !this.tracks.size && typeof document !== "undefined" && !navigator.userActivation?.hasBeenActive) return;
    this.hook();
    for (const t of this.tracks.values()) if (t.cue !== cue) this.fade(t, 0, fadeMs);
    this.current = cue;
    // (Muted, or Music at 0: nothing is fetched or played until it's turned up; then this track starts.)
    if (busGains(useSound.getState()).music > 0) this.start(cue, fadeMs);
    this.run();
  }

  private start(cue: MusicCue, fadeMs: number) {
    const t = this.track(cue);
    // A sting plays from the start; a loop carries on where it was.
    if (!LOOPS.has(cue) && t.target <= 0) t.el.currentTime = 0;
    this.fade(t, 1, fadeMs);
    if (!document.hidden) void t.el.play().catch(() => {});
  }

  /** Fades the music out. */
  stop(fadeMs = CROSSFADE_MS): void {
    for (const t of this.tracks.values()) this.fade(t, 0, fadeMs);
    this.current = null;
    this.run();
  }

  private track(cue: MusicCue): Track {
    let t = this.tracks.get(cue);
    if (t) return t;
    const el = audioPool.pop() ?? new Audio();
    el.preload = "auto";
    el.loop = LOOPS.has(cue);
    el.src = `${import.meta.env.BASE_URL}sound/music-${cue}.mp3`;
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
    t = { cue, el, gain, level: 0, target: 0, rate: 1 };
    this.tracks.set(cue, t);
    return t;
  }

  private fade(t: Track, target: number, ms: number) {
    t.target = target;
    t.rate = Math.abs(target - t.level) / Math.max(1, ms) || 1;
  }

  /** The fades and the volume, every 50 ms while anything plays. */
  private run() {
    if (this.timer) return;
    this.last = performance.now();
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  private tick() {
    const now = performance.now();
    const ms = now - this.last;
    this.last = now;
    const levels = useSound.getState();
    let any = false;
    for (const t of this.tracks.values()) {
      t.level = fadeStep(t.level, t.target, t.rate, ms);
      const v = trackGain(t.level, t.cue, levels);
      if (t.gain) setGain(t.gain, v);
      else t.el.volume = v;
      if (t.level <= 0 && t.target <= 0 && !t.el.paused) t.el.pause();
      if (t.level > 0 || t.target > 0) any = true;
    }
    if (!any && this.timer) (clearInterval(this.timer), (this.timer = null));
  }

  /** Nothing plays while the tab is hidden; turning Music up from 0 (or unmuting) starts the track that should be playing. */
  private hook() {
    if (this.hooked || typeof document === "undefined") return;
    this.hooked = true;
    useSound.subscribe((l) => {
      const on = busGains(l).music > 0;
      // The new level at once, not at the next tick.
      for (const t of this.tracks.values()) {
        const v = trackGain(t.level, t.cue, l);
        if (t.gain) setGain(t.gain, v);
        else t.el.volume = v;
      }
      if (on && this.current && !(this.tracks.get(this.current)?.target ?? 0)) this.start(this.current, CROSSFADE_MS);
      for (const t of this.tracks.values()) {
        if (!on) t.el.pause();
        else if (t.target > 0 && t.el.paused && !document.hidden) void t.el.play().catch(() => {});
      }
      if (on) this.run();
    });
    document.addEventListener("visibilitychange", () => {
      for (const t of this.tracks.values()) {
        if (document.hidden) t.el.pause();
        else if (t.target > 0) void t.el.play().catch(() => {});
      }
    });
  }
}

/** The one music player. */
export const music = new Music();
// (For the scripts: which track plays, and where each one is.)
if (typeof window !== "undefined") (window as unknown as { __conquerraMusic?: Music }).__conquerraMusic = music;
