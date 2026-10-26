import { useState, useSyncExternalStore } from "react";
import { INSTALL_DISMISSED, INSTALL_TEXT, installForm, isIos } from "../logic/install";

/**
 * Session 35: Chrome's install prompt, kept from the moment it's offered (it can come before the lobby is drawn) so
 * the lobby's Install button can open it later. `appinstalled` clears it: the line goes away once the game is installed.
 */
interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
let offered: InstallPrompt | null = null;
let installed = false;
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((f) => f());
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    // (Keep it for the button instead of Chrome's own banner.)
    e.preventDefault();
    offered = e as InstallPrompt;
    changed();
  });
  window.addEventListener("appinstalled", () => {
    offered = null;
    installed = true;
    changed();
  });
}
const subscribe = (f: () => void) => (listeners.add(f), () => listeners.delete(f));

const stored = () => {
  try {
    return !!localStorage.getItem(INSTALL_DISMISSED);
  } catch {
    return false;
  }
};
const standalone = () => installed || window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;

/** The lobby's Install line, under the version label: a button on Android, Safari's two steps on an iPhone, else nothing. */
export function InstallLine() {
  const prompt = useSyncExternalStore(subscribe, () => offered);
  const [dismissed, setDismissed] = useState(stored);
  const form = installForm({ standalone: standalone(), dismissed, prompt: !!prompt, ios: isIos(navigator.userAgent, navigator.maxTouchPoints ?? 0), touch: window.matchMedia?.("(pointer: coarse)").matches ?? false });
  if (form === "none") return null;
  const dismiss = () => {
    try {
      localStorage.setItem(INSTALL_DISMISSED, "1");
    } catch {
      // A private window: it stays away for this visit.
    }
    setDismissed(true);
  };
  return (
    <div className="install-line small">
      {form === "prompt" ? (
        <button
          className="link"
          onClick={() => {
            const p = offered;
            if (!p) return;
            void p.prompt();
            void p.userChoice.then((c) => {
              if (c.outcome === "accepted") (offered = null), changed();
            });
          }}
        >
          {INSTALL_TEXT.line}
        </button>
      ) : (
        <span>
          {INSTALL_TEXT.line}
          <br />
          <span className="muted">{INSTALL_TEXT.ios}</span>
        </span>
      )}
      <button className="link muted" onClick={dismiss}>
        {INSTALL_TEXT.dismiss}
      </button>
    </div>
  );
}
