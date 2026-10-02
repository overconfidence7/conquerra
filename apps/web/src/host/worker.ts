import { LocalGame } from "./localGame";
import type { HostRequest, HostResponse } from "./protocol";

// The engine and bots run here, off the page. The page only ever receives HostUpdates.
const scope = self as unknown as { onmessage: ((e: MessageEvent<HostRequest>) => void) | null; postMessage(msg: HostResponse): void };
let game: LocalGame | null = null;

scope.onmessage = (e) => {
  const req = e.data;
  try {
    if (req.type === "start") {
      game = new LocalGame(req.settings, req.seed);
      scope.postMessage({ id: req.id, ok: true, update: game.update() });
    } else {
      if (!game) throw new Error("No game running");
      scope.postMessage({ id: req.id, ok: true, update: game.lockIn(req.orders) });
    }
  } catch (err) {
    scope.postMessage({ id: req.id, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
