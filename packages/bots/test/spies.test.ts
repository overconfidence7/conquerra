import { createGame, resolveTurn, stateFingerprint, viewFor, type GameState, type Order } from "@conquerra/engine";
import { describe, expect, it } from "vitest";
import { captainBot, readBoardFor, recruitBot } from "./spyHelpers";
import { scenario } from "./scenario";

const spyOrders = (orders: Order[]) => orders.filter((o) => o.kind === "spy" || o.kind === "hireSpy");

/**
 * p1 (a, b, c: the whole of province p0) next to p2, who holds d, e, f (the whole of p1) and its capital f.
 *   a b c | d e f | g h i
 */
function board(gold = 60, turn = 6) {
  const sc = scenario({ line: "abcdefghi", layout: { a: ["p1", 8], b: ["p1", 6], c: ["p1", 10], d: ["p2", 4], e: ["p2", 4], f: ["p2", 9] }, memory: { e: ["p2", 4], f: ["p2", 9] }, caps: ["a", "f"], gold });
  sc.s.turn = turn;
  return sc;
}

describe("the Captain's spies (session 15)", () => {
  it("hires a spy when it has gold to spare, from turn 4, at its capital", () => {
    expect(spyOrders(board(60, 6).plan())).toContainEqual(expect.objectContaining({ kind: "hireSpy", territory: "a" }));
    expect(spyOrders(board(60, 2).plan())).toEqual([]);
    expect(spyOrders(board(10, 6).plan())).toEqual([]);
  });

  it("sends its first spy into its main target's province, and the second to guard a province of its own a rival borders", () => {
    const sc = board();
    sc.s.spies.push({ id: "y1", owner: "p1", at: "a", target: null, recalled: false, status: "defend" }, { id: "y2", owner: "p1", at: "a", target: null, recalled: false, status: "defend" });
    const orders = spyOrders(sc.plan());
    // p2 (its target: a weak rival next door) holds p1 (d, e, f) whole; p1 holds p0 (a, b, c) whole and borders p2.
    expect(orders).toContainEqual(expect.objectContaining({ kind: "spy", spy: "y1", to: "p1" }));
    // The second is already in the province it should guard: no order for it, and no third spy hired.
    expect(orders.some((o) => o.kind === "spy" && o.spy === "y2")).toBe(false);
    expect(orders.some((o) => o.kind === "hireSpy")).toBe(false);
  });

  it("the Recruit doesn't use spies", () => {
    expect(spyOrders(board().plan(recruitBot))).toEqual([]);
  });

  it("judges from what its spies show it, false reports included", () => {
    const sc = board();
    // A report (as a fooled spy might bring back) that g holds 1 troop of p2's when really it's neutral with 1.
    sc.s.territories.g = { owner: "p2", troops: 30, specialists: [], building: null, construction: null, culture: 0 };
    sc.s.spyIntel = { p1: { g: { owner: "p2", troops: 1, specialists: [], building: null, construction: null, culture: 0, leaders: [], generals: [], capitalOf: null } } };
    const v = viewFor(sc.ctx, sc.s, "p1");
    expect(v.territories.g).toMatchObject({ detail: "full", seenBy: ["spy"], troops: 1 });
    const b = readBoardFor(sc.ctx, v)!;
    expect(b.look("g").troops).toBe(1);
  });

  it("plays the same game every time (spies and all)", () => {
    const ctx = board().ctx;
    const run = () => {
      let s: GameState = createGame(ctx, { gameId: "spy-bots", seed: "spy-bots", players: ["p1", "p2"].map((id) => ({ id, name: id })) });
      for (let i = 0; i < 20 && !s.winner; i++) s = resolveTurn(ctx, s, Object.fromEntries(s.players.filter((p) => p.eliminatedTurn === null).map((p) => [p.id, captainBot.plan(ctx, viewFor(ctx, s, p.id))]))).state;
      return stateFingerprint(s);
    };
    expect(run()).toBe(run());
  });
});
