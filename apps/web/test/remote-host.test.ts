import { maps } from "@conquerra/content/maps";
import type { Order } from "@conquerra/engine";
import { describe, expect, it, vi } from "vitest";
import type { HostUpdate } from "../src/host/protocol";
import { createRemoteHost, ONLINE_TEXT } from "../src/host/remoteHost";
import { RoomCore } from "../src/host/roomCore";
import { memoryRoomStore, nate, settings } from "./roomHelpers";

/**
 * The page's online host (session 26) against a real room, in-process: a stand-in WebSocket carries the messages
 * (as text, like the real one), and the test can drop the connection or open the game elsewhere.
 */
function harness() {
  // The room's clock is far from this computer's on purpose: the page must count down to the room's deadline.
  let roomNow = 5_000_000_000;
  let current: FakeSocket | null = null;
  const room = new RoomCore(memoryRoomStore(), async (id) => maps[id]!, {
    send: (_seat, msg) => {
      const s = current;
      if (!s || s.readyState !== 1) return false;
      const text = JSON.stringify(msg);
      queueMicrotask(() => s.onmessage?.({ data: text } as MessageEvent));
      return true;
    },
    wakeAt: () => {},
    listed: () => {},
    log: () => {},
  }, () => roomNow);

  class FakeSocket {
    static OPEN = 1;
    readyState = 0;
    onopen: (() => void) | null = null;
    onmessage: ((e: MessageEvent) => void) | null = null;
    onclose: ((e: CloseEvent) => void) | null = null;
    constructor(readonly url: string) {
      current = this;
      opened.push(url);
      setTimeout(() => {
        this.readyState = 1;
        this.onopen?.();
      }, 0);
    }
    send(text: string) {
      void room.message("p1", JSON.parse(text));
    }
    close() {
      this.readyState = 3;
    }
    /** The network went away (or, with 4000, the game opened in another tab). */
    drop(code = 1006) {
      this.readyState = 3;
      if (current === this) current = null;
      this.onclose?.({ code } as CloseEvent);
    }
  }
  const opened: string[] = [];
  const host = createRemoteHost({ base: "https://conquerra.test", loadMap: async (id) => maps[id]!, WebSocketImpl: FakeSocket as unknown as typeof WebSocket, backoff: [5] });
  const pushed: HostUpdate[] = [];
  const notices: string[] = [];
  host.onAutoLock((u) => pushed.push(u));
  host.onNotice((m) => notices.push(m));
  return { room, host, pushed, notices, opened, socket: () => current, advance: (ms: number) => (roomNow += ms), roomNow: () => roomNow };
}

describe("the online host on the page (session 26)", () => {
  it("opens a game over the WebSocket: the full map from the page's own copy, the countdown on this device's clock", async () => {
    const h = harness();
    await h.room.create({ gameId: "abc123def456", settings, people: [nate], seed: "seed" });
    const start = await h.host.load({ online: "abc123def456" });
    expect(h.opened).toEqual(["wss://conquerra.test/api/games/abc123def456/ws"]);
    expect(start.map.geometry?.territories.length).toBe(40);
    expect(start.view.me.id).toBe("p1");
    expect(start.fair?.seedHash).toMatch(/^[0-9a-f]{64}$/);
    // The room's deadline is 5 minutes from the room's now; on this device that's 5 minutes from Date.now().
    expect(Math.abs(start.clock!.endsAt - (Date.now() + 300_000))).toBeLessThan(2_000);
    const u = await h.host.lockIn(start.generalOrders, 1);
    expect(u.view.turn).toBe(2);
    expect(u.report!.turn).toBe(1);
    await expect(h.host.pause()).rejects.toThrow(ONLINE_TEXT.notHere);
  });

  it("a lost connection: it reconnects by itself, asks where we are, and a turn that resolved meanwhile arrives with its replay", async () => {
    const h = harness();
    await h.room.create({ gameId: "abc123def457", settings, people: [nate], seed: "seed2" });
    const start = await h.host.load({ online: "abc123def457" });
    const recruit: Order = { id: "o9", kind: "recruit", territory: start.view.me.capital, count: 2 };
    h.socket()!.drop();
    expect(h.notices).toEqual([ONLINE_TEXT.reconnecting]);
    // While it's down: the page keeps queueing (kept until the connection is back) ...
    h.host.saveOrders([recruit], 1);
    // ... and the room's clock runs out with nobody connected.
    await vi.waitFor(() => expect(h.opened.length).toBe(2));
    await vi.waitFor(() => expect(h.notices).toContain(ONLINE_TEXT.reconnected));
    expect(h.pushed).toEqual([]);
    // (The queue sent after the reconnect is the one that goes in.)
    await new Promise((r) => setTimeout(r, 20));
    h.socket()!.drop();
    h.advance(300_000);
    await h.room.alarm();
    await vi.waitFor(() => expect(h.pushed.length).toBe(1));
    const u = h.pushed[0]!;
    expect(u.view.turn).toBe(2);
    expect(u.report!.turn).toBe(1);
    expect(u.before!.turn).toBe(1);
    expect(u.autoLocked).toBe(true);
    expect(u.report!.events.some((e) => e.type === "recruited" && e.player === "p1")).toBe(true);
  });

  it("opened somewhere else: this page stops and says so (no fighting over the seat)", async () => {
    const h = harness();
    await h.room.create({ gameId: "abc123def458", settings, people: [nate], seed: "seed3" });
    await h.host.load({ online: "abc123def458" });
    h.socket()!.drop(4000);
    await new Promise((r) => setTimeout(r, 30));
    expect(h.notices).toEqual([ONLINE_TEXT.elsewhere]);
    expect(h.opened.length).toBe(1);
    await expect(h.host.lockIn([], 1)).rejects.toThrow();
  });
});
