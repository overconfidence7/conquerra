/**
 * Session 16 screenshots, on desktop (1440x900) and a 384 px phone:
 *   node apps/web/scripts/s16-shots.mjs            -> docs/art/screens/s16-*.png
 * Needs the built game running (`pnpm build`, `pnpm --filter web preview`). Everything is played through the real game,
 * except: the Spoils hand is set in the page's own view (so the sheet shows a set to make), and one Fallen line is
 * added to the Chronicle (so the shot shows how an event on your land reads); both only change what's drawn.
 * The Near zoom before/after pictures are made by s16-zoom.mjs (docs/art/screens/compare/s16-near-*.png).
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
const shot = async (p, name) => {
  await sleep(900);
  await p.screenshot({ path: join(outDir, name) });
  console.log("  saved", name);
};
const store = (p, f, ...args) => p.evaluate(`(${f})(window.__conquerraStore.getState(), ...${JSON.stringify(args)})`);
const centre = (p, id, px = 0, up = 0) =>
  p.evaluate((id, px, up) => { const r = window.__conquerraMap; const g = window.__conquerraStore.getState().ctx.map.geometry.territories.find((x) => x.id === id); const scale = px ? px / r.camera.territorySize : r.camera.cam.scale; r.camera.centreOn(g.label.x, g.label.y + up / scale, scale); }, id, px, up);
const clickText = (p, t) => p.evaluate((t) => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.trim().startsWith(t) && x.offsetParent); b?.scrollIntoView({ block: "center" }); b?.click(); return !!b; }, t);
const neighbours = (p, t) => p.evaluate((t) => window.__conquerraStore.getState().ctx.map.borders.flatMap((b) => (b.a === t ? [b.b] : b.b === t ? [b.a] : [])), t);
const stepsAway = (p, from, k) =>
  p.evaluate((from, k) => {
    const m = window.__conquerraStore.getState().ctx.map;
    const nb = (t) => m.borders.flatMap((b) => (b.a === t ? [b.b] : b.b === t ? [b.a] : []));
    const d = new Map([[from, 0]]); const q = [from];
    while (q.length) { const t = q.shift(); for (const n of nb(t)) if (!d.has(n)) (d.set(n, d.get(t) + 1), q.push(n)); }
    return [...d].filter(([, x]) => x === k).map(([t]) => t);
  }, from, k);
const lockIn = (p) =>
  p.evaluate(async () => {
    const st = window.__conquerraStore;
    await st.getState().lockIn();
    st.getState().endReplay();
    st.getState().setShowReport(false);
  });

for (const phone of [false, true]) {
  const sfx = phone ? "-phone" : "";
  const p = await page(phone);

  // ---- The lobby: choose your House colour (Gules by default) ----
  await p.evaluate(() => document.querySelector(".houses")?.closest(".field")?.scrollIntoView({ block: "center" }));
  await shot(p, `s16-lobby-colour${sfx}.png`);

  await store(p, (s) => s.setLobby({ mapId: "wyrmland", bots: 5, turnSeconds: null }));
  await store(p, (s) => s.start());
  await mapReady(p);
  await sleep(1500);
  const cap = await store(p, (s) => s.view.me.capital);

  // ---- Fully zoomed out: the whole map clear of the menus ----
  await p.evaluate(() => window.__conquerraMap.fit(false));
  await shot(p, `s16-zoomed-out${sfx}.png`);

  // ---- An attack with the Leader going along, and the Initiative / Wait buttons (under More) ----
  const nb = await neighbours(p, cap);
  await centre(p, cap, 150, phone ? 160 : 0);
  await store(p, (s, cap, to) => (s.select(cap), s.tap(to)), cap, nb[0]);
  await sleep(500);
  await clickText(p, "More");
  await p.evaluate(() => document.querySelector(".leader-choice")?.scrollIntoView({ block: "start" }));
  await shot(p, `s16-attack-leader${sfx}.png`);
  if (phone) {
    // The Initiative and Wait buttons, further down the sheet (under More), with one held down for its explanation.
    await p.evaluate(() => [...document.querySelectorAll(".hint-wrap button")].find((b) => b.textContent?.trim() === "Initiative")?.scrollIntoView({ block: "center" }));
    const at = await p.evaluate(() => { const b = [...document.querySelectorAll(".hint-wrap button")].find((x) => x.textContent?.trim() === "Initiative"); const r = b?.getBoundingClientRect(); return r ? [r.x + r.width / 2, r.y + r.height / 2] : null; });
    if (at) {
      await p.touchscreen.touchStart(at[0], at[1]);
      await sleep(700);
      await p.touchscreen.touchEnd();
    }
    await shot(p, `s16-initiative-wait${sfx}.png`);
  }
  await store(p, (s) => s.clearSelection());

  // ---- A province lit up after tapping a territory (a rival's or unexplored land, a few steps away) ----
  const far = (await stepsAway(p, cap, 3))[0];
  await centre(p, far, 140, phone ? 140 : 0);
  await store(p, (s, t) => s.tap(t), far);
  await shot(p, `s16-province-lit${sfx}.png`);
  await store(p, (s) => s.clearSelection());

  // ---- Orders along a path: the confirm box, both ways ----
  const dest = (await stepsAway(p, cap, 4))[0];
  await centre(p, cap, 110, phone ? 170 : 0);
  await store(p, (s, cap, dest) => (s.startPath(cap), s.tap(dest)), cap, dest);
  await sleep(600);
  await shot(p, `s16-path-shortest${sfx}.png`);
  await store(p, (s) => s.setPathKind("sweep"));
  await shot(p, `s16-path-sweep${sfx}.png`);
  await store(p, (s) => s.cancelPath());
  await store(p, (s) => s.clearSelection());

  // ---- A few real turns, for the Chronicle ----
  for (let i = 0; i < 4; i++) {
    await store(p, (s, cap) => s.add({ kind: "recruit", territory: cap, count: "all" }), cap);
    await lockIn(p);
    await sleep(400);
  }

  // ---- The Spoils sheet with its table (a hand that can make two sets) ----
  await p.evaluate(() => { const st = window.__conquerraStore; const v = structuredClone(st.getState().view); v.me.spoils = ["sword", "tower", "laurel", "tower", "tower"]; st.setState({ view: v }); });
  await sleep(500);
  await p.evaluate(() => document.querySelector(".card-stack")?.click());
  await sleep(600);
  await shot(p, `s16-spoils-sheet${sfx}.png`);
  await p.evaluate(() => [...document.querySelectorAll(".dialog button.link")].find((b) => b.textContent?.trim() === "Close")?.click());

  // ---- The Chronicle (one Fallen line on your land added, so the shot shows how it reads) ----
  await p.evaluate(() => {
    const st = window.__conquerraStore;
    const s = st.getState();
    const me = s.view.me.id, at = s.view.me.capital;
    const turn = Math.max(...s.chronicle.map((r) => r.turn), 1);
    const plague = { type: "worldEvent", step: 99, event: "plague", target: at, against: me, by: ["bot1"], spent: 6, losses: [{ territory: at, troops: 3 }] };
    st.setState({ chronicle: s.chronicle.map((r) => (r.turn === turn ? { ...r, events: [...r.events, plague] } : r)) });
  });
  if (phone) await p.evaluate(() => document.querySelector('button[aria-label="Chronicle"]')?.click());
  else await clickText(p, "Chronicle");
  await sleep(800);
  await shot(p, `s16-chronicle${sfx}.png`);
  await p.close();
}
await browser.close();
