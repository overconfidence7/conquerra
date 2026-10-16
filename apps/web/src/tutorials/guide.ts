import { create } from "zustand";
import { markGuideSeen, takeArmedGuide } from "./learned";

/**
 * The guided first game's state (session 31): which prompt is showing on turn 1 (your capital, Recruit, Lock in), then
 * the one line in turn 1's report, then nothing. Loaded with the game screen.
 */
export type GuideStep = "capital" | "recruit" | "lock" | "report";
export const useGuide = create<{ step: GuideStep | null; turn: number }>(() => ({ step: null, turn: 0 }));

export const GUIDE_TEXT = {
  capital: "This is your capital. Tap it.",
  recruit: "Recruit here: 2 gold a troop.",
  lock: "Lock in when you're ready. Everyone's orders happen at once.",
  report: "Your first turn's report: what you saw, what happened, and what your leaders say.",
  skip: "Skip the guide",
} as const;

/** A game just started: if the guide was armed for it, it begins (and the device remembers it was shown). */
export function beginGuideIfArmed(turn: number): boolean {
  if (!takeArmedGuide()) return false;
  markGuideSeen();
  useGuide.setState({ step: "capital", turn });
  return true;
}

export const skipGuide = () => useGuide.setState({ step: null });

/** What you did moves the guide on: the tap it asked for (nothing else is blocked, and nothing else moves it). */
export function guideSaw(e: { selected?: string | null; capital?: string; recruited?: boolean; lockedIn?: boolean; reportClosed?: boolean }) {
  const { step } = useGuide.getState();
  if (step === "capital" && e.selected && e.selected === e.capital) useGuide.setState({ step: "recruit" });
  else if (step === "recruit" && e.recruited) useGuide.setState({ step: "lock" });
  // (Locking in before the last prompt ends the prompts too: the report's line still comes.)
  if ((step === "capital" || step === "recruit" || step === "lock") && e.lockedIn) useGuide.setState({ step: "report" });
  else if (step === "report" && e.reportClosed) useGuide.setState({ step: null });
}
