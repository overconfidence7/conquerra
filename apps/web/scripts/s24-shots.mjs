/**
 * Session 24's screenshots and the music check, on the built game (web-preview on 4174 or MAP_URL):
 *   - the title music starts after the first (real) tap in the lobby, crossfades to the planning loop when a game
 *     starts, to the replay loop as the replay plays and back, carrying on where each was (never from the start)
 *   - Settings with the sound rows (desktop 1440 and phone 384), Credits, and the sound bench
 *   node apps/web/scripts/s24-shots.mjs
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const out = join(root, "docs/art/screens");
mkdirSync(out, { recursive: true });
const URL = process.env.MAP_URL ?? "http://localhost:4174/";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--enable-gpu", "--use-angle=d3d11", "--ignore-gpu-blocklist"] });
const PHONE = { viewport: { width: 384, height: 832, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true }, userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36" };
const DESKTOP = { viewport: { width: 1440, height: 900, deviceScaleFactor: 1 } };
const music = (page) => page.evaluate(() => ({ playing: window.__conquerraMusic?.playing ?? null, tracks: window.__conquerraMusic?.state() ?? {} }));

async function game(device) {
  const page = await (await browser.createBrowserContext()).newPage();
  page.on("pageerror", (e) => console.log("page error:", e.message));
  await page.emulate(device === "phone" ? PHONE : DESKTOP);
  await page.goto(URL, { waitUntil: "networkidle0" });
  const log = {};
  log.beforeTap = await music(page);
  // A real tap on the lobby's title (not a button): phones allow sound after it.
  const box = await page.evaluate(() => { const r = document.querySelector("h1, .lobby")?.getBoundingClientRect(); return r ? { x: r.left + 10, y: r.top + 10 } : { x: 20, y: 20 }; });
  if (device === "phone") await page.touchscreen.tap(box.x, box.y);
  else await page.mouse.click(box.x, box.y);
  await sleep(2500);
  log.afterTap = await music(page);
  await page.evaluate(() => window.__conquerraStore.getState().setLobby({ mapId: "embervale", bots: 3, fog: true }));
  await page.evaluate(() => [...document.querySelectorAll("button")].find((x) => /^(Start|Start a new game)$/.test(x.textContent?.trim() ?? "")).click());
  await page.waitForFunction(() => { const s = window.__conquerraMap?.stats?.(); return s && s.tilesBaked === s.tileCount; }, { timeout: 180000, polling: 100 });
  await sleep(3000);
  log.planning = await music(page);
  await page.evaluate(() => void window.__conquerraStore.getState().lockIn());
  await page.waitForFunction(() => window.__conquerraStore.getState().replay !== null, { timeout: 90000, polling: 20 });
  await sleep(2500);
  log.replay = await music(page);
  await page.waitForFunction(() => window.__conquerraStore.getState().replay === null, { timeout: 90000, polling: 100 });
  await page.evaluate(() => window.__conquerraStore.getState().setShowReport?.(false));
  await sleep(2500);
  log.planningAgain = await music(page);
  return { page, log };
}

for (const device of ["desktop", "phone"]) {
  const { page, log } = await game(device);
  console.log(device, JSON.stringify(log));
  // Settings, with the sound rows.
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "Settings" || b.title === "Settings" || /Settings/.test(b.textContent ?? ""))?.click());
  await sleep(700);
  await page.screenshot({ path: join(out, `s24-settings-${device === "phone" ? "384" : "1440"}.png`) });
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent?.startsWith("Credits"))?.click());
  await sleep(600);
  await page.screenshot({ path: join(out, `s24-credits-${device === "phone" ? "384" : "1440"}.png`) });
  await page.close();
}
// The sound bench.
const bench = await (await browser.createBrowserContext()).newPage();
await bench.setViewport({ width: 1280, height: 1000, deviceScaleFactor: 1 });
await bench.goto(`${URL}?lab=sound`, { waitUntil: "networkidle0" });
await sleep(800);
await bench.screenshot({ path: join(out, "s24-bench.png") });
await bench.screenshot({ path: join(out, "s24-bench-full.png"), fullPage: true });
await browser.close();
