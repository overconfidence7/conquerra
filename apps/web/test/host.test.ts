import { recruitBot } from "@conquerra/bots";
import { describe, expect, it } from "vitest";
import { HUMAN_ID, LocalGame } from "../src/host/localGame";
import type { LobbySettings } from "../src/host/protocol";

const settings: LobbySettings = { mapId: "embervale", bots: 3, luck: 0.3, fog: true, mode: "classic" };

describe("local game host", () => {
  it("only ever hands out the player's own fogged view, never the full state", () => {
    const g = new LocalGame(settings, "host-test");
    const u = g.update();
    expect(u.playerId).toBe(HUMAN_ID);
    expect(u.view.me.id).toBe(HUMAN_ID);
    const json = JSON.stringify(u);
    expect(json).not.toContain('"rng"');
    expect(Object.values(u.view.territories).some((t) => t.detail === "fogged")).toBe(true);
    expect(u.view.players.map((p) => p.name)).toEqual(["You", "Lady Morwen", "Baron Krell", "Queen Isolde"]);
  });

  it("a game can be played to the end from the view alone (the human plays like a Recruit bot)", () => {
    const g = new LocalGame(settings, "full-game");
    let u = g.update();
    let turns = 0;
    while (!u.view.winner && turns < 80) {
      u = g.lockIn(recruitBot.plan(g.ctx, u.view));
      expect(u.report?.turn).toBe(turns + 1);
      turns++;
      if (u.fastForwarded) break;
    }
    expect(u.view.winner).not.toBeNull();
    expect(u.report!.events.length).toBeGreaterThan(0);
  });

  it("if you're knocked out, the bots play on to a winner", () => {
    const g = new LocalGame({ ...settings, bots: 2 }, "idle");
    let u = g.update();
    for (let i = 0; i < 80 && !u.view.winner; i++) u = g.lockIn([]);
    expect(u.view.winner).not.toBeNull();
    const me = u.view.players.find((p) => p.id === HUMAN_ID)!;
    if (me.eliminatedTurn !== null) {
      expect(me.eliminatedBy).not.toBeNull();
      expect(Object.values(u.view.territories).every((t) => t.detail === "full")).toBe(true);
    }
    expect(() => g.lockIn([])).toThrow();
  });
});
