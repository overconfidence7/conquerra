/**
 * Session 35's screenshots of the screens at big tables (needs the game running: `pnpm dev`, or MAP_URL):
 *   node apps/web/scripts/s35-shots.mjs houses   -> s35-houses-desktop-20.jpg (20 Houses, 1920x1080: the Leaders panel in view)
 *   node apps/web/scripts/s35-shots.mjs phone    -> s35-houses-phone-out.jpg (knocked out on a phone, the Houses panel open)
 *   node apps/web/scripts/s35-shots.mjs far <name> [mapId]  -> s35-<name>.jpg (a map at Far, fitted; random 400 by default)
 *   node apps/web/scripts/s35-shots.mjs install <android|iphone>  -> s35-install-<form>.jpg (the lobby's Install line)
 * "Knocked out" is staged on the page (the store's view says you're out); the panels are the real ones.
 */
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "../../..");
const BASE = process.env.MAP_URL ?? "http://localhost:5173/";
const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const [mode = "houses", name = "far", mapArg] = process.argv.slice(2);
const out = (f) => join(root, "docs/art/screens", f);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--enable-gpu", "--use-angle=d3d11", "--ignore-gpu-blocklist"] });
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("page error:", e.message));
const PHONE = { width: 412, height: 915, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

async function start(mapId, bots) {
  await page.goto(BASE, { waitUntil: "networkidle0" });
  // (Not a first game: the guide's tips would sit over the panels.)
  await page.evaluate(() => localStorage.setItem("conquerra.guided", "1"));
  await page.evaluate((m, b, fallen) => window.__conquerraStore.getState().setLobby({ mapId: m, bots: b, mode: "conquest", ...(fallen ? {} : { fog: false }) }), mapId, bots, process.env.FALLEN !== "0");
  await sleep(500);
  await page.evaluate(() => [...document.querySelectorAll("button")].find((x) => x.textContent?.trim() === "Start").click());
  await page.waitForFunction(() => { const s = window.__conquerraMap?.stats?.(); return s && s.firstMapMs > 0 && s.tilesBaked === s.tileCount; }, { timeout: 180000, polling: 200 });
  await sleep(800);
}

if (mode === "houses") {
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await start("rootholm", 19);
  const box = await page.evaluate(() => {
    const leaders = [...document.querySelectorAll(".rightcol > *")].at(-1).getBoundingClientRect();
    const col = document.querySelector(".rightcol");
    return { leadersTop: Math.round(leaders.top), leadersBottom: Math.round(leaders.bottom), colBottom: Math.round(col.getBoundingClientRect().bottom), scrolls: col.scrollHeight > col.clientHeight, rows: document.querySelectorAll(".rightcol .players > li").length, more: document.querySelector(".players-more")?.textContent };
  });
  console.log(JSON.stringify(box));
  await page.screenshot({ path: out("s35-houses-desktop-20.jpg"), quality: 82 });
} else if (mode === "phone") {
  await page.setViewport(PHONE);
  await start("rootholm", 19);
  await page.evaluate(() => {
    const st = window.__conquerraStore;
    const s = st.getState();
    st.setState({ view: { ...s.view, players: s.view.players.map((p) => (p.id === s.view.me.id ? { ...p, eliminatedTurn: 8 } : p)) }, watching: true });
  });
  await sleep(600);
  await page.click('button[aria-label="Players"]');
  await sleep(600);
  const box = await page.evaluate(() => {
    const r = (q) => document.querySelector(q)?.getBoundingClientRect();
    const pop = r(".out-stack .popover"), watch = r(".watch-panel"), more = r(".players-more");
    const btns = [...document.querySelectorAll(".watch-panel button")].map((b) => b.getBoundingClientRect());
    return { popBottom: Math.round(pop?.bottom ?? -1), watchTop: Math.round(watch?.top ?? -1), moreBottom: Math.round(more?.bottom ?? -1), overlap: !!pop && !!watch && pop.bottom > watch.top, buttonsTop: btns.map((b) => Math.round(b.top)) };
  });
  console.log(JSON.stringify(box));
  await page.screenshot({ path: out(process.env.FALLEN === "0" ? "s35-houses-phone-out-watching.jpg" : "s35-houses-phone-out.jpg"), quality: 82 });
} else if (mode === "far") {
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  const mapId = mapArg ?? "random:400-island-quiet-heron";
  await start(mapId, mapId.startsWith("random:400") ? 15 : 3);
  await page.evaluate(() => window.__conquerraMap.fit(false));
  await sleep(1500);
  await page.screenshot({ path: out(`s35-${name}.jpg`), quality: 82 });
} else if (mode === "install") {
  // The lobby's Install line in its two forms: Android (Chrome's install prompt, staged) and an iPhone (Safari's hint).
  if (name === "iphone") {
    await page.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1");
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.goto(BASE, { waitUntil: "networkidle0" });
  } else {
    await page.setViewport(PHONE);
    await page.goto(BASE, { waitUntil: "networkidle0" });
    await page.evaluate(() => {
      const e = new Event("beforeinstallprompt");
      e.prompt = () => Promise.resolve();
      e.userChoice = Promise.resolve({ outcome: "dismissed" });
      window.dispatchEvent(e);
    });
  }
  await sleep(800);
  await page.evaluate(() => document.querySelector(".install-line")?.scrollIntoView({ block: "center" }));
  await sleep(400);
  console.log(await page.evaluate(() => document.querySelector(".install-line")?.textContent ?? "(no install line)"));
  await page.screenshot({ path: out(`s35-install-${name}.jpg`), quality: 82 });
}
await browser.close();
