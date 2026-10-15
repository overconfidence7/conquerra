import { describe, expect, it } from "vitest";
import { LOAD_FAILED, onLoadFailure } from "../src/ui/loadFailure";
import { waitingLine } from "../src/ui/OnlineBlock";
import type { OnlineGameInfo } from "../src/host/protocol";

/** Session 28, Step 0: a failed load reloads once, never in a loop; the Finished list says the result. */
describe("session 28, Step 0", () => {
  it("a part that fails to load reloads the page once, then says so in a plain line (never a loop)", () => {
    const box = new Map<string, string>();
    const store = { getItem: (k: string) => box.get(k) ?? null, setItem: (k: string, v: string) => void box.set(k, v) };
    expect(onLoadFailure(1_000_000, store)).toBe("reload");
    // The reloaded page fails again at once: tell, don't reload.
    expect(onLoadFailure(1_002_000, store)).toBe("tell");
    expect(onLoadFailure(1_020_000, store)).toBe("tell");
    // Much later in the same tab (another deploy): one more reload is fine.
    expect(onLoadFailure(1_100_000, store)).toBe("reload");
    // No storage at all: never reload (it could loop).
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => undefined };
    expect(onLoadFailure(5, broken)).toBe("tell");
    expect(LOAD_FAILED).toBe("Something didn't load. Reload the page.");
  });

  it("a game you left that has since ended says the result and the turn you left on", () => {
    const base: OnlineGameInfo = { id: "g", mapId: "embervale", mapName: "Embervale", turn: 17, status: "playing", waitingOn: [], deadline: null, players: [], created: 0, leadersRun: true };
    expect(waitingLine({ ...base, left: "resigned", leftTurn: 2 }, 0).text).toBe("You left this game on turn 2. It goes on without you.");
    expect(waitingLine({ ...base, status: "over", winner: "Lady Morwen", left: "resigned", leftTurn: 2 }, 0).text).toBe("Over: Lady Morwen won. You left on turn 2.");
    expect(waitingLine({ ...base, status: "over", winner: "Lady Morwen", left: "taken", leftTurn: 5 }, 0).text).toBe("Over: Lady Morwen won. A Marshal took your seat on turn 5.");
    expect(waitingLine({ ...base, status: "over", winner: "you" }, 0).text).toBe("Over: you won");
    // A seat from before session 28 has no turn recorded: no wrong turn either.
    expect(waitingLine({ ...base, left: "resigned" }, 0).text).toBe("You left this game. It goes on without you.");
  });
});
