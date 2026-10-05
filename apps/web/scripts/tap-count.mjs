/**
 * Counts the taps for a basic turn on a 384 px phone (recruit, two attacks, lock in), on the Ringsea.
 *   node apps/web/scripts/tap-count.mjs [screenshot.png]
 * Needs the built game running (`pnpm build`, `pnpm --filter web preview`).
 */
import puppeteer from "puppeteer-core";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--enable-gpu", "--use-angle=d3d11"] });
const page = await browser.newPage();
await page.emulate({ viewport: { width: 384, height: 832, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true }, userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36" });
await page.goto("http://localhost:4173/", { waitUntil: "networkidle0" });
await page.evaluate(() => window.__conquerraStore.getState().setLobby({ mapId: "ringsea", bots: 5 }));
await page.evaluate(() => [...document.querySelectorAll("button")].find((x) => x.textContent?.trim() === "Start").click());
await page.waitForFunction(() => { const s = window.__conquerraMap?.stats?.(); return s && s.firstMapMs > 0; }, { timeout: 120000 });
await sleep(1500);
const st = () => page.evaluate(() => { const g = window.__conquerraStore.getState(); return { q: g.queue.map((o) => o.kind + (o.from ? `:${o.from}>${o.to}` : "")), sel: g.selected, draft: !!g.draft, phase: g.replay ? "replay" : "plan" }; });
const screenOf = (id) => page.evaluate((id) => { const r = window.__conquerraMap; const g = window.__conquerraStore.getState().ctx.map.geometry; const t = g.territories.find((x) => x.id === id); const c = r.camera.cam; return [t.label.x * c.scale + c.x, t.label.y * c.scale + c.y]; }, id);
let taps = 0;
const tapAt = async ([x, y], what) => { await page.touchscreen.tap(x, y); taps++; await sleep(500); console.log(taps, what, JSON.stringify(await st())); };
const tapBtn = async (sel, what) => { await page.tap(sel); taps++; await sleep(500); console.log(taps, what, JSON.stringify(await st())); };
const info = await page.evaluate(() => { const g = window.__conquerraStore.getState(); const cap = g.view.me.capital; const nb = g.ctx.map.borders.flatMap((b) => (b.a === cap ? [b.b] : b.b === cap ? [b.a] : [])); return { cap, nb }; });
await tapBtn('.phonebar button[aria-label^="Recruit"]', "Recruit");
await tapAt(await screenOf(info.nb[0]), "neighbour 1 (draft)");
await tapBtn(".sheet button.primary.wide, .panel button.primary.wide", "add attack 1");
await tapAt(await screenOf(info.nb[1]), "neighbour 2 (draft)");
await tapBtn(".sheet button.primary.wide, .panel button.primary.wide", "add attack 2");
await tapBtn(".phonebar .seal", "Lock in");
console.log("taps:", taps, "screen width", await page.evaluate(() => innerWidth));
await page.screenshot({ path: process.argv[2] ?? "taps.png" });
await browser.close();
