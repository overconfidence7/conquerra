import { useEffect, useLayoutEffect, useState } from "react";
import { useGame } from "../store";
import { beginGuideIfArmed, GUIDE_TEXT, guideSaw, skipGuide, useGuide } from "../tutorials/guide";
import { useLesson } from "../tutorials/run";
import { Frame } from "./Frame";
import "./learn.css";

/**
 * The guided first game (session 31): three small cards on turn 1, each pointing at the thing it asks you to tap
 * (your capital, which the map shows and pulses; Recruit; Lock in). Each waits for its tap and nothing else is
 * blocked: the cards never cover the map's middle or the buttons they point at. "Skip the guide" ends it with one tap.
 * After turn 1 the report has one line about itself, and the guide is over.
 */

/** Where a card goes: above the thing it points at (the capital's card sits at the top of the map). */
const TARGET: Record<"recruit" | "lock", string> = { recruit: '.actions button[aria-label^="Recruit"]', lock: "button.seal" };

function useAnchor(selector: string | null): { left: number; bottom: number } | null {
  const [at, setAt] = useState<{ left: number; bottom: number } | null>(null);
  useLayoutEffect(() => {
    if (!selector) return void setAt(null);
    const place = () => {
      const el = document.querySelector<HTMLElement>(selector);
      if (!el) return setAt(null);
      const r = el.getBoundingClientRect();
      setAt({ left: Math.max(8, Math.min(window.innerWidth - 268, r.left + r.width / 2 - 130)), bottom: window.innerHeight - r.top + 10 });
    };
    place();
    const id = setInterval(place, 500);
    window.addEventListener("resize", place);
    return () => (clearInterval(id), window.removeEventListener("resize", place));
  }, [selector]);
  return at;
}

export function Guide() {
  const step = useGuide((s) => s.step);
  const view = useGame((s) => s.view);
  const selected = useGame((s) => s.selected);
  const queue = useGame((s) => s.queue);
  const replay = useGame((s) => !!s.replay);
  const showReport = useGame((s) => s.showReport);
  const online = useGame((s) => !!s.online);
  const lesson = useLesson((s) => !!s.run);
  // A game that starts with the guide armed (single player only, never a lesson) begins it, with nothing selected.
  useEffect(() => {
    if (!view || online || lesson) return;
    if (beginGuideIfArmed(view.turn)) {
      useGame.getState().clearSelection();
      useGame.getState().showPlace(view.me.capital);
    }
  }, [view?.gameId]); // eslint-disable-line react-hooks/exhaustive-deps
  const startTurn = useGuide((s) => s.turn);
  useEffect(() => {
    if (!step || !view) return;
    guideSaw({ selected, capital: view.me.capital, recruited: queue.some((o) => o.kind === "recruit"), lockedIn: view.turn > startTurn || replay });
  }, [step, selected, queue, view, replay, startTurn]);
  // The report's line shows with turn 1's report; closing it ends the guide.
  const [reportSeen, setReportSeen] = useState(false);
  useEffect(() => {
    if (step !== "report") return;
    if (showReport) setReportSeen(true);
    else if (reportSeen && !replay) guideSaw({ reportClosed: true });
  }, [step, showReport, replay, reportSeen]);
  const anchor = useAnchor(step === "recruit" || step === "lock" ? TARGET[step] : null);
  if (!step || step === "report" || replay || !view) return null;
  const style = step === "capital" || !anchor ? { left: "50%", top: 72, transform: "translateX(-50%)" } : { left: anchor.left, bottom: anchor.bottom };
  return (
    <Frame className={`slim guide-card guide-${step}`} style={style} role="status">
      <p>{GUIDE_TEXT[step]}</p>
      <button className="link small" onClick={skipGuide}>
        {GUIDE_TEXT.skip}
      </button>
      {step !== "capital" && <i className="guide-arrow" aria-hidden />}
    </Frame>
  );
}

/** Turn 1's report, in a guided game: one line about the report itself. */
export function GuideReportLine() {
  const step = useGuide((s) => s.step);
  return step === "report" ? <p className="tcard-intel guide-report">{GUIDE_TEXT.report}</p> : null;
}
