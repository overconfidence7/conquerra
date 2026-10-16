import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { beginGuideIfArmed, GUIDE_TEXT, guideSaw, skipGuide, useGuide } from "../src/tutorials/guide";
import { armGuide, guideSeen, markLearned, shouldGuide, takeArmedGuide } from "../src/tutorials/learned";

/**
 * Session 31, Part 3: the guided first game. A new player's first single-player game (no saved games here, no lesson
 * done, never shown) gets three prompts on turn 1 in order (your capital, Recruit, Lock in), each waiting for its
 * tap; "Skip the guide" ends it; turn 1's report has one line; and the device never shows it again.
 */
const here = dirname(fileURLToPath(import.meta.url));
const src = (p: string) => readFileSync(join(here, "../src", p), "utf8");

describe("the guided first game (session 31)", () => {
  const box = new Map<string, string>();
  beforeAll(() => vi.stubGlobal("localStorage", { getItem: (k: string) => box.get(k) ?? null, setItem: (k: string, v: string) => void box.set(k, v), removeItem: (k: string) => void box.delete(k) }));
  afterAll(() => vi.unstubAllGlobals());
  beforeEach(() => {
    box.clear();
    takeArmedGuide();
    useGuide.setState({ step: null, turn: 0 });
  });

  it("only for a new player: no saved games, no lesson done, never shown before", () => {
    expect(shouldGuide(0)).toBe(true);
    expect(shouldGuide(1)).toBe(false);
    markLearned("take-the-field");
    expect(shouldGuide(0)).toBe(false);
    box.clear();
    expect(guideSeen()).toBe(false);
  });

  it("armed by Start, it begins once and the device remembers: never shown again", () => {
    expect(beginGuideIfArmed(1)).toBe(false);
    armGuide();
    expect(beginGuideIfArmed(1)).toBe(true);
    expect(useGuide.getState().step).toBe("capital");
    expect(guideSeen()).toBe(true);
    expect(shouldGuide(0)).toBe(false);
    // The next game isn't guided.
    expect(beginGuideIfArmed(1)).toBe(false);
  });

  it("the three prompts in order, each waiting for the tap it asks for (anything else doesn't move it)", () => {
    armGuide();
    beginGuideIfArmed(1);
    guideSaw({ selected: "t05", capital: "t23" });
    expect(useGuide.getState().step).toBe("capital");
    guideSaw({ recruited: true });
    expect(useGuide.getState().step).toBe("capital");
    guideSaw({ selected: "t23", capital: "t23" });
    expect(useGuide.getState().step).toBe("recruit");
    guideSaw({ recruited: true });
    expect(useGuide.getState().step).toBe("lock");
    guideSaw({ lockedIn: true });
    expect(useGuide.getState().step).toBe("report");
    guideSaw({ reportClosed: true });
    expect(useGuide.getState().step).toBeNull();
  });

  it("Skip the guide ends it with one tap; locking in early goes straight to the report's line", () => {
    armGuide();
    beginGuideIfArmed(1);
    skipGuide();
    expect(useGuide.getState().step).toBeNull();
    useGuide.setState({ step: "recruit", turn: 1 });
    guideSaw({ lockedIn: true });
    expect(useGuide.getState().step).toBe("report");
  });

  it("the words, as written, and where they show", () => {
    expect(GUIDE_TEXT.capital).toBe("This is your capital. Tap it.");
    expect(GUIDE_TEXT.recruit).toBe("Recruit here: 2 gold a troop.");
    expect(GUIDE_TEXT.lock).toBe("Lock in when you're ready. Everyone's orders happen at once.");
    expect(GUIDE_TEXT.report).toBe("Your first turn's report: what you saw, what happened, and what your leaders say.");
    expect(GUIDE_TEXT.skip).toBe("Skip the guide");
    expect(src("ui/GameScreen.tsx")).toContain("<Guide />");
    expect(src("ui/TurnReport.tsx")).toContain("<GuideReportLine />");
    expect(src("ui/Lobby.tsx")).toContain("shouldGuide(slots.length) && armGuide()");
    expect(src("ui/Learn.tsx")).toContain("The guided first game");
    // Single player only, never in a lesson; the cards never take taps meant for the game but their own Skip.
    const guide = src("ui/Guide.tsx");
    expect(guide).toMatch(/if \(!view \|\| online \|\| lesson\) return;/);
    expect(src("ui/learn.css")).toMatch(/\.guide-card \{[^}]*pointer-events: none/);
  });
});
