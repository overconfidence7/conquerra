import { maps } from "@conquerra/content/maps";
import { HostCore } from "../src/host/hostCore";
import type { GameHost } from "../src/host/protocol";
import { memorySaveStore, type SaveStore } from "../src/host/saves";

/** The real game host, run in-process instead of in a Web Worker, saving to memory instead of the browser. */
export function inProcessHost(seed: string, store: SaveStore = memorySaveStore(), now?: () => number): GameHost & { core: HostCore } {
  const notices: ((m: string) => void)[] = [];
  const core = new HostCore(store, async (id) => maps[id]!, (m) => notices.forEach((f) => f(m)), now);
  return {
    core,
    start: async (s) => core.start(s, seed),
    load: async (source) => core.load(source),
    lockIn: async (orders, turn) => core.lockIn(orders, turn),
    saveOrders: (orders, turn, paused, now) => core.saveOrders(orders, turn, paused ?? [], now ?? false),
    onAutoLock: () => {},
    onNotice: (f) => void notices.push(f),
    watchNext: async (orders) => core.watchNext(orders),
    finish: async () => core.finish(),
    suggest: async () => core.suggest(),
    propose: async (offer) => core.propose(offer),
    planGenerals: async (instructions, purses) => core.planGenerals(instructions, purses),
    saveTo: async (slot) => core.saveTo(slot),
    exportSave: async (notes) => core.exportSave(notes),
    pause: async () => core.pause(),
    resume: async () => core.resume(),
    dispose: () => {},
  };
}
