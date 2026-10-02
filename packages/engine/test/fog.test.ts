import { describe, expect, it } from "vitest";
import { createGame, indexMap, replayFor, resolveTurn, viewFor, visionFor } from "../src";
import { board, ctxWith, embervaleCtx, lineGame, mv } from "./helpers";

describe("fog of war (v0.2 §8)", () => {
  it("shows full detail only on your land and the land bordering it", () => {
    const ctx = embervaleCtx();
    const s = createGame(ctx, { gameId: "f", seed: "fog", players: [{ id: "p1", name: "A" }, { id: "p2", name: "B" }] });
    const v = viewFor(ctx, s, "p1");
    const idx = indexMap(ctx.map);
    const cap = s.players.find((p) => p.id === "p1")!.capital;
    const expected = new Set([cap, ...idx.neighbors.get(cap)!]);
    for (const [id, t] of Object.entries(v.territories)) expect(t.detail === "full").toBe(expected.has(id));
    expect(v.territories[cap]).toMatchObject({ detail: "full", seenBy: ["own"], owner: "p1" });
  });

  it("fogged territories carry nothing at all: no owner, troops or culture", () => {
    const ctx = embervaleCtx();
    const s = createGame(ctx, { gameId: "f", seed: "fog", players: [{ id: "p1", name: "A" }, { id: "p2", name: "B" }] });
    const v = viewFor(ctx, s, "p1");
    const enemyCap = s.players.find((p) => p.id === "p2")!.capital;
    expect(v.territories[enemyCap]).toEqual({ detail: "fogged" });
    const json = JSON.stringify(v);
    expect(json).not.toContain('"rng"');
    expect(JSON.stringify(v.players)).not.toContain("gold");
    expect(JSON.stringify(v.players)).not.toContain("capital");
  });

  it("watchtowers see one step further", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    board(s, { a: ["p1", 5], e: ["p2", 5] });
    expect(visionFor(ctx, s, "p1").has("c")).toBe(false);
    s.territories.a!.building = "watchtower";
    expect(visionFor(ctx, s, "p1").get("c")).toEqual(["watchtower"]);
  });

  it("shows everything when fog is off, and to eliminated players", () => {
    const ctx = embervaleCtx();
    const s = createGame(ctx, { gameId: "f", seed: "fog", players: [{ id: "p1", name: "A" }, { id: "p2", name: "B" }], settings: { fog: false } });
    expect(Object.values(viewFor(ctx, s, "p1").territories).every((t) => t.detail === "full")).toBe(true);
    const s2 = createGame(ctx, { gameId: "f", seed: "fog", players: [{ id: "p1", name: "A" }, { id: "p2", name: "B" }] });
    s2.players[0]!.eliminatedTurn = 1;
    expect(Object.values(viewFor(ctx, s2, s2.players[0]!.id).territories).every((t) => t.detail === "full")).toBe(true);
  });
});

describe("fog-filtered replay", () => {
  it("fogged battles arrive as surface details; quiet fogged moves don't arrive at all", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    board(s, { a: ["p1", 5], c: [null, 2], d: ["p2", 20], e: ["p2", 5] });
    const result = resolveTurn(ctx, s, { p2: [mv("d", "c", 10), mv("e", "d", 2)] });
    const p1 = replayFor(ctx, s, result, "p1");
    expect(p1.filter((e) => e.type === "battle")).toHaveLength(0);
    expect(p1.filter((e) => e.type === "moved")).toHaveLength(0);
    expect(p1.find((e) => e.type === "surface")).toMatchObject({ what: "battle", province: "mid" });
    expect(JSON.stringify(p1.find((e) => e.type === "surface"))).not.toContain("p2");
    // p2 sees its own battle in full
    const p2 = replayFor(ctx, s, result, "p2");
    expect(p2.some((e) => e.type === "battle")).toBe(true);
    expect(p2.some((e) => e.type === "surface")).toBe(false);
  });

  it("you always see battles you're in, and your own income but nobody else's", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    board(s, { a: ["p1", 5], b: ["p1", 3], c: ["p1", 3], d: ["p2", 20], e: ["p2", 5] });
    const result = resolveTurn(ctx, s, { p2: [mv("d", "c", "all")] });
    const p1 = replayFor(ctx, s, result, "p1");
    expect(p1.some((e) => e.type === "battle")).toBe(true);
    const incomes = p1.filter((e) => e.type === "income");
    expect(incomes).toHaveLength(1);
    expect(incomes[0]).toMatchObject({ player: "p1" });
  });

  it("every step is either kept, turned into a surface detail, or dropped — never invented", () => {
    const ctx = embervaleCtx();
    let s = createGame(ctx, { gameId: "r", seed: "replay", players: [1, 2, 3].map((i) => ({ id: `p${i}`, name: `P${i}` })), settings: { fog: true } });
    const result = resolveTurn(ctx, s, {});
    for (const p of s.players) {
      const steps = replayFor(ctx, s, result, p.id).map((e) => e.step);
      expect(new Set(steps).size).toBe(steps.length);
      for (const st of steps) expect(st).toBeLessThan(result.events.length);
    }
    s = result.state;
  });
});
