import type { MapDef } from "@conquerra/content";
import { loadGameMap } from "./gameMaps";

/**
 * Session 30: a game's map for an online page. An official map is fetched as before; a random one is built from its id
 * in a background worker (a big map takes seconds, and the page must not freeze), at the version the room pinned.
 * Where there are no workers (tests in Node), it's built here.
 */
let worker: Worker | null = null;
let next = 1;
const waiting = new Map<number, { ok: (m: MapDef) => void; fail: (e: Error) => void }>();

export function loadOnlineMap(id: string, version?: number | null): Promise<MapDef> {
  if (!id.startsWith("random:") || typeof Worker === "undefined") return loadGameMap(id, version);
  if (!worker) {
    worker = new Worker(new URL("./mapBuild.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<{ n: number; map?: MapDef; error?: string }>) => {
      const w = waiting.get(e.data.n);
      waiting.delete(e.data.n);
      if (e.data.map) w?.ok(e.data.map);
      else w?.fail(new Error(e.data.error ?? "The map couldn't be made."));
    };
  }
  const n = next++;
  return new Promise((ok, fail) => {
    waiting.set(n, { ok, fail });
    worker!.postMessage({ n, id, version });
  });
}
