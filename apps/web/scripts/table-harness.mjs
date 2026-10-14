/**
 * Session 27: plays a table of two people and bots against a local server, headlessly, for the next sessions' tests.
 * Nate makes a table, Kit joins from the link and sits, Nate starts, and both lock in their leaders' orders each
 * turn, over the same WebSocket and messages the page uses. It prints each turn's time and message sizes.
 *
 * It needs `wrangler dev` (the sign-in stand-in, DEV_EMAIL in apps/web/.dev.vars, exists only there: the deployed
 * Worker checks Cloudflare Access and never has it). Two people come from the X-Dev-Email header.
 *
 *   npx wrangler d1 migrations apply conquerra_db --local --config apps/web/wrangler.jsonc
 *   npx wrangler dev --config apps/web/wrangler.jsonc --port 8787        (in another terminal)
 *   node apps/web/scripts/table-harness.mjs [turns] [map] [bots]
 */
const BASE = process.env.HARNESS_URL ?? "http://127.0.0.1:8787";
const TURNS = Number(process.argv[2] ?? 5);
const MAP = process.argv[3] ?? "embervale";
const BOTS = Number(process.argv[4] ?? 3);
const NATE = "nate@harness.test";
const KIT = "kit@harness.test";

async function api(email, path, init = {}) {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { "content-type": "application/json", "X-Dev-Email": email, ...(init.headers ?? {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path}: ${res.status} ${body.error ?? ""}`);
  return body;
}

/** A page: a WebSocket to the game's room, answers by id, pushes kept in order. */
function page(email, id, code) {
  const url = `${BASE.replace(/^http/, "ws")}/api/games/${id}/ws${code ? `?code=${code}` : ""}`;
  const ws = new WebSocket(url, { headers: { "X-Dev-Email": email } });
  let next = 1;
  const waiting = new Map();
  const pushes = [];
  const listeners = [];
  let bytes = 0;
  ws.onmessage = (e) => {
    bytes += String(e.data).length;
    const m = JSON.parse(String(e.data));
    if (m.id && waiting.has(m.id)) {
      waiting.get(m.id)(m);
      waiting.delete(m.id);
    } else {
      pushes.push(m);
      listeners.splice(0).forEach((f) => f(m));
    }
  };
  const open = new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(new Error(`${email} couldn't open ${url}`));
  });
  return {
    pushes,
    bytes: () => bytes,
    async ask(body) {
      await open;
      const id = next++;
      return new Promise((resolve) => {
        waiting.set(id, resolve);
        ws.send(JSON.stringify({ ...body, id }));
      });
    },
    /** The next push that matches. */
    next: (test) =>
      new Promise((resolve) => {
        const found = pushes.find(test);
        if (found) return resolve(found);
        const check = (m) => (test(m) ? resolve(m) : listeners.push(check));
        listeners.push(check);
      }),
    close: () => ws.close(),
  };
}

const settings = { mapId: MAP, bots: BOTS, botLevel: "marshal", luck: 0.3, fog: true, mode: "classic", turnSeconds: 300, house: 0 };
const { id, code } = await api(NATE, "/api/games", { method: "POST", body: JSON.stringify({ settings, leadersRun: true }) });
console.log(`table ${id}, link ?join=${code}`);
const joined = await api(KIT, `/api/join/${code}`);
if (joined.id !== id) throw new Error("the link led somewhere else");
const nate = page(NATE, id);
const kit = page(KIT, id, code);
console.log("Nate's table:", JSON.stringify((await nate.ask({ type: "hello" })).table.seats));
await kit.ask({ type: "hello" });
const sat = await kit.ask({ type: "table", act: { do: "sit", house: 3, leadersRun: true } });
if (!sat.ok) throw new Error(sat.error);
const started = await nate.ask({ type: "table", act: { do: "start" } });
if (!started.ok) throw new Error(started.error);
let a = (await nate.next((m) => m.start)).start;
let b = (await kit.next((m) => m.start)).start;
console.log(`started: Nate ${a.playerId}, Kit ${b.playerId}, ${a.view.players.length} seats, turn ${a.view.turn}`);
for (let i = 0; i < TURNS && !a.view.winner; i++) {
  const t0 = Date.now();
  const turn = a.view.turn;
  const before = nate.bytes() + kit.bytes();
  const lockA = nate.ask({ type: "lockIn", orders: a.generalOrders, turn });
  const lockB = kit.ask({ type: "lockIn", orders: b.generalOrders, turn });
  const [ua, ub] = await Promise.all([lockA, lockB]);
  if (!ua.ok || !ub.ok) throw new Error(ua.error ?? ub.error);
  a = ua.update;
  b = ub.update;
  console.log(`turn ${turn}: resolved in ${Date.now() - t0} ms (wall, both lock-ins), ${((nate.bytes() + kit.bytes() - before) / 1024).toFixed(1)} KB to the two pages, now turn ${a.view.turn}`);
}
const hello = await nate.ask({ type: "hello", have: a.view.turn - 1 });
console.log(`"where are we" (trimmed): ${(JSON.stringify(hello).length / 1024).toFixed(1)} KB`);
nate.close();
kit.close();
