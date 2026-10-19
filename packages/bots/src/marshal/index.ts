import { marshalData, type MarshalJudgement, type Personality, type PersonalityId } from "@conquerra/content";
import { Rng, seedRng, type GameContext, type PlayerId, type PlayerView, type ReplayEvent } from "@conquerra/engine";
import type { Diplomat } from "../diplomacy";
import type { Bot } from "../recruit";
import { think } from "./judge";
import { freshMemory, type MarshalMemory } from "./memory";
import { planMarshal } from "./plan";
import { marshalBreaks, marshalJudge, marshalPropose } from "./talk";

export { estimateLand, freshMemory, type MarshalMemory } from "./memory";
export { readRunaway, think, type Insight, type RunawayWhy } from "./judge";
export { forFog, marshalBoard, planMarshal, type MarshalPlan, type MarshalRequest, type MarshalScope, type Steer } from "./plan";
export { claimArmies, expandCorridor, mergeLeaderOrders, planLeaders, type Claims, type LeaderNote, type LeadersPlan, type LeadersRequest } from "./leaders";
export { planFinish, remnantRivals } from "./finish";
export { planSteward } from "./steward";
export { marshalBreaks, marshalJudge, marshalPropose };

export const PERSONALITY_IDS = marshalData.personalities.map((p) => p.id);
export const personality = (id: PersonalityId): Personality => marshalData.personalities.find((p) => p.id === id)!;

/**
 * Each game's personalities, from the game's seed: the six shuffled, dealt to the Marshal seats in order, and shuffled
 * again for a seventh seat on (no two the same until all six are used).
 */
export function dealPersonalities(seed: string, seats: readonly PlayerId[]): Record<PlayerId, PersonalityId> {
  const rng = new Rng(seedRng(`${seed}|personalities`));
  const out: Record<PlayerId, PersonalityId> = {};
  let deck: PersonalityId[] = [];
  for (const s of seats) {
    if (!deck.length) {
      deck = [...PERSONALITY_IDS];
      for (let i = deck.length - 1; i > 0; i--) {
        const j = rng.int(i + 1);
        [deck[i], deck[j]] = [deck[j]!, deck[i]!];
      }
    }
    out[s] = deck.shift()!;
  }
  return out;
}

/** A Marshal bot: a planner with a memory per seat, and its diplomacy. */
export interface MarshalBot extends Bot {
  diplomat: Diplomat;
  personality: Personality;
  /** What it remembers for one seat (for a host to keep with a save), and putting a saved memory back. */
  memoryOf(gameId: string, player: PlayerId): MarshalMemory | null;
  restore(gameId: string, player: PlayerId, memory: MarshalMemory): void;
}

/** Seats it keeps a memory for at most (the simulator plays thousands of games through one bot). */
const MAX_SEATS = 64;

/**
 * The Marshal with one personality (session 17). It keeps a memory for each seat it plays (by game and player), takes
 * in each turn once, and plans, answers and proposes from that seat's view, memory and what it watched.
 */
export function makeMarshalBot(p: PersonalityId | Personality, judgement: MarshalJudgement = marshalData.judgement): MarshalBot {
  const P = typeof p === "string" ? personality(p) : p;
  const memories = new Map<string, MarshalMemory>();
  const key = (gameId: string, player: PlayerId) => `${gameId}|${player}`;
  const recall = (view: PlayerView) => memories.get(key(view.gameId, view.me.id)) ?? freshMemory();
  const keep = (view: PlayerView, m: MarshalMemory) => {
    const k = key(view.gameId, view.me.id);
    memories.delete(k);
    memories.set(k, m);
    if (memories.size > MAX_SEATS) memories.delete(memories.keys().next().value!);
  };
  const insightFor = (ctx: GameContext, view: PlayerView, lastTurn?: readonly ReplayEvent[]) => {
    const t = think(ctx, view, judgement, recall(view), lastTurn);
    keep(view, t.memory);
    return t.insight;
  };
  return {
    id: `marshal-${P.id}`,
    name: `Marshal (${P.title.replace(/^the /, "")})`,
    personality: P,
    plan(ctx, view, lastTurn) {
      const r = planMarshal({ ctx, view, personality: P, judgement, memory: recall(view), ...(lastTurn ? { lastTurn } : {}) });
      keep(view, r.memory);
      return r.orders;
    },
    diplomat: {
      judge: (ctx, view, offer, lastTurn) => marshalJudge(ctx, view, offer, P, insightFor(ctx, view, lastTurn), lastTurn),
      propose: (ctx, view, lastTurn) => marshalPropose(ctx, view, P, insightFor(ctx, view, lastTurn), lastTurn),
    },
    memoryOf: (gameId, player) => memories.get(key(gameId, player)) ?? null,
    restore: (gameId, player, memory) => void memories.set(key(gameId, player), memory),
  };
}
