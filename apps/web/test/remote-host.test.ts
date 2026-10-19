import { maps } from "@conquerra/content/maps";
import type { Order } from "@conquerra/engine";
import { describe, expect, it, vi } from "vitest";
import type { HostUpdate } from "../src/host/protocol";
import { createRemoteHost, ONLINE_TEXT } from "../src/host/remoteHost";
import { RoomCore, type Who } from "../src/host/roomCore";
import { hostSeat, KIT, memoryRoomStore, nate, NATE, settings } from "./roomHelpers";
import type { TableView } from "../src/host/protocol";

/**
 * The page's online host (session 26) against a real room, in-process: a stand-in WebSocket carries the messages
 * (as text, like the real one), and the test can drop the connection or open the game elsewhere.
 */
function harness(who?: Who, storage: Pick<Storage, "getItem" | "setItem"> | null = null) {
  /** Every request the page sent (session 27: to see what "where are we" asks for). */
  const sent: { type: string; have?: number }[] = [];
  // The room's clock is far from this computer's on purpose: the page must count down to the room's deadline.
  let roomNow = 5_000_000_000;
  let current: FakeSocket | null = null;
  // (Only this page's messages reach it: a seat someone else sits in, or another account, aren't its.)
  const room: RoomCore = new RoomCore(memoryRoomStore(), async (id) => maps[id]!, {
    send: (seat, msg) => {
      const s = current;
      if (!s || s.readyState !== 1) return false;
      if (who && room.userOf(seat) !== who.user) return false;
      const text = JSON.stringify(msg);
      queueMicrotask(() => s.onmessage?.({ data: text } as MessageEvent));
      return true;
    },
    sendUser: (user, msg) => {
      const s = current;
      if (!s || s.readyState !== 1) return false;
      if (user !== who?.user) return false;
      const text = JSON.stringify(msg);
      queueMicrotask(() => s.onmessage?.({ data: text } as MessageEvent));
      return true;
    },
    users: () => (who && current?.readyState === 1 ? [who.user] : []),
    tableChanged: () => {},
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
      sent.push(JSON.parse(text));
      // (Session 27: a page signed in as an account; a game from session 26, the seat the Worker found.)
      void (who ? room.receive(who, JSON.parse(text)) : room.message("p1", JSON.parse(text)));
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
  const host = createRemoteHost({ base: "https://conquerra.test", loadMap: async (id) => maps[id]!, WebSocketImpl: FakeSocket as unknown as typeof WebSocket, backoff: [5], storage });
  const pushed: HostUpdate[] = [];
  const notices: string[] = [];
  host.onAutoLock((u) => pushed.push(u));
  host.onNotice((m) => notices.push(m));
  return { room, host, pushed, notices, opened, sent, socket: () => current, advance: (ms: number) => (roomNow += ms), roomNow: () => roomNow };
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

describe("the table screen on the page (session 27)", () => {
  it("a friend opens the link: the table arrives and changes live; they sit; the host starts; the page goes straight into turn 1", async () => {
    const h = harness(KIT);
    await h.room.createTable({ gameId: "tablepage12", code: "c0de2c0de3", settings: { ...settings, bots: 2 }, seed: "s", host: hostSeat(NATE, 0) });
    const seen: TableView[] = [];
    h.host.onTable((t) => seen.push(t));
    const opening = h.host.load({ online: "tablepage12", code: "c0de2c0de3" });
    await vi.waitFor(() => expect(seen.length).toBe(1));
    // The link's code goes with the socket (the Worker lets someone without a seat in only with it).
    expect(h.opened).toEqual(["wss://conquerra.test/api/games/tablepage12/ws?code=c0de2c0de3"]);
    expect(seen[0]!.you).toEqual({ seat: null, host: false });
    const sat = await h.host.tableAct({ do: "sit", house: 3, leadersRun: true });
    expect(sat.you.seat).toBe(1);
    // Errors come back as plain sentences.
    await expect(h.host.tableAct({ do: "start" })).rejects.toThrow("Only the host can do that.");
    // The host starts (from Nate's own page): Kit's page opens on turn 1, in Kit's seat.
    await h.room.receive(NATE, { id: 99, type: "table", act: { do: "start" } });
    const start = await opening;
    // (Session 33b: the room says the table started before it sends the start, so while the page makes its map the table
    // screen says "Building the map…", not the table as it was.)
    expect(seen.at(-1)!.status).toBe("started");
    expect(start.playerId).toBe("p2");
    expect(start.view.turn).toBe(1);
    expect(start.map.geometry?.territories.length).toBe(40);
    // Kit locks in; the turn waits for Nate, then resolves for both.
    const kitLock = h.host.lockIn(start.generalOrders, 1);
    await h.room.receive(NATE, { id: 100, type: "lockIn", orders: [], turn: 1 });
    const u = await kitLock;
    expect(u.view.turn).toBe(2);
    expect(u.playerId).toBe("p2");
  });

  it("a late friend: the game started without them, and the page says so", async () => {
    const h = harness(KIT);
    await h.room.createTable({ gameId: "tablepage13", code: "c0de2c0de4", settings, seed: "s", host: hostSeat(NATE, 0) });
    await h.room.receive(NATE, { id: 1, type: "table", act: { do: "start", withBots: true } });
    await expect(h.host.load({ online: "tablepage13", code: "c0de2c0de4" })).rejects.toThrow("This game has started.");
  });
});

describe("the page keeps its Chronicle (session 27)", () => {
  it("a page that opens the game again asks only for the turns it lacks, and has the whole Chronicle", async () => {
    const kept = new Map<string, string>();
    const storage = { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => void kept.set(k, v) };
    const h = harness(undefined, storage);
    await h.room.create({ gameId: "chron1234567", settings, people: [nate], seed: "seed" });
    const start = await h.host.load({ online: "chron1234567" });
    expect(h.sent[0]).toEqual({ id: expect.any(Number), type: "hello" });
    let u = await h.host.lockIn(start.generalOrders, 1);
    u = await h.host.lockIn(u.generalOrders, 2);
    expect(JSON.parse(kept.get("conquerra.chronicle.chron1234567")!).map((r: { turn: number }) => r.turn)).toEqual([1, 2]);
    h.host.dispose();
    // The same device opens it again (a new page): it says it has turns 1 and 2, and still gets the whole Chronicle.
    const again = createRemoteHost({ base: "https://conquerra.test", loadMap: async (id) => maps[id]!, WebSocketImpl: (h.socket()!.constructor as typeof WebSocket), backoff: [5], storage });
    const s2 = await again.load({ online: "chron1234567" });
    expect(h.sent.at(-1)).toMatchObject({ type: "hello", have: 2 });
    expect(s2.chronicle!.map((r) => r.turn)).toEqual([1, 2]);
    expect(s2.chronicle).toEqual(start.chronicle!.concat(JSON.parse(kept.get("conquerra.chronicle.chron1234567")!)));
  });
});
