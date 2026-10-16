import type { TutorialDef } from "@conquerra/content/tutorials";
import { create } from "zustand";
import type { GameHost } from "../host/protocol";
import { enterGame, showNotice, useGame } from "../store";
import { goalState, SCENARIO_FILE_PROBLEM, type GoalState } from "./goal";
import { markLearned } from "./learned";


/**
 * A lesson being played (session 31): which tutorial, the turn it began on, where its goal stands, and the hint shown
 * this turn. Loaded with Learn and the game screen, never with the lobby's first paint. The game itself is an ordinary
 * single-player game on the host (which keeps it out of the autosave); this only watches your view.
 */
export interface LessonRun {
  def: TutorialDef;
  /** The next lesson, for the Done card (null after the last). */
  next: TutorialDef | null;
  startTurn: number;
  state: GoalState;
  /** The last turn whose hint was shown. */
  hinted: number;
  /** The goal card folded (desktop). */
  folded: boolean;
  /** The Done or Missed card was closed (it doesn't come back). */
  closed: boolean;
  /** The game's host and id: a different one means another game started (or a save loaded), and the lesson is over. */
  host: GameHost;
  gameId: string;
}

export const useLesson = create<{ run: LessonRun | null }>(() => ({ run: null }));

/** Start a lesson (or start it again): its saved game is made from its recipe by the host. */
export async function startLesson(def: TutorialDef, next: TutorialDef | null, inline = false): Promise<boolean> {
  const { lobby } = useGame.getState();
  useLesson.setState({ run: null });
  const ok = await enterGame((host) => host.load({ tutorial: def.id, ...(inline ? { def } : {}), ...(lobby.house !== undefined ? { house: lobby.house } : {}), ...(lobby.leaderName ? { leaderName: lobby.leaderName } : {}) }));
  const { view, ctx, host } = useGame.getState();
  if (!ok || !view || !ctx || !host) return false;
  useLesson.setState({ run: { def, next, startTurn: view.turn, state: goalState(def, ctx.map, view, view.turn), hinted: 0, folded: false, closed: false, host, gameId: view.gameId } });
  watch();
  return true;
}

/**
 * Part 4: a scenario (or tutorial) from a file, as "Load a file" reads it: the same format as the game's own, or null
 * if the text isn't one (then it's read as a saved game). A file that looks like one but doesn't check says why.
 */
export async function lessonFromFile(text: string): Promise<TutorialDef | null> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object" || !("recipe" in raw) || !("goal" in raw)) return null;
  const { TutorialDef } = await import("@conquerra/content/tutorials");
  const parsed = TutorialDef.safeParse(raw);
  if (!parsed.success) throw new Error(SCENARIO_FILE_PROBLEM);
  return parsed.data;
}

export const foldGoal = (folded: boolean) => useLesson.setState((s) => (s.run ? { run: { ...s.run, folded } } : s));
export const closeLessonCard = () => useLesson.setState((s) => (s.run ? { run: { ...s.run, closed: true } } : s));

/** The hint for this turn of the lesson (one a turn, from the file), or null. */
export const hintFor = (run: Pick<LessonRun, "def" | "startTurn">, turn: number): string | null => run.def.words.hints[turn - run.startTurn] ?? null;

let watching = false;
/**
 * Follow the game: after each turn the goal is checked from your new view (done is remembered on the device), and as
 * each turn's planning starts its hint shows as the quiet notice. Another game (another host) ends the lesson.
 */
function watch() {
  if (watching) return;
  watching = true;
  const check = () => {
    const run = useLesson.getState().run;
    if (!run) return;
    const g = useGame.getState();
    if (g.host !== run.host || !g.view || !g.ctx || g.view.gameId !== run.gameId) return useLesson.setState({ run: null });
    let next = run;
    if (run.state.kind === "open") {
      const state = goalState(run.def, g.ctx.map, g.view, run.startTurn);
      if (state.kind !== run.state.kind || (state.kind === "open" && run.state.kind === "open" && state.turnsLeft !== run.state.turnsLeft)) next = { ...next, state };
      if (state.kind === "done") markLearned(run.def.id, run.def.kind);
    }
    // A turn's hint, once its planning starts (after the replay), while the goal is still open.
    if (!g.replay && next.state.kind === "open" && next.hinted < g.view.turn) {
      next = { ...next, hinted: g.view.turn };
      const hint = hintFor(next, g.view.turn);
      if (hint) showNotice(hint, true);
    }
    if (next !== run) useLesson.setState({ run: next });
  };
  useGame.subscribe(check);
  check();
}
