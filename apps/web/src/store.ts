import { defaultRules, maps, suggestedMode } from "@conquerra/content";
import type { GameContext, Order, PlayerView, TerritoryId } from "@conquerra/engine";
import { create } from "zustand";
import { createLocalHost } from "./host/localHost";
import type { GameHost, LobbySettings, TurnReport } from "./host/protocol";
import { draftToOrder, type NewOrder, planQueue, removeOrder, shiftOrder, tapTerritory, type MoveDraft } from "./logic/orders";

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
  remove(id: string): void;
  shift(id: string, dir: -1 | 1): void;
  lockIn(): Promise<void>;
  setShowReport(v: boolean): void;
  playAgain(): void;
}

let orderCounter = 0;
const nextOrderId = () => `o${++orderCounter}`;

const defaultLobby = (): LobbySettings => {
  const bots = 3;
  return { mapId: "embervale", bots, luck: defaultRules.combat.luck, fog: true, mode: suggestedMode(bots + 1) };
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
  busy: false,
  error: null,

  setLobby(patch) {
    const { lobby, modeTouched } = get();
    const next = { ...lobby, ...patch };
    const touched = modeTouched || patch.mode !== undefined;
    // Until the host picks a mode, follow the suggestion for the table size.
    if (!touched) next.mode = suggestedMode(next.bots + 1);
    set({ lobby: next, modeTouched: touched });
  },

  async start() {
    const { lobby } = get();
    get().host?.dispose();
    const host = createLocalHost();
    set({ busy: true, error: null, host });
    try {
      const u = await host.start(lobby);
      set({
        screen: "game",
        ctx: { map: maps[lobby.mapId]!, rules: defaultRules },
        view: u.view,
        queue: [],
        selected: u.view.me.capital,
        draft: null,
        report: null,
        showReport: false,
        fastForwarded: 0,
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
    const action = tapTerritory(ctx, view, planQueue(ctx, view, queue), selected, t);
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
    const d = get().draft;
    if (!d || d.troops <= 0) return;
    // Seize / Lie in Wait go on one order only.
    const queue = get().queue.map((o) => (d.timing && o.timing === d.timing ? { ...o, timing: undefined } : o));
    set({ queue: [...queue, draftToOrder(d, nextOrderId())], draft: null, selected: d.from });
  },

  add(order) {
    set({ queue: [...get().queue, { ...order, id: nextOrderId() } as Order] });
  },

  remove(id) {
    set({ queue: removeOrder(get().queue, id) });
  },

  shift(id, dir) {
    set({ queue: shiftOrder(get().queue, id, dir) });
  },

  async lockIn() {
    const { host, queue, busy } = get();
    if (!host || busy) return;
    set({ busy: true, error: null });
    try {
      const u = await host.lockIn(queue);
      const over = u.view.winner !== null;
      set({
        view: u.view,
        report: u.report,
        fastForwarded: u.fastForwarded,
        queue: [],
        draft: null,
        selected: over ? null : u.view.me.capital,
        showReport: !over,
        screen: over ? "over" : "game",
      });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      set({ busy: false });
    }
  },

  setShowReport: (v) => set({ showReport: v }),

  playAgain() {
    get().host?.dispose();
    set({ screen: "lobby", host: null, view: null, ctx: null, queue: [], selected: null, draft: null, report: null, showReport: false });
  },
}));
