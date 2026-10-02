import { defaultRules, MapDef } from "@conquerra/content";
import { createGame, viewFor, type GameContext, type GameState, type Order, type ReplayEvent } from "@conquerra/engine";
import { describe, expect, it } from "vitest";
import {
  affordableTroops,
  draftToOrder,
  justEnough,
  moveTargets,
  newDraft,
  oddsFor,
  planQueue,
  removeOrder,
  shiftOrder,
  tapTerritory,
  timingAvailable,
} from "../src/logic/orders";
import { namer, narrateTurn } from "../src/logic/text";

/** a - b - c - d - e in a line; you start at a, the bot at e. */
const map = MapDef.parse({
  id: "line",
  name: "Line",
  minPlayers: 2,
  maxPlayers: 2,
  recommendedPlayers: { min: 2, max: 2 },
  territories: ["a", "b", "c", "d", "e"].map((id, i) => ({ id, name: id.toUpperCase(), province: i < 2 ? "west" : "east", terrain: "plains", x: i * 100, y: 0 })),
  provinces: [
    { id: "west", name: "West", bonus: 2 },
    { id: "east", name: "East", bonus: 2 },
  ],
  borders: [
    { a: "a", b: "b" },
    { a: "b", b: "c" },
    { a: "c", b: "d" },
    { a: "d", b: "e" },
  ],
  capitalSlots: ["a", "e"],
});
const ctx: GameContext = { map, rules: defaultRules };

function game(layout: Record<string, [string | null, number]>, gold = 20): GameState {
  const s = createGame(ctx, { gameId: "t", seed: "t", players: [{ id: "you", name: "You" }, { id: "bot", name: "Bot" }], settings: { luck: 0 } });
  for (const t of Object.keys(s.territories)) s.territories[t] = { owner: null, troops: 1, specialists: [], building: null, construction: null, culture: 0 };
  for (const [t, [owner, troops]] of Object.entries(layout)) Object.assign(s.territories[t]!, { owner, troops });
  const you = s.players.find((p) => p.id === "you")!;
  const bot = s.players.find((p) => p.id === "bot")!;
  you.capital = "a";
  bot.capital = "e";
  you.leader = { alive: true, territory: "a" };
  bot.leader = { alive: true, territory: "e" };
  you.gold = gold;
  return s;
}
const viewOf = (s: GameState) => viewFor(ctx, s, "you");
let n = 0;
const o = (body: Record<string, unknown>): Order => ({ id: `o${++n}`, ...body }) as Order;

describe("gold left after queued orders", () => {
  it("adds up recruits, hires, buildings and culture (culture gets dearer each level)", () => {
    const view = viewOf(game({ a: ["you", 10], b: ["you", 3], e: ["bot", 10] }, 60));
    const queue = [
      o({ kind: "recruit", territory: "a", count: 5 }), // 10
      o({ kind: "hire", territory: "a", specialist: "cavalry" }), // 8
      o({ kind: "build", territory: "b", building: "market" }), // 6
      o({ kind: "invest", territory: "b" }), // 4
      o({ kind: "invest", territory: "b" }), // 6
    ];
    const plan = planQueue(ctx, view, queue);
    expect(plan.costs).toEqual([10, 8, 6, 4, 6]);
    expect(plan.goldLeft).toBe(60 - 34);
    expect(plan.culture.get("b")).toBe(2);
    expect(plan.building.has("b")).toBe(true);
  });

  it("recruiting more than you can afford buys what you can pay for; unaffordable orders cost nothing", () => {
    const view = viewOf(game({ a: ["you", 10], e: ["bot", 10] }, 7));
    const plan = planQueue(ctx, view, [o({ kind: "recruit", territory: "a", count: 50 }), o({ kind: "build", territory: "a", building: "fort" })]);
    expect(plan.costs).toEqual([6, 0]);
    expect(plan.goldLeft).toBe(1);
    expect(plan.free.get("a")).toBe(9 + 3);
  });

  it("the recruit amount defaults to as many as the gold left buys", () => {
    const view = viewOf(game({ a: ["you", 10], e: ["bot", 10] }, 21));
    expect(affordableTroops(ctx, planQueue(ctx, view, []))).toBe(10);
    expect(affordableTroops(ctx, planQueue(ctx, view, [o({ kind: "hire", territory: "a", specialist: "scouts" })]))).toBe(8);
  });
});

describe("default troop counts", () => {
  it("a new move sends all but the 1-troop garrison, including troops recruited earlier in the queue", () => {
    const view = viewOf(game({ a: ["you", 12], e: ["bot", 10] }, 20));
    expect(newDraft(planQueue(ctx, view, []), { from: "a", to: "b" }).troops).toBe(11);
    const plan = planQueue(ctx, view, [o({ kind: "recruit", territory: "a", count: 10 })]);
    expect(newDraft(plan, { from: "a", to: "b" }).troops).toBe(21);
  });

  it("troops already sent by earlier orders aren't offered again", () => {
    const view = viewOf(game({ a: ["you", 12], b: ["you", 2], e: ["bot", 10] }));
    const plan = planQueue(ctx, view, [o({ kind: "move", from: "a", to: "b", troops: 7 })]);
    expect(plan.free.get("a")).toBe(4);
    // Troops that moved in can't move again this turn.
    expect(plan.free.get("b")).toBe(1);
    const all = planQueue(ctx, view, [o({ kind: "retreat", from: "a" })]);
    expect(all.free.get("a")).toBe(0);
  });
});

describe("tapping the map", () => {
  const s = game({ a: ["you", 12], b: [null, 2], e: ["bot", 10] });
  const view = viewOf(s);
  const plan = planQueue(ctx, view, []);
  it("tap your territory to select it, then a neighbour to draft a move or attack", () => {
    expect(tapTerritory(ctx, view, plan, null, "a")).toEqual({ kind: "select", territory: "a" });
    const t = tapTerritory(ctx, view, plan, "a", "b");
    expect(t).toMatchObject({ kind: "draft", draft: { from: "a", to: "b", troops: 11, preset: null, withLeader: false, timing: null } });
  });
  it("tapping the selection again clears it; tapping something out of reach just selects it", () => {
    expect(tapTerritory(ctx, view, plan, "a", "a")).toEqual({ kind: "deselect" });
    expect(tapTerritory(ctx, view, plan, "a", "d")).toEqual({ kind: "select", territory: "d" });
  });
  it("an army with nothing left to send just changes the selection", () => {
    const spent = planQueue(ctx, view, [o({ kind: "move", from: "a", to: "b", troops: 11 })]);
    expect(tapTerritory(ctx, view, spent, "a", "b")).toEqual({ kind: "select", territory: "b" });
  });
  it("cavalry can reach two steps through your own land", () => {
    const s2 = game({ a: ["you", 12], b: ["you", 2], e: ["bot", 10] });
    expect(moveTargets(ctx, viewOf(s2), "a").map((t) => t.to)).toEqual(["b"]);
    s2.territories.a!.specialists = [{ id: "s1", type: "cavalry" }];
    expect(moveTargets(ctx, viewOf(s2), "a")).toEqual([{ to: "b" }, { to: "c", via: "b" }]);
  });
});

describe("drafts become orders", () => {
  it("carries the preset, the Leader and the timing trick", () => {
    const d = { from: "a", to: "b", troops: 5, preset: "onlyIfStronger" as const, withLeader: true, timing: "first" as const };
    expect(draftToOrder(d, "x")).toEqual({ id: "x", kind: "move", from: "a", to: "b", troops: 5, withLeader: true, preset: { id: "onlyIfStronger" }, timing: "first" });
    expect(draftToOrder({ ...d, preset: null, withLeader: false, timing: null }, "y")).toEqual({ id: "y", kind: "move", from: "a", to: "b", troops: 5 });
  });
  it("Seize the Initiative goes on one order, and only when it's off cooldown", () => {
    const s = game({ a: ["you", 12], e: ["bot", 10] });
    expect(timingAvailable(viewOf(s), [], "first")).toBe(true);
    expect(timingAvailable(viewOf(s), [o({ kind: "recruit", territory: "a", count: 1, timing: "first" })], "first")).toBe(false);
    s.players.find((p) => p.id === "you")!.cooldowns.seize = 2;
    expect(timingAvailable(viewOf(s), [], "first")).toBe(false);
    expect(timingAvailable(viewOf(s), [], "last")).toBe(true);
  });
});

describe("odds badge", () => {
  const s = game({ a: ["you", 30], b: ["bot", 10], e: ["bot", 10] });
  const view = viewOf(s);
  const plan = planQueue(ctx, view, []);
  const d = newDraft(plan, { from: "a", to: "b" });
  it("matches the engine's preview", () => {
    expect(oddsFor(ctx, view, d)).toBe("guaranteed");
    expect(oddsFor(ctx, view, { ...d, troops: 2 })).toBe("impossible");
    expect(oddsFor(ctx, view, { ...d, troops: 0 })).toBe("impossible");
  });
  it("'Just enough' is the smallest army that's likely to win, plus a margin", () => {
    const k = justEnough(ctx, view, plan, d)!;
    expect(["likely", "guaranteed"]).toContain(oddsFor(ctx, view, { ...d, troops: k }));
    expect(k).toBeLessThan(29);
    const weak = viewOf(game({ a: ["you", 3], b: ["bot", 10], e: ["bot", 10] }));
    expect(justEnough(ctx, weak, planQueue(ctx, weak, []), { ...d, troops: 2 })).toBeNull();
  });
});

describe("queue editing", () => {
  const q = [o({ kind: "invest", territory: "a" }), o({ kind: "invest", territory: "b" }), o({ kind: "invest", territory: "c" })];
  it("reorders and deletes", () => {
    expect(shiftOrder(q, q[2]!.id, -1).map((x) => x.id)).toEqual([q[0]!.id, q[2]!.id, q[1]!.id]);
    expect(shiftOrder(q, q[0]!.id, -1).map((x) => x.id)).toEqual(q.map((x) => x.id));
    expect(removeOrder(q, q[1]!.id).map((x) => x.id)).toEqual([q[0]!.id, q[2]!.id]);
  });
});

describe("turn log", () => {
  it("folds fighting in the fog into one line and keeps income last", () => {
    const view = viewOf(game({ a: ["you", 12], e: ["bot", 10] }));
    const events: ReplayEvent[] = [
      { type: "turnStart", turn: 1, seats: ["you", "bot"], step: 0 },
      { type: "surface", what: "battle", province: "east", step: 1 },
      { type: "surface", what: "battle", province: "east", step: 2 },
      { type: "surface", what: "leaderFell", province: "east", step: 3 },
      { type: "income", player: "you", income: 10, upkeep: 0, goldAfter: 30, deserted: 0, step: 4 },
    ];
    const lines = narrateTurn(ctx, events, namer(ctx, view)).map((l) => l.text);
    expect(lines).toEqual([
      "Turn order: You → Bot",
      "Fighting in the fog: East ×2. A Leader fell out of sight.",
      "Income +10, upkeep −0: you now have 30 gold.",
    ]);
    expect(lines.join(" ")).not.toContain("bot");
  });
});
