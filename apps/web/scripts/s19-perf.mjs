/**
 * Session 19: speed and memory of the big maps, on a laptop and on a 384 px phone (CPU slowed 4x), the way session 16
 * measured Wyrmland: paint time, texture memory (with the Near tiles), art download, panning at Mid, Near and the
 * deepest zoom around your capital, how long the deepest zoom takes to sharpen, and the replay's frame rate.
 *   node apps/web/scripts/s19-perf.mjs [maps=wyrmland:5,ashwing:7,krakenmere:9]   (map:bots)
 * Prints a line per map and device and writes docs/art/screens/perf-s19.json.
 * Needs the built game running (`pnpm build`, `pnpm --filter web preview`).
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const URL = process.env.MAP_URL ?? "http://localhost:4173/";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const [mapsArg = "wyrmland:5,ashwing:7,krakenmere:9"] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const DESKTOP = { viewport: { width: 1440, height: 900, deviceScaleFactor: 1 } };
const PHONE = {
  viewport: { width: 384, height: 832, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true },
  userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36",
};
/** Territory widths on screen (px): Mid, Near, and the deepest zoom (2.4 x the Near threshold). */
const PX = { mid: 120, near: 260, deepest: 456 };

const launch = () => puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--enable-gpu", "--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-precise-memory-info", "--disable-frame-rate-limit", "--disable-gpu-vsync"] });

async function start(page, device, mapId, bots) {
  await page.emulate(device);
  await page.goto(URL, { waitUntil: "networkidle0" });
  await page.evaluate((m, b) => ((window.__perfMap = m), (window.__perfBots = b)), mapId, bots);
  await page.evaluate(() => window.__conquerraStore.getState().setLobby({ mapId: window.__perfMap, bots: window.__perfBots, fog: false }));
  const t0 = await page.evaluate(() => {
    window.__t0 = performance.now();
    [...document.querySelectorAll("button")].find((x) => /^(Start|Start a new game)$/.test(x.textContent?.trim() ?? "")).click();
    return window.__t0;
  });
  await page.waitForFunction(() => window.__conquerraMap?.stats && window.__conquerraMap.stats().firstMapMs > 0, { timeout: 120000, polling: 16 });
  const firstMap = await page.evaluate((t) => performance.now() - t, t0);
  await page.waitForFunction(() => { const s = window.__conquerraMap.stats(); return s.tilesBaked === s.tileCount; }, { timeout: 180000, polling: 50 });
  const allPainted = await page.evaluate((t) => performance.now() - t, t0);
  return { firstMap, allPainted };
}

const zoomTo = (page, px, at) =>
  page.evaluate((px, at) => {
    const r = window.__conquerraMap, cam = r.camera;
    const [mx, my] = at ?? [(cam.vp.width / 2 - cam.cam.x) / cam.cam.scale, (cam.vp.height / 2 - cam.cam.y) / cam.cam.scale];
    cam.centreOn(mx, my, px / cam.territorySize);
  }, px, at);

/** Wait until the Near tiles on screen are painted (older builds have none: a short pause). */
async function settle(page) {
  const t0 = Date.now();
  await sleep(150);
  for (let i = 0; i < 200; i++) {
    const s = await page.evaluate(() => window.__conquerraMap.stats());
    if (s.nearBaked === undefined) {
      await sleep(800);
      break;
    }
    const pending = await page.evaluate(() => window.__conquerraMap.pendingNear?.() ?? 0);
    if (!pending) break;
    await sleep(30);
  }
  return Date.now() - t0;
}

const panFps = (page, ms) =>
  page.evaluate(
    (ms) =>
      new Promise((resolve) => {
        const cam = window.__conquerraMap.camera;
        const times = [];
        const t0 = performance.now();
        let dir = 1, moved = 0;
        const step = (t) => {
          times.push(t);
          const dx = (cam.vp.width / 3 / 60) * dir;
          cam.pan(dx, dx * 0.3);
          moved += Math.abs(dx);
          if (moved > cam.vp.width * 0.6) (dir = -dir), (moved = 0);
          if (t - t0 < ms) requestAnimationFrame(step);
          else {
            const gaps = times.slice(1).map((x, i) => x - times[i]).sort((a, b) => a - b);
            resolve({ fps: Math.round(((times.length - 1) / (times.at(-1) - times[0])) * 1000 * 10) / 10, p95ms: Math.round(gaps[Math.floor(gaps.length * 0.95)] * 10) / 10 });
          }
        };
        requestAnimationFrame(step);
      }),
    ms,
  );

/** Frames a second while the replay of a turn plays (your orders: recruit and attack from the capital). */
async function replayFps(page) {
  await page.evaluate(() => {
    const g = window.__conquerraStore.getState();
    const cap = g.view.me.capital;
    const nb = g.ctx.map.borders.flatMap((b) => (b.a === cap ? [b.b] : b.b === cap ? [b.a] : []));
    g.select(cap);
    g.tap(nb[0]);
    window.__conquerraStore.getState().addDraft();
    window.__conquerraMap.fit(false);
  });
  await sleep(300);
  await page.evaluate(() => void window.__conquerraStore.getState().lockIn());
  await page.waitForFunction(() => window.__conquerraStore.getState().replay !== null, { timeout: 60000, polling: 20 });
  return page.evaluate(
    () =>
      new Promise((resolve) => {
        const times = [];
        const step = (t) => {
          times.push(t);
          if (window.__conquerraStore.getState().replay && t - times[0] < 8000) requestAnimationFrame(step);
          else {
            const gaps = times.slice(1).map((x, i) => x - times[i]).sort((a, b) => a - b);
            resolve({ fps: Math.round(((times.length - 1) / (times.at(-1) - times[0])) * 1000 * 10) / 10, p95ms: Math.round(gaps[Math.floor(gaps.length * 0.95)] * 10) / 10, seconds: Math.round((times.at(-1) - times[0]) / 100) / 10 });
          }
        };
        requestAnimationFrame(step);
      }),
  );
}


const capitalSpot = (page) =>
  page.evaluate(() => {
    const g = window.__conquerraStore.getState();
    const t = g.ctx.map.territories.find((x) => x.id === g.view.me.capital);
    return [t.x, t.y];
  });

const rows = [];
const browser = await launch();
for (const [mapId, botsArg] of mapsArg.split(",").map((x) => x.split(":"))) {
  for (const [device, opts] of [["desktop", DESKTOP], ["phone", PHONE]]) {
    const page = await (await browser.createBrowserContext()).newPage();
    const cdp = await page.createCDPSession();
    await cdp.send("Network.enable");
    const artReq = new Set();
    cdp.on("Network.responseReceived", (e) => { if (e.response.url.includes("/art/")) artReq.add(e.requestId); });
    let art = 0;
    cdp.on("Network.loadingFinished", (e) => { if (artReq.has(e.requestId)) art += e.encodedDataLength; });
    if (device === "phone") await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const t = await start(page, opts, mapId, Number(botsArg ?? 5));
    const spot = await capitalSpot(page);
    const s0 = await page.evaluate(() => window.__conquerraMap.stats());
    const row = { map: mapId, players: Number(botsArg ?? 5) + 1, device, firstMapMs: Math.round(t.firstMap), allPaintedMs: Math.round(t.allPainted), paintMs: s0.bakeMs, ppu: s0.ppu, nearPpu: s0.nearPpu ?? 0, artKB: Math.round(art / 1024), pan: {} };
    for (const level of ["mid", "near", "deepest"]) {
      await zoomTo(page, PX[level], spot);
      if (level === "deepest") row.sharpenMs = await settle(page);
      await panFps(page, 600);
      row.pan[level] = await panFps(page, 3000);
    }
    const s1 = await page.evaluate(() => window.__conquerraMap.stats());
    row.textureMB = s1.textureMB;
    row.nearBaked = s1.nearBaked ?? 0;
    row.nearKept = s1.nearKept ?? 0;
    row.jsHeapMB = Math.round((await page.evaluate(() => performance.memory?.usedJSHeapSize ?? 0)) / 1e5) / 10;
    row.replay = await replayFps(page);
    rows.push(row);
    console.log(JSON.stringify(row));
    await page.close();
  }
}
await browser.close();
writeFileSync(join(root, "docs/art/screens/perf-s19.json"), JSON.stringify(rows, null, 2) + "\n");
