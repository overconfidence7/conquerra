import type { Answer } from "@conquerra/bots";
import type { Order, SaveFile } from "@conquerra/engine";
import type { SlotInfo } from "./saves";
import type { GameHost, HostRequest, HostResponse, HostStart, HostUpdate, LeaderOrders, LobbySettings, RandomPreview } from "./protocol";

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
  const notices: ((m: string) => void)[] = [];
  const progress: ((done: number) => void)[] = [];
  worker.onmessage = (e: MessageEvent<HostResponse>) => {
    const res = e.data;
    if ("pushed" in res) {
      for (const f of autoLock) f(res.pushed);
      return;
    }
    if ("notice" in res) {
      for (const f of notices) f(res.notice);
      return;
    }
    if ("mapProgress" in res) {
      for (const f of progress) f(res.mapProgress);
      return;
    }
    const p = pending.get(res.id);
    if (!p) return;
    pending.delete(res.id);
    if (!res.ok) p.reject(new Error(res.error));
    else p.resolve("orders" in res ? res.orders : "plan" in res ? res.plan : "save" in res ? res.save : "slot" in res ? res.slot : "answer" in res ? res.answer : "random" in res ? res.random : res.update);
  };
  // If the engine's worker stops (it crashed, or the browser killed it), say so instead of waiting forever.
  const failAll = (why: string) => {
    for (const p of pending.values()) p.reject(new Error(why));
    pending.clear();
  };
  worker.onerror = (e) => {
    console.error("Game host stopped:", e.message);
    failAll("Sorry, the game engine stopped. Reload the page, and Continue picks up from the start of this turn.");
  };
  worker.onmessageerror = () => failAll("Sorry, the game engine sent a message the page couldn't read. Reload the page to carry on.");
  const send = <T = HostUpdate>(body: Body) =>
    new Promise<T>((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve: resolve as (u: unknown) => void, reject });
      worker.postMessage({ ...body, id } as HostRequest);
    });
  return {
    start: (settings: LobbySettings) => send<HostStart>({ type: "start", settings, seed: newSeed() }),
    load: (source) => send<HostStart>({ type: "load", source }),
    saveTo: (slot) => send<SlotInfo>({ type: "saveTo", slot }),
    exportSave: (notes) => send<SaveFile>({ type: "exportSave", ...(notes ? { notes } : {}) }),
    pause: () => send({ type: "pause" }),
    resume: () => send({ type: "resume" }),
    onNotice: (f) => void notices.push(f),
    lockIn: (orders, turn) => send({ type: "lockIn", orders, turn }),
    saveOrders: (orders, turn, paused, now) => worker.postMessage({ id: nextId++, type: "saveOrders", orders, turn, ...(paused?.length ? { paused } : {}), ...(now ? { now } : {}) } as HostRequest),
    onAutoLock: (f) => void autoLock.push(f),
    watchNext: (orders) => send({ type: "watchNext", ...(orders ? { orders } : {}) }),
    finish: () => send({ type: "finish" }),
    suggest: () => send<Order[]>({ type: "suggest" }),
    propose: (offer) => send<Answer>({ type: "propose", offer }),
    planGenerals: (instructions, purses) => send<LeaderOrders>({ type: "planGenerals", instructions, ...(purses ? { purses } : {}) }),
    randomMap: (mapId) => send<RandomPreview>({ type: "randomMap", mapId }),
    onMapProgress: (f) => void progress.push(f),
    dispose: () => worker.terminate(),
  };
}
