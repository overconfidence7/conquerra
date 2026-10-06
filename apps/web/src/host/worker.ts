import { loadMap } from "@conquerra/content/loadMap";
import { HostCore } from "./hostCore";
import type { HostRequest, HostResponse } from "./protocol";
import { idbSaveStore } from "./saves";

// The engine and bots run here, off the page. The page only ever receives HostUpdates (and short slot lists).
const scope = self as unknown as { onmessage: ((e: MessageEvent<HostRequest>) => void) | null; postMessage(msg: HostResponse): void };
const core = new HostCore(idbSaveStore(), loadMap, (notice) => scope.postMessage({ id: 0, ok: true, notice }));
let timer: ReturnType<typeof setTimeout> | null = null;

/** The turn timer lives here, in the host: when it runs out, lock your saved orders in and tell the page. */
function armTimer() {
  if (timer) clearTimeout(timer);
  timer = null;
  const due = core.nextDeadline;
  if (due === null) return;
  timer = setTimeout(() => {
    const pushed = core.expireIfDue();
    if (pushed) scope.postMessage({ id: 0, ok: true, pushed });
    armTimer();
  }, Math.max(0, due - Date.now()) + 5);
}

scope.onmessage = async (e) => {
  const req = e.data;
  try {
    switch (req.type) {
      case "start":
        scope.postMessage({ id: req.id, ok: true, update: await core.start(req.settings, req.seed) });
        break;
      case "load":
        scope.postMessage({ id: req.id, ok: true, update: await core.load(req.source) });
        break;
      case "saveTo":
        scope.postMessage({ id: req.id, ok: true, slot: await core.saveTo(req.slot) });
        return;
      case "exportSave":
        scope.postMessage({ id: req.id, ok: true, save: core.exportSave(req.notes) });
        return;
      case "suggest":
        scope.postMessage({ id: req.id, ok: true, orders: core.suggest() });
        return;
      case "planGenerals":
        scope.postMessage({ id: req.id, ok: true, orders: core.planGenerals(req.instructions) });
        return;
      case "saveOrders":
        core.saveOrders(req.orders, req.turn, req.paused ?? [], req.now ?? false);
        return;
      case "pause":
        scope.postMessage({ id: req.id, ok: true, update: core.pause() });
        break;
      case "resume":
        scope.postMessage({ id: req.id, ok: true, update: core.resume() });
        break;
      case "lockIn":
        scope.postMessage({ id: req.id, ok: true, update: core.lockIn(req.orders, req.turn) });
        break;
      case "watchNext":
        scope.postMessage({ id: req.id, ok: true, update: core.watchNext(req.orders) });
        break;
      case "finish":
        scope.postMessage({ id: req.id, ok: true, update: core.finish() });
        break;
    }
    armTimer();
  } catch (err) {
    scope.postMessage({ id: req.id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
