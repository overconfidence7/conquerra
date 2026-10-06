/**
 * Session 13 screenshots (pause, saved games, the Spoils and Fate decks), on desktop (1440x900) and a 384 px phone:
 *   node apps/web/scripts/s13-shots.mjs            -> docs/art/screens/s13-*.png
 * Needs the built game running (`pnpm build`, `pnpm --filter web preview`). The Spoils hand, the mission and the Fate
 * event in the replay are put into the page's own view (they only change what's drawn), so the shots don't depend on
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

async function page(phone) {
  const p = await browser.newPage();
  if (phone) await p.emulate({ viewport: { width: 384, height: 832, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true }, userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36" });
  else await p.setViewport({ width: 1440, height: 900 });
  p.on("pageerror", (e) => console.log("page error:", e.message));
  await p.goto(URL, { waitUntil: "networkidle0" });
  return p;
}
const mapReady = (p) => p.waitForFunction(() => { const s = window.__conquerraMap?.stats?.(); return s && s.firstMapMs > 0 && s.tilesBaked === s.tileCount; }, { timeout: 120000, polling: 200 });
async function start(p, mapId, bots, turnSeconds = null) {
  await p.evaluate((m, b, t) => window.__conquerraStore.getState().setLobby({ mapId: m, bots: b, turnSeconds: t }), mapId, bots, turnSeconds);
  await p.evaluate(() => window.__conquerraStore.getState().start());
  await mapReady(p);
  await sleep(800);
}
const playTurns = (p, n) => p.evaluate(async (n) => {
  for (let i = 0; i < n; i++) {
    const g = window.__conquerraStore.getState();
    await g.autoPlan();
    await window.__conquerraStore.getState().lockIn();
    window.__conquerraStore.getState().endReplay();
    window.__conquerraStore.getState().setShowReport(false);
  }
}, n);
const shot = async (p, name) => {
  await sleep(700);
  await p.screenshot({ path: join(outDir, name) });
  console.log("  saved", name);
};
const clickText = (p, t) => p.evaluate((t) => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.trim().startsWith(t) && x.offsetParent); b?.click(); return !!b; }, t);
const centre = (p, id, up = 0) => p.evaluate((id, up) => { const r = window.__conquerraMap; const g = window.__conquerraStore.getState().ctx.map.geometry.territories.find((x) => x.id === id); r.centreOn(g.label.x, g.label.y + up / r.camera.cam.scale); }, id, up);
/** Change what the page draws (its own view only). */
const editView = (p, f) => p.evaluate(`(() => { const st = window.__conquerraStore; const s = st.getState(); const v = structuredClone(s.view); (${f})(v, s); st.setState({ view: v }); })()`);

for (const phone of [false, true]) {
  const sfx = phone ? "-phone" : "";
  // ---- Saved games: Continue in the lobby, the slots, and the paused timer ----
  {
    const p = await page(phone);
    await start(p, "embervale", 3, 300);
    await playTurns(p, 2);
    await p.evaluate(() => window.__conquerraStore.getState().togglePause());
    await sleep(500);
    await shot(p, `s13-paused${sfx}.png`);
    await p.evaluate(() => window.__conquerraStore.getState().saveToSlot("slot1"));
    await playTurns(p, 1);
    await p.evaluate(() => document.querySelector('[aria-label="Settings"]').click());
    await sleep(300);
    await clickText(p, "Save game");
    await sleep(900);
    await shot(p, `s13-save-slots${sfx}.png`);
    await clickText(p, "Close");
    await p.evaluate(() => window.__conquerraStore.getState().playAgain());
    await sleep(1200);
    await shot(p, `s13-continue${sfx}.png`);
    await clickText(p, "Load a saved game");
    await sleep(900);
    await shot(p, `s13-load-slots${sfx}.png`);
    await p.close();
  }
  // ---- The Spoils hand with a set ready, and a mission on the Leader card with its target lit ----
  {
    const p = await page(phone);
    await start(p, phone ? "twin-realms" : "embervale", phone ? 5 : 3);
    await playTurns(p, 2);
    await editView(p, `(v) => { v.me.spoils = ["sword", "tower", "sword", "sword"]; }`);
    await p.evaluate(() => window.__conquerraStore.getState().clearSelection());
    await sleep(400);
    await p.evaluate(() => document.querySelector(".card-stack")?.click());
    await sleep(1200);
    await shot(p, `s13-spoils${sfx}.png`);
    await clickText(p, "Close");
    // A mission: take any territory in a province next to you.
    const prov = await p.evaluate(() => {
      const s = window.__conquerraStore.getState(); const v = s.view; const map = s.ctx.map;
      const mine = Object.entries(v.territories).filter(([, t]) => t.detail === "full" && t.owner === v.me.id).map(([id]) => id);
      const pv = (id) => map.territories.find((t) => t.id === id).province;
      const nb = map.borders.flatMap((b) => (mine.includes(b.a) && !mine.includes(b.b) ? [b.b] : mine.includes(b.b) && !mine.includes(b.a) ? [b.a] : []));
      return pv(nb.find((t) => !mine.some((m) => pv(m) === pv(t))) ?? nb[0]);
    });
    await editView(p, `(v) => { v.me.missions = [{ id: "m1", card: "takeIn", kind: "takeIn", deadline: v.turn + 2, province: "${prov}", reward: { gold: 8 } }]; }`);
    await p.evaluate(() => window.__conquerraStore.getState().showMission("m1"));
    // Look at the province it's about.
    const lit = await p.evaluate((prov) => window.__conquerraStore.getState().ctx.map.territories.find((t) => t.province === prov).id, prov);
    await centre(p, lit, phone ? 260 : 0);
    if (phone) {
      await p.evaluate(() => document.querySelector(".orders-btn")?.click());
      await sleep(400);
      await clickText(p, "Card");
    }
    await sleep(900);
    await shot(p, `s13-mission${sfx}.png`);
    await p.close();
  }
  // ---- A Fate event in the replay, then the turn report ----
  {
    const p = await page(phone);
    await start(p, "embervale", 3);
    const t = await p.evaluate(() => {
      const st = window.__conquerraStore; const s = st.getState(); const v = s.view;
      const cap = v.me.capital; const nb = s.ctx.map.borders.find((b) => b.a === cap || b.b === cap); const t = nb.a === cap ? nb.b : nb.a;
      const before = structuredClone(v); before.territories[t] = { ...before.territories[t], owner: v.me.id, troops: 6 };
      const far = s.ctx.map.provinces.find((pr) => pr.id !== s.ctx.map.territories.find((x) => x.id === t).province).id;
      const events = [
        { type: "turnStart", turn: v.turn, seats: v.players.map((p) => p.id), step: 0 },
        { type: "fate", drawer: v.me.id, card: "wanderers", at: t, holder: v.me.id, tone: "good", shrugged: false, land: [{ territory: t, troops: 9 }], troops: 3, step: 1 },
        { type: "surface", what: "fate", province: far, step: 2 },
      ];
      st.setState({ view: before, replay: { before, report: { turn: v.turn, events }, key: Date.now() }, report: { turn: v.turn, events }, lastBefore: before });
      return t;
    });
    await centre(p, t, phone ? 160 : 0);
    await sleep(1100);
    await shot(p, `s13-fate-replay${sfx}.png`);
    await p.evaluate(() => window.__conquerraStore.getState().endReplay());
    await shot(p, `s13-fate-report${sfx}.png`);
    await p.close();
  }
}
await browser.close();
