import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { autoSpoils, readSave, replayFor, resolveTurn, setsIn, stateFingerprint, viewFor, withoutSet, type GameState, type Order, type SpoilsMark, type SpoilsSet } from "../src";
import { indexMap } from "../src/mapIndex";
import { board, ctxWith, embervaleCtx, find, lineGame, mv, player } from "./helpers";
import { createGame } from "../src";

const ctx = ctxWith();
const cfg = ctx.rules.spoils;
const spoils = (set: SpoilsSet, territory?: string): Order =>
  ({ id: `sp-${set}`, kind: "spoils", set, ...(territory ? { territory } : {}) }) as Order;

/** p1 holds a and b (capital a), p2 holds d and e (capital e); c is neutral. */
function game(hand: SpoilsMark[] = [], settings: Partial<GameState["settings"]> = {}): GameState {
  const s = lineGame(ctx, { fate: false, ...settings });
  board(s, { a: ["p1", 10], b: ["p1", 6], c: [null, 1], d: ["p2", 2], e: ["p2", 10] });
  player(s, "p1").spoils = [...hand];
  return s;
}

describe("Spoils: earning", () => {
  it("one card at the end of a turn you took land, at most one a turn; none on a turn you didn't", () => {
    const s = game();
    // Two captures in one turn: still one card.
    const r = resolveTurn(ctx, s, { p1: [mv("b", "c", 4)], p2: [] });
    expect(r.state.territories.c!.owner).toBe("p1");
    expect(player(r.state, "p1").spoils).toHaveLength(1);
    expect(player(r.state, "p2").spoils).toHaveLength(0);
    const earned = r.events.filter((e) => e.type === "spoilsEarned");
    expect(earned).toHaveLength(1);
    expect(earned[0]).toMatchObject({ player: "p1", hand: 1 });
    const r2 = resolveTurn(ctx, r.state, { p1: [mv("c", "d", "all"), mv("d", "e", "all")], p2: [] });
    expect(r2.events.filter((e) => e.type === "battle" && e.captured && e.player === "p1").length).toBeGreaterThanOrEqual(1);
    expect(player(r2.state, "p1").spoils).toHaveLength(2);
    // A quiet turn: nothing.
    const r3 = resolveTurn(ctx, r2.state, {});
    expect(player(r3.state, "p1").spoils).toHaveLength(2);
  });

  it("the marks come from the game's seed (the deck's own sequence): same seed, same marks; and the dice don't change", () => {
    const marks = (seed: string, on = true) => {
      let s = lineGame(ctx, { fate: false, spoils: on }, seed);
      board(s, { a: ["p1", 40], c: [null, 1], e: ["p2", 40] });
      const out: SpoilsMark[] = [];
      const rolls: number[] = [];
      for (let i = 0; i < 6; i++) {
        // Take a neutral territory each turn (it's given back to neutral before the next).
        const r = resolveTurn(ctx, s, { p1: [mv("a", "b", 3)] });
        rolls.push(...r.events.filter((e) => e.type === "battle").map((e) => (e.type === "battle" ? e.result.attackerLosses * 100 + e.result.defenderLosses : 0)));
        s = r.state;
        out.push(...player(s, "p1").spoils.splice(0));
        s.territories.b = { owner: null, troops: 1, specialists: [], building: null, construction: null, culture: 0 };
        s.territories.a!.troops = 40;
      }
      return { out, rolls };
    };
    const a = marks("seed-one");
    expect(a.out).toHaveLength(6);
    expect(marks("seed-one").out).toEqual(a.out);
    expect(marks("seed-two").out).not.toEqual(a.out);
    // Every mark turns up in a long run.
    const many = [...marks("x1").out, ...marks("x2").out, ...marks("x3").out, ...marks("x4").out];
    expect(new Set(many)).toEqual(new Set(["sword", "tower", "laurel"]));
    // The Spoils deck draws from its own sequence: with it off, every battle rolls exactly the same.
    expect(marks("seed-one", false).rolls).toEqual(a.rolls);
    expect(marks("seed-one", false).out).toEqual([]);
  });
});

describe("Spoils: sets and windfalls (numbers from rules.spoils)", () => {
  it("knows the sets in a hand", () => {
    expect(setsIn(["sword", "sword", "tower", "sword"])).toEqual(["sword"]);
    expect(setsIn(["sword", "tower", "laurel"])).toEqual(["mixed"]);
    expect(setsIn(["tower", "tower", "tower", "laurel", "sword"])).toEqual(["tower", "mixed"]);
    expect(setsIn(["sword", "sword", "tower", "tower"])).toEqual([]);
    expect(withoutSet(["laurel", "sword", "tower", "sword"], "mixed")).toEqual(["sword"]);
    expect(withoutSet(["sword", "tower"], "sword")).toBeNull();
    // Five cards always hold a set.
    const marks: SpoilsMark[] = ["sword", "tower", "laurel"];
    for (let i = 0; i < 3 ** 5; i++) {
      const hand = [0, 1, 2, 3, 4].map((k) => marks[Math.floor(i / 3 ** k) % 3]!);
      expect(setsIn(hand).length).toBeGreaterThan(0);
    }
  });

  it("three Swords: troops at your capital", () => {
    const r = resolveTurn(ctx, game(["sword", "sword", "sword", "tower"]), { p1: [spoils("sword")] });
    expect(r.state.territories.a!.troops).toBe(10 + cfg.sword.troops);
    expect(player(r.state, "p1").spoils).toEqual(["tower"]);
    expect(find(r.events, "spoilsTurnedIn")).toMatchObject({ player: "p1", set: "sword", at: "a", troops: cfg.sword.troops, gold: 0, land: [{ territory: "a", troops: 10 + cfg.sword.troops }] });
  });

  it("three Towers: a finished fort with a small garrison on land you choose (not where there's already a building)", () => {
    const r = resolveTurn(ctx, game(["tower", "tower", "tower"]), { p1: [spoils("tower", "b")] });
    expect(r.state.territories.b).toMatchObject({ building: "fort", troops: 6 + cfg.tower.garrison });
    expect(player(r.state, "p1").spoils).toEqual([]);
    const s = game(["tower", "tower", "tower"]);
    s.territories.b!.building = "market";
    const r2 = resolveTurn(ctx, s, { p1: [spoils("tower", "b")] });
    expect(find(r2.events, "fizzled")).toMatchObject({ reason: "hasBuilding" });
    expect(player(r2.state, "p1").spoils).toHaveLength(3);
    // Not on someone else's land.
    const r3 = resolveTurn(ctx, game(["tower", "tower", "tower"]), { p1: [spoils("tower", "d")] });
    expect(find(r3.events, "fizzled")).toMatchObject({ reason: "notHeld" });
  });

  it("three Laurels: culture in a province you hold (up to its number of territories, never above the top level)", () => {
    const s = game(["laurel", "laurel", "laurel"]);
    s.territories.a!.culture = ctx.rules.culture.max;
    const r = resolveTurn(ctx, s, { p1: [spoils("laurel", "b")] });
    // West is a and b: a is already at the top, so only b rises.
    expect(r.state.territories.b!.culture).toBe(cfg.laurel.culture);
    expect(r.state.territories.a!.culture).toBe(ctx.rules.culture.max);
    expect(find(r.events, "spoilsTurnedIn")).toMatchObject({ set: "laurel", culture: ["b"] });
    const both = resolveTurn(ctx, game(["laurel", "laurel", "laurel"]), { p1: [spoils("laurel", "a")] });
    expect([both.state.territories.a!.culture, both.state.territories.b!.culture]).toEqual([1, 1]);
  });

  it("one of each: troops at your capital and gold", () => {
    const s = game(["laurel", "sword", "tower"]);
    const gold = player(s, "p1").gold;
    const r = resolveTurn(ctx, s, { p1: [spoils("mixed")] });
    expect(r.state.territories.a!.troops).toBe(10 + cfg.mixed.troops);
    const inc = r.events.find((e) => e.type === "income" && e.player === "p1");
    expect(player(r.state, "p1").gold).toBe(gold + cfg.mixed.gold + (inc?.type === "income" ? inc.goldAfter - (gold + cfg.mixed.gold) : 0));
    expect(find(r.events, "spoilsTurnedIn")).toMatchObject({ set: "mixed", troops: cfg.mixed.troops, gold: cfg.mixed.gold });
  });

  it("windfalls never grow: the tenth set gives what the first did", () => {
    let s = game();
    const got: number[] = [];
    for (let i = 0; i < 10; i++) {
      player(s, "p1").spoils = ["sword", "sword", "sword"];
      const before = s.territories.a!.troops;
      const r = resolveTurn(ctx, s, { p1: [spoils("sword")] });
      got.push(r.state.territories.a!.troops - before);
      s = r.state;
    }
    expect(new Set(got)).toEqual(new Set([cfg.sword.troops]));
  });

  it("a set you don't hold just doesn't happen", () => {
    const r = resolveTurn(ctx, game(["sword", "sword"]), { p1: [spoils("sword")] });
    expect(find(r.events, "fizzled")).toMatchObject({ reason: "noSet" });
    expect(player(r.state, "p1").spoils).toEqual(["sword", "sword"]);
  });

  it("turning in is an order: it plays in its own slot, in turn with everyone else's", () => {
    const r = resolveTurn(ctx, game(["sword", "sword", "sword"]), { p1: [mv("b", "c", 2), spoils("sword")], p2: [mv("e", "d", 2)] });
    const steps = r.events.filter((e) => e.type === "battle" || e.type === "moved" || e.type === "spoilsTurnedIn").map((e) => e.type);
    expect(steps.indexOf("spoilsTurnedIn")).toBeGreaterThan(0);
  });
});

describe("Spoils: the hand limit", () => {
  it("at the limit you must turn a set in that turn; if you don't, the game does as the turn ends (before the new card)", () => {
    const s = game(["sword", "tower", "sword", "laurel", "sword"]);
    expect(player(s, "p1").spoils).toHaveLength(cfg.handLimit);
    // p1 takes c this turn (and so earns a card) but forgets to turn a set in.
    const r = resolveTurn(ctx, s, { p1: [mv("b", "c", 4)] });
    const auto = find(r.events, "spoilsTurnedIn")!;
    expect(auto).toMatchObject({ player: "p1", orderId: null, set: "sword", at: "a" });
    // Turned in first, then the new card: never more than the limit when you plan.
    const order = r.events.filter((e) => e.type === "spoilsTurnedIn" || e.type === "spoilsEarned").map((e) => e.type);
    expect(order).toEqual(["spoilsTurnedIn", "spoilsEarned"]);
    expect(player(r.state, "p1").spoils.length).toBeLessThanOrEqual(cfg.handLimit);
    expect(player(r.state, "p1").spoils).toHaveLength(3);
  });

  it("the automatic choice is sensible: Swords, else one of each, else a fort where you're most threatened, else Laurels at home", () => {
    const s = game(["tower", "tower", "tower", "laurel", "laurel"]);
    s.territories.c = { owner: "p2", troops: 12, specialists: [], building: null, construction: null, culture: 0 };
    expect(autoSpoils(ctx, s, indexMap(ctx.map), "p1")).toEqual({ set: "tower", territory: "b" });
    player(s, "p1").spoils = ["laurel", "laurel", "laurel", "tower", "tower"];
    expect(autoSpoils(ctx, s, indexMap(ctx.map), "p1")).toEqual({ set: "laurel", territory: "a" });
    player(s, "p1").spoils = ["laurel", "sword", "tower", "tower", "tower"];
    expect(autoSpoils(ctx, s, indexMap(ctx.map), "p1")).toEqual({ set: "mixed" });
  });
});

describe("Spoils: what others see", () => {
  it("opponents (and their bots) see how many cards you hold, never which marks", () => {
    const s = game(["laurel", "tower", "tower"]);
    const theirs = viewFor(ctx, s, "p2");
    expect(theirs.players.find((p) => p.id === "p1")!.spoils).toBe(3);
    expect(JSON.stringify(theirs)).not.toMatch(/laurel|tower/);
    expect(viewFor(ctx, s, "p1").me.spoils).toEqual(["laurel", "tower", "tower"]);
  });

  it("the card you earn is only in your replay; a windfall shows to those who can see the land", () => {
    const s = game(["sword", "sword", "sword"]);
    const r = resolveTurn(ctx, s, { p1: [spoils("sword"), mv("b", "c", 4)] });
    const mine = replayFor(ctx, s, r, "p1");
    const theirs = replayFor(ctx, s, r, "p2");
    expect(mine.some((e) => e.type === "spoilsEarned")).toBe(true);
    expect(theirs.some((e) => e.type === "spoilsEarned")).toBe(false);
    // p2 (at d and e) can't see a, where the Swords' troops went.
    expect(mine.some((e) => e.type === "spoilsTurnedIn")).toBe(true);
    expect(theirs.some((e) => e.type === "spoilsTurnedIn")).toBe(false);
  });
});

describe("Spoils: determinism and saves", () => {
  it("the same game with the same orders ends in exactly the same place", () => {
    const run = () => {
      const c = embervaleCtx();
      let s = createGame(c, { gameId: "d", seed: "spoils-det", players: ["a", "b", "c", "d"].map((id) => ({ id, name: id })), settings: { fate: false } });
      for (let i = 0; i < 12 && !s.winner; i++) s = resolveTurn(c, s, {}).state;
      return stateFingerprint(s);
    };
    expect(run()).toBe(run());
  });

  it("a game saved before the decks carries on without them", () => {
    const raw = JSON.parse(readFileSync(new URL("./fixtures/save-v2-session13.json", import.meta.url), "utf8")) as unknown;
    const read = readSave(raw);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.migrated).toBe(true);
    expect(read.save.state.settings).toMatchObject({ spoils: false, fate: false });
    expect(read.save.state.players.every((p) => p.spoils.length === 0 && p.missions.length === 0)).toBe(true);
  });
});
