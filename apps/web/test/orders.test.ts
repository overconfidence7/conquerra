import { defaultRules, MapDef } from "@conquerra/content";
import { createGame, viewFor, type GameContext, type GameState, type Order, type ReplayEvent } from "@conquerra/engine";
import { describe, expect, it } from "vitest";
import {
  affordableTroops,
  amountPill,
  chainTip,
  defaultPreset,
  draftToOrder,
  justEnough,
  moveTargets,
  newDraft,
  oddsAreEstimate,
  oddsFor,
  planQueue,
  removeOrder,
  shiftOrder,
  tapTerritory,
  timingAvailable,
  troopsOf,
  type MoveDraft,
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

describe("default amounts", () => {
  it("a move sends All: everyone but the 1-troop garrison, including troops recruited earlier in the queue", () => {
    const view = viewOf(game({ a: ["you", 12], b: ["you", 1], e: ["bot", 10] }, 20));
    const d = newDraft(ctx, view, planQueue(ctx, view, []), { from: "a", to: "b" });
    expect(d.amount).toBe("all");
    expect(troopsOf(ctx, view, planQueue(ctx, view, []), d)).toBe(11);
    const plan = planQueue(ctx, view, [o({ kind: "recruit", territory: "a", count: 10 })]);
    expect(troopsOf(ctx, view, plan, d)).toBe(21);
  });

  it("a first attack sends Just enough (All if even that wouldn't do); a chained hop sends All", () => {
    const view = viewOf(game({ a: ["you", 30], b: [null, 2], c: [null, 2], e: ["bot", 10] }));
    const plan = planQueue(ctx, view, []);
    expect(newDraft(ctx, view, plan, { from: "a", to: "b" }).amount).toBe("enough");
    const weak = viewOf(game({ a: ["you", 3], b: ["bot", 10], e: ["bot", 10] }));
    expect(newDraft(ctx, weak, planQueue(ctx, weak, []), { from: "a", to: "b" }).amount).toBe("all");
    const chained = planQueue(ctx, view, [o({ kind: "move", from: "a", to: "b", troops: "all" })]);
    expect(newDraft(ctx, view, chained, { from: "b", to: "c" }).amount).toBe("all");
  });

  it("troops already sent aren't offered again; an army that moved in can go on", () => {
    const view = viewOf(game({ a: ["you", 12], b: ["you", 2], e: ["bot", 10] }));
    const plan = planQueue(ctx, view, [o({ kind: "move", from: "a", to: "b", troops: 7 })]);
    expect(plan.free.get("a")).toBe(4);
    expect(plan.free.get("b")).toBe(8);
    const all = planQueue(ctx, view, [o({ kind: "retreat", from: "a" })]);
    expect(all.free.get("a")).toBe(0);
  });

  it("a share is of the army there when the order plays; the pill says when it's an estimate", () => {
    const view = viewOf(game({ a: ["you", 13], b: [null, 1], e: ["bot", 10] }));
    const d: MoveDraft = { from: "a", to: "b", amount: { share: 0.75 }, preset: null, withLeader: false, timing: null };
    expect(troopsOf(ctx, view, planQueue(ctx, view, []), d)).toBe(10);
    expect(amountPill(10, d.amount, false)).toBe("10, 3/4");
    expect(amountPill(9, { share: 0.75 }, true)).toBe("about 9, 3/4");
    expect(amountPill(5, 5, false)).toBe("5");
  });
});

describe("planning a chain", () => {
  const view = viewOf(game({ a: ["you", 20], b: [null, 1], c: [null, 1], d: [null, 1], e: ["bot", 10] }));
  const q = [o({ kind: "move", from: "a", to: "b", troops: "all" }), o({ kind: "move", from: "b", to: "c", troops: "all" }), o({ kind: "move", from: "c", to: "d", troops: "all" })];
  it("an attack that should capture makes its target yours for later orders, with the expected army", () => {
    const plan = planQueue(ctx, view, q.slice(0, 1));
    expect(plan.captured.has("b")).toBe(true);
    // 19 go; about 1 falls taking a 1-troop neutral.
    expect(plan.army.get("b")).toBe(18);
    expect(plan.free.get("b")).toBe(17);
    expect(oddsAreEstimate(plan, { from: "b" })).toBe(true);
    expect(oddsAreEstimate(plan, { from: "a" })).toBe(false);
  });
  it("numbers the hops, leaving 1 behind at every stop", () => {
    const plan = planQueue(ctx, view, q);
    expect(plan.hop).toEqual([1, 2, 3]);
    // c is out of sight at the start of the turn: the plan assumes the hop into it costs nothing.
    expect(plan.sent).toEqual([19, 17, 16]);
    for (const t of ["a", "b", "c"]) expect(plan.army.get(t)).toBe(1);
    expect(chainTip(plan, q, "a")).toBe("d");
  });
  it("an attack expected to fail lands nothing, so no hop can launch from there", () => {
    const strong = viewOf(game({ a: ["you", 6], b: ["bot", 30], e: ["bot", 10] }));
    const plan = planQueue(ctx, strong, [o({ kind: "move", from: "a", to: "b", troops: "all" })]);
    expect(plan.captured.has("b")).toBe(false);
    expect(moveTargets(ctx, strong, "b", plan)).toEqual([]);
  });
  it("tap where the army is heading to select it, then a neighbour; or tap the neighbour straight away", () => {
    const first = q.slice(0, 1);
    const plan = planQueue(ctx, view, first);
    expect(tapTerritory(ctx, view, plan, "a", "b", first)).toEqual({ kind: "select", territory: "b" });
    expect(tapTerritory(ctx, view, plan, "b", "c", first)).toMatchObject({ kind: "draft", draft: { from: "b", to: "c", amount: "all", preset: "onlyIfStronger" } });
    expect(tapTerritory(ctx, view, plan, "a", "c", first)).toMatchObject({ kind: "draft", draft: { from: "b", to: "c" } });
  });
  it("a hop into land you can't see shows no numbers: the odds say 'Can't see'", () => {
    const plan = planQueue(ctx, view, q.slice(0, 2));
    // d is three steps from your land at the start of the turn: hidden.
    expect(view.territories.d!.detail).not.toBe("full");
    const hop: MoveDraft = { from: "c", to: "d", amount: "all", preset: null, withLeader: false, timing: null };
    expect(oddsFor(ctx, view, plan, hop)).toBe("unknown");
    expect(justEnough(ctx, view, plan, hop)).toBeNull();
  });
});

describe("tapping the map", () => {
  const s = game({ a: ["you", 12], b: [null, 2], e: ["bot", 10] });
  const view = viewOf(s);
  const plan = planQueue(ctx, view, []);
  it("tap your territory to select it, then a neighbour to draft a move or attack", () => {
    expect(tapTerritory(ctx, view, plan, null, "a")).toEqual({ kind: "select", territory: "a" });
    const t = tapTerritory(ctx, view, plan, "a", "b");
    expect(t).toMatchObject({ kind: "draft", draft: { from: "a", to: "b", amount: "enough", preset: "onlyIfStronger", withLeader: false, timing: null } });
  });
  it("attacks start with 'Only if still stronger' switched on; moves into your own land start with no preset", () => {
    const own = game({ a: ["you", 12], b: ["you", 2], e: ["bot", 10] });
    const t = tapTerritory(ctx, viewOf(own), planQueue(ctx, viewOf(own), []), "a", "b");
    expect(t).toMatchObject({ kind: "draft", draft: { to: "b", preset: null } });
    expect(defaultPreset(view, "b")).toBe("onlyIfStronger");
    expect(defaultPreset(viewOf(own), "b")).toBeNull();
    // One tap on the chip turns it off: the order then goes in with no preset at all.
    const d = (tapTerritory(ctx, view, plan, "a", "b") as { draft: MoveDraft }).draft;
    expect(draftToOrder({ ...d, preset: null }, "x").preset).toBeUndefined();
    expect(draftToOrder(d, "y").preset).toEqual({ id: "onlyIfStronger" });
  });
  it("tapping the selection again clears it; tapping something out of reach just selects it", () => {
    expect(tapTerritory(ctx, view, plan, "a", "a")).toEqual({ kind: "deselect" });
    expect(tapTerritory(ctx, view, plan, "a", "d")).toEqual({ kind: "select", territory: "d" });
  });
  it("an army with nothing left to send just changes the selection", () => {
    const spent = planQueue(ctx, view, [o({ kind: "move", from: "a", to: "b", troops: 11 })]);
    // (b is where the army is heading: tapping it selects it, ready to push on.)
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
  it("carries the amount, the preset, the Leader and the timing trick", () => {
    const d: MoveDraft = { from: "a", to: "b", amount: { share: 0.5 }, preset: "onlyIfStronger", withLeader: true, timing: "first" };
    expect(draftToOrder(d, "x")).toEqual({ id: "x", kind: "move", from: "a", to: "b", troops: { share: 0.5 }, withLeader: true, preset: { id: "onlyIfStronger" }, timing: "first" });
    expect(draftToOrder({ ...d, amount: 5, preset: null, withLeader: false, timing: null }, "y")).toEqual({ id: "y", kind: "move", from: "a", to: "b", troops: 5 });
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
  const d: MoveDraft = { ...newDraft(ctx, view, plan, { from: "a", to: "b" }), amount: "all" };
  it("matches the engine's preview", () => {
    expect(oddsFor(ctx, view, plan, d)).toBe("guaranteed");
    expect(oddsFor(ctx, view, plan, { ...d, amount: 2 })).toBe("impossible");
    expect(oddsFor(ctx, view, plan, { ...d, amount: 0 })).toBe("impossible");
  });
  it("'Just enough' is the smallest army that's likely to win, plus a margin", () => {
    const k = justEnough(ctx, view, plan, d)!;
    expect(["likely", "guaranteed"]).toContain(oddsFor(ctx, view, plan, { ...d, amount: k }));
    expect(troopsOf(ctx, view, plan, { ...d, amount: "enough" })).toBe(k);
    expect(k).toBeLessThan(29);
    const weak = viewOf(game({ a: ["you", 3], b: ["bot", 10], e: ["bot", 10] }));
    expect(justEnough(ctx, weak, planQueue(ctx, weak, []), d)).toBeNull();
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
      { type: "income", player: "you", income: 10, upkeep: 0, goldAfter: 30, deserted: 0, deserters: [], step: 4 },
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
