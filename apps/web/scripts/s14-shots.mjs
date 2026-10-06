/**
 * Session 14 screenshots (diplomacy), on desktop (1440x900) and a 384 px phone:
 *   node apps/web/scripts/s14-shots.mjs            -> docs/art/screens/s14-*.png
 * Needs the built game running (`pnpm build`, `pnpm --filter web preview`). The bots' answers are their real ones
 * (offers sent to the real host); the deals for the Players panel, the map and the warning are put into the page's
 * own view (they only change what's drawn), so the shots don't depend on how a bot game happens to go.
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
async function start(p, mapId, bots) {
  await p.evaluate((m, b) => window.__conquerraStore.getState().setLobby({ mapId: m, bots: b, turnSeconds: null }), mapId, bots);
  await p.evaluate(() => window.__conquerraStore.getState().start());
  await mapReady(p);
  await sleep(800);
}
/** Play turns (the bots' plan for you) until you border a rival you can see; returns [your land, theirs, their id]. */
const playToNeighbour = (p) =>
  p.evaluate(async () => {
    const st = window.__conquerraStore;
    for (let i = 0; i < 12; i++) {
      const s = st.getState(), v = s.view;
      for (const b of s.ctx.map.borders) {
        const A = v.territories[b.a], B = v.territories[b.b];
        if (A?.detail !== "full" || B?.detail !== "full") continue;
        if (A.owner === v.me.id && B.owner && B.owner !== v.me.id && !B.capitalOf) return [b.a, b.b, B.owner];
        if (B.owner === v.me.id && A.owner && A.owner !== v.me.id && !A.capitalOf) return [b.b, b.a, A.owner];
      }
      st.getState().closeDeal();
      await st.getState().autoPlan();
      await st.getState().lockIn();
      st.getState().endReplay();
      st.getState().setShowReport(false);
    }
    return null;
  });
const shot = async (p, name) => {
  await sleep(700);
  await p.screenshot({ path: join(outDir, name) });
  console.log("  saved", name);
};
const clickText = (p, t) => p.evaluate((t) => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.trim().startsWith(t) && x.offsetParent); b?.click(); return !!b; }, t);
const centre = async (p, id, up = 0, zoom = 0) => {
  if (zoom) {
    await p.evaluate((zoom) => window.__conquerraMap.zoomBy(zoom), zoom);
    await sleep(900);
  }
  await p.evaluate((id, up) => { const r = window.__conquerraMap; const g = window.__conquerraStore.getState().ctx.map.geometry.territories.find((x) => x.id === id); r.centreOn(g.label.x, g.label.y + up / r.camera.cam.scale); }, id, up);
};
/** Change what the page draws (its own view only). */
const editView = (p, f) => p.evaluate(`(() => { const st = window.__conquerraStore; const s = st.getState(); const v = structuredClone(s.view); (${f})(v, s); st.setState({ view: v }); })()`);
/** A deal in the page's view between you and `them`, with every border between you (as the engine would list it). */
const dealJs = (id, them, bond, kind = "truce") => `(v, s) => {
  const own = (t) => { const x = v.territories[t]; return x.detail === "full" ? x.owner : (x.lastSeen?.owner ?? null); };
  const borders = s.ctx.map.borders.flatMap((b) => own(b.a) === v.me.id && own(b.b) === "${them}" ? [[b.a, b.b]] : own(b.b) === v.me.id && own(b.a) === "${them}" ? [[b.b, b.a]] : []);
  v.deals = [...v.deals.filter((d) => d.id !== "${id}"), { id: "${id}", kind: "${kind}", bond: "${bond}", a: v.me.id, b: "${them}", start: v.turn, last: v.turn + 3, scope: "all", terms: { kind: "truce", scope: { kind: "all" }, turns: 4 }, size: 10, borders }];
}`;

for (const phone of [false, true]) {
  const sfx = phone ? "-phone" : "";
  const p = await page(phone);
  await start(p, phone ? "twin-realms" : "embervale", phone ? 5 : 3);
  const nb = await playToNeighbour(p);
  if (!nb) throw new Error("no neighbour");
  const [mine, theirs, them] = nb;
  console.log(phone ? "phone" : "desktop", "neighbour", nb);

  // ---- The Propose card for a truce (from the Players panel) ----
  await p.evaluate(() => window.__conquerraStore.getState().clearSelection());
  if (phone) await p.evaluate(() => document.querySelector('button[aria-label="Players"]').click());
  await sleep(300);
  await p.evaluate((them) => window.__conquerraStore.getState().openPropose(them), them);
  await shot(p, `s14-propose${sfx}.png`);

  // ---- A bot's answer with its reason: a decline and an accept (their real answers) ----
  const answers = await p.evaluate(async () => {
    const st = window.__conquerraStore;
    const s = st.getState(), v = s.view;
    const bots = v.players.filter((x) => x.id !== v.me.id && x.eliminatedTurn === null).map((x) => x.id);
    const tries = [];
    for (const b of bots) tries.push({ id: `${v.me.id}-t${v.turn}-s${b}`, from: v.me.id, to: b, terms: { kind: "truce", scope: { kind: "all" }, turns: 3 }, bond: "handshake" });
    for (const b of bots) for (const t of bots) if (t !== b) tries.push({ id: `${v.me.id}-t${v.turn}-j${b}${t}`, from: v.me.id, to: b, terms: { kind: "war", target: t, turns: 4 }, bond: "handshake" });
    for (const b of bots) tries.push({ id: `${v.me.id}-t${v.turn}-g${b}`, from: v.me.id, to: b, terms: { kind: "trade", give: {}, get: { gold: 20 } }, bond: "handshake" });
    for (const b of bots) tries.push({ id: `${v.me.id}-t${v.turn}-w${b}`, from: v.me.id, to: b, terms: { kind: "trade", give: { gold: Math.min(12, v.me.gold) }, get: {} }, bond: "handshake" });
    const out = { yes: null, no: null, answers: {} };
    for (const o of tries) {
      const a = await st.getState().sendOffer(o);
      if (a?.accept && !out.yes && o.terms.kind === "truce") out.yes = o;
      if (a && !a.accept && !a.counter && !/already|I have a truce/.test(a.reason) && !out.no) out.no = o;
    }
    for (const o of tries) if (!out.yes && st.getState().answers[o.id]?.accept) out.yes = o;
    // A truce they turned down reads best; any decline will do.
    // (Not an answer about a deal one of these test offers already made.)
    const plain = (a) => a && !a.accept && !a.counter && !/already|I have a truce/.test(a.reason);
    const declined = (kind) => tries.find((o) => o.terms.kind === kind && plain(st.getState().answers[o.id]));
    out.no = declined("truce") ?? declined("war") ?? out.no;
    out.answers = st.getState().answers;
    return out;
  });
  for (const [k, o] of [["decline", answers.no], ["accept", answers.yes]]) {
    if (!o) continue;
    // Only this offer on the table (the others sent above would crowd the Players panel).
    await p.evaluate((o, a) => window.__conquerraStore.setState({ deal: { mode: "propose", offer: o }, dealPick: null, answers: { [o.id]: a }, diplomacy: [{ id: `propose-${o.id}`, kind: "propose", offer: o }] }), o, answers.answers[o.id]);
    await shot(p, `s14-answer-${k}${sfx}.png`);
  }
  await p.evaluate(() => window.__conquerraStore.setState({ deal: null, diplomacy: [], answers: {} }));

  // ---- An offer to you, opened from its toast ----
  await p.evaluate((them) => {
    const st = window.__conquerraStore; const v = st.getState().view;
    st.setState({ offers: [{ id: "shot-offer", from: them, to: v.me.id, terms: { kind: "truce", scope: { kind: "all" }, turns: 3 }, bond: "handshake", note: "My army is needed in the west; let's have peace on our border." }] });
  }, them);
  await sleep(500);
  if (phone) await p.evaluate(() => document.querySelector('button[aria-label="Players"][aria-pressed="true"]')?.click());
  await shot(p, `s14-offer-toast${sfx}.png`);
  await p.evaluate(() => document.querySelector(".offer-toast")?.click());
  await shot(p, `s14-offer${sfx}.png`);
  await p.evaluate(() => window.__conquerraStore.setState({ deal: null, offers: [] }));

  // ---- The Players panel with a binding pact and an Oathbreaker mark ----
  const other = await p.evaluate((them) => { const v = window.__conquerraStore.getState().view; return v.players.filter((x) => x.id !== v.me.id && x.id !== them && x.eliminatedTurn === null).map((x) => x.id); }, them);
  await editView(p, dealJs("shot-binding", them, "binding"));
  await editView(p, `(v) => {
    v.deals.push({ id: "shot-war", kind: "war", bond: "handshake", a: "${other[0]}", b: "${other[1] ?? them}", start: v.turn - 1, last: v.turn + 2, target: "${them}", borders: [] });
    const ob = v.players.find((x) => x.id === "${other[0]}"); ob.oathbreaker = v.turn + 3;
    v.record = [...v.record, { deal: "old", kind: "truce", bond: "handshake", a: "${other[0]}", b: v.me.id, start: v.turn - 3, end: v.turn - 1, how: "broken", by: "${other[0]}" }];
  }`);
  if (phone) await p.evaluate(() => document.querySelector('button[aria-label="Players"]').click());
  await sleep(300);
  await p.evaluate((them) => [...document.querySelectorAll("button.player-btn")].find((b) => b.textContent.includes(window.__conquerraStore.getState().view.players.find((x) => x.id === them).name))?.click(), them);
  await shot(p, `s14-players${sfx}.png`);
  if (phone) await p.evaluate(() => document.querySelector('button[aria-label="Players"]').click());

  // ---- A truce border on the map (the binding pact's: white stitches, gold studs) ----
  await p.evaluate(() => window.__conquerraStore.getState().clearSelection());
  await centre(p, theirs, phone ? 120 : 0, phone ? 1.8 : 2.4);
  await sleep(1200);
  await shot(p, `s14-truce-map${sfx}.png`);

  // ---- The warning on an attack across a handshake truce ----
  await editView(p, `(v) => { v.deals = v.deals.filter((d) => d.id !== "shot-binding"); }`);
  await editView(p, dealJs("shot-handshake", them, "handshake"));
  await p.evaluate((mine, theirs) => { const g = window.__conquerraStore.getState(); g.select(mine); g.tap(theirs); }, mine, theirs);
  await centre(p, theirs, phone ? 260 : 0);
  await sleep(1000);
  await shot(p, `s14-warning${sfx}.png`);
  await p.close();
}
await browser.close();
