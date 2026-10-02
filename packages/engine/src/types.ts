import type { BuildingType, MapDef, Rules, SpecialistType } from "@conquerra/content";
import type { RngState } from "./rng";

export type PlayerId = string;
export type TerritoryId = string;

export interface GameContext {
  map: MapDef;
  rules: Rules;
}

/** One specialist attachment. The id lets the UI track a badge across moves (and lets spies fake them later). */
export interface Specialist {
  id: string;
  type: SpecialistType;
}

export interface PlayerState {
  id: PlayerId;
  name: string;
  gold: number;
  /** Turn on which the player was eliminated, or null if still alive. */
  eliminatedTurn: number | null;
  capital: TerritoryId;
  leader: { alive: boolean; territory: TerritoryId | null };
  /** Turns remaining before each leader ability can be used again (0 = ready). */
  cooldowns: { seize: number; lie: number };
}

/** Each territory holds at most one army: a troop count plus up to `maxPerArmy` specialists. */
export interface TerritoryState {
  owner: PlayerId | null;
  troops: number;
  specialists: Specialist[];
  building: BuildingType | null;
  /** A building under construction; becomes `building` at the end of turn `doneAtEndOfTurn`. */
  construction: { building: BuildingType; doneAtEndOfTurn: number } | null;
  /** Light culture: one number per territory, 0..rules.culture.max. Passes to whoever captures it. */
  culture: number;
}

export type GameMode = "classic" | "conquest";

export interface GameSettings {
  mode: GameMode;
  /** Conquest: the game ends here and the top score wins. Classic: optional cap. */
  turnLimit: number | null;
  /** 0..1 share of combat that is random. Default from rules (0.3). */
  luck: number;
  fog: boolean;
  /** Order-phase length. Stored for the server; the engine never reads a clock. */
  turnTimerSeconds: number;
}

export interface GameState {
  version: 2;
  gameId: string;
  mapId: string;
  turn: number;
  players: PlayerState[];
  territories: Record<TerritoryId, TerritoryState>;
  rng: RngState;
  /** Counter for specialist ids, so ids are deterministic. */
  nextId: number;
  seedCommitment: string;
  settings: GameSettings;
  winner: PlayerId | "draw" | null;
  endReason: "lastStanding" | "turnLimit" | "turnCap" | null;
}

// ---------- Orders ----------

export type OddsLevel = "likely" | "guaranteed";

/**
 * Conditions are checked when the order's turn comes up. A condition that mentions a territory
 * the player can't currently see is treated as false (no peeking through fog).
 */
export type Condition =
  | { kind: "owns"; territory: TerritoryId }
  | { kind: "notOwns"; territory: TerritoryId }
  | { kind: "ownerIs"; territory: TerritoryId; player: PlayerId | null }
  | { kind: "minTroops"; territory: TerritoryId; count: number }
  | { kind: "maxTroops"; territory: TerritoryId; count: number }
  | { kind: "goldAtLeast"; amount: number }
  | { kind: "leaderAlive" }
  /** The move this condition is attached to is still at least this likely to capture. */
  | { kind: "odds"; atLeast: OddsLevel }
  /** Enemy troops next to `territory` are no bigger than at the start of the turn. */
  | { kind: "enemyNotGrown"; territory: TerritoryId }
  /** The biggest enemy army next to `territory` is larger than the army in it. */
  | { kind: "outnumbered"; territory: TerritoryId }
  /** Someone attacked `territory` earlier this turn. */
  | { kind: "attackedThisTurn"; territory: TerritoryId }
  | { kind: "not"; condition: Condition };

/** One-tap contingency presets (design v0.2 §3). The engine expands them into conditions and fallbacks. */
export type PresetId = "onlyIfStronger" | "holdIfThreatened" | "retreatIfOutnumbered" | "followThrough" | "reinforceIfHit";
export interface PresetRef {
  id: PresetId;
  /** followThrough: where to push on to. Omit to let the army pick the weakest neighbor it can likely take. */
  next?: TerritoryId;
}

export type OrderBody =
  | { kind: "recruit"; territory: TerritoryId; count: number }
  | { kind: "hire"; territory: TerritoryId; specialist: SpecialistType }
  | { kind: "build"; territory: TerritoryId; building: BuildingType }
  | { kind: "invest"; territory: TerritoryId }
  | {
      kind: "move";
      from: TerritoryId;
      to: TerritoryId;
      /** Middle step for 2-territory moves (armies with cavalry). Must be yours when the order runs. */
      via?: TerritoryId;
      troops: number | "all";
      /** Which specialists go along. Default: all of them (they travel with the stack). */
      specialists?: SpecialistType[] | "all";
      withLeader?: boolean;
    }
  /** Pull the army back to the safest neighbouring territory you hold. */
  | { kind: "retreat"; from: TerritoryId }
  /** Attack the weakest neighbour of `from` that the army can likely take (used by followThrough). */
  | { kind: "advance"; from: TerritoryId }
  | { kind: "raiseLeader" };

export type Order = OrderBody & {
  id: string;
  /** All must be true when the order's turn comes up, or the fallback runs instead. */
  conditions?: Condition[];
  /** Runs if conditions fail or the order is no longer possible. Can nest. */
  fallback?: Order;
  /** Runs in the player's next slot if this order succeeds and captured its target. */
  then?: Order;
  /** Leader abilities: "first" = Seize the Initiative, "last" = Lie in Wait. */
  timing?: "first" | "last";
  /** A named preset; expanded by the engine when the turn starts. */
  preset?: PresetRef;
};

export type OrdersByPlayer = Record<PlayerId, Order[]>;

// ---------- Events (the turn's replay log) ----------

export interface CombatResult {
  attackStrength: number;
  defenseStrength: number;
  expectedDefenderLosses: number;
  expectedAttackerLosses: number;
  defenderLosses: number;
  attackerLosses: number;
}

export interface ArmySnapshot {
  troops: number;
  specialists: SpecialistType[];
}

export type GameEvent =
  | { type: "turnStart"; turn: number; seats: PlayerId[] }
  | { type: "initiative"; player: PlayerId; timing: "first" | "last"; orderId: string }
  | { type: "fizzled"; player: PlayerId; orderId: string; reason: string; usedFallback: boolean }
  | { type: "recruited"; player: PlayerId; orderId: string; territory: TerritoryId; count: number; cost: number }
  | { type: "hired"; player: PlayerId; orderId: string; territory: TerritoryId; specialist: SpecialistType; cost: number }
  | { type: "built"; player: PlayerId; orderId: string; territory: TerritoryId; building: BuildingType; cost: number; /** null = ready now (engineers). */ doneAtEndOfTurn: number | null }
  | { type: "completed"; player: PlayerId; territory: TerritoryId; building: BuildingType }
  | { type: "invested"; player: PlayerId; orderId: string; territory: TerritoryId; culture: number; cost: number }
  | { type: "moved"; player: PlayerId; orderId: string; from: TerritoryId; to: TerritoryId; army: ArmySnapshot; withLeader: boolean; retreat: boolean }
  | {
      type: "battle";
      player: PlayerId;
      orderId: string;
      from: TerritoryId;
      to: TerritoryId;
      defender: PlayerId | null;
      attackers: ArmySnapshot;
      defenders: ArmySnapshot;
      result: CombatResult;
      captured: boolean;
      /** Specialists that were lost with a destroyed army. */
      specialistsLost: SpecialistType[];
    }
  | { type: "leaderKilled"; player: PlayerId; territory: TerritoryId }
  | { type: "leaderRaised"; player: PlayerId; orderId: string; territory: TerritoryId }
  | { type: "eliminated"; player: PlayerId; by: PlayerId | null }
  | { type: "income"; player: PlayerId; income: number; upkeep: number; goldAfter: number; deserted: number }
  | { type: "gameOver"; winner: PlayerId | "draw"; reason: NonNullable<GameState["endReason"]>; scores: Record<PlayerId, number> };

export type StepEvent = GameEvent & { step: number };

export interface TurnResult {
  state: GameState;
  events: StepEvent[];
}
