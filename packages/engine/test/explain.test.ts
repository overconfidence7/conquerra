import { describe, expect, it } from "vitest";
import { explainFizzle, explainHold, FIZZLE_CODES, resolveTurn, type Condition, type FizzleCode, type FizzleDetail, type GameEvent } from "../src";
import { board, ctxWith, find, lineGame, mv } from "./helpers";

type Fizzled = Extract<GameEvent, { type: "fizzled" }>;
const names = { place: (id: string) => id.toUpperCase() };
const fizzle = (reason: FizzleCode, detail: FizzleDetail = {}, extra: Partial<Fizzled> = {}): Fizzled => ({
  type: "fizzled",
  player: "p1",
  orderId: "o",
  reason,
  detail,
  order: { kind: "move", from: "b", to: "c", troops: "all", attack: true },
  usedFallback: false,
  ...extra,
});

/** Details like the ones the engine fills in, so each sentence can be checked in full. */
const SAMPLE: Record<FizzleCode, FizzleDetail> = {
  eliminated: {},
  condition: { condition: "odds", territory: "c", troops: 14, attackers: 3 },
  notEnoughGold: { gold: 3, cost: 8 },
  notHeld: { territory: "c" },
  recruitSite: { territory: "c" },
  hireSite: { territory: "c" },
  badCount: {},
  invalid: {},
  armyFull: { territory: "c" },
  noTroopsForSpecialist: { territory: "c" },
  cultureLocked: { territory: "c", need: 3, have: 1 },
  hasBuilding: { territory: "c" },
  cultureMax: { territory: "c" },
  lostStart: { territory: "b" },
  notConnected: {},
  pathBlocked: { territory: "c" },
  needsCavalry: { territory: "b" },
  resting: { territory: "b", troops: 6 },
  garrisonOnly: { territory: "b", troops: 1 },
  nowhereToRetreat: { territory: "b" },
  noTarget: { territory: "b" },
  manualHopFirst: { territory: "c" },
  storm: { territory: "c" },
  noSet: {},
};

const plain = (text: string) => {
  expect(text).toMatch(/^Your .+ was called off: .+\.$/);
  expect(text).not.toMatch(/undefined|null|NaN|\[object/);
};

describe("every order that didn't happen explains itself", () => {
  it("each reason has its own plain sentence", () => {
    const seen = new Set<string>();
    for (const code of FIZZLE_CODES) {
      const text = explainFizzle(fizzle(code, SAMPLE[code]), names);
      plain(text);
      seen.add(text.split(": ").slice(1).join(": "));
    }
    // No two reasons share a sentence.
    expect(seen.size).toBe(FIZZLE_CODES.length);
  });

  it("each kind of condition has its own sentence, negated too, and fog is called out", () => {
    const kinds: Exclude<Condition["kind"], "not">[] = ["owns", "notOwns", "ownerIs", "minTroops", "maxTroops", "goldAtLeast", "leaderAlive", "odds", "enemyNotGrown", "outnumbered", "attackedThisTurn"];
    for (const condition of kinds)
      for (const negated of [false, true]) {
        const text = explainFizzle(fizzle("condition", { condition, negated, territory: "c", troops: 4, attackers: 2, need: 5, gold: 2, before: 3, now: 9 }), names);
        plain(text);
        expect(text).not.toMatch(/its condition wasn't met/);
      }
    plain(explainFizzle(fizzle("condition", { condition: "maxTroops", territory: "c", fogged: true }), names));
    expect(explainFizzle(fizzle("condition", { condition: "maxTroops", territory: "c", fogged: true }), names)).toMatch(/couldn't see C/);
  });

  it("names the order: attacks, moves, recruits, buildings, culture, hires, retreats", () => {
    const say = (order: Fizzled["order"]) => explainFizzle(fizzle("notHeld", { territory: "c" }, { order }), names);
    expect(say({ kind: "move", from: "b", to: "c", troops: 3, attack: true })).toMatch(/^Your attack from B on C/);
    expect(say({ kind: "move", from: "b", to: "c", troops: 3, attack: false })).toMatch(/^Your move from B to C/);
    expect(say({ kind: "recruit", territory: "c", count: 3 })).toMatch(/^Your recruiting at C/);
    expect(say({ kind: "build", territory: "c", building: "fort" })).toMatch(/^Your fort at C/);
    expect(say({ kind: "invest", territory: "c" })).toMatch(/^Your culture raise at C/);
    expect(say({ kind: "hire", territory: "c", specialist: "siege" })).toMatch(/^Your hiring siege at C/);
    expect(say({ kind: "retreat", from: "c" })).toMatch(/^Your retreat from C/);
  });

  it("a real called-off attack reads like the design example", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    // p1 plans to hit c (1 troop); p2 reinforces c first (Seize the Initiative), so "Only if still stronger" stops it.
    board(s, { a: ["p1", 1], b: ["p1", 6], c: ["p2", 1], d: ["p2", 20], e: ["p2", 1] });
    const { events } = resolveTurn(ctx, s, {
      p1: [mv("b", "c", "all", { id: "hit", preset: { id: "onlyIfStronger" } })],
      p2: [mv("d", "c", 13, { id: "reinforce", timing: "first" })],
    });
    const f = find(events, "fizzled")!;
    expect(f).toMatchObject({ orderId: "hit", reason: "condition", detail: { condition: "odds", territory: "c", troops: 14, attackers: 5 } });
    expect(explainFizzle(f, names, { plannedTroops: 1 })).toBe(
      'Your attack from B on C was called off: by the time it came up, C held 14 troops (you planned for 1), so "Only if still stronger" stopped it.',
    );
  });

  it("the backup plan is mentioned when it ran", () => {
    expect(explainFizzle(fizzle("notEnoughGold", { gold: 1, cost: 8 }, { usedFallback: true }), names)).toMatch(/Its backup plan ran instead\.$/);
  });
});

describe("a failed attack says why the defence held", () => {
  it("hills and a fort", () => {
    const ctx = ctxWith();
    ctx.map = JSON.parse(JSON.stringify(ctx.map));
    ctx.map.territories.find((t) => t.id === "c")!.terrain = "hills";
    const s = lineGame(ctx);
    board(s, { a: ["p1", 1], b: ["p1", 8], c: ["p2", 6, [], { building: "fort" }], e: ["p2", 1] });
    const { events } = resolveTurn(ctx, s, { p1: [mv("b", "c", "all")] });
    const battle = find(events, "battle")!;
    expect(battle.captured).toBe(false);
    expect(battle.defense).toEqual({ fort: true, culture: 0, leader: false });
    expect(explainHold(ctx, battle)).toBe("They held: hills and a fort.");
    expect(explainHold(ctx, battle, true)).toBe("You held: hills and a fort.");
  });

  it("plain numbers when nothing else helped, and nothing when the attack captured", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    board(s, { a: ["p1", 1], b: ["p1", 4], c: ["p2", 9], e: ["p2", 1] });
    const lost = find(resolveTurn(ctx, s, { p1: [mv("b", "c", "all")] }).events, "battle")!;
    expect(explainHold(ctx, lost)).toBe("They held: 9 troops against 3.");
    board(s, { a: ["p1", 1], b: ["p1", 30], c: ["p2", 1], e: ["p2", 1] });
    expect(explainHold(ctx, find(resolveTurn(ctx, s, { p1: [mv("b", "c", "all")] }).events, "battle")!)).toBeNull();
  });
});
