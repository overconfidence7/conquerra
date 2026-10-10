import { describe, expect, it } from "vitest";
import { NETWORK_ONLY_NAVIGATIONS, readVersionReply, SIGN_IN_PATH } from "../src/logic/freshness";

const ok = { type: "basic", status: 200, ok: true };

describe("is this the latest version (session 21)", () => {
  it("the same build is current, a different one is newer", () => {
    expect(readVersionReply(ok, { build: "0.1.0 · 10 Oct · abc" }, "0.1.0 · 10 Oct · abc")).toEqual({ kind: "current" });
    expect(readVersionReply(ok, { build: "0.1.0 · 11 Oct · def" }, "0.1.0 · 10 Oct · abc")).toEqual({ kind: "newer", live: "0.1.0 · 11 Oct · def" });
  });

  it("Access's sign-in redirect (or a page that isn't the version file) means the login expired", () => {
    expect(readVersionReply({ type: "opaqueredirect", status: 0, ok: false }, null, "x")).toEqual({ kind: "signIn" });
    expect(readVersionReply({ type: "basic", status: 302, ok: false }, null, "x")).toEqual({ kind: "signIn" });
    expect(readVersionReply({ type: "basic", status: 403, ok: false }, null, "x")).toEqual({ kind: "signIn" });
    expect(readVersionReply(ok, "<html>Sign in</html>", "x")).toEqual({ kind: "signIn" });
  });

  it("a server error is no reason to bother the player", () => {
    expect(readVersionReply({ type: "basic", status: 500, ok: false }, null, "x")).toEqual({ kind: "unknown" });
  });

  it("the sign-in link and Access's own pages always go to the server, not the offline copy", () => {
    const toNetwork = (path: string) => NETWORK_ONLY_NAVIGATIONS.some((re) => re.test(path));
    expect(toNetwork(SIGN_IN_PATH)).toBe(true);
    expect(toNetwork("/cdn-cgi/access/authorized")).toBe(true);
    expect(toNetwork("/")).toBe(false);
    expect(toNetwork("/?lab=bench")).toBe(false);
  });
});
