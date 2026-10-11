/**
 * Session 24: the game's sound in a real browser. Plays turns on the phone profile (384 px, CPU slowed 4x, as
 * s21-perf.mjs) with the fog lifted, and measures the replay's frame rate with sound on and with it muted; logs every
 * sound the mixer played (cue, file, when) and how much sound a game loaded.
 *   node apps/web/scripts/s24-sound.mjs [maps=wyrmland:5,krakenmere:9] [modes=on,muted]
 * Every run plays the same game (SEED=7; the dice seed is pinned), so sound on and muted compare the same turns; list a
 * mode twice (muted,on,muted,on) to see the noise between runs. Writes docs/sound/perf-s24.json. Needs the built game running (`pnpm build`, then the web-preview server on 4173).
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const URL = process.env.MAP_URL ?? "http://localhost:4173/";
const [mapsArg = "wyrmland:5,krakenmere:9", modesArg = "on,muted"] = process.argv.slice(2);
const DEVICE = process.env.DEVICE ?? "phone";
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
  args: ["--enable-gpu", "--use-angle=d3d11", "--ignore-gpu-blocklist", "--disable-frame-rate-limit", "--disable-gpu-vsync", "--autoplay-policy=no-user-gesture-required"],
});
const fpsOf = (times) => Math.round(((times.length - 1) / (times.at(-1) - times[0])) * 1000 * 10) / 10;

async function oneReplay(page) {
  await page.evaluate(() => {
    const g = window.__conquerraStore.getState();
    const cap = g.view.me.capital;
    const mine = Object.entries(g.view.territories).filter(([, t]) => t.detail === "full" && t.owner === g.view.me.id && t.troops > 2).map(([id]) => id);
    const from = mine.includes(cap) ? cap : mine[0];
    if (from) {
      const nb = g.ctx.map.borders.flatMap((b) => (b.a === from ? [b.b] : b.b === from ? [b.a] : [])).filter((id) => g.view.territories[id]?.owner !== g.view.me.id);
      if (nb[0]) (g.select(from), g.tap(nb[0]), window.__conquerraStore.getState().addDraft());
    }
    window.__conquerraMap.fit(false);
    window.__conquerraSoundLog = [];
  });
  await sleep(300);
  await page.evaluate(() => void window.__conquerraStore.getState().lockIn());
  await page.waitForFunction(() => window.__conquerraStore.getState().replay !== null, { timeout: 90000, polling: 20 });
  const r = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const times = [];
        let most = 0;
        const step = (t) => {
          times.push(t);
          most = Math.max(most, window.__conquerraMixer?.busy ?? 0);
          if (window.__conquerraStore.getState().replay && t - times[0] < 25000) requestAnimationFrame(step);
          else resolve({ times, most, log: window.__conquerraSoundLog ?? [] });
        };
        requestAnimationFrame(step);
      }),
  );
  await page.evaluate(() => {
    const g = window.__conquerraStore.getState();
    g.endReplay?.();
    g.setShowReport?.(false);
  });
  const t0 = r.times[0];
  return { fps: fpsOf(r.times), seconds: Math.round((r.times.at(-1) - t0) / 100) / 10, mostAtOnce: r.most, sounds: r.log.map((x) => `${Math.round(x.at - t0)} ${x.cue} ${x.file}`) };
}

const rows = [];
for (const [mapId, botsArg] of mapsArg.split(",").map((x) => x.split(":"))) {
  for (const mode of modesArg.split(",")) {
    const page = await (await browser.createBrowserContext()).newPage();
    const cdp = await page.createCDPSession();
    if (DEVICE === "phone") await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.emulate(DEVICE === "phone" ? PHONE : DESKTOP);
    await page.evaluateOnNewDocument((muted, seed) => {
      // The same game in every run (the game's dice seed is 16 random bytes): sound on and muted play the same turns.
      const own = crypto.getRandomValues.bind(crypto);
      crypto.getRandomValues = (a) => {
        if (a instanceof Uint8Array && a.length === 16) {
          for (let i = 0; i < 16; i++) a[i] = (seed * 31 + i * 17) & 255;
          return a;
        }
        return own(a);
      };
      try {
        localStorage.setItem("conquerra.effects", "full");
        localStorage.setItem("conquerra.effects.noAuto", "1");
        localStorage.setItem("conquerra.sound", JSON.stringify({ master: 0.7, music: 0.45, effects: 0.8, muted }));
      } catch {}
    }, mode === "muted", Number(process.env.SEED ?? 7));
    const fetched = [];
    page.on("response", (res) => {
      if (/\/sound\/[\w-]+\.mp3$/.test(res.url())) void res.buffer().then((b) => fetched.push([res.url().split("/").pop(), b.length])).catch(() => {});
    });
    await page.goto(URL, { waitUntil: "networkidle0" });
    const lobbySound = fetched.length;
    await page.evaluate((m, b) => window.__conquerraStore.getState().setLobby({ mapId: m, bots: b, fog: false }), mapId, Number(botsArg));
    await page.evaluate(() => [...document.querySelectorAll("button")].find((x) => /^(Start|Start a new game)$/.test(x.textContent?.trim() ?? "")).click());
    await page.waitForFunction(() => { const s = window.__conquerraMap?.stats?.(); return s && s.tilesBaked === s.tileCount; }, { timeout: 180000, polling: 50 });
    await sleep(2500);
    const replays = [];
    for (let k = 0; k < TURNS; k++) replays.push(await oneReplay(page));
    await sleep(500);
    const bytes = fetched.reduce((a, [, n]) => a + n, 0);
    const row = { map: mapId, players: Number(botsArg) + 1, device: DEVICE, sound: mode, replayFps: Math.round((replays.reduce((a, r) => a + r.fps, 0) / replays.length) * 10) / 10, worstFps: Math.min(...replays.map((r) => r.fps)), lobbySoundFiles: lobbySound, soundFiles: fetched.length, soundKB: Math.round(bytes / 1024), replays };
    rows.push(row);
    console.log(JSON.stringify({ map: row.map, sound: mode, replayFps: row.replayFps, worst: row.worstFps, lobbySoundFiles: lobbySound, soundFiles: row.soundFiles, soundKB: row.soundKB, mostAtOnce: replays.map((r) => r.mostAtOnce), sounds: replays.map((r) => r.sounds.length) }));
    await page.close();
  }
}
await browser.close();
writeFileSync(process.env.PERF_OUT ?? join(root, "docs/sound/perf-s24.json"), JSON.stringify(rows, null, 2) + "\n");
