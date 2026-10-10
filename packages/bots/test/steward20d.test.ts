import { findLeader, resolveTurn, viewFor, type GameState, type Order } from "@conquerra/engine";
import { describe, expect, it } from "vitest";
import { planLeaders } from "../src";
import { marshalBoard } from "../src/marshal/plan";
import { realmShape } from "../src/marshal/realm";
import { think } from "../src/marshal/judge";
import { freshMemory } from "../src/marshal/memory";
import { marshalData } from "@conquerra/content";
import { scenario } from "./scenario";

/**
 * Session 20d (Nate's third note): the Steward builds with a plan (realm.ts, steward.ts), the Leader garrisons the
 * wall, and the finish's sweep covers the fog.
 *
 * Two rings joined by a pass: a b c d e f (a ring: a-f joined too) | pass f-g | g h i j k l (a ring: g-l joined too).
 * Provinces of three: p0 = a b c, p1 = d e f, p2 = g h i, p3 = j k l. p1's capital a, p2's l.
 */
const rings = (layout: Record<string, [string | null, number]>, extra: { memory?: Record<string, [string | null, number]> } = {}) =>
  scenario({ line: "abcdefghijkl", borders: { fg: "pass" }, extra: [["a", "f"], ["g", "l"]], layout, caps: ["a", "l"], ...extra });
const words = (os: Order[]) => os.map((o) => (o.kind === "build" ? `${o.building}@${o.territory}` : o.kind === "invest" ? `culture@${o.territory}` : o.kind === "move" ? `move>${o.to}` : o.kind));
const ours = { a: ["p1", 4], b: ["p1", 2], c: ["p1", 2], d: ["p1", 2], e: ["p1", 2], f: ["p1", 2] } as Record<string, [string | null, number]>;

describe("the realm's shape (session 20d)", () => {
  it("interior-ness counts steps from the border; choke points are the map's passes and land whose loss would cut the realm", () => {
    const { ctx, s } = rings({ ...ours, g: ["p2", 6], l: ["p2", 3] });
    const view = viewFor(ctx, s, "p1");
    const b = marshalBoard(ctx, view, think(ctx, view, marshalData.judgement, freshMemory()).insight)!;
    const shape = realmShape(b, 4);
    // f touches g (theirs): 0; a and e one step in; b and d two; c three.
    expect(Object.fromEntries([...shape.interior].sort())).toEqual({ a: 1, b: 2, c: 3, d: 2, e: 1, f: 0 });
    // The pass f-g makes f a choke point; our ring has no land whose loss would cut it.
    expect([...shape.choke]).toEqual(["f"]);
    // Wall candidates: the capital's province first (the capital first), then p1 (held whole, facing p2 at g).
    expect(shape.wallCandidates).toEqual(["a", "b", "c", "f", "d", "e"]);
    // A rival army of 6 two steps from the capital's province (a-f-g): threatened.
    expect(shape.threatened).toBe(true);
    // Cut the ring (we lose e): d is now the only way to f... and so is c (a line a-b-c-d with f off a).
    s.territories.e!.owner = null;
    const v2 = viewFor(ctx, s, "p1");
    const shape2 = realmShape(marshalBoard(ctx, v2, think(ctx, v2, marshalData.judgement, freshMemory()).insight)!, 4);
    expect([...shape2.choke].sort()).toEqual(["a", "b", "c", "f"]);
  });
});

describe("the Steward walls up fast (session 20d)", () => {
  const steward = (s: GameState, purse: number) => {
    const st = findLeader(s.players[0]!, { kind: "steward", of: "p1" })!;
    (st.command = { kind: "realm" }), (st.purse = purse);
  };

  it("threatened, with 40 gold, it walls the capital in one turn: the fort and culture 0 to 5 (31 + 8 gold)", () => {
    const { ctx, s } = rings({ ...ours, g: ["p2", 6], l: ["p2", 3] });
    s.turn = 5;
    steward(s, 40);
    const os = planLeaders({ ctx, view: viewFor(ctx, s, "p1") }).orders.filter((o) => o.steward === "p1");
    expect(words(os)).toEqual(["fort@a", "culture@a", "culture@a", "culture@a", "culture@a", "culture@a"]);
    // The engine takes all five levels in one turn; the fort stands at the end of the next, and the wall with it.
    let st = resolveTurn(ctx, s, { p1: os, p2: [] }).state;
    expect(st.territories.a!.culture).toBe(5);
    st = resolveTurn(ctx, st, { p1: [], p2: [] }).state;
    expect(st.territories.a!.building).toBe("fort");
    expect(st.territories.a!.walled).toBe(true);
  });

  it("not threatened: markets come first (never on a fort's plot), and what's left goes into the wall", () => {
    // p1 also holds g h (p2's province isn't whole); p2's army is far away.
    const { ctx, s } = rings({ ...ours, g: ["p1", 2], h: ["p1", 2], k: ["p2", 1], l: ["p2", 1] });
    s.turn = 5;
    steward(s, 40);
    const os = words(planLeaders({ ctx, view: viewFor(ctx, s, "p1") }).orders.filter((o) => o.steward === "p1"));
    // Markets on quiet land that isn't a wall candidate (the capital's province) or a choke point (the pass f-g).
    const markets = os.filter((o) => o.startsWith("market@"));
    expect(markets.length).toBeGreaterThan(0);
    for (const m of markets) expect(["a", "b", "c", "f", "g"]).not.toContain(m.slice(7));
    // ...then the wall.
    expect(os.some((o) => o === "fort@a" || o === "culture@a")).toBe(true);
    expect(os.indexOf("fort@a")).toBeGreaterThan(os.lastIndexOf(markets[markets.length - 1]!));
  });

  it("without the plan (planned: false) it keeps session 20b's way: one level a turn", () => {
    const { ctx, s } = rings({ ...ours, g: ["p2", 6], l: ["p2", 3] });
    s.turn = 5;
    steward(s, 40);
    const os = planLeaders({ ctx, view: viewFor(ctx, s, "p1"), planned: false }).orders.filter((o) => o.steward === "p1");
    expect(words(os).filter((o) => o === "culture@a").length).toBeLessThanOrEqual(1);
  });
});

describe("the Leader garrisons the wall (session 20d)", () => {
  it("troops march into walled land that faces a rival until it holds 4", () => {
    const { ctx, s } = rings({ ...ours, a: ["p1", 20], g: ["p2", 6], l: ["p2", 3] });
    for (const t of ["d", "e", "f"]) Object.assign(s.territories[t]!, { culture: 5, building: "fort", walled: true });
    const l = findLeader(s.players[0]!, { kind: "leader", of: "p1" })!;
    (l.command = { kind: "military" }), (l.purse = 0);
    const os = planLeaders({ ctx, view: viewFor(ctx, s, "p1") }).orders.filter((o) => o.general === "p1");
    const into = os.filter((o): o is Extract<Order, { kind: "move" }> => o.kind === "move" && ["d", "e", "f"].includes(o.to));
    expect(into.length).toBeGreaterThan(0);
    // Nothing marches out of the wall while it's short of its garrison.
    expect(os.filter((o) => o.kind === "move" && ["d", "e", "f"].includes(o.from) && !["d", "e", "f"].includes(o.to))).toEqual([]);
  });
});

describe("the sweep covers the fog (session 20d)", () => {
  // A line a..l: we hold a-f; the remnant (p2) at h, which we remember; i and j in the fog, remembered empty; k and l
  // remembered empty too, but too far from anything of theirs to be theirs since.
  const fogged = (truth: Record<string, [string | null, number]>) => {
    const sc = scenario({
      line: "abcdefghijkl",
      layout: { a: ["p1", 30], b: ["p1", 20], c: ["p1", 20], d: ["p1", 20], e: ["p1", 20], f: ["p1", 20], h: ["p2", 2], ...truth },
      caps: ["a", "h"],
      memory: { h: ["p2", 2], i: [null, 1], j: [null, 1], k: [null, 1], l: [null, 1] },
    });
    sc.s.settings.fog = true;
    const l = findLeader(sc.s.players[0]!, { kind: "leader", of: "p1" })!;
    (l.command = { kind: "cleanup" }), (l.purse = 0);
    return sc;
  };
  const targets = (os: Order[]) => new Set(os.flatMap((o) => (o.kind === "move" ? [o.to] : [])));

  it("its set includes remembered land in the fog and the land next to it they could have reached; never land too far to be theirs", () => {
    const { ctx, s } = fogged({ i: ["p2", 1] });
    const view = viewFor(ctx, s, "p1");
    expect(view.territories.i!.detail).not.toBe("full");
    const t = targets(planLeaders({ ctx, view }).orders);
    for (const x of ["g", "h", "i", "j"]) expect(t.has(x)).toBe(true);
    expect(t.has("k")).toBe(false);
    expect(t.has("l")).toBe(false);
  });

  it("no cheating: what's really in the fog changes nothing it writes; and the same view gives the same orders", () => {
    const a = fogged({ i: ["p2", 1] });
    const b = fogged({ i: [null, 1], k: ["p2", 5], l: ["p2", 1] });
    const oa = planLeaders({ ctx: a.ctx, view: viewFor(a.ctx, a.s, "p1") }).orders;
    const ob = planLeaders({ ctx: b.ctx, view: viewFor(b.ctx, b.s, "p1") }).orders;
    expect(ob).toEqual(oa);
    expect(planLeaders({ ctx: a.ctx, view: viewFor(a.ctx, a.s, "p1") }).orders).toEqual(oa);
  });
});
