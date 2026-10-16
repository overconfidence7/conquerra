import { defaultRules, type FateEvent, type Rules } from "@conquerra/content";
import { MapDef } from "@conquerra/content/schemas";
import { describe, expect, it } from "vitest";
import { createGame, replayFor, resolveTurn, seedRng, stateFingerprint, viewFor, type GameContext, type GameState, type Mission, type OrdersByPlayer, type StepEvent } from "../src";
import { embervaleCtx, find, mv, player } from "./helpers";

/**
 * a - b - c ~ d - e - f (c~d is a river), provinces west (a, b, c) and east (d, e, f). p1 holds a, b, c (capital a),
 * p2 holds d, e, f (capital f).
 */
const map = MapDef.parse({
  id: "fate-line",
  name: "Fate line",
  minPlayers: 2,
  maxPlayers: 3,
  recommendedPlayers: { min: 2, max: 3 },
  territories: ["a", "b", "c", "d", "e", "f"].map((id, i) => ({ id, name: id.toUpperCase(), province: i < 3 ? "west" : "east", terrain: "plains", x: i * 100, y: 0 })),
  provinces: [
    { id: "west", name: "West", bonus: 2 },
    { id: "east", name: "East", bonus: 2 },
  ],
  borders: [
    { a: "a", b: "b" },
    { a: "b", b: "c" },
    { a: "c", b: "d", type: "river" },
    { a: "d", b: "e" },
    { a: "e", b: "f" },
  ],
  capitalSlots: ["a", "f", "c"],
});
const ctxWith = (f?: (r: Rules) => void): GameContext => {
  const rules = JSON.parse(JSON.stringify(defaultRules)) as Rules;
  // These tests check what each card does, from the first turn on (the real first draw waits; tested below).
  rules.fate.firstDrawTurn = 1;
  f?.(rules);
  return { map, rules };
};
/** Only this one Fate event in the deck (and no missions), so a test knows what lands. */
const onlyEvent = (id: string, missionShare = 0) =>
  ctxWith((r) => {
    r.fate.events = r.fate.events.filter((e) => e.id === id);
    r.fate.missionShare = missionShare;
  });

function game(ctx: GameContext, troops: Partial<Record<string, number>> = {}, settings: Partial<GameState["settings"]> = {}): GameState {
  const s = createGame(ctx, { gameId: "fate", seed: "fate", players: [{ id: "p1", name: "One" }, { id: "p2", name: "Two" }], settings: { luck: 0, spoils: false, ...settings } });
  const own: Record<string, string> = { a: "p1", b: "p1", c: "p1", d: "p2", e: "p2", f: "p2" };
  for (const [t, o] of Object.entries(own)) s.territories[t] = { owner: o, troops: troops[t] ?? 6, specialists: [], building: null, construction: null, culture: 0 };
  player(s, "p1").capital = "a";
  player(s, "p2").capital = "f";
  player(s, "p1").leader = { alive: true, territory: "a" };
  player(s, "p2").leader = { alive: true, territory: "f" };
  s.intel = { p1: {}, p2: {} };
  return s;
}
const fates = (ev: StepEvent[]) => ev.filter((e): e is Extract<StepEvent, { type: "fate" }> => e.type === "fate");

/** Many turns of a real 4-player Embervale game (bots off: nobody orders anything, so the Fate draws do all the work). */
function longGame(seed: string, turns = 30, settings: Partial<GameState["settings"]> = {}, ctx = embervaleCtx()) {
  let s = createGame(ctx, { gameId: seed, seed, players: ["p1", "p2", "p3", "p4"].map((id) => ({ id, name: id })), settings });
  const all: { before: GameState; events: StepEvent[]; after: GameState }[] = [];
  for (let i = 0; i < turns && !s.winner; i++) {
    const r = resolveTurn(ctx, s, {});
    all.push({ before: s, events: r.events, after: r.state });
    s = r.state;
  }
  return all;
}

describe("Fate: the draw", () => {
  it("everyone still in draws exactly one card a turn, as the turn ends (so it's there when planning starts)", () => {
    const first = defaultRules.fate.firstDrawTurn;
    expect(first).toBe(3);
    for (const t of longGame("one-each", 20)) {
      const drawers = t.events.flatMap((e) => (e.type === "fate" ? [e.drawer] : e.type === "missionDrawn" ? [e.player] : []));
      const living = t.after.players.filter((p) => p.eliminatedTurn === null).map((p) => p.id);
      // The opening turns stay quiet (Nate, Oct 6): no events and no missions before the end of turn 3.
      expect([...drawers].sort()).toEqual(t.before.turn < first ? [] : [...living].sort());
      // After every battle and order: a Fate event can't make a "guaranteed" attack fail.
      const lastOrder = Math.max(...t.events.filter((e) => e.type === "battle" || e.type === "moved" || e.type === "recruited").map((e) => e.step), -1);
      for (const e of t.events) if (e.type === "fate" || e.type === "missionDrawn") expect(e.step).toBeGreaterThan(lastOrder);
    }
  });

  it("about 7 in 10 are events and 3 in 10 missions (with room for missions)", () => {
    const ctx: GameContext = { map: embervaleCtx().map, rules: { ...defaultRules, fate: { ...defaultRules.fate, maxMissions: 1000 } } };
    let events = 0, missions = 0;
    for (const seed of ["s1", "s2", "s3", "s4"]) for (const t of longGame(seed, 25, {}, ctx)) for (const e of t.events) e.type === "fate" ? events++ : e.type === "missionDrawn" ? missions++ : 0;
    const share = missions / (events + missions);
    expect(events + missions).toBeGreaterThan(300);
    expect(share).toBeGreaterThan(0.24);
    expect(share).toBeLessThan(0.36);
  });

  it("at most 2 missions open at once: a third draw becomes an event", () => {
    for (const t of longGame("max-missions", 30)) for (const p of t.after.players) expect(p.missions.length).toBeLessThanOrEqual(defaultRules.fate.maxMissions);
  });

  it("is seeded and provably fair: the deck's own sequence from the secret seed; same seed, same draws; the dice unchanged", () => {
    const g = createGame(embervaleCtx(), { gameId: "x", seed: "fair-seed", players: ["p1", "p2"].map((id) => ({ id, name: id })) });
    expect(g.decks.fate).toEqual(seedRng("fair-seed|fate"));
    const draws = (seed: string) => longGame(seed, 8).flatMap((t) => t.events.filter((e) => e.type === "fate" || e.type === "missionDrawn"));
    expect(draws("same")).toEqual(draws("same"));
    expect(draws("same")).not.toEqual(draws("other"));
    // Turning Fate off doesn't touch the dice: the first turn's battles roll exactly the same.
    const ctx = embervaleCtx();
    const firstTurn = (fate: boolean) => {
      const s = createGame(ctx, { gameId: "d", seed: "dice", players: ["p1", "p2", "p3", "p4"].map((id) => ({ id, name: id })), settings: { fate } });
      const orders: OrdersByPlayer = {};
      for (const p of s.players) {
        const nb = ctx.map.borders.find((b) => b.a === p.capital || b.b === p.capital)!;
        orders[p.id] = [mv(p.capital, nb.a === p.capital ? nb.b : nb.a, 6)];
      }
      return resolveTurn(ctx, s, orders).events.flatMap((e) => (e.type === "battle" ? [[e.from, e.to, e.result, e.captured]] : []));
    };
    expect(firstTurn(false)).toEqual(firstTurn(true));
  });

  it("the lobby switch: with Fate off, no events and no missions", () => {
    for (const t of longGame("off", 15, { fate: false })) {
      expect(t.events.some((e) => e.type === "fate" || e.type === "missionDrawn")).toBe(false);
      expect(t.after.players.every((p) => p.missions.length === 0)).toBe(true);
    }
  });

  it("is deterministic: the same game twice ends in exactly the same place", () => {
    const end = (seed: string) => stateFingerprint(longGame(seed, 25).at(-1)!.after);
    expect(end("det")).toBe(end("det"));
  });
});

describe("Fate: the caps", () => {
  it("never on a capital, at most one Fate event per territory a turn, never knocks anyone out", () => {
    let n = 0;
    for (const seed of ["c1", "c2", "c3"])
      for (const t of longGame(seed, 30)) {
        const touched = new Set<string>();
        for (const e of fates(t.events)) {
          n++;
          for (const at of [e.at, ...e.land.map((l) => l.territory), ...(e.border ?? [])]) {
            expect(t.before.players.some((p) => p.eliminatedTurn === null && p.capital === at && t.before.territories[at]!.owner === p.id)).toBe(false);
          }
          expect(touched.has(e.at)).toBe(false);
          for (const l of [e.at, ...e.land.map((x) => x.territory), ...(e.border ?? [])]) touched.add(l);
        }
        expect(t.events.some((e) => e.type === "eliminated")).toBe(false);
      }
    expect(n).toBeGreaterThan(100);
  });

  it("culture protects: a fever kills fewer where the land is loyal", () => {
    const ctx = onlyEvent("fever");
    const lost = (culture: number) => {
      const s = game(ctx, { b: 20, c: 20, d: 20, e: 20 });
      for (const t of ["b", "c", "d", "e"]) s.territories[t]!.culture = culture;
      const r = resolveTurn(ctx, s, {});
      return fates(r.events).reduce((a, e) => a - (e.troops ?? 0), 0);
    };
    expect(lost(0)).toBe(2 * 5); // two draws, 25% of 20 each
    expect(lost(5)).toBeLessThan(lost(0));
  });

  it("all-or-nothing events are shrugged off with culture's chance (a fire never burns at the top level's 75%... most of the time)", () => {
    const ctx = onlyEvent("fire");
    let burnt = 0, shrugged = 0;
    for (let i = 0; i < 40; i++) {
      const s = game(ctx);
      s.decks.fate = seedRng(`fire-${i}`);
      for (const t of ["b", "c", "d", "e"]) (s.territories[t]!.construction = { building: "market", doneAtEndOfTurn: 5 }), (s.territories[t]!.culture = 5);
      for (const e of fates(resolveTurn(ctx, s, {}).events)) e.shrugged ? shrugged++ : burnt++;
    }
    expect(shrugged).toBeGreaterThan(burnt);
    expect(burnt).toBeGreaterThan(0);
  });

  it("an uprising never takes a player's last territory", () => {
    const ctx = onlyEvent("uprising");
    const s = game(ctx, { a: 2, b: 1, c: 1 });
    for (const t of ["b", "c"]) s.territories[t] = { owner: null, troops: 1, specialists: [], building: null, construction: null, culture: 0 };
    // p1 holds only its capital (never a target); p2's land is too strong.
    for (const t of ["d", "e"]) s.territories[t]!.troops = 9;
    const r = resolveTurn(ctx, s, {});
    expect(fates(r.events)).toHaveLength(0);
    expect(r.state.territories.a!.owner).toBe("p1");
  });
});

describe("Fate: what each event does (numbers from rules.fate)", () => {
  const strike = (id: string, setup?: (s: GameState) => void) => {
    const ctx = onlyEvent(id);
    const s = game(ctx);
    setup?.(s);
    const r = resolveTurn(ctx, s, {});
    return { r, e: fates(r.events), ev: ctx.rules.fate.events[0]! as FateEvent };
  };
  it("a harvest gives the holder gold; blight takes some", () => {
    const { e, ev } = strike("harvest");
    expect(e.every((x) => x.gold === (ev.effect === "gold" ? ev.amount : 0))).toBe(true);
    const b = strike("blight");
    expect(b.e.every((x) => (x.gold ?? 0) < 0)).toBe(true);
  });
  it("a wandering band joins whoever holds the land, neutral land too", () => {
    const { r, e } = strike("wanderers", (s) => (s.territories.c = { owner: null, troops: 1, specialists: [], building: null, construction: null, culture: 0 }));
    for (const x of e) expect(r.state.territories[x.at]!.troops).toBe(x.land[0]!.troops);
    expect(e.length).toBe(2);
  });
  it("master masons finish a building at once; fire burns one going up", () => {
    const m = strike("masons", (s) => (s.territories.b!.construction = { building: "fort", doneAtEndOfTurn: 9 }));
    expect(m.r.state.territories.b).toMatchObject({ building: "fort", construction: null });
    const f = strike("fire", (s) => (s.territories.e!.construction = { building: "barracks", doneAtEndOfTurn: 9 }));
    expect(f.r.state.territories.e).toMatchObject({ building: null, construction: null });
  });
  it("a flooded ford closes the river crossing for all of the next turn: everyone who can see it knows while planning, and orders across it can't go", () => {
    const { r, e } = strike("ford");
    expect(e[0]).toMatchObject({ border: ["c", "d"], until: 2 });
    expect(r.state.closures).toEqual([{ a: "c", b: "d", turn: 2 }]);
    const ctx = onlyEvent("ford");
    expect(viewFor(ctx, r.state, "p1").closures).toEqual([{ a: "c", b: "d", turn: 2 }]);
    const next = resolveTurn(ctx, r.state, { p1: [mv("c", "d", 3)] });
    expect(find(next.events, "fizzled")).toMatchObject({ reason: "storm" });
    // Over after that turn.
    expect(next.state.closures.filter((c) => c.turn < next.state.turn)).toEqual([]);
  });
  it("plague and the uprising are the Fallen's own world events", () => {
    const p = strike("plague", (s) => ["b", "c", "d", "e"].forEach((t) => (s.territories[t]!.troops = 12)));
    expect(p.e.length).toBeGreaterThan(0);
    expect(p.e.every((x) => (x.troops ?? 0) < 0)).toBe(true);
    const u = strike("uprising", (s) => ["b", "c", "d", "e"].forEach((t) => (s.territories[t]!.troops = 2)));
    expect(u.e.some((x) => x.flipped)).toBe(true);
    for (const x of u.e.filter((y) => y.flipped)) expect(u.r.state.territories[x.at]!.owner).toBeNull();
  });
});

describe("Fate: what players see", () => {
  it("the holder always sees it; others in full only if they can see the land, otherwise a surface detail with no names or numbers", () => {
    // A 3-player line: p3 sits far away and can't see b.
    const ctx = onlyEvent("harvest");
    const s = createGame(ctx, { gameId: "fog", seed: "fog", players: ["p1", "p2", "p3"].map((id) => ({ id, name: id })), settings: { luck: 0, spoils: false } });
    const own: Record<string, string | null> = { a: "p1", b: "p1", c: null, d: null, e: "p2", f: "p3" };
    for (const [t, o] of Object.entries(own)) s.territories[t] = { owner: o, troops: 4, specialists: [], building: null, construction: null, culture: 0 };
    s.players.forEach((p, i) => ((p.capital = ["a", "e", "f"][i]!), (p.leader = { alive: true, territory: p.capital })));
    s.intel = { p1: {}, p2: {}, p3: {} };
    const r = resolveTurn(ctx, s, {});
    const onB = fates(r.events).find((e) => e.at === "b");
    expect(onB).toBeDefined();
    expect(replayFor(ctx, s, r, "p1").some((e) => e.type === "fate" && e.at === "b")).toBe(true);
    const far = replayFor(ctx, s, r, "p3").filter((e) => e.type === "surface" && e.what === "fate");
    expect(far.length).toBeGreaterThan(0);
    for (const x of far) expect(Object.keys(x).sort()).toEqual(["province", "step", "type", "what", ...("yours" in x ? ["yours"] : [])].sort());
    expect(JSON.stringify(replayFor(ctx, s, r, "p3"))).not.toContain('"at":"b"');
  });

  it("missions are yours alone: others never see them", () => {
    const all = longGame("secret", 12);
    const t = all.at(-1)!;
    const somebody = t.after.players.find((p) => p.missions.length)!;
    expect(somebody).toBeDefined();
    for (const p of t.after.players) if (p.id !== somebody.id) expect(JSON.stringify(viewFor(embervaleCtx(), t.after, p.id))).not.toContain(somebody.missions[0]!.id + '"');
  });
});

describe("Fate: missions complete, lapse and pay out", () => {
  // No new missions drawn, and the only event (a rockslide) can't land on this map (it has no pass): the board stays put.
  const ctx = onlyEvent("rockslide");
  const withMission = (m: Omit<Mission, "id">, troops: Partial<Record<string, number>> = {}) => {
    const s = game(ctx, troops, { fate: true });
    player(s, "p1").missions = [{ id: "m99", ...m }];
    return s;
  };
  const done = (ev: StepEvent[]) => ev.find((e) => e.type === "missionDone");
  const failed = (ev: StepEvent[]) => ev.find((e) => e.type === "missionFailed");

  it("take land in a province: pays its gold the turn you do", () => {
    const s = withMission({ card: "takeIn", kind: "takeIn", deadline: 3, province: "east", reward: { gold: 8 } }, { c: 20, d: 1 });
    const gold = player(s, "p1").gold;
    const r = resolveTurn(ctx, s, { p1: [mv("c", "d", 15)] });
    expect(r.state.territories.d!.owner).toBe("p1");
    expect(done(r.events)).toMatchObject({ player: "p1", gold: 8 });
    expect(player(r.state, "p1").missions).toEqual([]);
    const inc = r.events.find((e) => e.type === "income" && e.player === "p1");
    expect(player(r.state, "p1").gold).toBe((inc?.type === "income" ? inc.goldAfter : gold) + 8);
  });

  it("win a battle across a river: pays when you do (a pass mission's Siege joins the army at your capital)", () => {
    const s = withMission({ card: "crossPass", kind: "cross", deadline: 3, border: "river", reward: { specialist: "siege" } }, { c: 20, d: 1 });
    const r = resolveTurn(ctx, s, { p1: [mv("c", "d", 15)] });
    expect(done(r.events)).toBeDefined();
    expect(r.state.territories.a!.specialists.map((x) => x.type)).toEqual(["siege"]);
  });

  it("lapses when the deadline passes", () => {
    let s = withMission({ card: "takeIn", kind: "takeIn", deadline: 2, province: "east", reward: { gold: 8 } });
    s = resolveTurn(ctx, s, {}).state;
    expect(player(s, "p1").missions).toHaveLength(1);
    const r = resolveTurn(ctx, s, {});
    expect(failed(r.events)).toMatchObject({ why: "expired" });
    expect(player(r.state, "p1").missions).toEqual([]);
  });

  it("hold land: pays culture there if you still hold it at the deadline; fails the moment it's lost", () => {
    let s = withMission({ card: "hold", kind: "hold", deadline: 2, territory: "c", reward: { culture: 1 } });
    s = resolveTurn(ctx, s, {}).state;
    const r = resolveTurn(ctx, s, {});
    expect(done(r.events)).toBeDefined();
    expect(r.state.territories.c!.culture).toBe(1);
    const lose = withMission({ card: "hold", kind: "hold", deadline: 3, territory: "c", reward: { culture: 1 } }, { c: 1, d: 20 });
    const r2 = resolveTurn(ctx, lose, { p2: [mv("d", "c", 15)] });
    expect(failed(r2.events)).toMatchObject({ why: "lost" });
  });

  it("lose no land: pays at the deadline; a taken territory ends it", () => {
    let s = withMission({ card: "noLoss", kind: "noLoss", deadline: 2, reward: { gold: 6 } });
    s = resolveTurn(ctx, s, {}).state;
    expect(done(resolveTurn(ctx, s, {}).events)).toMatchObject({ gold: 6 });
    const r = resolveTurn(ctx, withMission({ card: "noLoss", kind: "noLoss", deadline: 2, reward: { gold: 6 } }, { c: 1, d: 20 }), { p2: [mv("d", "c", 15)] });
    expect(failed(r.events)).toMatchObject({ why: "lost" });
  });

  it("a spree counts the land you take across turns", () => {
    let s = withMission({ card: "spree", kind: "spree", deadline: 4, need: 2, progress: 0, reward: { gold: 10 } }, { c: 30, d: 1, e: 1, f: 1 });
    let r = resolveTurn(ctx, s, { p1: [mv("c", "d", 20)] });
    expect(player(r.state, "p1").missions[0]).toMatchObject({ progress: 1 });
    s = r.state;
    s.territories.e!.troops = 1;
    r = resolveTurn(ctx, s, { p1: [mv("d", "e", 15)] });
    expect(done(r.events)).toMatchObject({ gold: 10 });
  });

  it("build a fort, raise culture, hold a whole province", () => {
    const f = resolveTurn(ctx, withMission({ card: "fort", kind: "fort", deadline: 3, territory: "c", reward: { troops: 4 } }), { p1: [{ id: "b1", kind: "build", territory: "c", building: "fort" }] });
    expect(done(f.events)).toBeDefined();
    expect(f.state.territories.c!.troops).toBe(6 + 4);
    const c = resolveTurn(ctx, withMission({ card: "culture", kind: "culture", deadline: 3, province: "west", reward: { culture: 1 } }), { p1: [{ id: "i1", kind: "invest", territory: "b" }] });
    expect(done(c.events)).toBeDefined();
    expect(c.state.territories.b!.culture).toBe(2);
    const w = resolveTurn(ctx, withMission({ card: "whole", kind: "whole", deadline: 3, province: "west", reward: { gold: 10 } }), {});
    expect(done(w.events)).toMatchObject({ gold: 10 });
  });
});
