import { create } from "zustand";
import type { FxLevel } from "./particles";

/**
 * Settings → Effects: Full / Light / Off (session 21), remembered on this device. A device that asks for less motion
 * starts on Light. A replay that runs slowly on Full (under about 50 frames a second) moves to Light by itself, and
 * says so once.
 */
const KEY = "conquerra.effects";
/** Set once the replay moved to Light by itself (so it says so only once). */
const AUTO_KEY = "conquerra.effects.auto";
/** For the frame-rate script: measure the level asked for, without the move to Light. */
const NO_AUTO_KEY = "conquerra.effects.noAuto";

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    // A private window: it's remembered for this visit only.
  }
};

export const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

function startLevel(): FxLevel {
  const v = read(KEY);
  if (v === "full" || v === "light" || v === "off") return v;
  return reducedMotion() ? "light" : "full";
}

interface FxSettings {
  level: FxLevel;
  /** The replay moved itself to Light this visit (the notice says so). */
  movedToLight: boolean;
  setLevel(level: FxLevel): void;
  /** The replay is too slow on Full: move to Light (once). Returns true if it moved. */
  tooSlow(): boolean;
}

export const useFx = create<FxSettings>((set, get) => ({
  level: startLevel(),
  movedToLight: false,
  setLevel(level) {
    write(KEY, level);
    set({ level });
  },
  tooSlow() {
    if (get().level !== "full" || read(NO_AUTO_KEY)) return false;
    write(KEY, "light");
    const first = !read(AUTO_KEY);
    write(AUTO_KEY, "1");
    set({ level: "light", movedToLight: first });
    return true;
  },
}));

export const FX_LEVELS: [FxLevel, string][] = [
  ["full", "Full"],
  ["light", "Light"],
  ["off", "Off"],
];
