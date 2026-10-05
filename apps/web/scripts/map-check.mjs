/**
 * Map check: screenshots and performance numbers for the illustrated map, using the Chrome already installed.
 *
 *   pnpm map-check screens   -> docs/art/screens/*.png
 *   pnpm map-check perf      -> performance numbers (phone emulation, CPU slowed down 4x), printed and saved
 *   pnpm map-check bench     -> the art test bench (?lab=bench) at Far, Mid and Near: docs/art/screens/bench/*.png
 *                               (every House on every ground, every pair of grounds, every sprite, the map symbols,
 *                               the redo list and the House colours). "houses" does the same (it was folded in).
 *   pnpm map-check lab       -> the map lab: lab-overview.png, lab-checks.png, lab-gallery.png, lab-sim.png, and one
 *                               Far view per land shape (shape-<shape>.png), using the maps in docs/maps/lab-shots.json
 *   pnpm map-check labperf   -> big maps on a phone (CPU slowed 4x): paint time and frame rates at Far, Mid and Near,
 *                               plus how long the map maker took on the laptop; saved to docs/art/screens/perf-big.json
 *
 * It needs the built game running: `pnpm build` then `pnpm --filter web preview` (http://localhost:4173),
 * or pass another address as MAP_URL.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const URL = process.env.MAP_URL ?? "http://localhost:4173/";
const CHROME = process.env.CHROME ?? (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : "/opt/pw-browsers/chromium-1194/chrome-linux/chrome");
const mode = process.argv[2] ?? "screens";

const DESKTOP = { width: 1440, height: 900, deviceScaleFactor: 1 };
// A mid-range phone (Pixel 7a-class screen); the CPU is slowed 4x to stand in for its processor.
const PHONE = { width: 412, height: 915, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true };
const ZOOM_PX = { far: 48, mid: 120, near: 260 };

async function launch() {
  return puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    // Windows: the real GPU. Elsewhere (cloud machines without a GPU): software WebGL.
    args: process.platform === "win32"
      ? ["--enable-gpu", "--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-precise-memory-info",
          // UNCAPPED=1: lift Chrome's frame-rate cap (some laptops hold every page at 30 fps), to see real headroom.
          ...(process.env.UNCAPPED ? ["--disable-frame-rate-limit", "--disable-gpu-vsync"] : [])]
      : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--no-sandbox"],
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

/** Play turns with the Recruit bot planning your orders (started in the page and polled, never awaited across). */
async function playTurns(page, n) {
  for (let i = 0; i < n; i++) {
    await page.evaluate(() => {
      window.__turnDone = null;
      (async () => {
        const g = window.__conquerraStore.getState();
        if (g.screen !== "game" || !g.view || g.view.winner) return (window.__turnDone = "over");
        await g.autoPlan();
        await window.__conquerraStore.getState().lockIn();
        // Skip the animated replay and the report.
        window.__conquerraStore.getState().endReplay();
        window.__conquerraStore.getState().setShowReport(false);
        window.__turnDone = "ok";
      })().catch((e) => (window.__turnDone = `error: ${e.message}`));
    });
    await page.waitForFunction(() => window.__turnDone !== null, { timeout: 60000, polling: 100 });
    const done = await page.evaluate(() => window.__turnDone);
    if (done.startsWith("error")) console.log("  " + done);
    if (done !== "ok") break;
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
  console.log("Embervale: playing 7+ turns with the bot planning your orders...");
  await startGame(page, { mapId: "embervale", bots: 3 });
  await playTurns(page, 7);
  // Keep going until some land you saw has slipped into the fog (for the last-seen shots).
  for (let i = 0; i < 7; i++) {
    const n = await page.evaluate(() => Object.values(window.__conquerraStore.getState().view.territories).filter((t) => t.detail === "fogged" && t.lastSeen?.owner).length);
    if (n >= 3) break;
    await playTurns(page, 1);
  }
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
  // Tactical view lives in Settings (the map tools' last button is "fit the whole map").
  const tactical = async () => {
    await page.click('button[aria-label="Settings"]');
    await sleep(300);
    await page.evaluate(() => [...document.querySelectorAll(".menu-item")].find((b) => b.textContent.includes("Tactical view")).click());
    await page.evaluate(() => [...document.querySelectorAll(".popover button.link")].find((b) => b.textContent.trim() === "Close")?.click());
    await sleep(500);
  };
  await tactical();
  await shot(page, "embervale-tactical.png");
  await tactical();
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
    const row = { map: mapId, firstMapMs: Math.round(t.firstMap), allPaintedMs: Math.round(t.allPainted), paintMs: stats.bakeMs, steps: stats.steps, textureMB: stats.textureMB, ppu: stats.ppu, pan: {} };
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

/** The House swatches: houses.png (normal and colourblind) and house-on-ground.png (every House on every ground). */
async function houses() {
  const browser = await launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1900, height: 1500, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => console.log("page error:", e.message));
  await page.goto(URL + "?lab=houses", { waitUntil: "networkidle0" });
  await page.waitForFunction(() => document.body.dataset.ready === "1", { timeout: 60000 });
  await sleep(300);
  mkdirSync(join(root, "docs/art/screens"), { recursive: true });
  await (await page.$("#houses canvas")).screenshot({ path: join(root, "docs/art/screens/houses.png") });
  await (await page.$("#house-on-ground canvas")).screenshot({ path: join(root, "docs/art/screens/house-on-ground.png") });
  console.log("  saved docs/art/screens/houses.png and house-on-ground.png");
  await browser.close();
}

/** The map lab's address for a recipe. */
const labUrl = (r, extra = "") => r.recipe ? `${URL}?lab=maps&recipe=${encodeURIComponent(JSON.stringify(r.recipe))}${extra}` : r.preset ? `${URL}?lab=maps&preset=${r.preset}${extra}` : `${URL}?lab=maps&shape=${r.shape}&size=${r.size}&seed=${encodeURIComponent(r.seed)}${r.mask ? `&mask=${r.mask}` : ""}${extra}`;

/** Wait until the lab has made its map and (unless held) painted every tile. */
async function labReady(page, painted = true) {
  await page.waitForFunction(() => window.__labMade, { timeout: 600000, polling: 200 });
  if (painted)
    await page.waitForFunction(() => { const s = window.__conquerraMap?.stats?.(); return s && s.firstMapMs > 0 && s.tilesBaked === s.tileCount; }, { timeout: 600000, polling: 100 });
  return page.evaluate(() => ({ ms: Math.round(window.__labMade.ms), attempt: window.__labMade.attempt, fingerprint: window.__labMade.fingerprint, ok: !!window.__labMade.map }));
}

const clickText = (page, text) => page.evaluate((t) => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === t).click(), text);

/** Which maps the lab shots use (written in session 10, Part 4, from the candidates). */
function labShots() {
  try {
    return JSON.parse(readFileSync(join(root, "docs/maps/lab-shots.json"), "utf8"));
  } catch {
    return {
      overview: { shape: "inlandSea", size: 100, seed: "inland-1" },
      shapes: [
        { shape: "continent", size: 80, seed: "continent-1" },
        { shape: "archipelago", size: 60, seed: "archipelago-60-2" },
        { shape: "twinContinents", size: 80, seed: "twins-1" },
        { shape: "inlandSea", size: 100, seed: "inland-1" },
        { shape: "crescent", size: 80, seed: "crescent-1" },
        { shape: "mask", size: 120, seed: "dragon-1", mask: "dragon" },
      ],
      perf: [{ shape: "mask", size: 120, seed: "dragon-1", mask: "dragon" }],
    };
  }
}

async function lab() {
  const shots = labShots();
  const browser = await launch();
  const page = await browser.newPage();
  await page.setViewport(DESKTOP);
  page.on("pageerror", (e) => console.log("page error:", e.message));
  mkdirSync(join(root, "docs/art/screens"), { recursive: true });
  const out = (f) => join(root, "docs/art/screens", f);
  if (!process.env.ONLY_SHAPES) {
    await page.goto(labUrl(shots.overview), { waitUntil: "networkidle0" });
    const made = await labReady(page);
    console.log(`  overview map: ${JSON.stringify(made)}`);
    await sleep(600);
    await page.screenshot({ path: out("lab-overview.png") });
    await (await page.$(".lab-side")).screenshot({ path: out("lab-checks.png") });
    console.log("  saved lab-overview.png, lab-checks.png");
    // Sim this map: 100 games at the map's suggested top player count.
    await page.evaluate(() => {
      const sel = document.querySelector('select[aria-label="Games"]');
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(sel, "100");
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await sleep(200);
    await clickText(page, "Sim this map");
    await sleep(2500);
    await (await page.$("[data-panel=sim]")).screenshot({ path: out("lab-sim-running.png") });
    await page.waitForSelector("[data-panel=sim-results]", { timeout: 900000 });
    await page.evaluate(() => document.querySelector("[data-panel=sim]").scrollIntoView());
    await sleep(300);
    await (await page.$("[data-panel=sim]")).screenshot({ path: out("lab-sim.png") });
    console.log("  saved lab-sim-running.png, lab-sim.png:", (await page.$eval("[data-panel=sim-results]", (e) => e.innerText)).replace(/\n/g, " | "));
    await clickText(page, "Seed gallery");
    await page.waitForFunction(() => document.querySelectorAll(".lab-badge").length === 12, { timeout: 900000, polling: 500 });
    await sleep(500);
    await page.screenshot({ path: out("lab-gallery.png") });
    console.log("  saved lab-gallery.png");
  }
  // A smaller window, so even a 60-territory map shows at Far detail when it's all on screen.
  await page.setViewport({ width: 1000, height: 640, deviceScaleFactor: 1.5 });
  for (const r of shots.shapes) {
    await page.goto(labUrl(r, "&full=1"), { waitUntil: "networkidle0" });
    const m = await labReady(page);
    await page.evaluate(() => window.__conquerraMap.fit(false));
    await sleep(900);
    const level = await page.evaluate(() => window.__conquerraMap.stats().level);
    const file = `shape-${r.shape === "mask" ? (r.mask ?? "mask") : r.shape}.png`;
    await (await page.$(".lab-preview")).screenshot({ path: out(file) });
    console.log(`  saved ${file} (${r.size} territories, seed ${r.seed}, made in ${m.ms} ms on try ${m.attempt}, fingerprint ${m.fingerprint}, zoom ${level})`);
  }
  await browser.close();
}

async function labPerf() {
  const browser = await launch();
  const results = [];
  for (const r of labShots().perf) {
    const page = await browser.newPage();
    await page.emulate({ viewport: PHONE, userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36" });
    page.on("pageerror", (e) => console.log("page error:", e.message));
    // Make the map at full speed first, then slow the CPU 4x and paint it.
    await page.goto(labUrl(r, "&full=1&hold=1"), { waitUntil: "networkidle0" });
    const made = await labReady(page, false);
    const cdp = await page.createCDPSession();
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const t0 = await page.evaluate(() => ((window.__t0 = performance.now()), window.__labGo(), window.__t0));
    await page.waitForFunction(() => window.__conquerraMap?.stats && window.__conquerraMap.stats().firstMapMs > 0, { timeout: 300000, polling: 16 });
    const firstMap = await page.evaluate((t) => performance.now() - t, t0);
    await page.waitForFunction(() => { const s = window.__conquerraMap.stats(); return s.tilesBaked === s.tileCount; }, { timeout: 300000, polling: 50 });
    const allPainted = await page.evaluate((t) => performance.now() - t, t0);
    const stats = await page.evaluate(() => window.__conquerraMap.stats());
    const row = { map: r.preset ?? `${r.shape} ${r.size} (${r.seed})`, steps: stats.steps, territories: r.size, makeMsUnthrottled: made.ms, firstMapMs: Math.round(firstMap), allPaintedMs: Math.round(allPainted), paintMs: stats.bakeMs, textureMB: stats.textureMB, ppu: stats.ppu, tiles: stats.tileCount, pan: {} };
    for (const level of ["far", "mid", "near"]) {
      await zoomTo(page, ZOOM_PX[level]);
      await panFps(page, 600);
      row.pan[level] = await panFps(page, 3000);
    }
    results.push(row);
    console.log(JSON.stringify(row));
    await page.close();
  }
  await browser.close();
  writeFileSync(join(root, "docs/art/screens/perf-big.json"), JSON.stringify(results, null, 2) + "\n");
}

/**
 * The art test bench at Far, Mid and Near: docs/art/screens/bench/ (session 11's "before" pictures).
 * Each shot: [file, zoom (px a typical territory is wide), territory name to centre on (null: fit the map), dx, dy].
 */
const BENCH_SHOTS = {
  houses: [["houses-far.png", null, null], ["houses-mid.png", ZOOM_PX.mid, "Or on hills"], ["houses-near.png", ZOOM_PX.near, "Gules on forest", 60, 0]],
  grounds: [["grounds-far.png", null, null], ["grounds-mid.png", ZOOM_PX.mid, "Farmland | Rock"], ["grounds-near-forest-sand.png", ZOOM_PX.near, "Forest | Sand", 0, 40], ["grounds-near-rock-snow.png", ZOOM_PX.near, "Rock | Snow", 0, 40], ["grounds-near-river-coast.png", ZOOM_PX.near * 0.8, "River through hills", 0, 50]],
  sprites: [["sprites-far.png", null, null], ["sprites-mid.png", ZOOM_PX.mid, "village on farmland", 0, 30], ["sprites-near-trees.png", ZOOM_PX.near, "tree-conifer on grass", 90, 50], ["sprites-near-peaks-hills.png", ZOOM_PX.near, "peak on rock", 90, 50], ["sprites-near-buildings.png", ZOOM_PX.near * 0.7, "market on grass", 0, 40], ["sprites-near-being-built.png", ZOOM_PX.near * 0.7, "market (being built) on grass", 0, 40], ["sprites-near-army.png", ZOOM_PX.near, "Army and specialists on forest", 0, 30]],
  symbols: [["symbols-far.png", null, null], ["symbols-mid.png", ZOOM_PX.mid, "@pass"], ["symbols-near.png", ZOOM_PX.near, "@pass"]],
};

async function bench() {
  const browser = await launch();
  const page = await browser.newPage();
  await page.setViewport(DESKTOP);
  page.on("pageerror", (e) => console.log("page error:", e.message));
  const dir = join(root, "docs/art/screens/bench");
  mkdirSync(dir, { recursive: true });
  const painted = () => page.waitForFunction(() => { const s = window.__conquerraMap?.stats?.(); return s && s.firstMapMs > 0 && s.tilesBaked === s.tileCount; }, { timeout: 120000, polling: 100 });
  for (const [part, shots] of Object.entries(BENCH_SHOTS)) {
    await page.goto(`${URL}?lab=bench&part=${part}`, { waitUntil: "networkidle0" });
    await painted();
    for (const [file, px, name, dx = 0, dy = 0] of shots) {
      if (!name) await page.evaluate(() => window.__conquerraMap.fit(false));
      else {
        const at = await page.evaluate((name) => {
          const m = window.__bench.map;
          if (name === "@pass") return [m.geometry.passes[0].x, m.geometry.passes[0].y];
          const id = m.territories.find((t) => t.name === name).id;
          const l = m.geometry.territories.find((t) => t.id === id).label;
          return [l.x, l.y];
        }, name);
        await zoomTo(page, px, [at[0] + dx, at[1] + dy]);
      }
      await sleep(400);
      await painted();
      await sleep(300);
      await (await page.$(".bench-main")).screenshot({ path: join(dir, file) });
      console.log(`  saved docs/art/screens/bench/${file}`);
    }
  }
  // Tall enough that the whole redo sheet is on screen (the bench scrolls inside the window, and a screenshot of an
  // element only gets the part that's showing).
  await page.setViewport({ ...DESKTOP, height: 2400 });
  await page.goto(`${URL}?lab=bench&part=redo`, { waitUntil: "networkidle0" });
  await page.waitForFunction(() => document.body.dataset.ready === "1", { timeout: 60000 });
  await sleep(300);
  await (await page.$("#redo")).screenshot({ path: join(dir, "redo-list.png") });
  await (await page.$("#houses canvas")).screenshot({ path: join(dir, "house-colours.png") });
  console.log("  saved docs/art/screens/bench/redo-list.png and house-colours.png");
  await browser.close();
}

await (mode === "perf" ? perf() : mode === "houses" || mode === "bench" ? bench() : mode === "lab" ? lab() : mode === "labperf" ? labPerf() : screens());
