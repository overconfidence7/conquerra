import { readVersionReply, type Freshness } from "../logic/freshness";
import { useUpdates } from "./UpdatePrompt";

/**
 * Is this the latest build? (Session 21, Step 0.) The checks behind "Update ready", "A new version is ready" and
 * "Sign in again": loaded a moment after the page opens, so they're not part of the first download.
 */

/** A newer build is live: how long the offline cache gets to fetch it before we offer a plain reload instead. */
const WAIT_FOR_UPDATE_MS = 5000;
/** ...and how long at most while it's still downloading (the first visit after a big update fetches every map). */
const WAIT_WHILE_INSTALLING_MS = 30000;

const RUNNING = typeof __BUILD__ === "string" ? __BUILD__ : "dev";


/** Which build is live, asked of the server past every cache, with the login cookie (session 21). */
async function askServer(): Promise<Freshness> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store", credentials: "include", redirect: "manual" });
    let body: unknown = null;
    if (res.ok) body = await res.json().catch(() => null);
    return readVersionReply(res, body, RUNNING);
  } catch {
    return { kind: "unknown" };
  }
}

let waiting: ReturnType<typeof setTimeout> | null = null;

/**
 * Compare the running build with the live one. Signed out: say so. Newer: give the offline cache a few seconds (longer
 * while it's still downloading) to bring the update in, which shows "Update ready"; if it doesn't, offer a reload.
 */
export async function checkFreshness() {
  const answer = await askServer();
  const st = useUpdates.getState();
  if (answer.kind === "signIn") return st.set({ notice: "signIn" });
  // Session 31: the newest build is the one running, so nothing is ready to switch to ("Update ready" hides too).
  if (answer.kind === "current") return st.set({ notice: null, apply: null });
  if (answer.kind !== "newer" || st.apply || waiting) return;
  const started = Date.now();
  const wait = () => {
    waiting = setTimeout(() => {
      waiting = null;
      const { apply, reg } = useUpdates.getState();
      if (apply) return;
      if (reg?.installing && Date.now() - started < WAIT_WHILE_INSTALLING_MS) return wait();
      useUpdates.getState().set({ notice: "newer" });
    }, WAIT_FOR_UPDATE_MS);
  };
  wait();
}

/** Ask the server for a new version now (the diagnostics view's button, opening the app, every 30 minutes). */
export async function checkForUpdate() {
  const { reg } = useUpdates.getState();
  if (!navigator.onLine) return;
  useUpdates.getState().set({ lastCheck: Date.now() });
  if (reg) {
    try {
      await reg.update();
    } catch {
      // Behind Access with the login expired, the worker's own check gets the sign-in redirect and fails: the version
      // check below finds out which it was (signed out, or just offline).
    }
  }
  await checkFreshness();
}

/**
 * Reload into the newest build. With an update waiting, switch to it; otherwise (the offline cache never got it)
 * let go of the old offline copy first, so the reload comes from the server.
 */
export async function reloadFresh() {
  const { apply } = useUpdates.getState();
  if (apply) return apply(true);
  try {
    const regs = await navigator.serviceWorker?.getRegistrations();
    await Promise.all((regs ?? []).map((r) => r.unregister()));
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  } catch {
    // Reload anyway.
  }
  location.reload();
}

