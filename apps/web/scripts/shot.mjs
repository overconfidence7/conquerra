/**
 * Quick look at a real map in the game (dev helper): start a game, zoom, save a screenshot.
 *   node apps/web/scripts/shot.mjs <mapId> <out.png> [far|mid|near|<px>] [x,y] [fog on|off] [tactical]
 * Needs the built game running (`pnpm build`, `pnpm --filter web preview`), or MAP_URL.
 */
import puppeteer from "puppeteer-core";

const URL = process.env.MAP_URL ?? "http://localhost:4173/";
const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const [mapId = "greatmarch", out = "shot.png", zoom = "mid", at, fog = "off", tactical] = process.argv.slice(2);
const PX = { far: 48, mid: 120, near: 260 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--enable-gpu", "--use-angle=d3d11", "--ignore-gpu-blocklist"] });
const page = await browser.newPage();
await page.setViewport({ width: Number(process.env.W ?? 1440), height: Number(process.env.H ?? 900), deviceScaleFactor: 1 });
page.on("pageerror", (e) => console.log("page error:", e.message));
await page.goto(URL, { waitUntil: "networkidle0" });
await page.evaluate((t) => localStorage.setItem("conquerra.tactical", t ? "1" : "0"), !!tactical);
await page.evaluate((m, fog) => window.__conquerraStore.getState().setLobby({ mapId: m, fog: fog !== "off" }), mapId, fog);
await page.evaluate(() => [...document.querySelectorAll("button")].find((x) => x.textContent?.trim() === "Start").click());
await page.waitForFunction(() => { const s = window.__conquerraMap?.stats?.(); return s && s.firstMapMs > 0 && s.tilesBaked === s.tileCount; }, { timeout: 120000, polling: 100 });
if (zoom === "fit") await page.evaluate(() => window.__conquerraMap.fit(false));
else
  await page.evaluate((px, at) => {
    const r = window.__conquerraMap, cam = r.camera;
    const [mx, my] = at ?? [(cam.vp.width / 2 - cam.cam.x) / cam.cam.scale, (cam.vp.height / 2 - cam.cam.y) / cam.cam.scale];
    cam.centreOn(mx, my, px / cam.territorySize);
  }, PX[zoom] ?? Number(zoom), at ? at.split(",").map(Number) : null);
await sleep(700);
await page.waitForFunction(() => { const s = window.__conquerraMap.stats(); return s.tilesBaked === s.tileCount; }, { timeout: 120000, polling: 100 });
await sleep(300);
// SELECT=1: select your capital first (to see its panel). FOLD=1: fold the desktop dock.
if (process.env.SELECT) await page.evaluate(() => { const s = window.__conquerraStore.getState(); s.select(s.view.me.capital); });
if (process.env.FOLD) await page.click(".queue-extra .fold").catch(() => {});
if (process.env.SELECT || process.env.FOLD) await sleep(700);
// NOUI=1: just the map (every menu hidden), for close-ups.
if (process.env.NOUI) await page.addStyleTag({ content: "* { visibility: hidden !important } canvas { visibility: visible !important }" });
await page.screenshot({ path: out });
console.log("saved", out);
await browser.close();
