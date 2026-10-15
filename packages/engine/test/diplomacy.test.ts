import { defaultRules, MapDef, type Rules } from "@conquerra/content";
import { describe, expect, it } from "vitest";
import {
  STATE_VERSION,
  bindingCost,
  createGame,
  dealLine,
  dealSize,
  explainFizzle,
  indexMap,
  makeSave,
  oathPenalty,
  readSave,
  replayFor,
  replaySavedGame,
  resolveTurn,
  stateFingerprint,
  TurnVision,
  viewFor,
  type DealTerms,
  type GameContext,
  type GameState,
  type Offer,
  type Order,
  type OrdersByPlayer,
  type StepEvent,
} from "../src";
import { mv, player } from "./helpers";

/**
 * A 2 x 4 grid, two provinces:
 *   a1 a2 | a3 a4        west: a1 a2 b1 b2
 *   b1 b2 | b3 b4        east: a3 a4 b3 b4
 * Capitals: p1 a1, p2 a4, p3 b2.
 */
const map = MapDef.parse({
  id: "grid",
  name: "Grid",
  minPlayers: 2,
  maxPlayers: 3,
  recommendedPlayers: { min: 2, max: 3 },
  territories: ["a1", "a2", "a3", "a4", "b1", "b2", "b3", "b4"].map((id) => ({
    id,
    name: id.toUpperCase(),
    province: Number(id[1]) <= 2 ? "west" : "east",
    terrain: "plains",
    x: Number(id[1]) * 100,
    y: id[0] === "a" ? 0 : 100,
  })),
  provinces: [
    { id: "west", name: "West", bonus: 2 },
    { id: "east", name: "East", bonus: 2 },
  ],
  borders: [
    { a: "a1", b: "a2" },
    { a: "a2", b: "a3" },
    { a: "a3", b: "a4" },
    { a: "b1", b: "b2" },
    { a: "b2", b: "b3" },
    { a: "b3", b: "b4" },
    { a: "a1", b: "b1" },
    { a: "a2", b: "b2" },
    { a: "a3", b: "b3" },
    { a: "a4", b: "b4" },
  ],
  capitalSlots: ["a1", "a4", "b2"],
});
const ctxWith = (f?: (r: Rules) => void): GameContext => {
  const rules = JSON.parse(JSON.stringify(defaultRules)) as Rules;
  f?.(rules);
  return { map, rules };
};
const ctx = ctxWith();
const idx = indexMap(map);

type Spot = [owner: string | null, troops: number, culture?: number];
/** p1, p2 and p3 on the grid. Default: p1 west top + b1, p2 east, p3 at b2. */
function game(layout: Record<string, Spot> = {}, players = 3, settings: Partial<GameState["settings"]> = {}): GameState {
  const ids = ["p1", "p2", "p3"].slice(0, players);
  const s = createGame(ctx, { gameId: "dip", seed: "dip", players: ids.map((id) => ({ id, name: id.toUpperCase() })), settings: { luck: 0, fate: false, spoils: false, fallen: false, ...settings } });
  const base: Record<string, Spot> = { a1: ["p1", 6], a2: ["p1", 6], b1: ["p1", 6], a3: ["p2", 6], a4: ["p2", 6], b3: ["p2", 6], b4: ["p2", 6], b2: players === 3 ? ["p3", 6] : ["p1", 6] };
  for (const [t, [owner, troops, culture = 0]] of Object.entries({ ...base, ...layout }))
    s.territories[t] = { owner, troops, specialists: [], building: null, construction: null, culture };
  const caps: Record<string, string> = { p1: "a1", p2: "a4", p3: "b2" };
  for (const p of s.players) {
    p.capital = caps[p.id]!;
    p.leader = { alive: true, territory: caps[p.id]! };
    p.gold = 50;
  }
  s.intel = Object.fromEntries(s.players.map((p) => [p.id, {}]));
  return s;
}

let n = 0;
const offer = (from: string, to: string, terms: DealTerms, bond: Offer["bond"] = "handshake", id = `x${++n}`): Offer => ({ id, from, to, terms, bond });
const propose = (o: Offer): Order => ({ id: `p-${o.id}`, kind: "propose", offer: o });
const accept = (o: Offer, yes = true): Order => ({ id: `a-${o.id}`, kind: "answer", from: o.from, offer: o.id, accept: yes });
/** Orders for a deal both sides confirm this turn, plus anything else each side orders. */
function agreed(o: Offer, extra: OrdersByPlayer = {}): OrdersByPlayer {
  return { ...extra, [o.from]: [propose(o), ...(extra[o.from] ?? [])], [o.to]: [accept(o), ...(extra[o.to] ?? [])] };
}
const truce = (turns = 3, scope: Extract<DealTerms, { kind: "truce" }>["scope"] = { kind: "all" }, until?: string): DealTerms => ({ kind: "truce", scope, turns, ...(until ? { until } : {}) });
const of = <T extends StepEvent["type"]>(ev: readonly StepEvent[], type: T) => ev.filter((e): e is Extract<StepEvent, { type: T }> => e.type === type);

/** The replay's own board after the turn (worked out from the start and the event log) matches the real game. */
function replayMatches(before: GameState, r: { state: GameState; events: StepEvent[] }) {
  const tv = new TurnVision(ctx, before, r.events, []);
  for (const e of r.events) tv.step(e);
  for (const t of idx.ids) expect({ t, owner: tv.board.territories[t]!.owner, troops: tv.board.territories[t]!.troops }).toEqual({ t, owner: r.state.territories[t]!.owner, troops: r.state.territories[t]!.troops });
  for (const p of r.state.players) expect({ p: p.id, gold: tv.board.players.find((x) => x.id === p.id)!.gold }).toEqual({ p: p.id, gold: p.gold });
}

describe("diplomacy: the re-confirm rule", () => {
  it("a deal starts only if both sides confirm in the same planning phase, as the turn resolves, before any move", () => {
    const s = game();
    const o = offer("p1", "p2", truce());
    const r = resolveTurn(ctx, s, agreed(o, { p2: [mv("a3", "a2", "all")] }));
    const started = of(r.events, "dealStarted")[0]!;
    expect(started.deal).toMatchObject({ a: "p1", b: "p2", bond: "handshake", start: 1, last: 3 });
    // Before any move: p2's attack the same turn came after it, so it broke the truce.
    const firstMove = r.events.findIndex((e) => e.type === "battle" || e.type === "moved");
    expect(started.step).toBeLessThan(firstMove);
    expect(of(r.events, "dealBroken")[0]).toMatchObject({ by: "p2", how: "attack", at: "a2" });
  });

  it("an offer nobody confirmed lapses as the turn resolves (only the two sides hear of it)", () => {
    const s = game();
    const o = offer("p1", "p2", truce());
    const r = resolveTurn(ctx, s, { p1: [propose(o)] });
    expect(r.state.deals).toEqual([]);
    expect(of(r.events, "offerLapsed")).toMatchObject([{ offer: { id: o.id }, why: "unanswered" }]);
    expect(replayFor(ctx, s, r, "p2").some((e) => e.type === "offerLapsed")).toBe(true);
    expect(replayFor(ctx, s, r, "p3").some((e) => e.type === "offerLapsed")).toBe(false);
    // Declined: it lapses as declined.
    const d = resolveTurn(ctx, s, { p1: [propose(o)], p2: [accept(o, false)] });
    expect(of(d.events, "offerLapsed")[0]!.why).toBe("declined");
    // An answer to an offer that isn't on the table this turn (last turn's, say) does nothing.
    const late = resolveTurn(ctx, r.state, { p2: [accept(o)] });
    expect(late.state.deals).toEqual([]);
    expect(of(late.events, "dealStarted")).toEqual([]);
  });

  it("an attack between the two players during the replay voids every open offer between them", () => {
    const s = game();
    const a = offer("p1", "p2", truce());
    const b = offer("p2", "p1", { kind: "trade", give: { gold: 5 }, get: {} });
    const c = offer("p1", "p3", truce());
    const r = resolveTurn(ctx, s, { p1: [propose(a), propose(c)], p2: [propose(b), mv("a3", "a2", 2)] });
    const lapsed = of(r.events, "offerLapsed");
    expect(lapsed.find((e) => e.offer.id === a.id)!.why).toBe("voided");
    expect(lapsed.find((e) => e.offer.id === b.id)!.why).toBe("voided");
    expect(lapsed.find((e) => e.offer.id === c.id)!.why).toBe("unanswered");
  });

  it("the Fallen and knocked-out players don't make deals, and an offer that no longer makes sense fails with its reason", () => {
    const s = game();
    player(s, "p3").eliminatedTurn = 0;
    s.territories.b2 = { owner: "p1", troops: 3, specialists: [], building: null, construction: null, culture: 0 };
    // An offer to one of the Fallen goes nowhere, and one from them is never on the table.
    const o = offer("p1", "p3", truce());
    const r = resolveTurn(ctx, s, agreed(o));
    expect(r.state.deals).toEqual([]);
    expect(of(r.events, "dealStarted")).toEqual([]);
    const from = offer("p3", "p1", truce());
    expect(resolveTurn(ctx, s, agreed(from)).state.deals).toEqual([]);
    // A truce too long for the rules.
    const long = offer("p1", "p2", truce(9));
    expect(of(resolveTurn(ctx, game(), agreed(long)).events, "dealFailed")[0]!.why).toBe("invalid");
  });

  it("one deal of each kind between the same two players at a time", () => {
    const s = game();
    const first = resolveTurn(ctx, s, agreed(offer("p1", "p2", truce()))).state;
    const again = resolveTurn(ctx, first, agreed(offer("p2", "p1", truce(2))));
    expect(of(again.events, "dealFailed")[0]!.why).toBe("exists");
    // A different kind is fine.
    const war = resolveTurn(ctx, first, agreed(offer("p1", "p2", { kind: "war", target: "p3", turns: 4 })));
    expect(war.state.deals.map((d) => d.terms.kind).sort()).toEqual(["truce", "war"]);
  });
});

describe("diplomacy: the deal cards", () => {
  it("truce: it runs its turns, then ends as kept; attacks after it are ordinary attacks", () => {
    let s = game();
    s = resolveTurn(ctx, s, agreed(offer("p1", "p2", truce(2)))).state;
    expect(s.deals).toHaveLength(1);
    const t2 = resolveTurn(ctx, s, {});
    expect(of(t2.events, "dealEnded")).toMatchObject([{ kind: "truce", why: "expired" }]);
    expect(t2.state.deals).toEqual([]);
    expect(t2.state.record).toMatchObject([{ kind: "truce", how: "kept", start: 1, end: 2 }]);
    const t3 = resolveTurn(ctx, t2.state, { p2: [mv("a3", "a2", "all")] });
    expect(of(t3.events, "dealBroken")).toEqual([]);
    expect(of(t3.events, "battle")).toHaveLength(1);
  });

  it("truce on a whole province or named borders covers only those borders", () => {
    // West: attacks into or out of the west are covered (a2-a3 has a2 in the west); b3-b4 is all east.
    const s = game({ b2: ["p1", 6] }, 2);
    const prov = resolveTurn(ctx, s, agreed(offer("p1", "p2", truce(3, { kind: "province", province: "west" })), { p2: [mv("a3", "a2", 2)] }));
    expect(of(prov.events, "dealBroken")).toHaveLength(1);
    const named = resolveTurn(ctx, s, agreed(offer("p1", "p2", truce(3, { kind: "borders", borders: [["b2", "b3"]] })), { p2: [mv("a3", "a2", 2)] }));
    expect(of(named.events, "dealBroken")).toEqual([]);
    expect(named.state.deals).toHaveLength(1);
    const across = resolveTurn(ctx, named.state, { p2: [mv("b3", "b2", 2)] });
    expect(of(across.events, "dealBroken")).toMatchObject([{ by: "p2", at: "b2" }]);
  });

  it("truce until a player is knocked out ends when they are (its goal), and counts as big", () => {
    const s = game();
    const until = truce(8, { kind: "all" }, "p3");
    const plain = truce(8);
    expect(dealSize(ctx.rules, idx, until, "p1", "p2", (t) => s.territories[t]!.owner)).toBe(dealSize(ctx.rules, idx, plain, "p1", "p2", (t) => s.territories[t]!.owner) + ctx.rules.diplomacy.size.untilKnockedOut);
    let st = resolveTurn(ctx, s, agreed(offer("p1", "p2", until))).state;
    // p1 takes p3's only land.
    st.territories.b2!.troops = 1;
    st.territories.a2!.troops = 20;
    const r = resolveTurn(ctx, st, { p1: [mv("a2", "b2", "all")] });
    expect(of(r.events, "eliminated")[0]!.player).toBe("p3");
    expect(of(r.events, "dealEnded")).toMatchObject([{ kind: "truce", why: "goal" }]);
    st = r.state;
    expect(st.record.at(-1)!.how).toBe("kept");
  });

  it("trade: gold now changes hands at once; gold each turn is paid as each turn ends, for its turns", () => {
    const s = game();
    const o = offer("p1", "p2", { kind: "trade", give: { gold: 10 }, get: { perTurn: 3 }, turns: 2 });
    const r1 = resolveTurn(ctx, s, agreed(o));
    const started = of(r1.events, "dealStarted")[0]!;
    expect(started.gold).toEqual({ p1: -10, p2: 10 });
    const pays = of(r1.events, "tribute");
    expect(pays).toMatchObject([{ from: "p2", to: "p1", gold: 3, short: 0 }]);
    replayMatches(s, r1);
    const r2 = resolveTurn(ctx, r1.state, {});
    expect(of(r2.events, "tribute")).toHaveLength(1);
    expect(of(r2.events, "dealEnded")).toMatchObject([{ kind: "trade", why: "expired" }]);
    const r3 = resolveTurn(ctx, r2.state, {});
    expect(of(r3.events, "tribute")).toEqual([]);
  });

  it("trade: a handshake payment that can't be made breaks the deal (Oathbreaker)", () => {
    const s = game();
    const r1 = resolveTurn(ctx, s, agreed(offer("p1", "p2", { kind: "trade", give: { gold: 5 }, get: { perTurn: 30 }, turns: 3 })));
    // p2 had 50 + 5 + income; it pays 30 the first turn, then can't pay the next.
    let st = r1.state;
    player(st, "p2").gold = 10;
    const r2 = resolveTurn(ctx, st, {});
    expect(of(r2.events, "dealBroken")).toMatchObject([{ by: "p2", how: "payment" }]);
    expect(player(r2.state, "p2").oathbreaker).toBe(2 + ctx.rules.diplomacy.oathbreaker.markTurns);
  });

  it("trade of land: the giver's troops step back, one of the receiver's moves in, buildings stay and culture is lost", () => {
    const s = game({ a2: ["p1", 5, 2], a1: ["p1", 4], a3: ["p2", 9] });
    s.territories.a2!.building = "market";
    const o = offer("p1", "p2", { kind: "trade", give: { land: ["a2"] }, get: { gold: 12 } });
    const r = resolveTurn(ctx, s, agreed(o));
    const t = r.state.territories;
    // Culture is lost whenever land changes hands (session 16).
    expect(t.a2).toMatchObject({ owner: "p2", troops: 1, building: "market", culture: 0 });
    // a2's 5 troops stepped back to p1's strongest neighbour (b1 had 6, a1 4... b1 isn't next to a2; a1 is).
    expect(t.a1!.troops).toBe(9);
    expect(t.a3!.troops).toBe(8);
    expect(player(r.state, "p1").gold - player(s, "p1").gold).toBeGreaterThanOrEqual(12);
    // A one-off trade is done at once: nothing stays in force, and it's recorded as kept.
    expect(r.state.deals).toEqual([]);
    expect(r.state.record.at(-1)).toMatchObject({ kind: "trade", how: "kept" });
    replayMatches(s, r);
  });

  it("trade of land: capitals can't be traded, nor land that doesn't border the receiver, nor more than 3 territories", () => {
    const s = game();
    const capital = offer("p1", "p2", { kind: "trade", give: { land: ["a1"] }, get: { gold: 5 } });
    expect(of(resolveTurn(ctx, s, agreed(capital)).events, "dealFailed")[0]!.why).toBe("land");
    const far = offer("p2", "p1", { kind: "trade", give: { land: ["a4"] }, get: {} });
    expect(of(resolveTurn(ctx, s, agreed(far)).events, "dealFailed")[0]!.why).toBe("land");
    const many = offer("p2", "p1", { kind: "trade", give: { land: ["a3", "b3", "b4", "a4"] }, get: {} });
    expect(of(resolveTurn(ctx, s, agreed(many)).events, "dealFailed")[0]!.why).toBe("land");
  });

  it("joint war: both name the same target, with a truce between the partners; attacking the partner breaks it", () => {
    const s = game();
    const o = offer("p1", "p2", { kind: "war", target: "p3", turns: 4 });
    const r = resolveTurn(ctx, s, agreed(o, { p1: [mv("a2", "b2", 2)] }));
    expect(r.state.deals[0]!).toMatchObject({ terms: { kind: "war", target: "p3" }, struck: ["p1"] });
    const hit = resolveTurn(ctx, r.state, { p2: [mv("a3", "a2", 2)] });
    expect(of(hit.events, "dealBroken")).toMatchObject([{ kind: "war", by: "p2", how: "attack" }]);
  });

  it("joint war: a truce with the target breaks it; it ends when the target is out; a partner who never struck is noted", () => {
    const s = game();
    const war = resolveTurn(ctx, s, agreed(offer("p1", "p2", { kind: "war", target: "p3", turns: 2 }))).state;
    const peace = resolveTurn(ctx, war, agreed(offer("p2", "p3", truce())));
    expect(of(peace.events, "dealBroken")).toMatchObject([{ kind: "war", by: "p2", how: "truceWithTarget" }]);
    // Ran its course with nobody striking: both are idle.
    const quiet = resolveTurn(ctx, war, {});
    expect(of(quiet.events, "dealEnded")).toMatchObject([{ kind: "war", why: "expired", idle: ["p1", "p2"] }]);
    expect(quiet.state.record.at(-1)!.idle).toEqual(["p1", "p2"]);
    // You can't go to war on someone you have a truce with.
    const withTruce = resolveTurn(ctx, s, agreed(offer("p1", "p3", truce()))).state;
    expect(of(resolveTurn(ctx, withTruce, agreed(offer("p1", "p2", { kind: "war", target: "p3", turns: 4 }))).events, "dealFailed")[0]!.why).toBe("pact");
  });

  it("right of passage is stored (its moves come later) and expires like any deal", () => {
    let s = game();
    s = resolveTurn(ctx, s, agreed(offer("p1", "p2", { kind: "passage", turns: 2, mutual: true }))).state;
    expect(s.deals[0]!.terms).toEqual({ kind: "passage", turns: 2, mutual: true });
    const r = resolveTurn(ctx, s, {});
    expect(of(r.events, "dealEnded")).toMatchObject([{ kind: "passage", why: "expired" }]);
  });
});

describe("diplomacy: breaking a handshake deal", () => {
  it("brings a public Oathbreaker mark, a gold fine and unrest on the breaker's land next to the wronged player, scaled by the deal's size", () => {
    const small = truce(2, { kind: "borders", borders: [["a2", "a3"]] });
    const big = truce(8, { kind: "all" }, "p3");
    const run = (terms: DealTerms) => {
      const s = game({ a3: ["p2", 20], b3: ["p2", 20], a4: ["p2", 20] });
      const st = resolveTurn(ctx, s, agreed(offer("p1", "p2", terms))).state;
      const r = resolveTurn(ctx, st, { p2: [mv("a3", "a2", 3)] });
      return { st, r, broke: of(r.events, "dealBroken")[0]! };
    };
    const a = run(small), b = run(big);
    for (const { st, broke } of [a, b]) {
      const { fine, unrest } = oathPenalty(ctx.rules, st.deals[0]!.size);
      expect(broke).toMatchObject({ by: "p2", fine, unrest, mark: 2 + ctx.rules.diplomacy.oathbreaker.markTurns });
      // Unrest only on p2's land next to p1's.
      for (const l of broke.land) expect(idx.neighbors.get(l.territory)!.some((x) => st.territories[x]!.owner === "p1")).toBe(true);
    }
    expect(b.broke.fine).toBeGreaterThan(a.broke.fine);
    expect(b.broke.unrest).toBeGreaterThan(a.broke.unrest);
    // The mark is public: everyone's view shows it.
    for (const p of ["p1", "p2", "p3"]) expect(viewFor(ctx, b.r.state, p).players.find((x) => x.id === "p2")!.oathbreaker).toBe(b.broke.mark);
    replayMatches(b.st, b.r);
  });

  it("the example in the design: a truce everywhere for 3 turns over 6 territories costs about 17 gold (Nate doubled it in session 15; it was 8)", () => {
    const size = 6 * ctx.rules.diplomacy.size.perTerritory + 3 * ctx.rules.diplomacy.size.perTurn;
    expect(oathPenalty(ctx.rules, size)).toEqual({ fine: 17, unrest: 7 });
  });

  it("culture protects against the unrest", () => {
    const run = (culture: number) => {
      const s = game({ a3: ["p2", 20, culture], b3: ["p2", 20, culture] });
      const st = resolveTurn(ctx, s, agreed(offer("p1", "p2", truce(8, { kind: "all" }, "p3")))).state;
      return of(resolveTurn(ctx, st, { p2: [mv("a3", "a2", 1)] }).events, "dealBroken")[0]!.unrest;
    };
    expect(run(5)).toBeLessThan(run(0));
  });

  it("a deal can be renounced outright (a break order), and a binding pact can't be", () => {
    const s = game();
    const hs = resolveTurn(ctx, s, agreed(offer("p1", "p2", truce()))).state;
    const r = resolveTurn(ctx, hs, { p1: [{ id: "b", kind: "break", deal: hs.deals[0]!.id, note: "Your capital was too good to pass up." }] });
    expect(of(r.events, "dealBroken")).toMatchObject([{ by: "p1", how: "renounced", note: "Your capital was too good to pass up." }]);
    const bd = resolveTurn(ctx, s, agreed(offer("p1", "p2", truce(), "binding"))).state;
    const no = resolveTurn(ctx, bd, { p1: [{ id: "b", kind: "break", deal: bd.deals[0]!.id }] });
    expect(of(no.events, "dealBroken")).toEqual([]);
    expect(no.state.deals).toHaveLength(1);
  });
});

describe("diplomacy: binding pacts", () => {
  it("each side pays up front; an attack across it is called off with a report line; it can't be broken", () => {
    const s = game();
    const o = offer("p1", "p2", truce(), "binding");
    const r = resolveTurn(ctx, s, agreed(o, { p2: [mv("a3", "a2", "all")] }));
    const started = of(r.events, "dealStarted")[0]!;
    const cost = bindingCost(ctx.rules, started.deal.size);
    expect(cost).toBeGreaterThan(0);
    expect(started.paid).toEqual({ p1: cost, p2: cost });
    const off = of(r.events, "fizzled")[0]!;
    expect(off).toMatchObject({ player: "p2", reason: "pact", detail: { territory: "a2", player: "p1" } });
    expect(explainFizzle(off, { place: (t) => t.toUpperCase(), player: (p) => (p === "p1" ? "Lady Morwen" : p) })).toBe(
      "Your attack from A3 on A2 was called off: you have a binding pact with Lady Morwen across that border, and the game holds both sides to it.",
    );
    expect(of(r.events, "battle")).toEqual([]);
    expect(of(r.events, "dealBroken")).toEqual([]);
    replayMatches(s, r);
  });

  it("gold owed each turn is taken automatically; anything short becomes unrest", () => {
    const s = game();
    const st = resolveTurn(ctx, s, agreed(offer("p1", "p2", { kind: "trade", give: {}, get: { perTurn: 40 }, turns: 2 }, "binding"))).state;
    player(st, "p2").gold = 0;
    const r = resolveTurn(ctx, st, {});
    const pay = of(r.events, "tribute")[0]!;
    expect(pay.short).toBeGreaterThan(0);
    expect(pay.gold + pay.short).toBe(40);
    expect(pay.land.length).toBeGreaterThan(0);
    expect(of(r.events, "dealBroken")).toEqual([]);
    replayMatches(st, r);
  });

  it("can't start without the gold to pay for it", () => {
    const s = game();
    player(s, "p2").gold = 0;
    const r = resolveTurn(ctx, s, agreed(offer("p1", "p2", truce(), "binding")));
    expect(of(r.events, "dealFailed")[0]!.why).toBe("gold");
    expect(player(r.state, "p1").gold).toBeGreaterThanOrEqual(50);
  });
});

describe("diplomacy: knocked-out players, fog, saves, determinism", () => {
  it("a knocked-out player's deals end", () => {
    const s = game({ b2: ["p3", 1], a2: ["p1", 20] });
    const st = resolveTurn(ctx, s, agreed(offer("p2", "p3", truce()))).state;
    const r = resolveTurn(ctx, st, { p1: [mv("a2", "b2", "all")] });
    expect(of(r.events, "dealEnded")).toMatchObject([{ why: "knockedOut" }]);
    expect(r.state.deals).toEqual([]);
    expect(r.state.record.at(-1)!.how).toBe("ended");
  });

  it("fog: everyone knows who has a deal with whom; a trade's terms reach only the two sides; truce borders only where you can see both sides", () => {
    // p3 sits at b2 and sees a2, b1, b3 (its neighbours) but not a4 or b4.
    const s = game();
    const tr = offer("p1", "p2", { kind: "trade", give: { gold: 7 }, get: { perTurn: 2 }, turns: 3 });
    const tc = offer("p1", "p2", truce());
    const r = resolveTurn(ctx, s, { p1: [propose(tr), propose(tc)], p2: [accept(tr), accept(tc)] });
    const v3 = viewFor(ctx, r.state, "p3");
    const trade = v3.deals.find((d) => d.kind === "trade")!;
    expect(trade).toMatchObject({ a: "p1", b: "p2" });
    expect(trade.terms).toBeUndefined();
    expect(viewFor(ctx, r.state, "p1").deals.find((d) => d.kind === "trade")!.terms).toEqual(tr.terms);
    // In the replay: p3 hears of the trade but not its terms or gold.
    const seen = replayFor(ctx, s, r, "p3").filter((e) => e.type === "dealStarted");
    expect(seen).toHaveLength(2);
    const t3 = seen.find((e) => e.type === "dealStarted" && e.deal.terms.kind === "trade")!;
    expect(t3.type === "dealStarted" && [t3.gold, t3.paid, t3.deal.terms]).toEqual([{}, {}, { kind: "trade", give: {}, get: {} }]);
    expect(replayFor(ctx, s, r, "p3").some((e) => e.type === "tribute")).toBe(false);
    // Truce borders: p1|p2 meet at a2-a3 and b1... only a2-a3 here; p3 sees a2 and b3 but not a3? It sees a3? No: b2's
    // neighbours are a2, b1, b3. So the a2-a3 border isn't one p3 can see both sides of.
    const truceFor = (p: string) => viewFor(ctx, r.state, p).deals.find((d) => d.kind === "truce")!.borders;
    expect(truceFor("p1")).toEqual([["a2", "a3"]]);
    expect(truceFor("p3")).toEqual([]);
  });

  it("a game saved before diplomacy carries on with no deals (state version 4 -> 5, then on to today's)", () => {
    const s = game();
    const old = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    old.version = 4;
    for (const k of ["spies", "nextSpy", "spyIntel", "history", "stats"]) delete old[k];
    delete (old.decks as Record<string, unknown>).spies;
    delete (old.settings as Record<string, unknown>).spies;
    delete old.deals;
    delete old.nextDeal;
    delete old.record;
    delete (old.settings as Record<string, unknown>).diplomacy;
    for (const p of old.players as Record<string, unknown>[]) (delete p.oathbreaker, delete p.house, delete p.leaders, (p.command = null));
    const save = { ...makeSave(ctx, s, "p1", 0), state: old };
    const read = readSave(JSON.parse(JSON.stringify(save)));
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const st = read.save.state;
    expect([st.version, st.deals, st.nextDeal, st.record, st.settings.diplomacy]).toEqual([STATE_VERSION, [], 1, [], true]);
    expect(st.players.every((p) => p.oathbreaker === 0)).toBe(true);
    // (Spies' own random sequence is made from the game's dice when an old save is brought up to date.)
    // (The graph's starting point is the land as saved; this test rearranged the board after the game began.)
    // (Session 18's leaders are named from the game's id when an old save comes up to date: the seed isn't kept.)
    const named = { ...st, players: st.players.map((p, i) => ({ ...p, leaders: s.players[i]!.leaders })) };
    expect(stateFingerprint({ ...named, decks: { ...st.decks, spies: s.decks.spies }, history: s.history })).toBe(stateFingerprint(s));
    // And it plays on, with deals.
    expect(resolveTurn(ctx, st, agreed(offer("p1", "p2", truce()))).state.deals).toHaveLength(1);
  });

  it("is deterministic: offers and answers are orders, so a saved game with deals plays back to exactly its snapshot", () => {
    const setup = { gameId: "dip-replay", seed: "dip-replay", players: ["p1", "p2", "p3"].map((id) => ({ id, name: id })), settings: { fate: true, spoils: true } };
    const run = () => {
      let s = createGame(ctx, setup);
      const turns: OrdersByPlayer[] = [];
      const o1 = offer("p1", "p2", truce(6), "handshake", "t1");
      const o2 = offer("p2", "p3", { kind: "trade", give: { perTurn: 2 }, get: {}, turns: 2 }, "binding", "t2");
      for (const orders of [agreed(o1), agreed(o2), {}, { p1: [{ id: "b", kind: "break", deal: "d1" } as Order] }, {}]) {
        turns.push(orders);
        s = resolveTurn(ctx, s, orders).state;
      }
      return { s, turns };
    };
    const a = run(), b = run();
    expect(stateFingerprint(a.s)).toBe(stateFingerprint(b.s));
    expect(a.s.record.map((r) => r.how)).toContain("broken");
    const save = makeSave(ctx, a.s, "p1", 0, { history: { setup, rules: ctx.rules, turns: a.turns } });
    expect(replaySavedGame(ctx, save.history!, stateFingerprint(save.state)).matches).toBe(true);
  });

  it("diplomacy off: offers do nothing", () => {
    const s = game({}, 3, { diplomacy: false });
    const r = resolveTurn(ctx, s, agreed(offer("p1", "p2", truce())));
    expect(r.state.deals).toEqual([]);
    expect(r.events.some((e) => e.type.startsWith("deal") || e.type === "offerLapsed")).toBe(false);
  });

  it("a general may not be told to raid a partner", () => {
    const s = game();
    const st = resolveTurn(ctx, s, agreed(offer("p1", "p2", truce()))).state;
    const r = resolveTurn(ctx, st, { p1: [{ id: "i", kind: "instruct", general: "p1", instruction: { kind: "raid", player: "p2" } }] });
    expect(player(r.state, "p1").leaders[0]!.command).toBeNull();
    const ok = resolveTurn(ctx, st, { p1: [{ id: "i", kind: "instruct", general: "p1", instruction: { kind: "raid", player: "p3" } }] });
    expect(player(ok.state, "p1").leaders[0]!.command).toEqual({ kind: "raid", player: "p3" });
  });
});

describe("diplomacy: report lines in plain words", () => {
  const names = (you: string | null) => ({ you, player: (p: string) => ({ p1: "You-know-who", p2: "Lady Morwen", p3: "Baron Krell" })[p] ?? p, place: (t: string) => t.toUpperCase(), province: (p: string) => (p === "west" ? "Old March" : p) });
  it("a deal starting, ending and broken, and an offer lapsing, each read as one plain sentence", () => {
    const s = game();
    const o = offer("p2", "p1", truce(2, { kind: "province", province: "west" }));
    const r1 = resolveTurn(ctx, s, agreed(o));
    const started = of(r1.events, "dealStarted")[0]!;
    expect(dealLine(started, names("p1"))).toBe("You and Lady Morwen agreed a truce in Old March for 2 turns (a handshake deal).");
    expect(dealLine(started, names("p3"))).toBe("Lady Morwen and You-know-who agreed a truce in Old March for 2 turns (a handshake deal).");
    const r2 = resolveTurn(ctx, r1.state, { p2: [mv("a3", "a2", 2)] });
    const broke = of(r2.events, "dealBroken")[0]!;
    expect(dealLine(broke, names("p1"))).toMatch(/^Lady Morwen broke their truce with you at A2: Oathbreaker until turn 7, a fine of \d+ gold/);
    expect(dealLine(broke, names("p2"))).toMatch(/^You broke your truce with You-know-who at A2: Oathbreaker until turn 7/);
    // A 2-turn truce started on turn 1 runs its course as turn 2 ends.
    const ended = of(resolveTurn(ctx, r1.state, {}).events, "dealEnded")[0]!;
    expect(dealLine(ended, names("p1"))).toBe("Your truce with Lady Morwen has run its course.");
    expect(dealLine(ended, names("p3"))).toBe("The truce between Lady Morwen and You-know-who has run its course.");
    const lapsed = of(resolveTurn(ctx, s, { p1: [propose(offer("p1", "p3", { kind: "war", target: "p2", turns: 4 }))] }).events, "offerLapsed")[0]!;
    expect(dealLine(lapsed, names("p1"))).toBe("Your offer of a joint war to Baron Krell lapsed: nobody accepted it this turn.");
    expect(dealLine(lapsed, names("p3"))).toBe("You-know-who's offer of a joint war lapsed: nobody accepted it this turn.");
    const trade = of(resolveTurn(ctx, s, agreed(offer("p1", "p2", { kind: "trade", give: { gold: 10 }, get: { land: ["a3"] } }))).events, "dealStarted")[0]!;
    expect(dealLine(trade, names("p1"))).toBe("You and Lady Morwen agreed a trade: you give 10 gold, and Lady Morwen gives A3 (a handshake deal).");
    expect(dealLine(trade, names("p3"))).toBe("You-know-who and Lady Morwen made a trade.");
  });

  it("session 29: a counter isn't a decline (the report says how it was countered, with the counter's note)", () => {
    const s = game();
    const o = offer("p1", "p2", truce(4));
    const c = { ...offer("p2", "p1", truce(2)), id: "c1", counterTo: o.id, note: "Two turns. I like to see how it goes." };
    const r = resolveTurn(ctx, s, { p1: [propose(o)], p2: [accept(o, false), propose(c)] });
    const lapsed = of(r.events, "offerLapsed").find((e) => e.offer.id === o.id)!;
    expect(lapsed).toMatchObject({ why: "countered", counter: { id: "c1" } });
    expect(dealLine(lapsed, names("p1"))).toBe('Lady Morwen countered your truce: a truce everywhere for 2 turns. "Two turns. I like to see how it goes."');
    expect(dealLine(lapsed, names("p2"))).toBe(`You countered You-know-who's truce: a truce everywhere for 2 turns. "Two turns. I like to see how it goes."`);
    // The counter itself, left unanswered, lapses on its own as before; a plain no is still "declined".
    expect(of(r.events, "offerLapsed").find((e) => e.offer.id === "c1")!.why).toBe("unanswered");
    expect(of(resolveTurn(ctx, s, { p1: [propose(o)], p2: [accept(o, false)] }).events, "offerLapsed")[0]!.why).toBe("declined");
  });
});
