/**
 * A part of the game that fails to load (session 28): usually a file from the build before a deploy, or a copy the
 * browser kept from a bad answer (before session 28, a missing file was answered with the lobby's HTML under a
 * year-long cache, and the browser and the offline cache kept it). The page throws away its own copies of that file,
 * fetches it fresh past every cache, and reloads once; if it fails again, it says so in one plain line instead of
 * going blank. sessionStorage remembers when each file was last mended, so a page can never reload itself in a loop.
 */
export const LOAD_FAILED = "Something didn't load. Reload the page.";
const KEY = "conquerra-reloaded";
/** A failure of the same file this soon after mending it is the same failure again: say so, don't reload. */
const AGAIN_MS = 30_000;

/** The file a failed import names ("Failed to fetch dynamically imported module: https://…/assets/x.js"). */
export function failedFile(message: string, origin: string): string | null {
  const m = /(https?:\/\/[^\s'"]+?\.(?:js|css|mjs))\b/.exec(message);
  if (!m) return null;
  try {
    const url = new URL(m[1]!);
    return url.origin === origin && url.pathname.startsWith("/assets/") ? url.href : null;
  } catch {
    return null;
  }
}

export function onLoadFailure(now: number, store: Pick<Storage, "getItem" | "setItem">, file = "?"): "reload" | "tell" {
  let seen: Record<string, number> = {};
  try {
    const raw = store.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    seen = parsed && typeof parsed === "object" ? (parsed as Record<string, number>) : {};
  } catch {
    // No storage: tell, never risk a loop.
    return "tell";
  }
  if (now - (seen[file] ?? 0) < AGAIN_MS) return "tell";
  try {
    store.setItem(KEY, JSON.stringify({ ...seen, [file]: now }));
  } catch {
    return "tell";
  }
  return "reload";
}

/** Throw away every copy of a file the page has (the offline cache, the browser's cache) and fetch it fresh. */
async function mend(url: string) {
  try {
    for (const name of await caches.keys()) await (await caches.open(name)).delete(url, { ignoreSearch: true });
  } catch {
    // No offline cache: nothing to throw away.
  }
  try {
    await fetch(url, { cache: "reload", credentials: "same-origin" });
  } catch {
    // Offline: the reload says so.
  }
}

export function watchLoadFailures() {
  window.addEventListener("vite:preloadError", (e) => {
    const err = (e as Event & { payload?: unknown }).payload;
    const file = failedFile(err instanceof Error ? err.message : String(err ?? ""), location.origin);
    if (onLoadFailure(Date.now(), sessionStorage, file ?? "?") === "reload") {
      e.preventDefault();
      void (file ? mend(file) : Promise.resolve()).then(() => location.reload());
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
