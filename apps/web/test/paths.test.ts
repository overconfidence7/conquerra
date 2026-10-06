import { defaultRules, MapDef } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { createGame, indexMap, resolveTurn, viewFor, type GameContext, type GameState, type Order } from "@conquerra/engine";
import { describe, expect, it } from "vitest";
import { MAX_PATH_ORDERS, pathSummary, shortestPath, sweepPath } from "../src/logic/paths";
import type { PageDeal } from "../src/logic/deals";

/** A grid of `cols` x `rows` territories, 100 map units apart (named "c,r"), one province per column. */
function gridMap(cols: number, rows: number): MapDef {
  const id = (c: number, r: number) => `${c},${r}`;
  const territories = [];
  const borders = [];
  for (let c = 0; c < cols; c++)
    for (let r = 0; r < rows; r++) {
      territories.push({ id: id(c, r), name: `T${c}${r}`, province: `p${c}`, terrain: "plains" as const, x: c * 100, y: r * 100 });
      if (c + 1 < cols) borders.push({ a: id(c, r), b: id(c + 1, r) });
      if (r + 1 < rows) borders.push({ a: id(c, r), b: id(c, r + 1) });
    }
  return MapDef.parse({
    id: "grid",
    name: "Grid",
    minPlayers: 2,
    maxPlayers: 2,
    recommendedPlayers: { min: 2, max: 2 },
    territories,
    provinces: Array.from({ length: cols }, (_, c) => ({ id: `p${c}`, name: `Province ${c}`, bonus: 1 })),
    borders,
    capitalSlots: [id(0, Math.floor(rows / 2)), id(cols - 1, Math.floor(rows / 2))],
  });
}

function game(ctx: GameContext, layout: Record<string, [string | null, number]>, you = "0,1", bot = "4,1"): GameState {
  const s = createGame(ctx, { gameId: "p", seed: "p", players: [{ id: "you", name: "You" }, { id: "bot", name: "Bot" }], settings: { luck: 0, fate: false } });
  for (const t of Object.keys(s.territories)) s.territories[t] = { owner: null, troops: 1, specialists: [], building: null, construction: null, culture: 0 };
  for (const [t, [owner, troops]] of Object.entries(layout)) Object.assign(s.territories[t]!, { owner, troops });
  const p = s.players.find((x) => x.id === "you")!, b = s.players.find((x) => x.id === "bot")!;
  p.capital = you;
  b.capital = bot;
  p.leader = { alive: true, territory: you };
  b.leader = { alive: true, territory: bot };
  return s;
}
const withIds = (orders: ReturnType<typeof shortestPath>["orders"]): Order[] => orders.map((o, i) => ({ ...o, id: `path-${i}` }) as Order);

/** Every order starts where the army should be by then (where the order before it arrived), and steps to a neighbour. */
function expectChain(ctx: GameContext, from: string, orders: readonly Order[]) {
  const idx = indexMap(ctx.map);
  let at = from;
  for (const o of orders) {
    if (o.kind !== "move") throw new Error("not a move");
    expect(o.from).toBe(at);
    const way = [o.from, ...(o.through ?? []), o.to];
    for (let i = 0; i + 1 < way.length; i++) expect(idx.neighbors.get(way[i]!)).toContain(way[i + 1]);
    at = o.to;
  }
}

describe("orders along a path (session 16)", () => {
  const grid = { map: gridMap(5, 3), rules: defaultRules } as GameContext;

  it("the shortest way: the fewest steps, one attack per hop, each from where the last one lands, with the Leader along", () => {
    const s = game(grid, { "0,1": ["you", 40], "4,1": ["bot", 3] });
    const v = viewFor(grid, s, "you");
    const p = shortestPath(grid, v, [], [], [], "0,1", "3,1");
    expect(p.ok).toBe(true);
    expect(p.steps).toEqual(["0,1", "1,1", "2,1", "3,1"]);
    expect(p.takes).toBe(3);
    expect(p.orders).toHaveLength(3);
    expect(p.orders.every((o) => o.kind === "move" && o.troops === "all" && o.withLeader && o.preset?.id === "onlyIfStronger")).toBe(true);
    expectChain(grid, "0,1", withIds(p.orders));
    expect(pathSummary(p, (t) => `T${t}`)).toBe("3 orders: take 3 territories, end at T3,1");
  });

  it("walks through your own land (moves, no fighting) and prefers it", () => {
    const s = game(grid, { "0,1": ["you", 40], "0,0": ["you", 2], "1,0": ["you", 2], "2,0": ["you", 2], "1,1": ["bot", 30], "4,1": ["bot", 3] });
    const v = viewFor(grid, s, "you");
    const p = shortestPath(grid, v, [], [], [], "0,1", "2,0");
    expect(p.takes).toBe(0);
    expect(p.orders.every((o) => o.kind === "move" && !o.preset)).toBe(true);
    expect(pathSummary(p, (t) => t)).toBe("3 orders: no fighting, end at 2,0");
  });

  it("the full sweep takes every territory in the corridor between the two, steadily toward the end, and ends there", () => {
    const s = game(grid, { "0,1": ["you", 200], "4,1": ["bot", 3] });
    const v = viewFor(grid, s, "you");
    const p = sweepPath(grid, v, [], [], [], "0,1", "3,1");
    expect(p.ok).toBe(true);
    expect(p.steps.at(-1)).toBe("3,1");
    // The corridor here is the whole 4 x 3 block between them (rows 0-2, columns 0-3): 11 territories to take.
    const taken = new Set(p.orders.filter((o) => o.kind === "move" && o.preset).map((o) => (o as { to: string }).to));
    for (let c = 0; c <= 3; c++) for (let r = 0; r <= 2; r++) if (`${c},${r}` !== "0,1") expect(taken.has(`${c},${r}`)).toBe(true);
    expect(p.takes).toBe(11);
    expectChain(grid, "0,1", withIds(p.orders));
    // Never doubles back further than it must: the column it's in never drops by more than one.
    let furthest = 0;
    for (const t of p.steps) {
      const c = Number(t.split(",")[0]);
      expect(c).toBeGreaterThanOrEqual(furthest - 1);
      furthest = Math.max(furthest, c);
    }
    // It's longer than the shortest way, which takes only what's in the way.
    expect(p.takes).toBeGreaterThan(shortestPath(grid, v, [], [], [], "0,1", "3,1").takes);
  });

  it("never attacks across a deal of yours: around a binding pact, or no way at all", () => {
    const s = game(grid, { "0,1": ["you", 40], "1,0": ["bot", 1], "1,1": ["bot", 1], "1,2": ["bot", 1], "4,1": ["bot", 3] });
    // (Land you've never seen could be anyone's: the planner can only steer round what it knows. Here it sees it all.)
    s.settings.fog = false;
    const v = viewFor(grid, s, "you");
    const pact: PageDeal = { id: "d1", kind: "truce", bond: "binding", a: "you", b: "bot", start: 1, last: 5, borders: [], terms: { kind: "truce", scope: { kind: "all" }, turns: 5 }, size: 5 } as unknown as PageDeal;
    const p = shortestPath(grid, v, [], [pact], [], "0,1", "3,1");
    expect(p.ok).toBe(false);
    expect(p.orders).toHaveLength(0);
    expect(pathSummary(p, (t) => t)).toMatch(/^No way to 3,1/);
    // The sweep takes what it can on this side, never the partner's land, and says it can't get there.
    const sweep = sweepPath(grid, v, [], [pact], [], "0,1", "3,1");
    expect(sweep.ok).toBe(false);
    expect(sweep.orders.every((o) => o.kind === "move" && !o.to.startsWith("1,"))).toBe(true);
    expect(pathSummary(sweep, (t) => t)).toMatch(/can.t get to 3,1/);
  });

  it("marches through a partner's land under right of passage (one move's `through`), never stopping or fighting there", () => {
    const s = game(grid, { "0,1": ["you", 40], "1,0": ["bot", 9], "1,1": ["bot", 9], "1,2": ["bot", 9], "4,1": ["bot", 3] });
    const v = viewFor(grid, s, "you");
    const p = shortestPath(grid, v, [], [], ["bot"], "0,1", "2,1");
    expect(p.orders).toEqual([expect.objectContaining({ from: "0,1", to: "2,1", through: ["1,1"] })]);
    expect(p.takes).toBe(1);
  });

  it("a real map: from your capital to far land, both ways are proper chains the engine plays, and the sweep takes more", () => {
    const ctx: GameContext = { map: maps.embervale!, rules: defaultRules };
    let s = createGame(ctx, { gameId: "r", seed: "paths", players: [{ id: "you", name: "You" }, { id: "bot", name: "Bot" }], settings: { luck: 0, fate: false, fog: false } });
    const you = s.players[0]!;
    s.territories[you.capital]!.troops = 300;
    const v = viewFor(ctx, s, "you");
    const idx = indexMap(ctx.map);
    // Somewhere 5 steps away.
    const d = new Map([[you.capital, 0]]);
    const q = [you.capital];
    while (q.length) {
      const t = q.shift()!;
      for (const n of idx.neighbors.get(t) ?? []) if (!d.has(n)) (d.set(n, d.get(t)! + 1), q.push(n));
    }
    const far = [...d].find(([, k]) => k === 5)![0];
    const short = shortestPath(ctx, v, [], [], [], you.capital, far);
    const sweep = sweepPath(ctx, v, [], [], [], you.capital, far);
    expect(short.ok && sweep.ok).toBe(true);
    expect(short.orders).toHaveLength(5);
    expect(sweep.takes).toBeGreaterThan(short.takes);
    expect(sweep.orders.length).toBeLessThanOrEqual(MAX_PATH_ORDERS);
    for (const p of [short, sweep]) expectChain(ctx, you.capital, withIds(p.orders));
    // Played by the engine with a big army: it gets to the end, taking what the path meant to take.
    const r = resolveTurn(ctx, s, { you: withIds(short.orders) });
    expect(r.state.territories[far]!.owner).toBe("you");
    s = r.state;
  });
});
