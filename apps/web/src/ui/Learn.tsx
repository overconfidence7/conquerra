import { nextTutorial, TUTORIALS, type TutorialDef } from "@conquerra/content/tutorials";
import { useState } from "react";
import { armGuide, guideSeen, learned } from "../tutorials/learned";
import { startLesson } from "../tutorials/run";
import { useGame } from "../store";
import "./learn.css";

/**
 * The lobby's Learn block, inside (session 31): the lessons in order, each a line (its name, one sentence, about how
 * long, a tick once done on this device). Tapping one starts it, as Continue starts a save. Loaded only when Learn is
 * open, with the lessons' data.
 */
export const LEARN_UI = {
  minutes: (n: number) => `about ${n} minutes`,
  done: "Done",
  starting: "Starting…",
  guided: "The guided first game",
  guidedLine: "A game against the bots, with three pointers on turn 1.",
} as const;

/** Learn's last line (session 31): the guided first game, on purpose (it starts the lobby's game with the guide). */
function GuidedGame() {
  const busy = useGame((s) => s.busy);
  const seen = guideSeen();
  return (
    <button
      className={`lesson ${seen ? "done" : ""}`}
      disabled={busy}
      onClick={() => {
        armGuide();
        void useGame.getState().start();
      }}
    >
      <span className="lesson-tick" aria-label={seen ? LEARN_UI.done : undefined}>
        {seen ? "✓" : "★"}
      </span>
      <span className="lesson-words">
        <b>{LEARN_UI.guided}</b>
        <span className="small muted block">{LEARN_UI.guidedLine}</span>
      </span>
    </button>
  );
}

export function LessonList({ list }: { list: readonly TutorialDef[] }) {
  const busy = useGame((s) => s.busy);
  const [starting, setStarting] = useState<string | null>(null);
  const done = new Set(learned());
  return (
    <ol className="lessons">
      {list.map((t) => (
        <li key={t.id}>
          <button
            className={`lesson ${done.has(t.id) ? "done" : ""}`}
            disabled={busy}
            onClick={() => {
              setStarting(t.id);
              void startLesson(t, nextTutorial(t.id)).finally(() => setStarting(null));
            }}
          >
            <span className="lesson-tick" aria-label={done.has(t.id) ? LEARN_UI.done : undefined}>
              {done.has(t.id) ? "✓" : t.order}
            </span>
            <span className="lesson-words">
              <b>{t.words.name}</b>
              <span className="small muted block">
                {t.words.blurb} {starting === t.id ? LEARN_UI.starting : `(${LEARN_UI.minutes(t.minutes)})`}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

export default function LearnBlock() {
  return (
    <>
      <LessonList list={TUTORIALS.filter((t) => t.kind === "tutorial")} />
      <GuidedGame />
    </>
  );
}
