import { defaultRules, mapCatalog, suggestedMode } from "@conquerra/content";
import { BOT_NAMES } from "./host/names";
import type { GameContext, Order, PlayerView, TerritoryId } from "@conquerra/engine";
import { create } from "zustand";
import { createLocalHost } from "./host/localHost";
import type { GameHost, HostUpdate, LobbySettings, TurnReport } from "./host/protocol";
import { DEFAULT_TIMER, type TurnClock } from "./logic/timer";
import { actionBarState } from "./logic/actions";
import { draftToOrder, type NewOrder, planQueue, queueFor, removeOrder, shiftOrder, tapTerritory, troopsOf, type MoveDraft } from "./logic/orders";

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

  setLobby(patch: Partial<LobbySettings>): void;
  start(): Promise<void>;
  tap(t: TerritoryId): void;
  clearSelection(): void;
  select(t: TerritoryId): void;
  updateDraft(patch: Partial<MoveDraft>): void;
  addDraft(): void;
  add(order: NewOrder): void;
  /** The action bar's Recruit: one tap recruits all you can afford (at the selected territory if it can, else the capital). */
  quickRecruit(): void;
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
    get().host?.dispose();
    const host = takeHost();
    set({ busy: true, error: null, host });
    host.onAutoLock((u) => {
      if (get().host === host) applyTurn(u, true);
    });
    try {
      const u = await host.start(lobby);
      set({
        screen: "game",
        // The map's geometry comes from the host, never from an import here.
        ctx: { map: u.map, rules: u.rules },
        view: u.view,
        queue: [],
        selected: u.view.me.capital,
        draft: null,
        report: null,
        showReport: false,
        fastForwarded: 0,
        watching: false,
        clock: u.clock,
        replay: null,
        lastBefore: null,
        autoLocked: false,
      });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      set({ busy: false });
    }
  },

  tap(t) {
    const { ctx, view, queue, selected } = get();
    if (!ctx || !view) return;
    const action = tapTerritory(ctx, view, planQueue(ctx, view, queue), selected, t, queue);
    if (action.kind === "deselect") set({ selected: null, draft: null });
    else if (action.kind === "select") set({ selected: action.territory, draft: null });
    else set({ draft: action.draft });
  },

  clearSelection: () => set({ selected: null, draft: null }),
  select: (t) => set({ selected: t, draft: null }),

  updateDraft(patch) {
    const d = get().draft;
    if (d) set({ draft: { ...d, ...patch } });
  },

  addDraft() {
    const { draft: d, ctx, view } = get();
    if (!d || !ctx || !view) return;
    // A hop from an attack that sends Just enough raises that attack to All (the panel says so).
    const base = queueFor(get().queue, d);
    if (troopsOf(ctx, view, planQueue(ctx, view, base), d) <= 0) return;
    const queue = base.map((o) => {
      // Seize / Lie in Wait go on one order only.
      if (d.timing && o.timing === d.timing) o = { ...o, timing: undefined };
      // Your own hop from where an attack lands replaces that attack's Follow through (one army, sent once).
      if (o.kind === "move" && o.to === d.from && o.preset?.id === "followThrough") o = { ...o, preset: undefined };
      return o;
    });
    set({ queue: [...queue, draftToOrder(d, nextOrderId())], draft: null, selected: d.from });
  },

  add(order) {
    set({ queue: [...get().queue, { ...order, id: nextOrderId() } as Order] });
  },

  quickRecruit() {
    const { ctx, view, queue, selected } = get();
    if (!ctx || !view) return;
    const plan = planQueue(ctx, view, queue);
    const a = actionBarState(ctx, view, plan, selected).recruit;
    if (a.ok && a.at) get().add({ kind: "recruit", territory: a.at, count: a.count });
  },

  remove(id) {
    set({ queue: removeOrder(get().queue, id) });
  },

  shift(id, dir) {
    set({ queue: shiftOrder(get().queue, id, dir) });
  },

  async lockIn() {
    const { host, queue, busy, view } = get();
    if (!host || busy || !view || get().replay) return;
    set({ busy: true, error: null });
    try {
      const u = await host.lockIn(queue, view.turn);
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
      const u = await host.watchNext();
      set({ view: u.view, report: u.report, lastBefore: before, replay: u.report ? { before, report: u.report, key: Date.now() } : null, clock: null });
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
    set({ queue: orders.map((o) => ({ ...o, id: nextOrderId() })), draft: null });
  },

  playAgain() {
    get().host?.dispose();
    set({ screen: "lobby", host: null, view: null, ctx: null, queue: [], selected: null, draft: null, report: null, showReport: false, watching: false, replay: null, lastBefore: null, clock: null });
  },
}));

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
    queue: [],
    draft: null,
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
  if (s.queue !== prev.queue && s.host && s.view) s.host.saveOrders(s.queue, s.view.turn);
});
