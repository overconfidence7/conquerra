import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayerView } from "@conquerra/engine";
import { canProposeTo } from "../src/logic/deals";
import { CALM_MS, holdNotices, showNotice, useGame, WINDOW_OPEN } from "../src/store";

/** Session 29, Step 0: quiet notices wait their turn behind a warning; a seat a Marshal plays can't deal. */
describe("session 29, Step 0", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useGame.setState({ notice: null, noticeCalm: false });
  });
  afterEach(() => vi.useRealTimers());

  it("a quiet notice that comes while a warning shows waits, then shows when the warning goes (one at a time)", () => {
    showNotice("Something went wrong with that order.", false);
    showNotice("Kit accepted your truce.", true);
    showNotice("Wren declined your trade.", true);
    // The warning stays on screen, alone.
    expect(useGame.getState()).toMatchObject({ notice: "Something went wrong with that order.", noticeCalm: false });
    useGame.getState().dismissNotice();
    expect(useGame.getState()).toMatchObject({ notice: "Kit accepted your truce.", noticeCalm: true });
    vi.advanceTimersByTime(CALM_MS);
    expect(useGame.getState().notice).toBe("Wren declined your trade.");
    vi.advanceTimersByTime(CALM_MS);
    expect(useGame.getState().notice).toBeNull();
  });

  it("news never covers news either: it queues, and the same line twice shows once", () => {
    showNotice("Reconnected", true);
    showNotice("Reconnected", true);
    showNotice("Kit accepted your truce.", true);
    expect(useGame.getState().notice).toBe("Reconnected");
    vi.advanceTimersByTime(CALM_MS);
    expect(useGame.getState().notice).toBe("Kit accepted your truce.");
    vi.advanceTimersByTime(CALM_MS);
    expect(useGame.getState().notice).toBeNull();
    // A warning still shows at once, over news.
    showNotice("Reconnected", true);
    showNotice("The game is paused.", false);
    expect(useGame.getState()).toMatchObject({ notice: "The game is paused.", noticeCalm: false });
  });

  it("session 29, Part 3: quiet news waits while the replay plays, then shows (a warning never waits)", () => {
    holdNotices(true);
    showNotice(WINDOW_OPEN(12), true);
    expect(useGame.getState().notice).toBeNull();
    showNotice("Something went wrong.", false);
    expect(useGame.getState().notice).toBe("Something went wrong.");
    useGame.getState().dismissNotice();
    expect(useGame.getState().notice).toBeNull();
    holdNotices(false);
    expect(useGame.getState().notice).toBe("Turn 12 is open for orders.");
    vi.advanceTimersByTime(CALM_MS);
  });

  it("a seat a Marshal plays now (you resigned or were taken over) can't propose a deal", () => {
    const view = {
      me: { id: "p1", eliminatedTurn: null },
      players: [
        { id: "p1", eliminatedTurn: null },
        { id: "p2", eliminatedTurn: null },
      ],
      settings: { diplomacy: true },
      winner: null,
      deals: [],
    } as unknown as PlayerView;
    expect(canProposeTo(view, "p2")).toBe(true);
    expect(canProposeTo(view, "p2", true)).toBe(false);
  });
});
