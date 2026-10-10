import { defaultRules, MapDef } from "@conquerra/content";
import { createGame, findLeader, leaderKey, resolveTurn, viewFor, type GameContext, type Order } from "@conquerra/engine";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { planLeaders } from "../src";

/**
 * Session 20d (Nate's third note): a military leader never hoards. With gold and anywhere to recruit, its plan spends
 * the purse down to less than one troop's cost, unless it names a reason (saving for a barracks), and once the turn has
 * played (the rivals sitting still) the purse holds less than a troop's cost.
 */

/** A 6 x 4 grid (a0 ... f3), provinces of 2 x 2; p1's capital a0, p2's f3. */
function board(layout: Record<string, [string | null, number]>, opts: { barracks?: string; capitalLost?: boolean } = {}) {
  const ids: string[] = [];
  const territories = [];
  for (let c = 0; c < 6; c++)
    for (let r = 0; r < 4; r++) {
      const id = `${String.fromCharCode(97 + c)}${r}`;
      ids.push(id);
      territories.push({ id, name: id.toUpperCase(), province: `p${Math.floor(c / 2)}${Math.floor(r / 2)}`, terrain: "plains" as const, x: c * 100, y: r * 100 });
    }
  const borders = [];
  for (let c = 0; c < 6; c++)
    for (let r = 0; r < 4; r++) {
      const id = `${String.fromCharCode(97 + c)}${r}`;
      if (c + 1 < 6) borders.push({ a: id, b: `${String.fromCharCode(98 + c)}${r}` });
      if (r + 1 < 4) borders.push({ a: id, b: `${String.fromCharCode(97 + c)}${r + 1}` });
    }
  const provinces = [...new Set(territories.map((t) => t.province))].map((id) => ({ id, name: id.toUpperCase(), bonus: 2 }));
  const map = MapDef.parse({ id: "grid", name: "Grid", minPlayers: 2, maxPlayers: 2, recommendedPlayers: { min: 2, max: 2 }, territories, provinces, borders, capitalSlots: ["a0", "f3"] });
  const ctx: GameContext = { map, rules: defaultRules };
  const s = createGame(ctx, { gameId: "g", seed: "purse", players: [{ id: "p1", name: "P1", delegate: true }, { id: "p2", name: "P2" }], settings: { luck: 0, fate: false, diplomacy: false, spies: false } });
  for (const t of ids) s.territories[t] = { owner: null, troops: 1, specialists: [], building: null, construction: null, culture: 0 };
  for (const [t, [owner, troops]] of Object.entries(layout)) (s.territories[t]!.owner = owner), (s.territories[t]!.troops = troops);
  if (opts.barracks) s.territories[opts.barracks]!.building = "barracks";
  s.players.forEach((p, i) => {
    p.capital = ["a0", "f3"][i]!;
    p.leader = { alive: true, territory: ["a0", "f3"][i]! };
    p.gold = 0;
  });
  if (opts.capitalLost) s.territories.a0!.owner = "p2";
  s.intel = Object.fromEntries(s.players.map((p) => [p.id, {}]));
  return { ctx, s };
}

const cost = (ctx: GameContext, o: Order): number =>
  o.kind === "recruit" && typeof o.count === "number" ? o.count * ctx.rules.troops.cost : o.kind === "build" ? ctx.rules.buildings[o.building].cost : o.kind === "hire" ? ctx.rules.specialists[o.specialist].cost : 0;

const ids = Array.from({ length: 24 }, (_, i) => `${String.fromCharCode(97 + Math.floor(i / 4))}${i % 4}`);

describe("never hoard (session 20d)", () => {
  it("a military leader with gold and anywhere to recruit spends its purse to under a troop's cost, unless it names a reason", () => {
    fc.assert(
      fc.property(
        fc.dictionary(fc.constantFrom(...ids.filter((t) => t !== "a0" && t !== "f3")), fc.tuple(fc.constantFrom("p1", "p2", null), fc.integer({ min: 1, max: 30 })), { maxKeys: 14 }),
        fc.integer({ min: 0, max: 120 }),
        fc.integer({ min: 1, max: 40 }),
        fc.constantFrom<"military" | "cleanup">("military", "cleanup"),
        fc.option(fc.constantFrom(...ids), { nil: undefined }),
        (layout, purse, capTroops, kind, barracksAt) => {
          const { ctx, s } = board({ ...layout, a0: ["p1", capTroops], f3: ["p2", 5] });
          if (barracksAt && s.territories[barracksAt]!.owner === "p1") s.territories[barracksAt]!.building = "barracks";
          const l = findLeader(s.players[0]!, { kind: "leader", of: "p1" })!;
          l.command = { kind };
          l.purse = purse;
          const view = viewFor(ctx, s, "p1");
          const plan = planLeaders({ ctx, view });
          const mine = plan.orders.filter((o) => o.general === "p1");
          const spent = mine.reduce((a, o) => a + cost(ctx, o), 0);
          const note = plan.notes[leaderKey(l)];
          expect(spent).toBeLessThanOrEqual(purse);
          // A named reason is for gold it really keeps (never "Saving 0 gold").
          if (note?.kind === "saving") expect(note.gold).toBeGreaterThanOrEqual(ctx.rules.troops.cost);
          if (note?.kind !== "saving") expect(purse - spent).toBeLessThan(ctx.rules.troops.cost);
          // And once the turn has played (the rival sitting still), what's left in the purse is under a troop's cost.
          const after = resolveTurn(ctx, s, { p1: plan.orders, p2: [] }).state;
          const kept = findLeader(after.players[0]!, { kind: "leader", of: "p1" })?.purse ?? 0;
          // (The purse is paid its budget as income comes in: none here.)
          if (note?.kind !== "saving") expect(kept).toBeLessThan(ctx.rules.troops.cost);
        },
      ),
      { numRuns: 60, seed: 2024 },
    );
  });

  it("a site that might fall still gets the recruits when there's nowhere safer, and a lost site's recruits go to the next one", () => {
    // Its only recruit site is the capital, a big rival army next door: it still recruits there (with fallbacks).
    const { ctx, s } = board({ a0: ["p1", 3], a1: ["p2", 40], b0: ["p1", 2], b1: ["p1", 2] });
    const l = findLeader(s.players[0]!, { kind: "leader", of: "p1" })!;
    l.command = { kind: "military" };
    l.purse = 21;
    const plan = planLeaders({ ctx, view: viewFor(ctx, s, "p1") });
    const recruits = plan.orders.filter((o): o is Extract<Order, { kind: "recruit" }> => o.kind === "recruit");
    expect(recruits.reduce((a, o) => a + (o.count as number), 0)).toBe(10);
  });
});
