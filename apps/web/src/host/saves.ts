import type { SaveFile } from "@conquerra/engine";
import { SLOTS, type SlotId, type SlotInfo } from "./slots";

export { SLOTS, type SlotId, type SlotInfo };

/**
 * Saved games on this device (session 13). They live in the browser's own database (IndexedDB) and never leave the
 * device. One slot is the autosave (the game saves itself at the start of every turn's planning: the lobby's
 * Continue), plus a few slots you save to yourself.
 *
 * Storage can fail (a private window, storage switched off, a full disk): every call turns that into a plain
 * message (`SaveError`) instead of breaking the game. The worker writes and reads whole saves; the page only reads
 * the short slot list (map, players, turn, date), never a game's full state.
 */

export interface SaveStore {
  put(slot: SlotId, save: SaveFile): Promise<SlotInfo>;
  /** The save as stored (raw: read it with `readSave`), or null if the slot is empty. */
  get(slot: SlotId): Promise<unknown>;
  list(): Promise<SlotInfo[]>;
  remove(slot: SlotId): Promise<void>;
}

/** Storage went wrong; `message` is a sentence for the player. */
export class SaveError extends Error {}

export const SAVE_ERRORS = {
  unavailable: "Saving isn't available here (a private window, or storage is switched off). Use Save to a file instead.",
  full: "There's no room left on this device to save the game. Free some space, or use Save to a file.",
  failed: "The game couldn't be saved on this device. Use Save to a file instead.",
  readFailed: "Saved games couldn't be read on this device. If you saved one to a file, Load a file still works.",
} as const;

const infoOf = (slot: SlotId, save: SaveFile): SlotInfo => ({ slot, savedAt: save.savedAt, summary: save.summary });

/** Turn whatever the browser threw into one of our sentences. */
export function saveErrorFor(e: unknown, reading = false): SaveError {
  if (e instanceof SaveError) return e;
  const name = (e as { name?: string } | null)?.name ?? "";
  if (name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED") return new SaveError(SAVE_ERRORS.full);
  if (name === "InvalidStateError" || name === "SecurityError" || name === "UnknownError") return new SaveError(SAVE_ERRORS.unavailable);
  return new SaveError(reading ? SAVE_ERRORS.readFailed : SAVE_ERRORS.failed);
}

const DB = "conquerra";
const SAVES = "saves";
const INFO = "slots";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let req: IDBOpenDBRequest;
    try {
      if (typeof indexedDB === "undefined") throw new SaveError(SAVE_ERRORS.unavailable);
      req = indexedDB.open(DB, 1);
    } catch (e) {
      reject(saveErrorFor(e));
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(SAVES)) db.createObjectStore(SAVES);
      if (!db.objectStoreNames.contains(INFO)) db.createObjectStore(INFO);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(saveErrorFor(req.error));
    req.onblocked = () => reject(new SaveError(SAVE_ERRORS.unavailable));
  });
}

function run<T>(mode: IDBTransactionMode, stores: string[], work: (tx: IDBTransaction) => IDBRequest<T> | void, reading = false): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve, reject) => {
        let result: T | undefined;
        let tx: IDBTransaction;
        try {
          tx = db.transaction(stores, mode);
          const req = work(tx);
          if (req) req.onsuccess = () => (result = req.result);
        } catch (e) {
          db.close();
          reject(saveErrorFor(e, reading));
          return;
        }
        tx.oncomplete = () => (db.close(), resolve(result));
        tx.onerror = () => (db.close(), reject(saveErrorFor(tx.error, reading)));
        tx.onabort = () => (db.close(), reject(saveErrorFor(tx.error, reading)));
      }),
  );
}

/** The browser's database. */
export function idbSaveStore(): SaveStore {
  return {
    async put(slot, save) {
      const info = infoOf(slot, save);
      await run("readwrite", [SAVES, INFO], (tx) => {
        tx.objectStore(SAVES).put(save, slot);
        tx.objectStore(INFO).put(info, slot);
      });
      return info;
    },
    get: (slot) => run<unknown>("readonly", [SAVES], (tx) => tx.objectStore(SAVES).get(slot), true).then((x) => x ?? null),
    async list() {
      const all = await run<SlotInfo[]>("readonly", [INFO], (tx) => tx.objectStore(INFO).getAll() as IDBRequest<SlotInfo[]>, true);
      return sortSlots(all ?? []);
    },
    remove: (slot) =>
      run("readwrite", [SAVES, INFO], (tx) => {
        tx.objectStore(SAVES).delete(slot);
        tx.objectStore(INFO).delete(slot);
      }).then(() => undefined),
  };
}

/** For tests (and anywhere without a database): the same behaviour, in memory. */
export function memorySaveStore(): SaveStore {
  const saves = new Map<SlotId, string>();
  return {
    async put(slot, save) {
      saves.set(slot, JSON.stringify(save));
      return infoOf(slot, save);
    },
    async get(slot) {
      const s = saves.get(slot);
      return s ? (JSON.parse(s) as unknown) : null;
    },
    async list() {
      return sortSlots([...saves].map(([slot, s]) => infoOf(slot, JSON.parse(s) as SaveFile)));
    },
    async remove(slot) {
      saves.delete(slot);
    },
  };
}

/** The autosave first, then the slots in order. */
const sortSlots = (list: SlotInfo[]) => [...list].sort((a, b) => order(a.slot) - order(b.slot));
const order = (s: SlotId) => (s === "auto" ? -1 : SLOTS.indexOf(s));

/** The page's view of the slots (lobby, Save/Load): never the games themselves. Empty if storage isn't available. */
export async function listSlots(store: SaveStore = idbSaveStore()): Promise<{ slots: SlotInfo[]; problem: string | null }> {
  try {
    return { slots: await store.list(), problem: null };
  } catch (e) {
    return { slots: [], problem: saveErrorFor(e, true).message };
  }
}
