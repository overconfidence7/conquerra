import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { createGame, viewFor, type GameContext } from "@conquerra/engine";
import { describe, expect, it } from "vitest";
import { landLeader, readyEvents } from "../src/logic/fallen";

const ctx: GameContext = { map: maps.embervale!, rules: defaultRules };

describe("the Fallen's first turn out (session 19)", () => {
  function fallenView(influence: number) {
    const s = createGame(ctx, { gameId: "f", seed: "fallen-first", players: ["you", "b1", "b2", "b3"].map((id) => ({ id, name: id })) });
    // You're out; b1 holds the most land.
    for (const t of Object.keys(s.territories)) if (s.territories[t]!.owner === "you") s.territories[t]!.owner = "b1";
    const extra = ctx.map.territories.find((t) => s.territories[t.id]!.owner === null)!.id;
    s.territories[extra]!.owner = "b1";
    const me = s.players.find((p) => p.id === "you")!;
    me.eliminatedTurn = 1;
    me.influence = influence;
    return viewFor(ctx, s, "you");
  }

  it("lists the events you can play right now, cheapest first, and none that are resting or too dear", () => {
    const cfg = ctx.rules.fallen;
    const v = fallenView(cfg.startInfluence + cfg.influenceBase);
    const ready = readyEvents(ctx, v, Math.floor(v.me.influence));
    expect(ready.length).toBeGreaterThanOrEqual(2);
    expect(ready[0]).toBe("storm");
    for (const k of ready) expect(cfg.events[k].cost).toBeLessThanOrEqual(v.me.influence);
    expect(readyEvents(ctx, { ...v, eventCooldowns: { ...v.eventCooldowns, storm: 2 } }, Math.floor(v.me.influence))).not.toContain("storm");
    expect(readyEvents(ctx, v, 0)).toEqual([]);
  });

  it("names whoever holds the most land on the political map", () => {
    expect(landLeader(ctx, fallenView(9))).toMatchObject({ player: "b1" });
  });
});
