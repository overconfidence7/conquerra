import type { BorderType, BuildingType, MapDef, MissionKind, Rules, SpecialistType, SpoilsMark } from "@conquerra/content";
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

/** A Spoils set to turn in: three alike, or one of each ("mixed"). */
export type SpoilsSet = SpoilsMark | "mixed";
export type { SpoilsMark, MissionKind };

/** What a mission pays when it's done (copied from the rules when it's drawn, so it never changes underneath you). */
export interface MissionReward {
  gold?: number;
  /** Troops at your capital (or where the mission's land is, for a land mission). */
  troops?: number;
  /** Culture levels on the mission's land (or your capital). */
  culture?: number;
  /** A free specialist with the army at your capital (gold instead if there's no room). */
  specialist?: SpecialistType;
}

/**
 * A Fate mission you drew (session 13): a goal with a deadline and a reward, checked from the game at the end of
 * every turn. Only you see your missions.
 */
export interface Mission {
  /** Unique within the game ("m12"). */
  id: string;
  /** Which mission card (rules.fate.missions[].id). */
  card: string;
  kind: MissionKind;
  /** Done by the end of this turn, or it lapses. (For "hold" missions: held through the end of this turn.) */
  deadline: number;
  /** The place or rival it's about. */
  territory?: TerritoryId;
  province?: string;
  rival?: PlayerId;
  border?: BorderType;
  /** How many it needs (territories to take), and how many so far. */
  need?: number;
  progress?: number;
  reward: MissionReward;
}

// ---------- Diplomacy (session 14) ----------

/** The four deal cards. */
export const DEAL_KINDS = ["truce", "trade", "war", "passage"] as const;
export type DealKind = (typeof DEAL_KINDS)[number];
/** A handshake deal is free and can be broken (Oathbreaker); a binding pact costs gold up front and can't be. */
export type Bond = "handshake" | "binding";

/** Where a truce holds: everywhere between you, a whole province, or named borders (pairs of territories). */
export type TruceScope = { kind: "all" } | { kind: "province"; province: string } | { kind: "borders"; borders: [TerritoryId, TerritoryId][] };

/** One side of a trade: gold now, gold each turn (for the deal's `turns`), and land. */
export interface TradeSide {
  gold?: number;
  perTurn?: number;
  land?: TerritoryId[];
}

/**
 * A deal card's terms. Sides are the proposer (`a`) and the one it's offered to (`b`).
 *  - truce: no attacks between you where the scope says, for `turns` (or until `until` is knocked out, `turns` at most)
 *  - trade: `give` goes from the proposer to the other side, `get` the other way; gold each turn runs for `turns`
 *  - war: a joint war on `target` for `turns`, with a truce between the partners while it lasts
 *  - passage: the proposer's armies may move through the other's land (both ways if `mutual`), never stopping or
 *    fighting there (a move's `through`)
 */
export type DealTerms =
  | { kind: "truce"; scope: TruceScope; turns: number; until?: PlayerId }
  | { kind: "trade"; give: TradeSide; get: TradeSide; turns?: number }
  | { kind: "war"; target: PlayerId; turns: number }
  | { kind: "passage"; turns: number; mutual: boolean };

/** An offer, made during planning. It starts a deal only if the other side accepts it in the same planning phase. */
export interface Offer {
  /** Unique among the proposer's offers this turn. */
  id: string;
  from: PlayerId;
  to: PlayerId;
  terms: DealTerms;
  bond: Bond;
  /** A counteroffer: the offer (of the other side's) it answers. */
  counterTo?: string;
  /** One line from the proposer: why it's asking (bots always say; the engine ignores it). */
  note?: string;
}

/** A deal in force. */
export interface Deal {
  id: string;
  /** The proposer and the one who accepted. */
  a: PlayerId;
  b: PlayerId;
  terms: DealTerms;
  bond: Bond;
  /** The turn it started (it covers that turn's moves), and the last turn it's in force (it ends as that turn ends). */
  start: number;
  last: number;
  /** How much it covers (scales the Oathbreaker penalty and a binding pact's price). */
  size: number;
  /** A joint war: the partners who have attacked the target so far. */
  struck?: PlayerId[];
}

/** How a deal ended, kept for the bots' trust and the report ("You broke our truce at Old March"). */
export interface DealRecord {
  deal: string;
  kind: DealKind;
  bond: Bond;
  a: PlayerId;
  b: PlayerId;
  start: number;
  /** The turn it ended. */
  end: number;
  /** "kept": it ran its course (or its goal was met); "broken": someone broke it; "ended": a side was knocked out. */
  how: "kept" | "broken" | "ended";
  /** Who broke it, and where (the land attacked), if it was broken. */
  by?: PlayerId;
  at?: TerritoryId;
  /** A joint war: partners who never attacked the target. */
  idle?: PlayerId[];
}

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
  /** Your Spoils cards (session 13), in the order you earned them. Others only ever see how many. */
  spoils: SpoilsMark[];
  /** Your open Fate missions (at most rules.fate.maxMissions). Only you see them. */
  missions: Mission[];
  /** Oathbreaker (session 14): you broke a handshake deal; the public mark shows through this turn (0: none). */
  oathbreaker: number;
}

// ---------- Spies (session 15) ----------

/**
 * Where a spy stands with respect to its province:
 *  - travel: in a province no single player holds whole (it lifts the fog `rules.spies.sight` territories around it)
 *  - defend: in a province its owner holds whole (it holds its post and blocks other spies)
 *  - in: it got into a province a rival holds whole (the fog stays lifted on the whole province)
 */
export type SpyStatus = "travel" | "defend" | "in";

/** A spy: its own piece, not part of an army. Only its owner ever sees it. */
export interface Spy {
  /** Unique within the game ("y3"). */
  id: string;
  owner: PlayerId;
  at: TerritoryId;
  /** The province it's heading for (null: it stays where it is). */
  target: string | null;
  /** Called home: it's back at its owner's capital as the next turn starts. */
  recalled: boolean;
  status: SpyStatus;
  /**
   * Infiltrating ("in"): the province's holder and how many defending spies it was contested against (the contest runs
   * again when either changes), and whether the defenders fooled it. Kept in the game, never sent to a client: a fooled
   * spy's owner sees exactly what a real infiltration would show.
   */
  holder?: PlayerId;
  defence?: number;
  fooled?: boolean;
}

/** What a player sees on a territory they have vision of (or that their spy reports on). */
export interface TerritoryDetail {
  owner: PlayerId | null;
  troops: number;
  specialists: Specialist[];
  building: BuildingType | null;
  construction: TerritoryState["construction"];
  culture: number;
  /** Leaders standing here. */
  leaders: PlayerId[];
  /** Captured generals standing here (whose Leader each was), commanded by whoever holds the land. */
  generals: PlayerId[];
  /** Whose capital this is, while its own House holds it. You learn a rival's capital by seeing it. */
  capitalOf: PlayerId | null;
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
  /** The Spoils deck: a card for each turn you take land, turned in as sets for a windfall (on by default). */
  spoils: boolean;
  /** The Fate deck: everyone draws one card a turn, an event somewhere on the map or a mission (a lobby switch, on by default). */
  fate: boolean;
  /** Diplomacy: deals between players (on by default; the simulator compares with it off). */
  diplomacy: boolean;
  /** Spies (session 15): hire spies to see deep behind the lines (on by default, and only with fog; the simulator compares with them off). */
  spies: boolean;
}

export interface GameState {
  version: 6;
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
  /**
   * The card decks' own seeded random numbers (from the game's seed, like the dice): Spoils marks and Fate draws.
   * Separate from the dice, so turning a deck off doesn't change any battle's roll.
   */
  decks: { spoils: RngState; fate: RngState; spies: RngState };
  /** Borders a Fate event closed for a coming turn (a flooded ford, a rockslide): closed through all of `turn`. */
  closures: { a: TerritoryId; b: TerritoryId; turn: number }[];
  /** Counter for mission ids. */
  nextMission: number;
  /** Deals in force (session 14). Public who-and-what; a trade's terms only reach its two sides (view.ts). */
  deals: Deal[];
  /** Counter for deal ids. */
  nextDeal: number;
  /** How past deals ended (kept, broken, ended): the bots' trust is worked out from it. */
  record: DealRecord[];
  /** Every player's spies (session 15). Each player only ever sees their own (view.ts). */
  spies: Spy[];
  /** Counter for spy ids. */
  nextSpy: number;
  /**
   * Each player's spy reports for the turn they're planning: the land their spies lift the fog from, as their spies
   * saw it at the end of the last turn (a fooled spy's is false, and stored exactly like a true one). Land the player
   * sees directly isn't in it: what you see yourself always wins. Never sent whole to a client.
   */
  spyIntel: Record<PlayerId, Record<TerritoryId, TerritoryDetail>>;
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
  /** Hire a spy at your capital or a barracks (session 15). It's its own piece, and goes where you send it from next turn. */
  | { kind: "hireSpy"; territory: TerritoryId }
  /**
   * Send a spy of yours to a province (`to`), or call it home (`to` null: it's back at your capital as the next turn
   * starts). Takes no slot: spies travel as the turn ends, after every army's move.
   */
  | { kind: "spy"; spy: string; to: string | null }
  | { kind: "build"; territory: TerritoryId; building: BuildingType }
  | { kind: "invest"; territory: TerritoryId }
  | {
      kind: "move";
      from: TerritoryId;
      to: TerritoryId;
      /** Middle step for 2-territory moves (armies with cavalry). Must be yours when the order runs. */
      via?: TerritoryId;
      /**
       * Right of passage (session 15): the land passed through on the way from `from` to `to`, in order: a partner's
       * land you have passage through (or your own). The army never stops or fights there. If land on the way has
       * changed hands when the order plays, the army stops at your last territory before it.
       */
      through?: TerritoryId[];
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
  | { kind: "advance"; from: TerritoryId }
  /**
   * Turn in a Spoils set for its windfall. `territory`: where a Tower set's fort goes, or the province a Laurel set
   * raises culture in (default: your capital).
   */
  | { kind: "spoils"; set: SpoilsSet; territory?: TerritoryId }
  /**
   * Diplomacy (session 14). None of these takes a slot: they're applied as the turn starts, before any move.
   * propose: make an offer (`offer.from` is you). answer: accept or decline an offer made to you this planning phase
   * (a deal starts only if both sides confirm in the same planning phase). break: renounce a handshake deal of yours
   * (Oathbreaker); `note` is a line for the report (the Captain says why).
   */
  | { kind: "propose"; offer: Offer }
  | { kind: "answer"; from: PlayerId; offer: string; accept: boolean }
  | { kind: "break"; deal: string; note?: string };

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
  "noSet",
  "pact",
  "passage",
  "spyCap",
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
  /** "pact": who the binding pact is with. */
  player?: PlayerId;
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
  /** You hired a spy (only you see it). */
  | { type: "spyHired"; player: PlayerId; orderId: string; territory: TerritoryId; spy: string; cost: number }
  /**
   * Your spy's news, as the turn ends (only you see it): it got into a province ("in": a fooled spy reads exactly the
   * same), was turned back ("blocked": it's home again), was killed ("killed": every spy in that attempt), or came
   * home when called ("home").
   */
  | { type: "spy"; player: PlayerId; spies: string[]; province: string; outcome: "in" | "blocked" | "killed" | "home"; territory: TerritoryId }
  /** A spy was caught in your province (only you see it; never who sent it, and never a spy that fooled you... you fooled it). */
  | { type: "spyCaught"; player: PlayerId; province: string; outcome: "blocked" | "killed"; spies: number }
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
      /** Right of passage: the partner's land it marched through on the way. */
      through?: TerritoryId[];
      /** It meant to go on to here, but land on the way had changed hands: it stopped at `to`, its last land before it. */
      stopped?: TerritoryId;
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
      /** Right of passage: the partner's land it marched through to get here (it attacked from the last of them). */
      through?: TerritoryId[];
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
  | { type: "gameOver"; winner: PlayerId | "draw"; reason: NonNullable<GameState["endReason"]>; scores: Record<PlayerId, number> }
  /** You took land this turn: a Spoils card (only you see its mark). */
  | { type: "spoilsEarned"; player: PlayerId; mark: SpoilsMark; hand: number }
  /**
   * A Spoils set turned in: its windfall at `at`. `orderId` null: turned in for you at the hand limit. `land` is the
   * land as it is afterwards (troops, a fort, culture).
   */
  | {
      type: "spoilsTurnedIn";
      player: PlayerId;
      orderId: string | null;
      set: SpoilsSet;
      at: TerritoryId;
      troops: number;
      gold: number;
      fort: boolean;
      /** Territories that gained a level of culture. */
      culture: TerritoryId[];
      land: LandChange[];
    }
  /**
   * A Fate event (drawn by `drawer`, landing anywhere on the map). `holder` held the land when it struck (null:
   * neutral). `shrugged`: culture protected the land and nothing happened. `land` is the land afterwards; `gold` is
   * the holder's gold change; `border` a crossing closed through turn `until`.
   */
  | {
      type: "fate";
      drawer: PlayerId;
      card: string;
      at: TerritoryId;
      holder: PlayerId | null;
      tone: "good" | "bad";
      shrugged: boolean;
      land: LandChange[];
      /** The holder's gold change. */
      gold?: number;
      /** Troops that joined (+) or died (-), all told. */
      troops?: number;
      /** The building finished or burnt. */
      building?: BuildingType;
      /** The culture level it rose to. */
      culture?: number;
      /** An uprising: its rebels, and whether they took the land. */
      rebels?: number;
      flipped?: boolean;
      border?: [TerritoryId, TerritoryId];
      until?: number;
    }
  /** You drew a mission (only you see it). */
  | { type: "missionDrawn"; player: PlayerId; mission: Mission }
  /** Your mission is done: its reward, paid now. `land` is the land the reward changed. */
  | { type: "missionDone"; player: PlayerId; mission: Mission; at: TerritoryId | null; gold: number; land: LandChange[] }
  /** Your mission lapsed (the deadline passed, or the land you were to hold was lost). */
  | { type: "missionFailed"; player: PlayerId; mission: Mission; why: "expired" | "lost" }
  /**
   * A deal starts (both sides confirmed this planning phase), before any move. Public: who and what. `paid`: gold each
   * side paid for a binding pact; `gold`: gold that changed hands now (+ received, - given); `land`: traded land as it
   * is afterwards (troops stepped back and in). A trade's terms, gold and land only reach its two sides (and land
   * whoever can see it).
   */
  | { type: "dealStarted"; deal: Deal; paid: Record<PlayerId, number>; gold: Record<PlayerId, number>; land: LandChange[] }
  /** An offer that was accepted but couldn't start (now invalid, a side couldn't pay, ...). Only the two sides see it. */
  | { type: "dealFailed"; offer: Offer; why: DealProblem }
  /** An offer nobody confirmed lapses as the turn resolves; one between two players who fought this turn is voided. Only the two sides see it. */
  | { type: "offerLapsed"; offer: Offer; why: "unanswered" | "declined" | "voided" }
  /** A deal ran its course (or its goal was met: the joint war's target is out), or ended because a side was knocked out. Public. */
  | { type: "dealEnded"; deal: string; kind: DealKind; a: PlayerId; b: PlayerId; why: "expired" | "goal" | "knockedOut"; idle?: PlayerId[] }
  /**
   * A handshake deal broken by `by` (an attack across it at `at`, a payment missed, renounced, or a truce with a joint
   * war's target). Public: the Oathbreaker mark (through turn `mark`), the fine, and the unrest (troops that deserted
   * on `by`'s land next to the wronged player, `land` as it is afterwards; land only to whoever can see it).
   */
  | {
      type: "dealBroken";
      deal: string;
      kind: DealKind;
      a: PlayerId;
      b: PlayerId;
      by: PlayerId;
      how: "attack" | "payment" | "renounced" | "truceWithTarget";
      at?: TerritoryId;
      note?: string;
      mark: number;
      fine: number;
      unrest: number;
      land: LandChange[];
    }
  /**
   * Gold owed each turn under a trade, paid as the turn ends (after income). A binding pact takes it automatically;
   * anything short becomes unrest (troops desert, as with upkeep), in `land`. Only the two sides see it.
   */
  | { type: "tribute"; deal: string; from: PlayerId; to: PlayerId; gold: number; short: number; land: LandChange[] };

/** Why an accepted offer couldn't start. */
export type DealProblem = "invalid" | "gone" | "exists" | "gold" | "land" | "target" | "pact";

/** A territory as it is right after a card's effect (only what changed), so the replay can show it exactly. */
export type LandChange = { territory: TerritoryId } & Partial<Pick<TerritoryState, "owner" | "troops" | "specialists" | "building" | "construction" | "culture">>;

export type StepEvent = GameEvent & { step: number };

export interface TurnResult {
  state: GameState;
  events: StepEvent[];
}
