/**
 * Session 27: what a turn costs in the game room with two people at the table (Nate and a friend, both locking in
 * their leaders' orders) and Marshals in the other seats, the room in-process with a memory store: the time each
 * turn's resolution and the next turn's planning takes, and "where are we" whole and trimmed (the page says which
 * turns of its Chronicle it has).
 *
 *   npx tsx apps/web/scripts/s27-room-cpu.ts [turns]
 */
import { maps } from "@conquerra/content/maps";
import type { LobbySettings, RoomMessage, RoomRequest } from "../src/host/protocol";
import { RoomCore, type RoomStore, type Who } from "../src/host/roomCore";

const TURNS = Number(process.argv[2] ?? 30);
const tables: { mapId: string; bots: number }[] = [
  { mapId: "embervale", bots: 3 },
  { mapId: "rootholm", bots: 7 },
];
const NATE: Who = { user: "u-nate", name: "Nate", colour: 0 };
const KIT: Who = { user: "u-kit", name: "Kit", colour: 3 };

const pct = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))]!;
const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;

for (const { mapId, bots } of tables) {
  const data = new Map<string, string>();
  const store: RoomStore = { get: async (k) => (data.has(k) ? JSON.parse(data.get(k)!) : null), put: async (k, v) => void data.set(k, JSON.stringify(v)) };
  const inbox = new Map<string, string[]>();
  const to = (key: string, m: RoomMessage) => ((inbox.get(key) ?? inbox.set(key, []).get(key)!).push(JSON.stringify(m)), true);
  const now = 1_000_000;
  const room: RoomCore = new RoomCore(
    store,
    async (id) => maps[id]!,
    { send: (s, m) => to(room.userOf(s) ?? s, m), sendUser: (u, m) => to(u, m), users: () => [NATE.user, KIT.user], tableChanged: () => {}, wakeAt: () => {}, listed: () => {}, log: () => {} },
    () => now,
  );
  const settings: LobbySettings = { mapId, bots, botLevel: "marshal", luck: 0.3, fog: true, mode: "classic", turnSeconds: 300 };
  await room.createTable({ gameId: `cpu27-${mapId}`, code: "cpu27cpu27", settings, seed: `s27-cpu-${mapId}`, host: { user: NATE.user, name: "Nate", house: 0, leadersRun: true } });
  let id = 1;
  const ask = async (who: Who, body: Record<string, unknown>) => {
    inbox.clear();
    await room.receive(who, { ...body, id: id++ } as RoomRequest);
    await room.flush();
    return inbox.get(who.user) ?? [];
  };
  await ask(KIT, { type: "table", act: { do: "sit", house: 3, leadersRun: true } });
  await ask(NATE, { type: "table", act: { do: "start" } });
  const g = room.table!;
  const turnMs: number[] = [];
  for (let t = 0; t < TURNS && !g.over; t++) {
    const turn = g.turn;
    // (Over, or both people knocked out: the room waits for one of them to play on to the end.)
    if (g.over || !g.waitingOn.length) break;
    await ask(KIT, { type: "lockIn", orders: g.generalOrders({}, undefined, "p2"), turn });
    await ask(NATE, { type: "lockIn", orders: g.generalOrders({}, undefined, "p1"), turn });
    turnMs.push(room.lastTurnMs);
  }
  const whole = (await ask(NATE, { type: "hello" }))[0]!.length;
  const trimmed = (await ask(NATE, { type: "hello", have: g.turn - 1 }))[0]!.length;
  const avg = turnMs.reduce((a, x) => a + x, 0) / turnMs.length;
  console.log(
    `${mapId} ${bots + 1} (2 people, ${bots - 1} Marshals), ${turnMs.length} turns: a turn's resolution and the next turn's planning avg ${avg.toFixed(1)} ms, p95 ${pct(turnMs, 0.95).toFixed(1)} ms, worst ${Math.max(...turnMs).toFixed(1)} ms | ` +
      `"where are we" at turn ${g.turn}: ${kb(whole)} whole, ${kb(trimmed)} trimmed | the room's save ${kb(data.get("game")!.length)}`,
  );
}
