import { useEffect, useState } from "react";
import { create } from "zustand";
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
  set(patch: Partial<Omit<UpdateState, "set">>): void;
}

export const useUpdates = create<UpdateState>((set) => ({ reg: null, apply: null, lastCheck: null, set: (patch) => set(patch) }));

/** Ask the server for a new version now (the diagnostics view's button, opening the app, every 30 minutes). */
export async function checkForUpdate() {
  const { reg } = useUpdates.getState();
  if (!reg || !navigator.onLine) return;
  useUpdates.getState().set({ lastCheck: Date.now() });
  try {
    await reg.update();
  } catch {
    // Offline or signed out of the preview: try again later.
  }
}

/**
 * "Update ready": when a new version of the game has been downloaded, say so and let the player choose when to
 * switch (a reload). Never reloads by itself, so a game in progress is never broken. The installed app looks for a
 * new version when it opens, when it comes back to the front, and every 30 minutes.
 */
export function UpdatePrompt() {
  const apply = useUpdates((s) => s.apply);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;
    let live = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    const onShow = () => document.visibilityState === "visible" && void checkForUpdate();
    void import("virtual:pwa-register").then(({ registerSW }) => {
      const updateSW = registerSW({
        onNeedRefresh: () => {
          if (!live) return;
          useUpdates.getState().set({ apply: updateSW });
          setHidden(false);
        },
        onRegisteredSW: (_url, reg) => {
          if (!live || !reg) return;
          useUpdates.getState().set({ reg, lastCheck: Date.now() });
          timer = setInterval(() => void checkForUpdate(), CHECK_EVERY_MS);
          document.addEventListener("visibilitychange", onShow);
        },
      });
    });
    return () => {
      live = false;
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, []);
  if (!apply || hidden) return null;
  return (
    <Frame className="slim update-prompt" role="status">
      <span>Update ready.</span>
      <button className="primary" onClick={() => void apply(true)}>
        Update now
      </button>
      <button onClick={() => setHidden(true)}>Later</button>
    </Frame>
  );
}
