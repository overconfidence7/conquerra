import { defaultRules, MapDef, type Rules } from "@conquerra/content";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  STATE_VERSION,
  createGame,
  makeSave,
  readSave,
  replayFor,
  resolveTurn,
  spyLine,
  stateFingerprint,
  trueDetail,
  viewFor,
  type GameContext,
  type GameState,
  type Order,
  type OrdersByPlayer,
  type Spy,
  type StepEvent,
} from "../src";
import { mv } from "./helpers";

/**
 * Spies (session 15). A line of twelve territories in six provinces of two:
 *   a b | c d | e f | g h | i j | k l
 *   P0    P1    P2    P3    P4    P5
 * p1 holds P0 whole (capital a); p2 holds P4 and P5 whole (capital l); the middle is neutral.
 */
const ids = "abcdefghijkl".split("");
const map = MapDef.parse({
  id: "spy-line",
  name: "Spy line",
  minPlayers: 2,
  maxPlayers: 3,
  recommendedPlayers: { min: 2, max: 3 },
  territories: ids.map((id, i) => ({ id, name: id.toUpperCase(), province: `P${Math.floor(i / 2)}`, terrain: "plains", x: i * 100, y: 0 })),
  provinces: [0, 1, 2, 3, 4, 5].map((i) => ({ id: `P${i}`, name: `Province ${i}`, bonus: 1 })),
  borders: ids.slice(1).map((b, i) => ({ a: ids[i]!, b })),
  capitalSlots: ["a", "l", "f"],
});
const ctxWith = (f?: (r: Rules) => void): GameContext => {
  const rules = JSON.parse(JSON.stringify(defaultRules)) as Rules;
  f?.(rules);
  return { map, rules };
};
const ctx = ctxWith();

type Spot = [owner: string | null, troops: number];
function game(layout: Record<string, Spot> = {}, seed = "spies"): GameState {
  const s = createGame(ctx, { gameId: "spy", seed, players: ["p1", "p2"].map((id) => ({ id, name: id.toUpperCase() })), settings: { luck: 0, fate: false, spoils: false, fallen: false, diplomacy: false } });
  const base: Record<string, Spot> = { a: ["p1", 10], b: ["p1", 4], i: ["p2", 6], j: ["p2", 5], k: ["p2", 3], l: ["p2", 10] };
  for (const t of ids) {
    const [owner, troops] = layout[t] ?? base[t] ?? [null, 1];
    s.territories[t] = { owner, troops, specialists: [], building: null, construction: null, culture: 0 };
  }
  const caps: Record<string, string> = { p1: "a", p2: "l" };
  for (const p of s.players) {
    p.capital = caps[p.id]!;
    p.leader = { alive: true, territory: caps[p.id]! };
    p.gold = 50;
  }
  s.intel = Object.fromEntries(s.players.map((p) => [p.id, {}]));
  return s;
}
/** Put a spy straight onto the board (as if it had just arrived there). */
function place(s: GameState, owner: string, at: string, extra: Partial<Spy> = {}): Spy {
  const spy: Spy = { id: `y${s.nextSpy++}`, owner, at, target: null, recalled: false, status: "travel", ...extra };
  s.spies.push(spy);
  return spy;
}
const of = <T extends StepEvent["type"]>(ev: readonly StepEvent[], type: T) => ev.filter((e): e is Extract<StepEvent, { type: T }> => e.type === type);
const send = (spy: string, to: string | null): Order => ({ id: `send-${spy}`, kind: "spy", spy, to });
const hire = (territory: string): Order => ({ id: `hire-${territory}`, kind: "hireSpy", territory });
const names = { place: (t: string) => t.toUpperCase(), province: (p: string) => p.replace("P", "Province ") };

describe("spies: hiring, upkeep and the cap", () => {
  it("a spy is hired at your capital or a barracks for 8 gold; it's its own piece, not part of an army", () => {
    const s = game();
    const r = resolveTurn(ctx, s, { p1: [hire("a")] });
    expect(of(r.events, "spyHired")[0]).toMatchObject({ player: "p1", territory: "a", cost: 8 });
    expect(r.state.spies).toMatchObject([{ owner: "p1", at: "a", status: "defend" }]);
    expect(r.state.territories.a!.specialists).toEqual([]);
    // Not at plain land.
    expect(of(resolveTurn(ctx, s, { p1: [hire("b")] }).events, "fizzled")[0]!.reason).toBe("hireSite");
    // A barracks will do.
    const t = game();
    t.territories.b!.building = "barracks";
    expect(of(resolveTurn(ctx, t, { p1: [hire("b")] }).events, "spyHired")).toHaveLength(1);
  });

  it("up to 5 spies; each costs 1 gold a turn only while away (free at home), and if you can't pay, troops desert as with any upkeep", () => {
    const s = game();
    for (let i = 0; i < 5; i++) place(s, "p1", "a");
    expect(of(resolveTurn(ctx, s, { p1: [hire("a")] }).events, "fizzled")[0]!.reason).toBe("spyCap");
    const upkeep = (st: GameState) => (resolveTurn(ctx, st, {}).events.find((e) => e.type === "income" && e.player === "p1") as Extract<StepEvent, { type: "income" }>).upkeep;
    const without = upkeep(game());
    // Session 16 (Nate): at home, or guarding land you hold, a spy costs nothing.
    expect(upkeep(s) - without).toBe(0);
    // Travelling (sent somewhere, even through your own land) or inside land you don't hold: 1 gold a turn each.
    const away = game();
    place(away, "p1", "a", { target: "P2" });
    place(away, "p1", "i", { status: "in" });
    place(away, "p1", "e");
    place(away, "p1", "b");
    expect(upkeep(away) - without).toBe(3);
    expect(defaultRules.spies.upkeep).toBe(1);
    expect(defaultRules.spies.upkeepAtHome).toBe(0);
    // Broke: the spies' upkeep (while away) turns into unrest.
    const poor = game({ a: ["p1", 20] });
    for (let i = 0; i < 5; i++) place(poor, "p1", "i", { status: "in" });
    poor.players[0]!.gold = 0;
    const lean = ctxWith((r) => ((r.economy.capitalIncome = 0), (r.terrain.plains.income = 0)));
    const inc = resolveTurn(lean, poor, {}).events.find((e) => e.type === "income" && e.player === "p1") as Extract<StepEvent, { type: "income" }>;
    expect(inc.deserted).toBeGreaterThan(0);
  });

  it("with fog off there's nothing to spy on: spies can't be hired", () => {
    const s = game();
    s.settings.fog = false;
    expect(of(resolveTurn(ctx, s, { p1: [hire("a")] }).events, "fizzled")[0]!.reason).toBe("invalid");
  });
});

describe("spies: travel and its fog lift", () => {
  it("travels 2 territories a turn toward the province it's sent to, and lifts the fog 2 around it where nobody holds the province whole", () => {
    let s = game();
    const spy = place(s, "p1", "a", { status: "defend" });
    s = resolveTurn(ctx, s, { p1: [send(spy.id, "P3")] }).state;
    expect(s.spies[0]).toMatchObject({ at: "c", status: "travel", target: "P3" });
    // p1 sees a, b and c itself; its spy at c lifts the fog to e (2 around it).
    const v = viewFor(ctx, s, "p1");
    expect(v.territories.c).toMatchObject({ detail: "full" });
    expect((v.territories.c as { seenBy: string[] }).seenBy).not.toContain("spy");
    for (const t of ["d", "e"]) expect(v.territories[t]).toMatchObject({ detail: "full", seenBy: ["spy"], owner: null, troops: 1 });
    expect(v.territories.f!.detail).toBe("fogged");
    // ...and it goes into memory, as a sighting.
    expect(s.intel.p1!.e).toMatchObject({ owner: null, troops: 1, turn: s.turn });
    s = resolveTurn(ctx, s, {}).state;
    expect(s.spies[0]).toMatchObject({ at: "e" });
    s = resolveTurn(ctx, s, {}).state;
    // Arrived in P3 (g): it stays, still lifting the fog.
    expect(s.spies[0]).toMatchObject({ at: "g", target: null, status: "travel" });
    expect(viewFor(ctx, s, "p1").territories.i).toMatchObject({ detail: "full", seenBy: ["spy"], owner: "p2", troops: 6 });
  });

  it("other players never see your spies, and nothing about them reaches their view", () => {
    let s = game();
    const spy = place(s, "p1", "a");
    s = resolveTurn(ctx, s, { p1: [send(spy.id, "P4")] }).state;
    const v2 = viewFor(ctx, s, "p2");
    expect(v2.spies).toEqual([]);
    expect(JSON.stringify(v2)).not.toContain(spy.id);
    expect(viewFor(ctx, s, "p1").spies).toEqual([{ id: spy.id, at: "c", target: "P4", recalled: false, status: "travel" }]);
  });

  it("recall: the spy is back at your capital as the next turn starts", () => {
    let s = game();
    const spy = place(s, "p1", "e");
    const r = resolveTurn(ctx, s, { p1: [send(spy.id, null)] });
    expect(r.state.spies[0]).toMatchObject({ at: "a", status: "defend", recalled: false, target: null });
    const e = of(r.events, "spy")[0]!;
    expect(e).toMatchObject({ outcome: "home", territory: "a" });
    expect(spyLine(e, names)).toBe("Your spy is back at A.");
    s = r.state;
    expect(viewFor(ctx, s, "p1").territories.e!.detail).toBe("fogged");
  });
});

describe("spies: spy against spy", () => {
  /** p1 sends `attackers` spies into P4 (held whole by p2), which `defenders` of p2's spies guard. */
  function contest(defenders: number, attackers: number, seed = "spies") {
    const s = game({}, seed);
    for (let i = 0; i < defenders; i++) place(s, "p2", i % 2 ? "j" : "i", { status: "defend" });
    for (let i = 0; i < attackers; i++) place(s, "p1", "h", { target: "P4" });
    const r = resolveTurn(ctx, s, {});
    return { s, r, mine: of(r.events, "spy").filter((e) => e.player === "p1"), caught: of(r.events, "spyCaught") };
  }

  it.each([
    // [defenders, attackers, what happens]
    [0, 1, "in"],
    [1, 1, "blocked"],
    [2, 1, "killed"],
    [3, 1, "fooled"],
    [1, 2, "in"], // the design's example: 1 defender vs 2 spies = infiltrates
    [2, 2, "blocked"],
    [3, 2, "killed"], // the design's example: 3 defenders vs 2 spies = killed
    [2, 3, "in"], // the design's example: 2 defenders vs 3 spies = infiltrates
    [3, 3, "blocked"],
  ] as const)("%i defenders against %i spies: %s", (d, a, outcome) => {
    const { r, mine, caught } = contest(d, a);
    const attackers = r.state.spies.filter((x) => x.owner === "p1");
    if (outcome === "in" || outcome === "fooled") {
      // Fooled reads exactly like getting in: the same event, and the same status.
      expect(mine).toEqual([{ type: "spy", step: mine[0]!.step, player: "p1", spies: attackers.map((x) => x.id), province: "P4", outcome: "in", territory: "i" }]);
      expect(attackers.every((x) => x.status === "in" && x.fooled === (outcome === "fooled"))).toBe(true);
      expect(caught).toEqual([]);
      expect(spyLine(mine[0]!, names)).toBe(a === 1 ? "Your spy slipped into Province 4." : `Your ${a} spies slipped into Province 4.`);
    } else if (outcome === "blocked") {
      expect(mine[0]).toMatchObject({ outcome: "blocked" });
      expect(attackers).toHaveLength(a);
      expect(attackers.every((x) => x.at === "a")).toBe(true);
      expect(caught).toMatchObject([{ player: "p2", province: "P4", outcome: "blocked", spies: a }]);
    } else {
      expect(mine[0]).toMatchObject({ outcome: "killed" });
      expect(attackers).toEqual([]);
      expect(caught).toMatchObject([{ player: "p2", province: "P4", outcome: "killed", spies: a }]);
      expect(spyLine(caught[0]!, names)).toBe(`${a === 1 ? "A spy was" : `${a} spies were`} caught in Province 4 and killed.`);
    }
  });

  it("the defender is told when a spy is blocked or killed, never when one is fooled, and never whose it was", () => {
    const fooled = contest(3, 1);
    const p2 = replayFor(ctx, fooled.s, fooled.r, "p2");
    expect(p2.some((e) => e.type === "spy" || e.type === "spyCaught")).toBe(false);
    const killed = contest(2, 1);
    const seen = replayFor(ctx, killed.s, killed.r, "p2").filter((e) => e.type === "spyCaught");
    expect(seen).toHaveLength(1);
    expect(JSON.stringify(seen)).not.toContain("p1");
    // And p1's spy news reaches nobody else.
    expect(replayFor(ctx, killed.s, killed.r, "p2").some((e) => e.type === "spy")).toBe(false);
  });

  it("an infiltration lasts turn after turn, until the defence changes; then the contest runs again", () => {
    let { r } = contest(0, 1);
    let s = r.state;
    for (let i = 0; i < 3; i++) {
      r = resolveTurn(ctx, s, {});
      s = r.state;
      // Nothing new to say; the whole province stays in view every turn.
      expect(of(r.events, "spy")).toEqual([]);
      const v = viewFor(ctx, s, "p1");
      for (const t of ["i", "j"]) expect(v.territories[t]).toMatchObject({ detail: "full", seenBy: ["spy"], owner: "p2" });
    }
    // p2 stations a defender: 1 against 1, blocked: the spy comes home.
    place(s, "p2", "j", { status: "defend" });
    r = resolveTurn(ctx, s, {});
    expect(of(r.events, "spy")[0]).toMatchObject({ outcome: "blocked" });
    expect(r.state.spies.find((x) => x.owner === "p1")).toMatchObject({ at: "a", status: "defend" });
    // The province fogs over again, showing what the spy last reported.
    const v = viewFor(ctx, r.state, "p1");
    expect(v.territories.i).toMatchObject({ detail: "fogged", lastSeen: { owner: "p2" } });
  });

  it("only a player who holds a province whole can defend it; a province that stops being whole has no defence", () => {
    const s = game({ j: [null, 1] });
    place(s, "p2", "i", { status: "defend" });
    place(s, "p1", "h", { target: "P4" });
    const r = resolveTurn(ctx, s, {});
    expect(of(r.events, "spy")).toEqual([]);
    expect(r.state.spies.find((x) => x.owner === "p1")).toMatchObject({ at: "i", status: "travel" });
    expect(r.state.spies.find((x) => x.owner === "p2")).toMatchObject({ status: "travel" });
  });
});

describe("spies: what a fooled spy shows", () => {
  it("is close to the truth: the owner and buildings are right; troops, culture and Leaders are wrong or moved", () => {
    const s = game({ i: ["p2", 6], j: ["p2", 20] });
    s.territories.j!.building = "fort";
    s.territories.j!.culture = 2;
    s.players[1]!.leader = { alive: true, territory: "j" };
    for (let i = 0; i < 3; i++) place(s, "p2", "j", { status: "defend" });
    place(s, "p1", "h", { target: "P4" });
    const r = resolveTurn(ctx, s, {});
    expect(r.state.spies.find((x) => x.owner === "p1")!.fooled).toBe(true);
    const v = viewFor(ctx, r.state, "p1");
    const i = v.territories.i as Extract<typeof v.territories.i, { detail: "full" }>;
    const j = v.territories.j as Extract<typeof v.territories.j, { detail: "full" }>;
    expect([i.owner, j.owner, j.building, i.seenBy, j.seenBy]).toEqual(["p2", "p2", "fort", ["spy"], ["spy"]]);
    // Close: the troops are the same armies moved around and a little off (40% at most).
    const total = i.troops + j.troops;
    expect(total).toBeGreaterThanOrEqual(Math.floor(26 * 0.6));
    expect(total).toBeLessThanOrEqual(Math.ceil(26 * 1.4));
    expect(i.culture + j.culture).toBeGreaterThanOrEqual(1);
    expect(i.leaders.length + j.leaders.length).toBe(1);
    // Some of it is wrong (this seed): it's a false picture, not the truth.
    expect([i.troops, j.troops, i.culture, j.culture, j.leaders.length]).not.toEqual([6, 20, 0, 2, 1]);
    // It goes into memory exactly like a real sighting.
    expect(r.state.intel.p1!.j).toEqual({ owner: "p2", troops: j.troops, building: "fort", turn: r.state.turn });
  });

  it("is deterministic: the same game gives the same false picture", () => {
    const run = () => {
      const s = game({}, "same");
      for (let i = 0; i < 3; i++) place(s, "p2", "j", { status: "defend" });
      place(s, "p1", "h", { target: "P4" });
      let st = resolveTurn(ctx, s, {}).state;
      st = resolveTurn(ctx, st, {}).state;
      return [stateFingerprint(st), JSON.stringify(viewFor(ctx, st, "p1"))];
    };
    expect(run()).toEqual(run());
  });

  it("never leaks: a fooled view has exactly the shape of a real one, with nothing saying it's false", () => {
    const view = (defenders: number) => {
      const s = game();
      for (let i = 0; i < defenders; i++) place(s, "p2", "j", { status: "defend" });
      place(s, "p1", "h", { target: "P4" });
      const before = s;
      const r = resolveTurn(ctx, s, {});
      return { v: viewFor(ctx, r.state, "p1"), replay: replayFor(ctx, before, r, "p1") };
    };
    const real = view(0), fooled = view(3);
    const shape = (x: unknown): unknown => (Array.isArray(x) ? x.map(shape) : x && typeof x === "object" ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, shape(v)])) : typeof x);
    for (const t of ["i", "j"]) expect(shape(fooled.v.territories[t])).toEqual(shape(real.v.territories[t]));
    expect(shape(fooled.v.spies)).toEqual(shape(real.v.spies));
    const noId = (x: typeof real.v.spies) => x.map((y) => ({ ...y, id: "" }));
    expect(noId(fooled.v.spies)).toEqual(noId(real.v.spies));
    for (const text of [JSON.stringify(fooled.v), JSON.stringify(fooled.replay)]) for (const word of ["fooled", "holder", "defence", "forged"]) expect(text).not.toContain(word);
    // The spy's news and the replay's last word on the province look the same.
    const news = (x: typeof real.replay) => x.filter((e) => e.type === "spy").map((e) => ({ ...e, step: 0, spies: [] }));
    expect(news(fooled.replay)).toEqual(news(real.replay));
  });

  it("what you see directly always wins: land next to yours is shown as it truly is, so the odds preview can't be fooled", () => {
    // p1 holds up to h, next to P4: i borders it (direct sight); j only the (fooled) spy reports.
    const s = game({ c: ["p1", 2], d: ["p1", 2], e: ["p1", 2], f: ["p1", 2], g: ["p1", 2], h: ["p1", 30] });
    for (let i = 0; i < 3; i++) place(s, "p2", "j", { status: "defend" });
    place(s, "p1", "h", { target: "P4" });
    const r = resolveTurn(ctx, s, {});
    expect(r.state.spies.find((x) => x.owner === "p1")!.fooled).toBe(true);
    const v = viewFor(ctx, r.state, "p1");
    expect(v.territories.i).toMatchObject({ detail: "full", troops: r.state.territories.i!.troops });
    expect((v.territories.i as { seenBy: string[] }).seenBy).not.toContain("spy");
    expect(r.state.spyIntel.p1!.i).toBeUndefined();
    expect(v.territories.j).toMatchObject({ detail: "full", seenBy: ["spy"] });
  });
});

describe("spies: no effect on combat, saves and determinism", () => {
  it("spies never change a battle: the same attack rolls the same with or without them", () => {
    const fight = (withSpies: boolean) => {
      const s = game({ h: ["p1", 30] });
      s.settings.luck = 0.3;
      if (withSpies) for (let i = 0; i < 3; i++) place(s, "p1", "g");
      return of(resolveTurn(ctx, s, { p1: [mv("h", "i", 20)] }).events, "battle")[0]!.result;
    };
    expect(fight(true)).toEqual(fight(false));
  });

  it("a saved game with spies loads and plays on exactly as it would have", () => {
    let s = game();
    const spy = place(s, "p1", "a");
    const orders: OrdersByPlayer[] = [{ p1: [send(spy.id, "P4"), hire("a")] }, {}, {}, {}];
    s = resolveTurn(ctx, s, orders[0]!).state;
    const read = readSave(JSON.parse(JSON.stringify(makeSave(ctx, s, "p1", 0))));
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    let a = s, b = read.save.state;
    for (const o of orders.slice(1)) {
      a = resolveTurn(ctx, a, o).state;
      b = resolveTurn(ctx, b, o).state;
    }
    expect(stateFingerprint(b)).toBe(stateFingerprint(a));
    expect(a.spies.length).toBe(2);
  });

  it("a game saved before spies carries on with none (state version 5 -> 6)", () => {
    const s = game();
    const old = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    old.version = 5;
    for (const k of ["spies", "nextSpy", "spyIntel"]) delete old[k];
    delete (old.decks as Record<string, unknown>).spies;
    delete (old.settings as Record<string, unknown>).spies;
    const read = readSave(JSON.parse(JSON.stringify({ ...makeSave(ctx, s, "p1", 0), state: old })));
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const st = read.save.state;
    expect([st.version, st.spies, st.nextSpy, st.spyIntel, st.settings.spies]).toEqual([STATE_VERSION, [], 1, {}, true]);
    expect(st.decks.spies).toHaveLength(4);
    expect(of(resolveTurn(ctx, st, { p1: [hire("a")] }).events, "spyHired")).toHaveLength(1);
  });

  it("a knocked-out player's spies are gone", () => {
    const s = game({ a: ["p1", 1], b: [null, 1], h: ["p2", 40] });
    s.territories.b = { owner: "p2", troops: 30, specialists: [], building: null, construction: null, culture: 0 };
    place(s, "p1", "e");
    const r = resolveTurn(ctx, s, { p2: [mv("b", "a", "all")] });
    expect(r.state.players[0]!.eliminatedTurn).not.toBeNull();
    expect(r.state.spies).toEqual([]);
  });
});

describe("spies: the fog never leaks (property)", () => {
  it("random defences, armies and spy orders: views show only your own spies, spy reports only where you don't see, fooled reports keep the true owner and nothing says they're false", () => {
    let fooledSeen = 0, realSeen = 0;
    fc.assert(
      fc.property(
        fc.string(),
        fc.integer({ min: 0, max: 3 }),
        fc.integer({ min: 1, max: 3 }),
        fc.array(fc.integer({ min: 1, max: 30 }), { minLength: 4, maxLength: 4 }),
        fc.array(fc.integer({ min: 0, max: 3 }), { minLength: 3, maxLength: 3 }),
        (seed, defenders, attackers, troops, picks) => {
          const s0 = game({ i: ["p2", troops[0]!], j: ["p2", troops[1]!], k: ["p2", troops[2]!], l: ["p2", troops[3]!] }, `prop-${seed}`);
          s0.territories.j!.culture = picks[0]!;
          s0.territories.i!.specialists = [{ id: "s900", type: "healers" }];
          s0.players[1]!.leader = { alive: true, territory: picks[1]! % 2 ? "j" : "i" };
          for (let i = 0; i < defenders; i++) place(s0, "p2", i % 2 ? "j" : "i", { status: "defend" });
          for (let i = 0; i < attackers; i++) place(s0, "p1", "h", { target: "P4" });
          let s = s0;
          for (let turn = 0; turn < 3 && !s.winner; turn++) {
            const orders: OrdersByPlayer = { p1: turn === 1 && picks[2] === 0 ? s.spies.filter((x) => x.owner === "p1").map((x) => send(x.id, null)) : [], p2: [mv("l", "k", { share: 0.5 })] };
            const before = s;
            const r = resolveTurn(ctx, s, orders);
            s = r.state;
            for (const p of ["p1", "p2"]) {
              const v = viewFor(ctx, s, p);
              const json = JSON.stringify(v);
              for (const word of ["fooled", "holder", "defence", "forged", "spyIntel"]) expect(json).not.toContain(word);
              for (const spy of s.spies) if (spy.owner !== p) expect(json).not.toContain(`"${spy.id}"`);
              expect(v.spies.every((x) => Object.keys(x).join() === "id,at,target,recalled,status")).toBe(true);
              const direct = new Set(Object.entries(v.territories).filter(([, x]) => x.detail === "full" && !x.seenBy.includes("spy")).map(([t]) => t));
              for (const [t, x] of Object.entries(v.territories)) {
                if (x.detail !== "full" || !x.seenBy.includes("spy")) continue;
                expect(direct.has(t)).toBe(false);
                const truth = trueDetail(s, t);
                const fooledHere = s.spies.some((y) => y.owner === p && y.fooled && y.status === "in" && map.territories.find((d) => d.id === y.at)!.province === map.territories.find((d) => d.id === t)!.province);
                const { detail: _d, seenBy: _b, ...shown } = x;
                if (fooledHere) {
                  expect([shown.owner, shown.building, shown.capitalOf]).toEqual([truth.owner, truth.building, truth.capitalOf]);
                  fooledSeen++;
                } else {
                  expect(shown).toEqual(truth);
                  realSeen++;
                }
              }
              // What you see yourself is always the truth (so the odds preview can never be fooled).
              for (const t of direct) {
                const { detail: _d, seenBy: _b, ...shown } = v.territories[t] as Extract<(typeof v.territories)[string], { detail: "full" }>;
                expect(shown).toEqual(trueDetail(s, t));
              }
              // Spy news reaches only its owner (or, for a caught spy, only the defender).
              for (const e of replayFor(ctx, before, r, p)) if (e.type === "spy" || e.type === "spyCaught" || e.type === "spyHired") expect(e.player).toBe(p);
            }
          }
        },
      ),
      { numRuns: 120 },
    );
    expect(fooledSeen).toBeGreaterThan(10);
    expect(realSeen).toBeGreaterThan(10);
  });
});
