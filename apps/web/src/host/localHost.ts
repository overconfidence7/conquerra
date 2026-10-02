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
  const pending = new Map<number, { resolve: (u: HostUpdate | HostStart) => void; reject: (e: Error) => void }>();
  worker.onmessage = (e: MessageEvent<HostResponse>) => {
    const res = e.data;
    const p = pending.get(res.id);
    if (!p) return;
    pending.delete(res.id);
    if (res.ok) p.resolve(res.update);
    else p.reject(new Error(res.error));
  };
  const send = (body: Body) =>
    new Promise<HostUpdate | HostStart>((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      worker.postMessage({ ...body, id } as HostRequest);
    });
  return {
    start: (settings: LobbySettings) => send({ type: "start", settings, seed: newSeed() }) as Promise<HostStart>,
    lockIn: (orders) => send({ type: "lockIn", orders }),
    watchNext: () => send({ type: "watchNext" }),
    finish: () => send({ type: "finish" }),
    dispose: () => worker.terminate(),
  };
}
