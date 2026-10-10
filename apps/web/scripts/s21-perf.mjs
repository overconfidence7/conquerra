/**
 * Session 21: the replay's frame rate on a 384 px phone (CPU slowed 4x, as s19-perf.mjs) and on a laptop, with the
 * effects on Full and on Light (and Off), over three turns of a game with the fog lifted (every battle on the map
 * plays, the hardest case). Also the living map's cost: frames a second at Mid with nothing happening.
 *   node apps/web/scripts/s21-perf.mjs [maps=wyrmland:5,krakenmere:9] [levels=full,light,off]
 * Prints a line per map, device and level, and writes docs/art/screens/perf-s21.json (PERF_OUT=... elsewhere).
 * Needs the built game running (`pnpm build`, then the web-preview server on 4173).
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const URL = process.env.MAP_URL ?? "http://localhost:4173/";
const [mapsArg = "wyrmland:5,krakenmere:9", levelsArg = "full,light,off"] = process.argv.slice(2);
const DEVICES = (process.env.DEVICES ?? "phone,desktop").split(",");
const TURNS = Number(process.env.TURNS ?? 3);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DESKTOP = { viewport: { width: 1440, height: 900, deviceScaleFactor: 1 } };
const PHONE = {
  viewport: { width: 384, height: 832, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true },
  userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36",
};
const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--enable-gpu", "--use-angle=d3d11", "--ignore-gpu-blocklist", "--disable-frame-rate-limit", "--disable-gpu-vsync"],
});

const fpsOf = (times) => {
  const gaps = times.slice(1).map((x, i) => x - times[i]).sort((a, b) => a - b);
  return { fps: Math.round(((times.length - 1) / (times.at(-1) - times[0])) * 1000 * 10) / 10, p95ms: Math.round(gaps[Math.floor(gaps.length * 0.95)] * 10) / 10 };
};

/** Frames a second through one turn's replay: attack from the capital (and whatever the bots do). */
async function oneReplay(page) {
  await page.evaluate(() => {
    const g = window.__conquerraStore.getState();
    const cap = g.view.me.capital;
    const mine = Object.entries(g.view.territories).filter(([, t]) => t.detail === "full" && t.owner === g.view.me.id && t.troops > 2).map(([id]) => id);
    const from = mine.includes(cap) ? cap : mine[0];
    if (from) {
      const nb = g.ctx.map.borders.flatMap((b) => (b.a === from ? [b.b] : b.b === from ? [b.a] : [])).filter((id) => g.view.territories[id]?.owner !== g.view.me.id);
      if (nb[0]) {
        g.select(from);
        g.tap(nb[0]);
        window.__conquerraStore.getState().addDraft();
      }
    }
    window.__conquerraMap.fit(false);
  });
  await sleep(300);
  await page.evaluate(() => void window.__conquerraStore.getState().lockIn());
  await page.waitForFunction(() => window.__conquerraStore.getState().replay !== null, { timeout: 90000, polling: 20 });
  const r = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const times = [];
        const step = (t) => {
          times.push(t);
          if (window.__conquerraStore.getState().replay && t - times[0] < 25000) requestAnimationFrame(step);
          else resolve({ times, auto: window.__conquerraFx?.autoLight ?? false, peak: window.__conquerraFx?.peak ?? null });
        };
        requestAnimationFrame(step);
      }),
  );
  await page.evaluate(() => {
    const g = window.__conquerraStore.getState();
    g.endReplay?.();
    g.setShowReport?.(false);
  });
  return { ...fpsOf(r.times), seconds: Math.round((r.times.at(-1) - r.times[0]) / 100) / 10, autoLight: r.auto, peakParticles: r.peak };
}

/** Frames a second at Mid with nothing happening (the living map's cost). */
const idleFps = (page, ms) =>
  page.evaluate(
    (ms) =>
      new Promise((resolve) => {
        const times = [];
        const step = (t) => {
          times.push(t);
          if (t - times[0] < ms) requestAnimationFrame(step);
          else resolve(times);
        };
        requestAnimationFrame(step);
      }),
    ms,
  );

const rows = [];
for (const [mapId, botsArg] of mapsArg.split(",").map((x) => x.split(":"))) {
  for (const device of DEVICES) {
    for (const level of levelsArg.split(",")) {
      const page = await (await browser.createBrowserContext()).newPage();
      const cdp = await page.createCDPSession();
      if (device === "phone") await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await page.emulate(device === "phone" ? PHONE : DESKTOP);
      await page.evaluateOnNewDocument((level) => {
        try {
          localStorage.setItem("conquerra.effects", level);
          // Measure the level asked for: the automatic switch to Light reports, but doesn't act, in this script.
          localStorage.setItem("conquerra.effects.noAuto", "1");
        } catch {}
      }, level);
      await page.goto(URL, { waitUntil: "networkidle0" });
      await page.evaluate((m, b) => window.__conquerraStore.getState().setLobby({ mapId: m, bots: b, fog: false }), mapId, Number(botsArg));
      await page.evaluate(() => [...document.querySelectorAll("button")].find((x) => /^(Start|Start a new game)$/.test(x.textContent?.trim() ?? "")).click());
      await page.waitForFunction(() => { const s = window.__conquerraMap?.stats?.(); return s && s.tilesBaked === s.tileCount; }, { timeout: 180000, polling: 50 });
      await sleep(1500);
      // The living map at Mid around your capital, nothing happening.
      await page.evaluate(() => {
        const g = window.__conquerraStore.getState();
        const t = g.ctx.map.geometry.territories.find((x) => x.id === g.view.me.capital);
        const cam = window.__conquerraMap.camera;
        cam.centreOn(t.label.x, t.label.y, 120 / cam.territorySize);
      });
      await sleep(1500);
      const idle = fpsOf(await idleFps(page, 3000));
      const replays = [];
      for (let k = 0; k < TURNS; k++) replays.push(await oneReplay(page));
      const row = { map: mapId, players: Number(botsArg) + 1, device, level, idleMid: idle, replays, replayFps: Math.round((replays.reduce((a, r) => a + r.fps, 0) / replays.length) * 10) / 10, worstFps: Math.min(...replays.map((r) => r.fps)) };
      rows.push(row);
      console.log(JSON.stringify({ map: row.map, device, level, idleMid: idle.fps, replayFps: row.replayFps, worst: row.worstFps, p95: replays.map((r) => r.p95ms), secs: replays.map((r) => r.seconds), autoLight: replays.some((r) => r.autoLight), peak: replays.map((r) => r.peakParticles) }));
      await page.close();
    }
  }
}
await browser.close();
writeFileSync(process.env.PERF_OUT ?? join(root, "docs/art/screens/perf-s21.json"), JSON.stringify(rows, null, 2) + "\n");
