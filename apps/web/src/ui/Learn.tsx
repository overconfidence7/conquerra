import { nextTutorial, TUTORIALS, type TutorialDef } from "@conquerra/content/tutorials";
import { useState } from "react";
import { learned } from "../tutorials/learned";
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
} as const;

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
  return <LessonList list={TUTORIALS.filter((t) => t.kind === "tutorial")} />;
}
