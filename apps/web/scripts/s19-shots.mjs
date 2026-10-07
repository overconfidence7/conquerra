/**
 * Session 19 screenshots, on desktop (1440x900) and a 384 px phone:
 *   node apps/web/scripts/s19-shots.mjs [fallen,maps]   -> docs/art/screens/s19-*.png
 *  - fallen: knocked out on Embervale (by idling), the choice ("You are one of the Fallen", with what you can do now),
 *    and the Fallen panel on the very first turn out (events ready now).
 *  - maps: each new map at Far and Mid (a game with the suggested players).
 * Needs the built game running (`pnpm build`, `pnpm --filter web preview`).
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const outDir = join(root, "docs/art/screens");
mkdirSync(outDir, { recursive: true });
const URL = process.env.MAP_URL ?? "http://localhost:4173/";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--enable-gpu", "--use-angle=d3d11", "--ignore-gpu-blocklist"] });
const parts = (process.argv[2] ?? "fallen,maps").split(",");

async function open(phone, mapId, bots) {
  const page = await browser.newPage();
  if (phone) await page.emulate({ viewport: { width: 384, height: 832, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true }, userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36" });
  else await page.setViewport({ width: 1440, height: 900 });
  page.on("pageerror", (e) => console.log("page error:", e.message));
  await page.goto(URL, { waitUntil: "networkidle0" });
  await page.evaluate((m, b) => window.__conquerraStore.getState().setLobby({ mapId: m, bots: b, turnSeconds: null }), mapId, bots);
  await page.evaluate(() => [...document.querySelectorAll("button")].find((x) => /^(Start|Start a new game)$/.test(x.textContent?.trim() ?? "")).click());
  await page.waitForFunction(() => { const s = window.__conquerraMap?.stats?.(); return s && s.firstMapMs > 0 && s.tilesBaked === s.tileCount; }, { timeout: 120000, polling: 200 });
  await sleep(800);
  return page;
}
const shot = async (page, name) => {
  await sleep(700);
  await page.screenshot({ path: join(outDir, name) });
  console.log("  saved", name);
};
const clickText = (page, t) => page.evaluate((t) => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.trim().startsWith(t) && x.offsetParent); b?.click(); return !!b; }, t);
/** Tap a territory as a player would (on a phone that opens the sheet), at its label. */
const tapOn = async (page, id, phone) => {
  if (!phone) return page.evaluate((t) => window.__conquerraStore.getState().tap(t), id);
  const [x, y] = await page.evaluate((id) => { const r = window.__conquerraMap; const g = window.__conquerraStore.getState().ctx.map.geometry.territories.find((x) => x.id === id); const c = r.camera.cam; return [g.label.x * c.scale + c.x, g.label.y * c.scale + c.y]; }, id);
  await page.touchscreen.tap(x, y);
};
const centre = (page, id, up = 0) => page.evaluate((id, up) => { const r = window.__conquerraMap; const g = window.__conquerraStore.getState().ctx.map.geometry.territories.find((x) => x.id === id); r.centreOn(g.label.x, g.label.y + up / r.camera.cam.scale); }, id, up);


const NEW_MAPS = [["ashwing", 7], ["sundered-crowns", 7], ["krakenmere", 9], ["rootholm", 9]];

for (const phone of [false, true]) {
  const sfx = phone ? "-phone" : "";
  if (parts.includes("fallen")) {
    const page = await open(phone, "embervale", 3);
    for (let i = 0; i < 80; i++) {
      const st = await page.evaluate(async () => { const g = window.__conquerraStore.getState(); const v = g.view; if (v.winner || v.players.find((p) => p.id === v.me.id).eliminatedTurn != null) return "out"; await g.lockIn(); window.__conquerraStore.getState().endReplay(); window.__conquerraStore.getState().setShowReport(false); return "in"; });
      if (st === "out") break;
    }
    const info = await page.evaluate(() => { const v = window.__conquerraStore.getState().view; return { turn: v.turn, out: v.players.find((p) => p.id === v.me.id).eliminatedTurn, influence: v.me.influence, winner: v.winner }; });
    console.log("  knocked out:", JSON.stringify(info));
    await page.evaluate(() => window.__conquerraMap.fit());
    await shot(page, `s19-fallen-choice${sfx}.png`);
    await clickText(page, "Strike as one of the Fallen");
    await sleep(500);
    await page.evaluate(() => window.__conquerraMap.fit());
    await shot(page, `s19-fallen-first-turn${sfx}.png`);
    await page.close();
  }
  if (parts.includes("maps"))
    for (const [mapId, players] of NEW_MAPS) {
      const page = await open(phone, mapId, players - 1);
      await page.evaluate(() => window.__conquerraMap.fit());
      await shot(page, `s19-${mapId}-far${sfx}.png`);
      await page.evaluate(() => { const r = window.__conquerraMap, cam = r.camera; const g = window.__conquerraStore.getState(); const t = g.ctx.map.territories.find((x) => x.id === g.view.me.capital); cam.centreOn(t.x, t.y, 120 / cam.territorySize); });
      await page.waitForFunction(() => { const s = window.__conquerraMap.stats(); return s.tilesBaked === s.tileCount; }, { timeout: 120000, polling: 100 });
      await shot(page, `s19-${mapId}-mid${sfx}.png`);
      await page.close();
    }
}
await browser.close();
