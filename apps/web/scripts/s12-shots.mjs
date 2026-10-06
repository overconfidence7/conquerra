/**
 * Session 12 screenshots (generals, captured generals, the Fallen), on desktop (1440x900) and a 384 px phone:
 *   node apps/web/scripts/s12-shots.mjs            -> docs/art/screens/s12-*.png
 * Needs the built game running (`pnpm build`, `pnpm --filter web preview`). The captured general and the world event
 * in the replay are put into the page's own view (they only change what's drawn), so the shots don't depend on
 * how a bot game happens to go.
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
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--enable-gpu", "--use-angle=d3d11"] });

async function open(phone, mapId, bots) {
  const page = await browser.newPage();
  if (phone) await page.emulate({ viewport: { width: 384, height: 832, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true }, userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36" });
  else await page.setViewport({ width: 1440, height: 900 });
  page.on("pageerror", (e) => console.log("page error:", e.message));
  await page.goto(URL, { waitUntil: "networkidle0" });
  await page.evaluate((m, b) => window.__conquerraStore.getState().setLobby({ mapId: m, bots: b, turnSeconds: null }), mapId, bots);
  await page.evaluate(() => [...document.querySelectorAll("button")].find((x) => x.textContent?.trim() === "Start").click());
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

for (const phone of [false, true]) {
  const sfx = phone ? "-phone" : "";
  // ---- Generals: the Command panel, then the queue with the general's planned orders ----
  {
    const page = await open(phone, "twin-realms", 3);
    // A turn in, so the realm has a little land.
    await page.evaluate(async () => { const g = window.__conquerraStore.getState(); await g.lockIn(); window.__conquerraStore.getState().endReplay(); window.__conquerraStore.getState().setShowReport(false); });
    const cap = await page.evaluate(() => window.__conquerraStore.getState().view.me.leader.territory);
    await page.evaluate(() => window.__conquerraStore.getState().clearSelection());
    await centre(page, cap, phone ? 220 : 0);
    await sleep(600);
    await tapOn(page, cap, phone);
    await sleep(700);
    await clickText(page, "Command");
    await shot(page, `s12-command${sfx}.png`);
    await clickText(page, "Push toward a place");
    // Aim three steps away, toward the land bridge (the far twin).
    const far = await page.evaluate((from) => {
      const g = window.__conquerraStore.getState();
      const nb = (t) => g.ctx.map.borders.flatMap((b) => (b.a === t ? [b.b] : b.b === t ? [b.a] : []));
      let ring = new Set([from]), seen = new Set([from]);
      for (let i = 0; i < 3; i++) { const next = new Set(); for (const t of ring) for (const n of nb(t)) if (!seen.has(n)) (seen.add(n), next.add(n)); ring = next; }
      return [...ring].sort()[0];
    }, cap);
    await page.evaluate((t) => window.__conquerraStore.getState().tap(t), far);
    await sleep(1200);
    if (phone) await page.evaluate(() => document.querySelector(".orders-btn")?.click());
    else await page.evaluate(() => window.__conquerraStore.getState().clearSelection());
    await shot(page, `s12-general-queue${sfx}.png`);
    await page.close();
  }
  // ---- A captured general on the map and in the right column ----
  {
    const page = await open(phone, "ringsea", 5);
    const t = await page.evaluate(() => {
      const st = window.__conquerraStore; const s = st.getState(); const v = structuredClone(s.view);
      const cap = v.me.capital; const nb = s.ctx.map.borders.find((b) => b.a === cap || b.b === cap); const t = nb.a === cap ? nb.b : nb.a;
      v.territories[t] = { ...v.territories[t], owner: v.me.id, troops: 9, generals: ["bot2"] };
      v.me.captured = [{ of: "bot2", territory: t, instruction: { kind: "hold" } }];
      const b2 = v.players.find((p) => p.id === "bot2"); b2.eliminatedTurn = 1; b2.eliminatedBy = v.me.id;
      st.setState({ view: v });
      return t;
    });
    await centre(page, t, phone ? 220 : 0);
    await sleep(600);
    await page.evaluate(() => window.__conquerraStore.getState().clearSelection());
    await tapOn(page, t, phone);
    await shot(page, `s12-captured${sfx}.png`);
    await page.close();
  }
  // ---- A world event in a living player's replay, then the turn report ----
  {
    const page = await open(phone, "embervale", 3);
    const t = await page.evaluate(() => {
      const st = window.__conquerraStore; const s = st.getState(); const v = s.view;
      const cap = v.me.capital; const nb = s.ctx.map.borders.find((b) => b.a === cap || b.b === cap); const t = nb.a === cap ? nb.b : nb.a;
      const before = structuredClone(v); before.territories[t] = { ...before.territories[t], owner: v.me.id, troops: 9 };
      const events = [
        { type: "turnStart", turn: v.turn, seats: v.players.map((p) => p.id), step: 0 },
        { type: "worldEvent", event: "plague", target: t, against: v.me.id, by: ["bot3"], spent: 12, losses: [{ territory: t, troops: 2 }], step: 1 },
      ];
      st.setState({ view: before, replay: { before, report: { turn: v.turn, events }, key: Date.now() }, report: { turn: v.turn, events }, lastBefore: before });
      return t;
    });
    await centre(page, t, phone ? 160 : 0);
    await sleep(900);
    await shot(page, `s12-world-event${sfx}.png`);
    await page.evaluate(() => { const s = window.__conquerraStore.getState(); s.endReplay(); });
    await shot(page, `s12-world-event-report${sfx}.png`);
    await page.close();
  }
  // ---- One of the Fallen: knocked out (idle turns), the choice, then the Fallen panel ----
  {
    const page = await open(phone, "embervale", 3);
    for (let i = 0; i < 60; i++) {
      const st = await page.evaluate(async () => { const g = window.__conquerraStore.getState(); const v = g.view; if (v.winner || v.players.find((p) => p.id === v.me.id).eliminatedTurn != null) return "out"; await g.lockIn(); window.__conquerraStore.getState().endReplay(); window.__conquerraStore.getState().setShowReport(false); return "in"; });
      if (st === "out") break;
    }
    await page.evaluate(() => window.__conquerraMap.fit());
    await shot(page, `s12-fallen-choice${sfx}.png`);
    await page.evaluate(() => window.__conquerraStore.getState().watch());
    for (let i = 0; i < 14; i++) {
      const inf = await page.evaluate(async () => { const g = window.__conquerraStore.getState(); if (g.view.winner || g.view.me.influence >= 9) return 99; await g.watchNext(); window.__conquerraStore.getState().endReplay(); return window.__conquerraStore.getState().view.me.influence; });
      if (inf >= 9) break;
    }
    await page.evaluate(() => window.__conquerraMap.fit());
    await shot(page, `s12-fallen${sfx}.png`);
    await page.close();
  }
}
await browser.close();
