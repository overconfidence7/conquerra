import { defaultRules, mapCatalog, suggestedMode } from "@conquerra/content";
import { BOT_NAMES } from "./host/names";
import { indexMap, isShare, type GameContext, type Instruction, type Order, type PlayerId, type PlayerView, type RecruitAmount, type SpoilsSet, type TerritoryId, type WorldEventKind } from "@conquerra/engine";
import { asIfYouOrderFrom, instructOrders, takeControl, withGeneralOrders } from "./logic/generals";
import { create } from "zustand";
import { createLocalHost } from "./host/localHost";
import type { GameHost, HostStart, HostUpdate, LoadSource, LobbySettings, TurnReport } from "./host/protocol";
import { listSlots, type SlotId, type SlotInfo } from "./host/saves";
import { dueTurnIn, withTurnIn } from "./logic/spoils";
import { namer } from "./logic/text";
import { DEFAULT_TIMER, type TurnClock } from "./logic/timer";
import { actionBarState } from "./logic/actions";
import { draftToOrder, isRecruitSite, type NewOrder, planQueue, queueFor, removeOrder, shiftOrder, tapTerritory, troopsOf, type MoveDraft } from "./logic/orders";

export type Screen = "lobby" | "game" | "over";

interface GameStore {
  screen: Screen;
  lobby: LobbySettings;
  /** The host decides the mode automatically until the player picks one. */
  modeTouched: boolean;
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
  /** Your generals' instructions as you've set them this turn (starting from the standing ones). */
  instructions: Record<PlayerId, Instruction | null>;
  /** Generals whose army you gave an order of your own this turn: yours to command until the turn ends. */
  paused: PlayerId[];
  /** Choosing a place on the map for a general (Push toward, or Defend toward a place): the next tap picks it. */
  picking: { general: PlayerId; kind: "push" | "defend" } | null;
  /** Captured generals you chose to let go this turn (you may keep two). */
  releases: PlayerId[];
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

  setLobby(patch: Partial<LobbySettings>): void;
  start(): Promise<void>;
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
  turnInSpoils(set: SpoilsSet, territory?: TerritoryId): void;
  /** A mission you tapped: its target lights up on the map (until you tap the map). */
  mission: string | null;
  showMission(id: string | null): void;
  tap(t: TerritoryId): void;
  clearSelection(): void;
  select(t: TerritoryId): void;
  updateDraft(patch: Partial<MoveDraft>): void;
  addDraft(): void;
  add(order: NewOrder): void;
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
  /** Give a general a standing instruction (null: you give its army orders yourself). Its new orders replace its old ones in your queue. */
  setInstruction(general: PlayerId, instruction: Instruction | null): Promise<void>;
  /** Push toward / Defend toward a place: the next tap on the map picks the place. */
  pickPlace(general: PlayerId, kind: "push" | "defend"): void;
  cancelPick(): void;
  /** With a third captured general: let this one go (or keep it after all). */
  toggleRelease(general: PlayerId): void;
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
const takeHost = () => {
  const h = warm ?? makeHost();
  warm = null;
  return h;
};

/** Are you out of the game while it goes on? */
export const knockedOut = (view: PlayerView) => view.winner === null && view.players.find((p) => p.id === view.me.id)?.eliminatedTurn != null;

let orderCounter = 0;
const nextOrderId = () => `o${++orderCounter}`;

const defaultLobby = (): LobbySettings => {
  const bots = 3;
  return { mapId: "embervale", bots, botLevel: "captain", luck: defaultRules.combat.luck, fog: true, mode: suggestedMode(bots + 1), turnSeconds: DEFAULT_TIMER };
};

export const useGame = create<GameStore>((set, get) => ({
  screen: "lobby",
  lobby: defaultLobby(),
  modeTouched: false,
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
  watching: false,
  clock: null,
  replay: null,
  lastBefore: null,
  autoLocked: false,
  busy: false,
  error: null,
  instructions: {},
  paused: [],
  picking: null,
  releases: [],
  fallenOrders: [],
  aiming: null,
  slots: [],
  slotProblem: null,
  notice: null,
  mission: null,

  setLobby(patch) {
    const { lobby, modeTouched } = get();
    const next = { ...lobby, ...patch };
    const map = mapCatalog.find((m) => m.id === next.mapId);
    // A new map starts at the smallest table it suits; the bot count always fits the map.
    if (map && patch.mapId && patch.mapId !== lobby.mapId && patch.bots === undefined) next.bots = map.recommendedPlayers.min - 1;
    if (map) next.bots = Math.max(1, Math.min(next.bots, map.maxPlayers - 1, BOT_NAMES.length));
    const touched = modeTouched || patch.mode !== undefined;
    // Until the host picks a mode, follow the suggestion for the table size.
    if (!touched) next.mode = suggestedMode(next.bots + 1);
    set({ lobby: next, modeTouched: touched });
  },

  async start() {
    const { lobby } = get();
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
    const { host, clock } = get();
    if (!host || !clock) return;
    try {
      const u = await (clock.pausedLeft !== undefined ? host.resume() : host.pause());
      set({ clock: u.clock });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    }
  },

  dismissNotice: () => set({ notice: null }),

  showMission: (id) => set({ mission: id }),

  turnInSpoils(s, territory) {
    set({ queue: withTurnIn(get().queue, { set: s, ...(territory ? { territory } : {}) }, nextOrderId()) });
  },

  tap(t) {
    const { ctx, view, queue, selected, recruit, picking, aiming } = get();
    if (!ctx || !view) return;
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
    // Choosing a place for a general: this tap is it.
    if (picking) {
      set({ picking: null });
      void get().setInstruction(picking.general, picking.kind === "push" ? { kind: "push", territory: t } : { kind: "defend", territory: t });
      return;
    }
    // Recruit panel open: tapping a glowing site recruits there. Anything else closes the panel and taps as usual.
    if (recruit) {
      if (isRecruitSite(ctx, view, t)) return get().recruitAt(t);
      set({ recruit: null });
    }
    // From a general's territory, its army counts as yours to order (giving it an order takes control back).
    const mineFirst = asIfYouOrderFrom(view, queue, selected);
    const action = tapTerritory(ctx, view, planQueue(ctx, view, mineFirst), selected, t, mineFirst);
    if (action.kind === "deselect") set({ selected: null, draft: null });
    else if (action.kind === "select") set({ selected: action.territory, draft: null });
    else set({ draft: action.draft });
  },

  clearSelection: () => set({ selected: null, draft: null, recruit: null, picking: null, mission: null }),
  select: (t) => set({ selected: t, draft: null }),

  updateDraft(patch) {
    const d = get().draft;
    if (d) set({ draft: { ...d, ...patch } });
  },

  addDraft() {
    const { draft: d, ctx, view } = get();
    if (!d || !ctx || !view) return;
    // An order of your own for a general's army takes control of it back for the turn (its orders step aside).
    const taken = takeControl(view, get().queue, { id: "draft", kind: "move", from: d.from, to: d.to, troops: "all" }, get().paused);
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

  add(order) {
    const { view, queue, paused } = get();
    const added = { ...order, id: nextOrderId() } as Order;
    const taken = view ? takeControl(view, queue, added, paused) : { queue: [...queue], paused };
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
  closeRecruit: () => set({ recruit: null }),

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
    set({ queue: shiftOrder(get().queue, id, dir) });
  },

  async setInstruction(general, instruction) {
    const { host, view, instructions } = get();
    if (!host || !view) return;
    const next = { ...instructions, [general]: instruction };
    // Handing it an instruction gives the army back to the general (unless you give it an order again).
    set({ instructions: next, paused: get().paused.filter((g) => g !== general), picking: null });
    try {
      const fresh = await host.planGenerals(next);
      if (get().view?.turn !== view.turn) return;
      set({ queue: withGeneralOrders(get().queue, fresh, get().paused) });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    }
  },

  pickPlace: (general, kind) => set({ picking: { general, kind }, draft: null, recruit: null }),
  cancelPick: () => set({ picking: null }),

  toggleRelease(general) {
    const r = get().releases;
    set({ releases: r.includes(general) ? r.filter((g) => g !== general) : [...r, general] });
  },

  aimEvent: (event) => set({ aiming: event ? { event, target: null } : null }),
  setPledge: (id, influence) => set({ fallenOrders: get().fallenOrders.map((o) => (o.id === id && o.kind === "worldEvent" ? { ...o, influence } : o)) }),
  removeFallenOrder: (id) => set({ fallenOrders: get().fallenOrders.filter((o) => o.id !== id) }),

  turnOrders() {
    const { view, queue, instructions, releases } = get();
    if (!view) return [...queue];
    return [...instructOrders(view, instructions), ...releases.map((g) => ({ id: `release-${g}`, kind: "release", general: g }) as Order), ...queue];
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
      set({ view: u.view, report: u.report, lastBefore: before, replay: u.report ? { before, report: u.report, key: Date.now() } : null, clock: null, fallenOrders: [], aiming: null });
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
      set({ view: u.view, report: u.report ?? get().report, fastForwarded: u.fastForwarded, screen: "over", watching: false });
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
    set({ screen: "lobby", host: null, view: null, ctx: null, queue: [], selected: null, draft: null, recruit: null, report: null, showReport: false, watching: false, replay: null, lastBefore: null, clock: null, instructions: {}, paused: [], picking: null, releases: [], fallenOrders: [], aiming: null });
  },
}));

/**
 * Start or load a game on a host (a fresh one unless `reuse` is given) and show it. Returns false (with `error` set
 * in plain words) if it couldn't: a save from an older version, a damaged file, ...
 */
async function enterGame(begin: (host: GameHost) => Promise<HostStart>, reuse: GameHost | null = null): Promise<boolean> {
  const get = useGame.getState;
  const set = useGame.setState;
  const host = reuse ?? takeHost();
  if (!reuse) {
    get().host?.dispose();
    host.onAutoLock((u) => {
      if (get().host === host) applyTurn(u, true);
    });
    host.onNotice((notice) => {
      if (get().host === host) set({ notice });
    });
  }
  set({ busy: true, error: null });
  try {
    const u = await begin(host);
    set({
      host,
      screen: "game",
      // The map's geometry comes from the host, never from an import here.
      ctx: { map: u.map, rules: u.rules },
      view: u.view,
      queue: openingQueue({ map: u.map, rules: u.rules }, u),
      instructions: {},
      paused: [],
      picking: null,
      releases: [],
      fallenOrders: [],
      aiming: null,
      selected: knockedOut(u.view) ? null : u.view.me.capital,
      draft: null,
      recruit: null,
      report: null,
      showReport: false,
      fastForwarded: 0,
      watching: false,
      clock: u.clock,
      replay: null,
      lastBefore: null,
      autoLocked: false,
      notice: null,
    });
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

/** The queue a turn's planning starts with: your generals' orders, and a Spoils set if your hand is full. */
function openingQueue(ctx: GameContext | null, u: HostUpdate): Order[] {
  const q = u.generalOrders ?? [];
  if (!ctx || u.view.winner || knockedOut(u.view)) return q;
  return dueTurnIn(ctx, u.view, q, namer(ctx, u.view), nextOrderId());
}

/** A turn resolved (you locked in, or the timer did): play its replay, then the report. */
function applyTurn(u: HostUpdate, auto: boolean) {
  const before = useGame.getState().view;
  const over = u.view.winner !== null;
  const out = knockedOut(u.view);
  useGame.setState({
    view: u.view,
    report: u.report,
    fastForwarded: u.fastForwarded,
    clock: u.clock,
    // A new turn: your generals have already written their orders, and every army is theirs again.
    queue: openingQueue(useGame.getState().ctx, u),
    instructions: {},
    paused: [],
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

// The host keeps your orders as you build them: they're what locks in if the timer runs out.
useGame.subscribe((s, prev) => {
  if ((s.queue !== prev.queue || s.instructions !== prev.instructions || s.releases !== prev.releases) && s.host && s.view) s.host.saveOrders(s.turnOrders(), s.view.turn);
});
