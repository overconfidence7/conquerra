import { defaultRules, MapDef, type Rules, type SpecialistType } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { createGame } from "../src";
import type { GameContext, GameState, Order, StepEvent, TroopAmount } from "../src";

/** A five-territory line map: a - b - c - d - e. Capitals at a and e. */
export const lineMap: MapDef = MapDef.parse({
  id: "line",
  name: "Line",
  minPlayers: 2,
  maxPlayers: 2,
  recommendedPlayers: { min: 2, max: 2 },
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
export const greatmarchCtx = (): GameContext => ({ map: maps.greatmarch!, rules: defaultRules });

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

type Spot = [owner: string | null, troops: number, specialists?: SpecialistType[], extra?: { culture?: number; building?: "fort" | "market" | "barracks" | "watchtower" }];

/**
 * Reset the line map to an exact layout for a test.
 * layout: territory -> [owner, troops, specialists?, extra?]. Unlisted territories become empty neutral land.
 * Capitals: p1 at "a", p2 at "e"; leaders at their capitals.
 */
export function board(s: GameState, layout: Record<string, Spot>) {
  let n = 1000;
  for (const t of Object.keys(s.territories))
    s.territories[t] = { owner: null, troops: 0, specialists: [], building: null, construction: null, culture: 0 };
  for (const [t, [owner, troops, specs = [], extra = {}]] of Object.entries(layout))
    s.territories[t] = {
      owner,
      troops,
      specialists: specs.map((type) => ({ id: `s${n++}`, type })),
      building: extra.building ?? null,
      construction: null,
      culture: extra.culture ?? 0,
    };
  const p1 = s.players.find((p) => p.id === "p1")!;
  const p2 = s.players.find((p) => p.id === "p2")!;
  p1.capital = "a";
  p2.capital = "e";
  p1.leader = { alive: true, territory: "a" };
  p2.leader = { alive: true, territory: "e" };
  // The layout is brand new, so nobody remembers anything from before it.
  s.intel = Object.fromEntries(s.players.map((p) => [p.id, {}]));
}

export const capOf = (s: GameState, pid: string) => s.players.find((p) => p.id === pid)!.capital;
export const player = (s: GameState, pid: string) => s.players.find((p) => p.id === pid)!;

let n = 0;
export const mv = (from: string, to: string, troops: TroopAmount, extra: Partial<Order> = {}): Order =>
  ({ id: `o${++n}`, kind: "move", from, to, troops, ...extra }) as Order;

export const types = (ev: StepEvent[]) => ev.map((e) => e.type);
export const find = <T extends StepEvent["type"]>(ev: StepEvent[], type: T) =>
  ev.find((e) => e.type === type) as Extract<StepEvent, { type: T }> | undefined;
