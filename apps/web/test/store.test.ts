import { beforeEach, describe, expect, it } from "vitest";
import { LocalGame } from "../src/host/localGame";
import type { GameHost, LobbySettings } from "../src/host/protocol";
import { knockedOut, setHostFactory, useGame } from "../src/store";

/** The real game, run in-process instead of in a Web Worker. */
function inProcessHost(seed: string): GameHost {
  let game: LocalGame | null = null;
  return {
    start: async (s: LobbySettings) => (game = new LocalGame(s, seed)).start(),
    lockIn: async (orders) => game!.lockIn(orders),
    watchNext: async () => game!.watchNext(),
    finish: async () => game!.finish(),
    suggest: async () => game!.suggest(),
    dispose: () => {},
  };
}

async function playUntilKnockedOut() {
  const g = useGame.getState();
  g.setLobby({ mapId: "embervale", bots: 2 });
  await useGame.getState().start();
  for (let i = 0; i < 80; i++) {
    const v = useGame.getState().view!;
    if (v.winner || knockedOut(v)) break;
    await useGame.getState().lockIn();
  }
}

describe("game screen state", () => {
  beforeEach(() => {
    setHostFactory(() => inProcessHost("store-idle"));
    useGame.getState().playAgain();
  });

  it("gets the map from the host when the game starts", async () => {
    await useGame.getState().start();
    const { ctx, view, screen } = useGame.getState();
    expect(screen).toBe("game");
    expect(ctx!.map.geometry).toBeDefined();
    expect(ctx!.map.id).toBe(useGame.getState().lobby.mapId);
    expect(view!.me.capital).toBeTruthy();
  });

  it("switching to Greatmarch picks a table it suits (8 players, Conquest suggested)", () => {
    useGame.getState().setLobby({ mapId: "greatmarch" });
    expect(useGame.getState().lobby).toMatchObject({ mapId: "greatmarch", bots: 7, mode: "conquest" });
    useGame.getState().setLobby({ mapId: "embervale" });
    expect(useGame.getState().lobby.bots).toBe(3);
  });

  it("knocked out: the choice shows; 'Watch to the end' plays on turn by turn on the full map", async () => {
    await playUntilKnockedOut();
    let s = useGame.getState();
    expect(knockedOut(s.view!)).toBe(true);
    expect(s.screen).toBe("game"); // not whisked off to the result
    expect(s.watching).toBe(false);
    expect(s.showReport).toBe(false);

    s.watch();
    expect(useGame.getState().watching).toBe(true);
    const turn = useGame.getState().view!.turn;
    await useGame.getState().watchNext();
    s = useGame.getState();
    if (s.screen === "game") {
      expect(s.view!.turn).toBe(turn + 1);
      expect(s.report?.turn).toBe(turn);
      expect(Object.values(s.view!.territories).every((t) => t.detail === "full")).toBe(true);
      // The skip-ahead.
      await s.seeResult();
    }
    expect(useGame.getState().screen).toBe("over");
    expect(useGame.getState().view!.winner).not.toBeNull();
  });

  it("knocked out: 'See the result' goes straight to the end", async () => {
    await playUntilKnockedOut();
    expect(knockedOut(useGame.getState().view!)).toBe(true);
    await useGame.getState().seeResult();
    const s = useGame.getState();
    expect(s.screen).toBe("over");
    expect(s.view!.winner).not.toBeNull();
    expect(s.fastForwarded).toBeGreaterThan(0);
  });
});
