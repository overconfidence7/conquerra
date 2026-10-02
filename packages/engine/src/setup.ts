import type { MapDef } from "@conquerra/content";
import { seedCommitment } from "./fairness";
import { distancesFrom, indexMap } from "./mapIndex";
import { Rng, seedRng } from "./rng";
import type { GameContext, GameSettings, GameState, PlayerState, TerritoryState } from "./types";
import { emptyUnits } from "./units";

export interface NewGameOptions {
  gameId: string;
  /** Secret until the game ends. Use a long random string in production. */
  seed: string;
  players: { id: string; name: string }[];
  settings?: Partial<GameSettings>;
}

/** Pick capitals spread out as far as possible from each other. */
function pickCapitals(map: MapDef, count: number, rng: Rng): string[] {
  const idx = indexMap(map);
  const slots = [...map.capitalSlots];
  const chosen = [slots[rng.int(slots.length)]!];
  while (chosen.length < count) {
    let best: string | null = null;
    let bestScore = -1;
    for (const s of slots) {
      if (chosen.includes(s)) continue;
      const score = Math.min(...chosen.map((c) => distancesFrom(idx, c).get(s) ?? 0));
      if (score > bestScore) (best = s), (bestScore = score);
    }
    chosen.push(best!);
  }
  return chosen;
}

export function createGame(ctx: GameContext, opts: NewGameOptions): GameState {
  const { map, rules } = ctx;
  const n = opts.players.length;
  if (n < map.minPlayers || n > map.maxPlayers)
    throw new Error(`Map ${map.id} supports ${map.minPlayers}-${map.maxPlayers} players, got ${n}`);
  if (new Set(opts.players.map((p) => p.id)).size !== n) throw new Error("Duplicate player id");

  const settings: GameSettings = {
    mode: opts.settings?.mode ?? "classic",
    turnLimit: opts.settings?.turnLimit ?? null,
    luck: opts.settings?.luck ?? rules.combat.luck,
    fog: opts.settings?.fog ?? true,
  };
  if (settings.mode === "conquest" && !settings.turnLimit) throw new Error("Conquest mode needs a turnLimit");
  if (settings.luck < 0 || settings.luck > 1) throw new Error("luck must be between 0 and 1");

  const rng = new Rng(seedRng(opts.seed));
  const seats = rng.shuffle(opts.players);
  const capitals = pickCapitals(map, n, rng);

  const territories: Record<string, TerritoryState> = {};
  for (const t of map.territories)
    territories[t.id] = { owner: null, units: { ...emptyUnits(), infantry: rules.setup.neutralUnits }, building: null };

  const players: PlayerState[] = seats.map((p, i) => {
    const cap = capitals[i]!;
    territories[cap] = { owner: p.id, units: { ...rules.setup.startUnits }, building: null };
    return {
      id: p.id,
      name: p.name,
      gold: rules.economy.startGold,
      eliminatedTurn: null,
      capital: cap,
      leader: { alive: true, territory: cap },
      cooldowns: { seize: 0, lie: 0 },
    };
  });
  // Keep the player list in the caller's order; seats are reshuffled every turn anyway.
  players.sort((a, b) => opts.players.findIndex((p) => p.id === a.id) - opts.players.findIndex((p) => p.id === b.id));

  return {
    version: 1,
    gameId: opts.gameId,
    mapId: map.id,
    turn: 1,
    players,
    territories,
    rng: rng.state,
    seedCommitment: seedCommitment(opts.seed),
    settings,
    winner: null,
    endReason: null,
  };
}
