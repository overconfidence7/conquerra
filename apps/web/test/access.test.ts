import { describe, expect, it } from "vitest";
import { ACCESS_CACHE_MAX, AccessCache, verifyAccess } from "../server/access";
import { accessKeyPair, AUD, goodClaims, NOW, TEAM } from "./accessHelpers";

describe("sign-in: the Access token check (session 26)", async () => {
  const { pub, sign } = await accessKeyPair();
  let fetched = 0;
  const keys = async () => {
    fetched++;
    return [pub];
  };
  const check = (token: string | null, aud = AUD) => verifyAccess(token, { team: TEAM, aud }, keys, NOW);

  it("a good token: the email is the account", async () => {
    expect(await check(await sign(goodClaims()))).toEqual({ ok: true, user: { email: "nate@example.com", sub: "user-1" } });
  });

  it("no token, or no AUD tag set yet: refused", async () => {
    expect(await check(null)).toEqual({ ok: false, why: "missing" });
    expect(await check(await sign(goodClaims()), "")).toEqual({ ok: false, why: "no audience set" });
  });

  it("a token for another Access app (bad audience): refused", async () => {
    expect(await check(await sign({ ...goodClaims(), aud: ["keel-aud-tag"] }))).toEqual({ ok: false, why: "wrong audience" });
  });

  it("an expired token: refused (a minute's grace for clocks)", async () => {
    expect(await check(await sign({ ...goodClaims(), exp: NOW / 1000 - 120 }))).toEqual({ ok: false, why: "expired" });
    expect((await check(await sign({ ...goodClaims(), exp: NOW / 1000 - 30 }))).ok).toBe(true);
  });

  it("another team's token, a changed token, a wrong algorithm, a key we don't know: refused", async () => {
    expect(await check(await sign({ ...goodClaims(), iss: "https://someone-else.cloudflareaccess.com" }))).toEqual({ ok: false, why: "wrong issuer" });
    const t = await sign(goodClaims());
    const [h, , s] = t.split(".");
    const forged = `${h}.${btoa(JSON.stringify({ ...goodClaims(), email: "intruder@example.com" })).replace(/=+$/, "")}.${s}`;
    expect(await check(forged)).toEqual({ ok: false, why: "bad signature" });
    expect(await check(await sign(goodClaims(), { alg: "none", kid: "test-key" }))).toEqual({ ok: false, why: "wrong algorithm" });
    const before = fetched;
    expect(await check(await sign(goodClaims(), { alg: "RS256", kid: "rotated" }))).toEqual({ ok: false, why: "unknown key" });
    // An unknown key fetches the keys again once (Access rotates them).
    expect(fetched - before).toBe(2);
    expect(await check("not.a.token")).toEqual({ ok: false, why: "malformed" });
  });

  it("another key pair's signature: refused", async () => {
    const other = await accessKeyPair();
    expect(await check(await other.sign(goodClaims()))).toEqual({ ok: false, why: "bad signature" });
  });

  it("session 29: a checked token is remembered until it expires; a failed one never is", async () => {
    const cache = new AccessCache();
    let verified = 0;
    const spy = async () => {
      verified++;
      return [pub];
    };
    const token = await sign({ ...goodClaims(), exp: NOW / 1000 + 600 });
    const at = (ms: number) => verifyAccess(token, { team: TEAM, aud: AUD }, spy, ms, cache);
    expect((await at(NOW)).ok).toBe(true);
    expect(verified).toBe(1);
    // The same token again: no keys, no signature, the same person.
    expect(await at(NOW + 1000)).toEqual({ ok: true, user: { email: "nate@example.com", sub: "user-1" } });
    expect(verified).toBe(1);
    // Past its expiry it's checked in full again (and the minute's grace still applies there).
    expect((await at(NOW + 630_000)).ok).toBe(true);
    expect(verified).toBe(2);
    expect((await at(NOW + 700_000)).ok).toBe(false);
    // A different audience is a different check.
    expect((await verifyAccess(token, { team: TEAM, aud: "other" }, spy, NOW, cache)).ok).toBe(false);
    // A forged token is refused every time (never cached).
    const [h, , s] = token.split(".");
    const forged = `${h}.${btoa(JSON.stringify({ ...goodClaims(), email: "intruder@example.com" })).replace(/=+$/, "")}.${s}`;
    const before = cache.size;
    for (let i = 0; i < 3; i++) expect(await verifyAccess(forged, { team: TEAM, aud: AUD }, spy, NOW, cache)).toEqual({ ok: false, why: "bad signature" });
    expect(cache.size).toBe(before);
  });

  it("session 29: at most 500 tokens are remembered, the oldest going first", () => {
    const cache = new AccessCache();
    for (let i = 0; i < ACCESS_CACHE_MAX + 20; i++) cache.remember(`t${i}`, { email: `p${i}@x.com`, sub: "" }, NOW + 1e6);
    expect(cache.size).toBe(ACCESS_CACHE_MAX);
    expect(cache.identity("t0", NOW)).toBeNull();
    expect(cache.identity(`t${ACCESS_CACHE_MAX + 19}`, NOW)?.email).toBe(`p${ACCESS_CACHE_MAX + 19}@x.com`);
  });
});
