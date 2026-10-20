import { maps } from "@conquerra/content/maps";
import { roomMapsWith } from "../src/host/roomMaps";
import type { PlayerId } from "@conquerra/engine";
import type { PersonSeat } from "../src/host/localGame";
import type { LobbySettings, RoomBody, RoomMessage, RoomRequest, TableAct, TableView } from "../src/host/protocol";
import { RoomCore, type RoomInfo, type RoomIO, type RoomStore, type Sitter, type TableMirror, type Who } from "../src/host/roomCore";

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

/** Session 27: the people at the tables in these tests (accounts, as the Worker passes them to the room). */
export const NATE: Who = { user: "u-nate", name: "Nate", colour: 0 };
export const KIT: Who = { user: "u-kit", name: "Kit", colour: 3 };
export const WREN: Who = { user: "u-wren", name: "Wren", colour: null };
export const ROOK: Who = { user: "u-rook", name: "Rook", colour: 5 };
export const hostSeat = (who: Who, house = 0): Sitter => ({ user: who.user, name: who.name, house, leadersRun: true, leaderName: "Lord Ash" });

/**
 * A room in-process: a fake clock, a memory store, and a page "connected" for each seat (session 26) or account
 * (session 27) that records every message it gets (one in `offline` gets nothing, as when its tab is closed). As in the
 * real room, a message to a seat goes to the page of the account sitting there.
 */
export function testRoom(store = memoryRoomStore(), start = 1_000_000, opts: { notify?: boolean; safety?: RoomIO["safety"] } = {}) {
  let now = start;
  /** Session 29: "your turn" notices the room asked its shell to send (only with `notify`). */
  const notices: { gameId: string; turn: number; map: string; users: string[]; turnSeconds: number }[] = [];
  const inbox = new Map<string, RoomMessage[]>();
  const offline = new Set<string>();
  /** Accounts with a page open (they've sent the room something and aren't offline). */
  const open = new Set<string>();
  const logs: string[] = [];
  const mirrors: TableMirror[] = [];
  let alarm: number | null = null;
  let listed: RoomInfo | null = null;
  const deliver = (key: string, msg: RoomMessage) => {
    if (offline.has(key)) return false;
    // Through JSON, as over the wire.
    (inbox.get(key) ?? inbox.set(key, []).get(key)!).push(JSON.parse(JSON.stringify(msg)) as RoomMessage);
    return true;
  };
  const room: RoomCore = new RoomCore(
    store,
    // (Session 30: a random map as the real room makes and keeps it, in its own storage.)
    roomMapsWith(store, async (id) => maps[id]!),
    {
      send: (seat, msg) => deliver(room.userOf(seat) ?? seat, msg),
      sendUser: (user, msg) => deliver(user, msg),
      users: () => [...open].filter((u) => !offline.has(u)),
      tableChanged: (m) => void mirrors.push(JSON.parse(JSON.stringify(m)) as TableMirror),
      wakeAt: (at) => void (alarm = at),
      listed: (info) => void (listed = info),
      log: (line) => void logs.push(line),
      ...(opts.notify ? { notify: (n) => void notices.push(JSON.parse(JSON.stringify(n)) as (typeof notices)[number]) } : {}),
      // Session 34: reports and blocks (a test passes its own, often the real one over SQLite).
      ...(opts.safety ? { safety: opts.safety } : {}),
    },
    () => now,
  );
  let nextId = 1;
  const ask = async (seat: PlayerId, body: RoomBody) => {
    const id = nextId++;
    await room.message(seat, { ...body, id } as RoomRequest);
    await room.flush();
    return (inbox.get(room.userOf(seat) ?? seat) ?? []).find((m) => "id" in m && m.id === id) ?? null;
  };
  /** Session 27: a page signed in as `who` asks the room something (the table screen, or its game once seated). */
  const askAs = async (who: Who, body: RoomBody) => {
    const id = nextId++;
    open.add(who.user);
    await room.receive(who, { ...body, id } as RoomRequest);
    await room.flush();
    return (inbox.get(who.user) ?? []).find((m) => "id" in m && m.id === id) ?? null;
  };
  const tableOf = (m: RoomMessage | null): TableView => {
    if (!m || !("table" in m)) throw new Error(`no table: ${JSON.stringify(m)}`);
    return m.table;
  };
  return {
    room,
    store,
    inbox: (key: string) => inbox.get(key) ?? [],
    clear: () => inbox.clear(),
    offline,
    /** Close an account's page (it gets nothing more until it asks again). */
    leave: (who: Who) => void open.delete(who.user),
    logs,
    notices,
    mirrors,
    alarm: () => alarm,
    listed: () => listed,
    now: () => now,
    advance: (ms: number) => (now += ms),
    ask,
    askAs,
    hello: async (seat: PlayerId) => {
      const m = await ask(seat, { type: "hello" });
      if (!m || !("start" in m)) throw new Error(`no start: ${JSON.stringify(m)}`);
      return m.start;
    },
    /** Session 27: the table screen's hello, and its acts. Throws unless the room answered with the table. */
    table: async (who: Who) => tableOf(await askAs(who, { type: "hello" })),
    act: async (who: Who, act: TableAct) => askAs(who, { type: "table", act }),
    tableOf,
    /** Run the alarm if it's due. */
    tick: async () => {
      if (alarm !== null && now >= alarm) await room.alarm();
      await room.flush();
    },
  };
}
