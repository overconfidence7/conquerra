import {
  agreedIn,
  answerOrder,
  captainBot,
  dealPersonalities,
  fallenBot,
  judgeBy,
  leadersRunHouse,
  makeMarshalBot,
  negotiate,
  personality,
  PERSONALITY_IDS,
  freshMemory,
  planLeaders,
  recruitBot,
  think,
  withAgreed,
  type Answer,
  type Bot,
  type LeaderNote,
  type MarshalBot,
  type MarshalMemory,
} from "@conquerra/bots";
import { defaultRules, marshalData, type MapDef, type PersonalityId } from "@conquerra/content";
import {
  createGame,
  LEADER_STYLES,
  STEWARD_STYLES,
  type LeaderStyle,
  Rng,
  seedRng,
  makeSave,
  replayFor,
  resolveTurn,
  viewFor,
  type GameContext,
  type GameState,
  type Instruction,
  type NewGameOptions,
  type Offer,
  type PlayerId,
  type Order,
  type OrdersByPlayer,
  type PlayerView,
  type ReplayEvent,
  type SaveFile,
} from "@conquerra/engine";
import { buildTimeline } from "../replay/timeline";
import { chronicleOf } from "../logic/chronicleKeep";
import { comebackStep, ownLand } from "../logic/comeback";
import { leaderVoices, type VoiceMemory } from "../logic/voices";
import { BOT_NAMES } from "./names";
import { DEFAULT_HOUSE } from "../map/houses";
import type { BotChoice, BotLevel, HostStart, HostUpdate, LobbySettings, SeatInfo, TurnReport } from "./protocol";
import type { TurnClock } from "../logic/timer";

export { BOT_NAMES };

export const HUMAN_ID = "you";

/** The Recruit and the Captain: one bot plays every seat of that level. (A Marshal is one bot per seat: it has a personality and a memory.) */
export const BOTS: Record<Exclude<BotLevel, "marshal">, Bot> = { recruit: recruitBot, captain: captainBot };
const LEVELS: readonly BotLevel[] = ["recruit", "captain", "marshal"];
const PERSONALITY_SET = new Set<string>(PERSONALITY_IDS);

/** A bot seat: its level, a Marshal's personality, and the bot that plays it. */
interface BotSeat {
  level: BotLevel;
  personality?: PersonalityId;
  bot: Bot;
}

/** The bot for a seat of this level (a Marshal gets its own, with its personality). */
function seatBot(level: BotLevel, p?: PersonalityId): BotSeat {
  if (level === "marshal") {
    const id = p ?? "conqueror";
    return { level, personality: id, bot: makeMarshalBot(id) };
  }
  return { level, bot: BOTS[level] };
}

/**
 * Each bot seat's level for a new game: one level for all, or a mixed table (`marshals` Marshals, the rest Captains,
 * seated at random from the game's seed); Marshals' personalities dealt from the seed (no two alike until all six
 * are used).
 */
export function seatLevels(choice: BotChoice, marshals: number, seats: readonly PlayerId[], seed: string): Record<PlayerId, { level: BotLevel; personality?: PersonalityId }> {
  let levels: BotLevel[];
  if (choice === "mixed") {
    const k = Math.max(0, Math.min(seats.length, Math.floor(marshals)));
    const order = seats.map((_, i) => i);
    const rng = new Rng(seedRng(`${seed}|mixed`));
    for (let i = order.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
    const chosen = new Set(order.slice(0, k));
    levels = seats.map((_, i) => (chosen.has(i) ? "marshal" : "captain"));
  } else levels = seats.map(() => (LEVELS.includes(choice) ? choice : "captain"));
  const dealt = dealPersonalities(seed, seats.filter((_, i) => levels[i] === "marshal"));
  return Object.fromEntries(seats.map((s, i) => [s, levels[i] === "marshal" ? { level: "marshal" as const, personality: dealt[s]! } : { level: levels[i]! }]));
}

/** After the replay, a moment to read the turn report before the countdown starts. */
export const REPORT_GRACE_MS = 3000;
/** Online (session 26, the plan §3): the next window opens after the longest replay at the table plus 10 s for everyone. */
export const ONLINE_GRACE_MS = 10_000;

/** What the host keeps for one person at an online table (single player keeps yours in `LocalHostData` itself). */
export interface PersonData {
  /** The orders they'd queued but not locked in, with the generals whose army they took back. */
  queued?: { turn: number; orders: Order[]; paused: PlayerId[] };
  /** Their Chronicle: every turn's report as they saw it, trimmed to what the Chronicle shows. */
  chronicle?: TurnReport[];
  /** What their leaders remember (for their plans), as this turn's planning began. */
  leaderMemory?: MarshalMemory;
  /** What their leaders remember for what they say. */
  voiceMemory?: VoiceMemory;
  /** They sent orders this turn (a missed turn is one where they never did). */
  touched?: boolean;
  /** They locked in this turn. */
  locked?: boolean;
  /** The last turn's replay as they saw it (their view before it, and their report), for a player coming back. */
  last?: { before: PlayerView; report: TurnReport };
  /** Nate, Oct 12: "If I miss a turn with no orders, my leaders run my House". */
  leadersRun?: boolean;
}

/** What this host keeps in a save besides the game itself (`SaveFile.host`). */
export interface LocalHostData {
  /** The lobby's choice (kept for saves from before session 17, whose seats all played at this level). */
  botLevel: BotChoice;
  /** Each bot seat's level and, for a Marshal, its personality (session 17). */
  seats?: Record<PlayerId, { level: BotLevel; personality?: PersonalityId }>;
  /** What each Marshal remembers (session 17): so a loaded game plays on exactly as it would have. */
  memories?: Record<PlayerId, MarshalMemory>;
  /** "Show personalities" (session 17): the Marshals' personalities are shown during play, not only at the end. */
  showPersonalities?: boolean;
  /** The turn timer in seconds, or null for No timer. */
  turnSeconds: number | null;
  /** What each seat watched in the last replay (its own view), for the bots' and your generals' next plans. */
  lastTurn: Record<PlayerId, ReplayEvent[]>;
  /**
   * The orders you'd queued but not locked in (Nate, Oct 6: Continue keeps them), with the generals whose army you
   * took back. Only used if the save is still on that turn.
   */
  queued?: { turn: number; orders: Order[]; paused: PlayerId[] };
  /** This turn's diplomacy among the bots and their answers to you (session 14), so Continue keeps it too. */
  talk?: Talk;
  /** The Chronicle (session 16): every turn's report as you saw it, trimmed to what the Chronicle shows. */
  chronicle?: TurnReport[];
  /** What your leaders remember (session 18: the Marshal's memory, for reading a runaway), as this turn's planning began. */
  leaderMemory?: MarshalMemory;
  /** What your leaders remember for what they say (session 22: grudges, when your Leader last judged a move of yours). */
  voiceMemory?: VoiceMemory;
  /**
   * An online game (session 26): each person at the table, by player id in seat order (single player keeps you in
   * the fields above instead, so its saves are as they were), and the room's clock.
   */
  people?: Record<PlayerId, PersonData>;
  online?: { deadline: number | null; opensAt: number | null };
}

/** The bots' diplomacy for one turn: their propose/answer orders, and the offers they made to people. */
interface Talk {
  turn: number;
  orders: OrdersByPlayer;
  toHuman: Offer[];
}

/** A person at an online table (session 26), as the room seats them. */
export interface PersonSeat {
  id: PlayerId;
  name: string;
  house: number;
  leaderName?: string;
  stewardName?: string;
  leaderPersonality?: LeaderStyle | null;
  stewardPersonality?: LeaderStyle | null;
  /** "If I miss a turn with no orders, my leaders run my House" (on by default). */
  leadersRun: boolean;
}

/** An online game (session 26): its id and the people at the table, in seat order (the bots sit after them). */
export interface TableSetup {
  gameId: string;
  people: PersonSeat[];
}

export interface LocalGameOptions {
  /** Carry on from a save instead of starting a new game (`settings` and `seed` are then ignored). */
  restore?: SaveFile;
  /** Called with a fresh save at the start of every turn's planning (the worker writes it to the device). */
  autosave?: (save: SaveFile) => void;
  /** An online game: who sits where (a new game only; a restored one brings its table). */
  table?: TableSetup;
}

/** One person at the table: what the host keeps for them between their requests. */
interface Person {
  id: PlayerId;
  /** Their orders as they build them (the page keeps sending them), locked in when time runs out. */
  saved: Order[];
  /** Generals whose army they took back this turn (the page sends them with the orders; kept for Continue). */
  savedPaused: PlayerId[];
  /** Their queue as a save brought it back (Continue), sent to the page once with the first update. */
  restored: { orders: Order[]; paused: PlayerId[] } | null;
  /** What their leaders remember (session 18), as this turn's planning began. */
  leaderMemory: MarshalMemory;
  /** What their leaders remember for what they say (session 22). */
  voiceMemory: VoiceMemory;
  /** What each of their leaders said it's up to, the last time they planned (session 20). */
  leaderNotes: Record<string, LeaderNote>;
  /** Their Chronicle (session 16): every turn so far, only what they were allowed to see. */
  chronicle: TurnReport[];
  /** Online: sent orders this turn. */
  touched: boolean;
  /** Online: locked in this turn. */
  locked: boolean;
  /** Online: the last turn's replay as they saw it. */
  last: { before: PlayerView; report: TurnReport } | null;
  leadersRun: boolean;
}

const newPerson = (id: PlayerId, leadersRun = true): Person => ({ id, saved: [], savedPaused: [], restored: null, leaderMemory: freshMemory(), voiceMemory: {}, leaderNotes: {}, chronicle: [], touched: false, locked: false, last: null, leadersRun });

/**
 * A whole game: the full state, the bots and turn resolution, for a table of people (single player: you alone) and
 * bots. In single player it lives inside the Web Worker; online (session 26) in the game's room on the server. Either
 * way the page never holds the full state: each person only gets `viewFor` + `replayFor` from their own seat.
 */
export class LocalGame {
  readonly ctx: GameContext;
  private state: GameState;
  private turnMs: number | null;
  /** When the current turn's orders lock in automatically (null: no timer, nothing to lock, or paused). */
  private deadline: number | null = null;
  /** Online: when the planning window opens (after the longest replay at the table and the grace). */
  private opensAt: number | null = null;
  /** Paused: the time that was left on the clock (null: not paused). */
  private pausedLeft: number | null = null;
  /** The people at the table, in seat order (single player: you alone). */
  private people = new Map<PlayerId, Person>();
  /** An online game: the clock waits for the longest replay plus 10 s, and missed turns follow the plan's rules. */
  readonly online: boolean;
  /** Each bot seat's level, personality and bot (session 17: tables can mix levels). */
  private seats = new Map<PlayerId, BotSeat>();
  private readonly botLevel: BotChoice;
  private readonly showPersonalities: boolean;
  /** How the game was set up, the rules and every turn's orders, so `pnpm sim --replay` can play a save back. */
  private history: { setup: NewGameOptions; rules: typeof defaultRules; turns: OrdersByPlayer[] } | null;
  private readonly autosave?: (save: SaveFile) => void;
  /** What each seat watched in the last replay (from its own seat): the bots', and the people's for their generals. */
  private lastTurn = new Map<string, ReplayEvent[]>();
  /** This turn's diplomacy: the bots' offers and answers (to each other and to people), worked out as planning starts. */
  private talk: Talk = { turn: 0, orders: {}, toHuman: [] };
  /** Online: whose leaders ran their House on the turn being resolved (the card tells the table). */
  private ranNow: PlayerId[] = [];

  constructor(
    /** The map to play on (the worker loads it with `loadMap`; tests pass it straight from `maps`). */
    map: MapDef,
    settings: LobbySettings,
    seed: string,
    /** The host's clock (ms). Injected so tests can move time; the engine itself never reads a clock. */
    private now: () => number = () => Date.now(),
    opts: LocalGameOptions = {},
  ) {
    this.ctx = { map, rules: defaultRules };
    this.autosave = opts.autosave;
    const restore = opts.restore;
    const host = (restore?.host ?? {}) as Partial<LocalHostData>;
    if (restore) {
      // Carry on from a save: the game as it stood, under today's rules.
      if (restore.mapId !== map.id || restore.mapVersion !== (map.generator?.version ?? null))
        throw new Error("This save's map has changed since it was saved, so it can't be loaded.");
      this.botLevel = host.botLevel && (LEVELS.includes(host.botLevel as BotLevel) || host.botLevel === "mixed") ? host.botLevel : "captain";
      this.showPersonalities = !!host.showPersonalities;
      this.state = restore.state;
      this.online = !!host.online;
      // The people at the table: an online game's from its record; single player's, you.
      if (host.people) for (const [id, d] of Object.entries(host.people)) this.people.set(id, personFrom(id, d));
      else
        this.people.set(
          HUMAN_ID,
          personFrom(HUMAN_ID, { ...(Array.isArray(host.chronicle) ? { chronicle: host.chronicle } : {}), ...(host.leaderMemory ? { leaderMemory: host.leaderMemory } : {}), ...(host.voiceMemory ? { voiceMemory: host.voiceMemory } : {}) }),
        );
      // Each seat as it was saved (a save from before session 17: every bot at the game's one level).
      for (const p of this.state.players) {
        if (this.people.has(p.id)) continue;
        const saved = host.seats?.[p.id];
        const level = saved && LEVELS.includes(saved.level) ? saved.level : this.botLevel === "mixed" ? "captain" : this.botLevel;
        const known = saved?.personality && PERSONALITY_SET.has(saved.personality) ? saved.personality : undefined;
        const seat = seatBot(level, known);
        const mem = host.memories?.[p.id];
        if (mem && seat.level === "marshal") (seat.bot as MarshalBot).restore(this.state.gameId, p.id, mem);
        this.seats.set(p.id, seat);
      }
      const seconds = host.turnSeconds === undefined ? null : host.turnSeconds;
      this.turnMs = seconds === null ? null : seconds * 1000;
      this.lastTurn = new Map(Object.entries(host.lastTurn ?? {}));
      if (host.talk && host.talk.turn === restore.state.turn) this.talk = host.talk;
      // The history only replays exactly under the rules it was played with; a game carried on under new ones drops it.
      const h = restore.history;
      this.history = h && JSON.stringify(h.rules) === JSON.stringify(defaultRules) ? h : null;
    } else {
      this.botLevel = LEVELS.includes(settings.botLevel as BotLevel) || settings.botLevel === "mixed" ? settings.botLevel : "captain";
      this.showPersonalities = !!settings.showPersonalities;
      const table = opts.table;
      this.online = !!table;
      const people = table?.people ?? [];
      const bots = Math.max(table ? 0 : 1, Math.min(map.maxPlayers - Math.max(1, people.length), BOT_NAMES.length, Math.floor(settings.bots)));
      // Who plays each bot seat (dealt from the seed, before the game exists: a Marshal's leaders carry its personality).
      const botIds = BOT_NAMES.slice(0, bots).map((_, i) => `bot${i + 1}`);
      const levels = seatLevels(this.botLevel, settings.marshals ?? Math.ceil(bots / 2), botIds, seed);
      const style = (p: unknown): LeaderStyle | null => (typeof p === "string" && (LEADER_STYLES as readonly string[]).concat(STEWARD_STYLES).includes(p) ? (p as LeaderStyle) : null);
      // A person's seat: the names (and, session 20c, the personalities) they gave their Leader and Steward. Their
      // Steward starts running the realm (session 18).
      const personPlayer = (p: Omit<PersonSeat, "leadersRun">) => ({
        id: p.id,
        name: p.name,
        house: p.house,
        delegate: true,
        ...(p.leaderName ? { leaderName: p.leaderName } : {}),
        ...(p.stewardName ? { stewardName: p.stewardName } : {}),
        ...(style(p.leaderPersonality) ? { leaderPersonality: style(p.leaderPersonality) } : {}),
        ...(style(p.stewardPersonality) ? { stewardPersonality: style(p.stewardPersonality) } : {}),
      });
      const you: Omit<PersonSeat, "leadersRun"> = {
        // You are Gules (red) unless you chose another House; the bots take the rest in order.
        id: HUMAN_ID,
        name: "You",
        house: settings.house ?? DEFAULT_HOUSE,
        ...(settings.leaderName ? { leaderName: settings.leaderName } : {}),
        ...(settings.stewardName ? { stewardName: settings.stewardName } : {}),
        leaderPersonality: settings.leaderPersonality ?? null,
        stewardPersonality: settings.stewardPersonality ?? null,
      };
      const players = [
        ...(table ? people : [you]).map(personPlayer),
        ...BOT_NAMES.slice(0, bots).map((name, i) => {
          const p = levels[botIds[i]!]?.level === "marshal" ? style(levels[botIds[i]!]!.personality) : null;
          return { id: botIds[i]!, name, bot: true, ...(p ? { leaderPersonality: p, stewardPersonality: p } : {}) };
        }),
      ];
      if (table) for (const p of people) this.people.set(p.id, newPerson(p.id, p.leadersRun));
      else this.people.set(HUMAN_ID, newPerson(HUMAN_ID));
      const setup: NewGameOptions = {
        gameId: table?.gameId ?? `local-${seed.slice(0, 8)}`,
        seed,
        players,
        settings: {
          mode: settings.mode,
          luck: settings.luck,
          fog: settings.fog,
          // The engine just stores the timer; "No timer" is stored as the longest allowed.
          turnTimerSeconds: settings.turnSeconds ?? defaultRules.game.turnTimerSecondsMax,
          fate: settings.fate ?? true,
          diplomacy: settings.diplomacy ?? true,
        },
        // A harder capital spot starts with extra troops (session 23), and goes to a bot before a person (session 25;
        // always since 25b, no lobby row). The setup keeps the rule, so a save replays as it was played.
        startBonus: true,
        seatRule: "botsFirst",
      };
      this.state = createGame(this.ctx, setup);
      for (const [id, s] of Object.entries(levels)) this.seats.set(id, seatBot(s.level, s.personality));
      this.history = { setup, rules: defaultRules, turns: [] };
      this.turnMs = settings.turnSeconds === null || settings.turnSeconds === undefined ? null : settings.turnSeconds * 1000;
    }
    // A game just loaded doesn't save itself again until its next turn starts.
    this.startClock(0, !restore);
    // Online: the room's clock as it stood (a room that slept between turns carries on with the same deadline).
    if (restore && this.online && host.online) {
      this.deadline = host.online.deadline;
      this.opensAt = host.online.opensAt;
    }
    // Continue puts back the orders each person had queued on this turn (and, online, whether they'd locked in).
    for (const person of this.people.values()) {
      const d = host.people?.[person.id];
      const queued = d ? d.queued : person.id === HUMAN_ID ? host.queued : undefined;
      if (queued && queued.turn === this.state.turn && Array.isArray(queued.orders) && !this.state.winner && !this.isOut(person.id)) {
        person.saved = queued.orders;
        person.savedPaused = Array.isArray(queued.paused) ? queued.paused : [];
        person.restored = { orders: queued.orders, paused: person.savedPaused };
        if (d) {
          person.touched = !!d.touched;
          person.locked = !!d.locked;
        }
      }
    }
  }

  /** Carry on from a save (already read and brought up to date with `readSave`). */
  static restore(map: MapDef, save: SaveFile, now: () => number = () => Date.now(), autosave?: (save: SaveFile) => void): LocalGame {
    // (The lobby settings and seed aren't used: everything comes from the save.)
    const unused: LobbySettings = { mapId: map.id, bots: 1, botLevel: "captain", luck: 0, fog: true, mode: "classic", turnSeconds: null };
    return new LocalGame(map, unused, "", now, { restore: save, ...(autosave ? { autosave } : {}) });
  }

  /** The people at the table, in seat order (single player: just you). */
  get peopleIds(): PlayerId[] {
    return [...this.people.keys()];
  }

  private person(id: PlayerId): Person {
    const p = this.people.get(id);
    if (!p) throw new Error("You don't have a seat in this game");
    return p;
  }

  /**
   * A new turn's planning starts: start the countdown (after `replayMs` of replay plus a moment for the report; online,
   * the longest replay at the table plus 10 s), and save the game (Continue, or the room's storage, picks it up).
   */
  private startClock(replayMs: number, autosave = true) {
    // The bots talk first (offers between them answered at once; offers to people wait for them), then each person's
    // generals plan.
    if (this.talk.turn !== this.state.turn) this.botTalks();
    for (const p of this.people.values()) {
      // Their generals' orders go in even if they never touch the turn.
      p.saved = this.generalOrders({}, undefined, p.id);
      p.savedPaused = [];
      p.touched = false;
      p.locked = false;
    }
    this.pausedLeft = null;
    const grace = this.online ? ONLINE_GRACE_MS : REPORT_GRACE_MS;
    const running = this.turnMs !== null && !this.state.winner && (this.online ? this.living.length > 0 : !this.isOut(HUMAN_ID));
    this.opensAt = running ? this.now() + replayMs + (replayMs ? grace : 0) : null;
    this.deadline = this.opensAt !== null ? this.opensAt + this.turnMs! : null;
    if (autosave && !this.state.winner) this.autosave?.(this.snapshot());
  }

  /** The current turn's clock, for the page's countdown (with the time left while paused). */
  get clock(): TurnClock | null {
    if (this.turnMs === null) return null;
    if (this.pausedLeft !== null) return { endsAt: this.now() + this.pausedLeft, turnMs: this.turnMs, pausedLeft: this.pausedLeft };
    return this.deadline === null ? null : { endsAt: this.deadline, turnMs: this.turnMs };
  }

  /**
   * Pause the turn timer (single player). Planning goes on; nothing locks in until you resume. A host action, so
   * M4's pause by vote can wrap it. With no timer running there's nothing to pause.
   */
  pause(): HostUpdate {
    if (this.deadline !== null) {
      this.pausedLeft = Math.max(0, this.deadline - this.now());
      this.deadline = null;
    }
    return this.update();
  }

  resume(): HostUpdate {
    if (this.pausedLeft !== null) {
      this.deadline = this.now() + this.pausedLeft;
      this.pausedLeft = null;
    }
    return this.update();
  }

  get isPaused(): boolean {
    return this.pausedLeft !== null;
  }

  get over(): boolean {
    return this.state.winner !== null;
  }

  /** The turn being planned. */
  get turn(): number {
    return this.state.turn;
  }

  /** Who won (null while the game goes on). */
  get winner(): PlayerId | null {
    return this.state.winner;
  }

  /** Online: when the planning window opens (ms, the room's clock), or null. */
  get windowOpensAt(): number | null {
    return this.opensAt;
  }

  /** The first message: the map and rules, plus this person's opening view. */
  start(id: PlayerId = HUMAN_ID): HostStart {
    const p = this.person(id);
    const restored = p.restored;
    p.restored = null;
    return { ...this.update(null, 0, id), map: this.ctx.map, rules: this.ctx.rules, chronicle: p.chronicle, ...(restored ? { queued: restored } : {}) };
  }

  /** What this person gets: their own fogged view and report, and nothing from anyone else's seat. */
  update(report: HostUpdate["report"] = null, fastForwarded = 0, id: PlayerId = HUMAN_ID): HostUpdate {
    const p = this.person(id);
    return {
      playerId: id,
      view: viewFor(this.ctx, this.state, id),
      report,
      fastForwarded,
      clock: this.clock,
      generalOrders: this.generalOrders({}, undefined, id),
      leaderNotes: p.leaderNotes,
      offers: this.talk.turn === this.state.turn ? this.talk.toHuman.filter((o) => o.to === id) : [],
      ...(this.state.winner || this.showPersonalities ? { seats: this.seatInfo() } : {}),
    };
  }

  /** Each bot seat's level and personality ("the Turtle"), for the game-over screen (or "Show personalities"). */
  private seatInfo(): Record<PlayerId, SeatInfo> {
    return Object.fromEntries([...this.seats].map(([id, s]) => [id, { level: s.level, ...(s.personality ? { personality: personality(s.personality).title } : {}) }]));
  }

  /** How a seat talks: a Marshal with its own diplomacy, the others by their level. */
  private diplomatOf(id: PlayerId) {
    const s = this.seats.get(id);
    return s?.bot.diplomat ?? (s?.level === "recruit" ? ("recruit" as const) : ("captain" as const));
  }

  /** The people still in the game. */
  private get living(): PlayerId[] {
    return this.peopleIds.filter((id) => !this.isOut(id));
  }

  /**
   * Diplomacy, as planning starts (a host action: in M4 the same offers travel between people). Each bot, in seat
   * order, proposes; an offer to another bot is answered at once; one to a person waits for them.
   */
  private botTalks() {
    this.talk = { turn: this.state.turn, orders: {}, toHuman: [] };
    if (!this.state.settings.diplomacy || this.state.winner) return;
    const bots = this.state.players.filter((p) => !this.people.has(p.id) && p.eliminatedTurn === null).map((p) => ({ id: p.id, level: this.diplomatOf(p.id) }));
    const living = this.living;
    // (Single player passes you alone, as it always has.)
    const humans = this.online ? living : living.length ? HUMAN_ID : null;
    const t = negotiate(this.ctx, bots, (id) => viewFor(this.ctx, this.state, id), (id) => this.lastTurn.get(id), humans);
    this.talk = { turn: this.state.turn, orders: t.orders, toHuman: t.toHuman };
  }

  /** Deals both sides have confirmed this planning phase (the people's with the bots' answers, and the bots' own). */
  private agreed(people: Record<PlayerId, readonly Order[]> = this.savedOrders()): Offer[] {
    return agreedIn({ ...this.talk.orders, ...Object.fromEntries(Object.entries(people).map(([id, o]) => [id, [...o]])) });
  }

  /** Each person's orders as they stand. */
  private savedOrders(): Record<PlayerId, Order[]> {
    return Object.fromEntries([...this.people.values()].map((p) => [p.id, p.saved]));
  }

  /**
   * A person offers a bot a deal: it answers at once, from its own view, with its reason (and maybe a counteroffer).
   * Its answer is kept as its order for this turn; the offer goes in with the person's orders (the page adds it).
   */
  propose(offer: Offer, from: PlayerId = HUMAN_ID): Answer {
    const bot = this.state.players.find((p) => p.id === offer.to);
    if (offer.from !== from || !this.people.has(from) || !bot || this.people.has(bot.id) || bot.eliminatedTurn !== null || this.state.winner || this.isOut(from) || !this.state.settings.diplomacy)
      return { accept: false, reason: "That offer can't be made." };
    const view = withAgreed(viewFor(this.ctx, this.state, bot.id), this.agreed());
    const answer = judgeBy(this.ctx, this.diplomatOf(bot.id), view, offer, this.lastTurn.get(bot.id));
    // A later answer to the same offer replaces an earlier one.
    const list = (this.talk.orders[bot.id] ?? []).filter((o) => !(o.kind === "answer" && o.from === from && o.offer === offer.id) && !(o.kind === "propose" && o.offer.counterTo === offer.id));
    list.push(answerOrder(offer, answer.accept));
    if (answer.counter) list.push({ id: `propose-${answer.counter.id}`, kind: "propose", offer: answer.counter });
    this.talk.orders[bot.id] = list;
    return answer;
  }

  /**
   * Your leaders' orders for this turn (session 18), written from your view as planning starts (and again when you
   * change a command: `instructions` overrides the standing ones, by leader key; `purses` after gold you take back).
   * The same view, memory and commands always give the same orders, so it doesn't matter whether they're worked out
   * here, on the page, or (M4) on the server.
   */
  generalOrders(instructions: Record<string, Instruction | null> = {}, purses?: Record<string, number>, id: PlayerId = HUMAN_ID): Order[] {
    return this.leaderOrders(instructions, purses, id).orders;
  }

  /** Your leaders' orders, and what each is up to this turn (a line for the Leaders panel). */
  leaderOrders(instructions: Record<string, Instruction | null> = {}, purses?: Record<string, number>, id: PlayerId = HUMAN_ID): { orders: Order[]; notes: Record<string, LeaderNote> } {
    const p = this.person(id);
    if (this.state.winner || this.isOut(id)) return { orders: [], notes: {} };
    // Your leaders plan knowing the deals you've agreed this turn (they start before any move).
    const view = withAgreed(viewFor(this.ctx, this.state, id), this.agreed());
    const last = this.lastTurn.get(id);
    const plan = planLeaders({ ctx: this.ctx, view, memory: p.leaderMemory, commands: instructions, ...(purses ? { purses } : {}), ...(last ? { lastTurn: last } : {}) });
    p.leaderNotes = plan.notes;
    return { orders: plan.orders, notes: plan.notes };
  }

  /** Is this person out of the game while it goes on? */
  isOut(id: PlayerId): boolean {
    return this.state.players.find((p) => p.id === id)!.eliminatedTurn !== null;
  }

  private botOrders(people: Record<PlayerId, readonly Order[]>): OrdersByPlayer {
    const orders: OrdersByPlayer = {};
    // What everyone agreed this planning phase: each bot plans its moves knowing it (the deals start before any move).
    const now = this.talk.turn === this.state.turn;
    const agreed = now ? this.agreed(people) : [];
    for (const p of this.state.players) {
      if (this.people.has(p.id)) continue;
      if (p.eliminatedTurn === null)
        orders[p.id] = [...((now && this.talk.orders[p.id]) || []), ...(this.seats.get(p.id)?.bot ?? captainBot).plan(this.ctx, withAgreed(viewFor(this.ctx, this.state, p.id), agreed), this.lastTurn.get(p.id))];
      // Knocked-out bots are the Fallen: they play world events against whoever leads.
      else if (this.state.settings.fallen) orders[p.id] = fallenBot.plan(this.ctx, viewFor(this.ctx, this.state, p.id));
    }
    return orders;
  }

  /**
   * Resolve one turn with each person's orders (null: nobody at the table orders anything, as when the bots play on
   * to the end) and return each person's report of it.
   */
  private play(peopleOrders: Record<PlayerId, Order[]> | null): Map<PlayerId, TurnReport> {
    const before = this.state;
    // Their leaders take this turn in (what they remember for next turn's plans).
    for (const p of this.people.values())
      if (!this.isOut(p.id)) p.leaderMemory = think(this.ctx, viewFor(this.ctx, before, p.id), marshalData.judgement, p.leaderMemory, this.lastTurn.get(p.id)).memory;
    const orders = peopleOrders ? { ...this.botOrders(peopleOrders), ...peopleOrders } : this.botOrders({});
    const result = resolveTurn(this.ctx, before, orders);
    this.history?.turns.push(orders);
    this.state = result.state;
    // What each seat watched in this turn's replay (only its own view), for its next plan.
    this.lastTurn = new Map(this.state.players.filter((p) => p.eliminatedTurn === null).map((p) => [p.id, replayFor(this.ctx, before, result, p.id)]));
    const reports = new Map<PlayerId, TurnReport>();
    let longest = 0;
    for (const p of this.people.values()) {
      const events = this.lastTurn.get(p.id) ?? replayFor(this.ctx, before, result, p.id);
      const out = this.isOut(p.id);
      // What their leaders say about the turn, from their own view and replay only (session 22).
      const said = out ? null : leaderVoices(this.ctx, viewFor(this.ctx, before, p.id), viewFor(this.ctx, this.state, p.id), events, p.voiceMemory);
      if (said) p.voiceMemory = said.memory;
      // Their comeback (session 23), from their own land only.
      const back = out ? null : comebackStep(p.voiceMemory.comeback, ownLand(viewFor(this.ctx, this.state, p.id)), before.turn);
      if (back) p.voiceMemory = { ...p.voiceMemory, comeback: back.memory };
      const report: TurnReport = {
        turn: before.turn,
        events,
        ...(said?.lines.length ? { voices: said.lines } : {}),
        ...(back?.card ? { comeback: true as const } : {}),
        ...(this.ranNow.length ? { ranByLeaders: [...this.ranNow] } : {}),
      };
      p.chronicle.push(chronicleOf(report));
      if (this.online) p.last = { before: viewFor(this.ctx, before, p.id), report };
      reports.set(p.id, report);
      longest = Math.max(longest, buildTimeline(report.events).total);
    }
    this.ranNow = [];
    this.startClock(longest);
    return reports;
  }

  /** Lock in your orders for `turn`. If that turn has already been locked in (the timer beat you to it), nothing changes. */
  lockIn(humanOrders: Order[], turn: number = this.state.turn): HostUpdate {
    if (this.state.winner) throw new Error("The game is over");
    if (this.isOut(HUMAN_ID)) throw new Error("You've been knocked out");
    if (turn !== this.state.turn) return this.update();
    return this.update(this.play({ [HUMAN_ID]: humanOrders }).get(HUMAN_ID)!);
  }

  /**
   * Online: a person locks in their orders for `turn`. The turn resolves once everyone still in the game has (the plan:
   * a turn ends early when everyone has locked in). Returns each person's update if it resolved, or null if the table
   * is still waiting on someone (or the turn has already moved on).
   */
  lockInFor(id: PlayerId, orders: Order[], turn: number): Map<PlayerId, HostUpdate> | null {
    const p = this.person(id);
    if (this.state.winner) throw new Error("The game is over");
    if (this.isOut(id)) throw new Error("You've been knocked out");
    if (turn !== this.state.turn) return null;
    p.saved = orders;
    p.touched = true;
    p.locked = true;
    if (this.living.some((x) => !this.person(x).locked)) return null;
    return this.resolveTable(false);
  }

  /** Online: who the table is still waiting on this turn (people still in the game who haven't locked in). */
  get waitingOn(): PlayerId[] {
    return this.state.winner ? [] : this.living.filter((id) => !this.person(id).locked);
  }

  /** Online: has this person locked in this turn? */
  lockedIn(id: PlayerId): boolean {
    return this.person(id).locked;
  }

  /**
   * Online: resolve the turn with everyone's orders. Someone who never sent any this turn missed it: with "my leaders
   * run my House" on, their Leader and Steward play it (Run the military 80%, Run the realm 20%); with it off, their
   * House holds still. Anyone else's queue goes in as they left it.
   */
  private resolveTable(auto: boolean): Map<PlayerId, HostUpdate> {
    const orders: Record<PlayerId, Order[]> = {};
    this.ranNow = [];
    for (const p of this.people.values()) {
      if (this.isOut(p.id)) continue;
      if (p.locked || p.touched) orders[p.id] = p.saved;
      else if (p.leadersRun) {
        const last = this.lastTurn.get(p.id);
        const run = leadersRunHouse(this.ctx, withAgreed(viewFor(this.ctx, this.state, p.id), this.agreed()), p.leaderMemory, last);
        orders[p.id] = run.orders;
        this.ranNow.push(p.id);
      } else orders[p.id] = [];
    }
    const locked = new Set(this.peopleIds.filter((id) => this.person(id).locked));
    let reports: Map<PlayerId, TurnReport>;
    try {
      reports = this.play(orders);
    } catch {
      // Orders from a page that the engine couldn't carry out: the turn resolves without the people's orders rather
      // than stopping the game for everyone.
      this.ranNow = [];
      reports = this.play(Object.fromEntries(Object.keys(orders).map((id) => [id, [] as Order[]])));
    }
    return new Map(this.peopleIds.map((id) => [id, { ...this.update(reports.get(id)!, 0, id), ...(auto && !locked.has(id) ? { autoLocked: true } : {}) }]));
  }

  /**
   * The page's latest orders for this turn; these lock in if time runs out, and Continue puts them back. Returns
   * whether they were for this turn (so the host knows to save them).
   */
  saveOrders(orders: Order[], turn: number, paused: PlayerId[] = [], id: PlayerId = HUMAN_ID): boolean {
    const p = this.person(id);
    if (turn !== this.state.turn || this.state.winner || this.isOut(id) || p.locked) return false;
    p.saved = orders;
    p.savedPaused = paused;
    p.touched = true;
    return true;
  }

  /** When the timer should next be checked (ms, host clock), or null if there's no countdown. */
  get nextDeadline(): number | null {
    return this.deadline;
  }

  /**
   * Time's up? Then lock in your saved orders, exactly as if you had pressed Lock in, and return the result for
   * the page. Otherwise null.
   */
  expireIfDue(): HostUpdate | null {
    if (this.online) throw new Error("An online game's clock runs out with expireTable");
    if (this.deadline === null || this.now() < this.deadline || this.state.winner || this.isOut(HUMAN_ID)) return null;
    return { ...this.update(this.play({ [HUMAN_ID]: this.person(HUMAN_ID).saved }).get(HUMAN_ID)!), autoLocked: true };
  }

  /** Online: time's up? Then the turn resolves with everyone's orders as they stand (each person's update), else null. */
  expireTable(): Map<PlayerId, HostUpdate> | null {
    if (this.deadline === null || this.now() < this.deadline || this.state.winner) return null;
    return this.resolveTable(true);
  }

  /**
   * Online: nobody at the table is still in the game, so nothing waits on anyone: the bots play `turns` more turns at
   * once (Infinity: to the end). Each person's update, with the last turn's report.
   */
  playOnline(turns: number): Map<PlayerId, HostUpdate> {
    if (this.living.length) throw new Error("The game goes on while others play: you'll see the result when it ends.");
    let reports = new Map<PlayerId, TurnReport>();
    let n = 0;
    while (!this.state.winner && n < turns) {
      reports = this.play({});
      n++;
    }
    return new Map(this.peopleIds.map((id) => [id, this.update(reports.get(id) ?? null, turns === Infinity ? n : 0, id)]));
  }

  /** Online: this person's last replay (their view before it and their report), for someone coming back. */
  lastReplay(id: PlayerId): { before: PlayerView; report: TurnReport } | null {
    return this.person(id).last;
  }

  /** Online: their orders as they left them this turn (for "where are we"), or null if they haven't sent any. */
  queuedFor(id: PlayerId): { orders: Order[]; paused: PlayerId[] } | null {
    const p = this.person(id);
    return p.touched ? { orders: p.saved, paused: p.savedPaused } : null;
  }

  /** Their Chronicle so far. */
  chronicleOf(id: PlayerId): TurnReport[] {
    return this.person(id).chronicle;
  }

  /**
   * Knocked out and watching: the bots play one turn. As one of the Fallen you see the political map, and `orders`
   * are your world events for the turn (Influence put toward them).
   */
  watchNext(orders: Order[] = []): HostUpdate {
    if (this.state.winner) throw new Error("The game is over");
    if (!this.isOut(HUMAN_ID)) throw new Error("You're still in the game");
    return this.update(this.play({ [HUMAN_ID]: orders.filter((o) => o.kind === "worldEvent") }).get(HUMAN_ID)!);
  }

  /**
   * The game as it stands, as a save: the snapshot (it loads under future rules), what this host keeps between turns,
   * and the history so `pnpm sim --replay` can play it back. Single player only (it holds the secret seed and
   * everyone's orders); online, only the room keeps it.
   */
  snapshot(notes?: Record<string, string>): SaveFile {
    const memories: Record<PlayerId, MarshalMemory> = {};
    for (const [id, s] of this.seats) {
      const m = s.level === "marshal" ? (s.bot as MarshalBot).memoryOf(this.state.gameId, id) : null;
      if (m) memories[id] = m;
    }
    const queuedOf = (p: Person) => ({ turn: this.state.turn, orders: p.saved, paused: p.savedPaused });
    const base = {
      botLevel: this.botLevel,
      seats: Object.fromEntries([...this.seats].map(([id, s]) => [id, { level: s.level, ...(s.personality ? { personality: s.personality } : {}) }])),
      memories,
      showPersonalities: this.showPersonalities,
      turnSeconds: this.turnMs === null ? null : this.turnMs / 1000,
      lastTurn: Object.fromEntries(this.lastTurn),
    };
    let host: LocalHostData;
    if (this.online) {
      const people: Record<PlayerId, PersonData> = {};
      for (const p of this.people.values())
        people[p.id] = { queued: queuedOf(p), chronicle: p.chronicle, leaderMemory: p.leaderMemory, voiceMemory: p.voiceMemory, touched: p.touched, locked: p.locked, leadersRun: p.leadersRun, ...(p.last ? { last: p.last } : {}) };
      host = { ...base, talk: this.talk, people, online: { deadline: this.deadline, opensAt: this.opensAt } };
    } else {
      const you = this.person(HUMAN_ID);
      host = { ...base, queued: queuedOf(you), talk: this.talk, chronicle: you.chronicle, leaderMemory: you.leaderMemory, voiceMemory: you.voiceMemory };
    }
    return makeSave(this.ctx, this.state, this.peopleIds[0]!, this.now(), {
      host: host as unknown as Record<string, unknown>,
      ...(this.history ? { history: this.history } : {}),
      notes: { bots: this.botLevel, ...notes },
    });
  }

  /** A bot's orders for you this turn (the Captain; the Recruit at a Recruit table), planned from your own view only. */
  suggest(id: PlayerId = HUMAN_ID): Order[] {
    if (this.state.winner || this.isOut(id)) return [];
    return (this.botLevel === "recruit" ? recruitBot : captainBot).plan(this.ctx, viewFor(this.ctx, this.state, id));
  }

  /** Knocked out: the bots play on to the end (the engine's turn cap guarantees one). */
  finish(): HostUpdate {
    if (!this.isOut(HUMAN_ID) && !this.state.winner) throw new Error("You're still in the game");
    let report: HostUpdate["report"] = null;
    let turns = 0;
    while (!this.state.winner) {
      report = this.play(null).get(HUMAN_ID)!;
      turns++;
    }
    return this.update(report, turns);
  }
}

/** A person as a save kept them. */
function personFrom(id: PlayerId, d: PersonData): Person {
  const p = newPerson(id, d.leadersRun ?? true);
  if (Array.isArray(d.chronicle)) p.chronicle = d.chronicle;
  if (d.leaderMemory) p.leaderMemory = d.leaderMemory;
  if (d.voiceMemory) p.voiceMemory = d.voiceMemory;
  if (d.last) p.last = d.last;
  return p;
}
