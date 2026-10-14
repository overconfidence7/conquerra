import type { AccessKey } from "../server/access";

/** A key pair standing in for Access's (the test signs its own tokens). */
export async function accessKeyPair(kid = "test-key") {
  const pair = (await crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const pub = { ...(await crypto.subtle.exportKey("jwk", pair.publicKey)), kid } as AccessKey;
  const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const enc = (o: unknown) => b64(new TextEncoder().encode(JSON.stringify(o)));
  const sign = async (claims: Record<string, unknown>, header: Record<string, unknown> = { alg: "RS256", kid }) => {
    const body = `${enc(header)}.${enc(claims)}`;
    const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", pair.privateKey, new TextEncoder().encode(body)));
    return `${body}.${b64(sig)}`;
  };
  return { pub, sign };
}

export const TEAM = "keel-nkurtz.cloudflareaccess.com";
export const AUD = "conquerra-aud-tag";
export const NOW = Date.UTC(2026, 9, 13, 12, 0, 0);
export const goodClaims = (now = NOW) => ({ iss: `https://${TEAM}`, aud: [AUD], email: "Nate@Example.com", sub: "user-1", iat: now / 1000 - 10, nbf: now / 1000 - 10, exp: now / 1000 + 3600, type: "app" });
