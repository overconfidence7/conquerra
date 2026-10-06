import type { BuildingType, MapDef, Rules, SpecialistType } from "@conquerra/content";
import type { RecruitAmount, TroopAmount } from "./amounts";
import type { Intel } from "./intel";
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

/**
 * A general's standing instruction (session 12). Each turn the general writes its army's orders from its owner's
 * view (the planner is in @conquerra/bots); the engine only stores the instruction.
 *  - hold: keep the territory it stands in, pulling in troops from next door if it's threatened
 *  - defend: hold the border toward a rival, or toward a chosen neighbouring place
 *  - push: march toward a place, taking land along the way
 *  - raid: take a rival's weakly held land, avoiding its strong armies
 */
export type Instruction =
  | { kind: "hold" }
  | { kind: "defend"; player: PlayerId }
  | { kind: "defend"; territory: TerritoryId }
  | { kind: "push"; territory: TerritoryId }
  | { kind: "raid"; player: PlayerId };
export type InstructionKind = Instruction["kind"];

/**
 * A rival's Leader you captured by knocking them out. It commands an army like your own Leader (it goes with the
 * troops where it stands), but adds no fighting bonus and has no timing tricks. Lost for good if its army is wiped
 * out or the territory it stands in is taken.
 */
export interface CapturedGeneral {
  /** Whose Leader it was (the knocked-out player): its id and portrait. */
  of: PlayerId;
  territory: TerritoryId;
  instruction: Instruction | null;
}

/** The Fallen's world events (session 12). Built as data, so a Fate deck could draw them later. */
export const WORLD_EVENT_KINDS = ["plague", "storm", "uprising", "mercenaries", "famine"] as const;
export type WorldEventKind = (typeof WORLD_EVENT_KINDS)[number];

export interface PlayerState {
  id: PlayerId;
  name: string;
  gold: number;
  /** Turn on which the player was eliminated, or null if still alive. */
  eliminatedTurn: number | null;
  /** Who took this player's last territory (null if still alive, or nobody did, e.g. unrest). M3 hands them this player's Leader as a general. */
  eliminatedBy: PlayerId | null;
  capital: TerritoryId;
  leader: { alive: boolean; territory: TerritoryId | null };
  /** Turns remaining before each leader ability can be used again (0 = ready). */
  cooldowns: { seize: number; lie: number };
  /** Your Leader's standing instruction as a general (null: you order its army yourself). */
  command: Instruction | null;
  /** Captured generals, at most `rules.generals.maxCaptured` (one more while you choose which to let go). */
  captured: CapturedGeneral[];
  /** The Fallen: Influence to spend on world events (0 while you're still in). */
  influence: number;
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
  /** Knocked-out players become the Fallen: they earn Influence and spend it on world events (on by default). */
  fallen: boolean;
}

export interface GameState {
  version: 3;
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
  /** Each player's "last seen" memory of land they can't see right now (see intel.ts). Never sent whole to a client. */
  intel: Intel;
  endReason: "lastStanding" | "turnLimit" | "turnCap" | null;
  /** Turns until each world event can be played again (0 = ready). Public. */
  eventCooldowns: Record<WorldEventKind, number>;
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
  /** `count`: All (the default), a share of the gold you have when it plays, or an exact number. */
  | { kind: "recruit"; territory: TerritoryId; count: RecruitAmount }
  | { kind: "hire"; territory: TerritoryId; specialist: SpecialistType }
  | { kind: "build"; territory: TerritoryId; building: BuildingType }
  | { kind: "invest"; territory: TerritoryId }
  | {
      kind: "move";
      from: TerritoryId;
      to: TerritoryId;
      /** Middle step for 2-territory moves (armies with cavalry). Must be yours when the order runs. */
      via?: TerritoryId;
      /** A share of the army there when the order plays ("all", 3/4, 1/2, 1/4), "enough" (Just enough), or an exact number. */
      troops: TroopAmount;
      /** Which specialists go along. Default: all of them (they travel with the stack). */
      specialists?: SpecialistType[] | "all";
      withLeader?: boolean;
      /** A captured general (by whose Leader it was) standing in `from` goes with the army. */
      withGeneral?: PlayerId;
    }
  /** Pull the army back to the safest neighbouring territory you hold. */
  | { kind: "retreat"; from: TerritoryId }
  /**
   * Give a general a standing instruction (null: order its army yourself). `general` is whose Leader it is: your own
   * id for your Leader, the knocked-out player's id for a captured general. Applied as the turn starts; takes no slot.
   */
  | { kind: "instruct"; general: PlayerId; instruction: Instruction | null }
  /** Let a captured general go (when a third arrives, you choose which two to keep). Applied as the turn starts. */
  | { kind: "release"; general: PlayerId }
  /**
   * The Fallen: put `influence` toward a world event on `target` (a living player's territory; for a storm, the
   * border between `target` and `across`). Pledges from several Fallen on the same event and place are pooled.
   * Played as the turn starts, before anyone's orders.
   */
  | { kind: "worldEvent"; event: WorldEventKind; target: TerritoryId; across?: TerritoryId; influence: number }
  /** Attack the weakest neighbour of `from` that the army can likely take (used by followThrough). */
  | { kind: "advance"; from: TerritoryId };

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
  /** Written by a general (whose Leader: your own id for your Leader), for the queue, the replay and the report. */
  general?: PlayerId;
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

/** Why an order didn't happen. Every code has a plain-words sentence (explain.ts); a test checks each one. */
export const FIZZLE_CODES = [
  "eliminated",
  "condition",
  "notEnoughGold",
  "notHeld",
  "recruitSite",
  "hireSite",
  "badCount",
  "invalid",
  "armyFull",
  "noTroopsForSpecialist",
  "cultureLocked",
  "hasBuilding",
  "cultureMax",
  "lostStart",
  "notConnected",
  "pathBlocked",
  "needsCavalry",
  "resting",
  "garrisonOnly",
  "nowhereToRetreat",
  "noTarget",
  "manualHopFirst",
  "storm",
] as const;
export type FizzleCode = (typeof FIZZLE_CODES)[number];

/** The live facts behind a fizzle, as they were when the order came up (only ever the player's own order). */
export interface FizzleDetail {
  /** The territory the reason is about. */
  territory?: TerritoryId;
  /** "condition": which one failed ("not" conditions report the inner kind with `negated`), and whether fog hid it. */
  condition?: Exclude<Condition["kind"], "not">;
  negated?: boolean;
  fogged?: boolean;
  /** Troops there when the order came up (the target's army for an attack). */
  troops?: number;
  /** The army that would have gone. */
  attackers?: number;
  /** Gold you had, and what the order needed. */
  gold?: number;
  cost?: number;
  /** A number the order needed and what there was (culture in the province, a condition's count). */
  need?: number;
  have?: number;
  /** Enemy troops next door at the start of the turn and when the order came up ("Hold if threatened"). */
  before?: number;
  now?: number;
}

/** The order that fizzled, as written (without its backup), so the report can name it. */
export type FizzledOrder = OrderBody & {
  preset?: PresetId;
  /** A move into land you didn't hold when it came up. */
  attack?: boolean;
};

export type GameEvent =
  | { type: "turnStart"; turn: number; seats: PlayerId[] }
  | { type: "initiative"; player: PlayerId; timing: "first" | "last"; orderId: string }
  | { type: "fizzled"; player: PlayerId; orderId: string; reason: FizzleCode; detail: FizzleDetail; order: FizzledOrder; usedFallback: boolean }
  | { type: "recruited"; player: PlayerId; orderId: string; territory: TerritoryId; count: number; cost: number }
  | { type: "hired"; player: PlayerId; orderId: string; territory: TerritoryId; specialist: SpecialistType; cost: number }
  | { type: "built"; player: PlayerId; orderId: string; territory: TerritoryId; building: BuildingType; cost: number; /** null = ready now (engineers). */ doneAtEndOfTurn: number | null }
  | { type: "completed"; player: PlayerId; territory: TerritoryId; building: BuildingType }
  | { type: "invested"; player: PlayerId; orderId: string; territory: TerritoryId; culture: number; cost: number }
  | {
      type: "moved";
      player: PlayerId;
      orderId: string;
      from: TerritoryId;
      to: TerritoryId;
      army: ArmySnapshot;
      withLeader: boolean;
      retreat: boolean;
      /** A captured general went with the army. */
      withGeneral?: PlayerId;
      /** The general that wrote the order. */
      general?: PlayerId;
    }
  | {
      type: "battle";
      player: PlayerId;
      orderId: string;
      from: TerritoryId;
      to: TerritoryId;
      defender: PlayerId | null;
      attackers: ArmySnapshot;
      /** The attacker's Leader went along (it moves in on a capture). */
      withLeader: boolean;
      /** A captured general went with the attack (it moves in on a capture, and is lost if the army is wiped out). */
      withGeneral?: PlayerId;
      /** The general that wrote the order. */
      general?: PlayerId;
      defenders: ArmySnapshot;
      result: CombatResult;
      captured: boolean;
      /** Specialists that were lost with a destroyed army. */
      specialistsLost: SpecialistType[];
      /** What helped the defenders, beyond terrain and the border (both come from the map): for "They held: hills and a fort". */
      defense: { fort: boolean; culture: number; leader: boolean; /** Captured generals standing there (no bonus; lost on a capture). */ generals?: PlayerId[] };
    }
  | { type: "leaderKilled"; player: PlayerId; territory: TerritoryId }
  /** A fallen Leader comes back for free at the end of the turn: at the capital, or the strongest territory if the capital is lost. */
  | { type: "leaderReturned"; player: PlayerId; territory: TerritoryId }
  | { type: "eliminated"; player: PlayerId; by: PlayerId | null }
  /** The knocked-out player's Leader joins whoever knocked them out, as a captured general at `territory`. */
  | { type: "generalCaptured"; player: PlayerId; general: PlayerId; territory: TerritoryId }
  /** A captured general is gone for good: its army was wiped out, or the land it stood in was taken. */
  | { type: "generalLost"; player: PlayerId; general: PlayerId; territory: TerritoryId; by: PlayerId | null }
  /** You let a captured general go (you may keep only so many). */
  | { type: "generalReleased"; player: PlayerId; general: PlayerId }
  /**
   * A world event the Fallen played on `against`'s land. `strength` is how much stronger than the base it was
   * (pooled Influence beyond the cost), after culture's protection where it applies.
   */
  | {
      type: "worldEvent";
      event: WorldEventKind;
      target: TerritoryId;
      against: PlayerId;
      by: PlayerId[];
      spent: number;
      /** Plague: troops lost per territory. */
      losses?: { territory: TerritoryId; troops: number }[];
      /** Storm: the border closed for the turn. */
      border?: [TerritoryId, TerritoryId];
      /** Uprising: rebels against the troops there, and whether the land turned neutral (held by the rebels). */
      rebels?: number;
      flipped?: boolean;
      /** Mercenaries: where they appeared and how many. */
      at?: TerritoryId;
      troops?: number;
      /** Famine: the share of this turn's income lost, and the gold. */
      cut?: number;
      gold?: number;
    }
  /** A world event you put Influence toward didn't happen (nothing was spent), and why. Only you see it. */
  | {
      type: "worldEventFailed";
      player: PlayerId;
      event: WorldEventKind;
      target: TerritoryId;
      reason: "cost" | "cooldown" | "alreadyHit" | "capital" | "invalid" | "lastLand" | "tooStrong" | "noRoom";
    }
  | {
      type: "income";
      player: PlayerId;
      income: number;
      upkeep: number;
      goldAfter: number;
      deserted: number;
      /** Gold lost to a famine this turn. */
      famine?: number;
      /** Where the deserters left from (so the turn can be replayed exactly from the event log). */
      deserters: { territory: TerritoryId; troops: number }[];
    }
  | { type: "gameOver"; winner: PlayerId | "draw"; reason: NonNullable<GameState["endReason"]>; scores: Record<PlayerId, number> };

export type StepEvent = GameEvent & { step: number };

export interface TurnResult {
  state: GameState;
  events: StepEvent[];
}
