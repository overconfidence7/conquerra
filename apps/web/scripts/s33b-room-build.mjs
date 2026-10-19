/**
 * Session 33b: how long the game room takes to build its own copy of a big random map, against `wrangler dev` (the
 * room runs the same map maker as the page, in workerd). One person makes a table on the map, says hello (the room
 * builds the map then, once, and keeps a slim copy), and starts it with bots in the other seats; it prints how long
 * each step took and how long the first turn took to resolve once locked in.
 *
 *   npx wrangler dev --config apps/web/wrangler.jsonc --port 8787        (in another terminal, after pnpm build)
 *   node apps/web/scripts/s33b-room-build.mjs [mapId] [bots] [the try that passed]
 */
const BASE = process.env.HARNESS_URL ?? "http://127.0.0.1:8787";
const MAP = process.argv[2] ?? "random:400-island-quiet-heron";
const BOTS = Number(process.argv[3] ?? 9);
/** The try that passed on the host's page, as the lobby sends it (session 33b); none: the room makes every try. */
const ATTEMPT = process.argv[4] ? Number(process.argv[4]) : undefined;
const NATE = "nate@harness.test";

async function api(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { "content-type": "application/json", "X-Dev-Email": NATE, ...(init.headers ?? {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path}: ${res.status} ${body.error ?? ""}`);
  return body;
}

const t0 = Date.now();
const settings = { mapId: MAP, ...(ATTEMPT ? { mapAttempt: ATTEMPT } : {}), bots: BOTS, botLevel: "marshal", luck: 0.3, fog: true, mode: "classic", turnSeconds: 300, house: 0 };
const { id } = await api("/api/games", { method: "POST", body: JSON.stringify({ settings, leadersRun: true }) });
console.log(`table made in ${Date.now() - t0} ms (${MAP}, ${BOTS} bots)`);

const ws = new WebSocket(`${BASE.replace(/^http/, "ws")}/api/games/${id}/ws`, { headers: { "X-Dev-Email": NATE } });
let next = 1;
const waiting = new Map();
const pushes = [];
const listeners = [];
ws.onmessage = (e) => {
  const m = JSON.parse(String(e.data));
  if (m.id && waiting.has(m.id)) (waiting.get(m.id)(m), waiting.delete(m.id));
  else (pushes.push(m), listeners.splice(0).forEach((f) => f(m)));
};
await new Promise((ok, fail) => ((ws.onopen = ok), (ws.onerror = () => fail(new Error("no WebSocket")))));
const ask = (body) => new Promise((ok) => (waiting.set(next, ok), ws.send(JSON.stringify({ ...body, id: next++ }))));
const nextPush = (test) => new Promise((ok) => { const f = pushes.find(test); if (f) return ok(f); const c = (m) => (test(m) ? ok(m) : listeners.push(c)); listeners.push(c); });

let t = Date.now();
const hello = await ask({ type: "hello" });
console.log(`hello answered in ${Date.now() - t} ms${hello.error ? ` (${hello.error})` : ""}`);
t = Date.now();
const started = await ask({ type: "table", act: { do: "start", withBots: true } });
if (!started.ok) throw new Error(started.error);
const start = (await nextPush((m) => m.start)).start;
console.log(`started in ${Date.now() - t} ms: turn ${start.view.turn}, ${Object.keys(start.view.territories).length} territories, the try the room told the page: ${start.mapAttempt ?? "none (1)"}`);
let orders = start.generalOrders ?? [];
for (let turn = 1; turn <= 2; turn++) {
  t = Date.now();
  const u = await ask({ type: "lockIn", orders, turn });
  if (!u.ok) throw new Error(u.error);
  orders = u.update.generalOrders ?? [];
  console.log(`turn ${turn} resolved in ${Date.now() - t} ms (wall: the bots' planning and the resolution), now turn ${u.update.view.turn}`);
}
ws.close();
process.exit(0);
