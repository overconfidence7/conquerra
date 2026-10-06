import { defaultRules, MapDef, type BorderType, type Terrain } from "@conquerra/content";
import { createGame, viewFor, type GameContext } from "@conquerra/engine";
import { captainBot, type Bot } from "../src";

/**
 * A small test map: territories in a line (a-b-c-...), with chosen border types and extra borders.
 * `layout` sets owner and troops (unlisted land is neutral with 1 troop); p1's capital is `caps[0]`.
 */
export function scenario(opts: {
  line: string;
  /** More territories, joined only by `extra` borders. */
  islands?: string;
  /** What p1 remembers of land it can't see. */
  memory?: Record<string, [string | null, number]>;
  borders?: Record<string, BorderType>;
  extra?: [string, string, BorderType?][];
  terrain?: Record<string, Terrain>;
  layout: Record<string, [string | null, number]>;
  caps: string[];
  players?: number;
  gold?: number;
  buildings?: Record<string, "fort" | "barracks" | "watchtower" | "market">;
}) {
  const chain = opts.line.split("");
  const ids = [...chain, ...(opts.islands ?? "").split("").filter(Boolean)];
  const edges: { a: string; b: string; type: BorderType }[] = chain.slice(1).map((b, i) => ({ a: chain[i]!, b, type: opts.borders?.[`${chain[i]}${b}`] ?? "normal" }));
  for (const [a, b, type] of opts.extra ?? []) edges.push({ a, b, type: type ?? "normal" });
  const players = opts.players ?? opts.caps.length;
  const map = MapDef.parse({
    id: "scenario",
    name: "Scenario",
    minPlayers: 2,
    maxPlayers: Math.max(2, players),
    recommendedPlayers: { min: 2, max: Math.max(2, players) },
    territories: ids.map((id, i) => ({ id, name: id.toUpperCase(), province: `p${Math.floor(i / 3)}`, terrain: opts.terrain?.[id] ?? "plains", x: i * 100, y: 0 })),
    provinces: Array.from({ length: Math.ceil(ids.length / 3) }, (_, i) => ({ id: `p${i}`, name: `P${i}`, bonus: 2 })),
    borders: edges,
    capitalSlots: [...opts.caps, ...ids.filter((x) => !opts.caps.includes(x))].slice(0, Math.max(2, players)),
  });
  const ctx: GameContext = { map, rules: defaultRules };
  const s = createGame(ctx, { gameId: "cap", seed: "cap", players: Array.from({ length: players }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}` })), settings: { luck: 0 } });
  for (const t of ids) s.territories[t] = { owner: null, troops: 1, specialists: [], building: opts.buildings?.[t] ?? null, construction: null, culture: 0 };
  for (const [t, [owner, troops]] of Object.entries(opts.layout)) s.territories[t]!.owner = owner, s.territories[t]!.troops = troops;
  s.players.forEach((p, i) => {
    p.capital = opts.caps[i]!;
    p.leader = { alive: true, territory: opts.caps[i]! };
    p.gold = opts.gold ?? 0;
  });
  s.intel = Object.fromEntries(s.players.map((p) => [p.id, {}]));
  for (const [t, [owner, troops]] of Object.entries(opts.memory ?? {})) s.intel.p1![t] = { owner, troops, building: null, turn: 1 };
  return { ctx, s, plan: (bot: Bot = captainBot, pid = "p1") => bot.plan(ctx, viewFor(ctx, s, pid)) };
}

