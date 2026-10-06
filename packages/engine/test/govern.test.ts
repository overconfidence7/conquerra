import { describe, expect, it } from "vitest";
import { governLine, incomeFor, makeSave, readSave, resolveTurn, stateFingerprint, type GameState, type Order, type StepEvent } from "../src";
import { board, ctxWith, lineGame, mv, player } from "./helpers";

/**
 * "Govern this province" (session 15). The line map: a - b | c | d - e, provinces West (a, b), Mid (c), East (d, e).
 * p1 holds West (a, b), its Leader at a; p2 holds c, d, e.
 */
const ctx = ctxWith();
const govern = (general = "p1"): Order => ({ id: `gov-${general}`, kind: "instruct", general, instruction: { kind: "govern" } });
const of = <T extends StepEvent["type"]>(ev: readonly StepEvent[], type: T) => ev.filter((e): e is Extract<StepEvent, { type: T }> => e.type === type);
const names = { general: (g: string) => (g === "p1" ? "Your Leader" : g), place: (t: string) => t.toUpperCase(), province: (p: string) => p[0]!.toUpperCase() + p.slice(1) };

function game(layout: Parameters<typeof board>[1] = { a: ["p1", 6], b: ["p1", 4], c: ["p2", 5], d: ["p2", 3], e: ["p2", 5] }) {
  const s = lineGame(ctx);
  board(s, layout);
  player(s, "p1").gold = 10;
  player(s, "p2").gold = 10;
  return s;
}
const run = (s: GameState, orders: Order[] = [], c = ctx) => resolveTurn(c, s, { p1: orders });

describe("Govern this province", () => {
  it("only where you hold most of the province's land", () => {
    expect(run(game(), [govern()]).state.players[0]!.command).toEqual({ kind: "govern" });
    // Holding only a of West (one of two): not most of it.
    const half = game({ a: ["p1", 6], b: ["p2", 4], c: ["p2", 5], e: ["p2", 5] });
    expect(run(half, [govern()]).state.players[0]!.command).toBeNull();
  });

  it("keeps a quarter of the province's own income (never your own gold) and the rest goes home as usual", () => {
    const plain = run(game());
    const gov = run(game(), [govern()]);
    // West: two plains (2 + 2) and its holding bonus (2) = 6; a quarter, rounded down: 1.
    const e = of(gov.events, "governed")[0]!;
    expect(e).toMatchObject({ player: "p1", general: "p1", province: "west", kept: 1, spent: [] });
    expect(gov.state.players[0]!.gold).toBe(plain.state.players[0]!.gold - 1);
    expect(gov.state.players[0]!.purse).toEqual([{ general: "p1", province: "west", saved: 1, goal: { what: "fort", territory: "b", cost: 8 } }]);
    expect(governLine(e, names)).toBe("Your Leader governs West: kept 1 gold (a fort at B: 1 of 8 gold).");
    // Income itself is unchanged: the share comes out of it.
    expect(incomeFor(ctx, gov.state, "p1").net).toBe(incomeFor(ctx, plain.state, "p1").net);
  });

  it("spends it on the province: a fort on the most threatened frontier first, then culture where it's most exposed, then troops", () => {
    const rich = ctxWith((r) => (r.generals.govern.share = 1));
    let s = run(game(), [govern()], rich).state;
    // 6 a turn: after two turns, 12 saved: the fort at b (facing p2's army at c), then culture where it's most exposed
    // (b again: a faces nobody), with what's left.
    const r = run(s, [], rich);
    expect(of(r.events, "governed")[0]).toMatchObject({ spent: [{ what: "fort", territory: "b", gold: 8 }, { what: "culture", territory: "b", gold: 3 }] });
    expect(r.state.territories.b!.construction).toMatchObject({ building: "fort" });
    expect(r.state.territories.b!.culture).toBe(1);
    expect(governLine(of(r.events, "governed")[0]!, names)).toBe("Your Leader governs West: kept 6 gold, began a fort at B, raised culture in B.");
    s = r.state;
    // Troops when there's nothing else to buy.
    const done = game({ a: ["p1", 6, [], { culture: 5, building: "market" }], b: ["p1", 4, [], { culture: 5, building: "fort" }], c: ["p2", 5], e: ["p2", 5] });
    done.players[0]!.command = { kind: "govern" };
    done.players[0]!.purse = [{ general: "p1", province: "west", saved: 5, goal: null }];
    const t = run(done, [], rich);
    // (West's income with culture 5 everywhere: 2 + 2.5 twice, plus the bonus 2 + 2.5 = 13; 5 + 13 = 18 gold: 9 troops.)
    expect(of(t.events, "governed")[0]!.spent).toEqual([{ what: "troops", territory: "a", gold: 18, troops: 9 }]);
    expect(t.state.territories.a!.troops).toBe(6 + 9);
  });

  it("if the general leaves the province, or is lost, its progress goes home", () => {
    // p1 also holds c (Mid): the Leader marches there with its army.
    const s = game({ a: ["p1", 6], b: ["p1", 4], c: ["p1", 2], d: ["p2", 3], e: ["p2", 5] });
    s.players[0]!.command = { kind: "govern" };
    s.players[0]!.leader = { alive: true, territory: "b" };
    s.players[0]!.purse = [{ general: "p1", province: "west", saved: 5, goal: null }];
    const stay = run(structuredClone(s));
    const left = run(s, [mv("b", "c", 3, { withLeader: true })]);
    expect(of(left.events, "purseHome")[0]).toMatchObject({ province: "west", gold: 5 });
    expect(governLine(of(left.events, "purseHome")[0]!, names)).toBe("Your Leader no longer governs West: the 5 gold it was saving went home.");
    // It governs Mid now instead (it holds all of it).
    expect(left.state.players[0]!.purse.map((x) => x.province)).toEqual(["mid"]);
    expect(left.state.players[0]!.gold).toBeGreaterThan(stay.state.players[0]!.gold);
    // Given another instruction: home too.
    const other = run(game(), [govern()]).state;
    const r = run(other, [{ id: "h", kind: "instruct", general: "p1", instruction: { kind: "hold" } }]);
    expect(of(r.events, "purseHome")).toHaveLength(1);
    expect(r.state.players[0]!.purse).toEqual([]);
  });

  it("is deterministic, and a save brings it along (and a save from before it carries on: state version 6 -> 7)", () => {
    const play = () => {
      let s = game();
      s = run(s, [govern()]).state;
      for (let i = 0; i < 4; i++) s = run(s).state;
      return s;
    };
    expect(stateFingerprint(play())).toBe(stateFingerprint(play()));
    const s = play();
    const old = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    old.version = 6;
    for (const p of old.players as Record<string, unknown>[]) delete p.purse;
    const read = readSave(JSON.parse(JSON.stringify({ ...makeSave(ctx, s, "p1", 0), state: old })));
    expect(read.ok).toBe(true);
    if (read.ok) expect(read.save.state.players.every((p) => Array.isArray(p.purse) && p.purse.length === 0)).toBe(true);
  });
});
