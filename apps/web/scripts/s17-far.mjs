/**
 * Session 17: province names at Far zoom, on desktop (1440x900) and a 384 px phone, Wyrmland and Embervale.
 *   node apps/web/scripts/s17-far.mjs [outDir]   -> s17-far-<map>[-phone].png (default docs/art/screens)
 * Needs the game running (MAP_URL, default the built preview at http://localhost:4173/).
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const outDir = process.argv[2] ?? join(root, "docs/art/screens");
mkdirSync(outDir, { recursive: true });
const URL = process.env.MAP_URL ?? "http://localhost:4173/";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--enable-gpu", "--use-angle=d3d11"] });
const store = (p, f, ...args) => p.evaluate(`(${f})(window.__conquerraStore.getState(), ...${JSON.stringify(args)})`);
const mapReady = (p) => p.waitForFunction(() => { const s = window.__conquerraMap?.stats?.(); return s && s.firstMapMs > 0 && s.tilesBaked === s.tileCount; }, { timeout: 120000, polling: 200 });

for (const mapId of ["wyrmland", "embervale"])
  for (const phone of [false, true]) {
    const p = await browser.newPage();
    if (phone) await p.emulate({ viewport: { width: 384, height: 832, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true }, userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36" });
    else await p.setViewport({ width: 1440, height: 900 });
    p.on("pageerror", (e) => console.log("page error:", e.message));
    await p.goto(URL, { waitUntil: "networkidle0" });
    await store(p, (s, mapId) => s.setLobby({ mapId, bots: mapId === "wyrmland" ? 5 : 3, turnSeconds: null }), mapId);
    await store(p, (s) => s.start());
    await mapReady(p);
    await sleep(1200);
    await p.evaluate(() => window.__conquerraMap.fit(false));
    await sleep(1200);
    const name = `s17-far-${mapId}${phone ? "-phone" : ""}.png`;
    await p.screenshot({ path: join(outDir, name) });
    console.log("  saved", name);
    await p.close();
  }
await browser.close();
