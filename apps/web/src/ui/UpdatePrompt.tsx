import { useEffect, useState } from "react";
import { create } from "zustand";
import { readVersionReply, SIGN_IN_PATH, type Freshness } from "../logic/freshness";
import { Frame } from "./Frame";

/** How often an open game looks for a new version (the installed app can stay open for days). */
const CHECK_EVERY_MS = 30 * 60 * 1000;
/** A newer build is live: how long the offline cache gets to fetch it before we offer a plain reload instead. */
const WAIT_FOR_UPDATE_MS = 5000;
/** ...and how long at most while it's still downloading (the first visit after a big update fetches every map). */
const WAIT_WHILE_INSTALLING_MS = 30000;

const RUNNING = typeof __BUILD__ === "string" ? __BUILD__ : "dev";

interface UpdateState {
  /** The service worker registration, once the page has one. */
  reg: ServiceWorkerRegistration | null;
  /** A new version is downloaded and waiting: call to switch to it (reloads). */
  apply: ((reload?: boolean) => Promise<void>) | null;
  /** When we last asked the server for a new version. */
  lastCheck: number | null;
  /**
   * What the server last said about the live build (session 21): "signIn" when the preview's login has expired (the
   * update check can't get through then), "newer" when a newer build is live and no update is on its way.
   */
  notice: "signIn" | "newer" | null;
  set(patch: Partial<Omit<UpdateState, "set">>): void;
}

export const useUpdates = create<UpdateState>((set) => ({ reg: null, apply: null, lastCheck: null, notice: null, set: (patch) => set(patch) }));

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
async function checkFreshness() {
  const answer = await askServer();
  const st = useUpdates.getState();
  if (answer.kind === "signIn") return st.set({ notice: "signIn" });
  if (answer.kind === "current") return st.set({ notice: null });
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
async function reloadFresh() {
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

/**
 * "Update ready": when a new version of the game has been downloaded, say so and let the player choose when to
 * switch (a reload). Never reloads by itself, so a game in progress is never broken. The installed app looks for a
 * new version when it opens, when it comes back to the front, and every 30 minutes. Session 21: it also asks the
 * server which build is live, and says "Sign in again" when the preview's login has expired (the update check can't
 * get through then) or "A new version is ready" when the update never arrived.
 */
export function UpdatePrompt() {
  const apply = useUpdates((s) => s.apply);
  const notice = useUpdates((s) => s.notice);
  const [hidden, setHidden] = useState<string | null>(null);
  useEffect(() => {
    if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;
    // "Sign in again" brings you back here: tidy the address.
    if (/[?&]signin\b/.test(location.search)) history.replaceState(null, "", location.pathname);
    let live = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    const onShow = () => document.visibilityState === "visible" && void checkForUpdate();
    void import("virtual:pwa-register").then(({ registerSW }) => {
      const updateSW = registerSW({
        onNeedRefresh: () => {
          if (!live) return;
          useUpdates.getState().set({ apply: updateSW, notice: null });
          setHidden(null);
        },
        onRegisteredSW: (_url, reg) => {
          if (!live || !reg) return;
          useUpdates.getState().set({ reg, lastCheck: Date.now() });
        },
        onRegisterError: () => void checkFreshness(),
      });
    });
    // On every load, whatever the offline cache does.
    void checkFreshness();
    timer = setInterval(() => void checkForUpdate(), CHECK_EVERY_MS);
    document.addEventListener("visibilitychange", onShow);
    return () => {
      live = false;
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, []);
  const which = apply ? "ready" : notice;
  if (!which || hidden === which) return null;
  if (which === "signIn")
    return (
      <Frame className="slim update-prompt" role="status">
        <span>Sign in again to get the latest version.</span>
        <a className="button primary" href={SIGN_IN_PATH}>
          Sign in
        </a>
        <button onClick={() => setHidden(which)}>Later</button>
      </Frame>
    );
  return (
    <Frame className="slim update-prompt" role="status">
      <span>{which === "ready" ? "Update ready." : "A new version is ready."}</span>
      <button className="primary" onClick={() => void reloadFresh()}>
        {which === "ready" ? "Update now" : "Reload"}
      </button>
      <button onClick={() => setHidden(which)}>Later</button>
    </Frame>
  );
}
