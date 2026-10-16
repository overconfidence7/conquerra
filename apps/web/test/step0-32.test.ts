import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { TUTORIALS } from "@conquerra/content/tutorials";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { memorySaveStore } from "../src/host/saves";
import { setHostFactory, useGame } from "../src/store";
import { foldGoal, hintFor, startLesson, useLesson } from "../src/tutorials/run";
import { ordersOf } from "../src/tutorials/build";
import { inProcessHost } from "./inProcessHost";

/**
 * Session 32, Step 0: the review's fixes. Recruit here from the territory panel adds the order and stays on the
 * territory panel (the round Recruit button keeps "Recruit at…"); the hint isn't repeated as the notice while the goal
 * card says it; the guided game holds the clock while a card is up.
 */
const here = dirname(fileURLToPath(import.meta.url));
const src = (p: string) => readFileSync(join(here, "../src", p), "utf8");

describe("session 32's Step 0", () => {
  const box = new Map<string, string>();
  beforeAll(() => vi.stubGlobal("localStorage", { getItem: (k: string) => box.get(k) ?? null, setItem: (k: string, v: string) => void box.set(k, v), removeItem: (k: string) => void box.delete(k) }));
  afterAll(() => vi.unstubAllGlobals());
  beforeEach(() => box.clear());

  it("Recruit here adds a recruit and leaves the panel on the territory, so the next tap selects as usual", async () => {
    setHostFactory(() => inProcessHost("unused", memorySaveStore()));
    await useGame.getState().start();
    const { view } = useGame.getState();
    const cap = view!.me.capital;
    useGame.getState().select(cap);
    useGame.getState().recruitHere(cap);
    const g = useGame.getState();
    expect(g.recruit).toBeNull();
    expect(g.selected).toBe(cap);
    expect(g.queue.filter((o) => o.kind === "recruit")).toMatchObject([{ kind: "recruit", territory: cap, count: "all" }]);
    // The territory panel's button calls it; the round Recruit button still opens "Recruit at…".
    expect(src("ui/Panel.tsx")).toContain("onClick={() => recruitHere(selected)}");
    expect(src("store.ts")).toMatch(/quickRecruit\(\) \{[\s\S]*?recruitAt\(a\.at\)/);
  });

  it("a lesson's hint shows as the notice only when the goal card is folded (or the phone's Goal tab is shut)", async () => {
    setHostFactory(() => inProcessHost("unused", memorySaveStore()));
    // Raise an army: two turns, a hint each.
    const def = TUTORIALS.find((t) => t.id === "raise-an-army")!;
    expect(await startLesson(def, null)).toBe(true);
    const run = useLesson.getState().run!;
    expect(useGame.getState().notice).toBeNull();
    foldGoal(true);
    expect(useLesson.getState().goalInView).toBe(false);
    useGame.setState({ queue: ordersOf(def.solution[0]!, 1) });
    await useGame.getState().lockIn();
    useGame.getState().endReplay();
    expect(useLesson.getState().run!.state.kind).toBe("open");
    const hint = hintFor(run, useGame.getState().view!.turn);
    expect(hint).toBeTruthy();
    expect(useGame.getState().notice).toBe(hint);
    // The phone's Goal tab reports itself the same way.
    expect(src("ui/GameScreen.tsx")).toContain('setGoalInView(tab === "goal" && sheet !== "closed")');
  });

  it("the guided first game holds the clock while a card is up, and lets it run once the cards are done or skipped", () => {
    const guide = src("ui/Guide.tsx");
    expect(guide).toMatch(/cardUp && hasClock && !clockPaused && !held\.current[\s\S]*?togglePause\(\)/);
    expect(guide).toMatch(/!cardUp && held\.current[\s\S]*?if \(clockPaused\) void g\.togglePause\(\)/);
    // On a phone the cards sit above the open sheet, never over its lines.
    expect(guide).toContain('document.querySelector<HTMLElement>(".sheet")');
  });
});
