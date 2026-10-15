/**
 * "Your turn" by Web Push (session 29), written with WebCrypto alone (the same in Workers, Node and the browser; no new
 * dependency): the room signs each request with its VAPID key (ES256, RFC 8292) and encrypts the message for the one
 * browser that subscribed (RFC 8291, `aes128gcm`), so the push service in between (Google's, Mozilla's, Apple's) can't
 * read it. The message itself is never anything fogged: "Your turn in Conquerra: Embervale, turn 12".
 */

/** A browser's subscription, as the page sent it (its push service's address and the browser's keys). */
export interface PushSub {
  endpoint: string;
  /** The browser's public key (P-256, uncompressed, base64url). */
  p256dh: string;
  /** Its 16-byte auth secret (base64url). */
  auth: string;
}

/** The room's VAPID key: the public half (`VAPID_PUBLIC`, a Wrangler variable) and the private one (a secret). */
export interface Vapid {
  /** Uncompressed P-256 point, base64url (what the page gives `pushManager.subscribe`). */
  publicKey: string;
  /** The private scalar `d`, base64url. */
  privateKey: string;
  /** Who to contact about these pushes. */
  subject: string;
}

export function b64u(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function unb64u(text: string): Bytes {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Bytes on their own buffer (what WebCrypto takes). */
type Bytes = Uint8Array<ArrayBuffer>;

const enc = new TextEncoder();
const utf8 = (s: string): Bytes => new Uint8Array(enc.encode(s));
const concat = (...parts: Bytes[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) (out.set(p, at), (at += p.length));
  return out;
};

async function hmac(key: Bytes, data: Bytes): Promise<Bytes> {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}

/** HKDF in two steps (RFC 5869), one block of output. */
async function hkdf(salt: Bytes, ikm: Bytes, info: Bytes, length: number): Promise<Bytes> {
  const prk = await hmac(salt, ikm);
  return (await hmac(prk, concat(info, new Uint8Array([1])))).slice(0, length);
}

/** A P-256 public key from its uncompressed point (65 bytes). */
const ecPublic = (raw: Bytes, use: "ECDH" | "ECDSA") => crypto.subtle.importKey("raw", raw, use === "ECDH" ? { name: "ECDH", namedCurve: "P-256" } : { name: "ECDSA", namedCurve: "P-256" }, true, use === "ECDH" ? [] : ["verify"]);

/** The VAPID private key as WebCrypto wants it (a JWK: `d` with the public point's x and y). */
export function vapidKey(v: Vapid): Promise<CryptoKey> {
  const pub = unb64u(v.publicKey);
  return crypto.subtle.importKey("jwk", { kty: "EC", crv: "P-256", d: v.privateKey, x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)), ext: true }, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

/** The `Authorization` header (RFC 8292): a JWT for the push service's origin, signed ES256, with our public key. */
export async function vapidAuth(endpoint: string, v: Vapid, nowSec: number): Promise<string> {
  const aud = new URL(endpoint).origin;
  const head = b64u(utf8(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = b64u(utf8(JSON.stringify({ aud, exp: nowSec + 12 * 3600, sub: v.subject })));
  // (WebCrypto's ECDSA signature is r and s side by side: exactly what a JWT's ES256 wants.)
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, await vapidKey(v), utf8(`${head}.${body}`)));
  return `vapid t=${head}.${body}.${b64u(sig)}, k=${v.publicKey}`;
}

/**
 * The message, encrypted for one browser (RFC 8291 with RFC 8188's `aes128gcm`, one record): a fresh key pair and salt
 * each time (`fixed`: the tests pass their own, to check against the RFC's example).
 */
export async function encryptPush(payload: Bytes, sub: Pick<PushSub, "p256dh" | "auth">, fixed?: { salt: Bytes; keys: CryptoKeyPair }): Promise<Bytes> {
  const uaPublic = unb64u(sub.p256dh);
  const authSecret = unb64u(sub.auth);
  const keys = fixed?.keys ?? ((await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair);
  const asPublic = new Uint8Array((await crypto.subtle.exportKey("raw", keys.publicKey)) as ArrayBuffer);
  // (Workers' own types spell the ECDH peer key `$public`; the runtime, like every browser, takes the standard `public`.)
  const ecdh = { name: "ECDH", public: await ecPublic(uaPublic, "ECDH") } as unknown as Parameters<typeof crypto.subtle.deriveBits>[0];
  const shared = new Uint8Array(await crypto.subtle.deriveBits(ecdh, keys.privateKey, 256));
  const ikm = await hkdf(authSecret, shared, concat(utf8("WebPush: info\0"), uaPublic, asPublic), 32);
  const salt = fixed?.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, utf8("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, utf8("Content-Encoding: nonce\0"), 12);
  // One record, the last: the message, then the padding delimiter 2.
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, concat(payload, new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 16, 0]);
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, sealed);
}

/** The push services browsers use (the room only ever sends to one of these). */
const PUSH_HOSTS = [/\.googleapis\.com$/, /\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/, /^web\.push\.apple\.com$/, /\.push\.apple\.com$/];

/** A subscription the page sent, checked: https, a known push service, keys of the right size. Null if not. */
export function cleanSub(raw: unknown): PushSub | null {
  const s = raw as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | null;
  if (!s || typeof s.endpoint !== "string" || s.endpoint.length > 1000 || typeof s.keys?.p256dh !== "string" || typeof s.keys?.auth !== "string") return null;
  let url: URL;
  try {
    url = new URL(s.endpoint);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !PUSH_HOSTS.some((h) => h.test(url.hostname))) return null;
  try {
    if (unb64u(s.keys.p256dh).length !== 65 || unb64u(s.keys.auth).length !== 16) return null;
  } catch {
    return null;
  }
  return { endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth };
}

/** One push: the request a push service expects. `ttl`: how long it may wait to reach a phone that's off (s). */
export async function pushRequest(sub: PushSub, message: string, v: Vapid, nowSec: number, ttl: number, topic?: string): Promise<Request> {
  const body = await encryptPush(utf8(message), sub);
  return new Request(sub.endpoint, {
    method: "POST",
    headers: {
      Authorization: await vapidAuth(sub.endpoint, v, nowSec),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(ttl),
      Urgency: "normal",
      // (A newer "your turn" for the same game replaces one the phone hasn't shown yet.)
      ...(topic ? { Topic: topic.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32) } : {}),
    },
    body,
  });
}
