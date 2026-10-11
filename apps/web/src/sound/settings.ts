import { create } from "zustand";

/**
 * Settings → Sound (session 24): Master, Music and Sound effects volumes and Mute, remembered on this device. Separate
 * from Effects (the visual ones): Effects Off doesn't silence sound, and Mute doesn't change what you see. Ambience
 * sits under Music's volume. Default: on, moderate, music lower than effects.
 */
const KEY = "conquerra.sound";

export interface SoundLevels {
  master: number;
  music: number;
  effects: number;
  muted: boolean;
}
export const SOUND_DEFAULTS: SoundLevels = { master: 0.7, music: 0.45, effects: 0.8, muted: false };

const clamp = (x: unknown, d: number) => (typeof x === "number" && Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : d);
export function readLevels(raw: string | null): SoundLevels {
  try {
    const v = raw ? (JSON.parse(raw) as Partial<SoundLevels>) : {};
    return { master: clamp(v.master, SOUND_DEFAULTS.master), music: clamp(v.music, SOUND_DEFAULTS.music), effects: clamp(v.effects, SOUND_DEFAULTS.effects), muted: v.muted === true };
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
    set(change);
    const { master, music, effects, muted } = get();
    try {
      localStorage.setItem(KEY, JSON.stringify({ master, music, effects, muted }));
    } catch {
      // A private window: remembered for this visit only.
    }
  },
}));

/** How loud each bus plays (0 to 1): what the volumes and Mute add up to. */
export function busGains(l: SoundLevels): { sfx: number; music: number; ambience: number } {
  if (l.muted) return { sfx: 0, music: 0, ambience: 0 };
  return { sfx: l.master * l.effects, music: l.master * l.music, ambience: l.master * l.music * 0.8 };
}
