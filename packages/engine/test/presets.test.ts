import { describe, expect, it } from "vitest";
import { expandPreset, PRESETS, resolveTurn, type Order } from "../src";
import { board, ctxWith, find, lineGame, mv } from "./helpers";

const ctx = ctxWith();

describe("contingency presets", () => {
  it("there are five, each with a plain-language description", () => {
    expect(PRESETS.map((p) => p.id)).toEqual(["onlyIfStronger", "holdIfThreatened", "retreatIfOutnumbered", "followThrough", "reinforceIfHit"]);
    for (const p of PRESETS) expect(p.description.length).toBeGreaterThan(20);
  });

  it("expand into ordinary conditions and fallbacks", () => {
    const o = expandPreset(mv("b", "c", "all", { id: "x", preset: { id: "retreatIfOutnumbered" } }));
    expect(o.conditions).toEqual([{ kind: "not", condition: { kind: "outnumbered", territory: "b" } }]);
    expect(o.fallback).toMatchObject({ kind: "retreat", from: "b" });
    // presets on orders they don't fit are ignored
    const r: Order = { id: "r", kind: "recruit", territory: "a", count: 1, preset: { id: "onlyIfStronger" } };
    expect(expandPreset(r).conditions).toBeUndefined();
  });

  it("Only if still stronger: cancels the attack if the target was reinforced first", () => {
    const s = lineGame(ctx);
    board(s, { a: ["p1", 1], b: ["p1", 8], c: ["p2", 2], d: ["p2", 20], e: ["p2", 1] });
    const reinforce = mv("d", "c", 15, { timing: "first" });
    const plain = resolveTurn(ctx, s, { p1: [mv("b", "c", "all")], p2: [reinforce] });
    expect(find(plain.events, "battle")).toBeTruthy();
    const careful = resolveTurn(ctx, s, { p1: [mv("b", "c", "all", { preset: { id: "onlyIfStronger" } })], p2: [reinforce] });
    expect(find(careful.events, "battle")).toBeUndefined();
    expect(find(careful.events, "fizzled")).toMatchObject({ reason: "condition", detail: { condition: "odds" } });
  });

  it("Hold if threatened: cancels the move if enemies next to the launch point grew", () => {
    const s = lineGame(ctx);
    board(s, { a: ["p1", 1], b: ["p1", 8], c: ["p2", 2], d: ["p2", 20], e: ["p2", 1] });
    const order = mv("b", "a", "all", { preset: { id: "holdIfThreatened" } });
    const calm = resolveTurn(ctx, s, { p1: [order] });
    expect(find(calm.events, "moved")).toBeTruthy();
    const tense = resolveTurn(ctx, s, { p1: [order], p2: [mv("d", "c", 15, { timing: "first" })] });
    expect(tense.events.some((e) => e.type === "moved" && e.player === "p1")).toBe(false);
  });

  it("Retreat if outnumbered: pulls back to the safest territory you hold", () => {
    const s = lineGame(ctx);
    board(s, { a: ["p1", 1], b: ["p1", 2], c: ["p1", 6], d: ["p2", 20], e: ["p2", 1] });
    const attack = mv("c", "d", "all", { preset: { id: "retreatIfOutnumbered" } });
    const r = resolveTurn(ctx, s, { p1: [attack] });
    expect(find(r.events, "battle")).toBeUndefined();
    expect(find(r.events, "moved")).toMatchObject({ from: "c", to: "b", retreat: true });
    // a standalone retreat with the preset only happens when outnumbered
    const stay: Order = { id: "s", kind: "retreat", from: "c", preset: { id: "retreatIfOutnumbered" } };
    board(s, { a: ["p1", 1], b: ["p1", 2], c: ["p1", 6], d: ["p2", 3], e: ["p2", 1] });
    expect(find(resolveTurn(ctx, s, { p1: [stay] }).events, "moved")).toBeUndefined();
  });

  it("Follow through: after a capture the army pushes on", () => {
    const s = lineGame(ctx);
    board(s, { a: ["p1", 1], b: ["p1", 40], c: [null, 1], d: [null, 1], e: ["p2", 2] });
    const named = resolveTurn(ctx, s, { p1: [mv("b", "c", "all", { preset: { id: "followThrough", next: "d" } })] });
    expect(named.state.territories.c!.owner).toBe("p1");
    expect(named.state.territories.d!.owner).toBe("p1");
    const auto = resolveTurn(ctx, s, { p1: [mv("b", "c", "all", { preset: { id: "followThrough" } })] });
    expect(auto.state.territories.d!.owner).toBe("p1");
    // no capture, no follow-up
    board(s, { a: ["p1", 1], b: ["p1", 3], c: ["p2", 30], d: [null, 1], e: ["p2", 2] });
    const stuck = resolveTurn(ctx, s, { p1: [mv("b", "c", "all", { preset: { id: "followThrough", next: "d" } })] });
    expect(stuck.events.filter((e) => e.type === "battle")).toHaveLength(1);
  });

  it("Reinforce if hit: sends reserves only if the destination was attacked earlier", () => {
    const s = lineGame(ctx);
    board(s, { a: ["p1", 10], b: ["p1", 6], c: ["p2", 4], d: ["p2", 1], e: ["p2", 1] });
    const reserves = mv("a", "b", "all", { preset: { id: "reinforceIfHit" }, timing: "last" });
    const quiet = resolveTurn(ctx, s, { p1: [reserves] });
    expect(find(quiet.events, "moved")).toBeUndefined();
    const hit = resolveTurn(ctx, s, { p1: [reserves], p2: [mv("c", "b", "all")] });
    expect(hit.events.some((e) => e.type === "moved" && e.player === "p1" && e.to === "b")).toBe(true);
  });

  it("conditions can't peek through fog", () => {
    const s = lineGame(ctx);
    board(s, { a: ["p1", 5], e: ["p2", 5] });
    s.players.find((p) => p.id === "p1")!.gold = 100;
    // p1 can't see e, so "e has at most 5 troops" counts as false even though it's true.
    const o: Order = { id: "peek", kind: "recruit", territory: "a", count: 1, conditions: [{ kind: "maxTroops", territory: "e", count: 5 }] };
    expect(find(resolveTurn(ctx, s, { p1: [o] }).events, "fizzled")).toMatchObject({ orderId: "peek" });
  });
});
