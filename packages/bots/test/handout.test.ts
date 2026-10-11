import { defaultRules, MapDef } from "@conquerra/content";
import { createGame, findLeader, investCost, viewFor, type GameContext, type LeaderRecord, type ReplayEvent } from "@conquerra/engine";
import { describe, expect, it } from "vitest";
import { planLeaders } from "../src";
import { handBackKeep } from "../src/marshal/leaders";

/** Session 23 (Nate, Oct 10): a Steward with nothing worth building hands back what's over two turns of its budget. */
const steward = (budget: LeaderRecord["budget"]): LeaderRecord => ({ kind: "steward", of: "p1", name: "Odo", personality: null, command: { kind: "realm" }, budget, purse: 0 });
const never = () => 0;
const income = (gross: number, upkeep: number): ReplayEvent[] => [{ type: "income", step: 0, player: "p1", income: gross, upkeep, goldAfter: 0, deserted: 0, deserters: [] }];

describe("the Steward's handout: when, and how much", () => {
  it("keeps two turns of its budget (last turn's earnings) and hands back the rest", () => {
    // 20% of (30 - 10) = 4 a turn: it keeps 8.
    expect(handBackKeep(steward({ share: 0.2 }), 50, income(30, 10), never)).toBe(8);
    // An exact budget doesn't need last turn's earnings.
    expect(handBackKeep(steward({ gold: 5 }), 50, undefined, never)).toBe(10);
  });

  it("never hands back gold it's saving for something it can buy within two turns", () => {
    // It wants something for 55: 50 now and 8 more over two turns covers it (it's asked with 58 to spend).
    const asked: number[] = [];
    // (A stand-in for its planner: it buys `cost` as soon as two turns of budget on top of what's left cover it.)
    const wants = (cost: number) => (left: number, perTurn: number) => (asked.push(left, perTurn), left + 2 * perTurn >= cost ? cost : 0);
    expect(handBackKeep(steward({ share: 0.2 }), 50, income(30, 10), wants(55))).toBeNull();
    expect(asked).toEqual([50, 4]);
    expect(handBackKeep(steward({ share: 0.2 }), 50, income(30, 10), wants(58))).toBeNull();
    // Something it couldn't afford for many turns isn't a reason to sit on the gold.
    expect(handBackKeep(steward({ share: 0.2 }), 50, income(30, 10), wants(59))).toBe(8);
    // Something smaller it will buy next turn: it keeps that much (here 20), and hands back the rest.
    expect(handBackKeep(steward({ share: 0.2 }), 50, income(30, 10), wants(20))).toBe(20);
    // Pocket change (under 5 gold over what it keeps) stays in the purse.
    expect(handBackKeep(steward({ share: 0.2 }), 12, income(30, 10), never)).toBeNull();
    expect(handBackKeep(steward({ share: 0.2 }), 13, income(30, 10), never)).toBe(8);
    // Two turns of budget already covers a little purchase: it keeps those.
    expect(handBackKeep(steward({ share: 0.2 }), 50, income(30, 10), wants(6))).toBe(8);
  });

  it("nothing over two turns of its budget, nothing handed back; and with no report to go on (turn 1), it keeps it all", () => {
    expect(handBackKeep(steward({ share: 0.2 }), 8, income(30, 10), never)).toBeNull();
    expect(handBackKeep(steward({ share: 0.2 }), 50, undefined, never)).toBeNull();
  });
});

describe("the Steward's handout in its orders", () => {
  /** One province (2 x 2) of p1's, its culture already at the top: nothing on "Raise culture here" to buy. */
  function board(culture: number, purse: number) {
    const ids = ["a0", "a1", "b0", "b1", "c0", "c1"];
    const territories = ids.map((id) => ({ id, name: id.toUpperCase(), province: id[0] === "c" ? "q" : "p", terrain: "plains" as const, x: (id.charCodeAt(0) - 97) * 100, y: Number(id[1]) * 100 }));
    const borders = [["a0", "a1"], ["b0", "b1"], ["c0", "c1"], ["a0", "b0"], ["a1", "b1"], ["b0", "c0"], ["b1", "c1"]].map(([a, b]) => ({ a: a!, b: b! }));
    const map = MapDef.parse({ id: "g", name: "G", minPlayers: 2, maxPlayers: 2, recommendedPlayers: { min: 2, max: 2 }, territories, provinces: [{ id: "p", name: "P", bonus: 2 }, { id: "q", name: "Q", bonus: 2 }], borders, capitalSlots: ["a0", "c1"] });
    const ctx: GameContext = { map, rules: defaultRules };
    const s = createGame(ctx, { gameId: "g", seed: "handout", players: [{ id: "p1", name: "P1" }, { id: "p2", name: "P2" }], settings: { luck: 0, fate: false, diplomacy: false, spies: false } });
    for (const t of ids) s.territories[t] = { owner: t[0] === "c" ? "p2" : "p1", troops: 3, specialists: [], building: null, construction: null, culture: t[0] === "c" ? 0 : culture };
    s.players[0]!.capital = "a0";
    s.players[1]!.capital = "c1";
    const l = findLeader(s.players[0]!, { kind: "steward", of: "p1" })!;
    l.command = { kind: "culture", province: "p" };
    l.budget = { share: 0.2 };
    l.purse = purse;
    return { ctx, s };
  }
  let top = 0;
  while (investCost(defaultRules, top) !== null) top++;

  it("culture already at the top: it hands back what's over two turns of its budget, and says so", () => {
    const { ctx, s } = board(top, 50);
    const p = planLeaders({ ctx, view: viewFor(ctx, s, "p1"), lastTurn: income(30, 10) });
    const hb = p.orders.find((o) => o.kind === "budget" && o.handBack);
    expect(hb).toMatchObject({ kind: "budget", general: "p1", role: "steward", steward: "p1", handBack: { keep: 8 } });
    expect(p.notes["steward:p1"]).toEqual({ kind: "handout", gold: 42, keep: 8 });
  });

  it("culture still to raise: it keeps what the next level costs (or two turns of budget), and only hands back what's over", () => {
    // Little gold: it raises culture and keeps the rest for the next levels (two turns of them).
    const small = board(0, 30);
    const p = planLeaders({ ctx: small.ctx, view: viewFor(small.ctx, small.s, "p1"), lastTurn: income(30, 10) });
    expect(p.orders.some((o) => o.kind === "invest")).toBe(true);
    expect(p.orders.some((o) => o.kind === "budget" && o.handBack)).toBe(false);
    // A fortune: it raises a level on each of its four territories, keeps the next two levels' price, hands back the rest.
    const { ctx, s } = board(0, 500);
    const q = planLeaders({ ctx, view: viewFor(ctx, s, "p1"), lastTurn: income(30, 10) });
    expect(q.orders.filter((o) => o.kind === "invest").length).toBe(4);
    const keep = 4 * (investCost(defaultRules, 1)! + investCost(defaultRules, 2)!);
    const hb = q.orders.find((o) => o.kind === "budget" && o.handBack);
    expect(hb?.kind === "budget" && hb.handBack!.keep).toBe(keep);
    expect(q.notes["steward:p1"]).toEqual({ kind: "handout", gold: 500 - 4 * investCost(defaultRules, 0)! - keep, keep });
  });
});
