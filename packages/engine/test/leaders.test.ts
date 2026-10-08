import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import {
  createGame,
  startingStewardShare,
  findLeader,
  makeSave,
  readSave,
  replayFor,
  resolveTurn,
  scoreFor,
  stateFingerprint,
  STATE_VERSION,
  TurnVision,
  viewFor,
  type Budget,
  type GameState,
  type Instruction,
  type LeaderKind,
  type Order,
} from "../src";
import { board, ctxWith, find, lineGame, mv, player } from "./helpers";

const ctx = ctxWith();
const instruct = (general: string, instruction: Instruction | null, steward = false): Order => ({ id: `i-${general}-${steward}`, kind: "instruct", general, ...(steward ? { role: "steward" as const } : {}), instruction });
const budget = (general: string, b: Budget | undefined, steward = false, takeBack?: number): Order => ({ id: `b-${general}-${steward}`, kind: "budget", general, ...(steward ? { role: "steward" as const } : {}), ...(b ? { budget: b } : {}), ...(takeBack !== undefined ? { takeBack } : {}) });
const release = (general: string, steward = false): Order => ({ id: `r-${general}-${steward}`, kind: "release", general, ...(steward ? { role: "steward" as const } : {}) });
const rec = (s: GameState, pid: string, kind: LeaderKind, of = pid) => findLeader(player(s, pid), { kind, of });
/** Give `pid` a captured Leader (standing at `at`) and/or Steward of `of`. */
function capture(s: GameState, pid: string, of: string, at: string | null, purse = 0) {
  const p = player(s, pid);
  if (at) {
    p.captured.push({ of, territory: at });
    p.leaders.push({ kind: "leader", of, name: `L-${of}`, personality: null, command: null, budget: { share: 0 }, purse });
  } else p.leaders.push({ kind: "steward", of, name: `S-${of}`, personality: null, command: null, budget: { share: 0 }, purse });
}

/** p1 holds a, b, c, d; p2 holds only e with 1 troop: one attack from d knocks p2 out. */
function aboutToWin(): GameState {
  const s = lineGame(ctx);
  board(s, { a: ["p1", 5], b: ["p1", 3], c: ["p1", 3], d: ["p1", 20], e: ["p2", 1] });
  return s;
}

describe("two leaders from the start", () => {
  it("everyone has a Leader and a Steward, named from the seed (no two alike), with no command and no budget", () => {
    const s = createGame({ map: maps.embervale!, rules: defaultRules }, { gameId: "g", seed: "names", players: ["a", "b", "c", "d"].map((id) => ({ id, name: id })) });
    for (const p of s.players) {
      expect(p.leaders.map((l) => [l.kind, l.of, l.command, l.budget, l.purse])).toEqual([
        ["leader", p.id, null, { share: 0 }, 0],
        ["steward", p.id, null, { share: 0 }, 0],
      ]);
      expect(p.leaders.every((l) => l.name.length > 0)).toBe(true);
    }
    expect(new Set(s.players.map((p) => rec(s, p.id, "leader")!.name)).size).toBe(4);
    expect(new Set(s.players.map((p) => rec(s, p.id, "steward")!.name)).size).toBe(4);
    // The same seed deals the same names; the names never touch the dice.
    const again = createGame({ map: maps.embervale!, rules: defaultRules }, { gameId: "g", seed: "names", players: ["a", "b", "c", "d"].map((id) => ({ id, name: id })) });
    expect(stateFingerprint(again)).toBe(stateFingerprint(s));
  });

  it("you name yours in the lobby (trimmed, at most the rules' length); a person's Steward starts on Run the realm with 20%", () => {
    const s = createGame(ctx, {
      gameId: "g",
      seed: "x",
      players: [
        { id: "p1", name: "You", leaderName: "  Aldric   the   Bold ", stewardName: "   ", delegate: true },
        { id: "p2", name: "Bot" },
      ],
    });
    expect(rec(s, "p1", "leader")).toMatchObject({ name: "Aldric the Bold", command: null, budget: { share: 0 } });
    // (A crowded table, at most 12 territories a player: 10%; session 19.)
    expect(rec(s, "p1", "steward")).toMatchObject({ command: { kind: "realm" }, budget: { share: ctx.map.territories.length / 2 <= 12 ? 0.1 : 0.2 } });
    expect(rec(s, "p1", "steward")!.name.trim()).not.toBe("");
    expect(rec(s, "p2", "steward")).toMatchObject({ command: null, budget: { share: 0 } });
    const long = createGame(ctx, { gameId: "g", seed: "x", players: [{ id: "p1", name: "Y", leaderName: "x".repeat(60) }, { id: "p2", name: "B" }] });
    expect(rec(long, "p1", "leader")!.name).toHaveLength(defaultRules.leaders.nameMaxLength);
  });

  it("only you see your leaders (your view's own record)", () => {
    const s = lineGame(ctx);
    const v = viewFor(ctx, s, "p1");
    expect(v.me.leaders).toHaveLength(2);
    expect(JSON.stringify(v.players)).not.toContain(rec(s, "p2", "steward")!.name);
  });
});

describe("commands", () => {
  it("an instruct order sets a leader's command as the turn starts, takes no slot, and null switches it off", () => {
    const s = lineGame(ctx);
    board(s, { a: ["p1", 5], b: ["p1", 3], e: ["p2", 5] });
    const r = resolveTurn(ctx, s, { p1: [instruct("p1", { kind: "expand", territory: "d" }), instruct("p1", { kind: "buildUp", province: "west" }, true)] });
    expect(rec(r.state, "p1", "leader")!.command).toEqual({ kind: "expand", territory: "d" });
    expect(rec(r.state, "p1", "steward")!.command).toEqual({ kind: "buildUp", province: "west" });
    expect(r.events.filter((e) => e.type === "fizzled")).toEqual([]);
    const r2 = resolveTurn(ctx, r.state, { p1: [] });
    expect(rec(r2.state, "p1", "leader")!.command).toEqual({ kind: "expand", territory: "d" });
    expect(rec(resolveTurn(ctx, r2.state, { p1: [instruct("p1", null)] }).state, "p1", "leader")!.command).toBeNull();
  });

  it("a command that doesn't fit the leader, makes no sense, or is for a leader you don't have, is ignored", () => {
    const s = lineGame(ctx);
    board(s, { a: ["p1", 5], e: ["p2", 5] });
    const r = resolveTurn(ctx, s, {
      p1: [
        instruct("p1", { kind: "realm" }), // a Steward's command for the Leader
        instruct("p1", { kind: "military" }, true), // a Leader's for the Steward
        instruct("p1", { kind: "raid", player: "p1" }),
        instruct("p1", { kind: "push", territory: "nowhere" }),
        instruct("p1", { kind: "front", provinces: [] }),
        instruct("p1", { kind: "culture", province: "nowhere" }, true),
        instruct("p2", { kind: "hold" }),
      ],
    });
    expect(rec(r.state, "p1", "leader")!.command).toBeNull();
    expect(rec(r.state, "p1", "steward")!.command).toBeNull();
    expect(rec(r.state, "p2", "leader")!.command).toBeNull();
    const ok = resolveTurn(ctx, s, { p1: [instruct("p1", { kind: "front", provinces: ["mid", "east"] }), instruct("p1", { kind: "fortify", player: "p2" }, true)] });
    expect(rec(ok.state, "p1", "leader")!.command).toEqual({ kind: "front", provinces: ["mid", "east"] });
    expect(rec(ok.state, "p1", "steward")!.command).toEqual({ kind: "fortify", player: "p2" });
  });

  it("only one leader runs the whole military, and only one Steward the realm: the newest takes it over", () => {
    const s = lineGame(ctx);
    board(s, { a: ["p1", 5], b: ["p1", 5], e: ["p2", 5] });
    capture(s, "p1", "x1", "b");
    capture(s, "p1", "x1", null);
    const r = resolveTurn(ctx, s, { p1: [instruct("p1", { kind: "military" }), instruct("p1", { kind: "realm" }, true)] });
    const r2 = resolveTurn(ctx, r.state, { p1: [instruct("x1", { kind: "military" }), instruct("x1", { kind: "realm" }, true)] });
    expect(rec(r2.state, "p1", "leader")!.command).toBeNull();
    expect(rec(r2.state, "p1", "leader", "x1")!.command).toEqual({ kind: "military" });
    expect(rec(r2.state, "p1", "steward")!.command).toBeNull();
    expect(rec(r2.state, "p1", "steward", "x1")!.command).toEqual({ kind: "realm" });
  });
});

describe("budgets and purses", () => {
  /** p1: a (capital) and b, both plains, the whole West: income 2 + 2 + 8 + 2 = 14 a turn, no upkeep. */
  const two = () => {
    const s = lineGame(ctx);
    board(s, { a: ["p1", 5], b: ["p1", 3], e: ["p2", 5] });
    player(s, "p1").gold = 0;
    return s;
  };

  it("a share of the turn's income goes into the purse as income comes in (rounded down)", () => {
    const r = resolveTurn(ctx, two(), { p1: [budget("p1", { share: 0.2 }, true)] });
    const inc = find(r.events, "income")!;
    expect(inc.income).toBe(14);
    expect(rec(r.state, "p1", "steward")!.purse).toBe(2);
    expect(player(r.state, "p1").gold).toBe(12);
    expect(r.events.find((e) => e.type === "purses")).toMatchObject({ player: "p1", paid: [{ kind: "steward", of: "p1", gold: 2 }], goldAfter: 12 });
  });

  it("an exact amount each turn, never more than the treasury holds; budgets keep from turn to turn", () => {
    const s = two();
    const r = resolveTurn(ctx, s, { p1: [budget("p1", { gold: 8 }), budget("p1", { gold: 8 }, true)] });
    // 14 income: the Leader's 8 first, then the Steward gets the 6 left.
    expect([rec(r.state, "p1", "leader")!.purse, rec(r.state, "p1", "steward")!.purse, player(r.state, "p1").gold]).toEqual([8, 6, 0]);
    const r2 = resolveTurn(ctx, r.state, { p1: [] });
    expect([rec(r2.state, "p1", "leader")!.purse, rec(r2.state, "p1", "steward")!.purse]).toEqual([16, 12]);
    // A budget is clamped to the rules: a share at most everything, an amount at most the cap.
    const r3 = resolveTurn(ctx, s, { p1: [budget("p1", { share: 7 }), budget("p1", { gold: 1e9 }, true)] });
    expect(rec(r3.state, "p1", "leader")!.budget).toEqual({ share: 1 });
    expect(rec(r3.state, "p1", "steward")!.budget).toEqual({ gold: defaultRules.leaders.maxGoldBudget });
  });

  it("it saves up: unspent gold stays in the purse", () => {
    let s = two();
    rec(s, "p1", "steward")!.budget = { share: 0.5 };
    for (let i = 0; i < 3; i++) s = resolveTurn(ctx, s, { p1: [] }).state;
    expect(rec(s, "p1", "steward")!.purse).toBe(21);
  });

  it("you take gold back (one order, as the turn starts): it's yours to spend that same turn", () => {
    const s = two();
    rec(s, "p1", "steward")!.purse = 9;
    const r = resolveTurn(ctx, s, { p1: [budget("p1", undefined, true, 999), { id: "r", kind: "recruit", territory: "a", count: "all" }] });
    expect(find(r.events, "purseTaken")).toMatchObject({ player: "p1", leader: { kind: "steward", of: "p1" }, gold: 9 });
    expect(find(r.events, "recruited")).toMatchObject({ count: 4, cost: 8 });
    expect(rec(r.state, "p1", "steward")!.purse).toBe(0);
  });

  it("a leader's orders are paid from its purse, never from your treasury", () => {
    const s = two();
    player(s, "p1").gold = 50;
    rec(s, "p1", "steward")!.purse = 7;
    rec(s, "p1", "leader")!.purse = 6;
    const r = resolveTurn(ctx, s, {
      p1: [
        { id: "m", kind: "build", territory: "b", building: "market", steward: "p1" },
        { id: "c", kind: "invest", territory: "a", steward: "p1" },
        { id: "t", kind: "recruit", territory: "a", count: "all", general: "p1" },
      ],
    });
    expect(find(r.events, "built")).toMatchObject({ cost: 6, by: { kind: "steward", of: "p1" } });
    // 1 gold left in the Steward's purse: culture costs 3, so it waits (your 50 gold is never touched).
    expect(find(r.events, "fizzled")).toMatchObject({ orderId: "c", reason: "notEnoughGold", detail: { gold: 1, cost: 3 } });
    expect(find(r.events, "recruited")).toMatchObject({ count: 3, cost: 6, by: { kind: "leader", of: "p1" } });
    // (The Steward's market is ready as the turn ends: +2 already.)
    expect(player(r.state, "p1").gold).toBe(50 + 14 + 2);
    // Your own order pays from the treasury as before.
    const mine = resolveTurn(ctx, s, { p1: [{ id: "c", kind: "invest", territory: "a" }] });
    // (Its culture level pays as the turn ends: +1 gold a level since session 19.)
    expect(player(mine.state, "p1").gold).toBe(50 - 3 + 14 + Math.floor(ctx.rules.culture.incomePerLevel));
    expect(find(mine.events, "invested")!.by).toBeUndefined();
  });

  it("purses pay upkeep you can't before anyone deserts (no dodging costs)", () => {
    const s = lineGame(ctx);
    // 14 territories for p1: upkeep beyond the treasury's 0 and this turn's income.
    const big = ctxWith((r) => {
      r.economy.upkeepRate = 20;
    });
    board(s, { a: ["p1", 5], b: ["p1", 5], c: ["p1", 5], e: ["p2", 5] });
    player(s, "p1").gold = 0;
    rec(s, "p1", "steward")!.purse = 30;
    rec(s, "p1", "leader")!.purse = 4;
    big.rules.economy.upkeepFreeTerritories = 1;
    const r = resolveTurn(big, s, { p1: [] });
    const inc = find(r.events, "income")!;
    // Income 17, upkeep 48: 31 short. The fullest purse pays first.
    expect([inc.deserted, inc.fromPurses]).toEqual([0, 31]);
    expect(find(r.events, "purses")).toMatchObject({ upkeep: [{ kind: "steward", of: "p1", gold: 30 }, { kind: "leader", of: "p1", gold: 1 }] });
    // Once the purses are empty, troops desert as before.
    rec(s, "p1", "steward")!.purse = 0;
    rec(s, "p1", "leader")!.purse = 0;
    expect(find(resolveTurn(big, s, { p1: [] }).events, "income")!.deserted).toBeGreaterThan(0);
  });

  it("purses count as your gold in the score", () => {
    const s = two();
    const before = scoreFor(ctx, s, "p1");
    rec(s, "p1", "steward")!.purse = 30;
    expect(scoreFor(ctx, s, "p1")).toBe(before + 3);
  });

  it("only you hear of your purses in the replay, and the replay's board keeps them exactly", () => {
    const s = two();
    player(s, "p1").gold = 20;
    rec(s, "p1", "steward")!.purse = 7;
    rec(s, "p1", "leader")!.budget = { share: 0.3 };
    const r = resolveTurn(ctx, s, { p1: [{ id: "m", kind: "build", territory: "b", building: "market", steward: "p1" }, budget("p1", undefined, true, 1)] });
    expect(replayFor(ctx, s, r, "p1").some((e) => e.type === "purses")).toBe(true);
    expect(replayFor(ctx, s, r, "p2").some((e) => e.type === "purses" || e.type === "purseTaken")).toBe(false);
    const tv = new TurnVision(ctx, s, r.events, ["p1"]);
    for (const e of r.events) tv.step(e);
    expect(player(tv.board, "p1").gold).toBe(player(r.state, "p1").gold);
    expect(player(tv.board, "p1").leaders.map((l) => l.purse)).toEqual(player(r.state, "p1").leaders.map((l) => l.purse));
  });

  it("a turn never changes the game it started from, purses included (session 20: the replay's board used to share them)", () => {
    const s = two();
    s.settings.fog = true;
    player(s, "p1").gold = 20;
    rec(s, "p1", "steward")!.purse = 7;
    rec(s, "p1", "leader")!.budget = { share: 0.3 };
    const before = JSON.stringify(s);
    const r = resolveTurn(ctx, s, { p1: [{ id: "m", kind: "build", territory: "b", building: "market", steward: "p1" }] });
    replayFor(ctx, s, r, "p1");
    expect(JSON.stringify(s)).toBe(before);
    expect(rec(r.state, "p1", "leader")!.purse).toBeGreaterThan(0);
  });
});

describe("captured leaders", () => {
  it("knocking a player out gives you their Leader (at your capital) and their Steward, with no command and no budget", () => {
    const s = aboutToWin();
    const names = [rec(s, "p2", "leader")!.name, rec(s, "p2", "steward")!.name];
    rec(s, "p2", "steward")!.purse = 12;
    const r = resolveTurn(ctx, s, { p1: [mv("d", "e", "all")] });
    expect(player(r.state, "p1").captured).toEqual([{ of: "p2", territory: "a" }]);
    expect(rec(r.state, "p1", "leader", "p2")).toEqual({ kind: "leader", of: "p2", name: names[0], personality: null, command: null, budget: { share: 0 }, purse: 0 });
    expect(rec(r.state, "p1", "steward", "p2")).toEqual({ kind: "steward", of: "p2", name: names[1], personality: null, command: null, budget: { share: 0 }, purse: 0 });
    expect(find(r.events, "generalCaptured")).toMatchObject({ player: "p1", general: "p2", territory: "a" });
    expect(find(r.events, "stewardCaptured")).toMatchObject({ player: "p1", steward: "p2" });
    expect(player(r.state, "p2").leaders).toEqual([]);
    expect(viewFor(ctx, r.state, "p1").territories.a).toMatchObject({ detail: "full", generals: ["p2"] });
  });

  it("at your strongest territory if you've lost your capital", () => {
    const s = aboutToWin();
    s.territories.a!.owner = null;
    expect(player(resolveTurn(ctx, s, { p1: [mv("d", "e", "all")] }).state, "p1").captured[0]!.territory).toBe("e");
  });

  it("a knocked-out player's own captured leaders go with them", () => {
    const s = aboutToWin();
    capture(s, "p2", "p3", "e");
    capture(s, "p2", "p3", null);
    const r = resolveTurn(ctx, s, { p1: [mv("d", "e", "all")] });
    expect(player(r.state, "p1").leaders.map((l) => `${l.kind}:${l.of}`)).toEqual(["leader:p1", "steward:p1", "leader:p2", "steward:p2"]);
  });

  it("goes with its army when told to, and takes commands like your own", () => {
    const s = lineGame(ctx);
    board(s, { a: ["p1", 5], b: ["p1", 10], e: ["p2", 5] });
    capture(s, "p1", "p3", "b");
    const r = resolveTurn(ctx, s, { p1: [instruct("p3", { kind: "hold" }), mv("b", "c", "all", { withGeneral: "p3", general: "p3" })] });
    expect(player(r.state, "p1").captured).toEqual([{ of: "p3", territory: "c" }]);
    expect(rec(r.state, "p1", "leader", "p3")!.command).toEqual({ kind: "hold" });
    expect(find(r.events, "battle")).toMatchObject({ withGeneral: "p3", general: "p3", captured: true });
  });

  it("adds no fighting bonus (only your own Leader does)", () => {
    const fight = (extra: Partial<Order>) => {
      const s = lineGame(ctx);
      board(s, { a: ["p1", 2], b: ["p1", 10], c: ["p2", 8], e: ["p2", 5] });
      capture(s, "p1", "p3", "b");
      player(s, "p1").leader = { alive: true, territory: "b" };
      return find(resolveTurn(ctx, s, { p1: [mv("b", "c", 9, extra)] }).events, "battle")!.result.attackStrength;
    };
    expect(fight({ withGeneral: "p3" })).toBe(fight({}));
    expect(fight({ withLeader: true })).toBeGreaterThan(fight({}));
  });

  it("a captured Leader is gone for good when its land is taken; its purse comes home", () => {
    const s = lineGame(ctx);
    board(s, { a: ["p1", 5], b: ["p1", 1], c: ["p2", 20], e: ["p2", 5] });
    capture(s, "p1", "p3", "b", 6);
    player(s, "p1").gold = 0;
    const r = resolveTurn(ctx, s, { p2: [mv("c", "b", "all")] });
    expect(player(r.state, "p1").captured).toEqual([]);
    expect(rec(r.state, "p1", "leader", "p3")).toBeUndefined();
    expect(find(r.events, "generalLost")).toMatchObject({ player: "p1", general: "p3", territory: "b", by: "p2", gold: 6 });
    expect(replayFor(ctx, s, r, "p2").some((e) => e.type === "generalLost")).toBe(true);
  });

  it("and when its army is wiped out attacking; your own Leader always comes back", () => {
    const s = lineGame(ctx);
    board(s, { a: ["p1", 5], b: ["p1", 3], c: ["p2", 30], e: ["p2", 5] });
    capture(s, "p1", "p3", "b");
    player(s, "p1").leader = { alive: true, territory: "b" };
    const r = resolveTurn(ctx, s, { p1: [mv("b", "c", "all", { withGeneral: "p3", withLeader: true })] });
    expect(player(r.state, "p1").captured).toEqual([]);
    expect(rec(r.state, "p1", "leader")).toBeDefined();
    expect(player(r.state, "p1").leader.alive).toBe(true);
  });

  it("Stewards can't be lost: your captured Steward stays whatever happens on the map", () => {
    const s = lineGame(ctx);
    board(s, { a: ["p1", 5], b: ["p1", 1], c: ["p2", 20], e: ["p2", 5] });
    capture(s, "p1", "p3", null, 4);
    const r = resolveTurn(ctx, s, { p2: [mv("c", "b", "all")] });
    expect(rec(r.state, "p1", "steward", "p3")).toMatchObject({ purse: 4 });
  });

  it("up to 4 of each kind (your own included): with one too many, you choose who goes; if you don't, the defaults go", () => {
    expect(defaultRules.leaders.maxOfKind).toBe(4);
    const many = () => {
      const s = lineGame(ctx);
      board(s, { a: ["p1", 5], b: ["p1", 5], c: ["p1", 5], d: ["p1", 5], e: ["p2", 5] });
      // Four captured Leaders (five with yours): one too many. Four captured Stewards too.
      capture(s, "p1", "x1", "a");
      capture(s, "p1", "x2", "d");
      capture(s, "p1", "x3", "c");
      capture(s, "p1", "x4", "b");
      for (const [x, purse] of [["x1", 1], ["x2", 9], ["x3", 3], ["x4", 5]] as const) capture(s, "p1", x, null, purse);
      player(s, "p1").gold = 0;
      return s;
    };
    const chose = resolveTurn(ctx, many(), { p1: [release("x2"), release("x3", true)] });
    expect(player(chose.state, "p1").captured.map((g) => g.of)).toEqual(["x1", "x3", "x4"]);
    expect(player(chose.state, "p1").leaders.filter((l) => l.kind === "steward").map((l) => l.of)).toEqual(["p1", "x1", "x2", "x4"]);
    expect(chose.events.filter((e) => e.type === "generalReleased")).toEqual([
      expect.objectContaining({ general: "x2" }),
      expect.objectContaining({ general: "x3", steward: true, gold: 3 }),
    ]);
    // Your own can't be let go.
    expect(rec(resolveTurn(ctx, many(), { p1: [release("p1"), release("p1", true)] }).state, "p1", "steward")).toBeDefined();
    const auto = resolveTurn(ctx, many(), { p1: [] });
    // The front is p2 at e: d is 1 away, c 2, b 3, a 4: the one at a goes. Stewards: the emptiest purse goes (x1's 1 gold home).
    expect(player(auto.state, "p1").captured.map((g) => g.of)).toEqual(["x2", "x3", "x4"]);
    expect(player(auto.state, "p1").leaders.filter((l) => l.kind === "steward").map((l) => l.of)).toEqual(["p1", "x2", "x3", "x4"]);
  });
});

describe("saves from before leaders", () => {
  const read = () => {
    const r = readSave(JSON.parse(readFileSync(new URL("./fixtures/save-v2-session17.json", import.meta.url), "utf8")));
    if (!r.ok) throw new Error(r.why);
    return r.save.state as GameState;
  };

  it("session 17's save (state version 9) loads: generals become leaders with their instruction, Govern's progress goes into the purse", () => {
    const s = read();
    expect(s.version).toBe(STATE_VERSION);
    const you = player(s, "you");
    expect(you.leaders.map((l) => [l.kind, l.of])).toEqual([
      ["leader", "you"],
      ["steward", "you"],
      ["leader", "bot3"],
    ]);
    expect(rec(s, "you", "leader")!.command).toMatchObject({ kind: "push" });
    // Governing becomes Hold here, with the 5 gold it was saving in its purse.
    expect(rec(s, "you", "leader", "bot3")).toMatchObject({ command: { kind: "hold" }, purse: 5, budget: { share: 0 } });
    expect(you.captured).toEqual([{ of: "bot3", territory: you.capital }]);
    // Your Steward starts running the realm; the bots' are idle (they plan their own realm).
    expect(rec(s, "you", "steward")).toMatchObject({ command: { kind: "realm" }, budget: { share: 0.2 } });
    expect(rec(s, "bot1", "steward")).toMatchObject({ command: null, budget: { share: 0 } });
    expect(s.players.every((p) => !("purse" in p) && !("command" in p))).toBe(true);
    const ctxE = { map: maps.embervale!, rules: defaultRules };
    const next = resolveTurn(ctxE, s, {});
    expect(next.state.turn).toBe(s.turn + 1);
    for (const p of s.players) expect(viewFor(ctxE, next.state, p.id).turn).toBe(s.turn + 1);
  });

  it("the older fixtures still come all the way up to date", () => {
    for (const f of ["save-v2-session13.json", "save-v2-session14.json"]) {
      const r = readSave(JSON.parse(readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8")));
      expect(r.ok).toBe(true);
      if (r.ok) for (const p of r.save.state.players) expect(p.leaders.slice(0, 2).map((l) => [l.kind, l.of])).toEqual([["leader", p.id], ["steward", p.id]]);
    }
  });
});

describe("session 20: Report to, the 100% cap, Clean up and Push back", () => {
  /** p1: a (capital) and b, the whole West: income 14 a turn; a captured Leader and Steward of x9. */
  const two = () => {
    const s = lineGame(ctx);
    board(s, { a: ["p1", 5], b: ["p1", 3], e: ["p2", 5] });
    player(s, "p1").gold = 0;
    capture(s, "p1", "x9", "b", 4);
    capture(s, "p1", "x9", null, 3);
    return s;
  };

  it("a leader that reports to another: its budget, and its purse, go into its senior's purse each turn", () => {
    const s = two();
    rec(s, "p1", "leader")!.command = { kind: "military" };
    const r = resolveTurn(ctx, s, { p1: [instruct("x9", { kind: "report", to: "p1" }), budget("x9", { share: 0.5 }), budget("p1", { share: 0.2 })] });
    expect(rec(r.state, "p1", "leader", "x9")).toMatchObject({ command: { kind: "report", to: "p1" }, purse: 0 });
    // 14 income: your Leader's 20% (2), then x9's 50% (7) and its 4 saved go to your Leader: 13.
    expect(rec(r.state, "p1", "leader")!.purse).toBe(13);
    expect(r.events.find((e) => e.type === "purses")).toMatchObject({ paid: [{ kind: "leader", of: "p1", gold: 9 }] });
    // Stewards too: a captured Steward reports to yours.
    const r2 = resolveTurn(ctx, two(), { p1: [instruct("x9", { kind: "report", to: "p1" }, true), budget("x9", { share: 0.1 }, true)] });
    expect([rec(r2.state, "p1", "steward", "x9")!.purse, rec(r2.state, "p1", "steward")!.purse]).toEqual([0, 3 + 1]);
  });

  it("Report to: never to itself, to a leader you don't have, or to one that reports itself; Take back ends it", () => {
    const s = two();
    const r = resolveTurn(ctx, s, { p1: [instruct("p1", { kind: "report", to: "p1" }), instruct("x9", { kind: "report", to: "zz" })] });
    expect(rec(r.state, "p1", "leader")!.command).toBeNull();
    expect(rec(r.state, "p1", "leader", "x9")!.command).toBeNull();
    const chain = resolveTurn(ctx, two(), { p1: [instruct("x9", { kind: "report", to: "p1" }), instruct("p1", { kind: "report", to: "x9" })] });
    expect([rec(chain.state, "p1", "leader")!.command?.kind ?? null, rec(chain.state, "p1", "leader", "x9")!.command?.kind ?? null]).not.toEqual(["report", "report"]);
    const s2 = two();
    rec(s2, "p1", "leader", "x9")!.command = { kind: "report", to: "p1" };
    const back = resolveTurn(ctx, s2, { p1: [budget("x9", undefined, false, 4)] });
    expect(rec(back.state, "p1", "leader", "x9")!.command).toBeNull();
    expect(back.events.some((e) => e.type === "purseTaken")).toBe(true);
  });

  it("budgets add up to at most 100%: shares over it are trimmed in roster order (your Leader first)", () => {
    const r = resolveTurn(ctx, two(), { p1: [budget("p1", { share: 0.8 }), budget("p1", { share: 0.5 }, true), budget("x9", { share: 0.3 })] });
    const shares = player(r.state, "p1").leaders.map((l) => ("share" in l.budget ? l.budget.share : 0));
    expect(shares.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(1 + 1e-9);
    expect([rec(r.state, "p1", "leader")!.budget, rec(r.state, "p1", "steward")!.budget, rec(r.state, "p1", "leader", "x9")!.budget]).toEqual([{ share: 0.8 }, { share: 0.2 }, { share: 0 }]);
  });

  it("a save from before session 20 with budgets over 100% is trimmed as it loads", () => {
    const s = two();
    rec(s, "p1", "leader")!.budget = { share: 0.7 };
    rec(s, "p1", "steward")!.budget = { share: 0.5 };
    const save = makeSave({ map: ctx.map, rules: ctx.rules }, s, "p1", 0);
    const r = readSave(JSON.parse(JSON.stringify(save)));
    if (!r.ok) throw new Error(r.why);
    expect([rec(r.save.state, "p1", "leader")!.budget, rec(r.save.state, "p1", "steward")!.budget]).toEqual([{ share: 0.7 }, { share: 0.3 }]);
  });

  it("Clean up any time; Push back names a rival still in that isn't a partner", () => {
    const r = resolveTurn(ctx, two(), { p1: [instruct("p1", { kind: "cleanup" }), instruct("x9", { kind: "pushBack", player: "p2" })] });
    expect(rec(r.state, "p1", "leader")!.command).toEqual({ kind: "cleanup" });
    expect(rec(r.state, "p1", "leader", "x9")!.command).toEqual({ kind: "pushBack", player: "p2" });
    const bad = resolveTurn(ctx, two(), { p1: [instruct("p1", { kind: "pushBack", player: "p1" }), instruct("x9", { kind: "pushBack", player: "nobody" })] });
    expect([rec(bad.state, "p1", "leader")!.command, rec(bad.state, "p1", "leader", "x9")!.command]).toEqual([null, null]);
  });

  it("knocking a player out with a leader's order says which leader did it", () => {
    const s = aboutToWin();
    rec(s, "p1", "leader")!.command = { kind: "military" };
    rec(s, "p1", "leader")!.purse = 2;
    const r = resolveTurn(ctx, s, { p1: [{ ...mv("d", "e", 5), general: "p1" }] });
    expect(find(r.events, "eliminated")).toMatchObject({ player: "p2", by: "p1", leader: { kind: "leader", of: "p1" } });
    const yours = resolveTurn(ctx, aboutToWin(), { p1: [mv("d", "e", 5)] });
    expect(find(yours.events, "eliminated")!.leader).toBeUndefined();
  });
});

describe("determinism", () => {
  it("the same game with Report to, Clean up and Push back plays out exactly the same twice", () => {
    const play = () => {
      const c = { map: maps.embervale!, rules: defaultRules };
      let s = createGame(c, { gameId: "d", seed: "leaders-det-20", players: [{ id: "a", name: "A", delegate: true }, { id: "b", name: "B" }, { id: "c", name: "C" }] });
      for (let t = 0; t < 4; t++) s = resolveTurn(c, s, { a: [instruct("a", t % 2 ? { kind: "cleanup" } : { kind: "pushBack", player: "b" }), budget("a", { share: 0.9 }), budget("a", { share: 0.5 }, true)] }).state;
      return stateFingerprint(s);
    };
    expect(play()).toBe(play());
  });

  it("the same game with leaders, budgets and purses plays out exactly the same twice", () => {
    const play = () => {
      const c = { map: maps.embervale!, rules: defaultRules };
      let s = createGame(c, { gameId: "d", seed: "leaders-det", players: [{ id: "a", name: "A", delegate: true, leaderName: "Aldric" }, { id: "b", name: "B" }, { id: "c", name: "C" }] });
      for (let t = 0; t < 4; t++) {
        const a = player(s, "a");
        s = resolveTurn(c, s, { a: [budget("a", { share: 0.3 }), { id: `x${t}`, kind: "invest", territory: a.capital, steward: "a" }] }).state;
      }
      return stateFingerprint(s);
    };
    expect(play()).toBe(play());
  });
});

describe("your Steward's share at the start (session 19)", () => {
  it("is 20% on a roomy table and 10% on a crowded one (at most 12 territories a player)", () => {
    expect(startingStewardShare(defaultRules, 120, 6)).toBe(0.2);
    expect(startingStewardShare(defaultRules, 40, 3)).toBe(0.2);
    expect(startingStewardShare(defaultRules, 40, 4)).toBe(0.1);
    expect(startingStewardShare(defaultRules, 80, 10)).toBe(0.1);
  });
});
