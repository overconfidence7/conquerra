import { describe, expect, it } from "vitest";
import { canRecruitAt, isRecruitSiteIn, recruitCount, resolveTurn, viewFor } from "../src";
import { board, ctxWith, find, lineGame, player } from "./helpers";

/** Line map provinces: west = a, b · mid = c · east = d, e. Capitals: p1 at a, p2 at e. */
describe("recruiting: where", () => {
  const ctx = ctxWith();

  it("at the capital, any barracks, and anywhere in a province you hold completely", () => {
    const s = lineGame(ctx);
    board(s, { a: ["p1", 3], b: ["p1", 3], c: ["p1", 3], d: ["p1", 3, [], { building: "barracks" }], e: ["p2", 3] });
    expect(["a", "b", "c", "d", "e"].filter((t) => canRecruitAt(ctx, s, "p1", t))).toEqual(["a", "b", "c", "d"]);
    // The view-side rule (bots, the order screen) agrees.
    const view = viewFor(ctx, s, "p1");
    expect(["a", "b", "c", "d", "e"].filter((t) => isRecruitSiteIn(ctx, view, t))).toEqual(["a", "b", "c", "d"]);
  });

  it("not in a province you only partly hold", () => {
    const s = lineGame(ctx);
    board(s, { a: ["p2", 3], b: ["p1", 3], d: ["p1", 3], e: ["p2", 3] });
    player(s, "p1").gold = 50;
    expect(canRecruitAt(ctx, s, "p1", "b")).toBe(false);
    expect(canRecruitAt(ctx, s, "p1", "d")).toBe(false);
    const { events } = resolveTurn(ctx, s, { p1: [{ id: "r", kind: "recruit", territory: "d", count: 5 }] });
    expect(find(events, "fizzled")).toMatchObject({ orderId: "r", reason: "recruitSite" });
  });

  it("hiring stays at the capital and barracks", () => {
    const s = lineGame(ctx);
    board(s, { a: ["p1", 3], b: ["p1", 3], e: ["p2", 3] });
    player(s, "p1").gold = 50;
    const { events, state } = resolveTurn(ctx, s, {
      p1: [
        { id: "r", kind: "recruit", territory: "b", count: 2 },
        { id: "h", kind: "hire", territory: "b", specialist: "scouts" },
      ],
    });
    expect(state.territories.b!.troops).toBe(5);
    expect(find(events, "fizzled")).toMatchObject({ orderId: "h", reason: "hireSite" });
  });

  it("checks the province when the order plays: lose part of it first and the recruit is called off", () => {
    const s = lineGame(ctx, { luck: 0 });
    board(s, { a: ["p1", 3], b: ["p1", 1], c: ["p2", 20], e: ["p2", 3] });
    player(s, "p1").gold = 50;
    const { events } = resolveTurn(ctx, s, {
      p1: [{ id: "r", kind: "recruit", territory: "a", count: 2 }, { id: "r2", kind: "recruit", territory: "b", count: 2 }],
      p2: [{ id: "x", kind: "move", from: "c", to: "b", troops: "all", timing: "first" }],
    });
    expect(find(events, "battle")!.captured).toBe(true);
    // a is the capital (still fine); b now belongs to p2.
    expect(events.filter((e) => e.type === "recruited").map((e) => (e as { territory: string }).territory)).toEqual(["a"]);
  });
});

describe("recruiting: how many", () => {
  const ctx = ctxWith();

  it("All, a share of your gold when it plays, or an exact number", () => {
    expect(recruitCount("all", 21, 2)).toBe(10);
    expect(recruitCount({ share: 0.5 }, 21, 2)).toBe(5);
    expect(recruitCount({ share: 0.25 }, 21, 2)).toBe(2);
    expect(recruitCount({ share: 0.25 }, 3, 2)).toBe(1); // at least 1 if you can afford one
    expect(recruitCount(50, 21, 2)).toBe(10); // as many as you can afford
    expect(recruitCount(0, 21, 2)).toBe(0);
    expect(recruitCount({ share: 0.3 as 0.25 }, 21, 2)).toBe(0); // unknown shares buy nothing
    expect(recruitCount("all", 1, 2)).toBe(0);
  });

  it("split across sites: half here, the rest there", () => {
    const s = lineGame(ctx);
    board(s, { a: ["p1", 1], b: ["p1", 1], e: ["p2", 3] });
    player(s, "p1").gold = 40;
    const { state, events } = resolveTurn(ctx, s, {
      p1: [
        { id: "r1", kind: "recruit", territory: "a", count: { share: 0.5 } },
        { id: "r2", kind: "recruit", territory: "b", count: "all" },
      ],
    });
    expect(state.territories.a!.troops).toBe(11);
    expect(state.territories.b!.troops).toBe(11);
    expect(events.filter((e) => e.type === "recruited").map((e) => (e as { cost: number }).cost)).toEqual([20, 20]);
  });

  it("All spends what's left when it plays, even if an earlier order was called off", () => {
    const s = lineGame(ctx);
    board(s, { a: ["p1", 1], e: ["p2", 3] });
    player(s, "p1").gold = 20;
    // The build fizzles (not held), so All gets the whole 20.
    const { state } = resolveTurn(ctx, s, { p1: [{ id: "b", kind: "build", territory: "c", building: "fort" }, { id: "r", kind: "recruit", territory: "a", count: "all" }] });
    expect(state.territories.a!.troops).toBe(11);
  });
});
