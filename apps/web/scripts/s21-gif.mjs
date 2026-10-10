/**
 * Session 21: a GIF of one turn's replay (docs/art/screens/s21-replay.gif), desktop, with battles and a capture in it.
 * Plays session 20d's Wyrmland turn and takes frames on the replay's own clock (held at each moment, so every frame is
 * exactly what the replay shows then), at Mid over your battles, then joins them with ffmpeg (on PATH).
 *   node apps/web/scripts/s21-gif.mjs [seconds=13] [fps=10]
 * Needs the built game running (`pnpm build`, then the web-preview server on 4173).
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const URL = process.env.MAP_URL ?? "http://localhost:4173/";
const [secs = "13", fps = "10"] = process.argv.slice(2);
const frames = join(tmpdir(), `conquerra-gif-${Date.now()}`);
mkdirSync(frames, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--enable-gpu", "--use-angle=d3d11"] });
const p = await browser.newPage();
await p.setViewport({ width: 1440, height: 900 });
await p.evaluateOnNewDocument(() => { localStorage.setItem("conquerra.effects", "full"); localStorage.setItem("conquerra.effects.noAuto", "1"); });
await p.goto(URL, { waitUntil: "networkidle0" });
await p.evaluate((f) => window.__conquerraStore.getState().load({ file: f }), readFileSync(join(root, "docs/art/screens/s20d-purse.json"), "utf8"));
await p.waitForFunction(() => { const s = window.__conquerraMap?.stats?.(); return s && s.tilesBaked === s.tileCount; }, { timeout: 120000, polling: 200 });
await p.evaluate(() => window.__conquerraStore.getState().setShowReport?.(false));
await sleep(2000);
await p.evaluate(() => (window.__conquerraReplayAt = 0));
await p.evaluate(() => void window.__conquerraStore.getState().lockIn());
await p.waitForFunction(() => window.__conquerraTimeline && window.__conquerraStore.getState().replay, { timeout: 90000 });
// Where your battles are: the camera holds at Mid over the middle of them (the replay's own camera stands aside).
const span = await p.evaluate((secs) => {
  const st = window.__conquerraStore.getState();
  const tl = window.__conquerraTimeline;
  const me = st.replay.before.me.id;
  const mine = tl.beats.filter((b) => b.kind === "battle" && b.events.some((e) => e.player === me || e.defender === me));
  const g = st.ctx.map.geometry;
  // (The first three of them: close enough to read the fight.)
  const pts = mine.slice(0, 3).flatMap((b) => b.events.map((e) => g.territories.find((t) => t.id === e.to)?.label)).filter(Boolean);
  const x = pts.reduce((a, q) => a + q.x, 0) / pts.length, y = pts.reduce((a, q) => a + q.y, 0) / pts.length;
  const cam = window.__conquerraMap.camera;
  cam.userMoves = (cam.userMoves ?? 0) + 1;
  // (Shifted so the battles land in the open part of the screen, clear of the panel on the left.)
  const k = 165 / cam.territorySize;
  cam.centreOn(x - 190 / k, y + 30 / k, k);
  const first = Math.max(0, (mine[0]?.start ?? 0) - 800);
  return { from: first, to: Math.min(tl.total, first + secs * 1000), battles: mine.length };
}, Number(secs));
await sleep(1500);
const step = 1000 / Number(fps);
let n = 0;
for (let t = span.from; t <= span.to; t += step) {
  await p.evaluate((t) => (window.__conquerraReplayAt = t), t);
  await sleep(60);
  await p.screenshot({ path: join(frames, `f${String(n++).padStart(4, "0")}.png`) });
}
await browser.close();
const out = join(root, "docs/art/screens/s21-replay.gif");
const ff = (args) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });
ff(["-framerate", fps, "-i", join(frames, "f%04d.png"), "-vf", "scale=640:-1:flags=lanczos,palettegen=max_colors=112:stats_mode=diff", join(frames, "palette.png")]);
ff(["-framerate", fps, "-i", join(frames, "f%04d.png"), "-i", join(frames, "palette.png"), "-lavfi", "scale=640:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle", out]);
rmSync(frames, { recursive: true, force: true });
console.log(`${n} frames, ${span.battles} of your battles; ${out}: ${(statSync(out).size / 1e6).toFixed(1)} MB`);
