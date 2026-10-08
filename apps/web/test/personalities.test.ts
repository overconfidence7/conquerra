import { maps } from "@conquerra/content/maps";
import type { GameState, PlayerView } from "@conquerra/engine";
import { describe, expect, it } from "vitest";
import { LocalGame } from "../src/host/localGame";
import type { LobbySettings } from "../src/host/protocol";
import { leaderSays } from "../src/logic/narrate";
import { namer, styledName, styleLabel, styleNote } from "../src/logic/text";

/** Session 20c (Nate): leaders with personalities, from the lobby to the report. */
const settings: LobbySettings = { mapId: "embervale", bots: 3, botLevel: "marshal", luck: 0.3, fog: true, mode: "classic", turnSeconds: null, leaderName: "Aldric", leaderPersonality: "conqueror", stewardPersonality: "turtle" };

describe("leaders with personalities (session 20c)", () => {
  it("the lobby's choice reaches the game: your Leader and Steward carry it", () => {
    const g = new LocalGame(maps.embervale!, settings, "styles");
    const me = g.update().view.me;
    expect(me.leaders.map((l) => [l.kind, l.personality])).toEqual([
      ["leader", "conqueror"],
      ["steward", "turtle"],
    ]);
  });

  it("the bots' Leaders and Stewards carry their Marshal's personality (Captains' are Neutral)", () => {
    const g = new LocalGame(maps.embervale!, settings, "styles");
    const state = (g as unknown as { state: GameState }).state;
    const seats = (g as unknown as { seats: Map<string, { personality?: string }> }).seats;
    for (const p of state.players.filter((x) => x.id !== "you")) {
      const dealt = seats.get(p.id)?.personality;
      expect(dealt).toBeTruthy();
      expect(p.leaders.map((l) => l.personality)).toEqual([dealt, dealt]);
    }
    const captains = new LocalGame(maps.embervale!, { ...settings, botLevel: "captain" }, "styles");
    for (const p of (captains as unknown as { state: GameState }).state.players.filter((x) => x.id !== "you")) expect(p.leaders.map((l) => l.personality)).toEqual([null, null]);
  });

  it("Neutral when you don't pick", () => {
    const g = new LocalGame(maps.embervale!, { ...settings, leaderPersonality: null, stewardPersonality: undefined }, "styles");
    expect(g.update().view.me.leaders.map((l) => l.personality)).toEqual([null, null]);
  });

  it("the Leaders panel says 'Aldric, the Conqueror'; the lobby has a line for each", () => {
    expect(styledName("Aldric", "conqueror")).toBe("Aldric, the Conqueror");
    expect(styledName("Aldric", null)).toBe("Aldric");
    expect(styleLabel(null)).toBe("Neutral");
    expect(styleNote("turtle", "steward")).toMatch(/forts and culture first/);
  });

  it("a leader with a personality speaks in its own voice in the report; a Neutral one says nothing", () => {
    const g = new LocalGame(maps.embervale!, settings, "styles");
    const view: PlayerView = g.update().view;
    const n = namer(g.ctx, view);
    const rival = view.players.find((p) => p.id !== view.me.id)!.id;
    const said = leaderSays(n, view.me.id, ["Ashfell", "Pinemark"], rival);
    expect(said).toMatch(/^Aldric, the Conqueror: “Took Ashfell and Pinemark; .+'s lot ran\.”$/);
    const neutral = { ...view, me: { ...view.me, leaders: view.me.leaders.map((l) => ({ ...l, personality: null })) } };
    expect(leaderSays(namer(g.ctx, neutral), view.me.id, ["Ashfell"], rival)).toBeNull();
  });
});
