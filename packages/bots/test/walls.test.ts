import { defaultRules, marshalData } from "@conquerra/content";
import { findLeader, viewFor, type GameContext, type GameState, type Order } from "@conquerra/engine";
import { describe, expect, it } from "vitest";
import { planLeaders } from "../src";
import { scenario } from "./scenario";

/**
 * Walls (session 20b): "Run the realm" finishes a wall where a territory is nearly there and the land is worth holding
 * (the capital, a choke point, a province held whole, or next to a wall of ours), and nowhere else.
 * The line: a b c | d e f | g h (provinces of three). p1 holds a-e (capital a), p2 holds f-h.
 */
describe("the Steward finishes walls where the land is worth holding (session 20b)", () => {
  const setUp = (extra: (s: GameState) => void, ctxRules?: (c: GameContext) => GameContext) => {
    const sc = scenario({ line: "abcdefgh", layout: { a: ["p1", 4], b: ["p1", 2], c: ["p1", 2], d: ["p1", 2], e: ["p1", 2], f: ["p2", 2], g: ["p2", 2], h: ["p2", 2] }, caps: ["a", "h"] });
    const ctx = ctxRules ? ctxRules(sc.ctx) : sc.ctx;
    const s = sc.s;
    s.turn = 5;
    extra(s);
    const st = findLeader(s.players[0]!, { kind: "steward", of: "p1" })!;
    (st.command = { kind: "realm" }), (st.purse = 14);
    return planLeaders({ ctx, view: viewFor(ctx, s, "p1") }).orders.filter((o) => o.steward === "p1");
  };
  const words = (os: Order[]) => os.map((o) => (o.kind === "build" ? `${o.building}@${o.territory}` : o.kind === "invest" ? `culture@${o.territory}` : o.kind));
  const nearly = (s: GameState, t: string) => Object.assign(s.territories[t]!, { culture: 4, building: "fort" });

  it("the capital one level short of a wall: the last level first", () => {
    expect(words(setUp((s) => nearly(s, "a")))[0]).toBe("culture@a");
  });

  it("land next to a wall of ours is worth walling (it joins up); land worth nothing in particular isn't", () => {
    // d is walled; e (next to it, its province not held whole) is one level short: finished.
    const joined = setUp((s) => {
      Object.assign(s.territories.d!, { culture: 5, building: "fort", walled: true });
      nearly(s, "e");
    });
    expect(words(joined)[0]).toBe("culture@e");
    // e alone, one level short: not the capital, no choke point, its province not whole, no wall next to it.
    expect(words(setUp((s) => nearly(s, "e")))).not.toContain("culture@e");
  });

  it("too far from done (more than the Steward's 18 gold), or walls switched off: no wall-finishing", () => {
    expect(marshalData.leaders.steward.walls.near).toBe(18);
    expect(words(setUp((s) => Object.assign(s.territories.a!, { culture: 1, building: "fort" })))).not.toContain("culture@a");
    const off = (c: GameContext): GameContext => ({ ...c, rules: { ...defaultRules, walls: { ...defaultRules.walls!, on: false } } });
    expect(words(setUp((s) => nearly(s, "a"), off))[0]).not.toBe("culture@a");
  });

  it("a fort first where culture is already at the top (it takes a turn to build)", () => {
    expect(words(setUp((s) => Object.assign(s.territories.a!, { culture: 5 })))[0]).toBe("fort@a");
  });

  it("the Marshals build walls in their own style: the Turtle from furthest away, the Blitzer never", () => {
    const near = Object.fromEntries(marshalData.personalities.map((p) => [p.id, p.build.walls ?? -1]));
    expect(near.blitzer).toBe(0);
    expect(Math.max(...Object.values(near))).toBe(near.turtle);
    expect(Object.values(near).every((x) => x >= 0)).toBe(true);
  });
});
