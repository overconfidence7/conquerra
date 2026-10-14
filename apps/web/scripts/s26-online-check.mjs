/**
 * Session 26: play one online turn against a running server, the way a page does (the API, then the room's
 * WebSocket): make a game, list it, say hello, lock in. Prints each message's size.
 *
 *   node apps/web/scripts/s26-online-check.mjs [http://127.0.0.1:8787]   (wrangler dev, with DEV_EMAIL in apps/web/.dev.vars)
 */
const base = process.argv[2] ?? "http://127.0.0.1:8787";
const me = await (await fetch(`${base}/api/me`)).json();
console.log("me", me);
const made = await fetch(`${base}/api/games`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ settings: { mapId: "embervale", bots: 3, botLevel: "marshal", luck: 0.3, fog: true, mode: "classic", turnSeconds: 300 }, leadersRun: true }) });
const { id, error } = await made.json();
console.log("made", made.status, id ?? error);
const list = await (await fetch(`${base}/api/games`)).json();
console.log("list", JSON.stringify(list.games[0]));
const ws = new WebSocket(`${base.replace("http", "ws")}/api/games/${id}/ws`);
const got = [];
let resolveNext;
ws.onmessage = (e) => { got.push(e.data.length); const m = JSON.parse(e.data); resolveNext?.(m); };
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
const ask = (body) => new Promise((r) => { resolveNext = r; ws.send(JSON.stringify(body)); });
const hello = await ask({ id: 1, type: "hello" });
console.log("hello", hello.ok, "turn", hello.start.view.turn, "me", hello.start.view.me.id, "clock left s", Math.round((hello.start.clock.endsAt - hello.now) / 1000), "bytes", got.at(-1));
const lock = await ask({ id: 2, type: "lockIn", orders: hello.start.generalOrders, turn: 1 });
console.log("lockIn", lock.ok, "turn now", lock.update.view.turn, "events", lock.update.report.events.length, "bytes", got.at(-1));
const list2 = await (await fetch(`${base}/api/games`)).json();
console.log("list after", JSON.stringify({ turn: list2.games[0].turn, waitingOn: list2.games[0].waitingOn }));
ws.close();
