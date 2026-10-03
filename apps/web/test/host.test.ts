import { recruitBot } from "@conquerra/bots";
import { describe, expect, it } from "vitest";
import { HUMAN_ID, LocalGame, REPORT_GRACE_MS } from "../src/host/localGame";
import { formatClock, remainingMs, timerTone } from "../src/logic/timer";
import type { LobbySettings } from "../src/host/protocol";

const settings: LobbySettings = { mapId: "embervale", bots: 3, luck: 0.3, fog: true, mode: "classic", turnSeconds: 300 };
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

describe("turn timer (kept by the host)", () => {
  const clockGame = (turnSeconds: number | null) => {
    let now = 1_000_000;
    const g = new LocalGame({ ...settings, turnSeconds }, "timer-test", () => now);
    return { g, advance: (ms: number) => (now += ms), now: () => now };
  };

  it("counts down from the game's timer setting", () => {
    const { g, now } = clockGame(60);
    expect(g.update().clock).toEqual({ endsAt: now() + 60_000, turnMs: 60_000 });
  });

  it("when time runs out, your saved orders lock in exactly as if you'd pressed Lock in", () => {
    const { g, advance } = clockGame(60);
    const plan = recruitBot.plan(g.ctx, g.update().view);
    g.saveOrders(plan, 1);
    advance(59_000);
    expect(g.expireIfDue()).toBeNull();
    advance(1_000);
    const u = g.expireIfDue()!;
    expect(u.autoLocked).toBe(true);
    expect(u.view.turn).toBe(2);
    // Same result as pressing Lock in with those orders.
    const twin = clockGame(60);
    const manual = twin.g.lockIn(plan, 1);
    expect(u.view).toEqual(manual.view);
    expect(u.report).toEqual(manual.report);
  });

  it("the next countdown starts after the replay and a moment for the report", () => {
    const { g, advance, now } = clockGame(180);
    advance(5_000);
    const u = g.lockIn([], 1);
    const replay = u.clock!.endsAt - now() - 180_000;
    expect(replay).toBeGreaterThan(REPORT_GRACE_MS);
    expect(replay).toBeLessThan(25_000 + REPORT_GRACE_MS);
  });

  it("a late Lock in for a turn the timer already locked in changes nothing", () => {
    const { g, advance } = clockGame(60);
    advance(61_000);
    const auto = g.expireIfDue()!;
    const late = g.lockIn([{ id: "x", kind: "recruit", territory: auto.view.me.capital, count: 1 }], 1);
    expect(late.report).toBeNull();
    expect(late.view).toEqual(auto.view);
  });

  it("orders saved for an old turn don't carry into the next", () => {
    const { g, advance } = clockGame(60);
    const plan = recruitBot.plan(g.ctx, g.update().view);
    g.lockIn([], 1);
    g.saveOrders(plan, 1); // stale
    advance(10 * 60_000);
    const u = g.expireIfDue()!;
    expect(u.report!.events.some((e) => e.type === "recruited" && e.player === HUMAN_ID)).toBe(false);
  });

  it("No timer: no countdown, nothing ever locks in by itself", () => {
    const { g, advance } = clockGame(null);
    expect(g.update().clock).toBeNull();
    advance(365 * 24 * 3600 * 1000);
    expect(g.expireIfDue()).toBeNull();
    expect(g.lockIn([], 1).clock).toBeNull();
  });
});

describe("timer warnings", () => {
  it("calm, then gold at 1 minute, then red at 15 seconds", () => {
    expect(timerTone(5 * 60_000)).toBe("calm");
    expect(timerTone(60_001)).toBe("calm");
    expect(timerTone(60_000)).toBe("gold");
    expect(timerTone(15_001)).toBe("gold");
    expect(timerTone(15_000)).toBe("red");
    expect(timerTone(0)).toBe("red");
  });
  it("shows the full turn while the replay is still playing, and never below zero", () => {
    const clock = { endsAt: 100_000, turnMs: 60_000 };
    expect(remainingMs(clock, 0)).toBe(60_000);
    expect(remainingMs(clock, 70_000)).toBe(30_000);
    expect(remainingMs(clock, 200_000)).toBe(0);
    expect(formatClock(299_100)).toBe("5:00");
    expect(formatClock(7_000)).toBe("0:07");
  });
});
