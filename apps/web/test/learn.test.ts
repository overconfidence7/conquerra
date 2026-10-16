import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { TUTORIALS } from "@conquerra/content/tutorials";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { memorySaveStore } from "../src/host/saves";
import { setHostFactory, useGame } from "../src/store";
import { LESSON_COUNT, learned, learnSummary, markLearned } from "../src/tutorials/learned";
import { hintFor, startLesson, useLesson } from "../src/tutorials/run";
import { inProcessHost } from "./inProcessHost";
import { ordersOf } from "../src/tutorials/build";

/**
 * Session 31, Part 1: the lobby's Learn fold, a lesson started from it (its goal checked from your view, one hint a
 * turn, done remembered on the device), and a lesson never touching your own game's autosave.
 */
const here = dirname(fileURLToPath(import.meta.url));
const src = (p: string) => readFileSync(join(here, "../src", p), "utf8");

describe("Learn (session 31)", () => {
  const box = new Map<string, string>();
  beforeAll(() => vi.stubGlobal("localStorage", { getItem: (k: string) => box.get(k) ?? null, setItem: (k: string, v: string) => void box.set(k, v), removeItem: (k: string) => void box.delete(k) }));
  afterAll(() => vi.unstubAllGlobals());
  beforeEach(() => box.clear());

  it("the fold's line counts the lessons without loading them; done is remembered on the device", () => {
    expect(LESSON_COUNT).toBe(TUTORIALS.filter((t) => t.kind === "tutorial").length);
    expect(learnSummary(0)).toBe(`${LESSON_COUNT} short lessons, about 5 minutes each`);
    expect(learned()).toEqual([]);
    markLearned("take-the-field");
    markLearned("take-the-field");
    expect(learned()).toEqual(["take-the-field"]);
    expect(learnSummary(1)).toBe(`1 of ${LESSON_COUNT} lessons done`);
    expect(learnSummary(LESSON_COUNT)).toBe(`all ${LESSON_COUNT} lessons done`);
  });

  it("the lobby: Learn is a fold under Start, open on a first visit, its insides loaded only when it's open", () => {
    const lobby = src("ui/Lobby.tsx");
    expect(lobby).toContain('<Fold name="learn" title="Learn"');
    expect(lobby.indexOf('name="learn"')).toBeGreaterThan(lobby.indexOf('className="start-bar"'));
    expect(lobby).toContain('lazy(() => import("./Learn"))');
    expect(lobby).toMatch(/name === "learn" \? isFirstVisit\(\)/);
    // The lessons' data never loads with the lobby's first paint.
    expect(lobby).not.toContain("@conquerra/content/tutorials");
    expect(src("tutorials/learned.ts")).not.toContain("@conquerra/content/tutorials");
  });

  it("a lesson from Learn: its goal, a hint a turn, Done remembered, and your own autosave untouched", async () => {
    const store = memorySaveStore();
    setHostFactory(() => inProcessHost("unused", store));
    // Your own game first: it's what Continue picks up.
    await useGame.getState().start();
    const host = useGame.getState().host as ReturnType<typeof inProcessHost>;
    await host.core.flush();
    const yours = JSON.stringify(await store.get("auto"));
    expect(yours).not.toBe("null");
    const def = TUTORIALS[0]!;
    expect(await startLesson(def, TUTORIALS[1]!)).toBe(true);
    const run = useLesson.getState().run!;
    expect(run.def.id).toBe(def.id);
    expect(run.state).toEqual({ kind: "open", turnsLeft: def.goal.turns });
    expect(useGame.getState().view!.turn).toBe(run.startTurn);
    expect(useGame.getState().clock).toBeNull();
    // This turn's hint is the quiet notice.
    expect(useGame.getState().notice).toBe(hintFor(run, run.startTurn));
    // Play the solution.
    for (const [i, turn] of def.solution.entries()) {
      useGame.setState({ queue: ordersOf(turn, i + 1) });
      await useGame.getState().lockIn();
      useGame.getState().endReplay();
    }
    expect(useLesson.getState().run!.state).toEqual({ kind: "done" });
    expect(learned()).toContain(def.id);
    const lessonHost = useGame.getState().host as ReturnType<typeof inProcessHost>;
    lessonHost.core.saveQueued();
    await lessonHost.core.flush();
    expect(JSON.stringify(await store.get("auto"))).toBe(yours);
    // Back to the lobby: the lesson is over.
    useGame.getState().playAgain();
    expect(useLesson.getState().run).toBeNull();
  }, 60_000);

  it("the game screen: the goal card on a desktop, the Goal tab first on a phone, the Done card, the report's first line", () => {
    const gs = src("ui/GameScreen.tsx");
    expect(gs).toContain("<GoalCard />");
    expect(gs).toMatch(/lesson \? \[\{ id: "goal", label: LESSON_UI\.goal \}\] : \[\]\),\s*\{ id: "army"/);
    expect(gs).toContain("<LessonEnd />");
    expect(src("ui/TurnReport.tsx")).toContain("<LessonReportLine />");
    const lesson = src("ui/Lesson.tsx");
    for (const w of ["Next lesson", "Back to the lobby", "Try again", "Back"]) expect(lesson).toContain(`"${w}"`);
  });
});
