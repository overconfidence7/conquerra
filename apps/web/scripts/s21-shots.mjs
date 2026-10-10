/**
 * Session 21 screenshots (the polish pass), desktop (1440x900) and a 384 px phone, into docs/art/screens/s21-*.png.
 *   node apps/web/scripts/s21-shots.mjs [part...]     parts: art (Part 1), fx (Part 2), build (Part 3), cine (Part 4),
 *                                                    living (Part 5), menus (Part 6); none = all
 *   ONLY=name for one shot, MAP_URL=... for another server.
 * Needs the built game running (`pnpm build`, then the web-preview server on 4173). Real saves: session 20d's
 * Wyrmland game (s20d-purse.json) and session 20c's finishing save (s20c-save.json: you hold 80%).
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

// ---------- Part 1: art batch 4 ----------
if (want("art")) {
  for (const phone of [false, true]) {
    const sfx = phone ? "-phone" : "";
    const p = await page(phone);
    // The lobby over the title art.
    await p.goto(URL, { waitUntil: "networkidle0" });
    await shot(p, "s21-lobby", sfx, { wait: 1500 });
    // A map at Mid: hills and pines (Wyrmland, the 20d game).
    await load(p, file("s20d-purse.json"));
    const forest = await p.evaluate(() => {
      const st = window.__conquerraStore.getState();
      // Hills and forest you can see (not fogged), nearest your capital first.
      const cap = st.ctx.map.territories.find((t) => t.id === st.view.me.capital);
      const seen = st.ctx.map.territories.filter((t) => (t.terrain === "hills" || t.terrain === "forest") && st.view.territories[t.id]?.detail === "full");
      seen.sort((a, b) => Math.hypot(a.x - cap.x, a.y - cap.y) - Math.hypot(b.x - cap.x, b.y - cap.y));
      return seen.slice(0, 2).map((t) => t.id);
    });
    await look(p, forest, phone ? 110 : 130);
    await settle(p);
    await shot(p, "s21-map-mid", sfx, { wait: 2500 });
    // Game over, won and lost (the 20d game, its result shown as each).
    for (const [name, mine] of [["s21-victory", true], ["s21-defeat", false]]) {
      await p.evaluate((mine) => {
        const st = window.__conquerraStore.getState();
        const other = st.view.players.find((x) => x.id !== st.view.me.id).id;
        window.__conquerraStore.setState({ screen: "over", view: { ...st.view, winner: mine ? st.view.me.id : other } });
      }, mine);
      await shot(p, name, sfx, { wait: 2500 });
    }
    await p.close();
  }
  // The bench: batch 4's pieces in the game's own renderer (figures at Near, the windmill, the sheet of trees).
  const p = await page(false);
  await p.setViewport({ width: 1440, height: 1700 });
  await p.goto(`${URL}?lab=bench&part=redo`, { waitUntil: "networkidle0" });
  await sleep(2500);
  const box = await (await p.$("#redo")).boundingBox();
  await shot(p, "s21-bench-trees", "", { clip: { x: box.x, y: box.y + 750, width: Math.min(box.width, 1400), height: 450 } });
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto(`${URL}?lab=bench&part=sprites`, { waitUntil: "networkidle0" });
  await sleep(4000);
  await p.evaluate(() => {
    const cam = window.__conquerraMap?.camera;
    if (!cam) return;
    cam.centreOn(cam.map.x + cam.map.width * 0.93, cam.map.y + cam.map.height * 0.1, 300 / cam.territorySize);
  });
  await sleep(2500);
  await shot(p, "s21-bench-figures", "");
  await p.close();
}

// ---------- Part 2: the effects (held at exact moments of real replays) ----------
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

if (want("fx")) {
  for (const phone of [false, true]) {
    const sfx = phone ? "-phone" : "";
    const p = await page(phone);
    await p.evaluateOnNewDocument(() => { localStorage.setItem("conquerra.effects", "full"); localStorage.setItem("conquerra.effects.noAuto", "1"); });
    await p.goto(URL, { waitUntil: "networkidle0" });
    const px = phone ? 120 : 170;
    // A busy Wyrmland turn (the 20d game): an army marching, the biggest battle mid-clash, a capture.
    await load(p, file("s20d-purse.json"));
    let beats = await replayTurn(p);
    const march = beats.find((b) => b.kind === "march" && b.mine) ?? beats.find((b) => b.kind === "march") ?? beats.find((b) => b.kind === "battle");
    const big = [...beats].filter((b) => b.kind === "battle").sort((a, b) => b.troops - a.troops)[0];
    const cap = beats.find((b) => b.kind === "battle" && b.captured && b.mine) ?? beats.find((b) => b.kind === "battle" && b.captured);
    if (march) (await holdAt(p, march.start + march.duration * (march.kind === "battle" ? 0.22 : 0.5), march.to, px), await shot(p, "s21-fx-march", sfx));
    if (big) (await holdAt(p, big.start + big.duration * 0.56, big.to, px), await shot(p, "s21-fx-battle", sfx));
    if (cap) (await holdAt(p, cap.start + cap.duration * 0.84, cap.to, px), await shot(p, "s21-fx-capture", sfx));
    await endReplay(p);
    // The finish (session 20c's save: you hold 80%): play turns until a capital falls and a House is knocked out.
    await load(p, file("s20c-save.json"));
    await p.evaluate(async () => {
      const s = window.__conquerraStore.getState();
      await s.setInstruction(`leader:${s.view.me.id}`, { kind: "military" });
      await s.setBudget(`leader:${s.view.me.id}`, { share: 0.8 });
    });
    let gotCapital = false, gotOut = false;
    for (let turn = 0; turn < 6 && !(gotCapital && gotOut); turn++) {
      beats = await replayTurn(p);
      const fall = beats.find((b) => b.capital);
      const out = beats.find((b) => b.out);
      if (fall && !gotCapital) {
        await holdAt(p, fall.start + fall.duration * 0.86, fall.to, px);
        await shot(p, "s21-fx-capital", sfx);
        gotCapital = true;
      }
      if (out && !gotOut) {
        const where = await p.evaluate((player, i) => {
          const tl = window.__conquerraTimeline;
          let at = null;
          for (const b of tl.beats.slice(0, i)) for (const e of b.events) if (e.type === "battle" && e.captured && e.defender === player) at = e.to;
          return at;
        }, out.out, out.i);
        await holdAt(p, out.start + out.duration * 0.4, where, px);
        await shot(p, "s21-fx-knockout", sfx);
        gotOut = true;
      }
      await endReplay(p);
      if (await p.evaluate(() => !!window.__conquerraStore.getState().view.winner)) break;
    }
    // No capital fell in the finish: play the Wyrmland game on (your Leader running the military) until one does.
    if (!gotCapital) {
      await load(p, file("s20d-purse.json"));
      await p.evaluate(async () => {
        const s = window.__conquerraStore.getState();
        await s.setInstruction(`leader:${s.view.me.id}`, { kind: "military" });
        await s.setBudget(`leader:${s.view.me.id}`, { share: 0.8 });
      });
      for (let turn = 0; turn < 16 && !gotCapital; turn++) {
        beats = await replayTurn(p);
        const fall = beats.find((b) => b.capital);
        if (fall) {
          await holdAt(p, fall.start + fall.duration * 0.86, fall.to, px);
          await shot(p, "s21-fx-capital", sfx);
          gotCapital = true;
        }
        await endReplay(p);
        if (await p.evaluate(() => !!window.__conquerraStore.getState().view.winner)) break;
      }
    }
    if (!gotCapital || !gotOut) console.log(`  (no ${gotCapital ? "" : "capital falling "}${gotOut ? "" : "knock-out"} found${sfx})`);
    await p.close();
  }
}

// ---------- Part 4: the cinematic replay; building, culture, Fate, deals and spies ----------
if (want("cine")) {
  for (const phone of [false, true]) {
    const sfx = phone ? "-phone" : "";
    const p = await page(phone);
    await p.evaluateOnNewDocument(() => { localStorage.setItem("conquerra.effects", "full"); localStorage.setItem("conquerra.effects.noAuto", "1"); });
    await p.goto(URL, { waitUntil: "networkidle0" });
    const px = phone ? 120 : 170;
    // The Wyrmland game (20d), played on: accept Baron Krell's offer, hire a spy and send it, the Steward raises
    // culture; keep playing until each moment has been seen once.
    await load(p, file("s20d-purse.json"));
    await p.evaluate(async () => {
      const s = window.__conquerraStore.getState();
      for (const o of s.offers ?? []) s.answerOffer(o, true);
      await s.setInstruction(`leader:${s.view.me.id}`, { kind: "military" });
      await s.setBudget(`leader:${s.view.me.id}`, { share: 0.6 });
    });
    const want4 = new Set(["deal", "laurels", "fate", "spy", "title"]);
    for (let turn = 0; turn < 16 && want4.size; turn++) {
      // A spy: hire one at the capital, then send it to a rival's province.
      await p.evaluate(() => {
        const st = window.__conquerraStore.getState();
        const v = st.view;
        const spy = v.spies.find((x) => x.status === "defend" || x.at === v.me.capital);
        if (spy) {
          const rival = Object.entries(v.territories).find(([, t]) => t.detail === "full" && t.owner && t.owner !== v.me.id);
          const prov = rival && st.ctx.map.territories.find((t) => t.id === rival[0]).province;
          if (prov) window.__conquerraStore.setState({ queue: [...st.queue, { id: `spy-${Date.now()}`, kind: "spy", spy: spy.id, to: prov }] });
        } else if (!v.spies.length) window.__conquerraStore.setState({ queue: [...st.queue, { id: `hire-${Date.now()}`, kind: "hireSpy", territory: v.me.capital }] });
      });
      const beats = await replayTurn(p);
      const found = await p.evaluate((SPY_MS) => {
        const tl = window.__conquerraTimeline;
        const pick = (pred) => { for (const b of tl.beats) for (const e of b.events) if (pred(e)) return { at: b.start + b.duration * 0.5, e }; return null; };
        const deal = pick((e) => e.type === "dealStarted");
        const laurels = pick((e) => e.type === "invested");
        const fate = pick((e) => e.type === "fate" || e.type === "worldEvent");
        const st = window.__conquerraStore.getState();
        const spyEv = st.replay.report.events.find((e) => e.type === "spy");
        const spot = (e) => e?.territory ?? e?.at ?? e?.target ?? null;
        const owner = (id) => st.replay.before.territories[id]?.owner;
        const dealAt = deal && Object.keys(st.replay.before.territories).find((id) => owner(id) === deal.e.deal.a);
        return {
          deal: deal && { at: deal.at, to: dealAt },
          laurels: laurels && { at: laurels.at, to: spot(laurels.e) },
          fate: fate && { at: fate.at, to: spot(fate.e) },
          spy: spyEv && { at: tl.total - SPY_MS * 0.45, to: spyEv.territory },
        };
      }, 1400);
      for (const k of ["deal", "laurels", "fate", "spy"]) {
        if (!want4.has(k) || !found[k]) continue;
        await holdAt(p, found[k].at, found[k].to, px);
        await shot(p, `s21-cine-${k}`, sfx);
        want4.delete(k);
      }
      // A title card on the letterboxed replay: hold at a capital falling or a knock-out, where the card is.
      if (want4.has("title")) {
        const b = beats.find((x) => x.capital) ?? beats.find((x) => x.out);
        if (b) {
          await holdAt(p, b.start + b.duration * (b.capital ? 0.8 : 0.3), null, px);
          await p.waitForSelector(".title-card", { timeout: 3000 }).catch(() => {});
          await shot(p, "s21-cine-title", sfx, { wait: 300 });
          want4.delete("title");
        }
      }
      await endReplay(p);
      if (await p.evaluate(() => !!window.__conquerraStore.getState().view.winner)) break;
    }
    if (want4.size) console.log(`  (not seen${sfx}: ${[...want4].join(", ")})`);
    await p.close();
  }
}

// ---------- Parts 5 and 6: the living map, menus with weight ----------
if (want("living")) {
  for (const phone of [false, true]) {
    const sfx = phone ? "-phone" : "";
    const p = await page(phone);
    await p.goto(URL, { waitUntil: "networkidle0" });
    await shot(p, "s21-lobby", sfx, { wait: 2500 });
    await load(p, file("s20d-purse.json"));
    const cap = await p.evaluate(() => window.__conquerraStore.getState().view.me.capital);
    for (const [name, px] of phone ? [["mid", 120]] : [["mid", 150], ["far", 55]]) {
      await look(p, [cap], px);
      await settle(p);
      await shot(p, `s21-living-${name}`, sfx, { wait: 3000 });
    }
    // Lock in: the seal stamps (held "sealing"), then the replay ends and "Turn 9" sweeps across.
    await p.evaluate(() => window.__conquerraStore.setState({ busy: true }));
    await sleep(150);
    await shot(p, "s21-menu-seal", sfx, { wait: 120 });
    await p.evaluate(() => window.__conquerraStore.setState({ busy: false }));
    await p.evaluate(() => void window.__conquerraStore.getState().lockIn());
    await p.waitForFunction(() => window.__conquerraTimeline && window.__conquerraStore.getState().replay, { timeout: 90000 });
    await p.evaluate(() => (window.__conquerraReplayAt = 1e9));
    await p.waitForFunction(() => !window.__conquerraStore.getState().replay, { timeout: 30000 });
    await p.evaluate(() => { delete window.__conquerraReplayAt; window.__conquerraStore.getState().setShowReport?.(false); });
    await shot(p, "s21-menu-turn", sfx, { wait: 380 });
    // Game over, won and lost: petals and embers over the art.
    for (const [name, mine] of [["s21-victory", true], ["s21-defeat", false]]) {
      await p.evaluate((mine) => {
        const st = window.__conquerraStore.getState();
        const other = st.view.players.find((x) => x.id !== st.view.me.id).id;
        window.__conquerraStore.setState({ screen: "over", view: { ...st.view, winner: mine ? st.view.me.id : other } });
      }, mine);
      await shot(p, name, sfx, { wait: 3500 });
    }
    await p.close();
  }
}

// ---------- Part 3: buildings that stand up like the walls ----------
if (want("build")) {
  for (const phone of [false, true]) {
    const sfx = phone ? "-phone" : "";
    const p = await page(phone);
    await p.goto(URL, { waitUntil: "networkidle0" });
    // Session 20d's walled Wyrmland game: the wall with the most buildings in and around it.
    await load(p, file("s20d-wall-garrison.json"));
    const ids = await p.evaluate(() => {
      const st = window.__conquerraStore.getState();
      const v = st.view;
      const built = (id) => { const t = v.territories[id]; return t?.detail === "full" && (t.building || t.construction) ? 1 : 0; };
      const near = (id) => st.ctx.map.borders.flatMap((b) => (b.a === id ? [b.b] : b.b === id ? [b.a] : []));
      const walls = (v.walls ?? []).map((w) => w.territories);
      const score = (ts) => ts.reduce((n, id) => n + built(id) + near(id).reduce((m, x) => m + built(x), 0) * 0.3, 0);
      const best = walls.sort((a, b) => score(b) - score(a))[0] ?? [v.me.capital];
      return best;
    });
    for (const [level, px] of phone ? [["mid", 130]] : [["near", 300], ["mid", 150], ["far", 60]]) {
      await look(p, ids, px);
      await settle(p);
      await shot(p, `s21-build-${level}`, sfx, { wait: 2500 });
    }
    await p.close();
  }
}

await browser.close();
