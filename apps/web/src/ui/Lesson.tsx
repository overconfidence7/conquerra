import { useGame } from "../store";
import { dueTurn, GOAL_TEXT, goalLine } from "../tutorials/goal";
import { closeLessonCard, foldGoal, hintFor, startLesson, useLesson } from "../tutorials/run";
import { Frame } from "./Frame";
import "./learn.css";

/**
 * A lesson on the game screen (session 31): the goal card (top left on a desktop, the sheet's first tab on a phone)
 * with the lesson's opening, the goal in one line, the turn it's due by and this turn's hint; and, once the goal is
 * met or missed and the replay is over, the Done or Missed card. Nothing here blocks the map: the card folds, and the
 * hint is also the quiet notice.
 */
export const LESSON_UI = {
  goal: "Goal",
  thisTurn: "This turn",
  fold: "Fold the goal card",
  open: "Open the goal card",
  done: "Lesson done",
  missed: "Not this time",
  missedLine: "The goal wasn't met in time. The same game is ready to try again.",
  next: "Next lesson",
  lobby: "Back to the lobby",
  again: "Try again",
  back: "Back",
  leave: "Leave this lesson",
  leaveNote: "Continue still has your own game",
} as const;

/** The goal card's insides (the desktop card, and the phone's Goal tab). */
export function GoalBody() {
  const run = useLesson((s) => s.run);
  const turn = useGame((s) => s.view?.turn ?? 0);
  if (!run) return null;
  const hint = run.state.kind === "open" ? hintFor(run, turn) : null;
  return (
    <div className="goal-body">
      <p className="small">{run.def.words.opening}</p>
      <p className="goal-line">
        <b>{run.def.words.goal}</b>
      </p>
      <p className="small muted">
        {GOAL_TEXT.by(dueTurn(run.def, run.startTurn))}. {goalLine(run.def, run.state).replace(/([^.])$/, "$1.")}
      </p>
      {hint && (
        <p className="small goal-hint">
          <b>{LESSON_UI.thisTurn}:</b> {hint}
        </p>
      )}
    </div>
  );
}

/** Desktop: the goal card, top left, folded to one line with a tap. */
export function GoalCard() {
  const run = useLesson((s) => s.run);
  if (!run) return null;
  return (
    <Frame className={`slim goal-card ${run.folded ? "folded" : ""}`} role="complementary" label={LESSON_UI.goal}>
      <button className="goal-head" onClick={() => foldGoal(!run.folded)} aria-expanded={!run.folded} aria-label={run.folded ? LESSON_UI.open : LESSON_UI.fold}>
        <span aria-hidden>{run.folded ? "▸" : "▾"}</span> <b>{run.def.words.name}</b>
        {run.folded && <span className="small muted"> {run.def.words.goal}</span>}
      </button>
      {!run.folded && <GoalBody />}
    </Frame>
  );
}

/** Done or Missed, once the turn's replay is over. */
export function LessonEnd() {
  const run = useLesson((s) => s.run);
  const replaying = useGame((s) => !!s.replay);
  // (After the turn report: its first line says the goal's state, then this card.)
  const reporting = useGame((s) => s.showReport);
  const busy = useGame((s) => s.busy);
  if (!run || run.closed || replaying || reporting || run.state.kind === "open") return null;
  const done = run.state.kind === "done";
  const lobby = () => (closeLessonCard(), useGame.getState().playAgain());
  return (
    <div className="overlay lesson-end-wrap">
      <Frame className="dialog lesson-end" role="dialog" label={done ? LESSON_UI.done : LESSON_UI.missed} title={done ? LESSON_UI.done : LESSON_UI.missed}>
        <p className="small muted">{run.def.words.name}</p>
        <p>{done ? run.def.words.closing : LESSON_UI.missedLine}</p>
        <div className="dialog-actions">
          {done ? (
            <>
              <button className={run.next ? "" : "primary"} autoFocus={!run.next} onClick={lobby}>
                {LESSON_UI.lobby}
              </button>
              {run.next && (
                <button className="primary" disabled={busy} autoFocus onClick={() => void startLesson(run.next!, null).then(() => attachNext(run.next!.id))}>
                  {LESSON_UI.next}
                </button>
              )}
            </>
          ) : (
            <>
              <button onClick={lobby}>{LESSON_UI.back}</button>
              <button className="primary" disabled={busy} autoFocus onClick={() => void startLesson(run.def, run.next)}>
                {LESSON_UI.again}
              </button>
            </>
          )}
        </div>
      </Frame>
    </div>
  );
}

/** The next lesson's own "next" comes from the lessons list, loaded only now (it isn't needed before). */
function attachNext(id: string) {
  void import("@conquerra/content/tutorials").then(({ nextTutorial }) => {
    const run = useLesson.getState().run;
    if (run?.def.id === id) useLesson.setState({ run: { ...run, next: nextTutorial(id) } });
  });
}

/** The turn report's first line in a lesson. */
export function LessonReportLine() {
  const run = useLesson((s) => s.run);
  if (!run) return null;
  return <p className={`tcard-intel lesson-report ${run.state.kind}`}>{goalLine(run.def, run.state)}</p>;
}
