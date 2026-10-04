/**
 * UI check: screenshots of the menus, the replay and the phone layout, and full games played to the end.
 *
 *   pnpm ui-check screens   -> docs/art/screens/ui-*.png (desktop and phone)
 *   pnpm ui-check chain     -> a 3-hop chained attack queued on the map (desktop and phone), the share chips and
 *                              the layout diagnostics view: docs/art/screens/ui-chain-*.png, ui-share-chips.png,
 *                              ui-diagnostics.png
 *   pnpm ui-check fog       -> a 3-hop chain into the fog, at three moments of its replay (start, the fog lifting
 *                              after the first capture, end): docs/art/screens/ui-replay-fog-1/2/3.png and
 *                              ui-replay-fog-phone-2.png; the lobby's Bots row (ui-lobby-bots.png); and the
 *                              Desktop site tip, emulated (ui-desktop-site-tip.png)
 *   pnpm ui-check play      -> plays a whole game on a laptop screen and in phone emulation, using the replay
 *                              (and Skip), the turn timer (one real auto-lock) and the bottom sheet; prints a log
 *
 * It needs the built game running: `pnpm build` then `pnpm --filter web preview` (http://localhost:4173),
 * or pass another address as MAP_URL.
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const URL = process.env.MAP_URL ?? "http://localhost:4173/";
const CHROME = process.env.CHROME ?? (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : "/opt/pw-browsers/chromium-1194/chrome-linux/chrome");
const mode = process.argv[2] ?? "screens";
const DESKTOP = { width: 1440, height: 900, deviceScaleFactor: 1 };
const PHONE = { width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const SMALL = { width: 360, height: 740, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = (f) => join(root, "docs/art/screens", f);

const launch = () =>
  puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: process.platform === "win32" ? ["--enable-gpu", "--use-angle=d3d11", "--ignore-gpu-blocklist"] : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--no-sandbox"],
  });

const store = (page, f, arg) => page.evaluate(f, arg);

async function start(page, lobby = {}) {
  await page.goto(URL, { waitUntil: "networkidle0" });
  await store(page, (l) => window.__conquerraStore.getState().setLobby(l), lobby);
  await page.evaluate(() => [...document.querySelectorAll("button")].find((x) => x.textContent?.trim() === "Start").click());
  await page.waitForFunction(() => window.__conquerraMap?.stats && window.__conquerraMap.stats().tilesBaked === window.__conquerraMap.stats().tileCount, { timeout: 120000, polling: 100 });
  await sleep(500);
}

/** Bot-planned orders for you, then press the wax seal. */
async function planAndLock(page) {
  await page.evaluate(() => {
    window.__planned = false;
    void window.__conquerraStore.getState().autoPlan().then(() => (window.__planned = true));
  });
  await page.waitForFunction(() => window.__planned, { timeout: 30000, polling: 50 });
  await page.click(".seal");
}

const state = (page) =>
  page.evaluate(() => {
    const s = window.__conquerraStore.getState();
    return { screen: s.screen, turn: s.view?.turn, replay: !!s.replay, report: s.showReport, winner: s.view?.winner, out: !!s.view && s.view.winner === null && s.view.players.find((p) => p.id === s.view.me.id)?.eliminatedTurn != null, auto: s.autoLocked };
  });

async function waitFor(page, f, ms = 60000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await f()) return true;
    await sleep(120);
  }
  return false;
}

async function screens() {
  mkdirSync(join(root, "docs/art/screens"), { recursive: true });
  const browser = await launch();
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.log("page error:", e.message));
  await page.setViewport(DESKTOP);
  await page.goto(URL, { waitUntil: "networkidle0" });
  await page.screenshot({ path: out("ui-lobby.png") });
  await start(page, { bots: 3 });
  // A few turns in, so there's something to see.
  for (let i = 0; i < 3; i++) {
    await planAndLock(page);
    await waitFor(page, async () => (await state(page)).replay);
    await page.click(".replay-bar button");
    await waitFor(page, async () => !(await state(page)).replay);
    await store(page, () => window.__conquerraStore.getState().setShowReport(false));
  }
  await sleep(600);
  await page.screenshot({ path: out("ui-desktop.png") });
  await (await page.$(".rightcol .frame")).screenshot({ path: out("ui-players.png") });
  const card = await page.$(".rightcol .tcard");
  if (card) await card.screenshot({ path: out("ui-territory-card.png") });
  // The replay, caught mid-battle.
  await planAndLock(page);
  const caught = await waitFor(page, () => page.evaluate(() => (window.__conquerraReplay?.clashes ?? []).some((c) => c.progress > 0.25 && c.progress < 0.55)), 30000);
  await page.screenshot({ path: out("ui-replay-battle.png") });
  console.log(caught ? "  replay caught mid-battle" : "  (no battle in this replay; saved whatever was on screen)");
  await waitFor(page, async () => (await state(page)).report, 30000);
  await sleep(400);
  await page.screenshot({ path: out("ui-turn-report.png") });
  await store(page, () => window.__conquerraStore.getState().setShowReport(false));

  // Phone.
  for (const [vp, name] of [[PHONE, "phone"], [SMALL, "phone-small"]]) {
    await page.setViewport(vp);
    await start(page, { bots: 3 });
    await page.screenshot({ path: out(`ui-${name}.png`) });
    if (name === "phone") {
      // Open the bottom sheet (the Attack button opens the army panel for your capital).
      await page.tap(".phonebar .round[aria-label='Attack']");
      await sleep(700);
      await page.screenshot({ path: out("ui-phone-sheet.png") });
      // The timer in its red state (moved on for the picture only; the host keeps the real deadline).
      await store(page, () => window.__conquerraStore.setState({ clock: { endsAt: Date.now() + 11000, turnMs: 300000 } }));
      await sleep(600);
      await page.screenshot({ path: out("ui-phone-timer-red.png") });
    }
  }
  console.log("  saved docs/art/screens/ui-*.png");
  await browser.close();
}

/** Recruit, then a 3-hop chain out from the capital (each hop queued by tapping just past the last arrow). */
async function queueChain(page) {
  return page.evaluate(() => {
    const s = window.__conquerraStore;
    const g = () => s.getState();
    const near = (t) => g().ctx.map.borders.flatMap((b) => (b.a === t ? [b.b] : b.b === t ? [b.a] : []));
    const cap = g().view.me.capital;
    const dist = new Map([[cap, 0]]);
    const q = [cap];
    while (q.length) {
      const c = q.shift();
      for (const n of near(c)) if (!dist.has(n)) (dist.set(n, dist.get(c) + 1), q.push(n));
    }
    const path = [cap];
    for (let k = 1; k <= 4; k++) path.push(near(path[k - 1]).find((n) => dist.get(n) === k));
    g().quickRecruit();
    for (let k = 1; k <= 3; k++) (g().tap(path[k]), g().addDraft());
    return path;
  });
}

async function chain() {
  const browser = await launch();
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.log("page error:", e.message));
  for (const [vp, name] of [[DESKTOP, "desktop"], [PHONE, "phone"]]) {
    await page.setViewport(vp);
    await start(page, { bots: 3 });
    const path = await queueChain(page);
    if (vp === DESKTOP) await page.evaluate(() => window.__conquerraMap.zoomBy(1.5));
    await sleep(500);
    // Centre on the middle of the chain.
    await page.evaluate((ids) => {
      const g = window.__conquerraStore.getState();
      const pts = ids.map((t) => g.ctx.map.geometry.territories.find((x) => x.id === t).label);
      window.__conquerraMap.centreOn(pts.reduce((a, p) => a + p.x, 0) / pts.length, pts.reduce((a, p) => a + p.y, 0) / pts.length);
    }, path.slice(0, 4));
    await sleep(600);
    // Select where the chain ends, so the next tap would push on from there.
    await store(page, (t) => window.__conquerraStore.setState({ selected: t }), path[3]);
    await sleep(900);
    await page.screenshot({ path: out(`ui-chain-${name}.png`) });
    if (vp === DESKTOP) {
      // A first attack (just the recruit queued): all the share chips, Just enough first.
      await page.evaluate((cap) => {
        const s = window.__conquerraStore;
        const g = s.getState();
        s.setState({ queue: g.queue.slice(0, 1), selected: cap, draft: null });
        s.getState().tap(g.ctx.map.borders.flatMap((b) => (b.a === cap ? [b.b] : b.b === cap ? [b.a] : []))[0]);
      }, path[0]);
      await sleep(700);
      await (await page.$(".army-cell .army")).screenshot({ path: out("ui-share-chips.png") });
    } else {
      // A fourth hop: the estimate pill and the odds marked as an estimate.
      await store(page, (t) => window.__conquerraStore.getState().tap(t), path[4]);
      await sleep(700);
      await page.screenshot({ path: out("ui-share-chips-phone.png") });
    }
    console.log(`  ${name}: chain ${path.slice(0, 4).join(" > ")}`);
  }
  await page.goto(`${URL}?debug=layout`, { waitUntil: "networkidle0" });
  await sleep(400);
  await page.screenshot({ path: out("ui-diagnostics.png") });
  console.log("  saved docs/art/screens/ui-chain-*.png, ui-share-chips*.png, ui-diagnostics.png");
  await browser.close();
}

/** A whole game: one turn left to the timer (1-minute timer, so it auto-locks), the rest with Skip or watching. */
async function play(vp, label) {
  const browser = await launch();
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.log(`[${label}] page error:`, e.message));
  await page.setViewport(vp);
  await start(page, { bots: 3, turnSeconds: 60 });
  const log = (m) => console.log(`[${label}] ${m}`);
  // Turn 1: queue orders through the screen (tap Recruit), then wait for the timer to lock them in.
  await page.click(".round[aria-label^='Recruit']");
  log("turn 1: tapped Recruit, now waiting for the 1-minute timer…");
  const auto = await waitFor(page, async () => (await state(page)).replay, 75000);
  const st = await state(page);
  log(auto && st.auto ? `auto-lock happened (turn ${st.turn - 1} locked in by the timer)` : "auto-lock did NOT happen");
  // Watch this replay through.
  const t0 = Date.now();
  await waitFor(page, async () => !(await state(page)).replay, 40000);
  log(`replay played in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await store(page, () => window.__conquerraStore.getState().setShowReport(false));
  await sleep(200);
  if (vp.isMobile) {
    // The bottom sheet: open it from the Orders button, drag it to full height, then close it.
    await page.click(".phonebar .icon-btn");
    await sleep(300);
    const h = await page.$eval(".sheet", (e) => e.getBoundingClientRect().height);
    const handle = await (await page.$(".sheet-handle")).boundingBox();
    await page.touchscreen.touchStart(handle.x + handle.width / 2, handle.y + 10);
    await page.touchscreen.touchMove(handle.x + handle.width / 2, handle.y - 300);
    await page.touchscreen.touchEnd();
    await sleep(300);
    const h2 = await page.$eval(".sheet", (e) => e.getBoundingClientRect().height);
    log(`bottom sheet: opened at ${Math.round(h)} px, dragged to ${Math.round(h2)} px`);
    await page.click(".phonebar .icon-btn");
  }
  await store(page, () => window.__conquerraStore.getState().setShowReport(false));
  let turns = 1;
  for (let i = 0; i < 120; i++) {
    const s = await state(page);
    if (s.screen === "over") break;
    if (s.out) {
      log(`knocked out on turn ${s.turn}; choosing "See the result"`);
      await page.evaluate(() => [...document.querySelectorAll("button")].find((x) => x.textContent?.includes("See the result"))?.click());
      await waitFor(page, async () => (await state(page)).screen === "over", 60000);
      break;
    }
    await planAndLock(page);
    await waitFor(page, async () => (await state(page)).replay || (await state(page)).screen === "over", 20000);
    if ((await state(page)).replay) await page.click(".replay-bar button").catch(() => {});
    await waitFor(page, async () => !(await state(page)).replay, 20000);
    await store(page, () => window.__conquerraStore.getState().setShowReport(false));
    turns++;
  }
  const end = await page.evaluate(() => {
    const s = window.__conquerraStore.getState();
    return { screen: s.screen, turn: s.view.turn, winner: s.view.winner, me: s.view.me.id };
  });
  log(`game over screen: ${end.screen === "over"}; ended on turn ${end.turn}; winner ${end.winner === end.me ? "you" : end.winner}; ${turns} turns played from the screen`);
  if (end.screen === "over") await page.screenshot({ path: out(`ui-game-over${vp.isMobile ? "-phone" : ""}.png`) });
  await browser.close();
}

/** Recruit, then a 3-hop chain from the capital into the fog: a neutral you can see, then two you can't. */
async function queueFogChain(page) {
  return page.evaluate(() => {
    const s = window.__conquerraStore;
    const g = () => s.getState();
    const { ctx, view } = g();
    const near = (t) => ctx.map.borders.flatMap((b) => (b.a === t ? [b.b] : b.b === t ? [b.a] : []));
    const at = (t) => ctx.map.geometry.territories.find((x) => x.id === t).label;
    const mid = { x: ctx.map.geometry.width / 2, y: ctx.map.geometry.height / 2 };
    const cap = view.me.capital;
    const v = (t) => view.territories[t];
    let best = null;
    for (const a of near(cap))
      for (const b of near(a))
        for (const c of near(b)) {
          if (new Set([cap, a, b, c]).size < 4) continue;
          if (!(v(a).detail === "full" && v(a).owner === null && v(b).detail === "fogged" && v(c).detail === "fogged")) continue;
          // Prefer chains heading toward the middle of the map (open screen, away from the edges and menus).
          const d = Math.hypot(at(c).x - mid.x, at(c).y - mid.y);
          if (!best || d < best.d) best = { path: [cap, a, b, c], d };
        }
    const path = best.path;
    g().add({ kind: "recruit", territory: cap, count: 99 });
    for (let k = 1; k <= 3; k++) g().add({ kind: "move", from: path[k - 1], to: path[k], troops: "all" });
    return path;
  });
}

async function fog() {
  const browser = await launch();
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.log("page error:", e.message));
  // The lobby, with the Bots row.
  await page.setViewport(DESKTOP);
  await page.goto(URL, { waitUntil: "networkidle0" });
  await sleep(400);
  await page.screenshot({ path: out("ui-lobby-bots.png") });
  await page.screenshot({ path: out("ui-lobby.png") });
  for (const [vp, name] of [[DESKTOP, ""], [PHONE, "-phone"]]) {
    await page.setViewport(vp);
    await start(page, { bots: 3, turnSeconds: null });
    const path = await queueFogChain(page);
    if (vp === DESKTOP) await page.evaluate(() => window.__conquerraMap.zoomBy(1.6));
    await sleep(400);
    await page.evaluate((ids) => {
      const g = window.__conquerraStore.getState();
      const pts = ids.map((t) => g.ctx.map.geometry.territories.find((x) => x.id === t).label);
      window.__conquerraMap.centreOn(pts.reduce((a, p) => a + p.x, 0) / pts.length, pts.reduce((a, p) => a + p.y, 0) / pts.length);
    }, path);
    await store(page, () => window.__conquerraStore.setState({ selected: null }));
    await sleep(900);
    await page.click(".seal");
    await waitFor(page, async () => (await state(page)).replay);
    // 1. The start: the fog as it was while planning.
    await sleep(350);
    if (vp === DESKTOP) await page.screenshot({ path: out("ui-replay-fog-1.png") });
    // 2. Just after the first capture: the fog has lifted around it.
    const first = await page.evaluate(() => window.__conquerraStore.getState().report.events.findIndex((e) => e.type === "vision"));
    const lifted = await waitFor(page, () => page.evaluate((i) => (window.__conquerraReplay?.applied ?? 0) > i, first), 40000);
    // Let the fog fade (0.3 s) and any camera glide (0.45 s) finish.
    await sleep(800);
    await page.screenshot({ path: out(`ui-replay-fog${name}-2.png`) });
    // 3. The end: the map is exactly the new turn's view.
    if (vp === DESKTOP) {
      await waitFor(page, async () => !(await state(page)).replay, 40000);
      await store(page, () => window.__conquerraStore.getState().setShowReport(false));
      await sleep(700);
      await page.screenshot({ path: out("ui-replay-fog-3.png") });
    }
    console.log(`  ${name || "desktop"}: chain ${path.join(" > ")}${lifted ? "" : " (the fog-lift moment was not caught)"}`);
  }
  await browser.close();

  // The Desktop site tip: a 384 x 832 phone drawing a 980px-wide page (what Nate's phone reported).
  const b2 = await launch();
  const p2 = await b2.newPage();
  await p2.evaluateOnNewDocument(() => {
    Object.defineProperty(window.screen, "width", { get: () => 384 });
    Object.defineProperty(window.screen, "height", { get: () => 832 });
    const real = window.matchMedia.bind(window);
    window.matchMedia = (q) => (q.includes("pointer: coarse") ? { matches: true, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false } : real(q));
  });
  await p2.setViewport({ width: 980, height: 2124, deviceScaleFactor: 1, hasTouch: true });
  await p2.goto(URL, { waitUntil: "networkidle0" });
  await sleep(500);
  await p2.screenshot({ path: out("ui-desktop-site-tip.png") });
  console.log(`  Desktop site tip shown: ${await p2.evaluate(() => !!document.querySelector(".desktop-site-tip"))}`);
  await b2.close();
  console.log("  saved docs/art/screens/ui-replay-fog-*.png, ui-lobby-bots.png, ui-desktop-site-tip.png");
}

if (mode === "fog") await fog();
else if (mode === "play") {
  if (!process.argv.includes("--phone-only")) await play(DESKTOP, "laptop");
  await play(PHONE, "phone");
} else if (mode === "chain") await chain();
else await screens();
