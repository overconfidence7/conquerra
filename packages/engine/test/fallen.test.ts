import { defaultRules, type Rules } from "@conquerra/content";
import { MapDef } from "@conquerra/content/schemas";
import { describe, expect, it } from "vitest";
import { createGame, replayFor, resolveTurn, viewFor, type GameContext, type GameState, type Order, type WorldEventKind } from "../src";
import { find, mv } from "./helpers";

/**
 * a - b - c - d - e - f, one province "west" (a, b, c) and one "east" (d, e, f). p1 (capital a) holds a, b, c;
 * p2 (capital f) holds d, e, f; p3 and p4 are already out (the Fallen).
 */
const map = MapDef.parse({
  id: "fallen-line",
  name: "Fallen line",
  minPlayers: 2,
  maxPlayers: 4,
  recommendedPlayers: { min: 2, max: 4 },
  territories: ["a", "b", "c", "d", "e", "f"].map((id, i) => ({ id, name: id.toUpperCase(), province: i < 3 ? "west" : "east", terrain: "plains", x: i * 100, y: 0 })),
  provinces: [
    { id: "west", name: "West", bonus: 2 },
    { id: "east", name: "East", bonus: 2 },
  ],
  borders: ["ab", "bc", "cd", "de", "ef"].map(([a, b]) => ({ a: a!, b: b! })),
  capitalSlots: ["a", "f", "c", "d"],
});
const ctxWith = (f?: (r: Rules) => void): GameContext => {
  const rules = JSON.parse(JSON.stringify(defaultRules)) as Rules;
  f?.(rules);
  return { map, rules };
};
const ctx = ctxWith();
const cfg = ctx.rules.fallen;

function game(influence = 30, extra: Partial<GameState["settings"]> = {}): GameState {
  const s = createGame(ctx, { gameId: "fallen", seed: "fallen", players: ["p1", "p2", "p3", "p4"].map((id) => ({ id, name: id.toUpperCase() })), settings: { luck: 0, ...extra } });
  const own: Record<string, string> = { a: "p1", b: "p1", c: "p1", d: "p2", e: "p2", f: "p2" };
  for (const [t, o] of Object.entries(own)) s.territories[t] = { owner: o, troops: 8, specialists: [], building: null, construction: null, culture: 0 };
  const caps: Record<string, string> = { p1: "a", p2: "f", p3: "c", p4: "d" };
  for (const p of s.players) {
    p.capital = caps[p.id]!;
    p.leader = { alive: p.id === "p1" || p.id === "p2", territory: p.id === "p1" ? "a" : p.id === "p2" ? "f" : null };
    if (p.id === "p3" || p.id === "p4") (p.eliminatedTurn = 1, (p.influence = influence));
  }
  s.intel = Object.fromEntries(s.players.map((p) => [p.id, {}]));
  return s;
}
const ev = (event: WorldEventKind, target: string, influence: number, across?: string): Order => ({ id: `${event}-${target}`, kind: "worldEvent", event, target, influence, ...(across ? { across } : {}) });
const inf = (s: GameState, p: string) => s.players.find((x) => x.id === p)!.influence;

describe("the Fallen: Influence", () => {
  it("each of the Fallen earns Influence every turn, more the more Fallen there are", () => {
    const r = resolveTurn(ctx, game(0), {});
    const each = cfg.influenceBase + cfg.influencePerOtherFallen * 1;
    expect(inf(r.state, "p3")).toBe(each);
    expect(inf(r.state, "p4")).toBe(each);
    expect(inf(r.state, "p1")).toBe(0);
  });

  it("several Fallen can pool Influence for one event (and a bigger one); alone and short, nothing happens and nothing is spent", () => {
    const half = Math.ceil(cfg.events.plague.cost / 2);
    const alone = resolveTurn(ctx, game(), { p3: [ev("plague", "e", half)] });
    expect(find(alone.events, "worldEvent")).toBeUndefined();
    expect(find(alone.events, "worldEventFailed")).toMatchObject({ player: "p3", event: "plague", reason: "cost" });
    expect(inf(alone.state, "p3")).toBe(30 + cfg.influenceBase + cfg.influencePerOtherFallen);
    const pooled = resolveTurn(ctx, game(), { p3: [ev("plague", "e", half)], p4: [ev("plague", "e", half)] });
    const e = find(pooled.events, "worldEvent")!;
    expect(e).toMatchObject({ event: "plague", against: "p2", by: ["p3", "p4"], spent: half * 2 });
    // Bigger: double the cost hits harder than the cost alone (up to maxStrength).
    const small = find(resolveTurn(ctx, game(), { p3: [ev("plague", "e", cfg.events.plague.cost)] }).events, "worldEvent")!;
    const big = find(resolveTurn(ctx, game(), { p3: [ev("plague", "e", cfg.events.plague.cost)], p4: [ev("plague", "e", cfg.events.plague.cost)] }).events, "worldEvent")!;
    const lost = (x: typeof small) => x.losses!.reduce((a, l) => a + l.troops, 0);
    expect(lost(big)).toBeGreaterThan(lost(small));
    expect(big.spent).toBe(Math.floor(cfg.events.plague.cost * cfg.maxStrength));
  });

  it("the living can't play world events", () => {
    const r = resolveTurn(ctx, game(), { p1: [ev("famine", "e", 20)] });
    expect(r.events.some((e) => e.type === "worldEvent" || e.type === "worldEventFailed")).toBe(false);
  });
});

describe("the Fallen: every cap holds", () => {
  it("no event touches a capital", () => {
    for (const kind of ["plague", "uprising", "mercenaries", "famine"] as const) {
      const r = resolveTurn(ctx, game(), { p3: [ev(kind, "f", 25)] });
      expect(find(r.events, "worldEventFailed")).toMatchObject({ reason: "capital" });
    }
    expect(find(resolveTurn(ctx, game(), { p3: [ev("storm", "e", 25, "f")] }).events, "worldEventFailed")).toMatchObject({ reason: "capital" });
  });

  it("plague never takes the garrison, spares the capital, and stays in its province", () => {
    const s = game();
    const r = resolveTurn(ctx, s, { p3: [ev("plague", "e", 25)] });
    const e = find(r.events, "worldEvent")!;
    expect(e.losses!.map((l) => l.territory).sort()).toEqual(["d", "e"]);
    for (const l of e.losses!) expect(s.territories[l.territory]!.troops - l.troops).toBeGreaterThanOrEqual(ctx.rules.setup.minGarrison);
  });

  it("an uprising never knocks a player out (never their last territory) and only rises against a thin garrison", () => {
    const s = game();
    s.territories.e!.troops = 2;
    const r = resolveTurn(ctx, s, { p3: [ev("uprising", "e", 25)] });
    expect(find(r.events, "worldEvent")).toMatchObject({ event: "uprising", flipped: true });
    expect(r.state.territories.e!.owner).toBeNull();
    // Land the rebels take loses its culture, as on any change of hands (session 16).
    const cultured = game();
    cultured.territories.e!.troops = 1;
    cultured.territories.e!.culture = 1;
    const rc = resolveTurn(ctx, cultured, { p3: [ev("uprising", "e", 25)] });
    if (find(rc.events, "worldEvent")?.flipped) expect(rc.state.territories.e!.culture).toBe(0);
    const strong = game();
    strong.territories.e!.troops = cfg.events.uprising.maxTroops + 1;
    expect(find(resolveTurn(ctx, strong, { p3: [ev("uprising", "e", 25)] }).events, "worldEventFailed")).toMatchObject({ reason: "tooStrong" });
    // p2 down to one territory (not its capital).
    const last = game();
    for (const t of ["d", "f"]) last.territories[t]!.owner = "p1";
    last.territories.e!.troops = 1;
    expect(find(resolveTurn(ctx, last, { p3: [ev("uprising", "e", 25)] }).events, "worldEventFailed")).toMatchObject({ reason: "lastLand" });
  });

  it("at most one event lands on each living player per turn (the other's Influence isn't spent)", () => {
    const r = resolveTurn(ctx, game(), { p3: [ev("plague", "e", 20)], p4: [ev("famine", "d", 20)] });
    expect(r.events.filter((e) => e.type === "worldEvent")).toHaveLength(1);
    expect(find(r.events, "worldEventFailed")).toMatchObject({ player: "p4", reason: "alreadyHit" });
    expect(inf(r.state, "p4")).toBe(30 + cfg.influenceBase + cfg.influencePerOtherFallen);
  });

  it("each event rests for its cooldown", () => {
    const r1 = resolveTurn(ctx, game(), { p3: [ev("famine", "e", 20)] });
    expect(r1.state.eventCooldowns.famine).toBe(cfg.events.famine.cooldown - 1);
    const r2 = resolveTurn(ctx, r1.state, { p4: [ev("famine", "b", 20)] });
    expect(find(r2.events, "worldEventFailed")).toMatchObject({ reason: "cooldown" });
    let s = r2.state;
    for (let i = 0; i < cfg.events.famine.cooldown; i++) s = resolveTurn(ctx, s, {}).state;
    expect(find(resolveTurn(ctx, s, { p4: [ev("famine", "b", 20)] }).events, "worldEvent")).toBeDefined();
  });

  it("culture protects: each level blocks its share of the effect", () => {
    const plain = game();
    const loyal = game();
    for (const t of ["d", "e"]) loyal.territories[t]!.culture = 3;
    const lost = (s: GameState) => find(resolveTurn(ctx, s, { p3: [ev("plague", "e", 12)] }).events, "worldEvent")!.losses!.reduce((a, l) => a + l.troops, 0);
    expect(lost(loyal)).toBeLessThan(lost(plain));
    const f = (culture: number) => {
      const s = game();
      s.territories.f!.culture = culture;
      return find(resolveTurn(ctx, s, { p3: [ev("famine", "e", 8)] }).events, "worldEvent")!.cut!;
    };
    expect(f(4)).toBeCloseTo(f(0) * (1 - 4 * ctx.rules.culture.protectionPerLevel), 2);
  });
});

describe("the Fallen: what each event does", () => {
  it("a storm closes one border for the turn: moves across it don't happen", () => {
    const r = resolveTurn(ctx, game(), { p3: [ev("storm", "c", 10, "d")], p1: [mv("c", "d", "all")] });
    expect(find(r.events, "worldEvent")).toMatchObject({ event: "storm", border: ["c", "d"] });
    expect(find(r.events, "fizzled")).toMatchObject({ player: "p1", reason: "storm" });
    expect(r.state.territories.d!.owner).toBe("p2");
  });

  it("mercenaries: a neutral army appears next to the land", () => {
    const s = game();
    s.territories.e = { owner: null, troops: 1, specialists: [], building: null, construction: null, culture: 0 };
    const r = resolveTurn(ctx, s, { p3: [ev("mercenaries", "d", 9)] });
    const e = find(r.events, "worldEvent")!;
    expect(e).toMatchObject({ event: "mercenaries", at: "e" });
    expect(r.state.territories.e!.troops).toBe(1 + e.troops!);
  });

  it("famine cuts that player's income this turn", () => {
    const plain = resolveTurn(ctx, game(), {});
    const hit = resolveTurn(ctx, game(), { p3: [ev("famine", "e", 8)] });
    const gold = (r: typeof plain) => r.state.players.find((p) => p.id === "p2")!.gold;
    expect(gold(hit)).toBeLessThan(gold(plain));
    expect(find(hit.events, "income")).toBeDefined();
    expect(hit.events.find((e) => e.type === "income" && e.player === "p2")).toMatchObject({ famine: gold(plain) - gold(hit) });
  });
});

describe("the Fallen: fog and fairness", () => {
  it("an event on your own land is always reported; someone else's only if you can see where it happened", () => {
    const s = game();
    // p1 sees only up to d (next to its own c).
    const r = resolveTurn(ctx, s, { p3: [ev("famine", "f", 0)], p4: [ev("plague", "e", 12)] });
    expect(replayFor(ctx, s, r, "p2").some((e) => e.type === "worldEvent")).toBe(true);
    expect(replayFor(ctx, s, r, "p1").some((e) => e.type === "worldEvent")).toBe(false);
    const near = resolveTurn(ctx, s, { p4: [ev("plague", "d", 12)] });
    expect(replayFor(ctx, s, near, "p1").some((e) => e.type === "worldEvent")).toBe(true);
    // The Fallen see every world event (and never a battle's numbers).
    const watch = replayFor(ctx, s, resolveTurn(ctx, s, { p4: [ev("plague", "e", 12)], p1: [mv("c", "d", "all")] }), "p3");
    expect(watch.some((e) => e.type === "worldEvent")).toBe(true);
    expect(watch.some((e) => e.type === "battle" || e.type === "moved")).toBe(false);
  });

  it("is deterministic: the same game and orders give exactly the same turn", () => {
    const orders = { p3: [ev("plague", "e", 6)], p4: [ev("plague", "e", 6), ev("storm", "b", 6, "c")], p1: [mv("c", "d", "all")] };
    expect(JSON.stringify(resolveTurn(ctx, game(), orders))).toBe(JSON.stringify(resolveTurn(ctx, game(), orders)));
  });

  it("switched off, knocked-out players earn nothing and play nothing", () => {
    const r = resolveTurn(ctx, game(30, { fallen: false }), { p3: [ev("famine", "e", 20)] });
    expect(r.events.some((e) => e.type === "worldEvent" || e.type === "worldEventFailed")).toBe(false);
    expect(inf(r.state, "p3")).toBe(30);
    expect(viewFor(ctx, r.state, "p3").territories.a!.detail).toBe("full");
  });
});

describe("the Fallen from their first turn out (session 19)", () => {
  it("a player knocked out this turn starts with enough Influence for one of the cheaper events, and can play it straight away", () => {
    // p2 holds only f (its capital); p1 takes it with a big army. p3 is still in (holding c), so the game goes on.
    const s = game(0);
    for (const t of ["d", "e"]) s.territories[t] = { owner: "p1", troops: 30, specialists: [], building: null, construction: null, culture: 0 };
    s.territories.c = { owner: "p3", troops: 8, specialists: [], building: null, construction: null, culture: 0 };
    s.players.find((p) => p.id === "p3")!.eliminatedTurn = null;
    s.territories.f!.troops = 1;
    const r = resolveTurn(ctx, s, { p1: [mv("e", "f", 29)] });
    const p2 = r.state.players.find((p) => p.id === "p2")!;
    expect(p2.eliminatedTurn).toBe(s.turn);
    // Its start, plus the turn's own Influence (two Fallen now: p2 and p4).
    expect(p2.influence).toBe(cfg.startInfluence + cfg.influenceBase + cfg.influencePerOtherFallen);
    const cheap = (["storm", "famine", "mercenaries"] as const).filter((k) => cfg.events[k].cost <= p2.influence);
    expect(cheap.length).toBeGreaterThanOrEqual(2);
    // Its very first turn out: a famine on p1 lands.
    const next = resolveTurn(ctx, r.state, { p2: [ev("famine", "b", cfg.events.famine.cost)] });
    expect(find(next.events, "worldEvent")).toMatchObject({ event: "famine", against: "p1", by: ["p2"] });
  });

  it("with the Fallen switched off, a knocked-out player gets no Influence", () => {
    const s = game(0, { fallen: false });
    for (const t of ["d", "e"]) s.territories[t] = { owner: "p1", troops: 30, specialists: [], building: null, construction: null, culture: 0 };
    s.territories.c = { owner: "p3", troops: 8, specialists: [], building: null, construction: null, culture: 0 };
    s.players.find((p) => p.id === "p3")!.eliminatedTurn = null;
    s.territories.f!.troops = 1;
    const r = resolveTurn(ctx, s, { p1: [mv("e", "f", 29)] });
    expect(r.state.players.find((p) => p.id === "p2")!.influence).toBe(0);
  });
});
