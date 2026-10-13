import { create } from "zustand";
import { clearDuck } from "./duck";

/**
 * Settings → Sound (session 24): Master, Music and Sound effects volumes and Mute, remembered on this device. Separate
 * from Effects (the visual ones): Effects Off doesn't silence sound, and Mute doesn't change what you see. Ambience
 * sits under Music's volume. Default: on, moderate, music lower than effects.
 *
 * Session 25b (Nate: the music at about a fifth, and lower must never cut out): the music files are 8 dB quieter, and
 * the Music slider runs on an even curve (MUSIC_RANGE_DB from top to bottom, silent only at 0): 50%, the default, is
 * the music at about a fifth of session 24's, and every step down is a little quieter, never gone. Levels saved before
 * this (no `v: 3`) keep Master, Sound effects and Mute, and start Music again at the default once.
 */
const KEY = "conquerra.sound";

export interface SoundLevels {
  master: number;
  music: number;
  effects: number;
  muted: boolean;
}
export const SOUND_DEFAULTS: SoundLevels = { master: 0.7, music: 0.5, effects: 0.8, muted: false };
/** The saved levels' version: 3 since the Music slider's even curve (25b). */
const VERSION = 3;

const clamp = (x: unknown, d: number) => (typeof x === "number" && Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : d);
export function readLevels(raw: string | null): SoundLevels {
  try {
    const v = raw ? (JSON.parse(raw) as Partial<SoundLevels> & { v?: number }) : {};
    const music = v.v === VERSION ? clamp(v.music, SOUND_DEFAULTS.music) : SOUND_DEFAULTS.music;
    return { master: clamp(v.master, SOUND_DEFAULTS.master), music, effects: clamp(v.effects, SOUND_DEFAULTS.effects), muted: v.muted === true };
  } catch {
    return { ...SOUND_DEFAULTS };
  }
}
const load = () => {
  try {
    return readLevels(localStorage.getItem(KEY));
  } catch {
    return { ...SOUND_DEFAULTS };
  }
};

interface SoundSettings extends SoundLevels {
  set(change: Partial<SoundLevels>): void;
}

export const useSound = create<SoundSettings>((set, get) => ({
  ...load(),
  set(change) {
    // A volume you set is the level you hear (session 25b): it ends any dip under a big moment at once.
    if (change.master !== undefined || change.music !== undefined || change.muted !== undefined) clearDuck();
    set(change);
    const { master, music, effects, muted } = get();
    try {
      localStorage.setItem(KEY, JSON.stringify({ v: VERSION, master, music, effects, muted }));
    } catch {
      // A private window: remembered for this visit only.
    }
  },
}));

/** The Music slider's span: the top is this many dB over the bottom step (the default, 50%, is half of it down). */
export const MUSIC_RANGE_DB = 24;
/** The Music slider (0 to 1) as a gain: even steps in loudness, silent only at 0. */
export function musicCurve(s: number): number {
  return s <= 0 ? 0 : 10 ** ((-MUSIC_RANGE_DB * (1 - Math.min(1, s))) / 20);
}
/** How loud each bus plays (0 to 1): what the volumes and Mute add up to. */
export function busGains(l: SoundLevels): { sfx: number; music: number; ambience: number } {
  if (l.muted) return { sfx: 0, music: 0, ambience: 0 };
  const music = l.master * musicCurve(l.music);
  return { sfx: l.master * l.effects, music, ambience: music * 0.8 };
}
