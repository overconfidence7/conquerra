import { describe, expect, it } from "vitest";
import { listingOf } from "../src/logic/mapListing";
import { LONG_FROM, RANDOM_UI } from "../src/ui/RandomMap";
import { useGame } from "../src/store";

/**
 * Session 33b: the lobby offers random maps of 300 and 400 territories. The card says a big map makes a long game,
 * the player count line says who it suits (as for the official maps), and the bots never fall below the map's
 * smallest table (a 400 starts at 6 players).
 */
describe("the lobby's big random maps (session 33b)", () => {
  it("who a 300 and a 400 suit, as the official maps' line says it", () => {
    expect(listingOf("random:300-island-quiet-heron")).toMatchObject({ territories: 300, minPlayers: 4, maxPlayers: 12, recommendedPlayers: { min: 8, max: 10 } });
    expect(listingOf("random:400-crescent-quiet-heron")).toMatchObject({ territories: 400, minPlayers: 6, maxPlayers: 16, recommendedPlayers: { min: 10, max: 10 } });
  });

  it("the card's line for the big sizes, in the voice", () => {
    expect(LONG_FROM).toBe(300);
    expect(RANDOM_UI.long).toBe("A long game in Classic: plan on 50 turns or more.");
  });

  it("a 400 starts at its suggested table, and the bots never drop below its smallest", () => {
    const { setLobby } = useGame.getState();
    setLobby({ mapId: "random:400-island-quiet-heron" });
    expect(useGame.getState().lobby.bots).toBe(9);
    setLobby({ bots: 2 });
    expect(useGame.getState().lobby.bots).toBe(5);
    setLobby({ mapId: "random:300-island-quiet-heron", bots: 1 });
    expect(useGame.getState().lobby.bots).toBe(3);
    setLobby({ mapId: "embervale", bots: 3 });
    expect(useGame.getState().lobby.bots).toBe(3);
  });
});
