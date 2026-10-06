import type { Order, SavedGame } from "@conquerra/engine";
import type { GameHost, HostRequest, HostResponse, HostStart, HostUpdate, LobbySettings } from "./protocol";

/** A fresh secret seed for the game's dice (the engine itself never makes randomness). */
function newSeed(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

type Body = HostRequest extends infer R ? (R extends { id: number } ? Omit<R, "id"> : never) : never;

/** The single-player host: the game runs in a Web Worker. M4 swaps this for a server connection. */
export function createLocalHost(): GameHost {
  const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  let nextId = 1;
  const pending = new Map<number, { resolve: (u: unknown) => void; reject: (e: Error) => void }>();
  const autoLock: ((u: HostUpdate) => void)[] = [];
  worker.onmessage = (e: MessageEvent<HostResponse>) => {
    const res = e.data;
    if ("pushed" in res) {
      for (const f of autoLock) f(res.pushed);
      return;
    }
    const p = pending.get(res.id);
    if (!p) return;
    pending.delete(res.id);
    if (!res.ok) p.reject(new Error(res.error));
    else p.resolve("orders" in res ? res.orders : "save" in res ? res.save : res.update);
  };
  // If the engine's worker stops (it crashed, or the browser killed it), say so instead of waiting forever.
  const failAll = (why: string) => {
    for (const p of pending.values()) p.reject(new Error(why));
    pending.clear();
  };
  worker.onerror = (e) => {
    console.error("Game host stopped:", e.message);
    failAll("The game engine stopped unexpectedly. Reload the page to start again.");
  };
  worker.onmessageerror = () => failAll("The game engine sent a message the page couldn't read.");
  const send = <T = HostUpdate>(body: Body) =>
    new Promise<T>((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve: resolve as (u: unknown) => void, reject });
      worker.postMessage({ ...body, id } as HostRequest);
    });
  return {
    start: (settings: LobbySettings) => send<HostStart>({ type: "start", settings, seed: newSeed() }),
    lockIn: (orders, turn) => send({ type: "lockIn", orders, turn }),
    saveOrders: (orders, turn) => worker.postMessage({ id: nextId++, type: "saveOrders", orders, turn } as HostRequest),
    onAutoLock: (f) => void autoLock.push(f),
    watchNext: () => send({ type: "watchNext" }),
    finish: () => send({ type: "finish" }),
    suggest: () => send<Order[]>({ type: "suggest" }),
    planGenerals: (instructions) => send<Order[]>({ type: "planGenerals", instructions }),
    save: (notes) => send<SavedGame>({ type: "save", ...(notes ? { notes } : {}) }),
    dispose: () => worker.terminate(),
  };
}
