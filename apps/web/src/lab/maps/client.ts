import type { MapDef } from "@conquerra/content";
import type { Recipe } from "@conquerra/mapgen";
import type { LabMade } from "./core";
import type { LabRequest, LabResponse } from "./worker";

type Report = Extract<LabResponse, { type: "simDone" }>;

/**
 * Talks to the lab's workers. Making a map uses one long-lived worker; the gallery and each sim get their own,
 * so starting a new one simply stops the old one.
 */
export class LabClient {
  private maker = LabClient.spawn();
  private gallery: Worker | null = null;
  private sim: Worker | null = null;
  private next = 1;

  private static spawn() {
    return new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  }

  make(recipe: Recipe): Promise<LabMade> {
    const id = this.next++;
    return new Promise((resolve, reject) => {
      const on = (e: MessageEvent<LabResponse>) => {
        if (e.data.id !== id) return;
        this.maker.removeEventListener("message", on);
        if (e.data.type === "made") resolve(e.data.made);
        else reject(new Error(e.data.type === "error" ? e.data.error : "unexpected reply"));
      };
      this.maker.addEventListener("message", on);
      this.maker.postMessage({ id, type: "make", recipe } satisfies LabRequest);
    });
  }

  /** Makes each recipe in turn, calling `each` as each finishes. */
  galleryOf(recipes: Recipe[], each: (index: number, made: LabMade) => void) {
    this.gallery?.terminate();
    const w = (this.gallery = LabClient.spawn());
    w.onmessage = (e: MessageEvent<LabResponse>) => {
      if (e.data.type === "galleryItem") each(e.data.index, e.data.made);
    };
    w.postMessage({ id: this.next++, type: "gallery", recipes } satisfies LabRequest);
  }

  simulate(map: MapDef, players: number, games: number, seed: string, progress: (done: number, total: number) => void): Promise<Report> {
    this.sim?.terminate();
    const w = (this.sim = LabClient.spawn());
    return new Promise((resolve, reject) => {
      w.onmessage = (e: MessageEvent<LabResponse>) => {
        if (e.data.type === "progress") progress(e.data.done, e.data.total);
        else if (e.data.type === "simDone") resolve(e.data);
        else if (e.data.type === "error") reject(new Error(e.data.error));
      };
      w.onerror = (e) => reject(new Error(e.message));
      w.postMessage({ id: this.next++, type: "sim", map, players, games, seed } satisfies LabRequest);
    });
  }

  stopSim() {
    this.sim?.terminate();
    this.sim = null;
  }

  dispose() {
    for (const w of [this.maker, this.gallery, this.sim]) w?.terminate();
  }
}
