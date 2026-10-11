import { defaultRules, marshalData, MapDef } from "@conquerra/content";
import { createGame, viewFor, type GameContext } from "@conquerra/engine";
import { describe, expect, it } from "vitest";
import { freshMemory, marshalBoard, think } from "../src";
import { plausibleLand, remnantRivals } from "../src/marshal/finish";

/**
 * Session 23 (orchestrator default, Oct 10): a remnant judged honestly under fog. Before cleaning up, a rival is "down
 * to a handful" only when the land we know it holds, plus the fogged land it could plausibly hold, is a handful.
 */
function grid(w: number, h: number, owners: (c: number, r: number) => string | null, fog: boolean) {
  const territories = [];
  const borders = [];
  for (let c = 0; c < w; c++)
    for (let r = 0; r < h; r++) {
      const id = `${String.fromCharCode(97 + c)}${r}`;
      territories.push({ id, name: id.toUpperCase(), province: `p${Math.floor(c / 2)}${Math.floor(r / 2)}`, terrain: "plains" as const, x: c * 100, y: r * 100 });
      if (c + 1 < w) borders.push({ a: id, b: `${String.fromCharCode(98 + c)}${r}` });
      if (r + 1 < h) borders.push({ a: id, b: `${String.fromCharCode(97 + c)}${r + 1}` });
    }
  const provinces = [...new Set(territories.map((t) => t.province))].map((id) => ({ id, name: id.toUpperCase(), bonus: 2 }));
  const map = MapDef.parse({ id: "grid", name: "Grid", minPlayers: 2, maxPlayers: 2, recommendedPlayers: { min: 2, max: 2 }, territories, provinces, borders, capitalSlots: ["a0", `${String.fromCharCode(96 + w)}${h - 1}`] });
  const ctx: GameContext = { map, rules: defaultRules };
  const s = createGame(ctx, { gameId: "g", seed: "remnant", players: [{ id: "p1", name: "P1" }, { id: "p2", name: "P2" }], settings: { luck: 0, fate: false, diplomacy: false, spies: false, fog } });
  for (let c = 0; c < w; c++) for (let r = 0; r < h; r++) s.territories[`${String.fromCharCode(97 + c)}${r}`] = { owner: owners(c, r), troops: 2, specialists: [], building: null, construction: null, culture: 0 };
  s.players[0]!.capital = "a0";
  s.players[0]!.leader = { alive: true, territory: "a0" };
  s.players[1]!.capital = map.capitalSlots![1]!;
  s.players[1]!.leader = { alive: true, territory: s.players[1]!.capital };
  s.intel = { p1: {}, p2: {} };
  s.turn = 20;
  return { ctx, s };
}
const remnants = (ctx: GameContext, s: ReturnType<typeof grid>["s"]) => {
  const view = viewFor(ctx, s, "p1");
  const b = marshalBoard(ctx, view, think(ctx, view, marshalData.judgement, freshMemory()).insight)!;
  return { b, rivals: remnantRivals(b, defaultRules.leaders.finish, false, marshalData.judgement.sweep!.fog) };
};

describe("a remnant judged honestly under fog", () => {
  // A long 16 x 2 strip: we hold the west half (16 territories); the rival holds the east half, and we've seen only the
  // two of its territories next to ours. The rest we've never seen: it could all be theirs.
  const barelySeen = (c: number) => (c < 8 ? "p1" : "p2");

  it("a rival we've barely seen isn't down to a handful: its land in the fog could be theirs (fog on)", () => {
    const { ctx, s } = grid(16, 2, (c) => barelySeen(c), true);
    const { b, rivals } = remnants(ctx, s);
    // What we can see of them: a handful.
    const known = b.idx.ids.filter((t) => b.look0(t) === "p2").length;
    expect(known).toBeLessThanOrEqual(defaultRules.leaders.finish.territories);
    // What they could hold: much more.
    expect(plausibleLand(b, "p2", 2)).toBeGreaterThan(10);
    expect(rivals).not.toContain("p2");
  });

  it("with the fog off nothing is hidden, and a rival that really is down to two territories is one to finish", () => {
    const { ctx, s } = grid(16, 2, (c, r) => (c === 15 ? "p2" : c >= 13 ? null : "p1"), false);
    const { b, rivals } = remnants(ctx, s);
    expect(plausibleLand(b, "p2", 2)).toBe(0);
    expect(rivals).toEqual(["p2"]);
  });

  it("a real remnant in the fog still counts: two territories of theirs, a little fog around them", () => {
    // We hold everything up to column 12; columns 13-14 are empty land we saw last turn; they hold column 15.
    const { ctx, s } = grid(16, 2, (c) => (c === 15 ? "p2" : c >= 13 ? null : "p1"), true);
    // We remember the whole east end (seen a turn ago): theirs, and the empty land next to it.
    for (const id of ["n0", "n1", "o0", "o1", "p0", "p1"]) s.intel.p1![id] = { turn: 19, owner: s.territories[id]!.owner, troops: 2, building: null };
    const { b, rivals } = remnants(ctx, s);
    expect(plausibleLand(b, "p2", 2)).toBeLessThanOrEqual(4);
    expect(rivals).toEqual(["p2"]);
  });
});
