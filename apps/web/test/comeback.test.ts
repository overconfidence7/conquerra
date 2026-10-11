import { defaultRules } from "@conquerra/content";
import { lines } from "@conquerra/content/lines";
import { maps } from "@conquerra/content/maps";
import { createGame, viewFor, type GameContext, type ReplayEvent } from "@conquerra/engine";
import { describe, expect, it } from "vitest";
import { COMEBACK_MIN_PEAK, comebackStep, ownLand, type ComebackMemory } from "../src/logic/comeback";
import { buildTimeline } from "../src/replay/timeline";
import { titleCards } from "../src/replay/titles";

/** Session 23 (Nate, Oct 10): the comeback card, for your own House only, once a game. */
const run = (lands: number[]) => {
  let m: ComebackMemory | undefined;
  const cards: number[] = [];
  lands.forEach((land, i) => {
    const r = comebackStep(m, land, i + 1);
    m = r.memory;
    if (r.card) cards.push(i + 1);
  });
  return { cards, memory: m! };
};

describe("the comeback card", () => {
  it("plays when your House fell to a quarter of its most land and climbs back above half of it", () => {
    // Up to 20, down to 5 (a quarter), back up to 11 (over half): the card on the turn it got there.
    expect(run([4, 10, 20, 12, 5, 7, 10, 11, 14]).cards).toEqual([8]);
    // Exactly half isn't over half.
    expect(run([20, 5, 10]).cards).toEqual([]);
  });

  it("needs the fall: down to a third and back is just a bad patch", () => {
    expect(run([20, 7, 15, 20]).cards).toEqual([]);
  });

  it("plays once a game, however often it happens", () => {
    const { cards, memory } = run([20, 4, 12, 30, 5, 20, 2, 25]);
    expect(cards).toEqual([3]);
    expect(memory.shown).toBe(3);
  });

  it("a House too small at its height doesn't get one (1 territory to 3 isn't a comeback)", () => {
    expect(run([4, 7, 1, 5]).cards).toEqual([]);
    expect(run([COMEBACK_MIN_PEAK, 2, 5]).cards).toEqual([3]);
  });

  it("counts your own land only: a rival's comeback is hidden by the fog, so it never gets a card", () => {
    const ctx: GameContext = { map: maps.embervale!, rules: defaultRules };
    const g = createGame(ctx, { gameId: "cb", seed: "cb", players: [1, 2, 3, 4].map((i) => ({ id: `p${i}`, name: `P${i}` })) });
    const mine = Object.values(g.territories).filter((t) => t.owner === "p1").length;
    expect(ownLand(viewFor(ctx, g, "p1"))).toBe(mine);
    // A rival's land changing hands doesn't change yours.
    const g2 = { ...g, territories: Object.fromEntries(Object.entries(g.territories).map(([id, t]) => [id, t.owner === "p2" ? { ...t, owner: "p3" } : t])) };
    expect(ownLand(viewFor(ctx, g2, "p1"))).toBe(mine);
    // The title cards only play one when the host says so (it decides from your land), and never for a rival's turn of events.
    const view = viewFor(ctx, g, "p1");
    const ev: ReplayEvent[] = [{ type: "eliminated", step: 1, player: "p3", by: "p2" }];
    expect(titleCards(buildTimeline(ev), view, ctx.map).some((c) => c.text.endsWith("is back"))).toBe(false);
  });

  it("the card: your House by name, a sarcastic subline from the line library, at the end of the replay", () => {
    const ctx: GameContext = { map: maps.embervale!, rules: defaultRules };
    const g = createGame(ctx, { gameId: "cb", seed: "cb", players: [1, 2, 3, 4].map((i) => ({ id: `p${i}`, name: `P${i}` })) });
    const view = viewFor(ctx, g, "p1");
    const tl = buildTimeline([{ type: "eliminated", step: 1, player: "p3", by: "p2" }]);
    const card = titleCards(tl, view, ctx.map, true).find((c) => c.text.endsWith("is back"))!;
    expect(card.text).toMatch(/^House \w+ is back$/);
    expect(lines.screens.titleComeback).toContain(card.sub);
    expect(card.event).toBeNull();
    expect(lines.screens.titleComeback.length).toBeGreaterThanOrEqual(3);
  });
});
