/**
 * Session 20c screenshots, on desktop (1440x900) and a 384 px phone, into docs/art/screens/s20c-*.png:
 *  - s20c-lobby: your Leader and Steward with their personalities (the Conqueror, the Turtle)
 *  - s20c-leaders: the Leaders panel: "Aldric, the Conqueror" on Run the military, "Odo, the Turtle"
 *  - s20c-finishing-queue: a finishing turn's queue (the mass, the sweep, the blanket) and how many orders it wrote
 *  - s20c-finishing-map: the same turn on the map: the marches to the staging territory and the sweep on from it
 *  - s20c-home-sweep: a sweep of your own land before the attack: transfers into the land a rival army could reach
 *   node apps/web/scripts/s20c-shots.mjs     (MAP_URL=... for another server; ONLY=name for one shot)
 * Needs the built game running (`pnpm build`, then the web-preview server on 4173). Everything is the real game: real
 * saves made by make-s20c-save.ts (docs/art/screens/s20c-save.json: Wyrmland, you hold 80% with two rivals left;
 * s20c-home.json: Wyrmland on turn 16, a rival army that could get behind your front).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const out = process.env.OUT ?? join(root, "docs/art/screens");
const URL = process.env.MAP_URL ?? "http://localhost:4173/";
const only = process.env.ONLY ?? "";
const finishing = readFileSync(join(root, "docs/art/screens/s20c-save.json"), "utf8");
const home = readFileSync(join(root, "docs/art/screens/s20c-home.json"), "utf8");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--enable-gpu", "--use-angle=d3d11"] });
const shot = async (p, name, sfx) => {
  if (only && !name.includes(only)) return;
  await sleep(900);
  await p.screenshot({ path: join(out, `${name}${sfx}.png`) });
  console.log("  saved", `${name}${sfx}.png`);
};
const store = (p, f, ...args) => p.evaluate(`(${f})(window.__conquerraStore.getState(), ...${JSON.stringify(args)})`);
const mapReady = (p) => p.waitForFunction(() => { const s = window.__conquerraMap?.stats?.(); return s && s.firstMapMs > 0 && s.tilesBaked === s.tileCount; }, { timeout: 120000, polling: 200 });
const openLeaders = (p, phone) => (phone ? p.evaluate(() => { if (!document.querySelector(".leader-list")?.offsetParent) document.querySelector('button[aria-label="Leaders"]')?.click(); }) : null);
const load = async (p, file) => {
  await p.evaluate((file) => window.__conquerraStore.getState().load({ file }), file);
  await p.waitForFunction(() => window.__conquerraStore.getState().view, { timeout: 60000 });
  await mapReady(p);
  await store(p, (s) => s.setShowReport?.(false));
};
/** Centre the map on these territories. */
const centre = (p, ids, zoom = 0.8) =>
  p.evaluate((ids, zoom) => {
    const st = window.__conquerraStore.getState();
    const g = st.ctx.map.geometry;
    const pts = ids.map((id) => g.territories.find((x) => x.id === id)?.label).filter(Boolean);
    if (!pts.length) return;
    const x = pts.reduce((a, q) => a + q.x, 0) / pts.length, y = pts.reduce((a, q) => a + q.y, 0) / pts.length;
    const r = window.__conquerraMap;
    r.camera.centreOn(x, y, r.camera.cam.scale * zoom);
  }, ids, zoom);
/** Your Leader on Run the military with 80% of your income; the leaders' orders written into the queue. */
const runTheMilitary = (p) =>
  store(p, async (s) => {
    const me = s.view.me.id;
    await s.setInstruction(`leader:${me}`, { kind: "military" });
    await s.setBudget(`leader:${me}`, { share: 0.8 });
  });

for (const phone of [false, true]) {
  const sfx = phone ? "-phone" : "";
  const p = await browser.newPage();
  if (phone) await p.emulate({ viewport: { width: 384, height: 832, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true }, userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36" });
  else await p.setViewport({ width: 1440, height: 900 });
  p.on("pageerror", (e) => console.log("page error:", e.message));
  await p.goto(URL, { waitUntil: "networkidle0" });

  // ---- The lobby: your Leader the Conqueror, your Steward the Turtle ----
  await store(p, (s) => s.setLobby({ leaderName: "Aldric", stewardName: "Odo", leaderPersonality: "conqueror", stewardPersonality: "turtle" }));
  await sleep(400);
  await p.evaluate(() => [...document.querySelectorAll(".field-name")].find((x) => x.textContent === "Your Leader")?.scrollIntoView({ block: "start" }));
  await shot(p, "s20c-lobby", sfx);

  // ---- The finishing save: Wyrmland, you hold 80% with two rivals left ----
  await load(p, finishing);
  await runTheMilitary(p);
  await sleep(1500);
  await openLeaders(p, phone);
  await sleep(500);
  await p.evaluate(() => document.querySelector(".leader-list")?.scrollIntoView({ block: "start" }));
  await shot(p, "s20c-leaders", sfx);

  // The queue: the leaders' orders (the mass, the sweep, the blanket), and how many.
  if (phone) await p.evaluate(() => document.querySelector('button[aria-label="Orders"]')?.click());
  else await p.evaluate(() => document.querySelector(".order-queue, .queue")?.scrollIntoView({ block: "start" }));
  await sleep(800);
  await shot(p, "s20c-finishing-queue", sfx);
  if (phone) await p.evaluate(() => document.querySelector('button[aria-label="Orders"]')?.click());

  // The same turn on the map: centred on the rivals' land.
  const rivals = await store(p, (s) => Object.entries(s.view.territories).filter(([, t]) => (t.detail === "full" ? t.owner : t.lastSeen?.owner) && (t.detail === "full" ? t.owner : t.lastSeen?.owner) !== s.view.me.id).map(([id]) => id));
  await centre(p, rivals, 1);
  await sleep(1200);
  await shot(p, "s20c-finishing-map", sfx);

  // ---- The home sweep: a rival army that could get behind your front (turn 16) ----
  await load(p, home);
  await runTheMilitary(p);
  await sleep(1500);
  const into = await store(p, (s) => s.queue?.filter?.((o) => o.kind === "move" && o.general && o.preset?.id === "onlyIfStronger").map((o) => o.to) ?? []);
  if (into?.length) await centre(p, into, 1);
  await sleep(1200);
  await shot(p, "s20c-home-sweep", sfx);
  await p.close();
}
await browser.close();
