import { describe, expect, it } from "vitest";
import { Rng, seedRng, seedCommitment, verifySeed } from "../src";

describe("seeded RNG", () => {
  it("same seed gives the same sequence", () => {
    const a = new Rng(seedRng("hello"));
    const b = new Rng(seedRng("hello"));
    const sa = Array.from({ length: 50 }, () => a.next());
    const sb = Array.from({ length: 50 }, () => b.next());
    expect(sa).toEqual(sb);
    expect(sa.every((x) => x >= 0 && x < 1)).toBe(true);
  });
  it("different seeds differ", () => {
    expect(new Rng(seedRng("a")).next()).not.toBe(new Rng(seedRng("b")).next());
  });
  it("state can be saved and resumed", () => {
    const a = new Rng(seedRng("resume"));
    a.next();
    a.next();
    const saved = a.state;
    const x = a.next();
    expect(new Rng(saved).next()).toBe(x);
  });
  it("roughly uniform", () => {
    const r = new Rng(seedRng("uniform"));
    let sum = 0;
    for (let i = 0; i < 20000; i++) sum += r.next();
    expect(sum / 20000).toBeGreaterThan(0.49);
    expect(sum / 20000).toBeLessThan(0.51);
  });
});

describe("provably fair seed", () => {
  it("commitment verifies only against the real seed", () => {
    const c = seedCommitment("secret-seed-123");
    expect(c).toMatch(/^[0-9a-f]{64}$/);
    expect(verifySeed("secret-seed-123", c)).toBe(true);
    expect(verifySeed("secret-seed-124", c)).toBe(false);
  });
});
