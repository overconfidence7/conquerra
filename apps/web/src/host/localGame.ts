import {
  agreedIn,
  answerOrder,
  captainBot,
  dealPersonalities,
  fallenBot,
  judgeBy,
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

/**
 * A whole single-player game: the full state, the bots and turn resolution.
 * Lives inside the Web Worker, so the UI never holds the full state (it only gets `viewFor` + `replayFor`),
 * exactly as it will when a server runs the game.
 */
/** After the replay, a moment to read the turn report before the countdown starts. */
export const REPORT_GRACE_MS = 3000;

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
}

/** The bots' diplomacy for one turn: their propose/answer orders, and the offers they made you. */
interface Talk {
  turn: number;
  orders: OrdersByPlayer;
  toHuman: Offer[];
}

export interface LocalGameOptions {
  /** Carry on from a save instead of starting a new game (`settings` and `seed` are then ignored). */
  restore?: SaveFile;
  /** Called with a fresh save at the start of every turn's planning (the worker writes it to the device). */
  autosave?: (save: SaveFile) => void;
}

export class LocalGame {
  readonly ctx: GameContext;
  private state: GameState;
  private turnMs: number | null;
  /** When the current turn's orders lock in automatically (null: no timer, nothing to lock, or paused). */
  private deadline: number | null = null;
  /** Paused: the time that was left on the clock (null: not paused). */
  private pausedLeft: number | null = null;
  /** Your orders as you build them (the page keeps sending them), locked in when time runs out. */
  private saved: Order[] = [];
  /** Generals whose army you took back this turn (the page sends them with your orders; kept for Continue). */
  private savedPaused: PlayerId[] = [];
  /** Your queue as a save brought it back (Continue), sent to the page once with the first update. */
  private restored: { orders: Order[]; paused: PlayerId[] } | null = null;
  /** Each bot seat's level, personality and bot (session 17: tables can mix levels). */
  private seats = new Map<PlayerId, BotSeat>();
  private readonly botLevel: BotChoice;
  private readonly showPersonalities: boolean;
  /** How the game was set up, the rules and every turn's orders, so `pnpm sim --replay` can play a save back. */
  private history: { setup: NewGameOptions; rules: typeof defaultRules; turns: OrdersByPlayer[] } | null;
  private readonly autosave?: (save: SaveFile) => void;
  /** What each seat watched in the last replay (from its own seat): the bots', and yours for your generals. */
  private lastTurn = new Map<string, ReplayEvent[]>();
  /** The Chronicle (session 16): your report of every turn so far (only what you were allowed to see). */
  private chronicle: TurnReport[] = [];
  /** This turn's diplomacy: the bots' offers and answers (to each other and to you), worked out as planning starts. */
  private talk: Talk = { turn: 0, orders: {}, toHuman: [] };
  /** What your leaders remember (session 18), as this turn's planning began. */
  private leaderMemory: MarshalMemory = freshMemory();
  /** What your leaders remember for what they say (session 22). */
  private voiceMemory: VoiceMemory = {};

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
    if (restore) {
      // Carry on from a save: the game as it stood, under today's rules.
      if (restore.mapId !== map.id || restore.mapVersion !== (map.generator?.version ?? null))
        throw new Error("This save's map has changed since it was saved, so it can't be loaded.");
      const host = (restore.host ?? {}) as Partial<LocalHostData>;
      this.botLevel = host.botLevel && (LEVELS.includes(host.botLevel as BotLevel) || host.botLevel === "mixed") ? host.botLevel : "captain";
      this.showPersonalities = !!host.showPersonalities;
      this.state = restore.state;
      // Each seat as it was saved (a save from before session 17: every bot at the game's one level).
      for (const p of this.state.players) {
        if (p.id === HUMAN_ID) continue;
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
      this.chronicle = Array.isArray(host.chronicle) ? host.chronicle : [];
      if (host.leaderMemory) this.leaderMemory = host.leaderMemory;
      if (host.voiceMemory) this.voiceMemory = host.voiceMemory;
      if (host.talk && host.talk.turn === restore.state.turn) this.talk = host.talk;
      // The history only replays exactly under the rules it was played with; a game carried on under new ones drops it.
      const h = restore.history;
      this.history = h && JSON.stringify(h.rules) === JSON.stringify(defaultRules) ? h : null;
    } else {
      this.botLevel = LEVELS.includes(settings.botLevel as BotLevel) || settings.botLevel === "mixed" ? settings.botLevel : "captain";
      this.showPersonalities = !!settings.showPersonalities;
      const bots = Math.max(1, Math.min(map.maxPlayers - 1, BOT_NAMES.length, Math.floor(settings.bots)));
      // Who plays each bot seat (dealt from the seed, before the game exists: a Marshal's leaders carry its personality).
      const botIds = BOT_NAMES.slice(0, bots).map((_, i) => `bot${i + 1}`);
      const levels = seatLevels(this.botLevel, settings.marshals ?? Math.ceil(bots / 2), botIds, seed);
      const style = (p: unknown): LeaderStyle | null => (typeof p === "string" && (LEADER_STYLES as readonly string[]).concat(STEWARD_STYLES).includes(p) ? (p as LeaderStyle) : null);
      const players = [
        // You are Gules (red) unless you chose another House; the bots take the rest in order.
        // Your Leader and Steward carry the names (and, session 20c, the personalities) you gave them; your Steward
        // starts running the realm (session 18).
        {
          id: HUMAN_ID,
          name: "You",
          house: settings.house ?? DEFAULT_HOUSE,
          delegate: true,
          ...(settings.leaderName ? { leaderName: settings.leaderName } : {}),
          ...(settings.stewardName ? { stewardName: settings.stewardName } : {}),
          ...(style(settings.leaderPersonality) ? { leaderPersonality: style(settings.leaderPersonality) } : {}),
          ...(style(settings.stewardPersonality) ? { stewardPersonality: style(settings.stewardPersonality) } : {}),
        },
        ...BOT_NAMES.slice(0, bots).map((name, i) => {
          const p = levels[botIds[i]!]?.level === "marshal" ? style(levels[botIds[i]!]!.personality) : null;
          return { id: botIds[i]!, name, ...(p ? { leaderPersonality: p, stewardPersonality: p } : {}) };
        }),
      ];
      const setup: NewGameOptions = {
        gameId: `local-${seed.slice(0, 8)}`,
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
        // A harder capital spot starts with extra troops (session 23).
        startBonus: true,
      };
      this.state = createGame(this.ctx, setup);
      for (const [id, s] of Object.entries(levels)) this.seats.set(id, seatBot(s.level, s.personality));
      this.history = { setup, rules: defaultRules, turns: [] };
      this.turnMs = settings.turnSeconds === null || settings.turnSeconds === undefined ? null : settings.turnSeconds * 1000;
    }
    // A game just loaded doesn't save itself again until its next turn starts.
    this.startClock(0, !restore);
    // Continue puts back the orders you'd queued on this turn.
    const queued = (restore?.host as Partial<LocalHostData> | undefined)?.queued;
    if (queued && queued.turn === this.state.turn && Array.isArray(queued.orders) && !this.state.winner && !this.knockedOut) {
      this.saved = queued.orders;
      this.savedPaused = Array.isArray(queued.paused) ? queued.paused : [];
      this.restored = { orders: queued.orders, paused: this.savedPaused };
    }
  }

  /** Carry on from a save (already read and brought up to date with `readSave`). */
  static restore(map: MapDef, save: SaveFile, now: () => number = () => Date.now(), autosave?: (save: SaveFile) => void): LocalGame {
    // (The lobby settings and seed aren't used: everything comes from the save.)
    const unused: LobbySettings = { mapId: map.id, bots: 1, botLevel: "captain", luck: 0, fog: true, mode: "classic", turnSeconds: null };
    return new LocalGame(map, unused, "", now, { restore: save, ...(autosave ? { autosave } : {}) });
  }

  /**
   * A new turn's planning starts: start the countdown (after `replayMs` of replay plus a moment for the report), and
   * save the game on the device (Continue in the lobby picks it up).
   */
  private startClock(replayMs: number, autosave = true) {
    // The bots talk first (offers between them answered at once; offers to you wait for you), then your generals plan.
    if (this.talk.turn !== this.state.turn) this.botTalks();
    // Your generals' orders go in even if you never touch the turn.
    this.saved = this.generalOrders();
    this.savedPaused = [];
    this.pausedLeft = null;
    this.deadline = this.turnMs !== null && !this.state.winner && !this.knockedOut ? this.now() + replayMs + (replayMs ? REPORT_GRACE_MS : 0) + this.turnMs : null;
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

  /** The first message: the map and rules, plus your opening view. */
  start(): HostStart {
    const restored = this.restored;
    this.restored = null;
    return { ...this.update(), map: this.ctx.map, rules: this.ctx.rules, chronicle: this.chronicle, ...(restored ? { queued: restored } : {}) };
  }

  update(report: HostUpdate["report"] = null, fastForwarded = 0): HostUpdate {
    return {
      playerId: HUMAN_ID,
      view: viewFor(this.ctx, this.state, HUMAN_ID),
      report,
      fastForwarded,
      clock: this.clock,
      generalOrders: this.generalOrders(),
      leaderNotes: this.leaderNotes,
      offers: this.talk.turn === this.state.turn ? this.talk.toHuman : [],
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

  /**
   * Diplomacy, as planning starts (a host action: in M4 the same offers travel between people). Each bot, in seat
   * order, proposes; an offer to another bot is answered at once; one to you waits for you.
   */
  private botTalks() {
    this.talk = { turn: this.state.turn, orders: {}, toHuman: [] };
    if (!this.state.settings.diplomacy || this.state.winner) return;
    const bots = this.state.players.filter((p) => p.id !== HUMAN_ID && p.eliminatedTurn === null).map((p) => ({ id: p.id, level: this.diplomatOf(p.id) }));
    const t = negotiate(this.ctx, bots, (id) => viewFor(this.ctx, this.state, id), (id) => this.lastTurn.get(id), this.knockedOut ? null : HUMAN_ID);
    this.talk = { turn: this.state.turn, orders: t.orders, toHuman: t.toHuman };
  }

  /** Deals both sides have confirmed this planning phase (yours with the bots' answers, and the bots' own). */
  private agreed(human: readonly Order[] = this.saved): Offer[] {
    return agreedIn({ ...this.talk.orders, [HUMAN_ID]: [...human] });
  }

  /**
   * You offer a bot a deal: it answers at once, from its own view, with its reason (and maybe a counteroffer). Its
   * answer is kept as its order for this turn; your offer goes in with your orders (the page adds it).
   */
  propose(offer: Offer): Answer {
    const bot = this.state.players.find((p) => p.id === offer.to);
    if (offer.from !== HUMAN_ID || !bot || bot.id === HUMAN_ID || bot.eliminatedTurn !== null || this.state.winner || this.knockedOut || !this.state.settings.diplomacy)
      return { accept: false, reason: "That offer can't be made." };
    const view = withAgreed(viewFor(this.ctx, this.state, bot.id), this.agreed());
    const answer = judgeBy(this.ctx, this.diplomatOf(bot.id), view, offer, this.lastTurn.get(bot.id));
    // A later answer to the same offer replaces an earlier one.
    const list = (this.talk.orders[bot.id] ?? []).filter((o) => !(o.kind === "answer" && o.from === HUMAN_ID && o.offer === offer.id) && !(o.kind === "propose" && o.offer.counterTo === offer.id));
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
  generalOrders(instructions: Record<string, Instruction | null> = {}, purses?: Record<string, number>): Order[] {
    return this.leaderOrders(instructions, purses).orders;
  }

  /** What each leader said it's up to, the last time they planned (session 20). */
  private leaderNotes: Record<string, LeaderNote> = {};

  /** Your leaders' orders, and what each is up to this turn (a line for the Leaders panel). */
  leaderOrders(instructions: Record<string, Instruction | null> = {}, purses?: Record<string, number>): { orders: Order[]; notes: Record<string, LeaderNote> } {
    if (this.state.winner || this.knockedOut) return { orders: [], notes: {} };
    // Your leaders plan knowing the deals you've agreed this turn (they start before any move).
    const view = withAgreed(viewFor(this.ctx, this.state, HUMAN_ID), this.agreed());
    const plan = planLeaders({ ctx: this.ctx, view, memory: this.leaderMemory, commands: instructions, ...(purses ? { purses } : {}), ...(this.lastTurn.get(HUMAN_ID) ? { lastTurn: this.lastTurn.get(HUMAN_ID)! } : {}) });
    this.leaderNotes = plan.notes;
    return { orders: plan.orders, notes: plan.notes };
  }

  private get knockedOut(): boolean {
    return this.state.players.find((p) => p.id === HUMAN_ID)!.eliminatedTurn !== null;
  }

  private botOrders(human: readonly Order[] = []): OrdersByPlayer {
    const orders: OrdersByPlayer = {};
    // What everyone agreed this planning phase: each bot plans its moves knowing it (the deals start before any move).
    const now = this.talk.turn === this.state.turn;
    const agreed = now ? this.agreed(human) : [];
    for (const p of this.state.players) {
      if (p.id === HUMAN_ID) continue;
      if (p.eliminatedTurn === null)
        orders[p.id] = [...((now && this.talk.orders[p.id]) || []), ...(this.seats.get(p.id)?.bot ?? captainBot).plan(this.ctx, withAgreed(viewFor(this.ctx, this.state, p.id), agreed), this.lastTurn.get(p.id))];
      // Knocked-out bots are the Fallen: they play world events against whoever leads.
      else if (this.state.settings.fallen) orders[p.id] = fallenBot.plan(this.ctx, viewFor(this.ctx, this.state, p.id));
    }
    return orders;
  }

  /** Resolve one turn and return your report of it. */
  private play(humanOrders: Order[] | null): HostUpdate["report"] {
    const before = this.state;
    // Your leaders take this turn in (what they remember for next turn's plans).
    if (!this.knockedOut) this.leaderMemory = think(this.ctx, viewFor(this.ctx, before, HUMAN_ID), marshalData.judgement, this.leaderMemory, this.lastTurn.get(HUMAN_ID)).memory;
    const orders = humanOrders ? { ...this.botOrders(humanOrders), [HUMAN_ID]: humanOrders } : this.botOrders();
    const result = resolveTurn(this.ctx, before, orders);
    this.history?.turns.push(orders);
    this.state = result.state;
    // What each bot watched in this turn's replay (only its own view), for its next plan.
    this.lastTurn = new Map(this.state.players.filter((p) => p.eliminatedTurn === null).map((p) => [p.id, replayFor(this.ctx, before, result, p.id)]));
    const events = this.lastTurn.get(HUMAN_ID) ?? replayFor(this.ctx, before, result, HUMAN_ID);
    // What your leaders say about the turn, from your own view and replay only (session 22).
    const said = this.knockedOut ? null : leaderVoices(this.ctx, viewFor(this.ctx, before, HUMAN_ID), viewFor(this.ctx, this.state, HUMAN_ID), events, this.voiceMemory);
    if (said) this.voiceMemory = said.memory;
    // Your comeback (session 23), from your own land only.
    const back = this.knockedOut ? null : comebackStep(this.voiceMemory.comeback, ownLand(viewFor(this.ctx, this.state, HUMAN_ID)), before.turn);
    if (back) this.voiceMemory = { ...this.voiceMemory, comeback: back.memory };
    const report: TurnReport = { turn: before.turn, events, ...(said?.lines.length ? { voices: said.lines } : {}), ...(back?.card ? { comeback: true as const } : {}) };
    this.chronicle.push(chronicleOf(report));
    this.startClock(buildTimeline(report.events).total);
    return report;
  }

  /** Lock in your orders for `turn`. If that turn has already been locked in (the timer beat you to it), nothing changes. */
  lockIn(humanOrders: Order[], turn: number = this.state.turn): HostUpdate {
    if (this.state.winner) throw new Error("The game is over");
    if (this.knockedOut) throw new Error("You've been knocked out");
    if (turn !== this.state.turn) return this.update();
    return this.update(this.play(humanOrders));
  }

  /**
   * The page's latest orders for this turn; these lock in if time runs out, and Continue puts them back. Returns
   * whether they were for this turn (so the host knows to save them).
   */
  saveOrders(orders: Order[], turn: number, paused: PlayerId[] = []): boolean {
    if (turn !== this.state.turn || this.state.winner || this.knockedOut) return false;
    this.saved = orders;
    this.savedPaused = paused;
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
    if (this.deadline === null || this.now() < this.deadline || this.state.winner || this.knockedOut) return null;
    return { ...this.update(this.play(this.saved)), autoLocked: true };
  }

  /**
   * Knocked out and watching: the bots play one turn. As one of the Fallen you see the political map, and `orders`
   * are your world events for the turn (Influence put toward them).
   */
  watchNext(orders: Order[] = []): HostUpdate {
    if (this.state.winner) throw new Error("The game is over");
    if (!this.knockedOut) throw new Error("You're still in the game");
    return this.update(this.play(orders.filter((o) => o.kind === "worldEvent")));
  }

  /**
   * The game as it stands, as a save: the snapshot (it loads under future rules), what this host keeps between turns,
   * and the history so `pnpm sim --replay` can play it back. Single player only (it holds the secret seed and
   * everyone's orders).
   */
  snapshot(notes?: Record<string, string>): SaveFile {
    const memories: Record<PlayerId, MarshalMemory> = {};
    for (const [id, s] of this.seats) {
      const m = s.level === "marshal" ? (s.bot as MarshalBot).memoryOf(this.state.gameId, id) : null;
      if (m) memories[id] = m;
    }
    const host: LocalHostData = {
      botLevel: this.botLevel,
      seats: Object.fromEntries([...this.seats].map(([id, s]) => [id, { level: s.level, ...(s.personality ? { personality: s.personality } : {}) }])),
      memories,
      showPersonalities: this.showPersonalities,
      turnSeconds: this.turnMs === null ? null : this.turnMs / 1000,
      lastTurn: Object.fromEntries(this.lastTurn),
      queued: { turn: this.state.turn, orders: this.saved, paused: this.savedPaused },
      talk: this.talk,
      chronicle: this.chronicle,
      leaderMemory: this.leaderMemory,
      voiceMemory: this.voiceMemory,
    };
    return makeSave(this.ctx, this.state, HUMAN_ID, this.now(), {
      host: host as unknown as Record<string, unknown>,
      ...(this.history ? { history: this.history } : {}),
      notes: { bots: this.botLevel, ...notes },
    });
  }

  /** A bot's orders for you this turn (the Captain; the Recruit at a Recruit table), planned from your own view only. */
  suggest(): Order[] {
    if (this.state.winner || this.knockedOut) return [];
    return (this.botLevel === "recruit" ? recruitBot : captainBot).plan(this.ctx, viewFor(this.ctx, this.state, HUMAN_ID));
  }

  /** Knocked out: the bots play on to the end (the engine's turn cap guarantees one). */
  finish(): HostUpdate {
    if (!this.knockedOut && !this.state.winner) throw new Error("You're still in the game");
    let report: HostUpdate["report"] = null;
    let turns = 0;
    while (!this.state.winner) {
      report = this.play(null);
      turns++;
    }
    return this.update(report, turns);
  }
}
