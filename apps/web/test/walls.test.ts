import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { createGame, indexMap, resolveTurn, viewFor, type GameContext, type GameState, type Order } from "@conquerra/engine";
import { describe, expect, it } from "vitest";
import { cultureNext, territoryCard, wallHint, wallLine } from "../src/map/card";
import { wallFootprints } from "../src/map/walls";

/**
 * Walls on the page (session 20b): the card's "Walled: N defend" is the engine's own number, the ring on the map
 * follows captures, a wall you only remember stays greyed, and the culture and build panels say "Completes a wall".
 * On Embervale: three territories in a row (x - y - z) walled for "you", a rival army next to z.
 */
const ctx: GameContext = { map: maps.embervale!, rules: defaultRules };
const idx = indexMap(ctx.map);
const land = (a: string, b: string) => idx.border(a, b) !== "sea";
// A chain x - y - z over land borders, and w next to z (and to nothing else of theirs).
const [x, y, z, w] = (() => {
  for (const a of idx.ids)
    for (const b of idx.neighbors.get(a)!)
      for (const c of idx.neighbors.get(b)!) {
        if (c === a || !land(a, b) || !land(b, c) || idx.neighbors.get(a)!.includes(c)) continue;
        const d = idx.neighbors.get(c)!.find((n) => n !== b && n !== a && !idx.neighbors.get(a)!.includes(n) && !idx.neighbors.get(b)!.includes(n));
        if (d) return [a, b, c, d];
      }
  throw new Error("no chain");
})() as [string, string, string, string];
const name = (t: string) => ctx.map.territories.find((m) => m.id === t)!.name;

function game(): GameState {
  const s = createGame(ctx, { gameId: "w", seed: "w", players: [{ id: "you", name: "You" }, { id: "rival", name: "Rival" }, { id: "far", name: "Far" }, { id: "away", name: "Away" }], settings: { luck: 0, fate: false, spies: false, diplomacy: false } });
  for (const t of idx.ids) s.territories[t] = { owner: null, troops: 1, specialists: [], building: null, construction: null, culture: 0 };
  for (const t of [x, y, z]) s.territories[t] = { owner: "you", troops: 4, specialists: [], building: "fort", construction: null, culture: 5, walled: true };
  s.territories[w] = { owner: "rival", troops: 60, specialists: [], building: null, construction: null, culture: 0 };
  // Somewhere far away for the other two (and capitals that stay put).
  const rest = idx.ids.filter((t) => ![x, y, z, w].includes(t) && ![x, y, z, w].some((u) => idx.neighbors.get(u)!.includes(t)));
  for (const [i, p] of s.players.entries()) {
    const cap = i === 0 ? x : i === 1 ? w : rest[i * 7]!;
    p.capital = cap;
    p.leader = { alive: true, territory: cap };
    if (i > 1) s.territories[cap] = { owner: p.id, troops: 5, specialists: [], building: null, construction: null, culture: 0 };
  }
  s.intel = Object.fromEntries(s.players.map((p) => [p.id, {}]));
  return s;
}

describe("walls on the page (session 20b)", () => {
  it("the card's 'Walled: 10 defend' is exactly who defends in the engine's battle", () => {
    const s = game();
    const rival = viewFor(ctx, s, "rival");
    expect(wallLine(ctx, rival, z)).toBe(`Walled: 10 defend (with ${name(y)} and ${name(x)})`);
    const card = territoryCard(ctx, rival, z);
    expect(card.lines.find((l) => l.label === "Wall")?.value).toBe(`Walled: 10 defend (with ${name(y)} and ${name(x)})`);
    const order: Order = { id: "a", kind: "move", from: w, to: z, troops: 12 };
    const fight = resolveTurn(ctx, s, { rival: [order] }).events.find((e) => e.type === "battle");
    expect(fight?.type === "battle" && fight.defenders.troops).toBe(10);
  });

  it("the wall ring follows captures; a wall you saw and can't see now stays on the map, greyed", () => {
    const s = game();
    expect(wallFootprints(viewFor(ctx, s, "you"), idx.ids)).toEqual([{ key: "w0", owner: "you", remembered: false, territories: [x, y, z].sort((a, b) => idx.ids.indexOf(a) - idx.ids.indexOf(b)) }]);
    // The rival takes z: the ring closes round x and y.
    const r = resolveTurn(ctx, s, { rival: [{ id: "a", kind: "move", from: w, to: z, troops: 59 }] });
    expect(r.state.territories[z]!.owner).toBe("rival");
    const after = wallFootprints(viewFor(ctx, r.state, "you"), idx.ids);
    expect(after.map((f) => [...f.territories].sort())).toEqual([[x, y].sort()]);
    // A player who saw the wall and now sees none of it: remembered, greyed.
    const later = JSON.parse(JSON.stringify(r.state)) as GameState;
    for (const t of [z, w]) later.territories[t] = { owner: null, troops: 1, specialists: [], building: null, construction: null, culture: 0 };
    const seenBefore = viewFor(ctx, later, "rival");
    // (It held z as the turn ended, so it saw y walled next door.)
    expect(wallFootprints(seenBefore, idx.ids)).toEqual([{ key: "r:you", owner: "you", remembered: true, territories: [y] }]);
  });

  it("before you buy the last piece, the culture and build panels say 'Completes a wall'", () => {
    const s = game();
    Object.assign(s.territories[w]!, { owner: "you", troops: 3, culture: 4, building: "fort" });
    const you = viewFor(ctx, s, "you");
    expect(cultureNext(ctx, you, w, 4)).toContain("Completes a wall: walled at the end of this turn");
    expect(wallHint(ctx, you, w, "culture")).toBe("Completes a wall: walled at the end of this turn");
    // Culture 5 and no fort yet: the fort completes it.
    Object.assign(s.territories[w]!, { culture: 5, building: null });
    expect(wallHint(ctx, viewFor(ctx, s, "you"), w, "fort")).toBe("Completes a wall once it's finished");
    // Already walled, or not close: nothing to say.
    expect(wallHint(ctx, you, x, "culture")).toBeNull();
    Object.assign(s.territories[w]!, { culture: 2, building: "fort" });
    expect(wallHint(ctx, viewFor(ctx, s, "you"), w, "culture")).toBeNull();
  });
});
