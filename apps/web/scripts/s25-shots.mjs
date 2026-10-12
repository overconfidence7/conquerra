/**
 * Session 25 screenshots, on desktop (1440x900) and a 384 px phone, into docs/art/screens/s25-*.png:
 *  - s25-wall-card: a rival's walled territory selected: "Walled: 11 defend (with Yewstead and Wildstead), +20% for 3 walled"
 *  - s25-wall-odds: an attack drafted on it: the attack panel's wall line, and the odds that count the bonus
 *  - s25-lobby-spots: the lobby's "Harder spots: Bots first / Anyone" row
 *   node apps/web/scripts/s25-shots.mjs     (MAP_URL=... for another server; ONLY=name for one shot)
 * Needs the built game running (`pnpm build`, then the web-preview server on 4173). The save is session 20b's real
 * Wyrmland game with walls put in by hand (make-s20b-save.ts); a snapshot carries on under today's rules, so the wall
 * shows today's bonus.
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
// Where things are in the save (make-s20b-save.ts prints them): the rival's three-territory wall and your army next to it.
const RIVAL = ["t007", "t000", "t001"], FRONT = "t018";
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

  // ---- The lobby's row ----
  if (!only || "s25-lobby-spots".includes(only)) {
    await p.evaluate(() => document.querySelector('[aria-label="Harder spots"]')?.scrollIntoView({ block: "center" }));
    await shot(p, "s25-lobby-spots", sfx);
  }

  // ---- A rival's wall of three: the card, then an attack drafted on it ----
  await p.evaluate((file) => window.__conquerraStore.getState().load({ file }), save);
  await p.waitForFunction(() => window.__conquerraStore.getState().view, { timeout: 60000 });
  await mapReady(p);
  await store(p, (s) => s.setShowReport?.(false));
  await sleep(500);
  await centre(p, [RIVAL[0], FRONT], phone ? 1.3 : 2.0);
  await store(p, (s, t) => s.select(t), RIVAL[0]);
  // On the phone the selection shows a strip with a "Card" button that opens the card.
  if (phone) {
    // A store selection doesn't open the phone's sheet (a tap on the map does): open it, then its Card tab.
    await p.evaluate(() => document.querySelector('button[aria-label="Orders"]')?.click());
    await sleep(500);
    await p.evaluate(() => [...document.querySelectorAll("button")].find((x) => x.textContent?.trim() === "Card")?.click());
  }
  await sleep(600);
  const line = await p.evaluate(() => [...document.querySelectorAll("*")].map((e) => e.textContent ?? "").find((t) => /^Walled: \d+ defend/.test(t.trim()) && t.length < 140));
  console.log("  the card says:", line?.trim());
  await shot(p, "s25-wall-card", sfx);
  await store(p, (s, a, b) => (s.clearSelection?.(), s.tap(a), s.tap(b)), FRONT, RIVAL[0]);
  await sleep(600);
  await p.evaluate(() => document.querySelector(".wall-note")?.scrollIntoView({ block: "center" }));
  console.log("  the attack panel says:", await p.evaluate(() => document.querySelector(".wall-note")?.textContent?.trim()));
  await shot(p, "s25-wall-odds", sfx);
  await p.close();
}
await browser.close();
