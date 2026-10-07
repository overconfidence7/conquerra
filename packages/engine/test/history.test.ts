import { describe, expect, it } from "vitest";
import { createGame, makeSave, readSave, resolveTurn, stateFingerprint, viewFor, type GameState, type Order } from "../src";
import { board, ctxWith, embervaleCtx, lineGame, mv, player } from "./helpers";

const ctx = ctxWith();

describe("the game's record for its end (session 16)", () => {
  it("land held after every turn, from the start (turn 0)", () => {
    let s = lineGame(ctx);
    expect(s.history).toEqual([{ turn: 0, land: { p1: 1, p2: 1 } }]);
    board(s, { a: ["p1", 20], e: ["p2", 5] });
    s = resolveTurn(ctx, s, { p1: [mv("a", "b", "all"), mv("b", "c", "all")] }).state;
    expect(s.history.at(-1)).toEqual({ turn: 1, land: { p1: 3, p2: 1 } });
    s = resolveTurn(ctx, s, {}).state;
    expect(s.history.map((h) => h.turn)).toEqual([0, 1, 2]);
  });

  it("tallies what each House did: battles won (taken and held), Leaders felled, culture, buildings, recruits", () => {
    const s = lineGame(ctx);
    board(s, { a: ["p1", 30], b: [null, 1], c: ["p2", 1], d: ["p2", 20], e: ["p2", 5] });
    player(s, "p1").gold = 100;
    player(s, "p2").leader = { alive: true, territory: "c" };
    const orders: Order[] = [
      { id: "r", kind: "recruit", territory: "a", count: 5 },
      { id: "i", kind: "invest", territory: "a" },
      { id: "f", kind: "build", territory: "a", building: "fort" },
      mv("a", "b", 10, { id: "m1" }),
      mv("b", "c", "all", { id: "m2" }),
    ];
    const r = resolveTurn(ctx, s, { p1: orders, p2: [mv("e", "d", 2)] });
    const p1 = r.state.stats.p1!;
    expect(p1).toMatchObject({ captures: 2, battlesWon: 2, leadersKilled: 1, culture: 1, recruited: 5 });
    // A fort takes a turn to finish: counted when it does.
    expect(p1.buildings).toBe(0);
    const next = resolveTurn(ctx, r.state, {});
    expect(next.state.stats.p1!.buildings).toBe(1);
    // An attack held off is a battle won for the defender.
    const s2 = lineGame(ctx);
    board(s2, { a: ["p1", 3], b: ["p2", 20], e: ["p2", 5] });
    const held = resolveTurn(ctx, s2, { p1: [mv("a", "b", "all")] }).state.stats;
    expect(held.p2).toMatchObject({ holds: 1, battlesWon: 1 });
    expect(held.p1!.battlesWon).toBe(0);
  });

  it("is hidden from everyone during the game (no land counts), and shown to everyone once it's over", () => {
    const s = lineGame(ctx);
    board(s, { a: ["p1", 30], e: ["p2", 1] });
    expect(viewFor(ctx, s, "p1").history).toBeUndefined();
    expect(viewFor(ctx, s, "p2").stats).toBeUndefined();
    const end: GameState = { ...s, winner: "p1" };
    expect(viewFor(ctx, end, "p2").history).toEqual(s.history);
    expect(Object.keys(viewFor(ctx, end, "p2").stats!)).toEqual(["p1", "p2"]);
  });

  it("is deterministic, and a game saved before it carries on (state version 8 -> 9): the graph starts where it was saved", () => {
    const run = () => {
      const c = embervaleCtx();
      let s = createGame(c, { gameId: "h", seed: "history", players: ["a", "b", "c", "d"].map((id) => ({ id, name: id })) });
      for (let i = 0; i < 10 && !s.winner; i++) s = resolveTurn(c, s, {}).state;
      return s;
    };
    expect(stateFingerprint(run())).toBe(stateFingerprint(run()));
    const s = run();
    const old = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    old.version = 8;
    delete old.history;
    delete old.stats;
    const c = embervaleCtx();
    const read = readSave(JSON.parse(JSON.stringify({ ...makeSave(c, s, "a", 0), state: old })));
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.save.state.history).toEqual([{ turn: s.turn - 1, land: s.history.at(-1)!.land }]);
    expect(Object.values(read.save.state.stats).every((x) => x.battlesWon === 0)).toBe(true);
    expect(resolveTurn(c, read.save.state, {}).state.history).toHaveLength(2);
  });
});
