import { maps } from "@conquerra/content/maps";
import type { PlayerId } from "@conquerra/engine";
import type { PersonSeat } from "../src/host/localGame";
import type { LobbySettings, RoomBody, RoomMessage, RoomRequest } from "../src/host/protocol";
import { RoomCore, type RoomInfo, type RoomStore } from "../src/host/roomCore";

/** The room's storage, in memory (stored as JSON text, as the Durable Object's is). */
export function memoryRoomStore(): RoomStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get: async (k) => (data.has(k) ? (JSON.parse(data.get(k)!) as unknown) : null),
    put: async (k, v) => void data.set(k, JSON.stringify(v)),
  };
}

export const settings: LobbySettings = { mapId: "embervale", bots: 3, botLevel: "marshal", luck: 0.3, fog: true, mode: "classic", turnSeconds: 300 };
export const nate: PersonSeat = { id: "p1", name: "Nate", house: 0, leaderName: "Lord Ash", leadersRun: true };

/**
 * A room in-process: a fake clock, a memory store, and a page "connected" on each seat that records every message it
 * gets (a seat in `offline` gets nothing, as when its tab is closed).
 */
export function testRoom(store = memoryRoomStore(), start = 1_000_000) {
  let now = start;
  const inbox = new Map<PlayerId, RoomMessage[]>();
  const offline = new Set<PlayerId>();
  const logs: string[] = [];
  let alarm: number | null = null;
  let listed: RoomInfo | null = null;
  const room = new RoomCore(store, async (id) => maps[id]!, {
    send: (seat, msg) => {
      if (offline.has(seat)) return false;
      // Through JSON, as over the wire.
      (inbox.get(seat) ?? inbox.set(seat, []).get(seat)!).push(JSON.parse(JSON.stringify(msg)) as RoomMessage);
      return true;
    },
    wakeAt: (at) => void (alarm = at),
    listed: (info) => void (listed = info),
    log: (line) => void logs.push(line),
  }, () => now);
  let nextId = 1;
  const ask = async (seat: PlayerId, body: RoomBody) => {
    const id = nextId++;
    await room.message(seat, { ...body, id } as RoomRequest);
    await room.flush();
    return (inbox.get(seat) ?? []).find((m) => "id" in m && m.id === id) ?? null;
  };
  return {
    room,
    store,
    inbox: (seat: PlayerId) => inbox.get(seat) ?? [],
    clear: () => inbox.clear(),
    offline,
    logs,
    alarm: () => alarm,
    listed: () => listed,
    now: () => now,
    advance: (ms: number) => (now += ms),
    ask,
    hello: async (seat: PlayerId) => {
      const m = await ask(seat, { type: "hello" });
      if (!m || !("start" in m)) throw new Error(`no start: ${JSON.stringify(m)}`);
      return m.start;
    },
    /** Run the alarm if it's due. */
    tick: async () => {
      if (alarm !== null && now >= alarm) await room.alarm();
      await room.flush();
    },
  };
}
