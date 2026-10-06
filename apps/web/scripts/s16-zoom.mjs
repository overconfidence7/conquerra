/**
 * Session 16: the sharp zoom, measured and pictured the same way before and after.
 *   node apps/web/scripts/s16-zoom.mjs shots <before|after>   four spots on Wyrmland at the deepest zoom (a capital, a
 *                                                            forest edge, a mountain range, a coastline), desktop and a
 *                                                            384 px phone, menus hidden -> docs/art/screens/compare/
 *   node apps/web/scripts/s16-zoom.mjs perf <label>          desktop and a 384 px phone (CPU slowed 4x) on Wyrmland:
 *                                                            paint time, texture memory, art download, panning at Mid,
 *                                                            Near and the deepest zoom, how long the deepest zoom takes
 *                                                            to sharpen, and the replay's frame rate -> printed and
 *                                                            added to docs/art/screens/perf-s16.json
 *   node apps/web/scripts/s16-zoom.mjs pair                  side-by-side before | after pictures (needs both sets)
 * Needs the built game running (`pnpm build`, `pnpm --filter web preview`).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const URL = process.env.MAP_URL ?? "http://localhost:4173/";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const [mode = "shots", tag = "after"] = process.argv.slice(2);
const OUT = join(root, "docs/art/screens/compare");
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const DESKTOP = { viewport: { width: 1440, height: 900, deviceScaleFactor: 1 } };
const PHONE = {
  viewport: { width: 384, height: 832, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true },
  userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36",
};
/** Map points on Wyrmland (picked from its map data). */
const SPOTS = { capital: [1462, 244], forest: [1391, 216], mountain: [1097, 873], coast: [1484, 1743] };
/** Territory widths on screen (px): Mid, Near, and the deepest zoom (2.4 x the Near threshold). */
const PX = { mid: 120, near: 260, deepest: 456 };

const launch = () => puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--enable-gpu", "--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-precise-memory-info", "--disable-frame-rate-limit", "--disable-gpu-vsync"] });

async function start(page, device) {
  await page.emulate(device);
  await page.goto(URL, { waitUntil: "networkidle0" });
  await page.evaluate(() => window.__conquerraStore.getState().setLobby({ mapId: "wyrmland", bots: 5, fog: false }));
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

async function shots() {
  const browser = await launch();
  for (const [device, opts] of [["desktop", DESKTOP], ["phone", PHONE]]) {
    const page = await browser.newPage();
    await start(page, opts);
    // The bigger Near art arrives after the first paint (session 16): give it a moment.
    await sleep(3000);
    await page.addStyleTag({ content: "* { visibility: hidden !important } canvas { visibility: visible !important }" });
    for (const [spot, at] of Object.entries(SPOTS)) {
      await zoomTo(page, PX.deepest, at);
      await settle(page);
      await sleep(400);
      const file = join(OUT, `s16-near-${spot}-${device}-${tag}.png`);
      await page.screenshot({ path: file });
      console.log("saved", file);
    }
    await page.close();
  }
  await browser.close();
}

async function perf() {
  const browser = await launch();
  const rows = [];
  for (const [device, opts] of [["desktop", DESKTOP], ["phone", PHONE]]) {
    // A fresh profile for each, so the phone downloads the art too.
    const page = await (await browser.createBrowserContext()).newPage();
    const cdp = await page.createCDPSession();
    await cdp.send("Network.enable");
    const artReq = new Set();
    cdp.on("Network.responseReceived", (e) => { if (e.response.url.includes("/art/")) artReq.add(e.requestId); });
    let art = 0;
    cdp.on("Network.loadingFinished", (e) => { if (artReq.has(e.requestId)) art += e.encodedDataLength; });
    if (device === "phone") await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const t = await start(page, opts);
    const s0 = await page.evaluate(() => window.__conquerraMap.stats());
    const row = { device, label: tag, firstMapMs: Math.round(t.firstMap), allPaintedMs: Math.round(t.allPainted), paintMs: s0.bakeMs, ppu: s0.ppu, nearPpu: s0.nearPpu ?? 0, artKB: Math.round(art / 1024), pan: {} };
    for (const level of ["mid", "near", "deepest"]) {
      await zoomTo(page, PX[level], SPOTS.capital);
      if (level === "deepest") row.sharpenMs = await settle(page);
      await panFps(page, 600);
      row.pan[level] = await panFps(page, 3000);
    }
    const s1 = await page.evaluate(() => window.__conquerraMap.stats());
    row.textureMB = s1.textureMB;
    row.nearBaked = s1.nearBaked ?? 0;
    row.nearKept = s1.nearKept ?? 0;
    row.nearPaintMs = s1.nearMs ?? 0;
    row.jsHeapMB = Math.round((await page.evaluate(() => performance.memory?.usedJSHeapSize ?? 0)) / 1e5) / 10;
    row.replay = await replayFps(page);
    rows.push(row);
    console.log(JSON.stringify(row));
    await page.close();
  }
  await browser.close();
  const file = join(root, "docs/art/screens/perf-s16.json");
  const all = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : [];
  writeFileSync(file, JSON.stringify([...all.filter((r) => r.label !== tag), ...rows], null, 2) + "\n");
}

async function pair() {
  const sharp = createRequire(join(root, "packages/art/package.json"))("sharp");
  for (const device of ["desktop", "phone"])
    for (const spot of Object.keys(SPOTS)) {
      const [a, b] = ["before", "after"].map((t) => join(OUT, `s16-near-${spot}-${device}-${t}.png`));
      if (!existsSync(a) || !existsSync(b)) continue;
      const ma = await sharp(a).metadata();
      // Phones: the middle of the screen (where the map is, around the spot), so the pair stays readable.
      const crop = device === "phone" ? { left: 0, top: Math.round(ma.height * 0.25), width: ma.width, height: Math.round(ma.height * 0.5) } : { left: 0, top: 0, width: ma.width, height: ma.height };
      const [ia, ib] = await Promise.all([a, b].map((f) => sharp(f).extract(crop).toBuffer()));
      const gap = 12;
      await sharp({ create: { width: crop.width * 2 + gap, height: crop.height, channels: 3, background: "#101820" } })
        .composite([{ input: ia, left: 0, top: 0 }, { input: ib, left: crop.width + gap, top: 0 }])
        .png()
        .toFile(join(OUT, `s16-near-${spot}-${device}.png`));
      console.log("paired", spot, device);
    }
}

/** Where the phone's replay time goes (a CPU profile of the replay, top functions by their own time). */
async function profile() {
  const browser = await launch();
  const page = await (await browser.createBrowserContext()).newPage();
  const cdp = await page.createCDPSession();
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await start(page, PHONE);
  await sleep(3000);
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.setSamplingInterval", { interval: 500 });
  await page.evaluate(() => {
    const r = window.__conquerraMap;
    window.__probe = { insets: [], scales: new Set() };
    const si = r.setInsets.bind(r);
    r.setInsets = (i) => (window.__probe.insets.push(JSON.stringify(i)), si(i));
    const tick = () => { window.__probe.scales.add(r.camera.cam.scale.toFixed(4)); if (window.__probe.on !== false) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  await cdp.send("Profiler.start");
  const fps = await replayFps(page);
  console.log("probe", await page.evaluate(() => JSON.stringify({ insets: window.__probe.insets, scales: [...window.__probe.scales].slice(0, 12), n: window.__probe.scales.size })));
  const { profile: p } = await cdp.send("Profiler.stop");
  const self = new Map();
  const dt = p.timeDeltas;
  const byId = new Map(p.nodes.map((n) => [n.id, n]));
  p.samples.forEach((id, i) => {
    const n = byId.get(id);
    const f = n.callFrame;
    const key = `${f.functionName || "(anon)"} ${f.url.split("/").pop()}:${f.lineNumber}`;
    self.set(key, (self.get(key) ?? 0) + (dt[i] ?? 0) / 1000);
  });
  console.log(JSON.stringify(fps));
  for (const [k, ms] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(Math.round(ms), k);
  await browser.close();
}

if (mode === "profile") await profile();
else if (mode === "shots") await shots();
else if (mode === "perf") await perf();
else if (mode === "pair") await pair();
