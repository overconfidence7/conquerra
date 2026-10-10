/**
 * Is this the latest version of the game? (Session 21, Step 0.) The preview sits behind Cloudflare Access: once the
 * login cookie expires, every request the app makes gets Access's sign-in redirect instead of the file it asked for,
 * including the service worker's own update check, which then fails without a word, so an old build can be served
 * from the offline cache for weeks. So on every load the app also asks the server which build is live
 * (`version.json`, written by the build and never cached) and reads the answer here.
 */

/** What the server said about `version.json`, in the parts that matter (a `Response` fits). */
export interface VersionReply {
  /** "opaqueredirect" when fetched with `redirect: "manual"` and the server redirected (Access's sign-in). */
  type: string;
  status: number;
  ok: boolean;
}

export type Freshness =
  /** The build running is the build the server has. */
  | { kind: "current" }
  /** The server has a newer build. */
  | { kind: "newer"; live: string }
  /** The login has expired: the server answered with its sign-in, not the file. */
  | { kind: "signIn" }
  /** No answer worth acting on (offline, a server hiccup). */
  | { kind: "unknown" };

/** Read the server's answer about which build is live, against the build that's running. */
export function readVersionReply(reply: VersionReply, body: unknown, running: string): Freshness {
  if (reply.type === "opaqueredirect" || [301, 302, 303, 307, 308, 401, 403].includes(reply.status)) return { kind: "signIn" };
  if (!reply.ok) return { kind: "unknown" };
  const live = body && typeof body === "object" && typeof (body as { build?: unknown }).build === "string" ? (body as { build: string }).build : null;
  // Access's sign-in page served with a 200 (some setups do) isn't JSON with a build in it.
  if (live === null) return { kind: "signIn" };
  return live === running ? { kind: "current" } : { kind: "newer", live };
}

/** Where "Sign in again" goes: the preview's root, with a mark the offline cache lets through to the server. */
export const SIGN_IN_PATH = "/?signin";
/** Navigations the offline cache must always send to the server (the sign-in link, and Access's own pages). */
export const NETWORK_ONLY_NAVIGATIONS = [/[?&]signin\b/, /^\/cdn-cgi\//];
