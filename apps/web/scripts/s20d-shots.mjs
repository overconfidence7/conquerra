/**
 * Session 20d screenshots, on desktop (1440x900) and a 384 px phone, into docs/art/screens/s20d-*.png:
 *  - s20d-leaders: the Leaders panel with the purse empty once its orders are paid for ("Purse 0g · 50% of income · 9 orders this turn (18g)")
 *  - s20d-finishing-fog: a finishing turn's queue reaching into the fog, and the map centred on the fogged land it goes for
 *  - s20d-wall-rush: a Steward walling a territory in one turn (the queue's culture and fort orders)
 *  - s20d-wall-garrison: a wall with a garrison inside it (the territory card: "Walled: N defend")
 *   node apps/web/scripts/s20d-shots.mjs     (MAP_URL=... for another server; ONLY=name for one shot)
 * Needs the built game running (`pnpm build`, then the web-preview server on 4173). Real saves: make-s20d-save.ts (a
 * delegating Wyrmland game) and session 20c's finishing save (docs/art/screens/s20c-save.json: you hold 80%).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const out = process.env.OUT ?? join(root, "docs/art/screens");
const URL = process.env.MAP_URL ?? "http://localhost:4173/";
const only = process.env.ONLY ?? "";
const file = (n) => readFileSync(join(root, `docs/art/screens/${n}`), "utf8");
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
const load = async (p, f) => {
  await p.evaluate((f) => window.__conquerraStore.getState().load({ file: f }), f);
  await p.waitForFunction(() => window.__conquerraStore.getState().view, { timeout: 60000 });
  await mapReady(p);
  await store(p, (s) => s.setShowReport?.(false));
};
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
const openLeaders = (p, phone) => (phone ? p.evaluate(() => { if (!document.querySelector(".leader-list")?.offsetParent) document.querySelector('button[aria-label="Leaders"]')?.click(); }) : null);
/** Scroll the queue so the first order line whose text matches `re` is at the top. */
const scrollQueueTo = (p, re) =>
  p.evaluate((src) => {
    const re = new RegExp(src);
    const line = [...document.querySelectorAll(".order-line")].find((x) => re.test(x.textContent ?? ""));
    line?.scrollIntoView({ block: "start" });
    return !!line;
  }, re);
const openQueue = (p, phone) => (phone ? p.evaluate(() => document.querySelector('button[aria-label="Orders"]')?.click()) : p.evaluate(() => document.querySelector(".order-queue, .queue")?.scrollIntoView({ block: "start" })));

for (const phone of [false, true]) {
  const sfx = phone ? "-phone" : "";
  const p = await browser.newPage();
  if (phone) await p.emulate({ viewport: { width: 384, height: 832, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true }, userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36" });
  else await p.setViewport({ width: 1440, height: 900 });
  p.on("pageerror", (e) => console.log("page error:", e.message));
  await p.goto(URL, { waitUntil: "networkidle0" });

  // ---- The Leaders panel: the purse once this turn's orders are paid for ----
  await load(p, file("s20d-purse.json"));
  await sleep(1500);
  await openLeaders(p, phone);
  await sleep(500);
  await p.evaluate(() => document.querySelector(".leader-list")?.scrollIntoView({ block: "start" }));
  await shot(p, "s20d-leaders", sfx);
  if (phone) await openLeaders(p, phone);

  // ---- A finishing turn reaching into the fog (session 20c's save: you hold 80%) ----
  await load(p, file("s20c-save.json"));
  await store(p, async (s) => {
    const me = s.view.me.id;
    await s.setInstruction(`leader:${me}`, { kind: "military" });
    await s.setBudget(`leader:${me}`, { share: 0.8 });
  });
  await sleep(1500);
  const fogged = await store(p, (s) => [...new Set((s.queue ?? []).filter((o) => o.kind === "move" && o.general && s.view.territories[o.to]?.detail !== "full").map((o) => o.to))]);
  console.log(`  finishing: ${fogged.length} territories in the fog in the queue`);
  await centre(p, fogged.slice(0, 1), 0.6);
  await sleep(1200);
  await shot(p, "s20d-finishing-fog", sfx);
  await openQueue(p, phone);
  const name = await store(p, (s, t) => s.ctx.map.territories.find((x) => x.id === t)?.name ?? "", fogged[0]);
  if (name) await scrollQueueTo(p, `${name}`);
  await sleep(800);
  await shot(p, "s20d-finishing-fog-queue", sfx);
  if (phone) await openQueue(p, phone);

  // ---- The Steward walls a territory in one turn ----
  await load(p, file("s20d-wall-rush.json"));
  await sleep(1500);
  const rush = await store(p, (s) => {
    const n = new Map();
    for (const o of s.queue ?? []) if (o.kind === "invest" && o.steward) n.set(o.territory, (n.get(o.territory) ?? 0) + 1);
    return [...n].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  });
  if (rush) (await centre(p, [rush], 1.2), await store(p, (s, t) => s.select?.(t), rush));
  await openQueue(p, phone);
  const rushName = rush ? await store(p, (s, t) => s.ctx.map.territories.find((x) => x.id === t)?.name ?? "", rush) : "";
  if (rushName) await scrollQueueTo(p, `(fort|[Cc]ulture).*${rushName}`);
  await sleep(1200);
  await shot(p, "s20d-wall-rush", sfx);
  if (phone) await openQueue(p, phone);

  // ---- A wall with a garrison inside it ----
  await load(p, file("s20d-wall-garrison.json"));
  await sleep(1500);
  const held = await store(p, (s) => {
    const w = (s.view.walls ?? []).find((x) => x.owner === s.view.me.id);
    if (!w) return null;
    return [...w.territories].sort((a, b) => (s.view.territories[b]?.troops ?? 0) - (s.view.territories[a]?.troops ?? 0))[0];
  });
  if (held) (await centre(p, [held], 1.4), await store(p, (s, t) => s.select?.(t), held));
  await sleep(1200);
  await shot(p, "s20d-wall-garrison", sfx);
  await p.close();
}
await browser.close();
