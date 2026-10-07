import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import {
  createGame,
  replayFor,
  resolveTurn,
  stateFingerprint,
  viewFor,
  type DealTerms,
  type GameContext,
  type GameState,
  type Offer,
  type Order,
  type OrdersByPlayer,
  type PlayerView,
  type ReplayEvent,
} from "@conquerra/engine";
import { describe, expect, it } from "vitest";
import { agreedIn, CAPTAIN_CHAIN_MARGIN, captainBot, makeCaptainBot, captainBreaks, judgeOffer, negotiate, planGeneral, proposeOffers, recruitBot, respectDeals, trustIn, withAgreed } from "../src";
import { scenario } from "./scenario";

const offer = (from: string, to: string, terms: DealTerms, bond: Offer["bond"] = "handshake", id = "x1"): Offer => ({ id, from, to, terms, bond });
const truce = (turns = 3): DealTerms => ({ kind: "truce", scope: { kind: "all" }, turns });
const moves = (orders: Order[]) => orders.filter((o): o is Extract<Order, { kind: "move" }> => o.kind === "move");

/**
 * Two fronts: p2 to the west (a, b), p1 in the middle (c, d, e), p3 to the east (f, g) with a big army at f.
 *   a - b - c - d - e - f - g
 */
function twoFronts(eastArmy = 20) {
  return scenario({
    line: "abcdefg",
    layout: { a: ["p2", 10], b: ["p2", 8], c: ["p1", 6], d: ["p1", 6], e: ["p1", 6], f: ["p3", eastArmy], g: ["p3", 5] },
    memory: { a: ["p2", 10], g: ["p3", 5] },
    caps: ["d", "a", "g"],
    players: 3,
    gold: 20,
  });
}
/** A deal in force between `a` and `b`, put straight into the game (as if agreed earlier). */
function withDeal(s: GameState, a: string, b: string, terms: DealTerms, bond: Offer["bond"] = "handshake", size = 9) {
  s.deals.push({ id: `d${s.nextDeal++}`, a, b, terms, bond, start: s.turn, last: s.turn + 2, size });
}

describe("bots' diplomacy: answers with one plain reason", () => {
  it("a truce when its army is needed on another front: yes, and it says where", () => {
    const sc = twoFronts();
    const a = judgeOffer(sc.ctx, viewFor(sc.ctx, sc.s, "p1"), offer("p2", "p1", truce()), "captain");
    expect(a).toEqual({ accept: true, reason: "I need my army in the east." });
  });

  it("a truce with nothing pulling it elsewhere and the stronger army on that border: no", () => {
    const sc = scenario({ line: "abcd", layout: { a: ["p1", 20], b: ["p1", 20], c: ["p2", 3], d: ["p2", 3] }, caps: ["a", "d"], gold: 20 });
    const a = judgeOffer(sc.ctx, viewFor(sc.ctx, sc.s, "p1"), offer("p2", "p1", truce()), "captain");
    expect(a.accept).toBe(false);
    expect(["You're my target now; I'm not stopping.", "I'm holding our border well enough without a truce."]).toContain(a.reason);
  });

  it("a truce when the proposer's army is at its capital's door: yes", () => {
    const sc = scenario({ line: "abcd", layout: { a: ["p1", 3], b: ["p2", 30], c: ["p2", 4], d: ["p2", 4] }, caps: ["a", "d"], gold: 20 });
    const a = judgeOffer(sc.ctx, viewFor(sc.ctx, sc.s, "p1"), offer("p2", "p1", truce()), "captain");
    expect(a).toEqual({ accept: true, reason: "Your army is at my capital's door; I'll take peace." });
  });

  it("a fair gold trade: yes; a stingy one: a counter asking for more; a bad one: no", () => {
    const sc = twoFronts();
    const v = viewFor(sc.ctx, sc.s, "p1");
    const fair = judgeOffer(sc.ctx, v, offer("p2", "p1", { kind: "trade", give: { gold: 10 }, get: { perTurn: 2 }, turns: 4 }), "captain");
    expect(fair.accept).toBe(true);
    expect(fair.reason).toMatch(/a fair price\.$/);
    const stingy = judgeOffer(sc.ctx, v, offer("p2", "p1", { kind: "trade", give: { gold: 4 }, get: { gold: 8 } }), "captain");
    expect(stingy.accept).toBe(false);
    expect(stingy.counter?.terms).toEqual({ kind: "trade", give: { gold: 9 }, get: { gold: 8 } });
    expect(stingy.reason).toBe("Make it 9 gold and it's a deal.");
    const bad = judgeOffer(sc.ctx, v, offer("p2", "p1", { kind: "trade", give: {}, get: { gold: 18 } }), "captain");
    expect(bad).toMatchObject({ accept: false, reason: "I'd give 18 gold for too little: not enough." });
  });

  it("a counteroffer: a truce that ties its hands too long comes back shorter (and a counter is never countered)", () => {
    const sc = twoFronts(14);
    const v = viewFor(sc.ctx, sc.s, "p1");
    const a = judgeOffer(sc.ctx, v, offer("p2", "p1", truce(8)), "captain");
    expect(a.accept).toBe(false);
    expect(a.reason).toBe("3 turns, not 8, and we have a deal.");
    expect(a.counter).toMatchObject({ from: "p1", to: "p2", terms: { kind: "truce", turns: 3 }, counterTo: "x1" });
    const again = judgeOffer(sc.ctx, v, { ...offer("p2", "p1", truce(8)), counterTo: "y" }, "captain");
    expect(again.counter).toBeUndefined();
  });

  it("a joint war it can't reach: no, and it says why", () => {
    // p1 (a to d) borders only p2 (e to h, which it remembers); p3 (i, j) is beyond, and p4 beyond that.
    const sc = scenario({
      line: "abcdefghijkl",
      layout: { a: ["p1", 6], b: ["p1", 6], c: ["p1", 6], d: ["p1", 6], e: ["p2", 6], f: ["p2", 6], g: ["p2", 6], h: ["p2", 6], i: ["p3", 6], j: ["p3", 6], k: ["p4", 6], l: ["p4", 6] },
      memory: { f: ["p2", 6], g: ["p2", 6], h: ["p2", 6] },
      caps: ["a", "h", "j", "l"],
      players: 4,
      gold: 20,
    });
    const a = judgeOffer(sc.ctx, viewFor(sc.ctx, sc.s, "p1"), offer("p2", "p1", { kind: "war", target: "p3", turns: 4 }), "captain");
    expect(a).toEqual({ accept: false, reason: "I can't reach P3 from where I stand." });
  });

  it("a binding pact it can't afford: no, with the price", () => {
    const sc = twoFronts();
    sc.s.players.find((p) => p.id === "p1")!.gold = 1;
    const a = judgeOffer(sc.ctx, viewFor(sc.ctx, sc.s, "p1"), offer("p2", "p1", truce(), "binding"), "captain");
    expect(a.accept).toBe(false);
    expect(a.reason).toMatch(/^I can't spare \d+ gold for a binding pact\.$/);
  });
});

describe("bots' diplomacy: never helping a runaway leader", () => {
  // p2 holds 9 of 12 (p1 remembers most of it); p3 sits between with its capital c.
  function runaway() {
    const layout: Record<string, [string | null, number]> = { a: ["p1", 4], b: ["p1", 30], c: ["p3", 6] };
    const memory: Record<string, [string | null, number]> = {};
    for (const t of "defghijkl") (layout[t] = ["p2", 3]), t !== "e" && (memory[t] = ["p2", 3]);
    return scenario({ line: "abcdefghijkl", extra: [["b", "e"]], layout, memory, caps: ["a", "l", "c"], players: 3, gold: 30 });
  }
  it("no truce, passage or trade that gives it anything; a joint war against it, gladly", () => {
    const sc = runaway();
    const v = viewFor(sc.ctx, sc.s, "p1");
    for (const terms of [truce(), { kind: "passage", turns: 3, mutual: false }, { kind: "trade", give: { gold: 30 }, get: { gold: 1 } }, { kind: "war", target: "p3", turns: 4 }] as DealTerms[])
      expect(judgeOffer(sc.ctx, v, offer("p2", "p1", terms), "captain")).toEqual({ accept: false, reason: `You're running away with the map. ${terms.kind === "passage" ? "I won't let you through." : "I won't help you grow."}` });
    expect(judgeOffer(sc.ctx, v, offer("p3", "p1", { kind: "war", target: "p2", turns: 4 }), "captain")).toEqual({ accept: true, reason: "Gladly: P2 is running away with the map." });
    // The Recruit too.
    expect(judgeOffer(sc.ctx, v, offer("p2", "p1", truce()), "recruit").accept).toBe(false);
  });

  it("proposes a joint war against it to a rival that borders it", () => {
    const sc = runaway();
    sc.s.turn = 5;
    const o = proposeOffers(sc.ctx, viewFor(sc.ctx, sc.s, "p1"), "captain");
    expect(o[0]).toMatchObject({ from: "p1", to: "p3", terms: { kind: "war", target: "p2" } });
  });
});

describe("bots' diplomacy: trust", () => {
  it("drops a lot when that player broke a deal with it, a little when a joint war fell through, climbs slowly with deals kept, and an Oathbreaker mark lowers it", () => {
    const sc = twoFronts();
    const r = defaultRules.diplomacy.bots;
    const t = () => trustIn(sc.ctx, viewFor(sc.ctx, sc.s, "p1"), "p2");
    expect(t()).toEqual({ score: r.trustStart, why: null });
    const rec = (how: "kept" | "broken", extra = {}) => sc.s.record.push({ deal: `d${sc.s.record.length}`, kind: "truce", bond: "handshake", a: "p1", b: "p2", start: 1, end: 2, how, ...extra });
    rec("kept");
    expect(t().score).toBe(r.trustStart + r.trustKept);
    sc.s.record.push({ deal: "w", kind: "war", bond: "handshake", a: "p1", b: "p2", start: 1, end: 3, how: "kept", idle: ["p2"] });
    expect(t()).toEqual({ score: r.trustStart + r.trustKept - r.trustWarIdle, why: "Our last joint war fell through: you never struck our target." });
    rec("broken", { by: "p2", at: "c" });
    expect(t()).toEqual({ score: r.trustStart + r.trustKept - r.trustWarIdle - r.trustBroken, why: "You broke our truce at C." });
    // A public mark lowers everyone's trust, even a bot it never wronged.
    sc.s.players.find((p) => p.id === "p2")!.oathbreaker = sc.s.turn + 3;
    const p3view = viewFor(sc.ctx, sc.s, "p3");
    expect(trustIn(sc.ctx, p3view, "p2").score).toBe(r.trustStart - r.trustOathbreaker);
  });

  it("won't take a handshake from someone who broke its word: it asks for a binding pact, or says no", () => {
    const sc = twoFronts();
    sc.s.record.push({ deal: "d0", kind: "truce", bond: "handshake", a: "p1", b: "p2", start: 1, end: 2, how: "broken", by: "p2", at: "c" });
    const v = viewFor(sc.ctx, sc.s, "p1");
    const a = judgeOffer(sc.ctx, v, offer("p2", "p1", truce()), "captain");
    expect(a.reason).toBe("You broke our truce at C. Make it binding and it's a deal.");
    expect(a.counter?.bond).toBe("binding");
    // Binding: the game enforces it, so trust isn't needed.
    expect(judgeOffer(sc.ctx, v, offer("p2", "p1", truce(), "binding"), "captain").accept).toBe(true);
    // The Recruit just says no.
    expect(judgeOffer(sc.ctx, v, offer("p2", "p1", truce()), "recruit")).toEqual({ accept: false, reason: "You broke our truce at C." });
  });
});

describe("bots' diplomacy: the Recruit's simpler rules", () => {
  it("takes a truce when it's weaker, refuses when it's stronger, and never proposes trades", () => {
    const weak = scenario({ line: "abcdef", layout: { a: ["p1", 3], b: ["p2", 3], c: ["p2", 3], d: ["p2", 3], e: ["p2", 3], f: ["p2", 3] }, memory: { c: ["p2", 3], d: ["p2", 3], e: ["p2", 3], f: ["p2", 3] }, caps: ["a", "f"], gold: 20 });
    expect(judgeOffer(weak.ctx, viewFor(weak.ctx, weak.s, "p1"), offer("p2", "p1", truce()), "recruit")).toEqual({ accept: true, reason: "You're stronger than me; peace suits me." });
    const strong = scenario({ line: "abcdef", layout: { a: ["p1", 3], b: ["p1", 3], c: ["p1", 3], d: ["p1", 3], e: ["p1", 3], f: ["p2", 3] }, caps: ["a", "f"], gold: 20 });
    expect(judgeOffer(strong.ctx, viewFor(strong.ctx, strong.s, "p1"), offer("p2", "p1", truce()), "recruit")).toEqual({ accept: false, reason: "I'm stronger than you; I'll take my chances." });
    weak.s.turn = 5;
    const props = proposeOffers(weak.ctx, viewFor(weak.ctx, weak.s, "p1"), "recruit");
    expect(props.map((o) => o.terms.kind)).toEqual(["truce"]);
    weak.s.players[0]!.gold = 0;
    expect(proposeOffers(weak.ctx, viewFor(weak.ctx, weak.s, "p1"), "recruit").every((o) => o.terms.kind !== "trade")).toBe(true);
  });
});

describe("bots' diplomacy: right of passage (session 15)", () => {
  /** p1 (a, b) - p3 (c) - p2 (d...l, the runaway, as p1 remembers). p1 doesn't border p2. */
  function beyond() {
    const layout: Record<string, [string | null, number]> = { a: ["p1", 4], b: ["p1", 30], c: ["p3", 4] };
    const memory: Record<string, [string | null, number]> = {};
    for (const t of "defghijkl") (layout[t] = ["p2", 3]), (memory[t] = ["p2", 3]);
    return scenario({ line: "abcdefghijkl", layout, memory, caps: ["a", "l", "c"], players: 3, gold: 0 });
  }

  it("asks a neighbour to let it through to a runaway leader it doesn't border, and says why", () => {
    const sc = beyond();
    sc.s.turn = 5;
    // Already at war with p2 alongside p3 (so the joint-war offer is out of the way): now it asks p3 for passage.
    withDeal(sc.s, "p1", "p3", { kind: "war", target: "p2", turns: 4 });
    const o = proposeOffers(sc.ctx, viewFor(sc.ctx, sc.s, "p1"), "captain");
    expect(o[0]).toMatchObject({ from: "p1", to: "p3", terms: { kind: "passage", mutual: false }, note: "Let my armies through your land to reach P2, who's running away with the map." });
  });

  it("with passage, the Captain marches through its partner's land to the front it wants", () => {
    const sc = beyond();
    sc.s.deals.push({ id: "d9", a: "p1", b: "p3", terms: { kind: "passage", turns: 4, mutual: false }, bond: "handshake", start: 1, last: 4, size: 8 });
    const march = moves(sc.plan()).find((o) => o.through);
    expect(march).toMatchObject({ from: "b", to: "d", through: ["c"], preset: { id: "onlyIfStronger" } });
    // Without the deal it can't (and never attacks p3, who holds the runaway off).
    sc.s.deals = [];
    expect(moves(sc.plan()).some((o) => o.through || o.to === "c")).toBe(false);
  });

  it("never lets through someone attacking a partner of its own", () => {
    const sc = scenario({ line: "abcdef", layout: { a: ["p1", 10], b: ["p1", 10], c: ["p2", 5], d: ["p2", 5], e: ["p3", 5], f: ["p3", 5] }, caps: ["a", "d", "f"], players: 3 });
    withDeal(sc.s, "p1", "p3", truce());
    const v = viewFor(sc.ctx, sc.s, "p1");
    const last = [{ type: "battle", step: 3, player: "p2", defender: "p3", from: "d", to: "e" }] as unknown as ReplayEvent[];
    expect(judgeOffer(sc.ctx, v, offer("p2", "p1", { kind: "passage", turns: 3, mutual: false }), "captain", last)).toEqual({ accept: false, reason: "You're at war with P3, who has a deal with me. I won't let you through." });
    // A joint war aimed at its partner counts too (deals are public).
    sc.s.deals.push({ id: "d8", a: "p2", b: "p4x", terms: { kind: "war", target: "p3", turns: 4 }, bond: "handshake", start: 1, last: 4, size: 8 });
    expect(judgeOffer(sc.ctx, viewFor(sc.ctx, sc.s, "p1"), offer("p2", "p1", { kind: "passage", turns: 3, mutual: false }), "captain").reason).toContain("I won't let you through");
  });

  it("a long passage gets a counteroffer for the usual length; the Recruit never lets armies through", () => {
    // Four players, p2 neither weak nor running away (so not p1's target).
    const sc = scenario({
      line: "abcdefghijkl",
      layout: { a: ["p1", 10], b: ["p1", 10], c: ["p1", 10], d: ["p2", 3], e: ["p2", 3], f: ["p2", 3], g: ["p2", 3], h: ["p3", 3], i: ["p3", 3], j: ["p4", 3], k: ["p4", 3], l: ["p4", 3] },
      memory: { e: ["p2", 3], f: ["p2", 3], g: ["p2", 3] },
      caps: ["a", "g", "i", "l"],
    });
    const v = viewFor(sc.ctx, sc.s, "p1");
    const a = judgeOffer(sc.ctx, v, offer("p2", "p1", { kind: "passage", turns: 6, mutual: false }), "captain");
    expect(a.accept).toBe(false);
    expect(a.counter?.terms).toEqual({ kind: "passage", turns: sc.ctx.rules.diplomacy.passage.defaultTurns, mutual: false });
    expect(judgeOffer(sc.ctx, v, offer("p2", "p1", { kind: "passage", turns: 3, mutual: false }), "recruit")).toEqual({ accept: false, reason: "I don't let armies through my land." });
  });
});

describe("bots' diplomacy: keeping their word", () => {
  it("the Captain never attacks across a truce; without it, it would", () => {
    const sc = scenario({ line: "abcd", layout: { a: ["p1", 3], b: ["p1", 30], c: ["p2", 2], d: ["p2", 3] }, caps: ["a", "d"], gold: 0 });
    expect(moves(sc.plan()).some((o) => o.to === "c")).toBe(true);
    withDeal(sc.s, "p1", "p2", truce());
    const orders = sc.plan();
    expect(moves(orders).some((o) => o.to === "c" || o.to === "d")).toBe(false);
    // Every move it does make carries a guard against walking into the partner's land.
    for (const o of moves(orders)) expect(o.conditions).toContainEqual({ kind: "not", condition: { kind: "ownerIs", territory: o.to, player: "p2" } });
  });

  it("the Recruit and generals honour every deal too; 'Raid a rival' can't hit a partner", () => {
    const sc = scenario({ line: "abcd", layout: { a: ["p1", 3], b: ["p1", 30], c: ["p2", 2], d: ["p2", 3] }, caps: ["a", "d"], gold: 0 });
    withDeal(sc.s, "p1", "p2", truce());
    expect(moves(sc.plan(recruitBot)).some((o) => o.to === "c")).toBe(false);
    sc.s.players[0]!.leader = { alive: true, territory: "b" };
    const v = viewFor(sc.ctx, sc.s, "p1");
    for (const i of [{ kind: "raid", player: "p2" }, { kind: "push", territory: "d" }, { kind: "hold" }] as const)
      expect(moves(planGeneral(sc.ctx, v, "p1", i)).some((o) => o.to === "c")).toBe(false);
  });

  it("respectDeals leaves orders untouched with no deals (the Captain plays exactly as before)", () => {
    const sc = twoFronts();
    const v = viewFor(sc.ctx, sc.s, "p1");
    const orders = captainBot.plan(sc.ctx, v);
    expect(respectDeals(sc.ctx, v, orders)).toEqual(orders);
  });

  it("the Captain breaks a handshake truce only for a capital it's sure to take, and says so", () => {
    const sc = scenario({ line: "abcd", layout: { a: ["p1", 3], b: ["p1", 60], c: ["p2", 2], d: ["p2", 3] }, caps: ["a", "c"], gold: 0 });
    // The harsher Oathbreaker (session 15): a 3-turn truce everywhere (size 9) now costs too much to break even for a
    // capital; a small one (size 4) is still worth breaking.
    withDeal(sc.s, "p1", "p2", truce());
    expect(captainBreaks(sc.ctx, viewFor(sc.ctx, sc.s, "p1"))).toEqual([]);
    sc.s.deals[0]!.size = 4;
    const v = viewFor(sc.ctx, sc.s, "p1");
    const br = captainBreaks(sc.ctx, v);
    expect(br).toEqual([{ id: expect.any(String), kind: "break", deal: "d1", note: "Your capital at C is mine for the taking; our truce isn't worth more than that." }]);
    // The orders: the break first, then the attack it was worth it for.
    const orders = sc.plan();
    expect(orders[0]!.kind).toBe("break");
    expect(moves(orders).some((o) => o.to === "c")).toBe(true);
    // A binding pact it never breaks, and an ordinary border it never breaks for.
    sc.s.deals[0]!.bond = "binding";
    expect(captainBreaks(sc.ctx, viewFor(sc.ctx, sc.s, "p1"))).toEqual([]);
    const plain = scenario({ line: "abcde", layout: { a: ["p1", 3], b: ["p1", 60], c: ["p2", 2], d: ["p2", 3], e: ["p2", 3] }, caps: ["a", "e"], gold: 0 });
    withDeal(plain.s, "p1", "p2", truce(), "handshake", 4);
    expect(captainBreaks(plain.ctx, viewFor(plain.ctx, plain.s, "p1"))).toEqual([]);
  });

  it("a bot plans its moves knowing the deals it agreed this turn (they start before any move)", () => {
    const sc = scenario({ line: "abcd", layout: { a: ["p1", 3], b: ["p1", 30], c: ["p2", 2], d: ["p2", 3] }, caps: ["a", "d"], gold: 0 });
    const v = withAgreed(viewFor(sc.ctx, sc.s, "p1"), [offer("p2", "p1", truce())]);
    expect(moves(captainBot.plan(sc.ctx, v)).some((o) => o.to === "c")).toBe(false);
  });
});

describe("bots' diplomacy: bots dealing with each other", () => {
  const ctx: GameContext = { map: maps.embervale!, rules: defaultRules };
  /** A whole 4-Captain game on Embervale, bots negotiating every turn (as the host and the simulator do). */
  function play(seed: string, diplomacy = true, turns = 30, spies = true, bot = captainBot) {
    let s = createGame(ctx, { gameId: "fp", seed, players: ["p1", "p2", "p3", "p4"].map((id) => ({ id, name: id })), settings: { diplomacy, spies } });
    let last = new Map<string, ReplayEvent[]>();
    const talks: string[] = [];
    for (let i = 0; i < turns && !s.winner; i++) {
      const living = s.players.filter((p) => p.eliminatedTurn === null);
      const views = new Map<string, PlayerView>(living.map((p) => [p.id, viewFor(ctx, s, p.id)]));
      const talk = diplomacy ? negotiate(ctx, living.map((p) => ({ id: p.id, level: "captain" as const })), (id) => views.get(id)!, (id) => last.get(id), null) : null;
      for (const t of talk?.talks ?? []) talks.push(`${t.offer.from}>${t.offer.to} ${t.offer.terms.kind}: ${t.answer?.reason}`);
      const agreed = talk ? agreedIn(talk.orders) : [];
      const orders: OrdersByPlayer = {};
      for (const p of living) orders[p.id] = [...(talk?.orders[p.id] ?? []), ...bot.plan(ctx, withAgreed(views.get(p.id)!, agreed), last.get(p.id))];
      const before = s;
      const r = resolveTurn(ctx, s, orders);
      s = r.state;
      last = new Map(s.players.map((p) => [p.id, replayFor(ctx, before, r, p.id)]));
    }
    return { s, talks };
  }

  it("is deterministic: the same seed gives the same offers, answers and game", () => {
    const a = play("deals-1"), b = play("deals-1");
    expect(a.talks.length).toBeGreaterThan(5);
    expect(a.talks).toEqual(b.talks);
    expect(stateFingerprint(a.s)).toBe(stateFingerprint(b.s));
    expect(a.s.record.length + a.s.deals.length).toBeGreaterThan(0);
  });

  it("with diplomacy off, the Captain plays exactly as it did before diplomacy (its fingerprint)", () => {
    // (With spies off too, and the game's new fields (spies, governing) set aside, so the fingerprint is the one from session 14.)
    // (And without session 15's governing captured generals, which changes how the Captain plays on purpose.)
    // (Session 16 changed the rules underneath it on purpose: culture is lost when land changes hands, the Captain values
    // a rival's culture only as what taking it denies them, Follow through carries the Leader on, and the Spoils rework. Pinned again then.)
    const s = structuredClone(play("captain-fingerprint", false, 25, false, makeCaptainBot({ chainMargin: CAPTAIN_CHAIN_MARGIN, off: ["govern"] })).s) as unknown as Record<string, unknown>;
    for (const k of ["spies", "nextSpy", "spyIntel", "history", "stats"]) delete s[k];
    delete (s.decks as Record<string, unknown>).spies;
    delete (s.settings as Record<string, unknown>).spies;
    for (const p of s.players as Record<string, unknown>[]) (delete p.purse, delete p.house);
    s.version = 5;
    expect(stateFingerprint(s as unknown as GameState)).toBe("58795a25c817994f");
  });

  it("with everything on, the Captain plays exactly as at the end of session 16 (its fingerprint; session 17 adds the Marshal beside it, unchanged)", () => {
    const a = play("captain-s16", true, 30, true);
    expect(stateFingerprint(a.s)).toBe("fa5f10adce2a6b11");
  });

  it("never floods anyone: at most one offer a turn per bot, and at most one to the human from all of them", () => {
    let s = createGame(ctx, { gameId: "flood", seed: "flood", players: ["you", "b1", "b2", "b3"].map((id) => ({ id, name: id })) });
    s.turn = 6;
    const views = new Map(s.players.map((p) => [p.id, viewFor(ctx, s, p.id)]));
    const t = negotiate(ctx, ["b1", "b2", "b3"].map((id) => ({ id, level: "captain" as const })), (id) => views.get(id)!, () => undefined, "you");
    expect(t.toHuman.length).toBeLessThanOrEqual(defaultRules.diplomacy.bots.offersToYouPerTurn);
    for (const b of ["b1", "b2", "b3"]) expect(t.talks.filter((x) => x.offer.from === b && !x.offer.counterTo).length).toBeLessThanOrEqual(defaultRules.diplomacy.bots.offersPerTurn);
    s = s;
  });
});
