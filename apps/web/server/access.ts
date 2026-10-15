/**
 * Sign-in is Cloudflare Access, nothing else (session 26). Access stands in front of the whole site: nobody reaches
 * the Worker without signing in with Google, and every request that does carries a token Access signed
 * (`Cf-Access-Jwt-Assertion`). The Worker still checks that token on every API call and WebSocket (so a mistake in
 * the Access settings can't open the API): signed by our team's keys, for our Access app (its AUD tag), not expired.
 * The email in it is the account. No sign-up form, no passwords.
 *
 * Plain WebCrypto (the same in Workers, Node and the browser), so it has its own test with a key pair the test makes.
 */

export interface AccessConfig {
  /** The team domain: `keel-nkurtz.cloudflareaccess.com`. */
  team: string;
  /** The Access app's AUD tag (the Wrangler variable `ACCESS_AUD`). */
  aud: string;
}

export interface SignedIn {
  email: string;
  /** Access's id for the person. */
  sub: string;
}

export type AccessResult = { ok: true; user: SignedIn } | { ok: false; why: string };

/** A JSON Web Key as Access publishes them (RSA, with a key id). */
export interface AccessKey extends JsonWebKey {
  kid?: string;
}

/** Where Access publishes the team's signing keys. */
export const certsUrl = (team: string) => `https://${team}/cdn-cgi/access/certs`;

const decoder = new TextDecoder();

function base64url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function json(part: string): Record<string, unknown> | null {
  try {
    const v = JSON.parse(decoder.decode(base64url(part))) as unknown;
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** How much a clock may disagree with Access's (s). */
const LEEWAY_S = 60;

/**
 * Check an Access token. `keys(refresh)` gives the team's current signing keys (`refresh`: the token names a key we
 * don't have, so fetch them again: Access rotates them).
 */
export async function verifyAccess(token: string | null, cfg: AccessConfig, keys: (refresh: boolean) => Promise<AccessKey[]>, nowMs: number, cache?: AccessCache): Promise<AccessResult> {
  if (!token) return { ok: false, why: "missing" };
  if (!cfg.aud) return { ok: false, why: "no audience set" };
  // Session 29: a token already checked in this isolate is the same person until it expires (RS256 on every call cost
  // the Worker most of its 10 ms).
  const tag = cache ? await sha256(`${cfg.team}|${cfg.aud}|${token}`) : "";
  const known = cache?.identity(tag, nowMs);
  if (known) return { ok: true, user: known };
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, why: "malformed" };
  const [h, p, sig] = parts as [string, string, string];
  const header = json(h);
  const claims = json(p);
  if (!header || !claims) return { ok: false, why: "malformed" };
  if (header.alg !== "RS256") return { ok: false, why: "wrong algorithm" };
  let all = await keys(false);
  let jwk = all.find((k) => k.kid === header.kid);
  if (!jwk) {
    all = await keys(true);
    jwk = all.find((k) => k.kid === header.kid);
  }
  if (!jwk) return { ok: false, why: "unknown key" };
  let good = false;
  try {
    const key = (await cache?.key(jwk)) ?? (await importRsa(jwk));
    good = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, base64url(sig), new TextEncoder().encode(`${h}.${p}`));
  } catch {
    good = false;
  }
  if (!good) return { ok: false, why: "bad signature" };
  if (claims.iss !== `https://${cfg.team}`) return { ok: false, why: "wrong issuer" };
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(cfg.aud)) return { ok: false, why: "wrong audience" };
  const now = nowMs / 1000;
  if (typeof claims.exp !== "number" || claims.exp + LEEWAY_S < now) return { ok: false, why: "expired" };
  if (typeof claims.nbf === "number" && claims.nbf - LEEWAY_S > now) return { ok: false, why: "not yet valid" };
  if (typeof claims.email !== "string" || !claims.email.includes("@")) return { ok: false, why: "no email" };
  const user = { email: claims.email.toLowerCase(), sub: typeof claims.sub === "string" ? claims.sub : "" };
  // (Only a token that passed every check is kept, and only until it expires.)
  cache?.remember(tag, user, claims.exp * 1000);
  return { ok: true, user };
}

const importRsa = (jwk: AccessKey) => crypto.subtle.importKey("jwk", { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true }, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** At most this many checked tokens are remembered (the oldest go first). */
export const ACCESS_CACHE_MAX = 500;

/**
 * Session 29: what one Worker isolate remembers between requests, in memory only: each token that passed the check
 * (by its SHA-256, never the token itself) with the person in it, until the token's own expiry, and the team's public
 * keys once imported. A failed check is never remembered, so a bad token is checked in full every time.
 */
export class AccessCache {
  private ids = new Map<string, { user: SignedIn; until: number }>();
  private keys = new Map<string, Promise<CryptoKey>>();

  identity(tag: string, nowMs: number): SignedIn | null {
    const hit = this.ids.get(tag);
    if (!hit) return null;
    if (nowMs >= hit.until) {
      this.ids.delete(tag);
      return null;
    }
    return hit.user;
  }

  remember(tag: string, user: SignedIn, until: number) {
    this.ids.delete(tag);
    while (this.ids.size >= ACCESS_CACHE_MAX) this.ids.delete(this.ids.keys().next().value!);
    this.ids.set(tag, { user, until });
  }

  /** The key, imported once (by its id and modulus: a rotated key with the same id is a new key). */
  key(jwk: AccessKey): Promise<CryptoKey> {
    const id = `${jwk.kid ?? ""}|${jwk.n ?? ""}`;
    let k = this.keys.get(id);
    if (!k) {
      k = importRsa(jwk);
      // (A key that fails to import isn't kept.)
      k.catch(() => this.keys.delete(id));
      if (this.keys.size >= 20) this.keys.clear();
      this.keys.set(id, k);
    }
    return k;
  }

  get size(): number {
    return this.ids.size;
  }
}

/** The team's keys from Access, kept for an hour (and fetched again when a token names a new one). */
export function accessKeys(team: string, fetcher: typeof fetch = fetch) {
  let cache: { keys: AccessKey[]; at: number } | null = null;
  return async (refresh: boolean): Promise<AccessKey[]> => {
    if (cache && !refresh && Date.now() - cache.at < 3600_000) return cache.keys;
    const res = await fetcher(certsUrl(team));
    if (!res.ok) throw new Error(`Access keys: ${res.status}`);
    const body = (await res.json()) as { keys?: AccessKey[] };
    cache = { keys: Array.isArray(body.keys) ? body.keys : [], at: Date.now() };
    return cache.keys;
  };
}
