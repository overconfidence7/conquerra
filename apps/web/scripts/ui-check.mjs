/**
 * UI check: screenshots of the menus, the replay and the phone layout, and full games played to the end.
 *
 *   pnpm ui-check screens   -> docs/art/screens/ui-*.png (desktop and phone)
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

if (mode === "play") {
  if (!process.argv.includes("--phone-only")) await play(DESKTOP, "laptop");
  await play(PHONE, "phone");
} else await screens();
