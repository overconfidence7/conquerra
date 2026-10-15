import { expect } from "vitest";
import { b64u, unb64u, type PushSub, type Vapid } from "../server/webPush";

/** Session 29: a browser and a VAPID key for the push tests (the real key is a Wrangler secret nobody reads back). */

/** A browser, as a test: its key pair and auth secret, and how it reads a message (RFC 8291 in reverse). */
export async function fakeBrowser() {
  const keys = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const pub = new Uint8Array((await crypto.subtle.exportKey("raw", keys.publicKey)) as ArrayBuffer);
  const auth = crypto.getRandomValues(new Uint8Array(16));
  const sub: PushSub = { endpoint: "https://fcm.googleapis.com/fcm/send/abc123", p256dh: b64u(pub), auth: b64u(auth) };
  const read = async (body: Uint8Array) => decrypt(body, keys.privateKey, pub, auth);
  return { sub, read };
}

async function hmac(key: Uint8Array, data: Uint8Array) {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
}
const cat = (...xs: Uint8Array[]) => {
  const o = new Uint8Array(xs.reduce((n, x) => n + x.length, 0));
  let i = 0;
  for (const x of xs) (o.set(x, i), (i += x.length));
  return o;
};
const te = { encode: (s: string) => new Uint8Array(new TextEncoder().encode(s)) };
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, n: number) {
  return (await hmac(await hmac(salt, ikm), cat(info, new Uint8Array([1])))).slice(0, n);
}
async function decrypt(body: Uint8Array, uaPrivate: CryptoKey, uaPublic: Uint8Array, auth: Uint8Array): Promise<string> {
  const salt = body.slice(0, 16);
  const idlen = body[20]!;
  const asPublic = body.slice(21, 21 + idlen);
  const sealed = body.slice(21 + idlen);
  const asKey = await crypto.subtle.importKey("raw", asPublic, { name: "ECDH", namedCurve: "P-256" }, true, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: asKey } as never, uaPrivate, 256));
  const ikm = await hkdf(auth, shared, cat(te.encode("WebPush: info\0"), uaPublic, asPublic), 32);
  const cek = await hkdf(salt, ikm, te.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, te.encode("Content-Encoding: nonce\0"), 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, sealed));
  expect(plain.at(-1)).toBe(2);
  return new TextDecoder().decode(plain.slice(0, -1));
}

/** A VAPID key made for the test (the real one is a Wrangler secret nobody reads back). */
export async function testVapid(): Promise<Vapid> {
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey("jwk", pair.privateKey)) as JsonWebKey;
  const pub = new Uint8Array((await crypto.subtle.exportKey("raw", pair.publicKey)) as ArrayBuffer);
  return { publicKey: b64u(pub), privateKey: jwk.d!, subject: "mailto:conquerra@overconfidenceonline.com" };
}

