import { describe, expect, it } from "vitest";
import { replayFor, resolveTurn, viewFor, type GameState, type Order } from "../src";
import { board, ctxWith, find, lineGame, mv, player } from "./helpers";

const ctx = ctxWith();
const instruct = (general: string, instruction: Extract<Order, { kind: "instruct" }>["instruction"]): Order => ({ id: `i-${general}`, kind: "instruct", general, instruction });
const release = (general: string): Order => ({ id: `r-${general}`, kind: "release", general });

/** p1 holds a, b, c, d; p2 holds only e with 1 troop: one attack from d knocks p2 out. */
function aboutToWin(): GameState {
  const s = lineGame(ctx);
  board(s, { a: ["p1", 5], b: ["p1", 3], c: ["p1", 3], d: ["p1", 20], e: ["p2", 1] });
  return s;
}

describe("standing instructions", () => {
  it("an instruct order sets your Leader's instruction as the turn starts, takes no slot, and null switches it off", () => {
    const s = lineGame(ctx);
    board(s, { a: ["p1", 5], b: ["p1", 3], e: ["p2", 5] });
    const r = resolveTurn(ctx, s, { p1: [instruct("p1", { kind: "push", territory: "d" })] });
    expect(player(r.state, "p1").command).toEqual({ kind: "push", territory: "d" });
    expect(r.events.filter((e) => e.type === "fizzled")).toEqual([]);
    const r2 = resolveTurn(ctx, r.state, { p1: [] });
    expect(player(r2.state, "p1").command).toEqual({ kind: "push", territory: "d" });
    expect(player(resolveTurn(ctx, r2.state, { p1: [instruct("p1", null)] }).state, "p1").command).toBeNull();
  });

  it("an instruction that makes no sense, or for a general you don't have, is ignored", () => {
    const s = lineGame(ctx);
    board(s, { a: ["p1", 5], e: ["p2", 5] });
    const r = resolveTurn(ctx, s, { p1: [instruct("p1", { kind: "raid", player: "p1" }), instruct("p1", { kind: "push", territory: "nowhere" }), instruct("p2", { kind: "hold" })] });
    expect(player(r.state, "p1").command).toBeNull();
    expect(player(r.state, "p2").command).toBeNull();
  });

  it("an order a general wrote says so in the replay", () => {
    const s = lineGame(ctx);
    board(s, { a: ["p1", 10], e: ["p2", 5] });
    const r = resolveTurn(ctx, s, { p1: [mv("a", "b", "all", { withLeader: true, general: "p1" })] });
    expect(find(r.events, "battle")).toMatchObject({ general: "p1", withLeader: true, captured: true });
  });
});

describe("captured generals", () => {
  it("knocking a player out gives you their Leader as a captured general, at your capital, with no instruction", () => {
    const r = resolveTurn(ctx, aboutToWin(), { p1: [mv("d", "e", "all")] });
    expect(player(r.state, "p1").captured).toEqual([{ of: "p2", territory: "a", instruction: null }]);
    expect(find(r.events, "generalCaptured")).toMatchObject({ player: "p1", general: "p2", territory: "a" });
    // It shows on the map where it stands, to whoever can see it.
    expect(viewFor(ctx, r.state, "p1").territories.a).toMatchObject({ detail: "full", generals: ["p2"] });
  });

  it("at your strongest territory if you've lost your capital", () => {
    const s = aboutToWin();
    s.territories.a!.owner = null;
    const r = resolveTurn(ctx, s, { p1: [mv("d", "e", "all")] });
    expect(player(r.state, "p1").captured[0]!.territory).toBe("e");
  });

  it("goes with its army when told to, and takes instructions like your Leader", () => {
    const s = lineGame(ctx);
    board(s, { a: ["p1", 5], b: ["p1", 10], e: ["p2", 5] });
    player(s, "p1").captured = [{ of: "p3", territory: "b", instruction: null }];
    const r = resolveTurn(ctx, s, { p1: [instruct("p3", { kind: "hold" }), mv("b", "c", "all", { withGeneral: "p3" })] });
    expect(player(r.state, "p1").captured).toEqual([{ of: "p3", territory: "c", instruction: { kind: "hold" } }]);
    expect(find(r.events, "battle")).toMatchObject({ withGeneral: "p3", captured: true });
  });

  it("adds no fighting bonus (only your own Leader does)", () => {
    const fight = (extra: Partial<Order>) => {
      const s = lineGame(ctx);
      board(s, { a: ["p1", 2], b: ["p1", 10], c: ["p2", 8], e: ["p2", 5] });
      player(s, "p1").captured = [{ of: "p3", territory: "b", instruction: null }];
      player(s, "p1").leader = { alive: true, territory: "b" };
      return find(resolveTurn(ctx, s, { p1: [mv("b", "c", 9, extra)] }).events, "battle")!.result.attackStrength;
    };
    expect(fight({ withGeneral: "p3" })).toBe(fight({}));
    expect(fight({ withLeader: true })).toBeGreaterThan(fight({}));
  });

  it("is gone for good when the land it stands in is taken", () => {
    const s = lineGame(ctx);
    board(s, { a: ["p1", 5], b: ["p1", 1], c: ["p2", 20], e: ["p2", 5] });
    player(s, "p1").captured = [{ of: "p3", territory: "b", instruction: null }];
    const r = resolveTurn(ctx, s, { p2: [mv("c", "b", "all")] });
    expect(player(r.state, "p1").captured).toEqual([]);
    expect(find(r.events, "generalLost")).toMatchObject({ player: "p1", general: "p3", territory: "b", by: "p2" });
    expect(find(r.events, "battle")!.defense.generals).toEqual(["p3"]);
    // Both sides hear about it, whatever the fog.
    expect(replayFor(ctx, s, r, "p1").some((e) => e.type === "generalLost")).toBe(true);
    expect(replayFor(ctx, s, r, "p2").some((e) => e.type === "generalLost")).toBe(true);
  });

  it("is gone for good when its army is wiped out attacking", () => {
    const s = lineGame(ctx);
    board(s, { a: ["p1", 5], b: ["p1", 3], c: ["p2", 30], e: ["p2", 5] });
    player(s, "p1").captured = [{ of: "p3", territory: "b", instruction: null }];
    const r = resolveTurn(ctx, s, { p1: [mv("b", "c", "all", { withGeneral: "p3" })] });
    expect(player(r.state, "p1").captured).toEqual([]);
    expect(find(r.events, "generalLost")).toMatchObject({ player: "p1", general: "p3", by: "p2" });
  });

  it("stays put (and safe) when its army attacks and falls back", () => {
    const s = lineGame(ctx);
    board(s, { a: ["p1", 5], b: ["p1", 12], c: ["p2", 12], e: ["p2", 5] });
    player(s, "p1").captured = [{ of: "p3", territory: "b", instruction: null }];
    const r = resolveTurn(ctx, s, { p1: [mv("b", "c", 11, { withGeneral: "p3" })] });
    expect(find(r.events, "battle")!.captured).toBe(false);
    expect(player(r.state, "p1").captured).toEqual([{ of: "p3", territory: "b", instruction: null }]);
  });

  it("you keep at most two: with a third, you let one go; if you don't choose, the one farthest from the front goes", () => {
    const three = () => {
      const s = lineGame(ctx);
      board(s, { a: ["p1", 5], b: ["p1", 5], c: ["p1", 5], d: ["p1", 5], e: ["p2", 5] });
      player(s, "p1").captured = [
        { of: "x1", territory: "a", instruction: null },
        { of: "x2", territory: "d", instruction: null },
        { of: "x3", territory: "c", instruction: null },
      ];
      return s;
    };
    expect(ctx.rules.generals.maxCaptured).toBe(2);
    const chose = resolveTurn(ctx, three(), { p1: [release("x2")] });
    expect(player(chose.state, "p1").captured.map((g) => g.of)).toEqual(["x1", "x3"]);
    expect(find(chose.events, "generalReleased")).toMatchObject({ player: "p1", general: "x2" });
    const auto = resolveTurn(ctx, three(), { p1: [] });
    // The front is p2 at e: d is 1 away, c 2, a 4.
    expect(player(auto.state, "p1").captured.map((g) => g.of)).toEqual(["x2", "x3"]);
  });

  it("a knocked-out player's own captured generals go with them", () => {
    const s = aboutToWin();
    player(s, "p2").captured = [{ of: "p3", territory: "e", instruction: null }];
    const r = resolveTurn(ctx, s, { p1: [mv("d", "e", "all")] });
    expect(player(r.state, "p2").captured).toEqual([]);
    expect(player(r.state, "p1").captured.map((g) => g.of)).toEqual(["p2"]);
  });
});
