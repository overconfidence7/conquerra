/**
 * Session 20 screenshots, on desktop (1440x900) and a 384 px phone, into docs/art/screens/s20-*.png:
 *  - s20-command-menu: your Leader's commands with Clean up (you hold 78% of Embervale) and Push back
 *  - s20-finishing: your Leader on Clean up in the Leaders panel: "Finishing them off: ..."
 *  - s20-report-to: a captured Leader reporting to yours: "Reports to Aldric"
 *  - s20-budget: your Steward's budget with your Leader on 80%: the chips offer only what's left
 *  - s20-enter-hint: the attack box with the Enter hint on its confirm button (desktop only)
 *  - s20-sweep-band: a full sweep across Wyrmland, its chain drawn on the map
 *   node apps/web/scripts/s20-shots.mjs     (MAP_URL=... for another server; ONLY=name for one shot)
 * Needs the built game running (`pnpm build`, then the web-preview server on 4173). Everything is the real game: a
 * real save (docs/art/screens/s20-save.json, made by make-s20-save.ts: an Embervale game where you hold 78% with two
 * rivals left and a captured Leader), and a fresh Wyrmland game for the sweep.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const out = process.env.OUT ?? join(root, "docs/art/screens");
const URL = process.env.MAP_URL ?? "http://localhost:4173/";
const only = process.env.ONLY ?? "";
const save = readFileSync(join(root, "docs/art/screens/s20-save.json"), "utf8");
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
const clickIn = (p, sel, text) => p.evaluate((sel, text) => { const b = [...document.querySelectorAll(sel)].find((x) => x.textContent?.trim().startsWith(text) && x.offsetParent); b?.scrollIntoView({ block: "center" }); b?.click(); return !!b; }, sel, text);
const openLeaders = (p, phone) => (phone ? p.evaluate(() => { if (!document.querySelector(".leader-list")?.offsetParent) document.querySelector('button[aria-label="Leaders"]')?.click(); }) : null);

for (const phone of [false, true]) {
  const sfx = phone ? "-phone" : "";
  const p = await browser.newPage();
  if (phone) await p.emulate({ viewport: { width: 384, height: 832, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true }, userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36" });
  else await p.setViewport({ width: 1440, height: 900 });
  p.on("pageerror", (e) => console.log("page error:", e.message));
  await p.goto(URL, { waitUntil: "networkidle0" });

  // ---- The Embervale save: you hold 78% with two rivals left, and Lady Morwen's Leader, Wynn ----
  await p.evaluate((file) => window.__conquerraStore.getState().load({ file }), save);
  await p.waitForFunction(() => window.__conquerraStore.getState().view, { timeout: 60000 });
  await mapReady(p);
  await store(p, (s) => s.setShowReport?.(false));
  const me = await store(p, (s) => s.view.me.id);

  // Your Leader's command menu: Clean up is offered (you hold three quarters of the map), and Push back.
  await openLeaders(p, phone);
  await store(p, (s, me) => s.openLeader(`leader:${me}`), me);
  await sleep(300);
  await clickIn(p, ".leader-row.open .row-buttons button", "Command");
  await sleep(700);
  await p.evaluate(() => [...document.querySelectorAll('.command-list [role="menuitem"]')].find((b) => b.textContent.startsWith("Push back"))?.scrollIntoView({ block: "center" }));
  await shot(p, "s20-command-menu", sfx);

  // Clean up, with 60% of your income: the panel says whom it's finishing off.
  await p.evaluate(() => [...document.querySelectorAll('.command-list [role="menuitem"]')].find((b) => b.textContent.startsWith("Clean up"))?.click());
  await store(p, async (s, me) => { await s.setBudget(`leader:${me}`, { share: 0.6 }); }, me);
  await sleep(1200);
  await store(p, (s) => s.openLeader(null));
  await openLeaders(p, phone);
  await sleep(500);
  await p.evaluate(() => document.querySelector(".leader-list")?.scrollIntoView({ block: "start" }));
  await shot(p, "s20-finishing", sfx);

  // Lady Morwen's old Leader, Wynn, reports to yours.
  await store(p, async (s) => { await s.setInstruction("leader:bot1", { kind: "report", to: s.view.me.id }); });
  await sleep(1200);
  await p.evaluate(() => [...document.querySelectorAll(".leader-row")].find((r) => r.textContent.includes("Wynn"))?.scrollIntoView({ block: "center" }));
  await shot(p, "s20-report-to", sfx);

  // Your Leader on 80%: your Steward's budget offers only what's left (and the panel says 80% + its share).
  await store(p, async (s, me) => { await s.setBudget(`leader:${me}`, { share: 0.8 }); s.openLeader(`steward:${me}`); }, me);
  await openLeaders(p, phone);
  await sleep(400);
  await clickIn(p, ".leader-row.open .row-buttons button", "Budget");
  await sleep(600);
  await p.evaluate(() => document.querySelector(".leader-row.open .budget")?.scrollIntoView({ block: "center" }));
  await shot(p, "s20-budget", sfx);
  await store(p, (s) => s.openLeader(null));

  // ---- A fresh Wyrmland game: a full sweep from your capital across the map ----
  await store(p, (s) => s.playAgain());
  await sleep(500);
  await store(p, (s) => s.setLobby({ mapId: "wyrmland", bots: 5, botLevel: "marshal", turnSeconds: null, leaderName: "Aldric", stewardName: "Odo" }));
  await store(p, (s) => s.start());
  await p.waitForFunction(() => window.__conquerraStore.getState().view?.turn === 1, { timeout: 60000 });
  await mapReady(p);
  // The attack box, with the Enter hint on its confirm button (a laptop's: a phone has no Enter key to hint at).
  if (!phone) {
    const pick = await store(p, (s) => {
      const { ctx, view } = s;
      const mine = Object.entries(view.territories).filter(([, t]) => t.detail === "full" && t.owner === view.me.id).sort((a, b) => b[1].troops - a[1].troops);
      for (const [from, ft] of mine) {
        const to = ctx.map.borders.flatMap((b) => (b.a === from ? [b.b] : b.b === from ? [b.a] : [])).find((x) => { const v = view.territories[x]; return v.detail === "full" && v.owner !== view.me.id && v.troops * 2 < ft.troops; });
        if (to) return { from, to };
      }
      return null;
    });
    if (pick) {
      await store(p, (s, pick) => { s.select(pick.from); s.tap(pick.to); }, pick);
      await sleep(800);
      await shot(p, "s20-enter-hint", sfx);
      await store(p, (s) => s.clearSelection());
    }
  }

  const way = await store(p, (s) => {
    const m = s.ctx.map, from = s.view.me.capital;
    const nb = (t) => m.borders.flatMap((b) => (b.a === t ? [b.b] : b.b === t ? [b.a] : []));
    const d = new Map([[from, 0]]);
    const q = [from];
    while (q.length) { const t = q.shift(); for (const n of nb(t)) if (!d.has(n)) (d.set(n, d.get(t) + 1), q.push(n)); }
    const to = [...d].filter(([, k]) => k === 6).map(([t]) => t).sort()[0];
    return { from, to };
  });
  await store(p, (s, w) => { s.startPath(w.from); s.tap(w.to); s.setPathKind("sweep"); }, way);
  await sleep(600);
  await p.evaluate((w) => {
    const st = window.__conquerraStore.getState();
    const g = st.ctx.map.geometry;
    const a = g.territories.find((x) => x.id === w.from).label, b = g.territories.find((x) => x.id === w.to).label;
    const r = window.__conquerraMap;
    r.camera.centreOn((a.x + b.x) / 2, (a.y + b.y) / 2 + (st.lastPhone ? 120 : 0), r.camera.cam.scale * 0.8);
  }, way);
  await sleep(1500);
  await shot(p, "s20-sweep-band", sfx);
  await p.close();
}
await browser.close();
