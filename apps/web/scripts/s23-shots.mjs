/**
 * Session 23 screenshots, desktop and a 384 px phone, into docs/art/screens/s23-*.png.
 *   node apps/web/scripts/s23-shots.mjs [part...]     parts: handout (Part 1), bonus (Part 3), comeback; none = all
 *   ONLY=name for one shot, MAP_URL=... for another server.
 * Needs the built game running (`pnpm build`, then the web-preview server on 4173). Real save: session 20c's finishing
 * save at turn 54 (s20c-save.json: you hold 80%, your Steward Odo has 1,157 gold in its purse).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const out = process.env.OUT ?? join(root, "docs/art/screens");
const URL = process.env.MAP_URL ?? "http://localhost:4173/";
const only = process.env.ONLY ?? "";
const parts = new Set(process.argv.slice(2));
const want = (p) => !parts.size || parts.has(p);
const file = (n) => readFileSync(join(root, `docs/art/screens/${n}`), "utf8");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--enable-gpu", "--use-angle=d3d11"] });
const shot = async (p, name, sfx, opts = {}) => {
  if (only && !name.includes(only)) return;
  await sleep(opts.wait ?? 900);
  await p.screenshot({ path: join(out, `${name}${sfx}.png`), ...(opts.clip ? { clip: opts.clip } : {}) });
  console.log("  saved", `${name}${sfx}.png`);
};
const mapReady = (p) => p.waitForFunction(() => { const s = window.__conquerraMap?.stats?.(); return s && s.firstMapMs > 0 && s.tilesBaked === s.tileCount; }, { timeout: 120000, polling: 200 });
const load = async (p, f) => {
  await p.evaluate((f) => window.__conquerraStore.getState().load({ file: f }), f);
  await p.waitForFunction(() => window.__conquerraStore.getState().view, { timeout: 60000 });
  await mapReady(p);
  await p.evaluate(() => window.__conquerraStore.getState().setShowReport?.(false));
};
async function page(phone) {
  const p = await browser.newPage();
  if (phone) await p.emulate({ viewport: { width: 384, height: 832, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true }, userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36" });
  else await p.setViewport({ width: 1440, height: 900 });
  p.on("pageerror", (e) => console.log("page error:", e.message));
  return p;
}
const endReplay = (p) => p.evaluate(() => { delete window.__conquerraReplayAt; const g = window.__conquerraStore.getState(); g.endReplay?.(); g.setShowReport?.(false); });
/** Play a turn to its end (the replay skipped), the report closed. */
async function playTurn(p) {
  const turn = await p.evaluate(() => window.__conquerraStore.getState().view.turn);
  await p.evaluate(() => void window.__conquerraStore.getState().lockIn());
  const ok = await p
    .waitForFunction((turn) => { const s = window.__conquerraStore.getState(); return s.replay || s.view.turn !== turn || s.error; }, { timeout: 90000 }, turn)
    .then(() => true, () => false);
  const err = await p.evaluate(() => window.__conquerraStore.getState().error);
  if (!ok || err) console.log("  (lock in:", err ?? "nothing happened", ")");
  await endReplay(p);
  await p.waitForFunction(() => !window.__conquerraStore.getState().replay && !window.__conquerraStore.getState().busy, { timeout: 90000 });
  await p.evaluate(() => { const b = [...document.querySelectorAll(".dialog button")].find((x) => /Keep|Done/.test(x.textContent)); b?.click(); });
}
const openLeaders = (p, phone) => (phone ? p.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => x.getAttribute("aria-label") === "Leaders"); b?.click(); }) : Promise.resolve());
const closeSheets = (p) => p.keyboard.press("Escape");

// ---------- Part 1: the Steward's handout ----------
if (want("handout")) {
  for (const phone of [false, true]) {
    const sfx = phone ? "-phone" : "";
    const p = await page(phone);
    await p.goto(URL, { waitUntil: "networkidle0" });
    await load(p, file("s20c-save.json"));
    // (The save's own queued orders are restored as they were: play that turn, so your leaders plan afresh.)
    await playTurn(p);
    // Your leaders plan (Odo, the Turtle, on Run the realm with 1,157 gold): the panel says what goes back.
    await p.waitForFunction(() => Object.keys(window.__conquerraStore.getState().leaderNotes ?? {}).length > 0, { timeout: 60000 }).catch(() => {});
    const note = await p.evaluate(() => JSON.stringify(window.__conquerraStore.getState().leaderNotes));
    console.log("  notes before the turn:", note);
    await openLeaders(p, phone);
    await p.evaluate(() => document.querySelector(".leader-list")?.children?.[1]?.scrollIntoView({ block: "center" }));
    await shot(p, "s23-leaders-handout", sfx, { wait: 1500 });
    await closeSheets(p);
    await playTurn(p);
    const lines = await p.evaluate(() => {
      const st = window.__conquerraStore.getState();
      return { voices: (st.report?.voices ?? []).map((v) => `${v.name} [${v.situation}]: ${v.text}`), back: (st.report?.events ?? []).filter((e) => e.type === "purseTaken").map((e) => `${e.gold}g${e.handout ? " (handout)" : ""}`) };
    });
    console.log("  after the turn:", JSON.stringify(lines));
    await p.evaluate(() => window.__conquerraStore.getState().setShowReport(true));
    await sleep(800);
    // The report's handout line and the Steward's own word on it.
    await p.evaluate(() => {
      const el = [...document.querySelectorAll(".report li, .report p, .report-group li")].find((x) => /handed .* gold back/.test(x.textContent ?? ""));
      (el ?? document.querySelector(".report-group.voices"))?.scrollIntoView({ block: "center" });
    });
    await shot(p, "s23-report-handout", sfx, { wait: 1500 });
    await p.evaluate(() => document.querySelector(".report-group.voices")?.scrollIntoView({ block: "center" }));
    await shot(p, "s23-report-handout-voice", sfx, { wait: 1200 });
    await p.evaluate(() => window.__conquerraStore.getState().setShowReport(false));
    await openLeaders(p, phone);
    await p.evaluate(() => document.querySelector(".leader-list")?.children?.[1]?.scrollIntoView({ block: "center" }));
    await shot(p, "s23-leaders-after", sfx, { wait: 1500 });
    await p.close();
  }
}

// ---------- Part 3: the start bonus ----------
// New Wyrmland 6 games until you sit at a harder spot (two of its six get +6): the notice as turn 1 starts, your
// capital's card, and the first turn's report.
if (want("bonus")) {
  for (const phone of [false, true]) {
    const sfx = phone ? "-phone" : "";
    const p = await page(phone);
    await p.goto(URL, { waitUntil: "networkidle0" });
    let bonus = 0;
    for (let tries = 0; tries < 20 && !bonus; tries++) {
      await p.evaluate(() => { const s = window.__conquerraStore.getState(); s.playAgain?.(); });
      await sleep(300);
      await p.evaluate(() => window.__conquerraStore.getState().setLobby({ mapId: "wyrmland", bots: 5, botLevel: "marshal", turnSeconds: null }));
      await p.evaluate(() => window.__conquerraStore.getState().start());
      await p.waitForFunction(() => window.__conquerraStore.getState().view?.turn === 1, { timeout: 60000 });
      bonus = await p.evaluate(() => window.__conquerraStore.getState().view.me.startBonus ?? 0);
    }
    console.log("  start bonus:", bonus);
    await mapReady(p);
    await shot(p, "s23-bonus-notice", sfx, { wait: 1200 });
    await p.evaluate(() => { const s = window.__conquerraStore.getState(); s.select(s.view.me.capital); });
    if (phone) await p.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.trim() === "Card"); b?.click(); });
    await shot(p, "s23-bonus-card", sfx, { wait: 1500 });
    await p.evaluate(() => window.__conquerraStore.getState().select?.(null));
    await playTurn(p);
    await p.evaluate(() => window.__conquerraStore.getState().setShowReport(true));
    await shot(p, "s23-bonus-report", sfx, { wait: 1500 });
    await p.close();
  }
}

// ---------- Step 0: the comeback card ----------
// Session 20c's save with a comeback set up in your leaders' memory (you once held 150 territories, fell to a quarter
// of that, and hold about 96 now): the card plays as this turn's replay ends.
if (want("comeback")) {
  const raw = JSON.parse(file("s20c-save.json"));
  raw.host.voiceMemory = { ...(raw.host.voiceMemory ?? {}), comeback: { peak: 150, low: true } };
  for (const phone of [false, true]) {
    const sfx = phone ? "-phone" : "";
    const p = await page(phone);
    await p.goto(URL, { waitUntil: "networkidle0" });
    await load(p, JSON.stringify(raw));
    await p.evaluate(() => (window.__conquerraReplayAt = 0));
    await p.evaluate(() => void window.__conquerraStore.getState().lockIn());
    await p.waitForFunction(() => window.__conquerraTimeline && window.__conquerraStore.getState().replay, { timeout: 90000 });
    // (The card plays over the last beat: hold there.)
    const end = await p.evaluate(() => { const b = window.__conquerraTimeline.beats.at(-1); return b ? b.start + b.duration : 0; });
    console.log("  comeback in the report:", await p.evaluate(() => !!window.__conquerraStore.getState().replay?.report?.comeback));
    await p.evaluate((at) => (window.__conquerraReplayAt = at), Math.max(0, end - 1000));
    // (The card fades out 2.2 s after it appears: take it while it is up.)
    await shot(p, "s23-comeback", sfx, { wait: 700 });
    await endReplay(p);
    await p.close();
  }
}

await browser.close();
