import { defaultRules, maps } from "@conquerra/content";
import { createGame, resolveTurn, viewFor, type GameContext, type GameState } from "@conquerra/engine";
import { describe, expect, it } from "vitest";
import { recruitBot } from "../src";

const ctx: GameContext = { map: maps.embervale!, rules: defaultRules };

function play(seed: string, players = 3): { state: GameState; transcript: string } {
  let s = createGame(ctx, {
    gameId: seed,
    seed,
    players: Array.from({ length: players }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}` })),
  });
  const parts: string[] = [];
  while (!s.winner) {
    const orders = Object.fromEntries(
      s.players.filter((p) => p.eliminatedTurn === null).map((p) => [p.id, recruitBot.plan(ctx, viewFor(ctx, s, p.id))]),
    );
    const r = resolveTurn(ctx, s, orders);
    parts.push(JSON.stringify(r.events));
    s = r.state;
  }
  return { state: s, transcript: parts.join("\n") };
}

describe("Recruit bot", () => {
  it("plays a full game to the end without errors", () => {
    const { state } = play("bot-full");
    expect(state.winner).not.toBeNull();
  });
  it("full bot games are perfectly reproducible from the seed", () => {
    expect(play("replay-check").transcript).toBe(play("replay-check").transcript);
  });
  it("only issues orders it could plausibly carry out from its own view", () => {
    const s = createGame(ctx, { gameId: "v", seed: "v", players: [{ id: "a", name: "A" }, { id: "b", name: "B" }] });
    const view = viewFor(ctx, s, "a");
    const orders = recruitBot.plan(ctx, view);
    expect(orders.length).toBeGreaterThan(0);
    for (const o of orders) {
      if (o.kind === "move") expect(view.territories[o.from]).toMatchObject({ visible: true, owner: "a" });
      if (o.kind === "recruit") expect(o.territory).toBe(view.me.capital);
    }
  });
});
