/**
 * Session 34: a second person for checking Report and Block by hand against `wrangler dev`. Kit makes a table on
 * Embervale and prints its link; when someone sits, Kit writes in the table chat, starts the game with bots, and then
 * writes a numbered line every 8 s for two minutes (so a page that blocked Kit can be watched not getting them).
 *   node apps/web/scripts/s34-kit.mjs
 */
const BASE = process.env.HARNESS_URL ?? "http://127.0.0.1:8788";
const KIT = "kit@harness.test";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const res = await fetch(`${BASE}/api/games`, { method: "POST", headers: { "content-type": "application/json", "X-Dev-Email": KIT }, body: JSON.stringify({ settings: { mapId: "embervale", bots: 3, botLevel: "marshal", luck: 0.3, fog: true, mode: "classic", turnSeconds: 600, house: 3 }, leadersRun: true }) });
const { id, code } = await res.json();
console.log(`JOIN ${BASE}/?join=${code}`);
const ws = new WebSocket(`${BASE.replace(/^http/, "ws")}/api/games/${id}/ws`, { headers: { "X-Dev-Email": KIT } });
let next = 1;
const pushes = [];
ws.onmessage = (e) => pushes.push(JSON.parse(String(e.data)));
await new Promise((r) => (ws.onopen = r));
const ask = (body) => ws.send(JSON.stringify({ ...body, id: next++ }));
ask({ type: "hello" });
while (!pushes.some((m) => m.table?.seats?.filter(Boolean).length >= 2)) (await sleep(1500), ask({ type: "hello" }));
console.log("someone sat");
ask({ type: "chat", act: { do: "send", chat: "table", text: "KIT: you'll never take my capital." } });
await sleep(20000);
ask({ type: "table", act: { do: "start", withBots: true } });
console.log("started");
for (let i = 1; i <= 15; i++) {
  await sleep(8000);
  ask({ type: "chat", act: { do: "send", chat: "table", text: `KIT line ${i}` } });
  console.log(`said ${i}`);
}
ws.close();
