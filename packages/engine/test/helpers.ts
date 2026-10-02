import { defaultRules, MapDef, maps, type Rules } from "@conquerra/content";
import { createGame } from "../src";
import type { GameContext, GameState, Order, Units } from "../src";

/** A five-territory line map: a - b - c - d - e. Capitals at a and e. */
export const lineMap: MapDef = MapDef.parse({
  id: "line",
  name: "Line",
  minPlayers: 2,
  maxPlayers: 2,
  territories: ["a", "b", "c", "d", "e"].map((id, i) => ({
    id,
    name: id.toUpperCase(),
    province: i < 2 ? "west" : i === 2 ? "mid" : "east",
    terrain: "plains",
    x: i * 100,
    y: 0,
  })),
  provinces: [
    { id: "west", name: "West", bonus: 2 },
    { id: "mid", name: "Mid", bonus: 1 },
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

export function ctxWith(overrides?: (r: Rules) => void, map: MapDef = lineMap): GameContext {
  const rules: Rules = JSON.parse(JSON.stringify(defaultRules));
  overrides?.(rules);
  return { map, rules };
}

export const embervaleCtx = (): GameContext => ({ map: maps.embervale!, rules: defaultRules });

export function lineGame(ctx: GameContext, settings: Partial<GameState["settings"]> = {}, seed = "test-seed"): GameState {
  return createGame(ctx, {
    gameId: "g1",
    seed,
    players: [
      { id: "p1", name: "One" },
      { id: "p2", name: "Two" },
    ],
    settings: { luck: 0, ...settings },
  });
}

/** Put specific units/owner on a territory (test setup only). */
export function place(s: GameState, t: string, owner: string | null, units: Partial<Units>) {
  s.territories[t] = { owner, units: { infantry: 0, cavalry: 0, siege: 0, ...units }, building: null };
}

export const capOf = (s: GameState, pid: string) => s.players.find((p) => p.id === pid)!.capital;

let n = 0;
export const mv = (from: string, to: string, units: Order extends infer _ ? Partial<Units> | "all" : never, extra: Partial<Order> = {}): Order =>
  ({ id: `o${++n}`, kind: "move", from, to, units, ...extra }) as Order;

/**
 * Reset the line map to an exact layout for a test.
 * layout: territory -> [owner, infantry]. Unlisted territories become empty neutral land.
 * Capitals: p1 at "a", p2 at "e"; leaders at their capitals.
 */
export function board(s: GameState, layout: Record<string, [string | null, number] | [string | null, Partial<Units>]>) {
  for (const t of Object.keys(s.territories)) place(s, t, null, {});
  for (const [t, [owner, u]] of Object.entries(layout)) place(s, t, owner, typeof u === "number" ? { infantry: u } : u);
  const p1 = s.players.find((p) => p.id === "p1")!;
  const p2 = s.players.find((p) => p.id === "p2")!;
  p1.capital = "a";
  p2.capital = "e";
  p1.leader = { alive: true, territory: "a" };
  p2.leader = { alive: true, territory: "e" };
}
