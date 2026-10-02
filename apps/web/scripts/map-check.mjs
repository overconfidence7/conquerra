/**
 * Map check: screenshots and performance numbers for the illustrated map, using the Chrome already installed.
 *
 *   pnpm map-check screens   -> docs/art/screens/*.png
 *   pnpm map-check perf      -> performance numbers (phone emulation, CPU slowed down 4x), printed and saved
 *
 * It needs the built game running: `pnpm build` then `pnpm --filter web preview` (http://localhost:4173),
 * or pass another address as MAP_URL.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const URL = process.env.MAP_URL ?? "http://localhost:4173/";
const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const mode = process.argv[2] ?? "screens";

const DESKTOP = { width: 1440, height: 900, deviceScaleFactor: 1 };
// A mid-range phone (Pixel 7a-class screen); the CPU is slowed 4x to stand in for its processor.
const PHONE = { width: 412, height: 915, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true };
const ZOOM_PX = { far: 48, mid: 120, near: 260 };

async function launch() {
  return puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--enable-gpu", "--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-precise-memory-info"],
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Open the lobby, pick the map and fog, start, and wait for the map to be fully painted. */
async function startGame(page, { mapId, fog = true, bots }) {
  await page.goto(URL, { waitUntil: "networkidle0" });
  await page.select("select", mapId);
  if (bots) await page.evaluate((b) => window.__conquerraStore.getState().setLobby({ bots: b }), bots);
  if (!fog) await page.evaluate(() => window.__conquerraStore.getState().setLobby({ fog: false }));
  const t0 = await page.evaluate(() => {
    window.__t0 = performance.now();
    [...document.querySelectorAll("button")].find((x) => x.textContent?.trim() === "Start").click();
    return window.__t0;
  });
  // First frame with the painted map.
  await page.waitForFunction(() => window.__conquerraMap?.stats && window.__conquerraMap.stats().firstMapMs > 0, { timeout: 120000, polling: 16 });
  const firstMap = await page.evaluate((t) => performance.now() - t, t0);
  await page.waitForFunction(() => { const s = window.__conquerraMap.stats(); return s.tilesBaked === s.tileCount; }, { timeout: 120000, polling: 50 });
  const allPainted = await page.evaluate((t) => performance.now() - t, t0);
  return { firstMap, allPainted };
}

/** Play turns with the Recruit bot planning your orders. */
async function playTurns(page, n) {
  for (let i = 0; i < n; i++) {
    const done = await page.evaluate(async () => {
      const g = window.__conquerraStore.getState();
      if (g.screen !== "game" || !g.view || g.view.winner) return true;
      await g.autoPlan();
      await window.__conquerraStore.getState().lockIn();
      window.__conquerraStore.getState().setShowReport(false);
      return false;
    });
    if (done) break;
  }
  await sleep(400);
}

/** Centre on a map point (default: the screen centre) at a zoom where a typical territory is `px` wide. */
async function zoomTo(page, px, at) {
  await page.evaluate((px, at) => {
    const r = window.__conquerraMap, cam = r.camera;
    const [mx, my] = at ?? [(cam.vp.width / 2 - cam.cam.x) / cam.cam.scale, (cam.vp.height / 2 - cam.cam.y) / cam.cam.scale];
    cam.centreOn(mx, my, px / cam.territorySize);
  }, px, at ?? null);
  await sleep(500);
}

const label = (page, id) => page.evaluate((id) => window.__conquerraStore.getState().ctx.map.geometry.territories.find((t) => t.id === id).label, id);

async function shot(page, file) {
  mkdirSync(join(root, "docs/art/screens"), { recursive: true });
  const el = await page.$(".map-host");
  await el.screenshot({ path: join(root, "docs/art/screens", file) });
  console.log("  saved docs/art/screens/" + file);
}

async function screens() {
  const browser = await launch();
  const page = await browser.newPage();
  await page.setViewport(DESKTOP);
  page.on("pageerror", (e) => console.log("page error:", e.message));
  console.log("Embervale: playing 7 turns with the bot planning your orders...");
  await startGame(page, { mapId: "embervale", bots: 3 });
  await playTurns(page, 7);
  const info = await page.evaluate(() => {
    const g = window.__conquerraStore.getState();
    const v = g.view;
    const remembered = Object.entries(v.territories).filter(([, t]) => t.detail === "fogged" && t.lastSeen).map(([id, t]) => ({ id, age: v.turn - t.lastSeen.turn, owner: t.lastSeen.owner }));
    remembered.sort((a, b) => (b.owner ? 1 : 0) - (a.owner ? 1 : 0) || b.age - a.age);
    return { capital: v.me.capital, turn: v.turn, remembered };
  });
  console.log(`  turn ${info.turn}; ${info.remembered.length} territories remembered in the fog`);
  const cap = await label(page, info.capital);
  await page.evaluate((id) => window.__conquerraStore.getState().select(id), info.capital);
  await zoomTo(page, ZOOM_PX.far, [cap.x, cap.y]);
  await page.evaluate(() => window.__conquerraMap.fit(false));
  await zoomTo(page, ZOOM_PX.far);
  await shot(page, "embervale-far.png");
  await zoomTo(page, ZOOM_PX.mid, [cap.x, cap.y]);
  await shot(page, "embervale-mid.png");
  await zoomTo(page, ZOOM_PX.near, [cap.x, cap.y]);
  await shot(page, "embervale-near.png");
  await zoomTo(page, ZOOM_PX.mid, [cap.x, cap.y]);
  await page.click(".map-tools button:last-child");
  await sleep(500);
  await shot(page, "embervale-tactical.png");
  await page.click(".map-tools button:last-child");
  await sleep(400);
  if (info.remembered.length) {
    const target = info.remembered[0];
    const p = await label(page, target.id);
    await zoomTo(page, ZOOM_PX.mid * 1.2, [p.x, p.y]);
    await shot(page, "embervale-fog-last-seen.png");
    // Hover the remembered territory for its card.
    const box = await (await page.$(".map-host")).boundingBox();
    const scr = await page.evaluate((p) => { const c = window.__conquerraMap.camera.cam; return [p.x * c.scale + c.x, p.y * c.scale + c.y]; }, p);
    await page.mouse.move(box.x + scr[0] + 6, box.y + scr[1] + 10);
    await sleep(400);
    await page.mouse.move(box.x + scr[0] + 8, box.y + scr[1] + 12);
    await sleep(500);
    await shot(page, "embervale-tap-card.png");
  } else console.log("  (nothing in the fog was remembered yet; skipped the fog and card shots)");

  console.log("Greatmarch at Far zoom...");
  await page.setViewport(DESKTOP);
  await startGame(page, { mapId: "greatmarch" });
  await playTurns(page, 4);
  await page.evaluate(() => window.__conquerraMap.fit(false));
  await zoomTo(page, ZOOM_PX.far);
  await shot(page, "greatmarch-far.png");
  await browser.close();
}

/** Pan steadily for `ms` and measure frames (in the page, with requestAnimationFrame). */
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
          // About a third of the screen per second, back and forth.
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

async function perf() {
  const browser = await launch();
  const results = [];
  for (const mapId of ["embervale", "greatmarch"]) {
    const page = await browser.newPage();
    await page.emulate({ viewport: PHONE, userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36" });
    const cdp = await page.createCDPSession();
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const t = await startGame(page, { mapId });
    const stats = await page.evaluate(() => window.__conquerraMap.stats());
    const row = { map: mapId, firstMapMs: Math.round(t.firstMap), allPaintedMs: Math.round(t.allPainted), paintMs: stats.bakeMs, textureMB: stats.textureMB, ppu: stats.ppu, pan: {} };
    for (const level of ["far", "mid", "near"]) {
      await zoomTo(page, ZOOM_PX[level]);
      await panFps(page, 600); // warm up
      row.pan[level] = await panFps(page, 3000);
    }
    const mem = await page.evaluate(() => performance.memory?.usedJSHeapSize ?? 0);
    row.jsHeapMB = Math.round(mem / 1e5) / 10;
    const gpu = await page.evaluate(() => { const c = document.createElement("canvas").getContext("webgl2"); const e = c.getExtension("WEBGL_debug_renderer_info"); return c.getParameter(e.UNMASKED_RENDERER_WEBGL); });
    row.gpu = gpu;
    results.push(row);
    console.log(JSON.stringify(row));
    await page.close();
  }
  await browser.close();
  writeFileSync(join(root, "docs/art/screens/perf.json"), JSON.stringify(results, null, 2) + "\n");
}

await (mode === "perf" ? perf() : screens());
