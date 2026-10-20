/**
 * Session 34: ten people at a table of 20 seats (the rest bots), headlessly against `wrangler dev`, as
 * `table-harness.mjs` plays two or three. The host makes a table on Rootholm with 19 opponents, nine friends sit from
 * the link, an eleventh is turned away (ten people at most), everyone writes one line in the table chat and reads all
 * ten, the host starts, and every page plays three turns: nine lock in early, the last one a moment later, and each
 * page's update must be the same turn with its own replay. It prints each turn's time (wall clock, the last lock-in to
 * the ten updates), the bytes to the pages, and the table's row in each person's games list.
 *
 *   npx wrangler d1 migrations apply conquerra_db --local --config apps/web/wrangler.jsonc
 *   npx wrangler dev --config apps/web/wrangler.jsonc --port 8787        (in another terminal)
 *   node apps/web/scripts/big-table-harness.mjs [turns=3] [map=rootholm] [seats=20] [people=10]
 */
const BASE = process.env.HARNESS_URL ?? "http://127.0.0.1:8787";
const TURNS = Number(process.argv[2] ?? 3);
const MAP = process.argv[3] ?? "rootholm";
const SEATS = Number(process.argv[4] ?? 20);
const PEOPLE = Number(process.argv[5] ?? 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (ok, what) => {
  if (!ok) throw new Error(`check failed: ${what}`);
  console.log(`  ✓ ${what}`);
};
const emails = Array.from({ length: PEOPLE + 1 }, (_, i) => `big${i}@harness.test`);

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

const settings = { mapId: MAP, bots: SEATS - 1, botLevel: "marshal", luck: 0.3, fog: true, mode: "conquest", turnSeconds: 300, house: 0 };
const t0 = Date.now();
const { id, code } = await api(emails[0], "/api/games", { method: "POST", body: JSON.stringify({ settings, leadersRun: true }) });
console.log(`table ${id} on ${MAP}, ${SEATS} seats, made in ${Date.now() - t0} ms; link ?join=${code}`);
const pages = emails.slice(0, PEOPLE).map((e, i) => page(e, id, i ? code : undefined));
const host = pages[0];
const table0 = (await host.ask({ type: "hello" })).table;
check(table0.seats.length === SEATS, `the table has ${SEATS} seats`);
for (let i = 1; i < PEOPLE; i++) {
  await api(emails[i], `/api/join/${code}`);
  await pages[i].ask({ type: "hello" });
  const sat = await pages[i].ask({ type: "table", act: { do: "sit", house: i, leadersRun: true, name: `Friend ${i}` } });
  if (!sat.ok) throw new Error(sat.error);
}
check(true, `${PEOPLE} people sat (the host and ${PEOPLE - 1} friends from the link)`);
const late = page(emails[PEOPLE], id, code);
await late.ask({ type: "hello" });
const turnedAway = await late.ask({ type: "table", act: { do: "sit", house: 0, leadersRun: true, name: "Late" } });
check(!turnedAway.ok && /Ten people/.test(turnedAway.error ?? ""), `an eleventh is told: "${turnedAway.error}"`);
late.close();
// The table chat with ten people (a line each; the chat's own limit is one every 2 s a person).
for (let i = 0; i < PEOPLE; i++) await pages[i].ask({ type: "chat", act: { do: "send", chat: "table", text: `BIG-${i}: evening` } });
await sleep(500);
const heard = pages.map((p) => new Set(p.pushes.flatMap((m) => m.chat?.lines ?? []).map((l) => l.text).filter((t) => t.startsWith("BIG-"))).size);
check(heard.every((n) => n >= PEOPLE - 1), `every page read the others' lines in the table chat (${heard.join(", ")})`);
const ts = Date.now();
const started = await host.ask({ type: "table", act: { do: "start" } });
if (!started.ok) throw new Error(started.error);
let views = await Promise.all(pages.map((p) => p.next((m) => m.start).then((m) => m.start)));
console.log(`started in ${Date.now() - ts} ms: ${views[0].view.players.length} seats, ${views[0].people.length} people, turn ${views[0].view.turn}, deadline in ${Math.round((views[0].clock?.deadline - views[0].now) / 1000)} s`);
check(new Set(views.map((v) => v.playerId)).size === PEOPLE, "each page is its own seat");
check(views.every((v) => v.clock?.deadline === views[0].clock?.deadline), "every page counts down to the same deadline");
// The games list: each person's row for this table.
const rows = await Promise.all(emails.slice(0, PEOPLE).map((e) => api(e, "/api/games")));
const mine = rows.map((r) => (r.games ?? r).find?.((g) => g.id === id));
check(mine.every((g) => g), "the game is in every person's list");
console.log(`  the list's row (host): ${JSON.stringify(mine[0])}`);
for (let i = 0; i < TURNS && !views[0].view.winner; i++) {
  const turn = views[0].view.turn;
  const before = pages.reduce((a, p) => a + p.bytes(), 0);
  // Nine lock in early; each sees who has locked in; the last locks in a moment later.
  const early = pages.slice(0, -1).map((p, k) => p.ask({ type: "lockIn", orders: views[k].generalOrders, turn }));
  await sleep(800);
  const readyPush = pages.at(-1).pushes.filter((m) => m.ready).at(-1);
  const tl = Date.now();
  const last = pages.at(-1).ask({ type: "lockIn", orders: views.at(-1).generalOrders, turn });
  const ups = await Promise.all([...early, last]);
  const ms = Date.now() - tl;
  if (ups.some((u) => !u.ok)) throw new Error(ups.find((u) => !u.ok).error);
  views = ups.map((u) => u.update);
  check(views.every((v) => v.view.turn === turn + 1), `turn ${turn}: all ${PEOPLE} pages moved to turn ${turn + 1} together`);
  check(views.every((v) => Array.isArray(v.report?.events) && v.before?.turn === turn), "each page has its own replay of the turn (its report and its view before it)");
  console.log(`turn ${turn}: ${ms} ms from the last lock-in to all ${PEOPLE} updates (wall, wrangler dev), ${((pages.reduce((a, p) => a + p.bytes(), 0) - before) / 1024).toFixed(1)} KB to the pages; the last page saw ${readyPush?.ready?.length ?? "?"} locked in before it`);
}
const hello = await host.ask({ type: "hello", have: views[0].view.turn - 1 });
console.log(`"where are we" at a 20-seat table (trimmed): ${(JSON.stringify(hello).length / 1024).toFixed(1)} KB`);
for (const p of pages) p.close();
