import { LocalGame } from "./localGame";
import type { HostRequest, HostResponse } from "./protocol";

// The engine and bots run here, off the page. The page only ever receives HostUpdates.
const scope = self as unknown as { onmessage: ((e: MessageEvent<HostRequest>) => void) | null; postMessage(msg: HostResponse): void };
let game: LocalGame | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

/** The turn timer lives here, in the host: when it runs out, lock your saved orders in and tell the page. */
function armTimer() {
  if (timer) clearTimeout(timer);
  timer = null;
  const due = game?.nextDeadline;
  if (due === null || due === undefined) return;
  timer = setTimeout(() => {
    const pushed = game?.expireIfDue();
    if (pushed) scope.postMessage({ id: 0, ok: true, pushed });
    armTimer();
  }, Math.max(0, due - Date.now()) + 5);
}

scope.onmessage = (e) => {
  const req = e.data;
  try {
    if (req.type === "start") {
      game = new LocalGame(req.settings, req.seed);
      scope.postMessage({ id: req.id, ok: true, update: game.start() });
      armTimer();
    } else {
      if (!game) throw new Error("No game running");
      if (req.type === "suggest") {
        scope.postMessage({ id: req.id, ok: true, orders: game.suggest() });
        return;
      }
      if (req.type === "saveOrders") {
        game.saveOrders(req.orders, req.turn);
        return;
      }
      const update = req.type === "lockIn" ? game.lockIn(req.orders, req.turn) : req.type === "watchNext" ? game.watchNext() : game.finish();
      scope.postMessage({ id: req.id, ok: true, update });
      armTimer();
    }
  } catch (err) {
    scope.postMessage({ id: req.id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
