import { loadGameMap } from "./gameMaps";

/** Session 30: builds a random map off the page (an online game's page), and keeps the last few. */
const scope = self as unknown as { onmessage: ((e: MessageEvent<{ n: number; id: string; version?: number | null; attempt?: number | null }>) => void) | null; postMessage(msg: unknown): void };
scope.onmessage = async (e) => {
  const { n, id, version, attempt } = e.data;
  try {
    scope.postMessage({ n, map: await loadGameMap(id, version, undefined, attempt) });
  } catch (err) {
    scope.postMessage({ n, error: err instanceof Error ? err.message : String(err) });
  }
};
