import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { createGame, resolveTurn, replayFor, viewFor, type GameContext, type GameState, type ReplayEvent } from "@conquerra/engine";
import { recruitBot } from "@conquerra/bots";
import { REGISTRY } from "@conquerra/sound";
import { RECIPE } from "@conquerra/sound/recipe";
import { describe, expect, it } from "vitest";
import { buildTimeline } from "../src/replay/timeline";
import { Cues, CUE_NAMES, CUE_SPECS, CUES } from "../src/sound/cues";
import { admit, MAX_AT_ONCE, pick, STACK_MS } from "../src/sound/mixer";
import { soundPlan, soundsBetween, troopGain, type SoundContext } from "../src/sound/plan";
import { busGains, readLevels, SOUND_DEFAULTS } from "../src/sound/settings";
import { DUCK_BACK_MS, DUCK_TO, duck, duckLevel } from "../src/sound/duck";
import { fadeStep, MUSIC_VOLUME } from "../src/sound/music";
import { BED_VOLUME, BIRD_CYCLE_MS, BIRD_ON_MS, bedLevels, closenessOf, waterInView } from "../src/sound/ambience";

/** Session 24: the game's sound. */
const ctx: GameContext = { map: maps.embervale!, rules: defaultRules };

/** Bot turns on Embervale (fog on or off for p1); the turn with the most battles (and some fog, when it's on). */
function busyTurn(fog: boolean, seed = "sound-busy"): { state: GameState; events: ReplayEvent[] } {
  let s = createGame(ctx, { gameId: "sound-game", seed, players: [1, 2, 3, 4].map((i) => ({ id: `p${i}`, name: `P${i}` })), settings: { fog } as never });
  let best: { state: GameState; events: ReplayEvent[]; n: number } | null = null;
  for (let turn = 0; turn < 20 && !s.winner; turn++) {
    const orders = Object.fromEntries(s.players.filter((p) => p.eliminatedTurn === null).map((p) => [p.id, recruitBot.plan(ctx, viewFor(ctx, s, p.id))]));
    const r = resolveTurn(ctx, s, orders);
    const events = replayFor(ctx, s, r, "p1");
    const n = events.filter((e) => e.type === "battle").length + (fog && events.some((e) => e.type === "surface") ? 100 : 0);
    if (!best || n > best.n) best = { state: s, events, n };
    s = r.state;
  }
  return { state: best!.state, events: best!.events };
}
const contextFor = (state: GameState): SoundContext => {
  const v = viewFor(ctx, state, "p1");
  return { gameId: v.gameId, turn: v.turn, me: "p1", isCapital: (id) => id === v.me.capital, fortified: () => true };
};

describe("sound cues are data", () => {
  it("every cue fits the schema", () => {
    expect(() => Cues.parse(CUES)).not.toThrow();
  });

  it("every cue's files are in the sound registry, and every registered file belongs to a cue", () => {
    const registered = new Set(REGISTRY.files.map((f) => f.name));
    for (const name of CUE_NAMES) for (const f of CUE_SPECS[name].files) expect(registered.has(f), `${name}: ${f}`).toBe(true);
    const used = new Set(CUE_NAMES.flatMap((n) => CUE_SPECS[n].files));
    for (const f of REGISTRY.files) expect(used.has(f.name), f.name).toBe(true);
    // The game's cues are the sound list's (and the importer's), in the same order.
    expect(CUE_NAMES).toEqual(RECIPE.cues.map((c) => c.cue));
  });

  it("the sound bench shows every cue, once", async () => {
    const { GROUPS } = await import("../src/lab/sound/SoundBench");
    expect(GROUPS.flatMap((g) => g.cues).sort()).toEqual([...CUE_NAMES].sort());
  });

  it("a cue's bus matches the kind of file it plays", () => {
    const kind = new Map(REGISTRY.files.map((f) => [f.name, f.kind]));
    for (const name of CUE_NAMES) for (const f of CUE_SPECS[name].files) expect(kind.get(f), `${name}: ${f}`).toBe(CUE_SPECS[name].bus);
  });
});

describe("the replay's sound follows its clock", () => {
  const { state, events } = busyTurn(false);
  const tl = buildTimeline(events);

  it("Watch again plays the same sounds at the same moments, with the same files and pitches", () => {
    const a = soundPlan(tl, contextFor(state), events);
    const b = soundPlan(buildTimeline(events), contextFor(state), events);
    expect(a.length).toBeGreaterThan(5);
    expect(b).toEqual(a);
    expect(b.map((s) => pick(s.cue, s.seed))).toEqual(a.map((s) => pick(s.cue, s.seed)));
    for (const s of a) expect(s.at).toBeGreaterThanOrEqual(0), expect(s.at).toBeLessThanOrEqual(tl.total);
  });

  it("battles sound: a march, the clash and a result", () => {
    const cues = new Set(soundPlan(tl, contextFor(state), events).map((s) => s.cue));
    expect(cues.has("battle")).toBe(true);
    expect([...cues].some((c) => c === "capture" || c === "capture-rival" || c === "held" || c === "capital-falls")).toBe(true);
    expect([...cues].some((c) => c.startsWith("march-"))).toBe(true);
  });

  it("walking the clock frame by frame plays each sound once, in order", () => {
    const plan = soundPlan(tl, contextFor(state), events);
    const heard: typeof plan = [];
    let last = -1;
    for (let t = 0; t <= tl.total + 16; t += 16) (heard.push(...soundsBetween(plan, last, t)), (last = t));
    expect(heard).toEqual(plan);
  });

  it("the variant and the pitch come from the game's public id, the turn and the event, not Math.random()", () => {
    const one = soundPlan(tl, contextFor(state), events);
    const other = soundPlan(tl, { ...contextFor(state), gameId: "another-game" }, events);
    expect(other.map((s) => s.cue)).toEqual(one.map((s) => s.cue));
    expect(other.map((s) => s.seed)).not.toEqual(one.map((s) => s.seed));
  });

  it("bigger fights and marches are louder, up to the cue's own volume", () => {
    expect(troopGain("battle", 2)).toBeCloseTo(0.6);
    expect(troopGain("battle", 100)).toBe(1);
    expect(troopGain("battle", 16)).toBeGreaterThan(troopGain("battle", 4));
    expect(troopGain("fate", 50)).toBe(1);
  });
});

describe("a busy turn isn't a din", () => {
  const { state, events } = busyTurn(false);
  it("a cue with a cooldown doesn't play again within it", () => {
    const plan = soundPlan(buildTimeline(events), contextFor(state), events);
    for (const cue of CUE_NAMES) {
      const at = plan.filter((s) => s.cue === cue).map((s) => s.at);
      for (let i = 1; i < at.length; i++) expect(at[i]! - at[i - 1]!, cue).toBeGreaterThanOrEqual(CUE_SPECS[cue].cooldown);
    }
  });
  it("a rival taking neutral land gets no horn", () => {
    const plan = soundPlan(buildTimeline(events), contextFor(state), events);
    const neutralTakes = events.filter((e) => e.type === "battle" && e.captured && !e.defender && e.player !== "p1");
    expect(neutralTakes.length).toBeGreaterThan(0);
    const horns = plan.filter((s) => s.cue === "capture-rival").length;
    expect(horns).toBeLessThanOrEqual(events.filter((e) => e.type === "battle" && e.captured && e.defender && e.player !== "p1").length);
  });
});

describe("the fog: no sound hints at what it hides", () => {
  const { state, events } = busyTurn(true);

  it("every fogged event gets the same distant rumble, whatever it was, and nothing else", () => {
    const surfaces = events.filter((e) => e.type === "surface");
    expect(surfaces.length).toBeGreaterThan(0);
    const plan = soundPlan(buildTimeline(events), contextFor(state), events);
    // One rumble for each beat with something in the fog (not one per thing: that would be a drum roll).
    const tl = buildTimeline(events);
    expect(plan.filter((s) => s.cue === "fog").length).toBe(tl.beats.filter((b) => b.events.some((e) => e.type === "surface")).length);
    for (const s of plan.filter((s) => s.cue === "fog")) expect(s.gain).toBe(1);
    // Turn every fogged event into each kind it could be: the sounds don't change at all.
    const as = (what: string) => {
      const swapped = events.map((e) => (e.type === "surface" ? ({ ...e, what } as ReplayEvent) : e));
      return soundPlan(buildTimeline(swapped), contextFor(state), swapped);
    };
    const battle = as("battle");
    expect(as("fate")).toEqual(battle);
    expect(as("leader")).toEqual(battle);
  });
});

describe("never annoying", () => {
  it("the same cue never stacks more than twice in 100 ms", () => {
    const recent = new Map([["battle", [1000, 1050]]]);
    expect(admit({ playing: [], recent }, "battle", 1080, 12)).toEqual({ play: false, why: "stacked" });
    expect(admit({ playing: [], recent }, "battle", 1000 + STACK_MS + 1, 12)).toEqual({ play: true, replace: null });
    expect(admit({ playing: [], recent }, "fog", 1080, 12)).toEqual({ play: true, replace: null });
  });

  it("at most 6 sounds at once on a phone and 12 on a laptop; a more important one takes the least one's place", () => {
    expect(MAX_AT_ONCE).toEqual({ phone: 6, laptop: 12 });
    const playing = [...Array.from({ length: 5 }, () => ({ cue: "battle", priority: 2 })), { cue: "fog", priority: 0 }];
    const recent = new Map<string, number[]>();
    expect(admit({ playing, recent }, "capital-falls", 0, 6)).toEqual({ play: true, replace: 5 });
    expect(admit({ playing, recent }, "culture", 0, 6)).toEqual({ play: false, why: "busy" });
    expect(admit({ playing, recent }, "culture", 0, 12)).toEqual({ play: true, replace: null });
  });

  it("the music dips under a capital falling and a House knocked out", () => {
    expect(CUE_SPECS["capital-falls"].duck).toBeGreaterThan(0);
    expect(CUE_SPECS["knocked-out"].duck).toBeGreaterThan(0);
    // Nothing on a tap is loud: the menu sounds are soft.
    for (const n of CUE_NAMES) if (CUE_SPECS[n].beat === "ui") expect(CUE_SPECS[n].volume, n).toBeLessThanOrEqual(0.55);
  });
});

describe("Settings → Sound", () => {
  it("starts on, at a moderate volume, music lower than effects", () => {
    expect(readLevels(null)).toEqual(SOUND_DEFAULTS);
    expect(SOUND_DEFAULTS.muted).toBe(false);
    expect(SOUND_DEFAULTS.music).toBeLessThan(SOUND_DEFAULTS.effects);
    expect(SOUND_DEFAULTS.master).toBeLessThan(1);
  });

  it("is remembered as it was set, and a bad value falls back to the default", () => {
    expect(readLevels(JSON.stringify({ master: 0.4, music: 0, effects: 1, muted: true }))).toEqual({ master: 0.4, music: 0, effects: 1, muted: true });
    expect(readLevels(JSON.stringify({ master: 7, music: "loud" }))).toEqual({ ...SOUND_DEFAULTS, master: 1 });
    expect(readLevels("not json")).toEqual(SOUND_DEFAULTS);
  });

  it("Mute silences everything; Music's volume carries the ambience", () => {
    expect(busGains({ ...SOUND_DEFAULTS, muted: true })).toEqual({ sfx: 0, music: 0, ambience: 0 });
    const g = busGains({ master: 1, music: 0.5, effects: 1, muted: false });
    expect(g.sfx).toBe(1);
    expect(g.music).toBe(0.5);
    expect(g.ambience).toBeLessThanOrEqual(g.music);
    expect(busGains({ master: 1, music: 0, effects: 1, muted: false }).ambience).toBe(0);
  });
});

describe("the music", () => {
  it("plays at the cue list's volumes", () => {
    for (const [cue, v] of Object.entries(MUSIC_VOLUME)) expect(CUE_SPECS[cue as keyof typeof CUE_SPECS].volume, cue).toBe(v);
  });

  it("crossfades over about a second, both ways", () => {
    const rate = 1 / 1000;
    expect(fadeStep(0, 1, rate, 500)).toBeCloseTo(0.5);
    expect(fadeStep(0.5, 1, rate, 800)).toBe(1);
    expect(fadeStep(1, 0, rate, 250)).toBeCloseTo(0.75);
    expect(fadeStep(0.1, 0, rate, 500)).toBe(0);
  });

  it("dips under a big moment and comes back up", () => {
    duck(1000, 10_000);
    expect(duckLevel(10_500)).toBe(DUCK_TO);
    expect(duckLevel(11_000 + DUCK_BACK_MS / 2)).toBeCloseTo((DUCK_TO + 1) / 2);
    expect(duckLevel(11_000 + DUCK_BACK_MS)).toBe(1);
  });
});

describe("the ambience under the map (Part 4)", () => {
  it("plays at the cue list's volumes, under Music's", () => {
    for (const [bed, v] of Object.entries(BED_VOLUME)) expect(CUE_SPECS[bed as keyof typeof CUE_SPECS].volume, bed).toBe(v);
    for (const bed of Object.keys(BED_VOLUME)) expect(CUE_SPECS[bed as keyof typeof CUE_SPECS].bus).toBe("ambience");
  });

  it("closer in is a little louder; the sea only where there's water in view", () => {
    const far = bedLevels({ closeness: 0, water: 0.3 }, 0), near = bedLevels({ closeness: 1, water: 0.3 }, 0);
    expect(near.wind).toBeGreaterThan(far.wind);
    expect(near.sea).toBeGreaterThan(far.sea);
    expect(near.wind).toBeLessThanOrEqual(far.wind * 1.5);
    expect(bedLevels({ closeness: 1, water: 0 }, 0).sea).toBe(0);
  });

  it("the birds come and go", () => {
    const at = (t: number) => bedLevels({ closeness: 1, water: 0 }, t).birds;
    expect(at(BIRD_ON_MS / 2)).toBeGreaterThan(0.5);
    expect(at(BIRD_ON_MS + 5000)).toBe(0);
    expect(at(BIRD_CYCLE_MS + BIRD_ON_MS / 2)).toBe(at(BIRD_ON_MS / 2));
  });

  it("reads closeness from the camera and water from the map's ground", () => {
    expect(closenessOf({ x: 0, y: 0, scale: 1 }, 48)).toBe(0);
    expect(closenessOf({ x: 0, y: 0, scale: 1 }, 260)).toBe(1);
    const map = ctx.map;
    const g = map.geometry!;
    // The whole map in view has some water; looking far off its edge is all sea.
    const fit = { x: 0, y: 0, scale: 400 / g.width };
    const w = waterInView(map, fit, { width: 400, height: (g.height * 400) / g.width });
    expect(w).toBeGreaterThan(0);
    expect(w).toBeLessThan(1);
    expect(waterInView(map, { x: -100000, y: 0, scale: 1 }, { width: 400, height: 300 })).toBe(1);
  });
});
