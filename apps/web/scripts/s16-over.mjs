/**
 * Session 16: the game-over screen with the power graph and the awards, on desktop and a 384 px phone. A real game:
 * your House does nothing until it's knocked out, then "See the result" lets the bots finish it.
 *   node apps/web/scripts/s16-over.mjs            -> docs/art/screens/s16-game-over*.png
 * Needs the built game running (`pnpm build`, `pnpm --filter web preview`).
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const URL = process.env.MAP_URL ?? "http://localhost:4173/";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--enable-gpu", "--use-angle=d3d11"] });
for (const phone of [false, true]) {
  const p = await browser.newPage();
  if (phone) await p.emulate({ viewport: { width: 384, height: 832, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true }, userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36" });
  else await p.setViewport({ width: 1440, height: 900 });
  p.on("pageerror", (e) => console.log("page error:", e.message));
  await p.goto(URL, { waitUntil: "networkidle0" });
  await p.evaluate(() => window.__conquerraStore.getState().setLobby({ mapId: "embervale", bots: 5, turnSeconds: null }));
  await p.evaluate(() => window.__conquerraStore.getState().start());
  await p.waitForFunction(() => window.__conquerraStore.getState().view, { timeout: 60000 });
  for (let i = 0; i < 80; i++) {
    const out = await p.evaluate(() => { const v = window.__conquerraStore.getState().view; return v.me.eliminatedTurn !== null || v.winner !== null; });
    if (out) break;
    await p.evaluate(async () => {
      const st = window.__conquerraStore;
      st.setState({ queue: [] });
      await st.getState().lockIn();
      st.getState().endReplay();
      st.getState().setShowReport(false);
    });
  }
  await p.evaluate(() => window.__conquerraStore.getState().seeResult());
  await p.waitForFunction(() => window.__conquerraStore.getState().screen === "over", { timeout: 180000, polling: 500 });
  await sleep(2500);
  const sfx = phone ? "-phone" : "";
  await p.evaluate(() => document.querySelector(".power-graph")?.scrollIntoView({ block: "start" }));
  await sleep(500);
  await p.screenshot({ path: join(root, `docs/art/screens/s16-game-over${sfx}.png`) });
  await p.evaluate(() => document.querySelector(".awards")?.scrollIntoView({ block: "start" }));
  await sleep(500);
  await p.screenshot({ path: join(root, `docs/art/screens/s16-awards${sfx}.png`) });
  console.log("saved", sfx || "desktop");
  await p.close();
}
await browser.close();
