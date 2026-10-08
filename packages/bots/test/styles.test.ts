import { findLeader, viewFor, type LeaderStyle, type Order } from "@conquerra/engine";
import { describe, expect, it } from "vitest";
import { planLeaders } from "../src";
import { scenario } from "./scenario";

/**
 * Session 20c (Nate): a Steward's personality shapes what "Run the realm" buys. The Turtle: forts and culture first;
 * the Merchant: markets first; Neutral: what pays (urgent forts, then markets).
 */
describe("Steward personalities on Run the realm (session 20c)", () => {
  // a b (quiet, ours) c (ours, 3 troops, facing a rival army of 3 at d) | d e (the rival's)
  const buys = (style: LeaderStyle | null, purse = 14, army = 3): Order[] => {
    const { ctx, s } = scenario({ line: "abcdefgh", layout: { a: ["p1", 4], b: ["p1", 3], c: ["p1", 3], d: ["p2", army], e: ["p2", 2], f: ["p2", 2], g: ["p2", 2], h: ["p2", 2] }, caps: ["a", "h"] });
    s.turn = 5;
    const st = findLeader(s.players[0]!, { kind: "steward", of: "p1" })!;
    (st.command = { kind: "realm" }), (st.purse = purse), (st.personality = style);
    return planLeaders({ ctx, view: viewFor(ctx, s, "p1") }).orders.filter((o) => o.steward === "p1");
  };
  const first = (os: Order[]) => os.map((o) => (o.kind === "build" ? `${o.building}@${o.territory}` : o.kind === "invest" ? `culture@${o.territory}` : o.kind))[0];

  it("Neutral: a market where it pays (an army of 3 isn't threat enough for a fort)", () => {
    expect(first(buys(null))).toMatch(/^market@/);
  });

  it("the Turtle: a fort facing the army first", () => {
    expect(first(buys("turtle"))).toBe("fort@c");
  });

  it("the Merchant: markets first, even with an urgent fort to buy (Neutral buys the fort first)", () => {
    expect(first(buys(null, 20, 12))).toBe("fort@c");
    expect(first(buys("merchant", 20, 12))).toMatch(/^market@/);
  });

  it("a war-minded personality on a Steward runs the realm as Neutral does", () => {
    expect(buys("conqueror")).toEqual(buys(null));
  });
});
