/**
 * Session 25b screenshots, on desktop (1440x900) and a 384 px phone, into docs/art/screens/s25b-*.png:
 *  - s25b-lobby-folded: the new lobby as it opens (Your House and Rules folded, their choices in one line)
 *  - s25b-lobby-open: both blocks open (on the phone, scrolled to Rules: Start stays at the bottom of the screen)
 *  - s25b-lobby-continue: the lobby with a saved game (Continue up top)
 *   node apps/web/scripts/s25b-shots.mjs     (MAP_URL=... for another server; ONLY=name for one shot)
 * Needs the game running (the dev server on 5173, or the built one on 4173 with MAP_URL).
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const out = process.env.OUT ?? join(root, "docs/art/screens");
const URL = process.env.MAP_URL ?? "http://localhost:5173/";
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
  await p.evaluate(() => localStorage.removeItem("conquerra.lobby.open"));
  await p.reload({ waitUntil: "networkidle0" });
  await shot(p, "s25b-lobby-folded", sfx);
  await click(p, "▸Your House");
  await click(p, "▸Rules");
  await sleep(300);
  if (phone) await p.evaluate(() => document.querySelector(".fold.open:last-of-type .picks")?.scrollIntoView({ block: "center" }));
  await shot(p, "s25b-lobby-open", sfx);
  // Fold them again, start a game, and come back: the lobby with a saved game.
  await click(p, "▾Your House");
  await click(p, "▾Rules");
  await click(p, "Start");
  await p.waitForFunction(() => window.__conquerraStore?.getState().view, { timeout: 60000 });
  await sleep(2500);
  await p.evaluate(() => window.__conquerraStore.getState().playAgain());
  await p.reload({ waitUntil: "networkidle0" });
  await p.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => b.textContent.startsWith("Continue")), { timeout: 20000 }).catch(() => console.log("  (no Continue: no autosave yet)"));
  await shot(p, "s25b-lobby-continue", sfx);
  await ctx.close();
}
await browser.close();
