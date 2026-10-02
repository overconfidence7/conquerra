import { describe, expect, it } from "vitest";
import { createGame, resolveTurn, totalUnits, viewFor, type Order, type StepEvent } from "../src";
import { board, capOf, ctxWith, embervaleCtx, lineGame, mv } from "./helpers";

const types = (ev: StepEvent[]) => ev.map((e) => e.type);

describe("setup", () => {
  it("gives each player a capital, leader and starting army", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    expect(new Set(s.players.map((p) => p.capital)).size).toBe(2);
    for (const p of s.players) {
      expect(s.territories[p.capital]!.owner).toBe(p.id);
      expect(p.leader).toEqual({ alive: true, territory: p.capital });
    }
    expect(s.territories.c!.owner).toBeNull();
  });
  it("rejects bad player counts and conquest without a turn limit", () => {
    const ctx = ctxWith();
    expect(() => createGame(ctx, { gameId: "x", seed: "s", players: [{ id: "a", name: "A" }] })).toThrow();
    expect(() =>
      createGame(ctx, {
        gameId: "x",
        seed: "s",
        players: [
          { id: "a", name: "A" },
          { id: "b", name: "B" },
        ],
        settings: { mode: "conquest" },
      }),
    ).toThrow();
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
    const cap = capOf(s, "p1");
    const next = cap === "a" ? "b" : "d";
    const { state, events } = resolveTurn(ctx, s, { p1: [mv(cap, next, "all")] });
    expect(totalUnits(state.territories[cap]!.units)).toBe(1);
    expect(state.territories[next]!.owner).toBe("p1");
    expect(types(events)).toContain("battle");
  });

  it("interleaves orders round-robin, one per player per round", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    const o = (pid: string, i: number): Order => ({ id: `${pid}-${i}`, kind: "recruit", territory: capOf(s, pid), unit: "infantry", count: 1 });
    const { events } = resolveTurn(ctx, s, { p1: [o("p1", 1), o("p1", 2), o("p1", 3)], p2: [o("p2", 1)] });
    const seats = (events[0] as Extract<StepEvent, { type: "turnStart" }>).seats;
    const ids = events.filter((e) => e.type === "recruited").map((e) => (e as { orderId: string }).orderId);
    const [first, second] = seats;
    expect(ids).toEqual([`${first}-1`, `${second}-1`, "p1-2", "p1-3"]);
  });

  it("an order whose conditions fail runs its fallback instead", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    const cap = capOf(s, "p1");
    const order: Order = {
      id: "attack",
      kind: "recruit",
      territory: cap,
      unit: "cavalry",
      count: 1,
      conditions: [{ kind: "goldAtLeast", amount: 999 }],
      fallback: { id: "backup", kind: "recruit", territory: cap, unit: "infantry", count: 2 },
    };
    const { state, events } = resolveTurn(ctx, s, { p1: [order] });
    expect(events.find((e) => e.type === "fizzled")).toMatchObject({ orderId: "attack", usedFallback: true });
    expect(events.find((e) => e.type === "recruited")).toMatchObject({ orderId: "backup", unit: "infantry", count: 2 });
    expect(state.territories[cap]!.units.cavalry).toBe(1); // only the starting cavalry
  });

  it("an order that is no longer possible fizzles and the queue continues", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    const cap = capOf(s, "p1");
    const next = cap === "a" ? "b" : "d";
    const { events } = resolveTurn(ctx, s, {
      p1: [mv(cap, next, "all"), mv(cap, next, "all", { id: "second" }), { id: "third", kind: "build", territory: cap, building: "watchtower" }],
    });
    expect(events.find((e) => e.type === "fizzled")).toMatchObject({ orderId: "second", reason: "no units available to move" });
    expect(events.find((e) => e.type === "built")).toBeTruthy();
  });

  it("units that moved can't move again the same turn", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    board(s, { a: ["p1", 10], b: ["p1", 1], c: ["p1", 1], e: ["p2", 3] });
    const { state } = resolveTurn(ctx, s, { p1: [mv("a", "b", "all"), mv("b", "c", "all")] });
    // b's own fresh soldier could go on to c; the 9 who just arrived from a could not.
    expect(state.territories.b!.units.infantry).toBe(9);
    expect(state.territories.c!.units.infantry).toBe(2);
  });

  it("only cavalry can make a two-territory move, through land you hold", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    board(s, { a: ["p1", { infantry: 2, cavalry: 4 }], b: ["p1", 1], c: [null, 2], e: ["p2", 3] });
    const ok = resolveTurn(ctx, s, { p1: [mv("a", "c", { cavalry: 4 }, { via: "b" })] });
    expect(ok.events.some((e) => e.type === "battle" && e.to === "c")).toBe(true);
    const bad = resolveTurn(ctx, s, { p1: [mv("a", "c", { infantry: 1 }, { via: "b" })] });
    expect(bad.events.find((e) => e.type === "fizzled")).toMatchObject({ reason: "only cavalry can move two territories" });
  });

  it("Seize the Initiative goes before everyone, then goes on cooldown", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    const rec = (pid: string, id: string, timing?: "first"): Order => ({
      id, kind: "recruit", territory: capOf(s, pid), unit: "infantry", count: 1, ...(timing ? { timing } : {}),
    });
    const t1 = resolveTurn(ctx, s, { p1: [rec("p1", "n1")], p2: [rec("p2", "fast", "first")] });
    const firstRecruit = t1.events.find((e) => e.type === "recruited") as { orderId: string };
    expect(firstRecruit.orderId).toBe("fast");
    expect(t1.state.players.find((p) => p.id === "p2")!.cooldowns.seize).toBeGreaterThan(0);
    const t2 = resolveTurn(ctx, t1.state, { p2: [rec("p2", "again", "first")] });
    expect(t2.events.some((e) => e.type === "initiative")).toBe(false);
  });

  it("Lie in Wait runs after everyone else", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    const rec = (pid: string, id: string, timing?: "last"): Order => ({
      id, kind: "recruit", territory: capOf(s, pid), unit: "infantry", count: 1, ...(timing ? { timing } : {}),
    });
    const { events } = resolveTurn(ctx, s, { p1: [rec("p1", "late", "last"), rec("p1", "a1")], p2: [rec("p2", "b1"), rec("p2", "b2")] });
    const ids = events.filter((e) => e.type === "recruited").map((e) => (e as { orderId: string }).orderId);
    expect(ids[ids.length - 1]).toBe("late");
  });

  it("taking the last territory eliminates a player and ends the game", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    board(s, { a: ["p1", 1], b: ["p1", 1], c: ["p1", 1], d: ["p1", 30], e: ["p2", 1] });
    const { state, events } = resolveTurn(ctx, s, { p1: [mv("d", "e", "all")] });
    expect(state.players.find((p) => p.id === "p2")!.eliminatedTurn).toBe(1);
    expect(events.find((e) => e.type === "eliminated")).toMatchObject({ player: "p2", by: "p1" });
    expect(state.winner).toBe("p1");
    expect(state.endReason).toBe("lastStanding");
    expect(() => resolveTurn(ctx, state, {})).toThrow();
  });

  it("killing a leader in battle removes it; it can be raised again at the capital", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    board(s, { a: ["p1", 40], b: ["p2", 2], e: ["p2", 3] });
    const p2 = s.players.find((p) => p.id === "p2")!;
    p2.leader = { alive: true, territory: "b" };
    p2.gold = 100;
    const t1 = resolveTurn(ctx, s, { p1: [mv("a", "b", "all")] });
    expect(t1.events.some((e) => e.type === "leaderKilled" && e.player === "p2")).toBe(true);
    const t2 = resolveTurn(ctx, t1.state, { p2: [{ id: "raise", kind: "raiseLeader" }] });
    expect(t2.state.players.find((p) => p.id === "p2")!.leader).toEqual({ alive: true, territory: "e" });
  });

  it("collects income and charges upkeep that grows with empire size", () => {
    const ctx = ctxWith((r) => {
      r.economy.upkeepFreeTerritories = 1;
      r.economy.upkeepRate = 1;
      r.economy.upkeepExponent = 1;
    });
    const s = lineGame(ctx);
    board(s, { a: ["p1", 1], b: ["p1", 1], c: ["p1", 1], e: ["p2", 1] });
    s.players.find((p) => p.id === "p1")!.gold = 0;
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
});

describe("fog of war", () => {
  it("hides territories you can't see, and other players' gold", () => {
    const ctx = embervaleCtx();
    const s = createGame(ctx, {
      gameId: "f",
      seed: "fog",
      players: [
        { id: "p1", name: "A" },
        { id: "p2", name: "B" },
      ],
    });
    const v = viewFor(ctx, s, "p1");
    const visible = Object.values(v.territories).filter((t) => t.visible).length;
    expect(visible).toBeGreaterThan(1);
    expect(visible).toBeLessThan(10);
    const enemyCap = s.players.find((p) => p.id === "p2")!.capital;
    expect(v.territories[enemyCap]!.visible).toBe(false);
    expect(JSON.stringify(v.players)).not.toContain("gold");
    expect(JSON.stringify(v)).not.toContain('"rng"');
  });
  it("shows everything when fog is off", () => {
    const ctx = embervaleCtx();
    const s = createGame(ctx, {
      gameId: "f",
      seed: "fog",
      players: [
        { id: "p1", name: "A" },
        { id: "p2", name: "B" },
      ],
      settings: { fog: false },
    });
    expect(Object.values(viewFor(ctx, s, "p1").territories).every((t) => t.visible)).toBe(true);
  });
});
