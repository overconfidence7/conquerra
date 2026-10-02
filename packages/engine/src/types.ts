import type { BuildingType, MapDef, Rules, UnitType } from "@conquerra/content";
import type { RngState } from "./rng";

export type PlayerId = string;
export type TerritoryId = string;
export type Units = Record<UnitType, number>;

export interface GameContext {
  map: MapDef;
  rules: Rules;
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

export interface TerritoryState {
  owner: PlayerId | null;
  units: Units;
  building: BuildingType | null;
}

export type GameMode = "classic" | "conquest";

export interface GameSettings {
  mode: GameMode;
  /** Required for conquest; optional cap for classic. */
  turnLimit: number | null;
  /** 0..1 share of combat that is random. Default from rules (0.3). */
  luck: number;
  fog: boolean;
}

export interface GameState {
  version: 1;
  gameId: string;
  mapId: string;
  turn: number;
  players: PlayerState[];
  territories: Record<TerritoryId, TerritoryState>;
  rng: RngState;
  seedCommitment: string;
  settings: GameSettings;
  winner: PlayerId | "draw" | null;
  endReason: "lastStanding" | "turnLimit" | "turnCap" | null;
}

// ---------- Orders ----------

export type Condition =
  | { kind: "owns"; territory: TerritoryId }
  | { kind: "notOwns"; territory: TerritoryId }
  | { kind: "ownerIs"; territory: TerritoryId; player: PlayerId | null }
  | { kind: "minUnits"; territory: TerritoryId; count: number }
  | { kind: "maxUnits"; territory: TerritoryId; count: number }
  | { kind: "goldAtLeast"; amount: number }
  | { kind: "leaderAlive" };

export type OrderBody =
  | { kind: "recruit"; territory: TerritoryId; unit: UnitType; count: number }
  | { kind: "build"; territory: TerritoryId; building: BuildingType }
  | {
      kind: "move";
      from: TerritoryId;
      to: TerritoryId;
      /** Middle step for 2-territory moves (cavalry-only armies). Must be yours when the order runs. */
      via?: TerritoryId;
      units: Partial<Units> | "all";
      withLeader?: boolean;
    }
  | { kind: "raiseLeader" };

export type Order = OrderBody & {
  id: string;
  /** All must be true when the order's turn comes up, or the fallback runs instead. */
  conditions?: Condition[];
  /** Runs if conditions fail or the order is no longer possible. Can nest. */
  fallback?: Order;
  /** Leader abilities: "first" = Seize the Initiative, "last" = Lie in Wait. */
  timing?: "first" | "last";
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

export type GameEvent =
  | { type: "turnStart"; turn: number; seats: PlayerId[] }
  | { type: "initiative"; player: PlayerId; timing: "first" | "last"; orderId: string }
  | { type: "fizzled"; player: PlayerId; orderId: string; reason: string; usedFallback: boolean }
  | { type: "recruited"; player: PlayerId; orderId: string; territory: TerritoryId; unit: UnitType; count: number; cost: number }
  | { type: "built"; player: PlayerId; orderId: string; territory: TerritoryId; building: BuildingType; cost: number }
  | { type: "moved"; player: PlayerId; orderId: string; from: TerritoryId; to: TerritoryId; units: Units; withLeader: boolean }
  | {
      type: "battle";
      player: PlayerId;
      orderId: string;
      from: TerritoryId;
      to: TerritoryId;
      defender: PlayerId | null;
      attackers: Units;
      defenders: Units;
      result: CombatResult;
      captured: boolean;
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
