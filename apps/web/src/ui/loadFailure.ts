/**
 * A part of the game that fails to load (session 28): usually a file from the build before a deploy. The page reloads
 * once to pick up the new build; if that fails too, it says so in one plain line instead of going blank. The time of
 * the last reload sits in sessionStorage, so a page can never reload itself in a loop.
 */
export const LOAD_FAILED = "Something didn't load. Reload the page.";
const KEY = "conquerra-reloaded";
/** A failure this soon after the last reload is the same failure again: say so, don't reload. */
const AGAIN_MS = 30_000;

export function onLoadFailure(now: number, store: Pick<Storage, "getItem" | "setItem">): "reload" | "tell" {
  let last = 0;
  try {
    last = Number(store.getItem(KEY)) || 0;
  } catch {
    // No storage: tell, never risk a loop.
    return "tell";
  }
  if (now - last < AGAIN_MS) return "tell";
  try {
    store.setItem(KEY, String(now));
  } catch {
    return "tell";
  }
  return "reload";
}

export function watchLoadFailures() {
  window.addEventListener("vite:preloadError", (e) => {
    if (onLoadFailure(Date.now(), sessionStorage) === "reload") {
      e.preventDefault();
      location.reload();
      return;
    }
    if (document.getElementById("load-failed")) return;
    const line = document.createElement("div");
    line.id = "load-failed";
    line.setAttribute("role", "alert");
    line.textContent = LOAD_FAILED;
    document.body.appendChild(line);
  });
}
