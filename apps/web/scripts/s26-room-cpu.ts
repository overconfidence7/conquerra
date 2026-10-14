/**
 * Session 26: what a turn costs in the game room. One person (who locks in the leaders' orders, as someone who
 * delegates would) against Marshals, the room in-process with a memory store: the time each turn's resolution and
 * the next turn's planning takes (the same work the Durable Object does, on this machine), and the size of the
 * messages one page gets for a turn.
 *
 *   npx tsx apps/web/scripts/s26-room-cpu.ts [turns]
 */
import { maps } from "@conquerra/content/maps";
import type { LobbySettings, RoomMessage, RoomRequest } from "../src/host/protocol";
import { RoomCore, type RoomStore } from "../src/host/roomCore";

const TURNS = Number(process.argv[2] ?? 30);
const tables: { mapId: string; bots: number }[] = [
  { mapId: "embervale", bots: 3 },
  { mapId: "rootholm", bots: 7 },
];

const pct = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))]!;

for (const { mapId, bots } of tables) {
  const data = new Map<string, string>();
  const store: RoomStore = { get: async (k) => (data.has(k) ? JSON.parse(data.get(k)!) : null), put: async (k, v) => void data.set(k, JSON.stringify(v)) };
  const sent: string[] = [];
  let now = 1_000_000;
  const room = new RoomCore(store, async (id) => maps[id]!, { send: (_s, m) => (sent.push(JSON.stringify(m)), true), wakeAt: () => {}, listed: () => {}, log: () => {} }, () => now);
  const settings: LobbySettings = { mapId, bots, botLevel: "marshal", luck: 0.3, fog: true, mode: "classic", turnSeconds: 300 };
  await room.create({ gameId: `cpu-${mapId}`, settings, people: [{ id: "p1", name: "Nate", house: 0, leadersRun: true }], seed: `s26-cpu-${mapId}` });
  let id = 1;
  const ask = async (body: Record<string, unknown>) => {
    sent.length = 0;
    await room.message("p1", { ...body, id: id++ } as RoomRequest);
    await room.flush();
    return sent.map((t) => ({ text: t, msg: JSON.parse(t) as RoomMessage }));
  };
  const turnMs: number[] = [];
  const turnBytes: number[] = [];
  let hello = await ask({ type: "hello" });
  const helloBytes = hello[0]!.text.length;
  for (let t = 0; t < TURNS; t++) {
    const start = hello[0]!.msg as Extract<RoomMessage, { start: unknown }>;
    if (start.start.view.winner) break;
    const out = await ask({ type: "lockIn", orders: start.start.generalOrders, turn: start.start.view.turn });
    turnMs.push(room.lastTurnMs);
    turnBytes.push(out.reduce((a, m) => a + m.text.length, 0));
    now += 60_000;
    hello = await ask({ type: "hello" });
  }
  const save = data.get("game")!.length;
  const avg = turnMs.reduce((a, x) => a + x, 0) / turnMs.length;
  const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;
  console.log(
    `${mapId} ${bots + 1} (1 person, ${bots} Marshals), ${turnMs.length} turns: a turn's resolution and the next turn's planning avg ${avg.toFixed(1)} ms, p95 ${pct(turnMs, 0.95).toFixed(1)} ms, worst ${Math.max(...turnMs).toFixed(1)} ms | ` +
      `a turn's message to the page avg ${kb(turnBytes.reduce((a, x) => a + x, 0) / turnBytes.length)}, largest ${kb(Math.max(...turnBytes))} | "where are we" ${kb(helloBytes)} at the start, ${kb(hello[0]!.text.length)} at turn ${turnMs.length + 1} | the room's save ${kb(save)}`,
  );
}
