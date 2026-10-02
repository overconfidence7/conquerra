import { describe, expect, it } from "vitest";
import { createGame, resolveTurn, type Order, type StepEvent } from "../src";
import { board, capOf, ctxWith, embervaleCtx, find, lineGame, mv, player, types } from "./helpers";

describe("setup", () => {
  it("gives each player a capital, leader and starting army", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    expect(new Set(s.players.map((p) => p.capital)).size).toBe(2);
    for (const p of s.players) {
      const cap = s.territories[p.capital]!;
      expect(cap.owner).toBe(p.id);
      expect(cap.troops).toBe(ctx.rules.setup.startTroops);
      expect(cap.specialists).toEqual([]);
      expect(p.leader).toEqual({ alive: true, territory: p.capital });
    }
    expect(s.territories.c!.owner).toBeNull();
  });
  it("stores the turn timer and turn limit (default 300 s; longer allowed; nonsense rejected)", () => {
    const ctx = ctxWith();
    expect(lineGame(ctx).settings.turnTimerSeconds).toBe(300);
    expect(lineGame(ctx, { turnTimerSeconds: 86400 }).settings.turnTimerSeconds).toBe(86400);
    expect(lineGame(ctx, { turnLimit: 25 }).settings.turnLimit).toBe(25);
    expect(() => lineGame(ctx, { turnTimerSeconds: 5 })).toThrow();
    expect(() => lineGame(ctx, { turnLimit: 0 })).toThrow();
    expect(lineGame(ctx, { mode: "conquest" }).settings.turnLimit).toBe(ctx.rules.game.conquestTurnLimitDefault);
  });
  it("rejects bad player counts", () => {
    const ctx = ctxWith();
    expect(() => createGame(ctx, { gameId: "x", seed: "s", players: [{ id: "a", name: "A" }] })).toThrow();
  });
  it("spreads capitals apart on the big map", () => {
    const ctx = embervaleCtx();
    const s = createGame(ctx, {
      gameId: "e",
      seed: "spread",
      players: Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, name: `P${i}` })),
    });
    expect(new Set(s.players.map((p) => p.capital)).size).toBe(6);
  });
});

describe("turn resolution", () => {
  it("does not modify the input state", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    const before = JSON.stringify(s);
    resolveTurn(ctx, s, { p1: [mv(capOf(s, "p1"), "b", "all")] });
    expect(JSON.stringify(s)).toBe(before);
  });

  it("moves leave the garrison behind and capture weak neutrals", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    board(s, { a: ["p1", 8], e: ["p2", 8], b: [null, 2] });
    const { state, events } = resolveTurn(ctx, s, { p1: [mv("a", "b", "all")] });
    expect(state.territories.a!.troops).toBe(1);
    expect(state.territories.b!.owner).toBe("p1");
    expect(types(events)).toContain("battle");
  });

  it("interleaves orders round-robin, one per player per round", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    for (const p of s.players) p.gold = 100;
    const o = (pid: string, i: number): Order => ({ id: `${pid}-${i}`, kind: "recruit", territory: capOf(s, pid), count: 1 });
    const { events } = resolveTurn(ctx, s, { p1: [o("p1", 1), o("p1", 2), o("p1", 3)], p2: [o("p2", 1)] });
    const seats = find(events, "turnStart")!.seats;
    const ids = events.filter((e) => e.type === "recruited").map((e) => (e as { orderId: string }).orderId);
    const [first, second] = seats;
    expect(ids).toEqual([`${first}-1`, `${second}-1`, "p1-2", "p1-3"]);
  });

  it("recruiting more than you can afford buys as many as you can pay for", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    player(s, "p1").gold = ctx.rules.troops.cost * 3 + 1;
    const { events } = resolveTurn(ctx, s, { p1: [{ id: "r", kind: "recruit", territory: capOf(s, "p1"), count: 50 }] });
    expect(find(events, "recruited")).toMatchObject({ count: 3 });
  });

  it("an order whose conditions fail runs its fallback instead", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    const cap = capOf(s, "p1");
    player(s, "p1").gold = 100;
    const order: Order = {
      id: "big",
      kind: "hire",
      territory: cap,
      specialist: "cavalry",
      conditions: [{ kind: "goldAtLeast", amount: 999 }],
      fallback: { id: "backup", kind: "recruit", territory: cap, count: 2 },
    };
    const { state, events } = resolveTurn(ctx, s, { p1: [order] });
    expect(find(events, "fizzled")).toMatchObject({ orderId: "big", usedFallback: true });
    expect(find(events, "recruited")).toMatchObject({ orderId: "backup", count: 2 });
    expect(state.territories[cap]!.specialists).toEqual([]);
  });

  it("an order that is no longer possible fizzles and the queue continues", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    board(s, { a: ["p1", 8], e: ["p2", 8], b: [null, 1] });
    player(s, "p1").gold = 100;
    const { events } = resolveTurn(ctx, s, {
      p1: [mv("a", "b", "all"), mv("a", "b", "all", { id: "second" }), { id: "third", kind: "build", territory: "a", building: "watchtower" }],
    });
    expect(find(events, "fizzled")).toMatchObject({ orderId: "second", reason: "no troops available to move" });
    expect(find(events, "built")).toBeTruthy();
  });

  it("troops that moved can't move again the same turn", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    board(s, { a: ["p1", 10], b: ["p1", 2], c: ["p1", 1], e: ["p2", 3] });
    const { state } = resolveTurn(ctx, s, { p1: [mv("a", "b", "all"), mv("b", "c", "all")] });
    // b's own 2 fresh soldiers go on to c (the 9 who just arrived stay and count as the garrison).
    expect(state.territories.b!.troops).toBe(9);
    expect(state.territories.c!.troops).toBe(3);
  });

  it("Seize the Initiative goes before everyone, then goes on cooldown", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    for (const p of s.players) p.gold = 100;
    const rec = (pid: string, id: string, timing?: "first"): Order => ({ id, kind: "recruit", territory: capOf(s, pid), count: 1, ...(timing ? { timing } : {}) });
    const t1 = resolveTurn(ctx, s, { p1: [rec("p1", "n1")], p2: [rec("p2", "fast", "first")] });
    expect(find(t1.events, "recruited")!.orderId).toBe("fast");
    expect(player(t1.state, "p2").cooldowns.seize).toBeGreaterThan(0);
    const t2 = resolveTurn(ctx, t1.state, { p2: [rec("p2", "again", "first")] });
    expect(t2.events.some((e) => e.type === "initiative")).toBe(false);
  });

  it("Lie in Wait runs after everyone else", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    for (const p of s.players) p.gold = 100;
    const rec = (pid: string, id: string, timing?: "last"): Order => ({ id, kind: "recruit", territory: capOf(s, pid), count: 1, ...(timing ? { timing } : {}) });
    const { events } = resolveTurn(ctx, s, { p1: [rec("p1", "late", "last"), rec("p1", "a1")], p2: [rec("p2", "b1"), rec("p2", "b2")] });
    const ids = events.filter((e) => e.type === "recruited").map((e) => (e as { orderId: string }).orderId);
    expect(ids[ids.length - 1]).toBe("late");
  });

  it("taking the last territory eliminates a player and ends the game", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    board(s, { a: ["p1", 1], b: ["p1", 1], c: ["p1", 1], d: ["p1", 30], e: ["p2", 1] });
    const { state, events } = resolveTurn(ctx, s, { p1: [mv("d", "e", "all")] });
    expect(player(state, "p2").eliminatedTurn).toBe(1);
    expect(player(state, "p2").eliminatedBy).toBe("p1");
    expect(player(state, "p1").eliminatedBy).toBeNull();
    expect(find(events, "eliminated")).toMatchObject({ player: "p2", by: "p1" });
    expect(state.winner).toBe("p1");
    expect(state.endReason).toBe("lastStanding");
    expect(() => resolveTurn(ctx, state, {})).toThrow();
  });

  it("a fallen leader comes back for free at the capital, ready for the next turn", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    board(s, { a: ["p1", 40], b: ["p2", 2], e: ["p2", 3] });
    const p2 = player(s, "p2");
    p2.leader = { alive: true, territory: "b" };
    p2.gold = 0;
    p2.cooldowns = { seize: 2, lie: 1 };
    const t1 = resolveTurn(ctx, s, { p1: [mv("a", "b", "all")] });
    const killed = t1.events.findIndex((e) => e.type === "leaderKilled" && e.player === "p2");
    const back = t1.events.findIndex((e) => e.type === "leaderReturned" && e.player === "p2");
    expect(killed).toBeGreaterThanOrEqual(0);
    expect(back).toBeGreaterThan(killed);
    expect(find(t1.events, "leaderReturned")).toMatchObject({ player: "p2", territory: "e" });
    expect(player(t1.state, "p2").leader).toEqual({ alive: true, territory: "e" });
    // Free, and the leader's cooldowns just tick down as usual.
    expect(player(t1.state, "p2").cooldowns).toEqual({ seize: 1, lie: 0 });
    expect(t1.state.players.find((p) => p.id === "p2")!.gold).toBeGreaterThanOrEqual(0);
  });

  it("if the capital is lost, the leader comes back at the player's strongest territory", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    board(s, { a: ["p1", 40], b: ["p2", 1], c: ["p2", 7], d: ["p2", 4], e: ["p1", 5] });
    const p2 = player(s, "p2");
    p2.leader = { alive: true, territory: "b" };
    const { state, events } = resolveTurn(ctx, s, { p1: [mv("a", "b", "all")] });
    expect(find(events, "leaderReturned")).toMatchObject({ player: "p2", territory: "c" });
    expect(player(state, "p2").leader).toEqual({ alive: true, territory: "c" });
  });

  it("living leaders and eliminated players don't get a return event", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    board(s, { a: ["p1", 1], b: ["p1", 1], c: ["p1", 1], d: ["p1", 30], e: ["p2", 1] });
    const { events } = resolveTurn(ctx, s, { p1: [mv("d", "e", "all")] });
    expect(events.some((e) => e.type === "leaderReturned")).toBe(false);
  });

  it("collects income and charges upkeep that grows with empire size", () => {
    const ctx = ctxWith((r) => {
      r.economy.upkeepFreeTerritories = 1;
      r.economy.upkeepRate = 1;
      r.economy.upkeepExponent = 1;
      r.economy.capitalIncome = 4;
      r.terrain.plains.income = 2;
    });
    const s = lineGame(ctx);
    board(s, { a: ["p1", 1], b: ["p1", 1], c: ["p1", 1], e: ["p2", 1] });
    player(s, "p1").gold = 0;
    const { events } = resolveTurn(ctx, s, {});
    const inc = events.find((e) => e.type === "income" && e.player === "p1") as Extract<StepEvent, { type: "income" }>;
    expect(inc.upkeep).toBe(2); // 3 territories, 1 free
    // plains 2 each = 6, capital +4, provinces west(2)+mid(1) = 3  => 13 - 2 = 11
    expect(inc.goldAfter).toBe(11);
  });

  it("conquest mode ends on the turn limit with the highest score", () => {
    const ctx = ctxWith();
    let s = lineGame(ctx, { mode: "conquest", turnLimit: 2 });
    board(s, { a: ["p1", 3], b: ["p1", 3], c: ["p1", 3], e: ["p2", 3] });
    s = resolveTurn(ctx, s, {}).state;
    const end = resolveTurn(ctx, s, {});
    expect(end.state.endReason).toBe("turnLimit");
    expect(end.state.winner).toBe("p1");
  });

  it("classic games stop at the hard turn cap", () => {
    const ctx = ctxWith((r) => (r.game.maxTurnsHard = 2));
    let s = lineGame(ctx);
    s = resolveTurn(ctx, s, {}).state;
    expect(resolveTurn(ctx, s, {}).state.endReason).toBe("turnCap");
  });

  it("survives garbage in the order list", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    const junk = [{ id: "x", kind: "teleport" }, { id: "y", kind: "move", from: "zz", to: "a", troops: "lots" }] as unknown as Order[];
    const { events } = resolveTurn(ctx, s, { p1: junk, p2: "nope" as unknown as Order[] });
    expect(events.filter((e) => e.type === "fizzled")).toHaveLength(2);
  });
});
