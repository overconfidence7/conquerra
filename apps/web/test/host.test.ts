import { recruitBot } from "@conquerra/bots";
import { describe, expect, it } from "vitest";
import { HUMAN_ID, LocalGame } from "../src/host/localGame";
import type { LobbySettings } from "../src/host/protocol";

const settings: LobbySettings = { mapId: "embervale", bots: 3, luck: 0.3, fog: true, mode: "classic" };
const isOut = (g: LocalGame, u: ReturnType<LocalGame["update"]>) => u.view.players.find((p) => p.id === HUMAN_ID)!.eliminatedTurn !== null;

describe("local game host", () => {
  it("sends the map and rules once at the start, then only the player's own fogged view, never the full state", () => {
    const g = new LocalGame(settings, "host-test");
    const s = g.start();
    expect(s.map.id).toBe("embervale");
    expect(s.map.geometry?.territories.length).toBe(40);
    expect(s.rules.troops.cost).toBeGreaterThan(0);
    const u = g.update();
    expect(u.playerId).toBe(HUMAN_ID);
    expect(u.view.me.id).toBe(HUMAN_ID);
    const json = JSON.stringify(u);
    expect(json).not.toContain('"rng"');
    expect(json).not.toContain('"rings"');
    expect(Object.values(u.view.territories).some((t) => t.detail === "fogged")).toBe(true);
    expect(u.view.players.map((p) => p.name)).toEqual(["You", "Lady Morwen", "Baron Krell", "Queen Isolde"]);
  });

  it.each([
    ["embervale", 3, "classic"],
    ["greatmarch", 7, "conquest"],
  ] as const)("a game on %s can be played to the end from the view alone", (mapId, bots, mode) => {
    const g = new LocalGame({ ...settings, mapId, bots, mode }, `full-${mapId}`);
    let u = g.update();
    let turns = 0;
    while (!u.view.winner && turns < 80) {
      if (isOut(g, u)) {
        u = g.finish();
        break;
      }
      u = g.lockIn(recruitBot.plan(g.ctx, u.view));
      expect(u.report?.turn).toBe(turns + 1);
      turns++;
    }
    expect(u.view.winner).not.toBeNull();
    expect(u.report!.events.length).toBeGreaterThan(0);
  });

  it("once you're knocked out you choose: watch turn by turn (whole map, each report) or skip to the result", () => {
    const g = new LocalGame({ ...settings, bots: 3 }, "idle");
    let u = g.update();
    // Do nothing until a bot knocks you out.
    for (let i = 0; i < 80 && !u.view.winner && !isOut(g, u); i++) u = g.lockIn([]);
    expect(isOut(g, u)).toBe(true);
    expect(u.view.winner).toBeNull(); // the game goes on without you; nothing was skipped
    expect(u.fastForwarded).toBe(0);
    expect(() => g.lockIn([])).toThrow(/knocked out/);

    // Watch: one turn at a time, seeing everything.
    const before = u.view.turn;
    u = g.watchNext();
    expect(u.view.turn).toBe(before + 1);
    expect(u.report?.turn).toBe(before);
    expect(Object.values(u.view.territories).every((t) => t.detail === "full")).toBe(true);

    // Skip ahead to the result.
    if (!u.view.winner) {
      u = g.finish();
      expect(u.fastForwarded).toBeGreaterThan(0);
    }
    expect(u.view.winner).not.toBeNull();
    expect(() => g.watchNext()).toThrow(/over/);
  });

  it("you can't watch or skip ahead while you're still in the game", () => {
    const g = new LocalGame(settings, "still-in");
    expect(() => g.watchNext()).toThrow(/still in/);
    expect(() => g.finish()).toThrow(/still in/);
  });
});
