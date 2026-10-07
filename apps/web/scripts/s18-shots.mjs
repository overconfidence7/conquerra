/**
 * Session 18 screenshots, on desktop (1440x900) and a 384 px phone, into docs/art/screens/s18-*.png:
 *  - s18-lobby-names: the lobby's name fields (your Leader, your Steward)
 *  - s18-leaders-panel: the Leaders panel (your Leader and Steward, a captured Leader and Steward)
 *  - s18-command-menu: a Steward's command menu, and s18-command-military: a Leader's
 *  - s18-expand: "Expand toward" with its target glowing and the provinces on the way outlined
 *  - s18-budget: the budget control (chips, an exact amount, Take back)
 *  - s18-queue-mixed: the queue with your leaders' orders mixed in, with their portraits and the switch
 *   node apps/web/scripts/s18-shots.mjs     (MAP_URL=http://localhost:5173/ for the dev server; OUT=dir to write elsewhere)
 * Needs the game running (`pnpm build` and `pnpm --filter web preview`, or the dev server). Everything is the real
 * game: a few turns are played (your Steward runs the realm), then captured leaders are added through the page's own
 * store, as the engine would give them, so the panel shows all four kinds of row.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const out = process.env.OUT ?? join(root, "docs/art/screens");
const URL = process.env.MAP_URL ?? "http://localhost:4173/";
const only = process.env.ONLY ?? "";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--enable-gpu", "--use-angle=d3d11"] });
const shot = async (p, name, sfx) => {
  if (only && !name.includes(only)) return;
  await p.screenshot({ path: join(out, `${name}${sfx}.png`) });
  console.log("  saved", `${name}${sfx}.png`);
};
for (const phone of [false, true]) {
  const sfx = phone ? "-phone" : "";
  const p = await browser.newPage();
  if (phone) await p.emulate({ viewport: { width: 384, height: 832, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true }, userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36" });
  else await p.setViewport({ width: 1440, height: 900 });
  p.on("pageerror", (e) => console.log("page error:", e.message));
  await p.goto(URL, { waitUntil: "networkidle0" });

  // ---- The lobby: your Leader's name (filled in), your Steward's (optional) ----
  await p.evaluate(() => window.__conquerraStore.getState().setLobby({ mapId: "wyrmland", bots: 5, botLevel: "marshal", turnSeconds: null, leaderName: "Aldric", stewardName: "Odo" }));
  await sleep(400);
  await p.evaluate(() => document.querySelector(".name-input")?.closest(".field")?.scrollIntoView({ block: "center" }));
  await sleep(500);
  await shot(p, "s18-lobby-names", sfx);

  // ---- A game: a few turns, your Leader expanding, your Steward running the realm ----
  await p.evaluate(() => window.__conquerraStore.getState().start());
  await p.waitForFunction(() => window.__conquerraStore.getState().view, { timeout: 60000 });
  // Aldric gets a budget: 30% of your income.
  await p.evaluate(async () => {
    const st = window.__conquerraStore.getState();
    await st.setBudget(`leader:${st.view.me.id}`, { share: 0.3 });
  });
  for (let i = 0; i < 4; i++) {
    await p.evaluate(async () => {
      const st = window.__conquerraStore;
      await st.getState().lockIn();
      st.getState().endReplay();
      st.getState().setShowReport(false);
    });
  }
  // Captured leaders (as knocking a player out would give them), with purses, so the panel shows every kind of row.
  await p.evaluate(() => {
    const st = window.__conquerraStore;
    const v = structuredClone(st.getState().view);
    const rival = v.players.find((x) => x.id !== v.me.id);
    v.me.captured.push({ of: rival.id, territory: v.me.capital });
    v.me.leaders.push({ kind: "leader", of: rival.id, name: "Brannoc", command: { kind: "hold" }, budget: { gold: 4 }, purse: 7 }, { kind: "steward", of: rival.id, name: "Matilda", command: { kind: "economy" }, budget: { share: 0.1 }, purse: 5 });
    st.setState({ view: v });
  });
  // Expand toward a territory a few steps off that it moves toward this turn (as you'd pick one, looking at the map).
  const target = await p.evaluate(async () => {
    const st = window.__conquerraStore.getState();
    const { ctx, view, host } = st;
    const at = view.me.leader.territory;
    const nb = (t) => ctx.map.borders.flatMap((b) => (b.a === t ? [b.b] : b.b === t ? [b.a] : []));
    const d = new Map([[at, 0]]);
    const q = [at];
    while (q.length) { const t = q.shift(); for (const n of nb(t)) if (!d.has(n)) (d.set(n, d.get(t) + 1), q.push(n)); }
    let best = null;
    for (const [t, k] of [...d].filter(([, k]) => k >= 3 && k <= 5).sort((a, b) => a[1] - b[1])) {
      const orders = await host.planGenerals({ [`leader:${view.me.id}`]: { kind: "expand", territory: t } });
      const n = orders.filter((o) => o.general === view.me.id && o.kind === "move").length;
      if (!best || n > best.n) best = { t, n };
      if (n >= 3) break;
    }
    return best.t;
  });
  await p.evaluate(async (t) => {
    const st = window.__conquerraStore.getState();
    await st.setInstruction(`leader:${st.view.me.id}`, { kind: "expand", territory: t });
  }, target);
  await sleep(600);
  if (phone) await p.evaluate(() => document.querySelector('button[aria-label="Leaders"]')?.click());
  await sleep(500);
  await shot(p, "s18-leaders-panel", sfx);

  // The Leader open: its command's target glows, the provinces on the way are outlined.
  await p.evaluate(() => {
    const st = window.__conquerraStore.getState();
    st.openLeader(`leader:${st.view.me.id}`);
  });
  await p.evaluate((t) => {
    const st = window.__conquerraStore.getState();
    st.select(t);
  }, target);
  await sleep(300);
  // Fold the phone's sheet (the portrait toggles it), and look between the Leader and its target.
  if (phone) await p.evaluate(() => document.querySelector('button[aria-label="Leaders"]')?.click());
  await p.evaluate((t) => {
    const st = window.__conquerraStore.getState();
    const g = st.ctx.map.geometry;
    const a = g.territories.find((x) => x.id === st.view.me.leader.territory).label, b = g.territories.find((x) => x.id === t).label;
    window.__conquerraMap.centreOn((a.x + b.x) / 2, (a.y + b.y) / 2);
  }, target);
  await sleep(1500);
  await shot(p, "s18-expand", sfx);

  // The Steward's command menu.
  await p.evaluate(() => {
    const st = window.__conquerraStore.getState();
    st.select(null);
    st.openLeader(`steward:${st.view.me.id}`);
  });
  if (phone) await p.evaluate(() => document.querySelector('button[aria-label="Leaders"]')?.click());
  await sleep(300);
  await p.evaluate(() => [...document.querySelectorAll(".leader-row.open .row-buttons button")].find((b) => b.textContent.trim() === "Command")?.click());
  await sleep(700);
  await p.evaluate(() => document.querySelector(".leader-row.open")?.scrollIntoView({ block: "start" }));
  await sleep(300);
  await shot(p, "s18-command-menu", sfx);

  // The budget control.
  await p.evaluate(() => [...document.querySelectorAll(".leader-row.open .row-buttons button")].find((b) => b.textContent.trim() === "Budget")?.click());
  await sleep(500);
  await p.evaluate(() => document.querySelector(".leader-row.open")?.scrollIntoView({ block: "start" }));
  await sleep(300);
  await shot(p, "s18-budget", sfx);

  // The Leader's command menu.
  await p.evaluate(() => {
    const st = window.__conquerraStore.getState();
    st.openLeader(`leader:${st.view.me.id}`);
  });
  await sleep(300);
  await p.evaluate(() => [...document.querySelectorAll(".leader-row.open .row-buttons button")].find((b) => b.textContent.trim() === "Command")?.click());
  await sleep(700);
  await p.evaluate(() => document.querySelector(".leader-row.open")?.scrollIntoView({ block: "start" }));
  await sleep(300);
  await shot(p, "s18-command-military", sfx);

  // The queue: your orders with your leaders' mixed in (portraits), and the Mixed in / After mine switch.
  await p.evaluate(() => {
    const st = window.__conquerraStore.getState();
    st.openLeader(null);
    const cap = st.view.me.capital;
    st.add({ kind: "recruit", territory: cap, count: "all" });
    st.add({ kind: "invest", territory: cap });
  });
  if (phone) await p.evaluate(() => document.querySelector('button[aria-label="Orders"]')?.click());
  await sleep(800);
  await shot(p, "s18-queue-mixed", sfx);
  await p.close();
}
await browser.close();
