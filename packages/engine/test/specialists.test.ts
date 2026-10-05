import { describe, expect, it } from "vitest";
import type { SpecialistType } from "@conquerra/content";
import { resolveTurn, visibleTerritories, type Order } from "../src";
import { board, ctxWith, find, lineGame, mv, player } from "./helpers";

const hire = (territory: string, specialist: SpecialistType, id = `h-${specialist}`): Order => ({
  id,
  kind: "hire",
  territory,
  specialist,
});

describe("specialists", () => {
  it("are hired with gold at your capital or a barracks, up to 2 per army", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    board(s, { a: ["p1", 5], b: ["p1", 5], c: ["p1", 5, [], { building: "barracks" }], e: ["p2", 5] });
    player(s, "p1").gold = 100;
    const { state, events } = resolveTurn(ctx, s, {
      p1: [hire("a", "cavalry", "1"), hire("a", "scouts", "2"), hire("a", "cavalry", "3"), hire("b", "scouts", "4"), hire("c", "scouts", "5")],
    });
    expect(state.territories.a!.specialists.map((x) => x.type)).toEqual(["cavalry", "scouts"]);
    expect(state.territories.c!.specialists.map((x) => x.type)).toEqual(["scouts"]);
    const fizz = events.filter((e) => e.type === "fizzled").map((e) => (e as { orderId: string; reason: string }).orderId);
    expect(fizz).toEqual(["3", "4"]);
    const spent = events.filter((e) => e.type === "hired").reduce((a, e) => a + (e as { cost: number }).cost, 0);
    expect(spent).toBe(ctx.rules.specialists.cavalry.cost + 2 * ctx.rules.specialists.scouts.cost);
  });

  it("fancier specialists need culture in the province", () => {
    const ctx = ctxWith((r) => (r.specialists.siege.cultureRequired = 2));
    const s = lineGame(ctx);
    board(s, { a: ["p1", 5], e: ["p2", 5] });
    player(s, "p1").gold = 100;
    const no = resolveTurn(ctx, s, { p1: [hire("a", "siege")] });
    expect(find(no.events, "fizzled")!.reason).toBe("cultureLocked");
    board(s, { a: ["p1", 5, [], { culture: 1 }], b: ["p1", 1, [], { culture: 1 }], e: ["p2", 5] });
    const yes = resolveTurn(ctx, s, { p1: [hire("a", "siege")] });
    expect(find(yes.events, "hired")).toBeTruthy();
  });

  it("travel with the army by default, or stay if you list none", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    board(s, { a: ["p1", 10, ["scouts", "healers"]], b: ["p1", 1], c: ["p1", 1], e: ["p2", 5] });
    const r = resolveTurn(ctx, s, { p1: [mv("a", "b", 5), mv("b", "c", 1, { specialists: [] })] });
    expect(r.state.territories.a!.specialists).toEqual([]);
    expect(r.state.territories.b!.specialists.map((x) => x.type)).toEqual(["scouts", "healers"]);
    const r2 = resolveTurn(ctx, s, { p1: [mv("a", "b", 5, { specialists: ["healers"] })] });
    expect(r2.state.territories.a!.specialists.map((x) => x.type)).toEqual(["scouts"]);
  });

  it("an army can't carry more than 2: extras stay behind", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    board(s, { a: ["p1", 10, ["scouts", "healers"]], b: ["p1", 2, ["siege"]], e: ["p2", 5] });
    const { state } = resolveTurn(ctx, s, { p1: [mv("a", "b", "all")] });
    expect(state.territories.b!.specialists).toHaveLength(2);
    expect(state.territories.a!.specialists).toHaveLength(1);
  });

  it("cavalry lets the army move two territories through land you hold", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    board(s, { a: ["p1", 10, ["cavalry"]], b: ["p1", 1], c: [null, 2], e: ["p2", 3] });
    const ok = resolveTurn(ctx, s, { p1: [mv("a", "c", "all", { via: "b" })] });
    expect(ok.events.some((e) => e.type === "battle" && e.to === "c")).toBe(true);
    board(s, { a: ["p1", 10], b: ["p1", 1], c: [null, 2], e: ["p2", 3] });
    const bad = resolveTurn(ctx, s, { p1: [mv("a", "c", "all", { via: "b" })] });
    expect(find(bad.events, "fizzled")!.reason).toBe("needsCavalry");
  });

  it("siege breaks forts", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    board(s, { a: ["p1", 10], b: ["p2", 6, [], { building: "fort" }], e: ["p2", 3] });
    const plain = find(resolveTurn(ctx, s, { p1: [mv("a", "b", "all")] }).events, "battle")!;
    board(s, { a: ["p1", 10, ["siege"]], b: ["p2", 6, [], { building: "fort" }], e: ["p2", 3] });
    const sieged = find(resolveTurn(ctx, s, { p1: [mv("a", "b", "all")] }).events, "battle")!;
    expect(sieged.result.defenseStrength).toBeLessThan(plain.result.defenseStrength);
  });

  it("engineers finish a fort on the spot; without them it takes longer", () => {
    const ctx = ctxWith((r) => (r.buildings.fort.buildTurns = 2));
    const s = lineGame(ctx);
    player(s, "p1").gold = 100;
    board(s, { a: ["p1", 5], b: ["p1", 5, ["engineers"]], e: ["p2", 5] });
    const fort = (t: string): Order => ({ id: `f${t}`, kind: "build", territory: t, building: "fort" });
    const t1 = resolveTurn(ctx, s, { p1: [fort("a"), fort("b")] });
    expect(t1.state.territories.b!.building).toBe("fort");
    expect(t1.state.territories.a!.building).toBeNull();
    expect(t1.state.territories.a!.construction).toMatchObject({ building: "fort" });
    const t2 = resolveTurn(ctx, t1.state, {});
    expect(t2.state.territories.a!.building).toBe("fort");
    expect(find(t2.events, "completed")).toMatchObject({ territory: "a", building: "fort" });
  });

  it("scouts let the army see further", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    board(s, { a: ["p1", 5], e: ["p2", 5] });
    const before = resolveTurn(ctx, s, {}).state;
    board(s, { a: ["p1", 5, ["scouts"]], e: ["p2", 5] });
    const after = resolveTurn(ctx, s, {}).state;
    // a sees b normally; with scouts it also sees c
    expect(visibleTerritories(ctx, before, "p1").has("c")).toBe(false);
    expect(visibleTerritories(ctx, after, "p1").has("c")).toBe(true);
  });

  it("are lost when their army is destroyed (attacking or defending), and retreat with survivors", () => {
    const ctx = ctxWith();
    const s = lineGame(ctx);
    // Attacker wiped out: specialists die with it.
    board(s, { a: ["p1", 3, ["healers", "siege"]], b: ["p2", 30], e: ["p2", 3] });
    const lost = resolveTurn(ctx, s, { p1: [mv("a", "b", "all")] });
    expect(find(lost.events, "battle")!.specialistsLost.sort()).toEqual(["healers", "siege"]);
    expect(lost.state.territories.a!.specialists).toEqual([]);
    // Defender wiped out: its specialists are lost, not captured.
    board(s, { a: ["p1", 30], b: ["p2", 2, ["engineers"]], e: ["p2", 3] });
    const taken = resolveTurn(ctx, s, { p1: [mv("a", "b", "all")] });
    expect(taken.state.territories.b!.owner).toBe("p1");
    expect(taken.state.territories.b!.specialists).toEqual([]);
    expect(find(taken.events, "battle")!.specialistsLost).toEqual(["engineers"]);
    // Failed attack with survivors: the specialists come home with them.
    board(s, { a: ["p1", 10, ["scouts"]], b: ["p2", 12], e: ["p2", 3] });
    const bounced = resolveTurn(ctx, s, { p1: [mv("a", "b", "all")] });
    expect(find(bounced.events, "battle")!.captured).toBe(false);
    expect(bounced.state.territories.a!.specialists.map((x) => x.type)).toEqual(["scouts"]);
  });

  it("cost upkeep every turn", () => {
    const ctx = ctxWith((r) => (r.specialists.siege.upkeep = 3));
    const s = lineGame(ctx);
    board(s, { a: ["p1", 5, ["siege"]], e: ["p2", 5] });
    const inc = resolveTurn(ctx, s, {}).events.find((e) => e.type === "income" && e.player === "p1") as { upkeep: number };
    board(s, { a: ["p1", 5], e: ["p2", 5] });
    const inc0 = resolveTurn(ctx, s, {}).events.find((e) => e.type === "income" && e.player === "p1") as { upkeep: number };
    expect(inc.upkeep - inc0.upkeep).toBe(3);
  });
});
