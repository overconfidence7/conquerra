/**
 * Session 27: plays a table of two people and bots against a local server, headlessly, for the next sessions' tests.
 * Nate makes a table, Kit joins from the link and sits, Nate starts, and both lock in their leaders' orders each
 * turn, over the same WebSocket and messages the page uses. It prints each turn's time and message sizes.
 *
 * Session 28: a third person, Wren, sits too. On turn 1 they talk at the table; Nate offers Kit a truce with a note,
 * Kit counters, Nate accepts; Nate and Kit make a group chat and scheme in it. The harness checks Wren's page never
 * hears of the offers or the group (and that the deal's news reaches her once the turn plays). With PAUSE=1, Wren
 * then asks for a pause: the harness answers it and prints what happened (session 28, Part 3).
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
const WREN = "wren@harness.test";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (ok, what) => {
  if (!ok) throw new Error(`check failed: ${what}`);
  console.log(`  ✓ ${what}`);
};

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
const wren = page(WREN, id, code);
console.log("Nate's table:", JSON.stringify((await nate.ask({ type: "hello" })).table.seats));
await kit.ask({ type: "hello" });
const sat = await kit.ask({ type: "table", act: { do: "sit", house: 3, leadersRun: true, name: "Kit" } });
if (!sat.ok) throw new Error(sat.error);
await wren.ask({ type: "hello" });
const wsat = await wren.ask({ type: "table", act: { do: "sit", house: 5, leadersRun: true, name: "Wren" } });
if (!wsat.ok) throw new Error(wsat.error);
// The table chat, before the start.
const said = await kit.ask({ type: "chat", act: { do: "send", chat: "table", text: "Evening all." } });
check(said.ok && said.chat.lines[0]?.text === "Evening all.", "Kit writes in the table chat at the table screen");
await sleep(300);
check(wren.pushes.some((m) => m.chat?.lines?.some((l) => l.text === "Evening all.")), "Wren reads it there");
const started = await nate.ask({ type: "table", act: { do: "start" } });
if (!started.ok) throw new Error(started.error);
let a = (await nate.next((m) => m.start)).start;
let b = (await kit.next((m) => m.start)).start;
let c = (await wren.next((m) => m.start)).start;
console.log(`started: Nate ${a.playerId}, Kit ${b.playerId}, Wren ${c.playerId}, ${a.view.players.length} seats, turn ${a.view.turn}`);
check(a.chat?.lines?.some((l) => l.text === "Evening all."), "the table chat carried into the game");

// Session 28: an offer between people, a counter, an acceptance.
const truce = { id: `${a.playerId}-t1-1`, from: a.playerId, to: b.playerId, terms: { kind: "truce", scope: { kind: "all" }, turns: 3 }, bond: "handshake", note: "HARNESS-NOTE: peace in the east?" };
const sent = await nate.ask({ type: "propose", offer: truce });
check(sent.ok && sent.answer.waiting, "Nate's offer to Kit is relayed (no instant answer: Kit is a person)");
await sleep(300);
check(kit.pushes.some((m) => m.talks?.some((r) => r.offer.id === truce.id && r.offer.note === truce.note)), "Kit's page gets the offer at once, with its note");
const counter = { ...truce, id: `${b.playerId}-t1-1`, from: b.playerId, to: a.playerId, counterTo: truce.id, terms: { kind: "truce", scope: { kind: "all" }, turns: 2 }, note: "HARNESS-COUNTER: two turns" };
const countered = await kit.ask({ type: "propose", offer: counter });
check(countered.ok, "Kit counters (two turns)");
const accepted = await nate.ask({ type: "answer", from: b.playerId, offer: counter.id, accept: true });
check(accepted.ok && accepted.talks[0]?.counterState === "accepted", "Nate accepts the counter");
await sleep(300);
check(kit.pushes.some((m) => m.talks?.some((r) => r.counterState === "accepted")), "Kit is told at once");

// Session 28: a group chat the third seat never hears of.
const group = await nate.ask({ type: "chat", act: { do: "group", with: [b.playerId], name: "HARNESS-GROUP" } });
check(group.ok && group.chat.chats[0]?.kind === "group", "Nate makes a group with Kit");
const groupId = group.chat.chats[0].id;
await sleep(2100);
await kit.ask({ type: "chat", act: { do: "send", chat: groupId, text: "HARNESS-SCHEME: Wren's capital is thin" } });
await sleep(300);
check(nate.pushes.some((m) => m.chat?.lines?.some((l) => l.text.startsWith("HARNESS-SCHEME"))), "Nate reads Kit's message in the group");
const wrenText = JSON.stringify(wren.pushes);
for (const secret of ["HARNESS-NOTE", "HARNESS-COUNTER", "HARNESS-GROUP", "HARNESS-SCHEME", groupId, truce.id, counter.id]) check(!wrenText.includes(secret), `Wren's page never heard "${secret}"`);
const back = await wren.ask({ type: "hello" });
check(back.start.chat.chats.map((x) => x.id).join() === "table" && !JSON.stringify(back).includes("HARNESS"), "Wren's own \"where are we\" has only the table chat");
console.log(`chat message on the wire: ${JSON.stringify(nate.pushes.find((m) => m.chat?.lines?.length)).length} bytes; a hello with chat: ${(JSON.stringify(back).length / 1024).toFixed(1)} KB`);
for (let i = 0; i < TURNS && !a.view.winner; i++) {
  const t0 = Date.now();
  const turn = a.view.turn;
  const before = nate.bytes() + kit.bytes();
  const lockA = nate.ask({ type: "lockIn", orders: a.generalOrders, turn });
  const lockB = kit.ask({ type: "lockIn", orders: b.generalOrders, turn });
  const lockC = wren.ask({ type: "lockIn", orders: c.generalOrders, turn });
  const [ua, ub, uc] = await Promise.all([lockA, lockB, lockC]);
  if (!ua.ok || !ub.ok || !uc.ok) throw new Error(ua.error ?? ub.error ?? uc.error);
  a = ua.update;
  b = ub.update;
  c = uc.update;
  if (turn === 1) {
    const started = (u) => (u.report?.events ?? []).filter((e) => e.type === "dealStarted");
    check(started(a).length === 1 && started(c).length === 1, "the deal between Nate and Kit started, and Wren's report tells of it (public)");
  }
  console.log(`turn ${turn}: resolved in ${Date.now() - t0} ms (wall, both lock-ins), ${((nate.bytes() + kit.bytes() - before) / 1024).toFixed(1)} KB to the two pages, now turn ${a.view.turn}`);
}
const hello = await nate.ask({ type: "hello", have: a.view.turn - 1 });
console.log(`"where are we" (trimmed): ${(JSON.stringify(hello).length / 1024).toFixed(1)} KB`);
nate.close();
kit.close();
wren.close();
