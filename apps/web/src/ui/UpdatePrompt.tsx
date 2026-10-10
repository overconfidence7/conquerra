import { useEffect, useState } from "react";
import { create } from "zustand";
import { SIGN_IN_PATH } from "../logic/freshness";
import { Frame } from "./Frame";

/** How often an open game looks for a new version (the installed app can stay open for days). */
const CHECK_EVERY_MS = 30 * 60 * 1000;
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

/** Ask the server for a new version now (the diagnostics view's button, opening the app, every 30 minutes). */
export const checkForUpdate = () => import("./updateCheck").then((m) => m.checkForUpdate());
/** Compare the running build with the live one (loaded a moment after the page opens: not in the first download). */
const checkFreshness = () => import("./updateCheck").then((m) => m.checkFreshness());
const reloadFresh = () => import("./updateCheck").then((m) => m.reloadFresh());

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
