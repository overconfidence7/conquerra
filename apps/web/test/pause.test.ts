import { maps } from "@conquerra/content/maps";
import { describe, expect, it } from "vitest";
import { PAUSE_MAX_MS, PAUSE_TEXT, PAUSE_VOTE_MS, PAUSES_EACH } from "../src/host/localGame";
import type { PauseView, RoomMessage } from "../src/host/protocol";
import { PAUSED_LOCK, RoomCore } from "../src/host/roomCore";
import { hostSeat, KIT, memoryRoomStore, NATE, settings, testRoom, WREN } from "./roomHelpers";

/**
 * Session 28, Part 3: pause by vote. Anyone still playing asks during the planning window; everyone else still playing
 * must agree within 60 s (bots agree at once); the clock stops for 15 minutes at most, three a player a game, and it
 * ends early when everyone says they're ready. The deadline moves by the time paused; a room that wakes is still paused.
 */

const pausesOf = (msgs: RoomMessage[]): PauseView[] => msgs.flatMap((m) => ("pause" in m ? [m.pause] : "start" in m && m.start.pause ? [m.start.pause] : []));
const errorOf = (m: RoomMessage | null) => (m && !m.ok ? m.error : null);

async function table(opts: { store?: ReturnType<typeof memoryRoomStore>; alone?: boolean } = {}) {
  const t = testRoom(opts.store);
  await t.room.createTable({ gameId: "pause", code: "p4uset4ble", settings: { ...settings, bots: 3 }, seed: "pause-by-vote", host: hostSeat(NATE, 0) });
  if (!opts.alone) {
    await t.act(KIT, { do: "sit", house: 3, leadersRun: true });
    await t.act(WREN, { do: "sit", house: 5, leadersRun: true });
  }
  await t.act(NATE, { do: "start", withBots: true });
  const g = t.room.table!;
  return { ...t, g, pause: (seat: string, act: "ask" | "yes" | "no" | "ready") => t.ask(seat, { type: "pause", act }) };
}

describe("pause by vote (session 28)", () => {
  it("everyone agrees: the clock stops, everyone sees it, and it ends early when everyone is ready (the deadline moves by the time paused)", async () => {
    const t = await table();
    const deadline = t.g.nextDeadline!;
    t.advance(30_000);
    t.clear();
    const asked = await t.pause("p2", "ask");
    expect(asked && "pause" in asked && asked.pause.vote).toMatchObject({ by: "p2", yes: ["p2"], waiting: ["p1", "p3"] });
    // The others get the card; the alarm will check the vote at its 60 s.
    expect(pausesOf(t.inbox(NATE.user)).at(-1)).toMatchObject({ vote: { by: "p2" }, news: { kind: "asked" } });
    expect(t.alarm()).toBe(t.now() + PAUSE_VOTE_MS);
    await t.pause("p1", "yes");
    expect(t.g.isPausedOnline).toBe(false);
    await t.pause("p3", "yes");
    expect(t.g.isPausedOnline).toBe(true);
    expect(pausesOf(t.inbox(WREN.user)).at(-1)).toMatchObject({ paused: { by: "p2", endsAt: t.now() + PAUSE_MAX_MS }, news: { kind: "started" } });
    // The clock stands still: 4:30 left, however long the pause goes on.
    const back = await t.hello("p1");
    expect(back.clock!.pausedLeft).toBe(270_000);
    expect(back.pause).toMatchObject({ paused: { by: "p2" } });
    expect(t.alarm()).toBe(t.now() + PAUSE_MAX_MS);
    // Orders can still be saved, but not locked in.
    expect(errorOf(await t.ask("p1", { type: "lockIn", orders: [], turn: 1 }))).toBe(PAUSED_LOCK);
    expect(t.g.turn).toBe(1);
    // Five minutes later everyone says they're ready: it ends, and the deadline is five minutes later than it was.
    t.advance(300_000);
    await t.pause("p1", "ready");
    await t.pause("p2", "ready");
    expect(pausesOf(t.inbox(KIT.user)).at(-1)).toMatchObject({ paused: { ready: ["p1", "p2"], waiting: ["p3"] } });
    await t.pause("p3", "ready");
    expect(t.g.isPausedOnline).toBe(false);
    expect(t.g.nextDeadline).toBe(deadline + 300_000);
    expect(t.alarm()).toBe(deadline + 300_000);
    expect(pausesOf(t.inbox(NATE.user)).at(-1)).toMatchObject({ news: { kind: "ended", early: true } });
    // It counted against Kit, who asked.
    expect(pausesOf(t.inbox(KIT.user)).at(-1)!.left).toBe(PAUSES_EACH - 1);
  });

  it("one No and it doesn't start; nor if the 60 s pass (the asker is told who)", async () => {
    const t = await table();
    await t.pause("p1", "ask");
    t.clear();
    await t.pause("p3", "no");
    expect(t.g.isPausedOnline).toBe(false);
    expect(pausesOf(t.inbox(NATE.user)).at(-1)).toMatchObject({ news: { kind: "failed", why: "no", who: ["p3"] } });
    // Asked again: Kit agrees, Wren never answers.
    await t.pause("p1", "ask");
    await t.pause("p2", "yes");
    t.clear();
    t.advance(PAUSE_VOTE_MS);
    await t.tick();
    expect(t.g.pauseInfo.vote).toBeUndefined();
    expect(pausesOf(t.inbox(NATE.user)).at(-1)).toMatchObject({ news: { kind: "failed", why: "time", who: ["p3"] } });
    // Neither counted.
    expect(t.g.pauseInfo.used).toEqual({});
  });

  it("15 minutes at most: it ends by itself (the alarm is set to its end), the deadline moves 15 minutes", async () => {
    const t = await table({ alone: true });
    const deadline = t.g.nextDeadline!;
    // Alone with bots: the bots agree at once.
    const m = await t.pause("p1", "ask");
    expect(m && "pause" in m && m.pause.news).toEqual({ kind: "started" });
    expect(t.alarm()).toBe(t.now() + PAUSE_MAX_MS);
    t.advance(PAUSE_MAX_MS);
    await t.tick();
    expect(t.g.isPausedOnline).toBe(false);
    expect(t.g.nextDeadline).toBe(deadline + PAUSE_MAX_MS);
    expect(t.g.turn).toBe(1);
  });

  it("three a player a game; never during the replay; one at a time", async () => {
    const t = await table({ alone: true });
    for (let i = 0; i < PAUSES_EACH; i++) {
      expect(errorOf(await t.pause("p1", "ask"))).toBeNull();
      expect(errorOf(await t.pause("p1", "ask"))).toBe(PAUSE_TEXT.busy);
      await t.pause("p1", "ready");
    }
    expect(errorOf(await t.pause("p1", "ask"))).toBe(PAUSE_TEXT.used);
    // The next turn: still three used. And during its replay (before the window opens) none can be asked.
    const t2 = await table();
    for (const s of ["p1", "p2", "p3"]) await t2.ask(s, { type: "lockIn", orders: [], turn: 1 });
    expect(t2.g.turn).toBe(2);
    if (t2.g.windowOpensAt! > t2.now()) expect(errorOf(await t2.pause("p1", "ask"))).toBe(PAUSE_TEXT.notNow);
  });

  it("a room that wakes after a deploy is still paused, with the right time left, and its alarm at the pause's end", async () => {
    const store = memoryRoomStore();
    const t = await table({ store, alone: true });
    t.advance(60_000);
    await t.pause("p1", "ask");
    t.advance(120_000);
    await t.room.flush();
    let alarm: number | null = null;
    const woke = new RoomCore(store, async (id) => maps[id]!, { send: () => true, sendUser: () => true, users: () => [], tableChanged: () => {}, wakeAt: (at) => void (alarm = at), listed: () => {}, log: () => {} }, () => t.now());
    const g = await woke.ensureLoaded();
    expect(g.isPausedOnline).toBe(true);
    expect(g.clock!.pausedLeft).toBe(240_000);
    expect(alarm).toBe(t.now() - 120_000 + PAUSE_MAX_MS);
    // It runs out in the woken room: the deadline moves the full 15 minutes.
    const deadline = g.nextDeadline!;
    t.advance(PAUSE_MAX_MS);
    await woke.alarm();
    expect(g.isPausedOnline).toBe(false);
    expect(g.nextDeadline).toBe(deadline + PAUSE_MAX_MS);
  });

  it("someone resigning mid-vote no longer holds it up", async () => {
    const t = await table();
    await t.pause("p1", "ask");
    await t.pause("p2", "yes");
    await t.ask("p3", { type: "resign" });
    expect(t.g.isPausedOnline).toBe(true);
  });
});
