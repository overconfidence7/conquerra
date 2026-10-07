import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { createGame, resolveTurn, viewFor, type GameContext, type GameState } from "@conquerra/engine";
import { describe, expect, it } from "vitest";
import { planFallen } from "../src";

const ctx: GameContext = { map: maps.embervale!, rules: defaultRules };

/** p4 was knocked out last turn; p1, p2 and p3 hold the same land (nobody is ahead). */
function game(): GameState {
  const s = createGame(ctx, { gameId: "fallen-bot", seed: "fallen-bot", players: ["p1", "p2", "p3", "p4"].map((id) => ({ id, name: id })) });
  const free = ctx.map.territories.filter((t) => s.territories[t.id]!.owner === null).map((t) => t.id);
  for (const t of Object.keys(s.territories)) if (s.territories[t]!.owner === "p4") s.territories[t]!.owner = null;
  // Three more each.
  const give = (p: string, n: number) => {
    for (let i = 0; i < n; i++) {
      const t = free.shift()!;
      s.territories[t] = { owner: p, troops: 2, specialists: [], building: null, construction: null, culture: 0 };
    }
  };
  give("p1", 3);
  give("p2", 3);
  give("p3", 3);
  const out = s.players.find((p) => p.id === "p4")!;
  s.turn = 6;
  out.eliminatedTurn = 5;
  out.influence = defaultRules.fallen.startInfluence + defaultRules.fallen.influenceBase;
  return s;
}

describe("a Fallen bot's first turn out (session 19)", () => {
  it("strikes one of those holding the most land straight away, with an event it can afford", () => {
    const s = game();
    const orders = planFallen(ctx, viewFor(ctx, s, "p4"));
    expect(orders).toHaveLength(1);
    const o = orders[0]!;
    expect(o.kind).toBe("worldEvent");
    if (o.kind !== "worldEvent") return;
    expect(ctx.rules.fallen.events[o.event].cost).toBeLessThanOrEqual(s.players[3]!.influence);
    const against = s.territories[o.target]!.owner;
    expect(["p1", "p2", "p3"]).toContain(against);
    // And it lands: the engine plays it before anyone's orders.
    const r = resolveTurn(ctx, s, { p4: orders });
    expect(r.events.some((e) => e.type === "worldEvent" && e.against === against)).toBe(true);
  });

  it("later, with nobody clearly ahead, it saves its Influence as before", () => {
    const s = game();
    s.turn = 9;
    expect(planFallen(ctx, viewFor(ctx, s, "p4"))).toEqual([]);
  });
});
