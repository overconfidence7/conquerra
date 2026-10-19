import { forgetFinished, rememberFinished } from "./ui/saveText";
import { keyIntent, type KeyLike } from "./logic/keys";
import { defaultRules, suggestedMode, type BuildingType } from "@conquerra/content";
import { BOT_NAMES } from "./host/names";
import { DEFAULT_HOUSE, HOUSES } from "./map/houses";
import { findLeader, indexMap, isShare, LEADER_STYLES, STEWARD_STYLES, suggestLeaderName, type LeaderStyle, type Budget, type DealKind, type GameContext, type Instruction, type Offer, type Order, type PlayerId, type PlayerView, type RecruitAmount, type SpoilsSet, type TerritoryId, type WorldEventKind } from "@conquerra/engine";
import { arrangeQueue, asIfYouOrderFrom, instructOrders, refFromKey, takeControl, withGeneralOrders, type LeaderPlacement } from "./logic/generals";
import { create } from "zustand";
import { createLocalHost } from "./host/localHost";
import type { GameHost, HostStart, HostUpdate, LoadSource, LobbySettings, OnlineGameInfo, PeopleOffer, RandomPreview, TableView, SeatInfo, TurnReport } from "./host/protocol";
import { listingOf } from "./logic/mapListing";
import { listSlots, type SlotId, type SlotInfo } from "./host/saves";
import { dueTurnIn, withTurnIn } from "./logic/spoils";
import { namer } from "./logic/text";
import { DEFAULT_TIMER, type TurnClock } from "./logic/timer";
import { actionBarState } from "./logic/actions";
import type { LeaderNote, Answer } from "@conquerra/bots";
import { agreedThisTurn, attackCheck, counterFrom, dealsNow, newOffer, passageNow, type PageDeal } from "./logic/deals";
import type { PathKind } from "./logic/paths";
import { chronicleOf } from "./logic/chronicleKeep";
import { draftToOrder, isMine, isRecruitSite, type NewOrder, planQueue, queueFor, removeOrder, tapTerritory, troopsOf, type MoveDraft } from "./logic/orders";

/** Session 27: "table", an online game's table screen before it starts (seats, colours, the link, Start). */
export type Screen = "lobby" | "game" | "over" | "table";
/** What a tap on the map picks for a leader's command. */
export type PickKind = "push" | "defend" | "expand" | "front" | "buildUp" | "culture";

/** Your choice of where leaders' orders go, remembered on this device (mixed in, unless you chose "after mine"). */
const PLACEMENT_KEY = "conquerra.leaderPlacement";
function rememberedPlacement(): LeaderPlacement {
  try {
    return localStorage.getItem(PLACEMENT_KEY) === "after" ? "after" : "mixed";
  } catch {
    return "mixed";
  }
}
/** A leader key from a key or a military leader's id. */
const keyOf = (general: string) => (general.includes(":") ? general : `leader:${general}`);

interface GameStore {
  screen: Screen;
  lobby: LobbySettings;
  /** The host decides the mode automatically until the player picks one. */
  modeTouched: boolean;
  /** Session 30: the lobby's random map, as built (its picture), or why its seed made no map. */
  randomPreview: { mapId: string; preview: RandomPreview | null; problem: string | null } | null;
  /** Session 31: how far the lobby's random map build is (tries done plus this try's share), or null. */
  mapProgress: number | null;
  host: GameHost | null;
  ctx: GameContext | null;
  view: PlayerView | null;
  queue: Order[];
  selected: TerritoryId | null;
  draft: MoveDraft | null;
  /**
   * The Recruit panel, open while you choose where and how many: every recruit site glows, and tapping one moves the
   * recruit there. `order` is the recruit being edited; null while picking a site for a new one.
   */
  recruit: { order: string | null } | null;
  report: TurnReport | null;
  showReport: boolean;
  fastForwarded: number;
  /** Each bot seat's level and personality (session 17): sent once the game is over, or all along with "Show personalities". */
  seats: Record<string, SeatInfo> | null;
  /** Knocked out and chose "Watch to the end". */
  watching: boolean;
  /** The turn timer (null with No timer). */
  clock: TurnClock | null;
  /** The animated replay being shown: the view from before the turn and what happened. Null when not replaying. */
  replay: { before: PlayerView; report: TurnReport; key: number } | null;
  /** The view from before the last turn (for Watch again). */
  lastBefore: PlayerView | null;
  /** The last turn was locked in by the timer, not by you. */
  autoLocked: boolean;
  busy: boolean;
  error: string | null;
  /** Your leaders' commands as you've set them this turn, by leader key ("leader:you", "steward:you"; session 18). */
  instructions: Record<string, Instruction | null>;
  /** Budgets you changed this turn, and gold you're taking back from purses, by leader key (session 18). */
  budgets: Record<string, { budget?: Budget; takeBack?: number }>;
  /** What each leader is up to this turn (session 20), by leader key: a line in the Leaders panel. */
  leaderNotes: Record<string, LeaderNote>;
  /** Leaders (by key) leading one army you gave an order of your own this turn: yours to command until the turn ends. */
  paused: string[];
  /**
   * Choosing on the map for a leader's command (session 18): a place (Push, Defend toward, Expand toward), a province
   * (Build up, Raise culture), or provinces for a front (tap each, then Confirm).
   */
  picking: { general: string; kind: PickKind; provinces?: string[] } | null;
  /** Where your leaders' orders go in your queue (Nate's setting): mixed in with yours, or after yours. */
  leaderPlacement: LeaderPlacement;
  /** The leader open in the Leaders panel (its command's area or target is outlined on the map), by leader key. */
  leaderOpen: string | null;
  openLeader(key: string | null): void;
  /**
   * "Show me where" (session 25b: tap your Leader): the map glides to the place and pulses it once. `n` counts the
   * requests, so asking for the same place twice shows it twice.
   */
  shown: { at: TerritoryId; n: number } | null;
  showPlace(at: TerritoryId): void;
  setLeaderPlacement(p: LeaderPlacement): void;
  /** A leader's budget (a share of income, or an exact amount), from this turn on. */
  setBudget(key: string, budget: Budget): Promise<void>;
  /** Take a leader's purse back into your treasury (one tap; as the turn starts). */
  takeBack(key: string): Promise<void>;
  /** Your queue in the order it plays (your leaders' orders mixed in or after yours). */
  arranged(): Order[];
  /** Captured leaders you chose to let go this turn: a military leader by whose it was, a Steward as "steward:<id>". */
  releases: string[];
  /** Sending a spy (session 15): the next tap on the map picks the province it goes to. */
  spyPick: string | null;
  /** The Chronicle (session 16): your report of every turn so far, as you saw it (trimmed to what it shows). */
  chronicle: TurnReport[];
  /** Orders along a path (session 16): choosing where the army from here should go (the next tap picks it). */
  pathPick: TerritoryId | null;
  /** The path box: from, to, and which way (the shortest, or the full sweep). Confirm adds its orders. */
  path: { from: TerritoryId; to: TerritoryId; kind: PathKind } | null;
  /** One of the Fallen: the world events you're putting Influence toward this turn (sent with Next turn). */
  fallenOrders: Order[];
  /** Aiming a world event: the next tap picks the land (a storm then takes a neighbour across the border). */
  aiming: { event: WorldEventKind; target: TerritoryId | null } | null;
  /** Saved games on this device (the autosave and your slots): map, players, turn, date. Never the games themselves. */
  slots: SlotInfo[];
  /** Why saved games can't be used on this device (a private window, ...), if so. */
  slotProblem: string | null;
  /** A message from the host for the player (an autosave that couldn't be written). */
  notice: string | null;

  // ---------- Diplomacy (session 14) ----------
  /** Your diplomacy orders this turn (offers, answers, deals renounced): they take no slot and aren't in the queue. */
  diplomacy: Order[];
  /** Offers to you this turn: the bots' (as planning started) and their counteroffers to yours. */
  offers: Offer[];
  /** The bots' answers to your offers, by your offer's id (each with its one-line reason). */
  answers: Record<string, Answer>;
  /** Online (session 28): the offers between people you're a side of this turn, as the room relayed them. */
  talks: PeopleOffer[];
  /** The deal card being shown: proposing to someone (your draft), or an offer to you. */
  deal: { mode: "propose"; offer: Offer } | { mode: "offer"; offer: Offer } | null;
  /** Picking on the map for the deal card: borders for a truce, or land for a trade (yours to give, or theirs). */
  dealPick: "borders" | "give" | "get" | null;
  /** Open the Propose card for `to` (a plain truce with its defaults). */
  openPropose(to: PlayerId, kind?: DealKind): void;
  /** Open an offer to you. */
  openOffer(offer: Offer): void;
  /** Change the draft on the Propose card. */
  editDeal(offer: Offer): void;
  closeDeal(): void;
  setDealPick(pick: "borders" | "give" | "get" | null): void;
  /** Send your offer: the bot answers at once (with its reason, maybe a counteroffer). */
  sendOffer(offer: Offer): Promise<Answer | null>;
  /** Accept or decline an offer to you (one tap). */
  answerOffer(offer: Offer, accept: boolean): void;
  /** Counter an offer to you: decline it, and open the same card from your side to change and send. */
  counterOffer(offer: Offer): void;
  /** Deals in force plus those agreed this turn (for the warnings, the map and the Players panel). */
  pageDeals(): PageDeal[];

  setLobby(patch: Partial<LobbySettings>): void;
  start(): Promise<void>;

  // ---------- Online (session 26; the actions are in host/onlineActions.ts, loaded only when something online happens) ----------
  /** The online game being played (its id), or null in single player. */
  online: string | null;
  /** The Online block's own choices: the timer (no "No timer" online) and "my leaders run my House". */
  onlineLobby: { turnSeconds: number; leadersRun: boolean };
  /** Your online games (the lobby's list), null until asked; `onlineProblem` if they couldn't be fetched. */
  onlineGames: OnlineGameInfo[] | null;
  onlineProblem: string | null;
  /** Online: provably fair (the seed's fingerprint from the start, the seed itself at the end). */
  fair: { seedHash: string; seed?: string } | null;
  /** Online: who at the table is a person. */
  people: PlayerId[] | null;
  /** Session 27: the table screen (an online game waiting for its players), as the room last sent it. */
  table: TableView | null;
  /** Session 27: the people at the table who have locked in this turn (the players panel ticks them). */
  ready: PlayerId[];
  /** Session 27: seats a Marshal plays now (their person resigned or missed three turns): yours means you're watching. */
  leftSeats: Record<PlayerId, { why: "resigned" | "taken"; turn: number }> | null;
  /** Session 27: you, as the server knows you (your name and usual House colour), once asked. */
  /** Online: you (session 29: your email, the room's push key, and whether you get turn emails). */
  me: { name: string; colour: number | null; email?: string; push?: string; turnEmail?: boolean } | null;
  /** The notice is just news (online: "Reconnected"), not a problem: shown quietly, and it goes by itself. */
  noticeCalm: boolean;
  /** Carry on from a saved game: the autosave (Continue), a slot, or a file's text. */
  load(source: LoadSource): Promise<boolean>;
  /** Read the saved-game list again (the lobby, the Save and Load menus). */
  refreshSlots(): Promise<void>;
  /** Save the game as it stands into a slot. Returns false (and sets `error`) if it couldn't. */
  saveToSlot(slot: SlotId): Promise<boolean>;
  /** Pause or resume the turn timer (single player, with a timer on). */
  togglePause(): Promise<void>;
  dismissNotice(): void;
  /** Turn a Spoils set in: it goes first in your queue (replacing any turn-in already there). */
  turnInSpoils(set: SpoilsSet, territory?: TerritoryId, building?: BuildingType): void;
  /** A mission you tapped: its target lights up on the map (until you tap the map). */
  mission: string | null;
  showMission(id: string | null): void;
  tap(t: TerritoryId): void;
  clearSelection(): void;
  select(t: TerritoryId): void;
  updateDraft(patch: Partial<MoveDraft>): void;
  addDraft(): void;
  /**
   * A key pressed on the game screen (session 20): with an attack, move or path box open, Enter confirms it as shown
   * and Esc cancels it (what its buttons do). True if it did something (the page then keeps the key from the browser).
   */
  pressKey(e: KeyLike): boolean;
  add(order: NewOrder): void;
  /** Spies (session 15): Send (then tap a province), Recall, or stop picking. One order per spy, in the queue. */
  /** Orders along a path (session 16): pick where the army in `from` should go. */
  startPath(from: TerritoryId): void;
  setPathKind(kind: PathKind): void;
  /** Add the path's orders to your queue, as one chain (each still yours to change or delete). */
  confirmPath(): Promise<void>;
  cancelPath(): void;
  sendSpy(spy: string): void;
  recallSpy(spy: string): void;
  cancelSpyPick(): void;
  /**
   * The action bar's Recruit: one tap recruits all you can afford at the selected territory (the capital if nothing is
   * selected) and opens the Recruit panel to change the amount or place. If the selected land can't recruit, the panel
   * opens to say why and offer the nearest site.
   */
  quickRecruit(): void;
  /** Edit a queued recruit in the Recruit panel (null: pick a site for a new one). */
  openRecruit(order: string | null): void;
  closeRecruit(): void;
  /** Recruit at `t`: moves the recruit being edited there, or adds a new one (All). */
  recruitAt(t: TerritoryId): void;
  /**
   * The territory panel's Recruit here (session 32): adds a recruit (All) at `t` and stays on the territory panel, so
   * the next tap on the map selects as usual (the round Recruit button keeps the "Recruit at…" panel and its retargeting).
   */
  recruitHere(t: TerritoryId): void;
  /** Change a queued recruit's amount. */
  setRecruitAmount(id: string, count: RecruitAmount): void;
  /** "Recruit somewhere else too": an All recruit becomes 1/2, and the next site you tap gets the rest. */
  splitRecruit(): void;
  remove(id: string): void;
  shift(id: string, dir: -1 | 1): void;
  lockIn(): Promise<void>;
  setShowReport(v: boolean): void;
  /** The replay finished (or Skip): show the turn report. */
  endReplay(): void;
  /** From the turn report: play the last turn's replay again. */
  watchAgain(): void;
  /** Knocked out: switch to watching (the full map and each turn's report). */
  watch(): void;
  /** While watching: the bots play the next turn. */
  watchNext(): Promise<void>;
  /** Knocked out: skip ahead to the end and see the result. */
  seeResult(): Promise<void>;
  playAgain(): void;
  /** Give a leader a command (null: none). Its new orders replace its old ones in your queue. `general`: a leader key, or a military leader's id. */
  setInstruction(general: string, instruction: Instruction | null): Promise<void>;
  /** Pick on the map for a command: the next tap picks the place or province (a front: tap provinces, then Confirm). */
  pickPlace(general: string, kind: PickKind): void;
  /** A front: the provinces picked so far become its command. */
  confirmPick(): void;
  cancelPick(): void;
  /** With one leader too many: let this one go (or keep it after all). A military leader by id, a Steward as "steward:<id>". */
  toggleRelease(general: string): void;
  /** The Fallen: choose an event, then tap the land to aim it at. */
  aimEvent(event: WorldEventKind | null): void;
  /** The Fallen: change how much Influence goes toward a planned event (more makes it stronger, up to its limit). */
  setPledge(id: string, influence: number): void;
  removeFallenOrder(id: string): void;
  /** Everything that goes to the host for this turn: instruction changes, generals you let go, then the queue. */
  turnOrders(): Order[];
  /** Replace your orders with a bot's plan (the game's bot level; testing: the perf script plays whole games with it). */
  autoPlan(): Promise<void>;
}

/** Where games run. A Web Worker in the browser; tests swap in an in-process host. */
let makeHost: () => GameHost = createLocalHost;
export function setHostFactory(f: () => GameHost) {
  makeHost = f;
  warm?.dispose();
  warm = null;
}

/** A host started ahead of time (in the lobby), so the game engine and maps are loaded before you press Start. */
let warm: GameHost | null = null;
export function prewarmHost() {
  warm ??= makeHost();
}
/** Session 30: build the lobby's random map in the host that will play it (so Start doesn't build it again). */
const watched = new WeakSet<GameHost>();
export function previewRandomMap(mapId: string): Promise<RandomPreview> {
  prewarmHost();
  if (!warm?.randomMap) return Promise.reject(new Error("Random maps aren't ready here."));
  // Session 31: how far the build is, for the panel's "Making the map…" line.
  if (!watched.has(warm)) {
    watched.add(warm);
    warm.onMapProgress?.((done) => useGame.setState({ mapProgress: done }));
  }
  useGame.setState({ mapProgress: 0 });
  return warm.randomMap(mapId).finally(() => useGame.setState({ mapProgress: null }));
}
const takeHost = () => {
  const h = warm ?? makeHost();
  warm = null;
  return h;
};

/** Are you out of the game while it goes on? */
export const knockedOut = (view: PlayerView) => view.winner === null && view.players.find((p) => p.id === view.me.id)?.eliminatedTurn != null;

let orderCounter = 0;
const nextOrderId = () => `o${++orderCounter}`;

/** Your House colour, remembered on this device (Gules, red, until you pick another). */
const HOUSE_KEY = "conquerra.house";
function rememberedHouse(): number {
  try {
    const n = Number(localStorage.getItem(HOUSE_KEY));
    return localStorage.getItem(HOUSE_KEY) !== null && Number.isInteger(n) && n >= 0 && n < HOUSES.length ? n : DEFAULT_HOUSE;
  } catch {
    return DEFAULT_HOUSE;
  }
}

/** Your Leader's name, remembered on this device (a sensible one filled in the first time; session 18). */
const LEADER_NAME_KEY = "conquerra.leaderName";
function rememberedLeaderName(): string {
  try {
    const saved = localStorage.getItem(LEADER_NAME_KEY);
    if (saved && saved.trim()) return saved;
  } catch {
    // A private window: a fresh suggestion each visit.
  }
  return suggestLeaderName("leader", String(Date.now()));
}

/** Your Leader's and Steward's personalities, remembered on this device like the names (session 20c; Neutral at first). */
const LEADER_STYLE_KEY = "conquerra.leaderPersonality";
const STEWARD_STYLE_KEY = "conquerra.stewardPersonality";
function rememberedStyle(key: string, allowed: readonly string[]): LeaderStyle | null {
  try {
    const saved = localStorage.getItem(key);
    return saved && allowed.includes(saved) ? (saved as LeaderStyle) : null;
  } catch {
    return null;
  }
}

/**
 * The lobby's map, remembered on this device (session 31): an official map's id, or a random map's size and shape
 * ("random:80-island"), which comes back with a fresh seed each visit (`rememberedRandom`, picked up by the lobby).
 */
const MAP_KEY = "conquerra.lobbyMap";
function rememberMap(mapId: string) {
  const r = listingOf(mapId)?.random;
  try {
    localStorage.setItem(MAP_KEY, r ? `random:${r.size}-${r.shape}` : mapId);
  } catch {
    // A private window: remembered for this visit only.
  }
}
function rememberedMapChoice(): string | null {
  try {
    return localStorage.getItem(MAP_KEY);
  } catch {
    return null;
  }
}
/** A random map's size and shape the lobby should come back to (with a fresh seed), or null. */
export function rememberedRandom(): { size: number; shape: string } | null {
  const m = /^random:(\d+)-([a-z]+)$/.exec(rememberedMapChoice() ?? "");
  return m ? { size: Number(m[1]), shape: m[2]! } : null;
}

const defaultLobby = (): LobbySettings => {
  const remembered = rememberedMapChoice();
  const official = remembered && !remembered.startsWith("random:") ? listingOf(remembered) : null;
  const bots = official ? Math.max(1, Math.min(official.recommendedPlayers.min - 1, official.maxPlayers - 1, BOT_NAMES.length)) : 3;
  // The Marshal is the default bot (session 17: it beats the Captain and gangs up on a runaway early).
  return { mapId: official?.id ?? "embervale", bots, botLevel: "marshal", luck: defaultRules.combat.luck, fog: true, mode: suggestedMode(bots + 1), turnSeconds: DEFAULT_TIMER, fate: true, diplomacy: true, house: rememberedHouse(), leaderName: rememberedLeaderName(), leaderPersonality: rememberedStyle(LEADER_STYLE_KEY, LEADER_STYLES), stewardPersonality: rememberedStyle(STEWARD_STYLE_KEY, STEWARD_STYLES) };
};

export const useGame = create<GameStore>((set, get) => ({
  screen: "lobby",
  lobby: defaultLobby(),
  modeTouched: false,
  randomPreview: null,
  mapProgress: null,
  host: null,
  ctx: null,
  view: null,
  queue: [],
  selected: null,
  draft: null,
  recruit: null,
  report: null,
  showReport: false,
  fastForwarded: 0,
  seats: null,
  watching: false,
  clock: null,
  replay: null,
  lastBefore: null,
  autoLocked: false,
  busy: false,
  error: null,
  instructions: {},
  budgets: {},
  leaderNotes: {},
  paused: [],
  picking: null,
  leaderPlacement: rememberedPlacement(),
  leaderOpen: null,
  openLeader: (key) => set({ leaderOpen: key }),
  shown: null,
  showPlace: (at) => set({ shown: { at, n: (get().shown?.n ?? 0) + 1 } }),
  spyPick: null,
  pathPick: null,
  path: null,
  chronicle: [],
  releases: [],
  fallenOrders: [],
  aiming: null,
  slots: [],
  slotProblem: null,
  notice: null,
  online: null,
  onlineLobby: { turnSeconds: DEFAULT_TIMER, leadersRun: true },
  onlineGames: null,
  onlineProblem: null,
  fair: null,
  people: null,
  table: null,
  ready: [],
  leftSeats: null,
  me: null,
  noticeCalm: false,
  mission: null,
  diplomacy: [],
  offers: [],
  answers: {},
  talks: [],
  deal: null,
  dealPick: null,

  openPropose(to, kind = "truce") {
    const { ctx, view } = get();
    if (!ctx || !view) return;
    set({ deal: { mode: "propose", offer: newOffer(ctx, view, to, kind, ++offerCounter) }, dealPick: null, draft: null, recruit: null });
  },
  openOffer: (offer) => set({ deal: { mode: "offer", offer }, dealPick: null, draft: null }),
  editDeal(offer) {
    const d = get().deal;
    if (d?.mode === "propose") set({ deal: { mode: "propose", offer } });
  },
  closeDeal: () => set({ deal: null, dealPick: null }),
  setDealPick: (pick) => set({ dealPick: pick }),

  async sendOffer(offer) {
    const { host, view } = get();
    if (!host || !view) return null;
    try {
      const answer = await host.propose(offer);
      if (get().view?.turn !== view.turn) return null;
      // Your offer goes in with your orders (the deal starts as the turn plays, if the bot said yes).
      const proposed: Order = { id: `propose-${offer.id}`, kind: "propose", offer };
      // Online (session 28), to a person: relayed to them; their answer comes when they give it.
      if (answer.waiting) return set({ diplomacy: [...get().diplomacy, proposed] }), answer;
      set({
        diplomacy: [...get().diplomacy.filter((o) => !(o.kind === "propose" && o.offer.id === offer.id)), proposed],
        answers: { ...get().answers, [offer.id]: answer },
        offers: answer.counter ? [...get().offers.filter((o) => o.id !== answer.counter!.id), answer.counter] : get().offers,
        deal: answer.counter ? { mode: "offer", offer: answer.counter } : get().deal,
      });
      if (answer.accept) void replanGenerals();
      return answer;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
      return null;
    }
  },

  answerOffer(offer, accept) {
    const answer: Order = { id: `answer-${offer.from}-${offer.id}`, kind: "answer", from: offer.from, offer: offer.id, accept };
    // Online (session 28): a person's offer is answered through the room, which tells them at once.
    if (get().people?.includes(offer.from)) void get().host?.answerPerson?.(offer.from, offer.id, accept).catch((e: Error) => set({ error: e.message }));
    set({ diplomacy: [...get().diplomacy.filter((o) => !(o.kind === "answer" && o.from === offer.from && o.offer === offer.id)), answer], deal: null, dealPick: null });
    if (accept) void replanGenerals();
  },

  counterOffer(offer) {
    const { view } = get();
    if (!view) return;
    // (A person's offer stays open until the counter goes: the room marks it countered then.)
    if (!get().people?.includes(offer.from)) get().answerOffer(offer, false);
    set({ deal: { mode: "propose", offer: counterFrom(view, offer, ++offerCounter) } });
  },

  pageDeals() {
    const { ctx, view, diplomacy, answers, offers } = get();
    if (!ctx || !view) return [];
    return dealsNow(ctx, view, agreedThisTurn(view, diplomacy, answers, offers));
  },

  setLobby(patch) {
    const { lobby, modeTouched } = get();
    const next = { ...lobby, ...patch };
    const map = listingOf(next.mapId);
    // A new map starts at the smallest table it suits; the bot count always fits the map.
    if (map && patch.mapId && patch.mapId !== lobby.mapId && patch.bots === undefined) next.bots = map.recommendedPlayers.min - 1;
    // (Session 33b: and never fewer than the map's smallest table: a random 400 starts at 6 players.)
    if (map) next.bots = Math.max(1, map.minPlayers - 1, Math.min(next.bots, map.maxPlayers - 1, BOT_NAMES.length));
    const touched = modeTouched || patch.mode !== undefined;
    // Until the host picks a mode, follow the suggestion for the table size.
    if (!touched) next.mode = suggestedMode(next.bots + 1);
    if (patch.mapId !== undefined && map) rememberMap(next.mapId);
    if (patch.house !== undefined)
      try {
        localStorage.setItem(HOUSE_KEY, String(patch.house));
      } catch {
        // A private window: it's remembered for this visit only.
      }
    if (patch.leaderName !== undefined)
      try {
        localStorage.setItem(LEADER_NAME_KEY, patch.leaderName);
      } catch {
        // A private window: it's remembered for this visit only.
      }
    for (const [k, key] of [["leaderPersonality", LEADER_STYLE_KEY], ["stewardPersonality", STEWARD_STYLE_KEY]] as const)
      if (patch[k] !== undefined)
        try {
          localStorage.setItem(key, patch[k] ?? "");
        } catch {
          // A private window: it's remembered for this visit only.
        }
    set({ lobby: next, modeTouched: touched });
  },

  async start() {
    const { lobby } = get();
    // A new game: the lobby stops saying the last one finished.
    forgetFinished();
    await enterGame((host) => host.start(lobby));
  },

  async load(source) {
    // A game already running: its host loads the save in its place.
    return enterGame((host) => host.load(source), get().host);
  },

  async refreshSlots() {
    const { slots, problem } = await listSlots();
    set({ slots, slotProblem: problem });
  },

  async saveToSlot(slot) {
    const { host } = get();
    if (!host) return false;
    try {
      await host.saveTo(slot);
      await get().refreshSlots();
      return true;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
      return false;
    }
  },

  async togglePause() {
    const { host, clock, online } = get();
    // Online there's no pause (pause by vote comes in session 28).
    if (!host || !clock || online) return;
    try {
      const u = await (clock.pausedLeft !== undefined ? host.resume() : host.pause());
      set({ clock: u.clock });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    }
  },

  dismissNotice: () => {
    set({ notice: null });
    nextNotice();
  },

  showMission: (id) => set({ mission: id }),

  turnInSpoils(s, territory, building) {
    set({ queue: withTurnIn(get().queue, { set: s, ...(territory ? { territory } : {}), ...(building ? { building } : {}) }, nextOrderId()) });
  },

  tap(t) {
    const { ctx, view, queue, selected, recruit, picking, aiming, deal, dealPick, spyPick } = get();
    if (!ctx || !view) return;
    // Orders along a path: this tap picks where to go (tap the start again, or your own land next door: back to normal).
    const { pathPick } = get();
    if (pathPick) {
      if (t === pathPick) return set({ pathPick: null });
      return set({ pathPick: null, path: { from: pathPick, to: t, kind: "shortest" }, draft: null, selected: pathPick });
    }
    // Sending a spy: this tap picks the province it goes to.
    if (spyPick) {
      const province = indexMap(ctx.map).byId.get(t)?.province;
      if (!province) return;
      return set({ queue: withSpyOrder(queue, { kind: "spy", spy: spyPick, to: province }, nextOrderId()), spyPick: null, selected: t, draft: null });
    }
    // Picking for the deal card: a tap adds (or takes away) a border or a piece of land.
    if (deal?.mode === "propose" && dealPick) return set({ deal: { mode: "propose", offer: pickForDeal(ctx, view, deal.offer, dealPick, t) }, selected: t });
    // One of the Fallen, aiming a world event: this tap is its target (a storm takes a second tap, across the border).
    if (aiming) {
      if (aiming.event === "storm" && !aiming.target) return set({ aiming: { ...aiming, target: t }, selected: t });
      const across = aiming.event === "storm" ? t : undefined;
      const target = aiming.event === "storm" ? aiming.target! : t;
      if (across && !(indexMap(ctx.map).neighbors.get(target) ?? []).includes(across)) return set({ aiming: { ...aiming, target: t }, selected: t });
      const cost = ctx.rules.fallen.events[aiming.event].cost;
      const order = { id: nextOrderId(), kind: "worldEvent", event: aiming.event, target, ...(across ? { across } : {}), influence: Math.min(cost, Math.floor(view.me.influence)) } as Order;
      return set({ fallenOrders: [...get().fallenOrders, order], aiming: null, selected: target });
    }
    // Choosing for a leader's command: this tap is the place (or the province; a front gathers provinces until Confirm).
    if (picking) {
      const province = indexMap(ctx.map).byId.get(t)?.province;
      if (picking.kind === "front") {
        if (!province) return;
        const now = picking.provinces ?? [];
        return set({ picking: { ...picking, provinces: now.includes(province) ? now.filter((p) => p !== province) : [...now, province] }, selected: t });
      }
      set({ picking: null, selected: t });
      const k = picking.kind;
      const i: Instruction | null =
        k === "push" || k === "expand" ? { kind: k, territory: t } : k === "defend" ? { kind: "defend", territory: t } : province ? { kind: k, province } : null;
      if (i) void get().setInstruction(picking.general, i);
      return;
    }
    // Recruit panel open: tapping a glowing site recruits there. An enemy's (or neutral) territory next to the recruit
    // still starts the attack from there, as before (Recruit, then attack, stays quick). Anything else only looks at
    // it: the panel stays open, the recruit stays put, no move starts. Done, Esc or a tap on the sea closes it
    // (session 25b, Nate: looking around used to close the panel or start a move, and the recruit ended up somewhere
    // he didn't mean, with the panel he was pressing Done on gone or back again).
    if (recruit) {
      if (isRecruitSite(ctx, view, t)) return get().recruitAt(t);
      const editing = queue.find((o) => o.id === recruit.order && o.kind === "recruit");
      const from = editing?.kind === "recruit" ? editing.territory : selected;
      if (!isMine(view, t) && from) {
        const mine = asIfYouOrderFrom(view, queue, from);
        const action = tapTerritory(ctx, view, planQueue(ctx, view, mine), from, t, mine, passageNow(view, get().pageDeals()));
        if (action.kind === "draft") return set({ recruit: null, selected: from, draft: action.draft });
      }
      return set({ selected: t, draft: null });
    }
    // From a general's territory, its army counts as yours to order (giving it an order takes control back).
    const mineFirst = asIfYouOrderFrom(view, queue, selected);
    const action = tapTerritory(ctx, view, planQueue(ctx, view, mineFirst), selected, t, mineFirst, passageNow(view, get().pageDeals()));
    if (action.kind === "deselect") set({ selected: null, draft: null });
    else if (action.kind === "select") set({ selected: action.territory, draft: null });
    else set({ draft: action.draft });
  },

  clearSelection: () => set({ selected: null, draft: null, recruit: null, picking: null, mission: null, spyPick: null, pathPick: null, path: null }),
  select: (t) => set({ selected: t, draft: null }),

  updateDraft(patch) {
    const d = get().draft;
    if (d) set({ draft: { ...d, ...patch } });
  },

  addDraft() {
    const { draft: d, ctx, view } = get();
    if (!d || !ctx || !view) return;
    // An attack across a binding pact can't be queued (the panel says why).
    const check = attackCheck(ctx, view, get().pageDeals(), d.through?.[d.through.length - 1] ?? d.via ?? d.from, d.to);
    if (check && "block" in check) return;
    // An order of your own for a leader's army takes control of it back for the turn (its orders step aside).
    const taken = takeControl(view, get().queue, { id: "draft", kind: "move", from: d.from, to: d.to, troops: "all" }, get().paused, get().instructions);
    // A hop from an attack that sends Just enough raises that attack to All (the panel says so).
    const base = queueFor(taken.queue, d);
    if (troopsOf(ctx, view, planQueue(ctx, view, base), d) <= 0) return;
    const queue = base.map((o) => {
      // Seize / Lie in Wait go on one order only.
      if (d.timing && o.timing === d.timing) o = { ...o, timing: undefined };
      // Your own hop from where an attack lands replaces that attack's Follow through (one army, sent once).
      if (o.kind === "move" && o.to === d.from && o.preset?.id === "followThrough") o = { ...o, preset: undefined };
      return o;
    });
    set({ queue: [...queue, draftToOrder(d, nextOrderId())], paused: taken.paused, draft: null, selected: d.from, recruit: null });
  },

  pressKey(e) {
    const intent = keyIntent(e);
    if (!intent) return false;
    const { path, draft } = get();
    if (path) {
      if (intent === "confirm") void get().confirmPath();
      else get().cancelPath();
      return true;
    }
    if (draft) {
      if (intent === "confirm") get().addDraft();
      else get().clearSelection();
      return true;
    }
    // The Recruit panel: Enter or Esc is Done (the recruit is already in your orders).
    if (get().recruit) {
      get().closeRecruit();
      return true;
    }
    return false;
  },

  startPath: (from) => set({ pathPick: from, path: null, draft: null, recruit: null, picking: null, spyPick: null, selected: from }),
  setPathKind(kind) {
    const p = get().path;
    if (p) set({ path: { ...p, kind } });
  },
  async confirmPath() {
    const { path, ctx, view, queue, paused } = get();
    if (!path || !ctx || !view) return;
    // The path planner loads with the game screen; it's only imported here when you confirm (keeps the start-up small).
    const { planPath } = await import("./logic/paths");
    const plan = planPath(ctx, view, queue, get().pageDeals(), passageNow(view, get().pageDeals()), path);
    if (!plan.orders.length) return;
    // Orders of your own for a general's army take control of it back for the turn (its orders step aside).
    let next: Order[] = [...queue];
    let p = paused;
    for (const o of plan.orders) {
      const order = { ...o, id: nextOrderId() } as Order;
      const taken = takeControl(view, next, order, p, get().instructions);
      next = [...taken.queue, order];
      p = taken.paused;
    }
    set({ queue: next, paused: p, path: null, selected: plan.steps[plan.steps.length - 1] ?? path.from });
  },
  cancelPath: () => set({ path: null, pathPick: null }),
  sendSpy: (spy) => set({ spyPick: spy, draft: null, recruit: null, picking: null }),
  recallSpy: (spy) => set({ queue: withSpyOrder(get().queue, { kind: "spy", spy, to: null }, nextOrderId()), spyPick: null }),
  cancelSpyPick: () => set({ spyPick: null }),

  add(order) {
    const { view, queue, paused } = get();
    const added = { ...order, id: nextOrderId() } as Order;
    const taken = view ? takeControl(view, queue, added, paused, get().instructions) : { queue: [...queue], paused };
    set({ queue: [...taken.queue, added], paused: taken.paused });
  },

  quickRecruit() {
    const { ctx, view, queue, selected } = get();
    if (!ctx || !view) return;
    const a = actionBarState(ctx, view, planQueue(ctx, view, queue), selected).recruit;
    if (!a.ok) return;
    set({ draft: null });
    if (a.at) get().recruitAt(a.at);
    else set({ recruit: { order: null } });
  },

  openRecruit(order) {
    const o = get().queue.find((x) => x.id === order);
    set({ recruit: { order }, draft: null, ...(o?.kind === "recruit" ? { selected: o.territory } : {}) });
  },
  closeRecruit: () => set({ recruit: null, draft: null }),

  recruitAt(t) {
    const { queue, recruit } = get();
    const editing = recruit?.order ? queue.find((o) => o.id === recruit.order && o.kind === "recruit") : undefined;
    if (editing) {
      set({ queue: queue.map((o) => (o.id === editing.id ? { ...o, territory: t } : o)), selected: t, draft: null });
      return;
    }
    const id = nextOrderId();
    set({ queue: [...queue, { id, kind: "recruit", territory: t, count: "all" }], recruit: { order: id }, selected: t, draft: null });
  },

  recruitHere(t) {
    set({ queue: [...get().queue, { id: nextOrderId(), kind: "recruit", territory: t, count: "all" }], recruit: null, selected: t, draft: null });
  },

  setRecruitAmount(id, count) {
    set({ queue: get().queue.map((o) => (o.id === id && o.kind === "recruit" ? { ...o, count } : o)) });
  },

  splitRecruit() {
    const { queue, recruit } = get();
    const o = queue.find((x) => x.id === recruit?.order);
    if (o?.kind === "recruit" && (o.count === "all" || (isShare(o.count) && o.count.share > 0.5))) get().setRecruitAmount(o.id, { share: 0.5 });
    set({ recruit: { order: null } });
  },

  remove(id) {
    set({ queue: removeOrder(get().queue, id), ...(get().recruit?.order === id ? { recruit: null } : {}) });
  },

  shift(id, dir) {
    // Your orders move among your own; a leader's among its leaders' (where they sit between yours is the setting).
    const q = get().queue;
    const o = q.find((x) => x.id === id);
    if (!o) return;
    const mine = !(o.general || o.steward);
    const same = q.filter((x) => !(x.general || x.steward) === mine);
    const at = same.findIndex((x) => x.id === id);
    const other = same[at + dir];
    if (!other) return;
    const i = q.indexOf(o), j = q.indexOf(other);
    const next = [...q];
    [next[i], next[j]] = [next[j]!, next[i]!];
    set({ queue: next });
  },

  async setInstruction(general, instruction) {
    const { view, instructions } = get();
    if (!view) return;
    const key = keyOf(general);
    // Only one leader runs the military, and one the realm: handing it to this one takes it from another.
    const next: Record<string, Instruction | null> = { ...instructions, [key]: instruction };
    if (instruction?.kind === "military" || instruction?.kind === "realm")
      for (const l of view.me.leaders) {
        const k = `${l.kind}:${l.of}`;
        if (k !== key && (k in next ? next[k] : l.command)?.kind === instruction.kind) next[k] = null;
      }
    // Handing it a command gives the army back to the leader (unless you give it an order again).
    set({ instructions: next, paused: get().paused.filter((g) => g !== key), picking: null });
    await replanGenerals();
  },

  pickPlace: (general, kind) => set({ picking: { general: keyOf(general), kind, ...(kind === "front" ? { provinces: [] } : {}) }, draft: null, recruit: null }),
  confirmPick() {
    const p = get().picking;
    if (p?.kind !== "front" || !p.provinces?.length) return;
    set({ picking: null });
    void get().setInstruction(p.general, { kind: "front", provinces: p.provinces });
  },
  cancelPick: () => set({ picking: null }),

  setLeaderPlacement(p) {
    try {
      localStorage.setItem(PLACEMENT_KEY, p);
    } catch {
      // A private window: it's remembered for this visit only.
    }
    set({ leaderPlacement: p });
  },

  async setBudget(key, budget) {
    set({ budgets: { ...get().budgets, [key]: { ...get().budgets[key], budget } } });
  },

  async takeBack(key) {
    const { view } = get();
    const l = view ? findLeader(view.me, refFromKey(key)) : undefined;
    if (!l || l.purse <= 0) return;
    set({ budgets: { ...get().budgets, [key]: { ...get().budgets[key], takeBack: l.purse } } });
    // What the leader can buy this turn shrinks: its orders are written again with an empty purse.
    await replanGenerals();
  },

  arranged: () => arrangeQueue(get().queue, get().leaderPlacement),

  toggleRelease(general) {
    const r = get().releases;
    set({ releases: r.includes(general) ? r.filter((g) => g !== general) : [...r, general] });
  },

  aimEvent: (event) => set({ aiming: event ? { event, target: null } : null }),
  setPledge: (id, influence) => set({ fallenOrders: get().fallenOrders.map((o) => (o.id === id && o.kind === "worldEvent" ? { ...o, influence } : o)) }),
  removeFallenOrder: (id) => set({ fallenOrders: get().fallenOrders.filter((o) => o.id !== id) }),

  turnOrders() {
    const { view, queue, instructions, releases, diplomacy, budgets } = get();
    if (!view) return [...queue];
    const budgetOrders = Object.entries(budgets).map(([k, b]) => {
      const r = refFromKey(k);
      return { id: `budget-${r.kind}-${r.of}`, kind: "budget", general: r.of, ...(r.kind === "steward" ? { role: "steward" } : {}), ...b } as Order;
    });
    const releaseOrders = releases.map((g) => {
      const r = keyOf(g).startsWith("steward:") ? refFromKey(g) : { kind: "leader" as const, of: g.replace(/^leader:/, "") };
      return { id: `release-${r.kind}-${r.of}`, kind: "release", general: r.of, ...(r.kind === "steward" ? { role: "steward" } : {}) } as Order;
    });
    return [...instructOrders(view, instructions), ...budgetOrders, ...releaseOrders, ...diplomacy, ...get().arranged()];
  },

  async lockIn() {
    const { host, busy, view } = get();
    if (!host || busy || !view || get().replay) return;
    set({ busy: true, error: null });
    try {
      const u = await host.lockIn(get().turnOrders(), view.turn);
      // No report: the timer locked this turn in first (that update already arrived).
      if (u.report) applyTurn(u, false);
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      set({ busy: false });
    }
  },

  endReplay() {
    const { view } = get();
    if (!view) return;
    const over = view.winner !== null;
    const out = knockedOut(view);
    // Knocked out: the "Watch to the end / See the result" choice shows instead of the report.
    set({ replay: null, showReport: !over && !out && !get().watching, screen: over ? "over" : "game" });
  },

  watchAgain() {
    const { lastBefore, report } = get();
    if (!lastBefore || !report) return;
    set({ replay: { before: lastBefore, report, key: Date.now() }, showReport: false });
  },
  setShowReport: (v) => set({ showReport: v }),

  watch: () => set({ watching: true, showReport: false }),

  async watchNext() {
    const { host, busy } = get();
    if (!host || busy) return;
    set({ busy: true, error: null });
    try {
      const before = get().view!;
      const u = await host.watchNext(get().fallenOrders);
      const chronicle = get().chronicle;
      set({ view: u.view, seats: u.seats ?? null, report: u.report, chronicle: u.report && !chronicle.some((r) => r.turn === u.report!.turn) ? [...chronicle, chronicleOf(u.report)] : chronicle, lastBefore: before, replay: u.report ? { before, report: u.report, key: Date.now() } : null, clock: null, fallenOrders: [], aiming: null, ...(u.fair ? { fair: u.fair } : {}) });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      set({ busy: false });
    }
  },

  async seeResult() {
    const { host, busy } = get();
    if (!host || busy) return;
    set({ busy: true, error: null });
    try {
      const u = await host.finish();
      rememberFinished({ mapName: get().ctx?.map.name ?? "Your game", turn: u.view.turn, at: Date.now() });
      set({ view: u.view, seats: u.seats ?? null, report: u.report ?? get().report, fastForwarded: u.fastForwarded, screen: "over", watching: false, ...(u.fair ? { fair: u.fair } : {}) });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      set({ busy: false });
    }
  },

  async autoPlan() {
    const { host } = get();
    if (!host) return;
    const orders = await host.suggest();
    set({ queue: orders.map((o) => ({ ...o, id: nextOrderId() })), draft: null, recruit: null });
  },

  playAgain() {
    get().host?.dispose();
    // Back in the lobby: the game you left is the autosave (Continue).
    void get().refreshSlots();
    set({ screen: "lobby", host: null, online: null, fair: null, people: null, leftSeats: null, seats: null, view: null, ctx: null, queue: [], selected: null, draft: null, recruit: null, report: null, showReport: false, watching: false, replay: null, lastBefore: null, clock: null, instructions: {}, budgets: {}, paused: [], picking: null, releases: [], fallenOrders: [], aiming: null, diplomacy: [], offers: [], answers: {}, talks: [], deal: null, dealPick: null });
  },
}));

/**
 * Start or load a game on a host (a fresh one unless `reuse` is given) and show it. Returns false (with `error` set
 * in plain words) if it couldn't: a save from an older version, a damaged file, ...
 */
export async function enterGame(begin: (host: GameHost) => Promise<HostStart>, reuse: GameHost | null = null, make?: () => GameHost & { gameId(): string | null }): Promise<boolean> {
  const get = useGame.getState;
  const set = useGame.setState;
  // Online (session 26): a host that talks to the game's room instead of the worker in this browser.
  const host = reuse ?? (make ? make() : takeHost());
  if (!reuse) {
    get().host?.dispose();
    host.onAutoLock((u) => {
      if (get().host === host) applyTurn(u, true);
    });
    host.onNotice((notice, calm) => {
      if (get().host !== host) return;
      showNotice(notice, !!calm);
    });
  }
  set({ busy: true, error: null });
  try {
    const u = await begin(host);
    // Continue: the orders you'd queued on this turn come back, with your instruction changes and generals let go.
    const kept = u.queued ? restoredQueue(u.queued.orders) : null;
    // Online, back after missed turns: your own leaders' commands and budgets, as changes of yours this turn.
    const back = u.leadersBack ? restoredQueue(u.leadersBack) : null;
    // Online, coming back: the last turn's replay (it plays if you missed it; otherwise it's there for Watch again).
    const missed = u.replay ?? null;
    set({
      host,
      online: make && "gameId" in host ? (host as { gameId(): string | null }).gameId() : reuse ? get().online : null,
      fair: u.fair ?? null,
      people: u.people ?? null,
      leftSeats: u.leftSeats ?? null,
      ready: u.ready ?? [],
      // An online game that's over opens on its result (unless its last replay hasn't been watched).
      screen: u.view.winner && !missed?.play ? "over" : "game",
      // The map's geometry comes from the host, never from an import here.
      ctx: { map: u.map, rules: u.rules },
      view: u.view,
      seats: u.seats ?? null,
      chronicle: u.chronicle ?? [],
      queue: kept ? kept.queue : openingQueue({ map: u.map, rules: u.rules }, u),
      instructions: { ...back?.instructions, ...kept?.instructions },
      budgets: { ...back?.budgets, ...kept?.budgets },
      paused: u.queued?.paused ?? [],
      picking: null,
      releases: kept?.releases ?? [],
      diplomacy: kept?.diplomacy ?? [],
      offers: u.offers ?? [],
      answers: {},
      talks: u.talks ?? [],
      deal: null,
      dealPick: null,
      fallenOrders: [],
      aiming: null,
      selected: knockedOut(u.view) ? null : u.view.me.capital,
      draft: null,
      recruit: null,
      report: missed?.report ?? null,
      showReport: false,
      fastForwarded: 0,
      watching: false,
      clock: u.clock,
      replay: missed?.play ? { before: missed.before, report: missed.report, key: Date.now() } : null,
      lastBefore: missed?.before ?? null,
      autoLocked: false,
      notice: null,
    });
    clearNotices();
    return true;
  } catch (e) {
    // A host we started just for this goes; one already running a game keeps it.
    if (!reuse) host.dispose();
    set({ error: e instanceof Error ? e.message : String(e) });
    return false;
  } finally {
    set({ busy: false });
  }
}

/**
 * Orders a save kept (Continue), split back into the queue, instruction changes and generals you let go. Order ids
 * carry on past the highest one kept, so new orders never clash with them.
 */
/** The queue with this spy's order in it (one order per spy: a new one replaces the old). */
export function withSpyOrder(queue: readonly Order[], o: Extract<NewOrder, { kind: "spy" }>, id: string): Order[] {
  return [...queue.filter((x) => !(x.kind === "spy" && x.spy === o.spy)), { ...o, id }];
}

export function restoredQueue(orders: readonly Order[]): { queue: Order[]; instructions: Record<string, Instruction | null>; budgets: Record<string, { budget?: Budget; takeBack?: number }>; releases: string[]; diplomacy: Order[] } {
  const instructions: Record<string, Instruction | null> = {};
  const budgets: Record<string, { budget?: Budget; takeBack?: number }> = {};
  const releases: string[] = [];
  const queue: Order[] = [];
  const diplomacy: Order[] = [];
  for (const o of orders) {
    if (o.kind === "instruct") instructions[`${o.role === "steward" ? "steward" : "leader"}:${o.general}`] = o.instruction;
    // (A leader's own hand-back order is one of its orders, not a budget change of yours: session 23.)
    else if (o.kind === "budget" && !o.handBack) budgets[`${o.role === "steward" ? "steward" : "leader"}:${o.general}`] = { ...(o.budget ? { budget: o.budget } : {}), ...(o.takeBack ? { takeBack: o.takeBack } : {}) };
    else if (o.kind === "release") releases.push(o.role === "steward" ? `steward:${o.general}` : o.general);
    else if (o.kind === "propose" || o.kind === "answer" || o.kind === "break") diplomacy.push(o);
    else queue.push(o);
    const n = /^o(\d+)$/.exec(o.id);
    if (n) orderCounter = Math.max(orderCounter, Number(n[1]));
  }
  return { queue, instructions, budgets, releases, diplomacy };
}

let offerCounter = 0;
/** The newest notice (only its own timer may clear it). */
let noticeSeq = 0;
/** Session 29: quiet notices waiting their turn behind the one on screen (never more than one shows). */
const calmQueue: string[] = [];
/** How long a quiet notice stays (ms). */
export const CALM_MS = 4000;

/**
 * A notice for the page. One at a time (session 27: "Reconnected" never stacks). A warning shows at once; news (calm)
 * never covers anything still showing: it waits in line (session 29: a deal's answer behind a warning was lost) and
 * shows when the notice before it goes, then goes by itself after a few seconds.
 */
export function showNotice(notice: string, calm: boolean) {
  const st = useGame.getState();
  // (Session 29: news waits while the replay plays, as the chat's pop-up does.)
  if (calm && (st.notice || noticeHold)) {
    if (st.notice !== notice && !calmQueue.includes(notice)) calmQueue.push(notice);
    // (A long line of news is old news: the newest few are kept.)
    if (calmQueue.length > 5) calmQueue.shift();
    return;
  }
  const mine = ++noticeSeq;
  useGame.setState({ notice, noticeCalm: calm });
  if (calm)
    setTimeout(() => {
      if (noticeSeq !== mine || useGame.getState().notice !== notice) return;
      useGame.setState({ notice: null });
      nextNotice();
    }, CALM_MS);
}

/** The notice on screen went: the next quiet one waiting, if any. */
export function nextNotice() {
  if (noticeHold) return;
  const next = calmQueue.shift();
  if (next !== undefined && !useGame.getState().notice) showNotice(next, true);
}

/** Session 29: the replay is playing: quiet notices wait for it (a warning still shows at once). */
let noticeHold = false;
export function holdNotices(hold: boolean) {
  if (noticeHold === hold) return;
  noticeHold = hold;
  if (!hold) nextNotice();
}

/** Session 29: the quiet line when an online turn's planning window opens. */
export const WINDOW_OPEN = (turn: number) => `Turn ${turn} is open for orders.`;

/** A new game: nothing waiting from the last one. */
function clearNotices() {
  calmQueue.length = 0;
  noticeSeq++;
  noticeHold = false;
}

/**
 * Your leaders write their orders again (a command changed, a purse taken back, a deal agreed: they never attack
 * across it). Purses you're taking back count as empty.
 */
async function replanGenerals() {
  const { host, view, instructions, budgets } = useGame.getState();
  if (!host || !view) return;
  const purses: Record<string, number> = {};
  for (const l of view.me.leaders ?? []) {
    const k = `${l.kind}:${l.of}`;
    if (budgets[k]?.takeBack) purses[k] = Math.max(0, l.purse - budgets[k]!.takeBack!);
  }
  try {
    const fresh = await host.planGenerals(instructions, purses);
    if (useGame.getState().view?.turn !== view.turn) return;
    useGame.setState({ queue: withGeneralOrders(useGame.getState().queue, fresh.orders, useGame.getState().paused), leaderNotes: fresh.notes });
  } catch {
    // The old orders stay; the engine and the generals' guards still keep the deal.
  }
}

/**
 * A tap while picking for the deal card: a truce's border (their land next to yours: every border between that
 * territory and yours), or a piece of land to trade (yours to give, or theirs to get). Tapping again takes it back.
 */
function pickForDeal(ctx: GameContext, view: PlayerView, o: Offer, pick: "borders" | "give" | "get", t: TerritoryId): Offer {
  const idx = indexMap(ctx.map);
  const owner = (x: TerritoryId) => {
    const v = view.territories[x];
    return v?.detail === "full" ? v.owner : (v?.lastSeen?.owner ?? null);
  };
  if (pick === "borders" && o.terms.kind === "truce") {
    const them = o.to === view.me.id ? o.from : o.to;
    const theirs = owner(t) === them ? t : null;
    const mine = owner(t) === view.me.id ? t : null;
    const pairs: [TerritoryId, TerritoryId][] = theirs
      ? (idx.neighbors.get(theirs) ?? []).filter((n) => owner(n) === view.me.id).map((n) => [n, theirs])
      : mine
        ? (idx.neighbors.get(mine) ?? []).filter((n) => owner(n) === them).map((n) => [mine, n])
        : [];
    if (!pairs.length) return o;
    const now = o.terms.scope.kind === "borders" ? o.terms.scope.borders : [];
    const has = (p: [TerritoryId, TerritoryId]) => now.some(([a, b]) => (a === p[0] && b === p[1]) || (a === p[1] && b === p[0]));
    const next = pairs.every(has) ? now.filter((q) => !pairs.some((p) => (q[0] === p[0] && q[1] === p[1]) || (q[0] === p[1] && q[1] === p[0]))) : [...now, ...pairs.filter((p) => !has(p))];
    return { ...o, terms: { ...o.terms, scope: next.length ? { kind: "borders", borders: next } : { kind: "all" } } };
  }
  if ((pick === "give" || pick === "get") && o.terms.kind === "trade") {
    const side = o.terms[pick];
    const giver = pick === "give" ? o.from : o.to;
    if (owner(t) !== giver) return o;
    const land = side.land ?? [];
    const next = land.includes(t) ? land.filter((x) => x !== t) : [...land, t].slice(0, ctx.rules.diplomacy.trade.maxLand);
    const { land: _old, ...rest } = side;
    return { ...o, terms: { ...o.terms, [pick]: next.length ? { ...rest, land: next } : rest } };
  }
  return o;
}

/** The queue a turn's planning starts with: your generals' orders, and a Spoils set if your hand is full. */
function openingQueue(ctx: GameContext | null, u: HostUpdate): Order[] {
  const q = u.generalOrders ?? [];
  if (!ctx || u.view.winner || knockedOut(u.view)) return q;
  return dueTurnIn(ctx, u.view, q, namer(ctx, u.view), nextOrderId());
}

/** A turn resolved (you locked in, or the timer did): play its replay, then the report. */
/** Online (session 27): an update that isn't a turn (you resigned): the seat as it stands now, or the turn it resolved. */
export function applyOnlineUpdate(u: HostUpdate) {
  if (u.report && u.view.turn !== useGame.getState().view?.turn) return applyTurn(u, false);
  useGame.setState({ view: u.view, clock: u.clock, ...(u.people ? { people: u.people, leftSeats: u.leftSeats ?? null } : {}) });
}

function applyTurn(u: HostUpdate, auto: boolean) {
  // Online, back after missing turns: the room sends your view from before the last one, so its replay starts there.
  const before = u.before ?? useGame.getState().view;
  const over = u.view.winner !== null;
  const out = knockedOut(u.view);
  const chronicle = useGame.getState().chronicle;
  // The game's autosave goes when it ends: the lobby says it finished instead of "Nothing yet".
  if (over) rememberFinished({ mapName: useGame.getState().ctx?.map.name ?? "Your game", turn: u.view.turn, at: Date.now() });
  useGame.setState({
    view: u.view,
    seats: u.seats ?? null,
    report: u.report,
    ...(u.fair ? { fair: u.fair } : {}),
    ...(u.people ? { people: u.people, leftSeats: u.leftSeats ?? null, ready: [] } : {}),
    // The Chronicle grows by this turn's report (session 16).
    chronicle: u.report && !chronicle.some((r) => r.turn === u.report!.turn) ? [...chronicle, chronicleOf(u.report)] : chronicle,
    fastForwarded: u.fastForwarded,
    clock: u.clock,
    // A new turn: your generals have already written their orders, and every army is theirs again.
    queue: openingQueue(useGame.getState().ctx, u),
    leaderNotes: u.leaderNotes ?? {},
    // Online, back after a missed turn: your own commands and budgets come back as changes of yours.
    instructions: u.leadersBack ? restoredQueue(u.leadersBack).instructions : {},
    budgets: u.leadersBack ? restoredQueue(u.leadersBack).budgets : {},
    paused: [],
    spyPick: null,
    pathPick: null,
    path: null,
    // Last turn's offers have lapsed; this turn's are new.
    diplomacy: [],
    offers: u.offers ?? [],
    answers: {},
    talks: u.talks ?? [],
    deal: null,
    dealPick: null,
    picking: null,
    releases: [],
    draft: null,
    recruit: null,
    selected: over || out ? null : u.view.me.capital,
    showReport: false,
    autoLocked: auto,
    lastBefore: before,
    replay: before && u.report ? { before, report: u.report, key: Date.now() } : null,
  });
  if (!before || !u.report) useGame.getState().endReplay();
}

// The host keeps your orders as you build them: they're what locks in if the timer runs out, and the autosave keeps
// them for Continue.
useGame.subscribe((s, prev) => {
  if ((s.queue !== prev.queue || s.instructions !== prev.instructions || s.budgets !== prev.budgets || s.leaderPlacement !== prev.leaderPlacement || s.releases !== prev.releases || s.paused !== prev.paused || s.diplomacy !== prev.diplomacy) && s.host && s.view)
    s.host.saveOrders(s.turnOrders(), s.view.turn, s.paused);
});

// The tab is going away (closed, or a phone put it in the background): save your queue now, not in a moment.
const saveNow = () => {
  const s = useGame.getState();
  if (s.host && s.view && s.screen === "game") s.host.saveOrders(s.turnOrders(), s.view.turn, s.paused, true);
};
if (typeof window !== "undefined") window.addEventListener("pagehide", saveNow);
if (typeof document !== "undefined") document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && saveNow());
