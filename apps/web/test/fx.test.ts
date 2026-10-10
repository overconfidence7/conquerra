import { ASSETS } from "@conquerra/art";
import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { createGame, resolveTurn, replayFor, viewFor, type GameContext, type GameState, type ReplayEvent } from "@conquerra/engine";
import { recruitBot } from "@conquerra/bots";
import { describe, expect, it } from "vitest";
import { hexNum, houseOf } from "../src/map/houses";
import { BUDGET, particlesAt, type FxInstance } from "../src/replay/fx/particles";
import { fxAt, fxContext, type FxContext } from "../src/replay/fx/plan";
import { Recipes } from "../src/replay/fx/recipeSchema";
import { RECIPES } from "../src/replay/fx/recipes";
import { replayInfo } from "../src/replay/info";
import { replaySpots } from "../src/replay/camera";
import { buildTimeline, frameAt, type Timeline } from "../src/replay/timeline";

/** Session 21: the replay's effects. */
const ctx: GameContext = { map: maps.embervale!, rules: defaultRules };
const CODE_SHAPES = ["dot", "spark", "glint", "ember", "ring", "streak", "flake"];

/** Play bot turns with the fog lifted for p1 or not, and keep the turn whose replay has the most battles. */
function busyTurn(fog: boolean, seed = "fx-busy"): { state: GameState; events: ReplayEvent[]; tl: Timeline } {
  let s = createGame(ctx, { gameId: "fx-game", seed, players: [1, 2, 3, 4].map((i) => ({ id: `p${i}`, name: `P${i}` })), settings: { fog } as never });
  let best: { state: GameState; events: ReplayEvent[]; n: number } | null = null;
  for (let turn = 0; turn < 20 && !s.winner; turn++) {
    const orders = Object.fromEntries(s.players.filter((p) => p.eliminatedTurn === null).map((p) => [p.id, recruitBot.plan(ctx, viewFor(ctx, s, p.id))]));
    const r = resolveTurn(ctx, s, orders);
    const events = replayFor(ctx, s, r, "p1");
    // (With the fog on, prefer a turn that has fogged events in it too.)
    const n = events.filter((e) => e.type === "battle").length + (fog && events.some((e) => e.type === "surface") ? 100 : 0);
    if (!best || n > best.n) best = { state: s, events, n };
    s = r.state;
  }
  return { state: best!.state, events: best!.events, tl: buildTimeline(best!.events) };
}

function contextFor(state: GameState, events: readonly ReplayEvent[]): FxContext {
  const before = viewFor(ctx, state, "p1");
  return fxContext(ctx.map, before.gameId, before.turn, events, (p) => hexNum(houseOf(before, p).color), (id) => id === before.me.capital, () => false);
}

describe("effect recipes are data", () => {
  it("every recipe fits the schema", () => {
    expect(() => Recipes.parse(RECIPES)).not.toThrow();
  });

  it("every texture a recipe names is an effect in the art list, or a shape drawn in code", () => {
    const fx = new Set(ASSETS.filter((a) => a.kind === "fx").map((a) => a.name));
    for (const [name, r] of Object.entries(RECIPES))
      for (const e of r.emitters) for (const t of e.textures) expect(fx.has(t) || CODE_SHAPES.includes(t), `${name}: ${t}`).toBe(true);
  });
});

describe("effects are the same every time", () => {
  const { state, events, tl } = busyTurn(false);
  it("the same game, turn and moment give the same particles (Watch again, pause, Skip)", () => {
    expect(events.some((e) => e.type === "battle")).toBe(true);
    for (const at of [0.1, 0.3, 0.5, 0.7, 0.9].map((k) => tl.total * k)) {
      const a = particlesAt(fxAt(tl, at, contextFor(state, events)).instances, "full", BUDGET.desktop, 1);
      const b = particlesAt(fxAt(buildTimeline(events), at, contextFor(state, events)).instances, "full", BUDGET.desktop, 1);
      expect(b).toEqual(a);
    }
  });

  it("a moment can be drawn out of order (scrubbing back gives what was shown before)", () => {
    const c = contextFor(state, events);
    const mid = tl.total * 0.45;
    const first = particlesAt(fxAt(tl, mid, c).instances, "full", BUDGET.desktop, 1);
    particlesAt(fxAt(tl, tl.total * 0.9, c).instances, "full", BUDGET.desktop, 1);
    expect(particlesAt(fxAt(tl, mid, c).instances, "full", BUDGET.desktop, 1)).toEqual(first);
  });

  it("another game's replay of the same events looks different (it's seeded from the game)", () => {
    const c = contextFor(state, events);
    const other = { ...c, gameId: "another-game" };
    const battle = tl.beats.find((b) => b.kind === "battle")!;
    const at = battle.start + battle.duration * 0.6;
    const a = particlesAt(fxAt(tl, at, c).instances, "full", BUDGET.desktop, 1).particles;
    const b = particlesAt(fxAt(tl, at, other).instances, "full", BUDGET.desktop, 1).particles;
    expect(a.length).toBeGreaterThan(0);
    expect(b.map((p) => p.dx)).not.toEqual(a.map((p) => p.dx));
  });

  it("a battle has its fight at the border and its result over the land, with more smoke for more troops", () => {
    const c = contextFor(state, events);
    const battle = tl.beats.find((b) => b.kind === "battle")!;
    const fight = fxAt(tl, battle.start + battle.duration * 0.55, c).instances;
    expect(fight.map((i) => i.recipe)).toContain("clash");
    const clash = fight.find((i) => i.recipe === "clash")!;
    const small: FxInstance = { ...clash, troops: 2 }, big: FxInstance = { ...clash, troops: 40 };
    const n = (i: FxInstance) => particlesAt([i], "full", BUDGET.desktop, 1).particles.length;
    expect(n(big)).toBeGreaterThan(n(small));
    const result = fxAt(tl, battle.start + battle.duration * 0.9, c).instances.map((i) => i.recipe);
    expect(result.some((r) => r === "captured" || r === "heldBack")).toBe(true);
  });
});

describe("Effects: Full, Light, Off", () => {
  const { state, events, tl } = busyTurn(false);
  const c = contextFor(state, events);
  const spots = replaySpots(ctx.map);

  it("Off draws no particles, and the replay's information is exactly what Full shows", () => {
    for (let at = 0; at < tl.total; at += 250) {
      const plan = fxAt(tl, at, c);
      expect(particlesAt(plan.instances, "off", BUDGET.desktop, 1).particles).toEqual([]);
      // The info (armies' numbers, battles and their results, pops, pulses) takes no Effects setting at all: the
      // replay layer draws it the same on Full, Light and Off.
      const frame = frameAt(tl, at);
      expect(replayInfo(frame, c, (id) => spots.province.get(id))).toEqual(replayInfo(frameAt(tl, at), c, (id) => spots.province.get(id)));
    }
  });

  it("Light has about half the particles and none of the flashes", () => {
    let full = 0, light = 0;
    for (let at = 0; at < tl.total; at += 100) {
      const inst = fxAt(tl, at, c).instances;
      full += particlesAt(inst, "full", BUDGET.desktop, 1).particles.length;
      light += particlesAt(inst, "light", BUDGET.desktop, 1).particles.length;
    }
    expect(full).toBeGreaterThan(0);
    expect(light / full).toBeGreaterThan(0.35);
    expect(light / full).toBeLessThan(0.65);
    const flash: FxInstance = { key: "x", recipe: "shieldFlash", seed: 1, x: 0, y: 0, age: 100, span: 600, troops: 0, tints: {} };
    expect(particlesAt([flash], "full", BUDGET.desktop, 1).particles.length).toBe(1);
    expect(particlesAt([flash], "light", BUDGET.desktop, 1).particles.length).toBe(0);
  });

  it("past the budget everything is thinned together, never over it", () => {
    const clash: FxInstance = { key: "c", recipe: "clash", seed: 7, x: 100, y: 100, age: 300, span: 800, troops: 60, tints: {} };
    const many = Array.from({ length: 60 }, (_, i) => ({ ...clash, key: `c${i}`, seed: i }));
    const { particles, share } = particlesAt(many, "full", BUDGET.phone, 1);
    expect(share).toBeLessThan(1);
    expect(particles.length).toBeLessThanOrEqual(BUDGET.phone);
  });
});

describe("fog: a fogged event is the same soft pulse whatever it was", () => {
  it("surface events get no effect, and their pulse says nothing about what happened", () => {
    const prov = ctx.map.provinces[1]!;
    const spots = replaySpots(ctx.map);
    const { state, events } = busyTurn(true, "fx-fog");
    const c = contextFor(state, events);
    const shown = (what: "battle" | "leaderFell" | "fate") => {
      const tl = buildTimeline([{ type: "surface", step: 1, what, province: prov.id }]);
      const at = tl.beats[0]!.start + tl.beats[0]!.duration * 0.5;
      return { fx: fxAt(tl, at, c).instances, info: replayInfo(frameAt(tl, at), c, (id) => spots.province.get(id)) };
    };
    const battle = shown("battle"), fate = shown("fate"), fell = shown("leaderFell");
    expect(battle.fx).toEqual([]);
    expect(battle.info).toEqual(fate.info);
    expect(battle.info).toEqual(fell.info);
    expect(battle.info).toEqual([{ kind: "pulse", x: expect.any(Number), y: expect.any(Number), progress: expect.any(Number) }]);
  });

  it("in a real fogged game, every effect comes from something p1 saw, never from a fogged event", () => {
    const { state, events, tl } = busyTurn(true, "fx-fog");
    expect(events.some((e) => e.type === "surface")).toBe(true);
    const c = contextFor(state, events);
    let n = 0;
    for (let at = 0; at < tl.total; at += 100)
      for (const i of fxAt(tl, at, c).instances) {
        const e = events[Number(i.key.split(":")[0])]!;
        expect(e.type, i.key).not.toBe("surface");
        n++;
      }
    expect(n).toBeGreaterThan(0);
  });
});
