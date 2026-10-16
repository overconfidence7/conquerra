/**
 * Session 32: the "What a bot knew" page (`?lab=known`) at one seat and turn, saved as a picture.
 *   node apps/web/scripts/s32-known-shot.mjs <out.jpg> [map] [players] [seed] [seat] [turn]
 * Needs the game running (`pnpm --filter web exec vite --port 5173`, or MAP_URL).
 */
import puppeteer from "puppeteer-core";

const URL = process.env.MAP_URL ?? "http://localhost:5173/";
const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const [out = "known.jpg", map = "embervale", players = "4", seed = "s32-known", seat = "2", turn = "3"] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--enable-gpu", "--use-angle=d3d11", "--ignore-gpu-blocklist"] });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1 });
page.on("pageerror", (e) => console.log("page error:", e.message));
await page.goto(`${URL}?lab=known`, { waitUntil: "networkidle0" });
await page.waitForSelector(".lab-recipe select");
await page.select(".lab-recipe select", map);
await page.evaluate(
  (vals) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    const fields = [...document.querySelectorAll(".lab-recipe input")].filter((i) => i.type !== "file");
    fields.forEach((el, i) => {
      set.call(el, vals[i]);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
  },
  [players, seed, seat, turn],
);
await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => b.textContent.includes("Play to that turn") && !b.disabled));
await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Play to that turn")).click());
await page.waitForFunction(() => { const s = window.__conquerraMap?.stats?.(); return s && s.firstMapMs > 0 && s.tilesBaked === s.tileCount; }, { timeout: 120000, polling: 100 });
if (process.env.FIT !== "0") await page.evaluate(() => window.__conquerraMap.fit(false));
await new Promise((r) => setTimeout(r, 1500));
await page.screenshot({ path: out, type: out.endsWith(".png") ? "png" : "jpeg", ...(out.endsWith(".png") ? {} : { quality: 85 }) });
console.log(await page.evaluate(() => document.querySelector(".lab-status")?.textContent));
await browser.close();
