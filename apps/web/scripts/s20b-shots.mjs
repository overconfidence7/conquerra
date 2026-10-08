/**
 * Session 20b screenshots, on desktop (1440x900) and a 384 px phone, into docs/art/screens/s20b-*.png:
 *  - s20b-wall-single: a single walled territory (Dunhold)
 *  - s20b-wall-joined: a joined wall round five (your capital Hallowstone and four neighbours)
 *  - s20b-wall-card: a rival's walled territory selected: "Walled: 11 defend (with Yewstead and Wildstead)"
 *  - s20b-wall-odds: an attack drafted on it: the defenders count the wall's garrison, and so do the odds
 *  - s20b-wall-remembered: a rival's wall you saw two turns ago, greyed in the fog
 *   node apps/web/scripts/s20b-shots.mjs     (MAP_URL=... for another server; ONLY=name for one shot)
 * Needs the built game running (`pnpm build`, then the web-preview server on 4173). The save is a real Wyrmland game with
 * walls put in by hand (make-s20b-save.ts: docs/art/screens/s20b-save.json).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const out = process.env.OUT ?? join(root, "docs/art/screens");
const URL = process.env.MAP_URL ?? "http://localhost:4173/";
const only = process.env.ONLY ?? "";
const save = readFileSync(join(root, "docs/art/screens/s20b-save.json"), "utf8");
// Where things are in the save (make-s20b-save.ts prints them).
const FIVE = ["t054", "t044", "t048", "t052", "t059"], SINGLE = "t036", RIVAL = ["t007", "t000", "t001"], FRONT = "t018", REMEMBERED = ["t002", "t006"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--enable-gpu", "--use-angle=d3d11"] });
const shot = async (p, name, sfx) => {
  if (only && !name.includes(only)) return;
  await sleep(900);
  await p.screenshot({ path: join(out, `${name}${sfx}.png`) });
  console.log("  saved", `${name}${sfx}.png`);
};
const store = (p, f, ...args) => p.evaluate(`(${f})(window.__conquerraStore.getState(), ...${JSON.stringify(args)})`);
const mapReady = (p) => p.waitForFunction(() => { const s = window.__conquerraMap?.stats?.(); return s && s.firstMapMs > 0 && s.tilesBaked === s.tileCount; }, { timeout: 180000, polling: 200 });
/** Centre the map on these territories, at `scale` screen pixels a map unit (Mid is about 1.2-2.5). */
const centre = (p, ids, scale) =>
  p.evaluate((ids, scale) => {
    const st = window.__conquerraStore.getState();
    const g = st.ctx.map.geometry;
    const pts = ids.map((id) => g.territories.find((x) => x.id === id)?.label).filter(Boolean);
    const x = pts.reduce((a, q) => a + q.x, 0) / pts.length, y = pts.reduce((a, q) => a + q.y, 0) / pts.length;
    window.__conquerraMap.camera.centreOn(x, y, scale);
  }, ids, scale);

for (const phone of [false, true]) {
  const sfx = phone ? "-phone" : "";
  const p = await browser.newPage();
  if (phone) await p.emulate({ viewport: { width: 384, height: 832, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true }, userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36" });
  else await p.setViewport({ width: 1440, height: 900 });
  p.on("pageerror", (e) => console.log("page error:", e.message));
  await p.goto(URL, { waitUntil: "networkidle0" });
  await p.evaluate((file) => window.__conquerraStore.getState().load({ file }), save);
  await p.waitForFunction(() => window.__conquerraStore.getState().view, { timeout: 60000 });
  await mapReady(p);
  await store(p, (s) => s.setShowReport?.(false));
  await sleep(500);

  // ---- A single walled territory, and the joined wall round five ----
  await store(p, (s) => s.clearSelection?.());
  await centre(p, [SINGLE], phone ? 1.6 : 2.2);
  await shot(p, "s20b-wall-single", sfx);
  await centre(p, FIVE, phone ? 1.0 : 1.7);
  await shot(p, "s20b-wall-joined", sfx);

  // ---- A rival's wall: the card, then an attack drafted on it (the odds count the garrison) ----
  await centre(p, [RIVAL[0], FRONT], phone ? 1.3 : 2.0);
  await store(p, (s, t) => s.select(t), RIVAL[0]);
  await shot(p, "s20b-wall-card", sfx);
  await store(p, (s, a, b) => (s.clearSelection?.(), s.tap(a), s.tap(b)), FRONT, RIVAL[0]);
  await sleep(600);
  await p.evaluate(() => document.querySelector(".wall-note")?.scrollIntoView({ block: "center" }));
  await shot(p, "s20b-wall-odds", sfx);

  // ---- A wall you remember (in the fog, greyed) ----
  await store(p, (s) => s.clearSelection?.());
  await centre(p, REMEMBERED, phone ? 1.3 : 2.0);
  await shot(p, "s20b-wall-remembered", sfx);
  await p.close();
}
await browser.close();
