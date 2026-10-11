import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { createGame, viewFor, type GameContext } from "@conquerra/engine";
import { describe, expect, it } from "vitest";
import { territoryCard } from "../src/map/card";
import { narrateTurn } from "../src/logic/narrate";
import { namer, startBonusLine } from "../src/logic/text";

/** Session 23: the start bonus, readable: the first turn's report, the territory card on turn 1. */
const base = maps.embervale!;
const map = { ...base, capitalLayouts: base.capitalLayouts!.map((l) => (l.players === 4 ? { ...l, bonus: Object.fromEntries(l.slots.map((s) => [s, 4])) } : l)) };
const ctx: GameContext = { map, rules: defaultRules };
const s = createGame(ctx, { gameId: "g", seed: "words", players: [1, 2, 3, 4].map((i) => ({ id: `p${i}`, name: `P${i}` })), startBonus: true });
const view = viewFor(ctx, s, "p1");
const capital = map.territories.find((t) => t.id === view.me.capital)!.name;

describe("the start bonus, in words", () => {
  it("one line: the capital, the troops, why", () => {
    expect(startBonusLine(view, namer(ctx, view).place)).toBe(`${capital} starts with 4 extra troops (a harder spot).`);
    const none = viewFor({ map: base, rules: defaultRules }, createGame({ map: base, rules: defaultRules }, { gameId: "g", seed: "words", players: [1, 2, 3, 4].map((i) => ({ id: `p${i}`, name: `P${i}` })) }), "p1");
    expect(startBonusLine(none, namer(ctx, none).place)).toBeNull();
  });

  it("the first turn's report opens with it; later reports don't", () => {
    const first = narrateTurn(ctx, [{ type: "turnStart", step: 0, turn: 1, seats: ["p1", "p2"] }], namer(ctx, view));
    expect(first[0]!.text).toBe(`${capital} starts with 4 extra troops (a harder spot).`);
    const later = narrateTurn(ctx, [{ type: "turnStart", step: 0, turn: 2, seats: ["p1", "p2"] }], namer(ctx, view));
    expect(later.some((l) => l.text.includes("extra troops"))).toBe(false);
  });

  it("the territory card says so on turn 1, at your capital", () => {
    const troops = territoryCard(ctx, view, view.me.capital).lines.find((l) => l.label === "Troops")!;
    expect(troops.value).toBe("16 troops, 4 of them extra at the start (a harder spot)");
    const turn2 = territoryCard(ctx, { ...view, turn: 2 }, view.me.capital).lines.find((l) => l.label === "Troops")!;
    expect(turn2.value).toBe("16 troops");
  });
});

describe("the start bonus in the grouped report", () => {
  it("the first turn's report opens your news with it", async () => {
    const { groupReport } = await import("../src/logic/report");
    const g = groupReport(ctx, [{ type: "turnStart", step: 0, turn: 1, seats: ["p1", "p2"] }], namer(ctx, view));
    expect(g.yours[0]!.text).toBe(`${capital} starts with 4 extra troops (a harder spot).`);
  });
});
