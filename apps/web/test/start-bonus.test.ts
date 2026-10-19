import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { createGame, viewFor, type GameContext } from "@conquerra/engine";
import { describe, expect, it } from "vitest";
import { territoryCard } from "../src/map/card";
import { narrateTurn } from "../src/logic/narrate";
import { namer } from "../src/logic/text";
import { startBonusLine } from "../src/logic/turnWords";

/** Session 23: the start bonus, readable: the first turn's report, the territory card on turn 1. */
const base = maps.embervale!;
const map = { ...base, capitalLayouts: base.capitalLayouts!.map((l) => (l.players === 4 ? { ...l, bonus: Object.fromEntries(l.slots.map((s) => [s, 4])) } : l)) };
const ctx: GameContext = { map, rules: defaultRules };
const s = createGame(ctx, { gameId: "g", seed: "words", players: [1, 2, 3, 4].map((i) => ({ id: `p${i}`, name: `P${i}` })), startBonus: true });
const view = viewFor(ctx, s, "p1");
const capital = map.territories.find((t) => t.id === view.me.capital)!.name;

describe("the start bonus, in words", () => {
  it("one line: the capital, the troops, why", () => {
    expect(startBonusLine(view, namer(ctx, view).place)).toBe(`${capital} starts with 4 extra troops (an exposed spot).`);
    const none = viewFor({ map: base, rules: defaultRules }, createGame({ map: base, rules: defaultRules }, { gameId: "g", seed: "words", players: [1, 2, 3, 4].map((i) => ({ id: `p${i}`, name: `P${i}` })) }), "p1");
    expect(startBonusLine(none, namer(ctx, none).place)).toBeNull();
  });

  it("the first turn's report opens with it; later reports don't", () => {
    const first = narrateTurn(ctx, [{ type: "turnStart", step: 0, turn: 1, seats: ["p1", "p2"] }], namer(ctx, view));
    expect(first[0]!.text).toBe(`${capital} starts with 4 extra troops (an exposed spot).`);
    const later = narrateTurn(ctx, [{ type: "turnStart", step: 0, turn: 2, seats: ["p1", "p2"] }], namer(ctx, view));
    expect(later.some((l) => l.text.includes("extra troops"))).toBe(false);
  });

  it("the territory card says so on turn 1, at your capital", () => {
    const troops = territoryCard(ctx, view, view.me.capital).lines.find((l) => l.label === "Troops")!;
    expect(troops.value).toBe("16 troops, 4 of them extra at the start (an exposed spot)");
    const turn2 = territoryCard(ctx, { ...view, turn: 2 }, view.me.capital).lines.find((l) => l.label === "Troops")!;
    expect(turn2.value).toBe("16 troops");
  });
});

describe("the start bonus in the grouped report", () => {
  it("the first turn's report opens your news with it", async () => {
    const { groupReport } = await import("../src/logic/report");
    const g = groupReport(ctx, [{ type: "turnStart", step: 0, turn: 1, seats: ["p1", "p2"] }], namer(ctx, view));
    expect(g.yours[0]!.text).toBe(`${capital} starts with 4 extra troops (an exposed spot).`);
  });
});

describe("everyone's head start on the first turn's report (session 33: a random map gives most spots one)", () => {
  it("names the others' head starts, most first; a view says how many, never where", async () => {
    const { groupReport } = await import("../src/logic/report");
    const { headStartsLine } = await import("../src/logic/turnWords");
    expect(view.players.filter((p) => p.id !== "p1").map((p) => p.startBonus)).toEqual([4, 4, 4]);
    expect(headStartsLine(view)).toBe("Head starts for the exposed spots: P2 +4, P3 +4, P4 +4.");
    const g = groupReport(ctx, [{ type: "turnStart", step: 0, turn: 1, seats: ["p1", "p2"] }], namer(ctx, view));
    expect(g.yours.map((l) => l.text).slice(0, 2)).toEqual([`${capital} starts with 4 extra troops (an exposed spot).`, "Head starts for the exposed spots: P2 +4, P3 +4, P4 +4."]);
    const graded = { ...view, players: view.players.map((p, i) => ({ ...p, startBonus: [0, 2, 0, 5][i] })) };
    expect(headStartsLine(graded as typeof view)).toBe("Head starts for the exposed spots: P4 +5, P2 +2.");
    // A map with none: no line.
    const none = viewFor({ map: base, rules: defaultRules }, createGame({ map: base, rules: defaultRules }, { gameId: "g", seed: "words", players: [1, 2, 3, 4].map((i) => ({ id: `p${i}`, name: `P${i}` })) }), "p1");
    expect(headStartsLine(none)).toBeNull();
    expect(JSON.stringify(view.players)).not.toMatch(/capital|t\d+/);
  });
});

describe("the income head start, in words (session 33b: random map version 5's market)", () => {
  // Embervale's 4-player layout with version 5's kind of head start: troops on three spots, a market on two of them.
  const l4 = base.capitalLayouts!.find((l) => l.players === 4)!;
  const [a, b, c] = l4.slots;
  const marketMap = { ...base, capitalLayouts: base.capitalLayouts!.map((l) => (l.players === 4 ? { ...l, bonus: { [a!]: 6, [b!]: 1, [c!]: 6 }, buildings: { [a!]: "market" as const, [c!]: "market" as const } } : l)) };
  const mctx: GameContext = { map: marketMap, rules: defaultRules };
  const ms = createGame(mctx, { gameId: "g", seed: "words", players: [1, 2, 3, 4].map((i) => ({ id: `p${i}`, name: `P${i}` })), startBonus: true });
  const withMarket = ms.players.find((p) => p.startBuilding === "market")!;

  it("the market stands on turn 1, finished, and the capital's card shows it as any building", () => {
    const v = viewFor(mctx, ms, withMarket.id);
    expect(ms.territories[withMarket.capital]).toMatchObject({ building: "market", construction: null });
    expect(v.me.startBuilding).toBe("market");
    const card = territoryCard(mctx, v, v.me.capital);
    expect(JSON.stringify(card)).toMatch(/Market/);
    // Without the start bonus (a setup saved before it), no market either.
    const old = createGame(mctx, { gameId: "g", seed: "words", players: [1, 2, 3, 4].map((i) => ({ id: `p${i}`, name: `P${i}` })) });
    expect(Object.values(old.territories).some((t) => t.building)).toBe(false);
    expect(old.players.some((p) => p.startBuilding)).toBe(false);
  });

  it("turn 1's report: yours, then the others' troops and, in a sentence of its own, whose market it is", async () => {
    const { groupReport } = await import("../src/logic/report");
    const { headStartsLine } = await import("../src/logic/turnWords");
    const v = viewFor(mctx, ms, withMarket.id);
    const place = mctx.map.territories.find((t) => t.id === v.me.capital)!.name;
    expect(startBonusLine(v, namer(mctx, v).place)).toBe(`${place} starts with 6 extra troops and a market (an exposed spot).`);
    const g = groupReport(mctx, [{ type: "turnStart", step: 0, turn: 1, seats: ["p1", "p2"] }], namer(mctx, v));
    expect(g.yours[0]!.text).toBe(`${place} starts with 6 extra troops and a market (an exposed spot).`);
    const others = ms.players.filter((p) => p.id !== v.me.id).sort((x, y) => (y.startBonus ?? 0) - (x.startBonus ?? 0) || (x.name < y.name ? -1 : 1));
    const troops = others.filter((p) => p.startBonus).map((p) => `${p.name} +${p.startBonus}`);
    const markets = others.filter((p) => p.startBuilding).map((p) => p.name);
    expect(markets.length).toBe(1);
    expect(headStartsLine(v)).toBe(`Head starts for the exposed spots: ${troops.join(", ")}. ${markets[0]} also starts with a market.`);
    // By hand: a market alone, and culture (a setting the sim tried).
    const j = v.players.findIndex((p) => p.id !== v.me.id);
    const hand = { ...v, me: { ...v.me, startBonus: undefined, startBuilding: "market" as const }, players: v.players.map((p, i) => ({ ...p, startBonus: i === j ? 6 : 0, startBuilding: i === j ? ("market" as const) : undefined, startCulture: i === j ? 1 : undefined })) };
    expect(startBonusLine(hand, () => "Stoneshire")).toBe("Stoneshire starts with a market (an exposed spot).");
    expect(headStartsLine(hand)).toBe(`Head starts for the exposed spots: ${v.players[j]!.name} +6. ${v.players[j]!.name} also starts with a market and a level of culture.`);
    // Two with a market: one sentence for both; none with troops: no "also".
    const two = { ...hand, players: hand.players.map((p) => (p.id === v.me.id ? p : { ...p, startBonus: 0, startBuilding: "market" as const, startCulture: 1 })) };
    const names = two.players.filter((p) => p.id !== v.me.id).map((p) => p.name).sort();
    expect(headStartsLine(two)).toBe(`${names.slice(0, -1).join(", ")} and ${names.at(-1)} start with a market and a level of culture.`);
    // The view says what, never where.
    expect(JSON.stringify(v.players)).not.toMatch(/capital|t\d+/);
  });
});
