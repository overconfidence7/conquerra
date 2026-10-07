import { defaultRules, MapDef } from "@conquerra/content";
import { createGame, distancesFrom, findLeader, indexMap, resolveTurn, viewFor, type GameContext, type GameState, type Instruction, type Order } from "@conquerra/engine";
import { describe, expect, it } from "vitest";
import { mergeLeaderOrders, planLeaders } from "../src";

/**
 * A w x h grid map (a0 ... f3: column letter, row number), provinces of 2 x 2. Unlisted land is neutral with 1 troop.
 * p1's capital is `caps[0]`.
 */
function grid(w: number, h: number, layout: Record<string, [string | null, number]>, caps: string[], gold = 0) {
  const ids: string[] = [];
  const territories = [];
  for (let c = 0; c < w; c++)
    for (let r = 0; r < h; r++) {
      const id = `${String.fromCharCode(97 + c)}${r}`;
      ids.push(id);
      territories.push({ id, name: id.toUpperCase(), province: `p${Math.floor(c / 2)}${Math.floor(r / 2)}`, terrain: "plains" as const, x: c * 100, y: r * 100 });
    }
  const borders = [];
  for (let c = 0; c < w; c++)
    for (let r = 0; r < h; r++) {
      const id = `${String.fromCharCode(97 + c)}${r}`;
      if (c + 1 < w) borders.push({ a: id, b: `${String.fromCharCode(98 + c)}${r}` });
      if (r + 1 < h) borders.push({ a: id, b: `${String.fromCharCode(97 + c)}${r + 1}` });
    }
  const provinces = [...new Set(territories.map((t) => t.province))].map((id) => ({ id, name: id.toUpperCase(), bonus: 2 }));
  const map = MapDef.parse({ id: "grid", name: "Grid", minPlayers: 2, maxPlayers: caps.length, recommendedPlayers: { min: 2, max: caps.length }, territories, provinces, borders, capitalSlots: caps });
  const ctx: GameContext = { map, rules: defaultRules };
  const s = createGame(ctx, { gameId: "g", seed: "leaders", players: caps.map((_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}`, ...(i === 0 ? { delegate: true } : {}) })), settings: { luck: 0, fate: false, diplomacy: false, spies: false } });
  for (const t of ids) s.territories[t] = { owner: null, troops: 1, specialists: [], building: null, construction: null, culture: 0 };
  for (const [t, [owner, troops]] of Object.entries(layout)) (s.territories[t]!.owner = owner), (s.territories[t]!.troops = troops);
  s.players.forEach((p, i) => {
    p.capital = caps[i]!;
    p.leader = { alive: true, territory: caps[i]! };
    p.gold = gold;
  });
  s.intel = Object.fromEntries(s.players.map((p) => [p.id, {}]));
  return { ctx, s };
}

const lead = (s: GameState, kind: "leader" | "steward", command: Instruction | null, purse = 0, of = "p1") => {
  const l = findLeader(s.players[0]!, { kind, of })!;
  l.command = command;
  l.purse = purse;
};
const plan = (ctx: GameContext, s: GameState) => planLeaders({ ctx, view: viewFor(ctx, s, "p1") });
const moves = (os: Order[]) => os.filter((o): o is Extract<Order, { kind: "move" }> => o.kind === "move");

describe("Expand our empire in this direction", () => {
  it("through empty, weak land it chains fast toward the target, the Leader with the lead army, every order its own", () => {
    const { ctx, s } = grid(6, 4, { a0: ["p1", 20], f3: ["p2", 5] }, ["a0", "f3"]);
    lead(s, "leader", { kind: "expand", territory: "e2" });
    const p = plan(ctx, s);
    const ms = moves(p.orders);
    expect(ms.length).toBeGreaterThanOrEqual(3);
    expect(p.orders.every((o) => o.general === "p1")).toBe(true);
    // The first hop out of the capital carries the Leader, and its chain goes on with it.
    const first = ms.find((o) => o.from === "a0")!;
    expect(first.withLeader).toBe(true);
    // Every hop out of the capital heads toward the target or widens the head (never away from it).
    const d = distancesFrom(indexMap(ctx.map), "e2");
    for (const o of ms.filter((x) => x.from === "a0")) expect(d.get(o.to)!).toBeLessThanOrEqual(d.get("a0")!);
    // A chain: a hop from where the first lands.
    expect(ms.some((o) => o.from === first.to)).toBe(true);
  });

  it("takes whole provinces on the way, not a thin line, then stops and holds at the target", () => {
    const { ctx, s } = grid(6, 4, { a0: ["p1", 30], f3: ["p2", 5] }, ["a0", "f3"]);
    lead(s, "leader", { kind: "expand", territory: "e1" });
    let st = s;
    let reached = 0;
    for (let i = 0; i < 10 && !reached; i++) {
      st = resolveTurn(ctx, st, { p1: plan(ctx, st).orders }).state;
      if (st.territories.e1!.owner === "p1") reached = st.turn;
    }
    expect(reached).toBeGreaterThan(0);
    // The provinces it passed through (p00, p10: columns a-d, rows 0-1) are held whole, not just a line through them.
    const whole = (prov: string) => ctx.map.territories.filter((t) => t.province === prov).every((t) => st.territories[t.id]!.owner === "p1");
    expect(whole("p00")).toBe(true);
    expect(whole("p10")).toBe(true);
    // There: no more attacks.
    const after = plan(ctx, st);
    expect(moves(after.orders).every((o) => st.territories[o.to]!.owner === "p1")).toBe(true);
  });

  it("where the border is contested it goes slowly and safely: no stopping next to an army that would throw it out", () => {
    // A big rival army at c1 (in sight, next to our b1): taking c0 or c2 beside it would leave what arrives exposed.
    const { ctx, s } = grid(6, 4, { a0: ["p1", 12], a1: ["p1", 2], b0: ["p1", 9], b1: ["p1", 9], c1: ["p2", 25], f3: ["p2", 5] }, ["a0", "f3"]);
    lead(s, "leader", { kind: "expand", territory: "e1" });
    const p = plan(ctx, s);
    const into = moves(p.orders).map((o) => o.to);
    expect(into).not.toContain("c0");
    expect(into).not.toContain("c2");
    // Without that army, it pushes out the same way at once.
    const calm = structuredClone(s);
    calm.territories.c1 = { owner: null, troops: 1, specialists: [], building: null, construction: null, culture: 0 };
    expect(moves(plan(ctx, calm).orders).some((o) => ["c0", "c1", "c2"].includes(o.to))).toBe(true);
  });
});

describe("Command this front, and Run the military", () => {
  const board = () => grid(6, 4, { a0: ["p1", 10], a1: ["p1", 9], b0: ["p1", 8], b1: ["p1", 8], c0: ["p1", 8], c1: ["p1", 8], d0: ["p2", 2], d1: ["p2", 2], f3: ["p2", 9] }, ["a0", "f3"]);

  it("a front leader commands every army in its provinces (and only those), and recruits for them from its purse", () => {
    const { ctx, s } = board();
    lead(s, "leader", null);
    s.players[0]!.captured.push({ of: "p9", territory: "c0" });
    s.players[0]!.leaders.push({ kind: "leader", of: "p9", name: "Brannoc", command: { kind: "front", provinces: ["p10"] }, budget: { share: 0 }, purse: 6 });
    const p = plan(ctx, s);
    const out = moves(p.orders);
    expect(out.length).toBeGreaterThan(0);
    // Out of its provinces, or marching its own recruits in from the recruit site next door.
    const sites = p.orders.flatMap((o) => (o.kind === "recruit" ? [o.territory] : []));
    // (Chain hops go on from land it takes this turn.)
    for (const o of out) if (s.territories[o.from]!.owner === "p1") expect(["c0", "c1", "d0", "d1", ...sites]).toContain(o.from);
    expect(p.orders.every((o) => o.general === "p9")).toBe(true);
    const spent = p.orders.reduce((a, o) => a + (o.kind === "recruit" && typeof o.count === "number" ? o.count * defaultRules.troops.cost : 0), 0);
    expect(spent).toBeGreaterThan(0);
    expect(spent).toBeLessThanOrEqual(6);
  });

  it("Run the military commands every army except your uncommanded Leader's, and a narrower front keeps its own", () => {
    const { ctx, s } = board();
    lead(s, "leader", null);
    s.players[0]!.captured.push({ of: "p8", territory: "b1" }, { of: "p9", territory: "c0" });
    s.players[0]!.leaders.push(
      { kind: "leader", of: "p8", name: "Ingram", command: { kind: "military" }, budget: { share: 0 }, purse: 0 },
      { kind: "leader", of: "p9", name: "Brannoc", command: { kind: "front", provinces: ["p10"] }, budget: { share: 0 }, purse: 0 },
    );
    const p = plan(ctx, s);
    const frontSites = p.orders.flatMap((o) => (o.kind === "recruit" && o.general === "p9" ? [o.territory] : []));
    for (const o of moves(p.orders)) {
      expect(o.from).not.toBe("a0"); // your Leader's army: yours
      if (!frontSites.includes(o.from) && s.territories[o.from]!.owner === "p1") expect(o.general).toBe(["c0", "c1", "d0", "d1"].includes(o.from) ? "p9" : "p8");
    }
    expect(moves(p.orders).some((o) => o.general === "p9")).toBe(true);
  });
});

describe("Hold, Defend, Push and Raid recruit from the purse", () => {
  it("a pushing Leader's recruits join its army before it marches", () => {
    const { ctx, s } = grid(6, 4, { a0: ["p1", 6], f3: ["p2", 5] }, ["a0", "f3"]);
    lead(s, "leader", { kind: "push", territory: "d0" }, 8);
    const p = plan(ctx, s);
    expect(p.orders[0]).toMatchObject({ kind: "recruit", territory: "a0", count: 4, general: "p1" });
    const out = moves(p.orders).find((o) => o.from === "a0")!;
    expect(out.troops).toBe(9);
  });
});

describe("Stewards", () => {
  it("Run the realm: a fort where an army masses on the capital first, saving up for it rather than buying lesser things", () => {
    const { ctx, s } = grid(4, 2, { a0: ["p1", 4], a1: ["p1", 3], b0: ["p2", 12], d1: ["p2", 5] }, ["a0", "d1"]);
    lead(s, "steward", { kind: "realm" }, 6);
    const short = plan(ctx, s);
    expect(short.orders).toEqual([]);
    lead(s, "steward", { kind: "realm" }, 11);
    const p = plan(ctx, s);
    expect(p.orders[0]).toMatchObject({ kind: "build", territory: "a0", building: "fort", steward: "p1" });
  });

  it("Grow the economy: a market on quiet land; Raise culture: levels across the province; Build up: only in its province", () => {
    const { ctx: ctx0, s } = grid(6, 4, { a0: ["p1", 4], a1: ["p1", 3], b0: ["p1", 3], b1: ["p1", 3], c0: ["p1", 2], f3: ["p2", 5] }, ["a0", "f3"]);
    // Whichever pays back fastest: with culture at +½ gold a level (before session 19) a market...
    const ctx: GameContext = { ...ctx0, rules: { ...ctx0.rules, culture: { ...ctx0.rules.culture, incomePerLevel: 0.5 } } };
    lead(s, "steward", { kind: "economy" }, 6);
    expect(plan(ctx, s).orders[0]).toMatchObject({ kind: "build", building: "market", steward: "p1" });
    // ...and at +1 gold a level (session 19) a first level of culture pays as well as a market (1 for 3, 2 for 6).
    expect(plan(ctx0, s).orders.some((o) => o.kind === "invest")).toBe(true);
    lead(s, "steward", { kind: "culture", province: "p00" }, 10);
    const c = plan(ctx, s).orders;
    expect(c.length).toBeGreaterThanOrEqual(3);
    expect(c.every((o) => o.kind === "invest" && ["a0", "a1", "b0", "b1"].includes(o.territory))).toBe(true);
    lead(s, "steward", { kind: "buildUp", province: "p10" }, 20);
    for (const o of plan(ctx, s).orders) expect(["c0"]).toContain((o as { territory: string }).territory);
  });

  it("Fortify this frontier: forts where a rival army masses, then garrisons marched in where the border is short", () => {
    const { ctx, s } = grid(4, 2, { a0: ["p1", 4], a1: ["p1", 2], b1: ["p1", 1], c1: ["p2", 14], d1: ["p2", 5] }, ["a0", "d1"]);
    lead(s, "steward", { kind: "fortify" }, 30);
    const p = plan(ctx, s);
    expect(p.orders.some((o) => o.kind === "build" && o.building === "fort" && o.territory === "b1")).toBe(true);
    expect(p.orders.some((o) => o.kind === "recruit")).toBe(true);
    const spent = p.orders.reduce((a, o) => a + (o.kind === "build" ? 8 : o.kind === "recruit" && typeof o.count === "number" ? o.count * 2 : 0), 0);
    expect(spent).toBeLessThanOrEqual(30);
  });
});

describe("fair play", () => {
  it("no cheating: what a leader can't see changes nothing it writes", () => {
    const { ctx, s } = grid(6, 4, { a0: ["p1", 20], f3: ["p2", 5] }, ["a0", "f3"]);
    lead(s, "leader", { kind: "expand", territory: "e2" }, 6);
    lead(s, "steward", { kind: "realm" }, 12);
    const a = plan(ctx, s).orders;
    const hidden = structuredClone(s);
    hidden.territories.f0 = { owner: "p2", troops: 40, specialists: [], building: "fort", construction: null, culture: 3 };
    hidden.players[1]!.gold = 500;
    expect(plan(ctx, hidden).orders).toEqual(a);
  });

  it("deterministic: the same view gives the same orders", () => {
    const { ctx, s } = grid(6, 4, { a0: ["p1", 20], f3: ["p2", 5] }, ["a0", "f3"]);
    lead(s, "leader", { kind: "expand", territory: "e2" }, 6);
    lead(s, "steward", { kind: "economy" }, 12);
    expect(plan(ctx, s).orders).toEqual(plan(ctx, s).orders);
  });
});

describe("your orders come first", () => {
  const view = (ctx: GameContext, s: GameState) => viewFor(ctx, s, "p1");
  it("an order of yours out of an army, or a build of yours on a place, takes it back from the leader for the turn", () => {
    const { ctx, s } = grid(6, 4, { a0: ["p1", 20], a1: ["p1", 2], f3: ["p2", 5] }, ["a0", "f3"]);
    lead(s, "leader", { kind: "push", territory: "e2" });
    const leaders: Order[] = [
      { id: "l1", kind: "move", from: "a0", to: "b0", troops: 10, general: "p1" },
      { id: "l2", kind: "move", from: "a1", to: "a0", troops: 1, general: "p1" },
      { id: "s1", kind: "build", territory: "a1", building: "market", steward: "p1" },
      { id: "s2", kind: "invest", territory: "a0", steward: "p1" },
    ];
    const own: Order[] = [
      { id: "y1", kind: "move", from: "a0", to: "a1", troops: 3 },
      { id: "y2", kind: "build", territory: "a1", building: "fort" },
    ];
    // You ordered the pushing Leader's own army: all its orders step aside; your build at a1 takes that place back.
    expect(mergeLeaderOrders(view(ctx, s), own, leaders).map((o) => o.id)).toEqual(["y1", "s2", "y2"]);
  });

  it("mixed in (one of yours, one of theirs) or after yours", () => {
    const { ctx, s } = grid(6, 4, { a0: ["p1", 20], f3: ["p2", 5] }, ["a0", "f3"]);
    const own: Order[] = [1, 2, 3].map((i) => ({ id: `y${i}`, kind: "recruit", territory: "a0", count: 1 }) as Order);
    const theirs: Order[] = [1, 2].map((i) => ({ id: `s${i}`, kind: "invest", territory: `b${i}`, steward: "p1" }) as Order);
    expect(mergeLeaderOrders(view(ctx, s), own, theirs, "mixed").map((o) => o.id)).toEqual(["y1", "s1", "y2", "s2", "y3"]);
    expect(mergeLeaderOrders(view(ctx, s), own, theirs, "after").map((o) => o.id)).toEqual(["y1", "y2", "y3", "s1", "s2"]);
  });
});
