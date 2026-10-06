import { describe, expect, it } from "vitest";
import {
  createGame,
  indexMap,
  replayFor,
  resolveTurn,
  troopsFor,
  viewFor,
  visibleTerritories,
  type GameState,
  type Order,
  type StepEvent,
} from "../src";
import { board, ctxWith, embervaleCtx, find, lineGame, mv, player } from "./helpers";

/** A line-map game whose turn-1 seat order is exactly `seats` (the shuffle is the turn's first roll, so try seeds). */
function gameWithSeats(seats: string[]): GameState {
  const ctx = ctxWith();
  for (let i = 0; i < 200; i++) {
    const s = lineGame(ctx, {}, `seats-${i}`);
    const start = find(resolveTurn(ctx, s, {}).events, "turnStart")!;
    if (start.seats.join() === seats.join()) return s;
  }
  throw new Error("no seed gives that seat order");
}

/** The order ids that did something (battles and moves), in the order they ran. */
const ran = (ev: StepEvent[]) => ev.flatMap((e) => (e.type === "battle" || e.type === "moved" || e.type === "recruited" ? [`${e.player}:${e.orderId}`] : []));

describe("chained attacks", () => {
  it("a 3-hop chain plays out in round-robin order, one hop per slot", () => {
    const ctx = ctxWith();
    const s = gameWithSeats(["p1", "p2"]);
    board(s, { a: ["p1", 20], b: [null, 1], c: [null, 1], d: [null, 1], e: ["p2", 5] });
    player(s, "p2").gold = 100;
    const rec = (id: string): Order => ({ id, kind: "recruit", territory: "e", count: 1 });
    const { state, events } = resolveTurn(ctx, s, {
      p1: [mv("a", "b", "all", { id: "h1" }), mv("b", "c", "all", { id: "h2" }), mv("c", "d", "all", { id: "h3" })],
      p2: [rec("r1"), rec("r2"), rec("r3")],
    });
    expect(ran(events)).toEqual(["p1:h1", "p2:r1", "p1:h2", "p2:r2", "p1:h3", "p2:r3"]);
    for (const t of ["b", "c", "d"]) expect(state.territories[t]!.owner).toBe("p1");
  });

  it("leaves 1 troop behind at every hop", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    board(s, { a: ["p1", 20], b: [null, 1], c: [null, 1], d: [null, 1], e: ["p2", 5] });
    const { state, events } = resolveTurn(ctx, s, { p1: [mv("a", "b", "all"), mv("b", "c", "all"), mv("c", "d", "all")] });
    expect(state.territories.a!.troops).toBe(1);
    expect(state.territories.b!.troops).toBe(1);
    expect(state.territories.c!.troops).toBe(1);
    // Each hop sent everyone but the garrison it left behind.
    const sent = events.flatMap((e) => (e.type === "battle" ? [e.attackers.troops] : []));
    expect(sent[0]).toBe(19);
    const arrived = (to: string) => {
      const b = events.find((e) => e.type === "battle" && e.to === to) as Extract<StepEvent, { type: "battle" }>;
      return b.attackers.troops - b.result.attackerLosses;
    };
    expect(sent[1]).toBe(arrived("b") - 1);
    expect(sent[2]).toBe(arrived("c") - 1);
    expect(state.territories.d!.troops).toBe(arrived("d"));
  });

  it("a rival's order can land between two hops and cut the chain", () => {
    const ctx = ctxWith();
    const s = gameWithSeats(["p1", "p2"]);
    board(s, { a: ["p1", 10], b: [null, 1], c: ["p2", 30], d: ["p2", 1], e: ["p2", 1] });
    const { state, events } = resolveTurn(ctx, s, {
      p1: [mv("a", "b", "all", { id: "h1" }), mv("b", "c", "all", { id: "h2" })],
      p2: [mv("c", "b", "all", { id: "counter" })],
    });
    // p1 took b, p2 took it straight back in their slot, so p1's next hop has nowhere to launch from.
    expect(events.find((e) => e.type === "battle" && e.orderId === "h1" && e.captured)).toBeTruthy();
    expect(events.find((e) => e.type === "battle" && e.orderId === "counter" && e.captured)).toBeTruthy();
    const fizzle = events.find((e) => e.type === "fizzled" && e.orderId === "h2") as Extract<StepEvent, { type: "fizzled" }>;
    expect(fizzle.reason).toBe("lostStart");
    expect(state.territories.b!.owner).toBe("p2");
  });

  it("a failed middle hop falls back, and the hops after it fizzle or run their backup", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    board(s, { a: ["p1", 12], b: [null, 1], c: [null, 12], d: [null, 1], e: ["p2", 5] });
    player(s, "p1").gold = 10;
    const { state, events } = resolveTurn(ctx, s, {
      p1: [
        mv("a", "b", "all", { id: "h1" }),
        mv("b", "c", "all", { id: "h2" }),
        mv("c", "d", "all", { id: "h3" }),
        mv("c", "d", "all", { id: "h4", fallback: { id: "h4b", kind: "recruit", territory: "a", count: 2 } }),
      ],
    });
    const h2 = events.find((e) => e.type === "battle" && e.orderId === "h2") as Extract<StepEvent, { type: "battle" }>;
    expect(h2.captured).toBe(false);
    // The survivors of the failed hop fell back to b, where it launched from.
    const survivors = h2.attackers.troops - h2.result.attackerLosses;
    expect(survivors).toBeGreaterThan(0);
    expect(state.territories.b!.troops).toBe(1 + survivors);
    const h3 = events.find((e) => e.type === "fizzled" && e.orderId === "h3") as Extract<StepEvent, { type: "fizzled" }>;
    expect(h3.usedFallback).toBe(false);
    expect(h3.reason).toBe("lostStart");
    expect(events.find((e) => e.type === "fizzled" && e.orderId === "h4")).toMatchObject({ usedFallback: true });
    expect(events.find((e) => e.type === "recruited" && e.orderId === "h4b")).toBeTruthy();
  });

  it("the survivors of a failed attack rest for the rest of the turn", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    board(s, { a: ["p1", 12], b: [null, 40], e: ["p2", 5] });
    const { events } = resolveTurn(ctx, s, { p1: [mv("a", "b", 6, { id: "x1" }), mv("a", "b", "all", { id: "x2" })] });
    const second = events.find((e) => e.type === "battle" && e.orderId === "x2") as Extract<StepEvent, { type: "battle" }>;
    // Only the 5 who stayed home can go the second time.
    expect(second.attackers.troops).toBe(5);
  });

  it("an army that moved into your own land can go on from there", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    board(s, { a: ["p1", 10], b: ["p1", 2], c: ["p1", 1], e: ["p2", 3] });
    const { state } = resolveTurn(ctx, s, { p1: [mv("a", "b", "all"), mv("b", "c", "all")] });
    expect(state.territories.a!.troops).toBe(1);
    expect(state.territories.b!.troops).toBe(1);
    expect(state.territories.c!.troops).toBe(11);
  });

  it("Follow through steps aside when you queued your own next hop, so the army isn't sent twice", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    board(s, { a: ["p1", 20], b: [null, 1], c: [null, 1], d: [null, 1], e: ["p2", 5] });
    const { state, events } = resolveTurn(ctx, s, {
      p1: [mv("a", "b", "all", { id: "ft", preset: { id: "followThrough", next: "c" } }), mv("b", "c", { share: 0.5 }, { id: "manual" })],
    });
    const skip = events.find((e) => e.type === "fizzled" && e.orderId === "ft:next") as Extract<StepEvent, { type: "fizzled" }>;
    expect(skip.reason).toBe("manualHopFirst");
    const manual = events.find((e) => e.type === "battle" && e.orderId === "manual") as Extract<StepEvent, { type: "battle" }>;
    expect(manual).toBeTruthy();
    // Half of the army that arrived at b went on; the rest stayed.
    const first = events.find((e) => e.type === "battle" && e.orderId === "ft") as Extract<StepEvent, { type: "battle" }>;
    const arrived = first.attackers.troops - first.result.attackerLosses;
    expect(manual.attackers.troops).toBe(Math.round(arrived * 0.5));
    expect(state.territories.b!.troops).toBe(arrived - manual.attackers.troops);
    // Without a manual hop, Follow through still pushes on by itself.
    const auto = resolveTurn(ctx, s, { p1: [mv("a", "b", "all", { id: "ft2", preset: { id: "followThrough", next: "c" } })] });
    expect(auto.state.territories.c!.owner).toBe("p1");
  });

  it("cavalry still moves two territories inside one order", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    board(s, { a: ["p1", 10, ["cavalry"]], b: ["p1", 1], c: [null, 1], e: ["p2", 5] });
    const { state } = resolveTurn(ctx, s, { p1: [mv("a", "c", "all", { via: "b" })] });
    expect(state.territories.c!.owner).toBe("p1");
    expect(state.territories.c!.specialists.map((x) => x.type)).toEqual(["cavalry"]);
  });
});

describe("fog and chains", () => {
  it("a chain into the fog never shows the rival more than they could see", () => {
    const ctx = embervaleCtx();
    const idx = indexMap(ctx.map);
    const s = createGame(ctx, { gameId: "fog", seed: "fog-chain", players: [{ id: "p1", name: "A" }, { id: "p2", name: "B" }], settings: { luck: 0 } });
    const cap = player(s, "p1").capital;
    s.territories[cap]!.troops = 60;
    // Walk three hops outward from p1's capital, away from p2.
    const path = [cap];
    const seenBy2 = visibleTerritories(ctx, s, "p2");
    while (path.length < 4) {
      const last = path[path.length - 1]!;
      const next = idx.neighbors.get(last)!.find((n) => !path.includes(n) && s.territories[n]!.owner === null && !seenBy2.has(n));
      if (!next) break;
      path.push(next);
    }
    expect(path.length).toBe(4);
    const orders = path.slice(1).map((to, i) => mv(path[i]!, to, "all"));
    const r = resolveTurn(ctx, s, { p1: orders });
    for (const t of path.slice(1)) expect(r.state.territories[t]!.owner).toBe("p1");

    // p2 never saw any of it: no names, no numbers. At most "a battle in <province>".
    const after = visibleTerritories(ctx, r.state, "p2");
    const sees = (t: string) => seenBy2.has(t) || after.has(t);
    for (const e of replayFor(ctx, s, r, "p2")) {
      if (e.type === "battle") expect(sees(e.from) || sees(e.to)).toBe(true);
      if (e.type === "moved") expect(sees(e.from) || sees(e.to)).toBe(true);
    }
    // And p1 sees only their own land and its neighbours, however deep the chain went.
    const v1 = viewFor(ctx, r.state, "p1");
    const near = new Set<string>();
    for (const id of idx.ids)
      if (r.state.territories[id]!.owner === "p1") for (const t of [id, ...idx.neighbors.get(id)!]) near.add(t);
    for (const id of idx.ids) if (v1.territories[id]!.detail === "full") expect(near.has(id)).toBe(true);
  });

  it("a hop's conditions can't see past the fog", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    board(s, { a: ["p1", 20], b: [null, 1], c: [null, 1], e: ["p2", 5] });
    // When the hop from b runs, p1 sees a, b and c, not p2's capital e: a condition on it counts as "no".
    const { events } = resolveTurn(ctx, s, {
      p1: [mv("a", "b", "all"), mv("b", "c", "all", { id: "peek", conditions: [{ kind: "maxTroops", territory: "e", count: 99 }] })],
    });
    expect(events.find((e) => e.type === "fizzled" && e.orderId === "peek")).toMatchObject({ reason: "condition", detail: { condition: "maxTroops", fogged: true } });
  });
});

describe("amounts as shares", () => {
  const enough = (n: number | null) => () => n;
  it("rounds sensibly, always sends at least 1 and always leaves the garrison", () => {
    // army 10 (9 can go)
    expect(troopsFor("all", 10, 9, enough(null))).toBe(9);
    expect(troopsFor({ share: 0.75 }, 10, 9, enough(null))).toBe(8);
    expect(troopsFor({ share: 0.5 }, 10, 9, enough(null))).toBe(5);
    expect(troopsFor({ share: 0.25 }, 10, 9, enough(null))).toBe(3);
    // small armies
    expect(troopsFor({ share: 0.25 }, 2, 1, enough(null))).toBe(1);
    expect(troopsFor({ share: 0.75 }, 2, 1, enough(null))).toBe(1);
    expect(troopsFor({ share: 0.75 }, 4, 3, enough(null))).toBe(3);
    expect(troopsFor({ share: 0.5 }, 3, 2, enough(null))).toBe(2);
    expect(troopsFor({ share: 0.25 }, 3, 2, enough(null))).toBe(1);
    // a lone garrison can't go anywhere
    for (const a of ["all", "enough", { share: 0.5 }, 5] as const) expect(troopsFor(a, 1, 0, enough(null))).toBe(0);
    // exact numbers: as many as can go
    expect(troopsFor(50, 10, 9, enough(null))).toBe(9);
    expect(troopsFor(0, 10, 9, enough(null))).toBe(0);
    // Just enough, or everyone if not even that would likely win
    expect(troopsFor("enough", 10, 9, enough(4))).toBe(4);
    expect(troopsFor("enough", 10, 9, enough(null))).toBe(9);
  });

  it("a share is taken of the army there when the order plays", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    board(s, { a: ["p1", 9], b: ["p1", 1], c: ["p1", 1], e: ["p2", 5] });
    player(s, "p1").gold = 6;
    // Recruit 3 first: the half is of 12, not of the 9 there when you wrote the order.
    const { state } = resolveTurn(ctx, s, { p1: [{ id: "r", kind: "recruit", territory: "a", count: 3 }, mv("a", "b", { share: 0.5 })] });
    expect(state.territories.b!.troops).toBe(7);
    expect(state.territories.a!.troops).toBe(6);
  });

  it("Just enough sends the fewest troops likely to win, plus a margin", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    board(s, { a: ["p1", 30], b: [null, 3], e: ["p2", 5] });
    const { events, state } = resolveTurn(ctx, s, { p1: [mv("a", "b", "enough")] });
    const b = find(events, "battle")!;
    expect(b.captured).toBe(true);
    expect(b.attackers.troops).toBeLessThan(10);
    expect(state.territories.a!.troops).toBe(30 - b.attackers.troops);
    // Moving into your own land, Just enough means everyone who can go.
    board(s, { a: ["p1", 30], b: ["p1", 1], e: ["p2", 5] });
    const mv2 = resolveTurn(ctx, s, { p1: [mv("a", "b", "enough")] });
    expect(mv2.state.territories.b!.troops).toBe(30);
  });

  it("unknown amounts sent by a broken client just fizzle", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    board(s, { a: ["p1", 10], b: [null, 1], e: ["p2", 5] });
    const { events } = resolveTurn(ctx, s, { p1: [mv("a", "b", { share: 7 } as never), mv("a", "b", { share: Number.NaN } as never)] });
    expect(events.filter((e) => e.type === "fizzled").length).toBe(2);
  });
});

describe("the Leader goes along through a chain (session 16)", () => {
  it("a chain whose every hop takes the Leader carries it to the last land taken, with its +20% at each step", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    board(s, { a: ["p1", 30], b: [null, 1], c: [null, 1], d: [null, 1], e: ["p2", 5] });
    const lead = { withLeader: true };
    const { state, events } = resolveTurn(ctx, s, { p1: [mv("a", "b", "all", lead), mv("b", "c", "all", lead), mv("c", "d", "all", lead)] });
    expect(player(state, "p1").leader).toEqual({ alive: true, territory: "d" });
    const battles = events.filter((e): e is Extract<StepEvent, { type: "battle" }> => e.type === "battle");
    expect(battles.map((b) => [b.to, b.withLeader])).toEqual([["b", true], ["c", true], ["d", true]]);
  });

  it("Follow through carries the Leader on with its army (to a chosen next place, or the weakest neighbour)", () => {
    const ctx = ctxWith();
    for (const next of ["c", undefined]) {
      const s = lineGame(ctx);
      board(s, { a: ["p1", 30], b: [null, 1], c: [null, 1], e: ["p2", 5] });
      const { state, events } = resolveTurn(ctx, s, { p1: [mv("a", "b", "all", { withLeader: true, preset: { id: "followThrough", ...(next ? { next } : {}) } })] });
      const hop = events.filter((e): e is Extract<StepEvent, { type: "battle" }> => e.type === "battle")[1]!;
      expect(hop).toMatchObject({ from: "b", to: "c", withLeader: true, captured: true });
      expect(player(state, "p1").leader.territory).toBe("c");
    }
  });

  it("a Leader left at home stays there while the army chains on", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    board(s, { a: ["p1", 30], b: [null, 1], c: [null, 1], e: ["p2", 5] });
    const { state } = resolveTurn(ctx, s, { p1: [mv("a", "b", "all", { preset: { id: "followThrough" } })] });
    expect(state.territories.c!.owner).toBe("p1");
    expect(player(state, "p1").leader.territory).toBe("a");
  });

  it("the replay shows the Leader where it really is after every step of the chain", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx, { fog: false });
    board(s, { a: ["p1", 30], b: [null, 1], c: [null, 1], e: ["p2", 5] });
    const r = resolveTurn(ctx, s, { p1: [mv("a", "b", "all", { withLeader: true, preset: { id: "followThrough" } })] });
    const replay = replayFor(ctx, s, r, "p2");
    const hops = replay.filter((e) => e.type === "battle");
    expect(hops.every((e) => e.type === "battle" && e.withLeader)).toBe(true);
    expect(viewFor(ctx, r.state, "p2").territories.c).toMatchObject({ leaders: ["p1"] });
  });
});
