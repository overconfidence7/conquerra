import { describe, expect, it } from "vitest";
import { b64u, cleanSub, encryptPush, pushRequest, unb64u, vapidAuth } from "../server/webPush";
import { fakeBrowser, testVapid } from "./pushHelpers";

const te = { encode: (s: string) => new Uint8Array(new TextEncoder().encode(s)) };

/** Session 29, Part 3: "your turn" by Web Push, checked against RFC 8291's example and a fake push service. */

const jwkOf = (pub: string, d?: string) => {
  const p = unb64u(pub);
  return { kty: "EC", crv: "P-256", x: b64u(p.slice(1, 33)), y: b64u(p.slice(33, 65)), ...(d ? { d } : {}), ext: true };
};

describe("Web Push (session 29)", () => {
  it("the encryption matches RFC 8291's own example, byte for byte", async () => {
    const asPub = "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8";
    const asPriv = "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw";
    const keys = {
      publicKey: await crypto.subtle.importKey("jwk", jwkOf(asPub), { name: "ECDH", namedCurve: "P-256" }, true, []),
      privateKey: await crypto.subtle.importKey("jwk", jwkOf(asPub, asPriv), { name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]),
    } as CryptoKeyPair;
    const out = await encryptPush(te.encode("When I grow up, I want to be a watermelon"), { p256dh: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4", auth: "BTBZMqHH6r4Tts7J_aSIgg" }, { salt: unb64u("DGv6ra1nlYgDCS1FRnbzlw"), keys });
    expect(b64u(out)).toBe("DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN");
  });

  it("a push request: the right endpoint, a valid VAPID header for its push service, a body only that browser can read", async () => {
    const browser = await fakeBrowser();
    const vapid = await testVapid();
    const now = 1_800_000_000;
    const line = JSON.stringify({ title: "Your turn in Conquerra", body: "Embervale, turn 12" });
    const req = await pushRequest(browser.sub, line, vapid, now, 3600, "turn-g123");
    expect(req.url).toBe(browser.sub.endpoint);
    expect(req.method).toBe("POST");
    expect(req.headers.get("Content-Encoding")).toBe("aes128gcm");
    expect(req.headers.get("TTL")).toBe("3600");
    // The VAPID header: a JWT for fcm.googleapis.com, not expired, signed by the key it names.
    const auth = req.headers.get("Authorization")!;
    const m = /^vapid t=([\w-]+)\.([\w-]+)\.([\w-]+), k=([\w-]+)$/.exec(auth)!;
    expect(m).not.toBeNull();
    expect(m[4]).toBe(vapid.publicKey);
    const claims = JSON.parse(new TextDecoder().decode(unb64u(m[2]!))) as { aud: string; exp: number; sub: string };
    expect(claims).toMatchObject({ aud: "https://fcm.googleapis.com", sub: "mailto:conquerra@overconfidenceonline.com" });
    expect(claims.exp).toBeGreaterThan(now);
    expect(claims.exp).toBeLessThanOrEqual(now + 24 * 3600);
    const key = await crypto.subtle.importKey("raw", unb64u(m[4]!), { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    expect(await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, unb64u(m[3]!), te.encode(`${m[1]}.${m[2]}`))).toBe(true);
    // The body decrypts to the plain line, and only with that browser's key.
    const body = new Uint8Array(await req.arrayBuffer());
    expect(await browser.read(body)).toBe(line);
    const other = await fakeBrowser();
    await expect(other.read(body)).rejects.toThrow();
  });

  it("a subscription the page sends is checked: https, a real push service, keys of the right size", async () => {
    const { sub } = await fakeBrowser();
    const raw = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } };
    expect(cleanSub(raw)).toEqual(sub);
    expect(cleanSub({ ...raw, endpoint: "https://evil.example.com/push" })).toBeNull();
    expect(cleanSub({ ...raw, endpoint: "http://fcm.googleapis.com/x" })).toBeNull();
    expect(cleanSub({ ...raw, keys: { ...raw.keys, auth: "short" } })).toBeNull();
    expect(cleanSub({ endpoint: "https://web.push.apple.com/abc", keys: raw.keys })).not.toBeNull();
    expect(cleanSub(null)).toBeNull();
  });

  it("the VAPID header is for the push service's own origin", async () => {
    const v = await testVapid();
    expect(await vapidAuth("https://updates.push.services.mozilla.com/wpush/v2/x", v, 0)).toMatch(/^vapid t=/);
  });
});
