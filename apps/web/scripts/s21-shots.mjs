/**
 * Session 21 screenshots (the polish pass), desktop (1440x900) and a 384 px phone, into docs/art/screens/s21-*.png.
 *   node apps/web/scripts/s21-shots.mjs [part...]     parts: art (Part 1), fx (Part 2), build (Part 3), cine (Part 4),
 *                                                    living (Part 5), menus (Part 6); none = all
 *   ONLY=name for one shot, MAP_URL=... for another server.
 * Needs the built game running (`pnpm build`, then the web-preview server on 4173). Real saves: session 20d's
 * Wyrmland game (s20d-purse.json) and session 20c's finishing save (s20c-save.json: you hold 80%).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const out = process.env.OUT ?? join(root, "docs/art/screens");
const URL = process.env.MAP_URL ?? "http://localhost:4173/";
const only = process.env.ONLY ?? "";
const parts = new Set(process.argv.slice(2));
const want = (p) => !parts.size || parts.has(p);
const file = (n) => readFileSync(join(root, `docs/art/screens/${n}`), "utf8");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--enable-gpu", "--use-angle=d3d11"] });
const shot = async (p, name, sfx, opts = {}) => {
  if (only && !name.includes(only)) return;
  await sleep(opts.wait ?? 900);
  await p.screenshot({ path: join(out, `${name}${sfx}.png`), ...(opts.clip ? { clip: opts.clip } : {}) });
  console.log("  saved", `${name}${sfx}.png`);
};
const mapReady = (p) => p.waitForFunction(() => { const s = window.__conquerraMap?.stats?.(); return s && s.firstMapMs > 0 && s.tilesBaked === s.tileCount; }, { timeout: 120000, polling: 200 });
const load = async (p, f) => {
  await p.evaluate((f) => window.__conquerraStore.getState().load({ file: f }), f);
  await p.waitForFunction(() => window.__conquerraStore.getState().view, { timeout: 60000 });
  await mapReady(p);
  await p.evaluate(() => window.__conquerraStore.getState().setShowReport?.(false));
};
/** Centre the map on some territories at a zoom: a territory this many px wide on screen (120 Mid, 260 Near). */
const look = (p, ids, px) =>
  p.evaluate((ids, px) => {
    const st = window.__conquerraStore.getState();
    const g = st.ctx.map.geometry;
    const pts = ids.map((id) => g.territories.find((x) => x.id === id)?.label).filter(Boolean);
    const x = pts.reduce((a, q) => a + q.x, 0) / pts.length, y = pts.reduce((a, q) => a + q.y, 0) / pts.length;
    const cam = window.__conquerraMap.camera;
    cam.centreOn(x, y, px / cam.territorySize);
  }, ids, px);
const settle = (p) => p.waitForFunction(() => (window.__conquerraMap?.pendingNear?.() ?? 0) === 0, { timeout: 30000, polling: 100 }).catch(() => {});

async function page(phone) {
  const p = await browser.newPage();
  if (phone) await p.emulate({ viewport: { width: 384, height: 832, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true }, userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36" });
  else await p.setViewport({ width: 1440, height: 900 });
  p.on("pageerror", (e) => console.log("page error:", e.message));
  return p;
}

// ---------- Part 1: art batch 4 ----------
if (want("art")) {
  for (const phone of [false, true]) {
    const sfx = phone ? "-phone" : "";
    const p = await page(phone);
    // The lobby over the title art.
    await p.goto(URL, { waitUntil: "networkidle0" });
    await shot(p, "s21-lobby", sfx, { wait: 1500 });
    // A map at Mid: hills and pines (Wyrmland, the 20d game).
    await load(p, file("s20d-purse.json"));
    const forest = await p.evaluate(() => {
      const st = window.__conquerraStore.getState();
      // Hills and forest you can see (not fogged), nearest your capital first.
      const cap = st.ctx.map.territories.find((t) => t.id === st.view.me.capital);
      const seen = st.ctx.map.territories.filter((t) => (t.terrain === "hills" || t.terrain === "forest") && st.view.territories[t.id]?.detail === "full");
      seen.sort((a, b) => Math.hypot(a.x - cap.x, a.y - cap.y) - Math.hypot(b.x - cap.x, b.y - cap.y));
      return seen.slice(0, 2).map((t) => t.id);
    });
    await look(p, forest, phone ? 110 : 130);
    await settle(p);
    await shot(p, "s21-map-mid", sfx, { wait: 2500 });
    // Game over, won and lost (the 20d game, its result shown as each).
    for (const [name, mine] of [["s21-victory", true], ["s21-defeat", false]]) {
      await p.evaluate((mine) => {
        const st = window.__conquerraStore.getState();
        const other = st.view.players.find((x) => x.id !== st.view.me.id).id;
        window.__conquerraStore.setState({ screen: "over", view: { ...st.view, winner: mine ? st.view.me.id : other } });
      }, mine);
      await shot(p, name, sfx, { wait: 2500 });
    }
    await p.close();
  }
  // The bench: batch 4's pieces in the game's own renderer (figures at Near, the windmill, the sheet of trees).
  const p = await page(false);
  await p.setViewport({ width: 1440, height: 1700 });
  await p.goto(`${URL}?lab=bench&part=redo`, { waitUntil: "networkidle0" });
  await sleep(2500);
  const box = await (await p.$("#redo")).boundingBox();
  await shot(p, "s21-bench-trees", "", { clip: { x: box.x, y: box.y + 750, width: Math.min(box.width, 1400), height: 450 } });
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto(`${URL}?lab=bench&part=sprites`, { waitUntil: "networkidle0" });
  await sleep(4000);
  await p.evaluate(() => {
    const cam = window.__conquerraMap?.camera;
    if (!cam) return;
    cam.centreOn(cam.map.x + cam.map.width * 0.93, cam.map.y + cam.map.height * 0.1, 300 / cam.territorySize);
  });
  await sleep(2500);
  await shot(p, "s21-bench-figures", "");
  await p.close();
}

await browser.close();
