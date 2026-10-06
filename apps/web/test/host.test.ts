import { maps } from "@conquerra/content/maps";
import { recruitBot } from "@conquerra/bots";
import { readFileSync } from "node:fs";
import { readSave, replaySavedGame, stateFingerprint, type SaveFile } from "@conquerra/engine";
import { HostCore } from "../src/host/hostCore";
import { memorySaveStore, SAVE_ERRORS, type SaveStore } from "../src/host/saves";
import { describe, expect, it } from "vitest";
import { HUMAN_ID, LocalGame, REPORT_GRACE_MS } from "../src/host/localGame";
import { formatClock, remainingMs, timerTone } from "../src/logic/timer";
import type { HostUpdate, LobbySettings } from "../src/host/protocol";

const settings: LobbySettings = { mapId: "embervale", bots: 3, botLevel: "captain", luck: 0.3, fog: true, mode: "classic", turnSeconds: 300 };
const isOut = (g: LocalGame, u: ReturnType<LocalGame["update"]>) => u.view.players.find((p) => p.id === HUMAN_ID)!.eliminatedTurn !== null;

describe("local game host", () => {
  it("sends the map and rules once at the start, then only the player's own fogged view, never the full state", () => {
    const g = new LocalGame(maps[settings.mapId]!, settings, "host-test");
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
    const g = new LocalGame(maps[mapId]!, { ...settings, mapId, bots, mode }, `full-${mapId}`);
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

  it("once you're knocked out you choose: watch turn by turn as one of the Fallen (political map, each report) or skip to the result", () => {
    const g = new LocalGame(maps[settings.mapId]!, { ...settings, bots: 3 }, "idle-2");
    let u = g.update();
    // Do nothing until a bot knocks you out.
    for (let i = 0; i < 80 && !u.view.winner && !isOut(g, u); i++) u = g.lockIn([]);
    expect(isOut(g, u)).toBe(true);
    expect(u.view.winner).toBeNull(); // the game goes on without you; nothing was skipped
    expect(u.fastForwarded).toBe(0);
    expect(() => g.lockIn([])).toThrow(/knocked out/);

    // Watch: one turn at a time, as one of the Fallen: who holds what, no troops.
    const before = u.view.turn;
    u = g.watchNext();
    expect(u.view.turn).toBe(before + 1);
    expect(u.report?.turn).toBe(before);
    expect(Object.values(u.view.territories).every((t) => t.detail === "fogged" && t.lastSeen?.political)).toBe(true);

    // Skip ahead to the result.
    if (!u.view.winner) {
      u = g.finish();
      expect(u.fastForwarded).toBeGreaterThan(0);
    }
    expect(u.view.winner).not.toBeNull();
    expect(() => g.watchNext()).toThrow(/over/);
  });

  it("you can't watch or skip ahead while you're still in the game", () => {
    const g = new LocalGame(maps[settings.mapId]!, settings, "still-in");
    expect(() => g.watchNext()).toThrow(/still in/);
    expect(() => g.finish()).toThrow(/still in/);
  });
});

describe("turn timer (kept by the host)", () => {
  const clockGame = (turnSeconds: number | null) => {
    let now = 1_000_000;
    const g = new LocalGame(maps[settings.mapId]!, { ...settings, turnSeconds }, "timer-test", () => now);
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

  it("Pause stops the clock: nothing locks in while paused, and Resume carries on with the time that was left", () => {
    const { g, advance } = clockGame(60);
    advance(20_000);
    const paused = g.pause();
    expect(paused.clock).toMatchObject({ turnMs: 60_000, pausedLeft: 40_000 });
    expect(remainingMs(paused.clock!, 0)).toBe(40_000);
    expect(g.nextDeadline).toBeNull();
    advance(60 * 60_000); // an hour away
    expect(g.expireIfDue()).toBeNull();
    expect(g.update().view.turn).toBe(1);
    // You can still plan while paused: orders are kept, and Lock in works.
    const resumed = g.resume();
    expect(resumed.clock!.pausedLeft).toBeUndefined();
    advance(39_000);
    expect(g.expireIfDue()).toBeNull();
    advance(1_000);
    expect(g.expireIfDue()!.view.turn).toBe(2);
    // The next turn starts with a running clock.
    expect(g.update().clock!.pausedLeft).toBeUndefined();
  });

  it("with no timer there's nothing to pause", () => {
    const { g } = clockGame(null);
    expect(g.pause().clock).toBeNull();
    expect(g.isPaused).toBe(false);
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

describe("saved games", () => {
  const map = maps[settings.mapId]!;
  /** Your orders each turn: a Recruit bot's plan from your own view (deterministic). */
  const play = (g: LocalGame, turns: number) => {
    let u = g.update();
    for (let i = 0; i < turns && !u.view.winner && !isOut(g, u); i++) u = g.lockIn(recruitBot.plan(g.ctx, u.view));
    return u;
  };

  it("save, load and carry on gives exactly the same game as playing straight through", () => {
    const straight = new LocalGame(map, settings, "continue-test");
    const end = play(straight, 12);

    const first = new LocalGame(map, settings, "continue-test");
    play(first, 5);
    // Through JSON, as it is on the device or in a file.
    const read = readSave(JSON.parse(JSON.stringify(first.snapshot())));
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const carried = LocalGame.restore(map, read.save);
    expect(carried.update().view).toEqual(first.update().view);
    const end2 = play(carried, 7);

    expect(end2.view).toEqual(end.view);
    expect(end2.report).toEqual(end.report);
    expect(stateFingerprint(carried.snapshot().state)).toBe(stateFingerprint(straight.snapshot().state));
  });

  it("the game saves itself at the start of every turn's planning; Continue picks up where you were; a finished game leaves", async () => {
    const store = memorySaveStore();
    const core = new HostCore(store, async (id) => maps[id]!);
    let u: HostUpdate = await core.start({ ...settings, bots: 2 }, "autosave-test");
    await core.flush();
    expect((await store.list()).map((s) => [s.slot, s.summary.turn])).toEqual([["auto", 1]]);
    for (let turn = 1; turn <= 4; turn++) {
      u = core.lockIn(recruitBot.plan(core.game!.ctx, u.view), turn);
      await core.flush();
      const auto = readSave(await store.get("auto"));
      expect(auto.ok && auto.save.state.turn).toBe(turn + 1);
    }
    // Close the tab; open it again: Continue.
    const again = new HostCore(store, async (id) => maps[id]!);
    const back = await again.load({ slot: "auto" });
    expect(back.view).toEqual(u.view);
    expect(back.map.id).toBe("embervale");
    // Play to the end: a finished game is no longer offered to Continue.
    let v: HostUpdate = back;
    for (let i = 0; i < 80 && !v.view.winner; i++) v = v.view.players.find((p) => p.id === HUMAN_ID)!.eliminatedTurn === null ? again.lockIn([], v.view.turn) : again.finish();
    await again.flush();
    expect(v.view.winner).not.toBeNull();
    expect(await store.get("auto")).toBeNull();
  });

  it("save slots show map, players, turn and date, and load the game they hold", async () => {
    const store = memorySaveStore();
    let t = Date.UTC(2026, 9, 6, 15, 0);
    const core = new HostCore(store, async (id) => maps[id]!, () => {}, () => t);
    let u: HostUpdate = await core.start(settings, "slots-test");
    u = core.lockIn([], 1);
    const info = await core.saveTo("slot2");
    expect(info).toMatchObject({ slot: "slot2", savedAt: t, summary: { mapName: "Embervale", players: ["You", "Lady Morwen", "Baron Krell", "Queen Isolde"], you: "You", turn: 2 } });
    t += 60_000;
    core.lockIn([], 2);
    const loaded = await core.load({ slot: "slot2" });
    expect(loaded.view).toEqual(u.view);
    await expect(core.load({ slot: "slot3" })).rejects.toThrow("That save slot is empty.");
  });

  it("Save to a file loads back from the file, and plays back move by move with pnpm sim --replay", async () => {
    const core = new HostCore(memorySaveStore(), async (id) => maps[id]!);
    await core.start(settings, "file-test");
    let u = core.game!.update();
    for (let i = 0; i < 6 && !u.view.winner; i++) u = core.lockIn(recruitBot.plan(core.game!.ctx, u.view), u.view.turn);
    const file = JSON.stringify(core.exportSave({ app: "test" }));
    const save = JSON.parse(file) as SaveFile;
    expect(save).toMatchObject({ format: "conquerra-save", version: 2, mapId: "embervale", notes: { app: "test", bots: "captain" } });
    expect(save.history!.turns).toHaveLength(6);
    expect(save.history!.setup.seed).toBe("file-test");
    const { matches, state } = replaySavedGame({ map, rules: save.history!.rules }, save.history!, stateFingerprint(save.state));
    expect(matches).toBe(true);
    expect(state.turn).toBe(u.view.turn);
    // A tampered file is caught.
    save.history!.turns[2]![HUMAN_ID] = [];
    expect(replaySavedGame({ map, rules: save.history!.rules }, save.history!, stateFingerprint(save.state)).matches).toBe(false);
    // Load a file: the same game.
    const other = new HostCore(memorySaveStore(), async (id) => maps[id]!);
    expect((await other.load({ file })).view).toEqual(u.view);
  });

  it("a save from an older version, a file that isn't a save, or a changed map each say why instead of loading", async () => {
    const core = new HostCore(memorySaveStore(), async (id) => maps[id]!);
    const v1 = { format: "conquerra-save", version: 1, mapId: "embervale", mapVersion: 2, rules: {}, setup: {}, turns: [], fingerprint: "" };
    await expect(core.load({ file: JSON.stringify(v1) })).rejects.toThrow("This save is from an older version of Conquerra and can't be loaded.");
    await expect(core.load({ file: "not json at all" })).rejects.toThrow("This file isn't a Conquerra save.");
    await expect(core.load({ file: '{"some":"thing"}' })).rejects.toThrow("This file isn't a Conquerra save.");
    const fixture = JSON.parse(readFileSync(new URL("../../../packages/engine/test/fixtures/save-v2-session13.json", import.meta.url), "utf8")) as SaveFile;
    await expect(core.load({ file: JSON.stringify({ ...fixture, mapVersion: 999 }) })).rejects.toThrow("This save's map has changed since it was saved, so it can't be loaded.");
    await expect(core.load({ file: JSON.stringify({ ...fixture, mapId: "atlantis" }) })).rejects.toThrow("This save's map isn't in this version of the game, so it can't be loaded.");
  });

  it("the save made at the start of session 13 carries on in today's game", async () => {
    const core = new HostCore(memorySaveStore(), async (id) => maps[id]!);
    const file = readFileSync(new URL("../../../packages/engine/test/fixtures/save-v2-session13.json", import.meta.url), "utf8");
    const u = await core.load({ file });
    expect(u.view.turn).toBe(5);
    expect(u.clock).toMatchObject({ turnMs: 300_000 });
    const next = core.lockIn(recruitBot.plan(core.game!.ctx, u.view), 5);
    expect(next.view.turn).toBe(6);
  });

  it("when the device can't save (private window, full disk), the player gets a plain message and the game goes on", async () => {
    const failing = (name: string): SaveStore => ({
      ...memorySaveStore(),
      put: async () => {
        throw Object.assign(new Error("boom"), { name });
      },
    });
    const notices: string[] = [];
    const core = new HostCore(failing("QuotaExceededError"), async (id) => maps[id]!, (m) => notices.push(m));
    await core.start(settings, "full-disk");
    await core.flush();
    expect(notices).toEqual([`Autosave: ${SAVE_ERRORS.full}`]);
    await expect(core.saveTo("slot1")).rejects.toThrow(SAVE_ERRORS.full);
    expect(core.lockIn([], 1).view.turn).toBe(2); // the game goes on
    const priv = new HostCore(failing("InvalidStateError"), async (id) => maps[id]!);
    await priv.start(settings, "private");
    await expect(priv.saveTo("slot1")).rejects.toThrow(SAVE_ERRORS.unavailable);
  });
});
