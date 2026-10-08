import type { MapDef } from "@conquerra/content";
import { seedCommitment } from "./fairness";
import { updateIntel } from "./intel";
import { distancesFrom, indexMap } from "./mapIndex";
import { Rng, seedRng } from "./rng";
import type { GameContext, GameSettings, GameState, PlayerState, TerritoryState } from "./types";
import { emptyStats, landHeld } from "./history";
import { cleanName, cleanStyle, dealLeaderNames, startingLeaders, startingStewardShare } from "./leaders";

export interface NewGameOptions {
  gameId: string;
  /** Secret until the game ends. Use a long random string in production. */
  seed: string;
  /**
   * `house`: which House colour (an index into the ten; default: the first not taken, in this order).
   * `leaderName` / `stewardName` (session 18): what you named your Leader and Steward (default: dealt from the seed).
   * `delegate`: a person's seat: their Steward starts on "Run the realm" with `rules.leaders.stewardShare` of their
   * income (a bot plans its whole realm itself, so its Steward starts idle).
   */
  players: { id: string; name: string; house?: number; leaderName?: string; stewardName?: string; leaderPersonality?: string | null; stewardPersonality?: string | null; delegate?: boolean }[];
  settings?: Partial<GameSettings>;
}

/**
 * Pick capitals. If the map has a fair layout for this many players, use it (seats are shuffled, so who gets
 * which slot is random). Otherwise spread capitals out as far as possible from each other.
 */
function pickCapitals(map: MapDef, count: number, rng: Rng): string[] {
  const layout = map.capitalLayouts?.find((l) => l.players === count);
  if (layout) return [...layout.slots];
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

  const mode = opts.settings?.mode ?? "classic";
  const settings: GameSettings = {
    mode,
    turnLimit: opts.settings?.turnLimit ?? (mode === "conquest" ? rules.game.conquestTurnLimitDefault : null),
    luck: opts.settings?.luck ?? rules.combat.luck,
    fog: opts.settings?.fog ?? true,
    turnTimerSeconds: opts.settings?.turnTimerSeconds ?? rules.game.turnTimerSecondsDefault,
    fallen: opts.settings?.fallen ?? true,
    spoils: opts.settings?.spoils ?? true,
    fate: opts.settings?.fate ?? true,
    diplomacy: opts.settings?.diplomacy ?? true,
    spies: opts.settings?.spies ?? true,
  };
  if (settings.turnLimit !== null && !(Number.isInteger(settings.turnLimit) && settings.turnLimit >= 1))
    throw new Error("turnLimit must be a whole number of turns, at least 1");
  if (settings.luck < 0 || settings.luck > 1) throw new Error("luck must be between 0 and 1");
  const g = rules.game;
  if (!Number.isInteger(settings.turnTimerSeconds) || settings.turnTimerSeconds < g.turnTimerSecondsMin || settings.turnTimerSeconds > g.turnTimerSecondsMax)
    throw new Error(`turnTimerSeconds must be between ${g.turnTimerSecondsMin} and ${g.turnTimerSecondsMax}`);

  // Houses: as chosen, the rest the first ones not taken (in the caller's order).
  const houses = new Map<string, number>();
  for (const p of opts.players) if (p.house !== undefined) {
    if (!Number.isInteger(p.house) || p.house < 0 || [...houses.values()].includes(p.house)) throw new Error("Each player needs a different House");
    houses.set(p.id, p.house);
  }
  for (const p of opts.players) if (!houses.has(p.id)) {
    let h = 0;
    while ([...houses.values()].includes(h)) h++;
    houses.set(p.id, h);
  }

  const rng = new Rng(seedRng(opts.seed));
  const seats = rng.shuffle(opts.players);
  const capitals = pickCapitals(map, n, rng);

  const territories: Record<string, TerritoryState> = {};
  for (const t of map.territories)
    territories[t.id] = { owner: null, troops: rules.setup.neutralTroops, specialists: [], building: null, construction: null, culture: 0 };

  // Names for everyone's Leader and Steward, from the seed (its own sequence: the dice never change), unless named.
  const dealt = dealLeaderNames(opts.seed, opts.players.map((p) => p.id));
  const stewardShare = startingStewardShare(rules, ctx.map.territories.length, opts.players.length);
  const players: PlayerState[] = seats.map((p, i) => {
    const cap = capitals[i]!;
    territories[cap] = { owner: p.id, troops: rules.setup.startTroops, specialists: [], building: null, construction: null, culture: 0 };
    return {
      id: p.id,
      name: p.name,
      gold: rules.economy.startGold,
      eliminatedTurn: null,
      eliminatedBy: null,
      capital: cap,
      leader: { alive: true, territory: cap },
      cooldowns: { seize: 0, lie: 0 },
      captured: [],
      leaders: startingLeaders(rules, p.id, { leader: cleanName(rules, p.leaderName) ?? dealt[p.id]!.leader, steward: cleanName(rules, p.stewardName) ?? dealt[p.id]!.steward }, !!p.delegate, stewardShare, { leader: cleanStyle(p.leaderPersonality), steward: cleanStyle(p.stewardPersonality) }),
      influence: 0,
      spoils: [],
      missions: [],
      oathbreaker: 0,
      house: houses.get(p.id)!,
    };
  });
  // Keep the player list in the caller's order; seats are reshuffled every turn anyway.
  players.sort((a, b) => opts.players.findIndex((p) => p.id === a.id) - opts.players.findIndex((p) => p.id === b.id));

  const state: GameState = {
    version: 11,
    gameId: opts.gameId,
    mapId: map.id,
    turn: 1,
    players,
    territories,
    rng: rng.state,
    nextId: 1,
    seedCommitment: seedCommitment(opts.seed),
    settings,
    winner: null,
    intel: Object.fromEntries(players.map((p) => [p.id, {}])),
    endReason: null,
    eventCooldowns: { plague: 0, storm: 0, uprising: 0, mercenaries: 0, famine: 0 },
    // The card decks draw from their own sequences of the same secret seed (so they're provably fair too).
    decks: { spoils: seedRng(`${opts.seed}|spoils`), fate: seedRng(`${opts.seed}|fate`), spies: seedRng(`${opts.seed}|spies`) },
    closures: [],
    nextMission: 1,
    deals: [],
    nextDeal: 1,
    record: [],
    spies: [],
    nextSpy: 1,
    spyIntel: {},
    history: [{ turn: 0, land: landHeld(territories, players.map((p) => p.id)) }],
    stats: Object.fromEntries(players.map((p) => [p.id, emptyStats()])),
  };
  updateIntel(ctx, state);
  return state;
}
