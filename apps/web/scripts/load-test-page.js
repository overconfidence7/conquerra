/**
 * Session 35: the load test, 20 tables at once on the preview. It runs inside a signed-in tab of the game (the
 * preview sits behind Cloudflare Access, and the page's own requests carry that sign-in, so no cookie or token is ever
 * copied anywhere). Paste this file into the tab's console (or run it with a browser tool), then:
 *
 *   await conquerraLoadTest({ embervale: 10, rootholm: 10, turns: 3 })
 *
 * It makes the tables (4-seat Embervale with 3 Marshals, 10-seat Rootholm with 9; the 20 tables a day cap is the
 * budget, so one run a day), starts each with bots, then plays `turns` turns on all of them at once: every table locks
 * in together, and it times each table from its lock-in to its update. Then it resigns every seat (a Marshal takes it)
 * and clears the tables from this device's Online list (what "Leave" does), so nothing stays in the lobby.
 * Watch `npx wrangler tail conquerra --format json` beside it for the CPU and any error codes.
 */
async function conquerraLoadTest({ embervale = 10, rootholm = 10, turns = 3 } = {}) {
  const now = () => performance.now();
  const log = [];
  const say = (line) => (log.push(line), console.log(line));
  const api = async (path, init = {}) => {
    const res = await fetch(path, { ...init, credentials: "same-origin", headers: { "content-type": "application/json", ...(init.headers ?? {}) } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${path}: ${res.status} ${body.error ?? ""}`);
    return body;
  };
  const page = (id) => {
    const ws = new WebSocket(`${location.origin.replace(/^http/, "ws")}/api/games/${id}/ws`);
    let next = 1;
    const waiting = new Map(), pushes = [], listeners = [];
    ws.onmessage = (e) => {
      const m = JSON.parse(String(e.data));
      if (m.id && waiting.has(m.id)) (waiting.get(m.id)(m), waiting.delete(m.id));
      else (pushes.push(m), listeners.splice(0).forEach((f) => f(m)));
    };
    const open = new Promise((ok, bad) => ((ws.onopen = ok), (ws.onerror = () => bad(new Error(`socket ${id}`)))));
    return {
      ask: async (body) => (await open, new Promise((ok) => { const n = next++; waiting.set(n, ok); ws.send(JSON.stringify({ ...body, id: n })); })),
      next: (test) => new Promise((ok) => { const f = pushes.find(test); if (f) return ok(f); const c = (m) => (test(m) ? ok(m) : listeners.push(c)); listeners.push(c); }),
      close: () => ws.close(),
    };
  };
  const plan = [...Array(embervale).fill(["embervale", 3]), ...Array(rootholm).fill(["rootholm", 9])];
  const tables = [];
  const t0 = now();
  for (const [mapId, bots] of plan) {
    const settings = { mapId, bots, botLevel: "marshal", luck: 0.3, fog: true, mode: "classic", turnSeconds: 300, house: 0 };
    try {
      const { id } = await api("/api/games", { method: "POST", body: JSON.stringify({ settings, leadersRun: true }) });
      tables.push({ id, mapId, seats: bots + 1 });
    } catch (e) {
      say(`stopped making tables at ${tables.length}: ${e.message}`);
      break;
    }
  }
  say(`made ${tables.length} tables in ${Math.round(now() - t0)} ms`);
  try {
    for (const t of tables) t.page = page(t.id);
    await Promise.all(tables.map((t) => t.page.ask({ type: "hello" })));
    const ts = now();
    const started = await Promise.all(tables.map(async (t) => {
      const s0 = now();
      const r = await t.page.ask({ type: "table", act: { do: "start", withBots: true } });
      if (!r.ok) throw new Error(`${t.id}: ${r.error}`);
      t.view = (await t.page.next((m) => m.start)).start;
      return now() - s0;
    }));
    say(`all ${tables.length} started in ${Math.round(now() - ts)} ms (each from Start to turn 1: ${Math.round(Math.min(...started))} to ${Math.round(Math.max(...started))} ms)`);
    const turnsOut = [];
    for (let k = 0; k < turns; k++) {
      const tl = now();
      const times = await Promise.all(tables.map(async (t) => {
        const a = now();
        const u = await t.page.ask({ type: "lockIn", orders: t.view.generalOrders, turn: t.view.view.turn });
        if (!u.ok) throw new Error(`${t.id} turn ${t.view.view.turn}: ${u.error}`);
        t.view = u.update;
        return { map: t.mapId, ms: now() - a, turn: t.view.view.turn };
      }));
      const by = (m) => times.filter((x) => x.map === m).map((x) => x.ms);
      const stat = (xs) => (xs.length ? `${Math.round(Math.min(...xs))} / ${Math.round(xs.reduce((a, b) => a + b, 0) / xs.length)} / ${Math.round(Math.max(...xs))} ms` : "none");
      turnsOut.push(times);
      say(`turn ${k + 1}: all ${tables.length} updated within ${Math.round(now() - tl)} ms of locking in together; Embervale (min / avg / max) ${stat(by("embervale"))}, Rootholm ${stat(by("rootholm"))}; every table on turn ${[...new Set(times.map((x) => x.turn))].join(",")}`);
    }
    return { tables: tables.map((t) => ({ id: t.id, map: t.mapId, seats: t.seats })), log, turns: turnsOut };
  } finally {
    // Resign every seat (a Marshal plays it), and clear the tables from this device's list, as "Leave" does.
    for (const t of tables) t.page?.close();
    const ids = tables.map((t) => t.id);
    await Promise.all(ids.map((id) => api(`/api/games/${id}/resign`, { method: "POST" }).catch((e) => say(`resign ${id}: ${e.message}`))));
    try {
      const key = "conquerra.finishedCleared";
      localStorage.setItem(key, JSON.stringify([...new Set([...JSON.parse(localStorage.getItem(key) ?? "[]"), ...ids])]));
    } catch {}
    say(`resigned and cleared ${ids.length} tables`);
  }
}
