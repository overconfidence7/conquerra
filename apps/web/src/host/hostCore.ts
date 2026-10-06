import type { MapDef } from "@conquerra/content";
import { readSave, type Instruction, type Order, type PlayerId, type SaveFile } from "@conquerra/engine";
import { LocalGame } from "./localGame";
import type { HostStart, HostUpdate, LobbySettings, LoadSource } from "./protocol";
import { saveErrorFor, type SaveStore, type SlotId, type SlotInfo } from "./saves";

/** How long your queue must be still before the autosave keeps it (ms). */
export const QUEUE_SAVE_MS = 1500;

/**
 * Everything the single-player host does, in one place: the game, its turn timer's deadline, and saving it on the
 * device. The Web Worker forwards the page's requests here; tests run it in-process with a memory store.
 */
export class HostCore {
  game: LocalGame | null = null;
  /** The autosave being written (tests wait for it). */
  private writing: Promise<void> = Promise.resolve();
  /** Your queue changed: the autosave is written again once it's been still for a moment (Continue keeps it). */
  private queuedTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly store: SaveStore,
    private readonly loadMap: (id: string) => Promise<MapDef>,
    /** Tell the page something went wrong in the background (an autosave that couldn't be written). */
    private readonly notice: (message: string) => void = () => {},
    private readonly now: () => number = () => Date.now(),
  ) {}

  private get g(): LocalGame {
    if (!this.game) throw new Error("No game running");
    return this.game;
  }

  /** The game saves itself at the start of every turn's planning; one that's over is no longer offered to Continue. */
  private autosave = (save: SaveFile) => {
    this.writing = this.writing.then(() =>
      this.store.put("auto", save).then(
        () => undefined,
        (e) => this.notice(`Autosave: ${saveErrorFor(e).message}`),
      ),
    );
  };

  /** After every turn: a finished game leaves the Continue button. */
  private afterTurn<T>(u: T): T {
    // The new turn's autosave is already on its way; a queue saved for the old turn would be stale.
    if (this.queuedTimer) clearTimeout(this.queuedTimer);
    this.queuedTimer = null;
    if (this.game?.over) this.writing = this.writing.then(() => this.store.remove("auto").catch(() => undefined));
    return u;
  }

  /** Wait for any save being written (tests). */
  flush(): Promise<void> {
    return this.writing;
  }

  async start(settings: LobbySettings, seed: string): Promise<HostStart> {
    // Only this map's data is fetched, when the game starts.
    this.game = new LocalGame(await this.loadMap(settings.mapId), settings, seed, this.now, { autosave: this.autosave });
    return this.game.start();
  }

  /** Carry on from a slot (the autosave is Continue) or from a file's text. Throws a plain sentence if it can't. */
  async load(source: LoadSource): Promise<HostStart> {
    let raw: unknown;
    if ("slot" in source) {
      try {
        raw = await this.store.get(source.slot);
      } catch (e) {
        throw saveErrorFor(e, true);
      }
      if (raw === null) throw new Error("That save slot is empty.");
    } else {
      try {
        raw = JSON.parse(source.file);
      } catch {
        throw new Error("This file isn't a Conquerra save.");
      }
    }
    const read = readSave(raw);
    if (!read.ok) throw new Error(read.why);
    let map: MapDef | undefined;
    try {
      map = await this.loadMap(read.save.mapId);
    } catch {
      map = undefined;
    }
    if (!map) throw new Error("This save's map isn't in this version of the game, so it can't be loaded.");
    const game = LocalGame.restore(map, read.save, this.now, this.autosave);
    this.game = game;
    return game.start();
  }

  /** Save the game as it stands into one of your slots. */
  async saveTo(slot: SlotId): Promise<SlotInfo> {
    try {
      return await this.store.put(slot, this.g.snapshot());
    } catch (e) {
      throw saveErrorFor(e);
    }
  }

  /** "Save to a file": the same save, for the page to download (and `pnpm sim --replay` to play back). */
  exportSave(notes?: Record<string, string>): SaveFile {
    return this.g.snapshot(notes);
  }

  lockIn = (orders: Order[], turn: number): HostUpdate => this.afterTurn(this.g.lockIn(orders, turn));
  watchNext = (orders?: Order[]): HostUpdate => this.afterTurn(this.g.watchNext(orders));
  finish = (): HostUpdate => this.afterTurn(this.g.finish());
  /**
   * Your orders as you build them. They lock in if time runs out, and the autosave keeps them (so Continue puts them
   * back): written once the queue has been still for `QUEUE_SAVE_MS`, here in the background, so tapping never waits.
   */
  saveOrders = (orders: Order[], turn: number, paused: PlayerId[] = [], now = false) => {
    if (!this.game?.saveOrders(orders, turn, paused)) return;
    if (this.queuedTimer) clearTimeout(this.queuedTimer);
    if (now) this.saveQueued();
    else this.queuedTimer = setTimeout(() => this.saveQueued(), QUEUE_SAVE_MS);
  };

  /** Write the autosave with your queue now (the timer's job; tests call it straight away). */
  saveQueued() {
    if (this.queuedTimer) clearTimeout(this.queuedTimer);
    this.queuedTimer = null;
    if (this.game && !this.game.over) this.autosave(this.game.snapshot());
  }
  suggest = (): Order[] => this.g.suggest();
  planGenerals = (instructions: Record<PlayerId, Instruction | null>): Order[] => this.g.generalOrders(instructions);
  pause = (): HostUpdate => this.g.pause();
  resume = (): HostUpdate => this.g.resume();

  /** The timer: when to check next, and (once it's passed) your saved orders locked in for you. */
  get nextDeadline(): number | null {
    return this.game?.nextDeadline ?? null;
  }
  expireIfDue = (): HostUpdate | null => {
    const u = this.game?.expireIfDue() ?? null;
    return u ? this.afterTurn(u) : null;
  };
}
