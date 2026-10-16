import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { maps } from "@conquerra/content/maps";
import { FREE_MAPS, nextTutorial, TutorialDef, TUTORIALS, tutorialById } from "@conquerra/content/tutorials";
import { stateFingerprint, viewFor } from "@conquerra/engine";
import { describe, expect, it } from "vitest";
import { LocalGame } from "../src/host/localGame";
import { buildTutorial, playLessonTurn } from "../src/tutorials/build";
import { goalLine, goalState } from "../src/tutorials/goal";

/**
 * Session 31: every tutorial's solution reaches its goal against the current engine (the bots playing as they do),
 * within its turns. A rule change that breaks a lesson fails here. The saved game is rebuilt from the recipe each time.
 */
const here = dirname(fileURLToPath(import.meta.url));
const DATA = join(here, "../../../packages/content/data/tutorials");
const words = (s: string) => s.trim().split(/\s+/).length;

/** Play a lesson's solution; the goal's state after each turn. */
export function playSolution(def: TutorialDef) {
  const map = maps[def.recipe.map]!;
  const save = buildTutorial(def, map);
  const game = LocalGame.restore(map, save, () => 0);
  const start = game.turn;
  const states = [goalState(def, map, viewFor(game.ctx, game.fullState, "you"), start)];
  // (Your leaders' standing orders go in each turn, as the page sends them.)
  let standing = game.start().generalOrders ?? [];
  for (const [i, turn] of def.solution.entries()) {
    if (states.at(-1)!.kind !== "open") break;
    const u = playLessonTurn(game, turn, i + 1, standing);
    standing = u.generalOrders ?? [];
    states.push(goalState(def, map, u.view, start));
  }
  return { states, game, start, map };
}

describe("the tutorials (session 31)", () => {
  it("every file in data/tutorials is listed, parses, and is on a free map against a Recruit or a Captain", () => {
    const files = readdirSync(DATA).filter((f) => f.endsWith(".json"));
    expect(files.length).toBe(TUTORIALS.length);
    for (const f of files) {
      const def = TutorialDef.parse(JSON.parse(readFileSync(join(DATA, f), "utf8")));
      expect(f).toMatch(new RegExp(`^\\d\\d-${def.id}\\.json$`));
      expect(FREE_MAPS).toContain(def.recipe.map);
      expect(tutorialById(def.id)).toBeDefined();
    }
    expect(new Set(TUTORIALS.map((t) => t.id)).size).toBe(TUTORIALS.length);
    expect(new Set(TUTORIALS.map((t) => t.order)).size).toBe(TUTORIALS.length);
  });

  for (const def of TUTORIALS)
    it(`"${def.words.name}": its solution reaches the goal within ${def.goal.turns} turns, and not at the start`, () => {
      const { states } = playSolution(def);
      expect(states[0]!.kind).toBe("open");
      expect(states.at(-1)).toEqual({ kind: "done" });
      expect(states.length - 1).toBeLessThanOrEqual(def.goal.turns);
    }, 60_000);

  it("the saved game is the same every time it's built (the recipe, never kept state)", () => {
    for (const def of TUTORIALS) {
      const map = maps[def.recipe.map]!;
      expect(stateFingerprint(buildTutorial(def, map).state)).toBe(stateFingerprint(buildTutorial(def, map).state));
      // Your colour and your Leader's name only change how it looks.
      const looks = buildTutorial(def, map, { house: 4, leaderName: "Nate" }).state;
      const plain = buildTutorial(def, map).state;
      expect(looks.territories).toEqual(plain.territories);
      expect(looks.players.find((p) => p.id === "you")!.house).toBe(4);
    }
  });

  it("a lesson's game has no timer, and its own fog, Fate and diplomacy as the recipe says", () => {
    for (const def of TUTORIALS) {
      const map = maps[def.recipe.map]!;
      const save = buildTutorial(def, map);
      expect((save.host as { turnSeconds: number | null }).turnSeconds).toBeNull();
      expect(save.state.settings.fate).toBe(def.recipe.rules.fate ?? false);
      expect(save.state.settings.diplomacy).toBe(def.recipe.rules.diplomacy ?? false);
      expect(save.history).toBeUndefined();
    }
  });

  it("the words: at most four hints of under 25 words, a goal under 40, and the goal names the places it checks", () => {
    for (const def of TUTORIALS) {
      const map = maps[def.recipe.map]!;
      expect(def.words.hints.length).toBeLessThanOrEqual(4);
      expect(def.words.hints.length).toBeGreaterThanOrEqual(1);
      for (const h of def.words.hints) expect(words(h), h).toBeLessThan(25);
      expect(words(def.words.goal)).toBeLessThan(40);
      for (const c of def.goal.all) {
        const ids = "territories" in c ? c.territories : "territory" in c && c.territory ? [c.territory] : [];
        for (const id of ids) expect(def.words.goal, id).toContain(map.territories.find((t) => t.id === id)!.name);
        if ("province" in c && c.province) expect(def.words.goal).toContain(map.provinces.find((p) => p.id === c.province)!.name);
      }
    }
  });

  it("the report's goal line, and the next lesson", () => {
    const def = TUTORIALS[0]!;
    expect(goalLine(def, { kind: "done" })).toBe(`Goal: ${def.words.met}. Done.`);
    expect(goalLine(def, { kind: "open", turnsLeft: 2 })).toBe("Goal: not yet, 2 turns left");
    expect(goalLine(def, { kind: "open", turnsLeft: 1 })).toBe("Goal: not yet, this is the last turn");
    expect(nextTutorial(TUTORIALS[0]!.id)?.id).toBe(TUTORIALS[1]!.id);
  });

  it("doing nothing misses the goal once its turns are up", () => {
    const def = TUTORIALS[0]!;
    const map = maps[def.recipe.map]!;
    const game = LocalGame.restore(map, buildTutorial(def, map), () => 0);
    const start = game.turn;
    let state = goalState(def, map, viewFor(game.ctx, game.fullState, "you"), start);
    for (let i = 0; i < def.goal.turns; i++) state = goalState(def, map, game.lockIn([], game.turn).view, start);
    expect(state).toEqual({ kind: "missed" });
  }, 60_000);
});
