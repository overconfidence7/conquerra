/**
 * Session 22 screenshots (the language pass), desktop and a 384 px phone, into docs/art/screens/s22-*.png.
 *   node apps/web/scripts/s22-shots.mjs [part...]     parts: replay (Step 0), deals (Part 2), leaders (Part 3),
 *                                                    words (Part 4); none = all
 *   ONLY=name for one shot, MAP_URL=... for another server.
 * Needs the built game running (`pnpm build`, then the web-preview server on 4173). Real saves: session 20d's
 * Wyrmland game (s20d-purse.json) and session 20c's finishing save (s20c-save.json).
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
/** Centre the map on some territories at a zoom: a territory this many px wide on screen (120 Mid, 260 Near). */
const look = (p, ids, px) =>
  p.evaluate((ids, px) => {
    const st = window.__conquerraStore.getState();
    const g = st.ctx.map.geometry;
    const pts = ids.map((id) => g.territories.find((x) => x.id === id)?.label).filter(Boolean);
    const x = pts.reduce((a, q) => a + q.x, 0) / pts.length, y = pts.reduce((a, q) => a + q.y, 0) / pts.length;
    const cam = window.__conquerraMap.camera;
    cam.centreOn(x, y, px / cam.territorySize);
  }, ids, px);
const settle = (p) => p.waitForFunction(() => (window.__conquerraMap?.pendingNear?.() ?? 0) === 0, { timeout: 30000, polling: 100 }).catch(() => {});

async function page(phone) {
  const p = await browser.newPage();
  if (phone) await p.emulate({ viewport: { width: 384, height: 832, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true }, userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36" });
  else await p.setViewport({ width: 1440, height: 900 });
  p.on("pageerror", (e) => console.log("page error:", e.message));
  return p;
}

/** Lock in and wait for the replay, held at its start. Returns the timeline's beats with what each is about. */
async function replayTurn(p) {
  await p.evaluate(() => (window.__conquerraReplayAt = 0));
  await p.evaluate(() => void window.__conquerraStore.getState().lockIn());
  await p.waitForFunction(() => window.__conquerraTimeline && window.__conquerraStore.getState().replay, { timeout: 90000 });
  return p.evaluate(() => {
    const st = window.__conquerraStore.getState();
    const before = st.replay.before;
    const capitals = new Set([before.me.capital, ...Object.entries(before.territories).filter(([, t]) => t.detail === "full" && t.capitalOf).map(([id]) => id)]);
    return window.__conquerraTimeline.beats.map((b, i) => {
      const e = b.events[0];
      const battles = b.events.filter((x) => x.type === "battle");
      return {
        i, kind: b.kind, start: b.start, duration: b.duration,
        to: e?.to ?? e?.territory ?? null,
        troops: battles.reduce((n, x) => n + x.attackers.troops + x.defenders.troops, 0),
        captured: battles.some((x) => x.captured),
        capital: battles.some((x) => x.captured && capitals.has(x.to)),
        out: b.events.find((x) => x.type === "eliminated")?.player ?? null,
        mine: b.events.some((x) => x.player === before.me.id || x.defender === before.me.id),
      };
    });
  });
}
/** Hold the replay at a moment, the camera at Mid on a territory (the replay's own camera stops: you "moved" it). */
async function holdAt(p, at, focus, px) {
  await p.evaluate((at) => (window.__conquerraReplayAt = at), at);
  if (focus) await look(p, [focus], px);
  await p.evaluate(() => (window.__conquerraMap.camera.userMoves = (window.__conquerraMap.camera.userMoves ?? 0) + 1));
  await sleep(1200);
}
const endReplay = (p) => p.evaluate(() => { delete window.__conquerraReplayAt; const g = window.__conquerraStore.getState(); g.endReplay?.(); g.setShowReport?.(false); });


// ---------- Step 0: the replay has the whole map on the desktop; one headline per event; the floating words ----------
if (want("replay")) {
  for (const width of [1440, 1024]) {
    const p = await page(false);
    await p.setViewport({ width, height: 900 });
    await p.evaluateOnNewDocument(() => { localStorage.setItem("conquerra.effects", "full"); localStorage.setItem("conquerra.effects.noAuto", "1"); localStorage.setItem("conquerra.dock", "open"); });
    await p.goto(URL, { waitUntil: "networkidle0" });
    await load(p, file("s20d-purse.json"));
    // Planning, with a territory chosen: the panel and the dock are open.
    await p.evaluate(() => { const s = window.__conquerraStore.getState(); s.select(s.view.me.capital); });
    await shot(p, `s22-plan-${width}`, "", { wait: 1500 });
    const beats = await replayTurn(p);
    const big = [...beats].filter((b) => b.kind === "battle").sort((a, b) => b.troops - a.troops)[0];
    if (big) (await holdAt(p, big.start + big.duration * 0.56, big.to, 170), await shot(p, `s22-replay-${width}`, "", { wait: 1200 }));
    // A pop on the map: the word on its plate (a recruit, a building, culture).
    const pop = beats.find((b) => b.kind === "pop" && b.mine) ?? beats.find((b) => b.kind === "pop");
    if (pop) (console.log("  pop", JSON.stringify(pop)), await holdAt(p, pop.start + pop.duration * 0.25, pop.to, 220), await shot(p, `s22-pop-${width}`, "", { wait: 600 }));
    await endReplay(p);
    await shot(p, `s22-after-${width}`, "", { wait: 1200 });
    await p.close();
  }
  // A capital falling: the title card only, no banner for the same news (session 20c's finishing save).
  for (const phone of [false, true]) {
    const sfx = phone ? "-phone" : "";
    const p = await page(phone);
    await p.evaluateOnNewDocument(() => { localStorage.setItem("conquerra.effects", "full"); localStorage.setItem("conquerra.effects.noAuto", "1"); });
    await p.goto(URL, { waitUntil: "networkidle0" });
    await load(p, file("s20c-save.json"));
    await p.evaluate(async () => {
      const s = window.__conquerraStore.getState();
      await s.setInstruction(`leader:${s.view.me.id}`, { kind: "military" });
      await s.setBudget(`leader:${s.view.me.id}`, { share: 0.8 });
    });
    let got = false;
    for (let turn = 0; turn < 6 && !got; turn++) {
      const beats = await replayTurn(p);
      const b = beats.find((x) => x.capital) ?? beats.find((x) => x.out);
      if (b) {
        await holdAt(p, b.start + b.duration * (b.capital ? 0.8 : 0.3), b.to, phone ? 120 : 170);
        await p.waitForSelector(".title-card", { timeout: 3000 }).catch(() => {});
        await shot(p, "s22-title", sfx, { wait: 300 });
        got = true;
      }
      await endReplay(p);
      if (await p.evaluate(() => !!window.__conquerraStore.getState().view.winner)) break;
    }
    if (!got) console.log(`  (no title card seen${sfx})`);
    await p.close();
  }
}

// ---------- Part 2: the six personalities on the deal card, a bot's offer, a broken deal in the report ----------
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
  // Close the "keep two captured leaders" choice if it came up (keep the first ones).
  await p.evaluate(() => { const b = [...document.querySelectorAll(".dialog button")].find((x) => /Keep|Done/.test(x.textContent)); b?.click(); });
}
if (want("deals")) {
  const said = [];
  for (const phone of [false, true]) {
    const sfx = phone ? "-phone" : "";
    const done = new Set();
    for (const save of ["s20d-purse.json", "s20b-save.json"]) {
      const p = await page(phone);
      await p.goto(URL, { waitUntil: "networkidle0" });
      await load(p, file(save));
      // A bot's offer to you, if one is waiting.
      if (!done.has("offer") && (await p.evaluate(() => (window.__conquerraStore.getState().offers ?? []).length > 0))) {
        await p.evaluate(() => { const s = window.__conquerraStore.getState(); s.openOffer(s.offers[0]); });
        await shot(p, "s22-deal-offer", sfx, { wait: 900 });
        said.push(await p.evaluate(() => document.querySelector(".deal-answer")?.textContent ?? ""));
        await p.evaluate(() => window.__conquerraStore.getState().closeDeal());
        done.add("offer");
      }
      const bots = await p.evaluate(() => window.__conquerraStore.getState().view.players.filter((x) => x.eliminatedTurn === null && x.id !== window.__conquerraStore.getState().view.me.id).map((x) => ({ id: x.id, name: x.name })));
      const style = JSON.parse(file(save)).state.players.reduce((m, x) => ((m[x.id] = x.leaders[0]?.personality), m), {});
      for (const b of bots) {
        const who = style[b.id];
        if (!who || done.has(who) || (phone && !["merchant", "schemer"].includes(who))) continue;
        for (const kind of ["truce", "passage"]) {
          await p.evaluate((to, kind) => window.__conquerraStore.getState().openPropose(to, kind), b.id, kind);
          await sleep(400);
          await p.evaluate(async () => { const s = window.__conquerraStore.getState(); await s.sendOffer(s.deal.offer); });
          await p.waitForSelector(".deal-answer", { timeout: 5000 }).catch(() => {});
          const text = await p.evaluate(() => document.querySelector(".deal-answer")?.textContent ?? "");
          said.push(`${who} ${kind}: ${text}`);
          await shot(p, `s22-deal-${who}-${kind}`, sfx, { wait: 600 });
          await p.evaluate(() => window.__conquerraStore.getState().closeDeal());
        }
        done.add(who);
      }
      await p.close();
    }
  }
  // A broken deal in the report: play the Wyrmland game on (your Leader running the military) until a bot breaks one
  // where you can see it.
  const p = await page(false);
  await p.goto(URL, { waitUntil: "networkidle0" });
  await load(p, file(process.env.BROKEN_SAVE ?? "s20b-save.json"));
  await p.evaluate(async () => {
    const s = window.__conquerraStore.getState();
    await s.setInstruction(`leader:${s.view.me.id}`, { kind: "military" });
    await s.setBudget(`leader:${s.view.me.id}`, { share: 0.6 });
  });
  let broke = false;
  for (let turn = 0; turn < 30 && !broke; turn++) {
    // Accept every offer, and offer a truce to everyone: more deals for someone to break.
    await p.evaluate(async () => {
      const s = window.__conquerraStore.getState();
      for (const o of s.offers ?? []) s.answerOffer(o, true);
      for (const x of s.view.players.filter((x) => x.eliminatedTurn === null && x.id !== s.view.me.id)) {
        s.openPropose(x.id, "truce");
        const st = window.__conquerraStore.getState();
        if (st.deal) await st.sendOffer(st.deal.offer);
        window.__conquerraStore.getState().closeDeal();
      }
    });
    await playTurn(p);
    broke = await p.evaluate(() => (window.__conquerraStore.getState().report?.events ?? []).some((e) => e.type === "dealBroken" && e.note));
    if (broke) {
      await p.evaluate(() => window.__conquerraStore.getState().setShowReport(true));
      await shot(p, "s22-report-broken", "", { wait: 1500 });
      said.push(await p.evaluate(() => [...document.querySelectorAll(".log li")].map((x) => x.textContent).filter((t) => /broke/.test(t)).join(" | ")));
    }
    if (await p.evaluate(() => !!window.__conquerraStore.getState().view.winner)) break;
  }
  if (!broke) console.log("  (no broken deal seen in 30 turns)");
  await p.close();
  console.log(said.join("\n"));
}

// ---------- Part 3: the leaders' voices ----------
const voicesOf = (p) => p.evaluate(() => (window.__conquerraStore.getState().report?.voices ?? []).map((v) => `${v.name} [${v.situation}]: ${v.text}`));
if (want("leaders")) {
  const said = [];
  for (const phone of [false, true]) {
    const sfx = phone ? "-phone" : "";
    const p = await page(phone);
    await p.goto(URL, { waitUntil: "networkidle0" });
    // Session 20c's game at turn 16: your Leader, Aldric, the Conqueror. Set up a bad attack of your own first:
    // a small army against a much bigger one, with more of your troops right next to the target.
    await load(p, file("s20c-home.json"));
    await p.evaluate(async () => {
      const s = window.__conquerraStore.getState();
      await s.setInstruction(`leader:${s.view.me.id}`, { kind: "military" });
      await s.setBudget(`leader:${s.view.me.id}`, { share: 0.6 });
    });
    let judged = false, two = false, panel = false;
    for (let turn = 0; turn < 10 && !(judged && two); turn++) {
      // A bad attack of your own each turn until your Leader has a moment to judge it (bigger news comes first).
      if (!judged) {
    const setUp = await p.evaluate(() => {
          const st = window.__conquerraStore.getState();
          const v = st.view, me = v.me.id, map = st.ctx.map;
          const nb = (t) => map.borders.filter((b) => b.a === t || b.b === t).map((b) => (b.a === t ? b.b : b.a));
          const full = (t) => (v.territories[t]?.detail === "full" ? v.territories[t] : null);
          for (const t of map.territories) {
            const x = full(t.id);
            if (!x || !x.owner || x.owner === me || x.troops < 5) continue;
            const mine = nb(t.id).filter((f) => full(f)?.owner === me && full(f).troops >= 2);
            if (mine.length >= 1) {
              mine.sort((a, b) => full(a).troops - full(b).troops);
              window.__conquerraStore.setState({ queue: [...st.queue, { id: "bad-1", kind: "move", from: mine[0], to: t.id, troops: 1 }] });
              return `${map.territories.find((y) => y.id === mine[0]).name} (1) against ${t.name} (${x.troops})`;
            }
          }
          return null;
        });
        console.log("  bad attack:", setUp);
      }
      await playTurn(p);
      const v = await voicesOf(p);
      said.push(...v);
      if (!judged && v.some((x) => /\[judge/.test(x))) {
        await p.evaluate(() => window.__conquerraStore.getState().setShowReport(true));
        await sleep(800);
        await p.evaluate(() => document.querySelector(".report-group.voices")?.scrollIntoView({ block: "center" }));
        await shot(p, "s22-leader-judge", sfx, { wait: 1500 });
        await p.evaluate(() => window.__conquerraStore.getState().setShowReport(false));
        judged = true;
      }
      if (!two && v.length >= 2) {
        await p.evaluate(() => window.__conquerraStore.getState().setShowReport(true));
        await sleep(800);
        await p.evaluate(() => document.querySelector(".report-group.voices")?.scrollIntoView({ block: "center" }));
        await shot(p, "s22-report-voices", sfx, { wait: 1500 });
        await p.evaluate(() => window.__conquerraStore.getState().setShowReport(false));
        two = true;
      }
      if (!panel && v.length) {
        if (phone) await p.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => x.getAttribute("aria-label") === "Leaders"); b?.click(); });
        await shot(p, "s22-leaders-panel", sfx, { wait: 1500 });
        panel = true;
      }
    }
    // The Chronicle, with the leaders' lines in it.
    await p.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /Chronicle/i.test(x.getAttribute("aria-label") ?? x.textContent ?? "")); b?.click(); });
    await shot(p, "s22-chronicle", sfx, { wait: 1500 });
    await p.close();
  }
  // A captured leader's first report (session 20c's finishing save: you hold 80%, the last Houses fall).
  const p = await page(false);
  await p.goto(URL, { waitUntil: "networkidle0" });
  await load(p, file("s20c-save.json"));
  await p.evaluate(async () => {
    const s = window.__conquerraStore.getState();
    await s.setInstruction(`leader:${s.view.me.id}`, { kind: "military" });
    await s.setBudget(`leader:${s.view.me.id}`, { share: 0.8 });
  });
  let first = false;
  for (let turn = 0; turn < 8 && !first; turn++) {
    await playTurn(p);
    const v = await voicesOf(p);
    said.push(...v);
    if (v.some((x) => /\[firstReport\]/.test(x))) {
      await p.evaluate(() => window.__conquerraStore.getState().setShowReport(true));
      await sleep(800);
      await p.evaluate(() => document.querySelector(".report-group.voices")?.scrollIntoView({ block: "center" }));
      await shot(p, "s22-captured-first", "", { wait: 1500 });
      first = true;
    }
    if (await p.evaluate(() => !!window.__conquerraStore.getState().view.winner)) break;
  }
  if (!first) console.log("  (no captured leader's first report seen)");
  await p.close();
  console.log(said.join("\n"));
}

// ---------- Part 4: every other word: the lobby, Settings, the Spoils sheet, game over and the awards ----------
if (want("words")) {
  for (const phone of [false, true]) {
    const sfx = phone ? "-phone" : "";
    const p = await page(phone);
    await p.goto(URL, { waitUntil: "networkidle0" });
    await shot(p, "s22-lobby", sfx, { wait: 2500 });
    await load(p, file("s20d-purse.json"));
    await p.evaluate(() => document.querySelector('button[aria-label="Settings"]')?.click());
    await shot(p, "s22-settings", sfx, { wait: 1200 });
    await p.evaluate(() => document.querySelector('button[aria-label="Settings"]')?.click());
    // The cards: the Spoils sets with a line of flavour under each.
    await p.evaluate(() => { const b = document.querySelector(".card-stack, button[aria-label*='cards' i], button[title*='Spoils' i]"); b?.click(); });
    await shot(p, "s22-cards", sfx, { wait: 1200 });
    // Game over, lost (its headline and line), then won for real, with the awards (session 20c's finishing save,
    // played to the end: the awards need the game's record, which only a finished game has).
    await load(p, file("s20c-save.json"));
    await p.evaluate(() => {
      const st = window.__conquerraStore.getState();
      const other = st.view.players.find((x) => x.id !== st.view.me.id && x.eliminatedTurn === null)?.id;
      window.__conquerraStore.setState({ screen: "over", view: { ...st.view, winner: other } });
    });
    await shot(p, "s22-defeat", sfx, { wait: 2500 });
    await load(p, file("s20c-save.json"));
    await p.evaluate(async () => {
      const s = window.__conquerraStore.getState();
      await s.setInstruction(`leader:${s.view.me.id}`, { kind: "military" });
      await s.setBudget(`leader:${s.view.me.id}`, { share: 0.8 });
    });
    for (let turn = 0; turn < 20 && !(await p.evaluate(() => !!window.__conquerraStore.getState().view.winner)); turn++) await playTurn(p);
    await p.waitForFunction(() => window.__conquerraStore.getState().screen === "over", { timeout: 30000 }).catch(() => {});
    await shot(p, "s22-victory", sfx, { wait: 2500 });
    await p.evaluate(() => document.querySelector(".awards")?.scrollIntoView({ block: "start" }));
    await shot(p, "s22-victory-awards", sfx, { wait: 1200 });
    await p.close();
  }
}

await browser.close();
