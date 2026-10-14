/**
 * Session 26 screenshots, desktop (1440x900) and a 384 px phone, into docs/art/screens/s26-*.png:
 *  - s26-online-block: the lobby's Online block open (New online game, Your online games)
 *  - s26-online-game: an online game's planning screen, the clock from the room (no pause button online)
 *  - s26-online-back: the page reloaded mid-replay, back in the replay
 *   node apps/web/scripts/s26-shots.mjs     (MAP_URL=... for another server; ONLY=name for one shot)
 * Needs the server: `wrangler dev` (pnpm build first; DEV_EMAIL in apps/web/.dev.vars) on 8787.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const out = process.env.OUT ?? join(root, "docs/art/screens");
const URL = process.env.MAP_URL ?? "http://127.0.0.1:8787/";
const only = process.env.ONLY ?? "";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--enable-gpu", "--use-angle=d3d11"] });
const shot = async (p, name, sfx) => {
  if (only && !name.includes(only)) return;
  await sleep(900);
  await p.screenshot({ path: join(out, `${name}${sfx}.png`) });
  console.log("  saved", `${name}${sfx}.png`);
};
const click = (p, text) => p.evaluate((t) => [...document.querySelectorAll("button")].find((b) => b.textContent.trim().startsWith(t))?.click(), text);

for (const phone of [false, true]) {
  const sfx = phone ? "-phone" : "";
  const ctx = await browser.createBrowserContext();
  const p = await ctx.newPage();
  if (phone) await p.emulate({ viewport: { width: 384, height: 832, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true }, userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36" });
  else await p.setViewport({ width: 1440, height: 900 });
  p.on("pageerror", (e) => console.log("page error:", e.message));
  await p.goto(URL, { waitUntil: "networkidle0" });
  await p.evaluate(() => localStorage.setItem("conquerra.lobby.open", JSON.stringify({ online: true })));
  await p.reload({ waitUntil: "networkidle0" });
  await p.waitForFunction(() => window.__conquerraStore?.getState().onlineGames !== null, { timeout: 20000 });
  await p.evaluate(() => document.querySelector(".online-new")?.scrollIntoView({ block: "start" }));
  await shot(p, "s26-online-block", sfx);
  // A new online game, from the block.
  await click(p, "Start an online game");
  await p.waitForFunction(() => window.__conquerraStore?.getState().online && window.__conquerraStore.getState().view, { timeout: 60000 });
  await sleep(3500);
  await shot(p, "s26-online-game", sfx);
  // Lock in, then reload in the middle of the replay: back in it.
  await p.evaluate(() => window.__conquerraStore.getState().lockIn());
  await p.waitForFunction(() => window.__conquerraStore.getState().replay, { timeout: 30000 });
  await sleep(1500);
  await p.reload({ waitUntil: "networkidle0" });
  await p.waitForFunction(() => window.__conquerraStore?.getState().replay, { timeout: 30000 });
  await sleep(2500);
  await shot(p, "s26-online-back", sfx);
  await ctx.close();
}
await browser.close();
