/**
 * Session 15 screenshots, on desktop (1440x900) and a 384 px phone:
 *   node apps/web/scripts/s15-shots.mjs            -> docs/art/screens/s15-*.png
 * Needs the built game running (`pnpm build`, `pnpm --filter web preview`). The spy you hire and send is a real one
 * (played through the host). A passage deal, an infiltrated province, the spy report lines and the culture are put into
 * the page's own view (they only change what's drawn), so the shots don't depend on how a bot game happens to go.
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
  await sleep(800);
  await p.screenshot({ path: join(outDir, name) });
  console.log("  saved", name);
};
const centre = async (p, id, up = 0, zoom = 0) => {
  if (zoom) {
    await p.evaluate((zoom) => window.__conquerraMap.zoomBy(zoom), zoom);
    await sleep(900);
  }
  await p.evaluate((id, up) => { const r = window.__conquerraMap; const g = window.__conquerraStore.getState().ctx.map.geometry.territories.find((x) => x.id === id); r.centreOn(g.label.x, g.label.y + up / r.camera.cam.scale); }, id, up);
  await sleep(700);
};
/** Change what the page draws (its own view only). */
const editView = (p, f, args = []) => p.evaluate(`(() => { const st = window.__conquerraStore; const s = st.getState(); const v = structuredClone(s.view); (${f})(v, s, ...${JSON.stringify(args)}); st.setState({ view: v }); })()`);
const clickText = (p, t) => p.evaluate((t) => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.trim().startsWith(t) && x.offsetParent); b?.scrollIntoView({ block: "center" }); b?.click(); return !!b; }, t);
const neighboursOf = (p, t) => p.evaluate((t) => window.__conquerraStore.getState().ctx.map.borders.flatMap((b) => (b.a === t ? [b.b] : b.b === t ? [b.a] : [])), t);
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

  // ---- The Diplomacy switch in the lobby ----
  await p.evaluate(() => { const f = [...document.querySelectorAll(".field")].find((x) => x.textContent.startsWith("Diplomacy")); f?.scrollIntoView({ block: "center" }); });
  await shot(p, `s15-lobby-diplomacy${sfx}.png`);

  await p.evaluate((m, b) => window.__conquerraStore.getState().setLobby({ mapId: m, bots: b, turnSeconds: null }), phone ? "twin-realms" : "embervale", phone ? 5 : 3);
  await p.evaluate(() => window.__conquerraStore.getState().start());
  await mapReady(p);
  await sleep(800);
  const cap = await p.evaluate(() => window.__conquerraStore.getState().view.me.capital);

  // ---- A spy: hired (Spend at the capital), then sent toward a far province: on the move with its fog lift ----
  await p.evaluate((cap) => window.__conquerraStore.getState().add({ kind: "hireSpy", territory: cap }), cap);
  await lockIn(p);
  const far = await p.evaluate((cap) => {
    const g = window.__conquerraStore.getState(); const m = g.ctx.map; const prov = (t) => m.territories.find((x) => x.id === t).province;
    const nb = (t) => m.borders.flatMap((b) => (b.a === t ? [b.b] : b.b === t ? [b.a] : []));
    const d = new Map([[cap, 0]]); const q = [cap];
    while (q.length) { const t = q.shift(); for (const n of nb(t)) if (!d.has(n)) (d.set(n, d.get(t) + 1), q.push(n)); }
    return [...d].filter(([t, k]) => k >= 4 && prov(t) !== prov(cap)).sort((a, b) => a[1] - b[1])[0][0];
  }, cap);
  await p.evaluate((far) => { const g = window.__conquerraStore.getState(); const spy = g.view.spies[0]; window.__conquerraStore.setState({ queue: [...g.queue, { id: "send-shot", kind: "spy", spy: spy.id, to: g.ctx.map.territories.find((x) => x.id === far).province }] }); }, far);
  await lockIn(p);
  const spyAt = await p.evaluate(() => window.__conquerraStore.getState().view.spies[0]?.at);
  console.log(phone ? "phone" : "desktop", "spy at", spyAt);
  await p.evaluate((t) => window.__conquerraStore.getState().select(t), spyAt);
  await centre(p, spyAt, phone ? 120 : 0, phone ? 0 : 1.3);
  await shot(p, `s15-spy-travel${sfx}.png`);

  // ---- An infiltrated province with its eye (your spy inside a rival's province: the whole province in view) ----
  const infil = await p.evaluate((cap) => {
    const g = window.__conquerraStore.getState(); const v = g.view; const m = g.ctx.map; const prov = (t) => m.territories.find((x) => x.id === t).province;
    const rivals = v.players.filter((x) => x.id !== v.me.id).map((x) => x.id);
    const mine = (t) => v.territories[t]?.detail === "full" && v.territories[t].owner === v.me.id;
    // A province with none of your land, near you.
    const cand = m.provinces.map((p) => p.id).filter((p) => p !== prov(cap) && !m.territories.some((t) => t.province === p && mine(t.id)));
    const nearCap = (p) => Math.min(...m.territories.filter((t) => t.province === p).map((t) => Math.hypot(t.x - m.territories.find((x) => x.id === cap).x, t.y - m.territories.find((x) => x.id === cap).y)));
    const pick = cand.sort((a, b) => nearCap(a) - nearCap(b))[1] ?? cand[0];
    return { province: pick, land: m.territories.filter((t) => t.province === pick).map((t) => t.id), rival: rivals[0] };
  }, cap);
  await editView(p, `(v, s, info) => {
    v.spies = [{ id: "y-shot", at: info.land[0], target: null, recalled: false, status: "in" }];
    info.land.forEach((t, i) => {
      if (v.territories[t].detail === "full" && !v.territories[t].seenBy.includes("spy")) return;
      v.territories[t] = { detail: "full", seenBy: ["spy"], owner: info.rival, troops: [7, 3, 12, 2, 5, 4][i % 6], specialists: i === 2 ? [{ id: "s-shot", type: "siege" }] : [], building: i === 0 ? "fort" : null, construction: null, culture: i % 3, leaders: [], generals: [], capitalOf: null };
    });
  }`, [infil]);
  await p.evaluate((t) => window.__conquerraStore.getState().select(t), infil.land[0]);
  await centre(p, infil.land[0], phone ? 120 : 0);
  await shot(p, `s15-spy-eye${sfx}.png`);

  // ---- The report lines: your spy turned back, your spy killed, and one caught in your own province ----
  await p.evaluate((info) => {
    const st = window.__conquerraStore; const g = st.getState(); const v = g.view; const m = g.ctx.map;
    const home = m.territories.find((t) => t.id === v.me.capital).province;
    const other = m.provinces.find((p) => p.id !== home && p.id !== info.province).id;
    st.setState({
      selected: null,
      report: {
        turn: v.turn - 1,
        events: [
          { type: "turnStart", step: 0, turn: v.turn - 1, seats: v.players.map((x) => x.id) },
          { type: "spy", step: 1, player: v.me.id, spies: ["y1"], province: info.province, outcome: "in", territory: info.land[0] },
          { type: "spy", step: 2, player: v.me.id, spies: ["y2"], province: other, outcome: "blocked", territory: v.me.capital },
          { type: "spy", step: 3, player: v.me.id, spies: ["y3", "y4"], province: other, outcome: "killed", territory: v.me.capital },
          { type: "spyCaught", step: 4, player: v.me.id, province: home, outcome: "killed", spies: 1 },
        ],
      },
      showReport: true,
    });
  }, infil);
  await sleep(1200);
  await shot(p, `s15-spy-report${sfx}.png`);
  await p.evaluate(() => window.__conquerraStore.getState().setShowReport(false));

  // ---- The Hire menu with Rangers unlocked and the Standard-bearer locked (culture 4 in the capital's province) ----
  await editView(p, `(v) => { v.territories[v.me.capital].culture = 4; v.me.gold = 60; }`);
  await p.evaluate((cap) => window.__conquerraStore.getState().select(cap), cap);
  await centre(p, cap, phone ? 160 : 0);
  await sleep(500);
  await clickText(p, "Spend");
  await sleep(700);
  await p.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.includes("Standard-bearer") && x.offsetParent); b?.scrollIntoView({ block: "center" }); });
  await shot(p, `s15-hire-ladder${sfx}.png`);
  await clickText(p, "Spend");

  // ---- The culture line on the territory card ----
  if (phone) {
    await clickText(p, "Card");
    await sleep(500);
    await p.evaluate(() => { const li = [...document.querySelectorAll(".sheet *")].find((x) => x.textContent?.startsWith("Culture 4")); li?.scrollIntoView({ block: "center" }); });
  } else {
    const [x, y] = await p.evaluate((id) => { const r = window.__conquerraMap; const t = window.__conquerraStore.getState().ctx.map.geometry.territories.find((x) => x.id === id); const c = r.camera.cam; return [t.label.x * c.scale + c.x, t.label.y * c.scale + c.y]; }, cap);
    await p.evaluate(() => window.__conquerraStore.getState().clearSelection());
    await p.mouse.move(x + 6, y + 30);
    await sleep(600);
    await p.mouse.move(x + 8, y + 32);
  }
  await shot(p, `s15-culture-line${sfx}.png`);
  if (phone) await clickText(p, "Army");
  else await p.mouse.move(1430, 890);

  // ---- Passage land on the map, and a move through it ----
  const way = await p.evaluate(() => {
    const g = window.__conquerraStore.getState(); const v = g.view; const m = g.ctx.map;
    const nb = (t) => m.borders.flatMap((b) => (b.a === t ? [b.b] : b.b === t ? [b.a] : []));
    const mine = (t) => v.territories[t]?.detail === "full" && v.territories[t].owner === v.me.id;
    // Your territory with most troops, a neighbour that isn't yours, and land beyond it.
    const from = Object.keys(v.territories).filter(mine).sort((a, b) => v.territories[b].troops - v.territories[a].troops)[0];
    for (const mid of nb(from).filter((t) => !mine(t)))
      for (const to of nb(mid)) if (to !== from && !nb(from).includes(to) && !mine(to)) return { from, mid, to };
    return null;
  });
  // A partner who doesn't hold the land beyond (an army never fights the partner whose land it crosses).
  const partner = await p.evaluate((to) => { const v = window.__conquerraStore.getState().view; const o = v.territories[to]?.detail === "full" ? v.territories[to].owner : v.territories[to]?.lastSeen?.owner; return v.players.find((x) => x.id !== v.me.id && x.id !== o && x.eliminatedTurn === null).id; }, way.to);
  console.log(phone ? "phone" : "desktop", "passage", JSON.stringify(way));
  await editView(p, `(v, s, way, partner) => {
    const t = v.territories[way.mid];
    v.territories[way.mid] = { ...(t.detail === "full" ? t : { detail: "full", seenBy: ["border"], specialists: [], building: null, construction: null, culture: 0, leaders: [], generals: [], capitalOf: null }), owner: partner, troops: Math.max(2, t.troops ?? 2) };
    v.deals = [...v.deals, { id: "shot-pass", kind: "passage", bond: "handshake", a: v.me.id, b: partner, start: v.turn, last: v.turn + 3, mutual: false, passage: [way.mid], terms: { kind: "passage", turns: 4, mutual: false }, size: 8, borders: [] }];
  }`, [way, partner]);
  await p.evaluate((w) => { const g = window.__conquerraStore.getState(); g.select(w.from); g.tap(w.to); }, way);
  await centre(p, way.mid, phone ? 220 : 0, phone ? 0 : 1.2);
  await sleep(600);
  const drafted = await p.evaluate(() => window.__conquerraStore.getState().draft);
  console.log(phone ? "phone" : "desktop", "draft", JSON.stringify(drafted));
  await shot(p, `s15-passage${sfx}.png`);
  await p.close();
}
await browser.close();
