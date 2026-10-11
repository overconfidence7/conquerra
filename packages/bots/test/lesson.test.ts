import { defaultRules, marshalData, MapDef } from "@conquerra/content";
import { createGame, findLeader, viewFor, type GameContext, type LeaderStyle, type Order } from "@conquerra/engine";
import { describe, expect, it } from "vitest";
import { planLeaders } from "../src";
import { likelyLength } from "../src/marshal/steward";

/**
 * Session 23, the Merchant's lesson (Nate's rule: a leader's behaviour that beats the Marshals is one they adopt): a
 * market that pays for itself before the game is likely to end comes before a fort that isn't urgent.
 */
describe("the Merchant's lesson", () => {
  it("a game's likely length comes from the map's size (the straight line between the settings)", () => {
    const L = marshalData.leaders.steward.lesson!.lengths;
    expect(likelyLength(L, 40)).toBe(22);
    expect(likelyLength(L, 80)).toBe(29);
    expect(likelyLength(L, 200)).toBe(44);
    expect(likelyLength(L, 10)).toBe(22);
    expect(likelyLength(L, 400)).toBe(44);
  });

  /** p1 holds a0, a1 (a quiet province) and b0, b1 (its capital b0); p2's army of `rival` stands at c0, next to the capital. */
  function board(capitalTroops: number, rival: number, style: LeaderStyle | null, turn = 5) {
    const ids = ["a0", "a1", "b0", "b1", "c0", "c1"];
    const territories = ids.map((id) => ({ id, name: id.toUpperCase(), province: id[0] === "c" ? "q" : id[0] === "a" ? "r" : "p", terrain: "plains" as const, x: (id.charCodeAt(0) - 97) * 100, y: Number(id[1]) * 100 }));
    const borders = [["a0", "a1"], ["b0", "b1"], ["c0", "c1"], ["a0", "b0"], ["a1", "b1"], ["b0", "c0"], ["b1", "c1"]].map(([a, b]) => ({ a: a!, b: b! }));
    const map = MapDef.parse({ id: "g", name: "G", minPlayers: 2, maxPlayers: 2, recommendedPlayers: { min: 2, max: 2 }, territories, provinces: [{ id: "p", name: "P", bonus: 2 }, { id: "q", name: "Q", bonus: 2 }, { id: "r", name: "R", bonus: 2 }], borders, capitalSlots: ["b0", "c1"] });
    const ctx: GameContext = { map, rules: defaultRules };
    const s = createGame(ctx, { gameId: "g", seed: "lesson", players: [{ id: "p1", name: "P1" }, { id: "p2", name: "P2" }], settings: { luck: 0, fate: false, diplomacy: false, spies: false, fog: false } });
    for (const t of ids) s.territories[t] = { owner: t[0] === "c" ? "p2" : "p1", troops: t === "b0" ? capitalTroops : t === "c0" ? rival : 2, specialists: [], building: null, construction: null, culture: 0 };
    s.players[0]!.capital = "b0";
    s.players[0]!.leader = { alive: true, territory: "b0" };
    s.players[1]!.capital = "c1";
    s.players[1]!.leader = { alive: true, territory: "c1" };
    s.turn = turn;
    const l = findLeader(s.players[0]!, { kind: "steward", of: "p1" })!;
    l.command = { kind: "realm" };
    l.personality = style;
    l.purse = defaultRules.buildings.fort.cost;
    // (Without the plan: with it, an army that big near the capital puts everything into the wall first.)
    return planLeaders({ ctx, view: viewFor(ctx, s, "p1"), planned: false }).orders.filter((o): o is Extract<Order, { kind: "build" }> => o.kind === "build");
  }

  it("the capital holds against the army next door: a market that pays first, the fort waits", () => {
    const built = board(30, 5, null);
    expect(built.map((o) => o.building)).toEqual(["market"]);
  });

  it("an army next door that could take the capital: the fort first", () => {
    const built = board(3, 12, null);
    expect(built[0]).toMatchObject({ territory: "b0", building: "fort" });
  });

  it("late in a game on a small map, a market wouldn't pay back: the fort", () => {
    const built = board(30, 5, null, 20);
    expect(built.map((o) => o.building)).toEqual(["fort"]);
  });

  it("the Turtle keeps its forts first", () => {
    const built = board(30, 5, "turtle");
    expect(built[0]).toMatchObject({ territory: "b0", building: "fort" });
  });
});
