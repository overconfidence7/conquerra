/**
 * Session 21, Step 0: does an old build get out of the offline cache? Serves two real builds the way the preview does
 * (an "old" one a browser installs first, then a "new" one going live), with a switch that acts like Cloudflare Access
 * once the login has expired (every request gets a sign-in redirect, which comes back through /cdn-cgi/access/authorized
 * and sets the login again). Three cases:
 *   1. login fine: the worker's own update check works and "Update ready" shows
 *   2. login expired: "Sign in again" shows; its link reaches the sign-in (past the offline cache) and comes back to the
 *      new build
 *   3. a newer build is live but its worker never arrives: "A new version is ready", and Reload brings it in
 * Make the two builds first (from apps/web):
 *   npx vite build --outDir <old>
 *   CONQUERRA_BUILD="0.1.1 · newer" npx vite build --outDir <new>
 * then: node apps/web/scripts/s21-stale-build.mjs <old> <new>
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join } from "node:path";
import puppeteer from "puppeteer-core";

const [OLD, NEW] = process.argv.slice(2);
if (!OLD || !NEW) throw new Error("usage: s21-stale-build.mjs <old dist> <new dist>");
const PORT = 4301;
const types = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".webp": "image/webp", ".png": "image/png", ".css": "text/css", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
let dist = OLD;
/** Where version.json comes from (case 3: the new one, while everything else is still the old build). */
let versionFrom = null;
let expired = false;
const server = createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  // Access: the sign-in is on another site and comes back through /cdn-cgi/access/authorized, which sets the cookie.
  if (u.pathname === "/cdn-cgi/access/authorized") {
    expired = false;
    res.writeHead(302, { location: u.searchParams.get("back") ?? "/" });
    return res.end();
  }
  if (expired) {
    res.writeHead(302, { location: `/cdn-cgi/access/authorized?back=${encodeURIComponent(u.pathname + u.search)}` });
    return res.end();
  }
  let f = join(u.pathname === "/version.json" && versionFrom ? versionFrom : dist, decodeURIComponent(u.pathname));
  if (!existsSync(f) || statSync(f).isDirectory()) f = join(dist, "index.html");
  const headers = { "content-type": types[extname(f)] ?? "application/octet-stream" };
  if (/sw\.js$|version\.json$/.test(f)) headers["cache-control"] = "no-store";
  res.writeHead(200, headers);
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(PORT, r));

const SITE = `http://localhost:${PORT}/`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
const p = await browser.newPage();
const state = () => p.evaluate(() => ({ version: document.querySelector(".version-line")?.textContent?.replace("Version ", "") ?? null, notice: document.querySelector(".update-prompt")?.textContent ?? null }));
/** Wait (up to 40 s) for the notice to say something matching `re`. */
const waitNotice = (re) => p.waitForFunction((src) => new RegExp(src).test(document.querySelector(".update-prompt")?.textContent ?? ""), { timeout: 40000, polling: 250 }, re.source).catch(() => {});
const log = async (label) => console.log(`  ${label.padEnd(30)} ${JSON.stringify(await state())}`);
const click = (sel) => Promise.all([p.waitForNavigation({ waitUntil: "networkidle0" }).catch(() => {}), p.click(sel)]);

let ok = true;
const expect = async (label, want) => {
  const s = await state();
  const pass = Object.entries(want).every(([k, v]) => (v instanceof RegExp ? v.test(s[k] ?? "") : s[k] === v));
  ok &&= pass;
  console.log(`  ${pass ? "✓" : "✗"} ${label.padEnd(28)} ${JSON.stringify(s)}`);
};

for (const kase of ["login fine", "login expired", "update never arrives"]) {
  console.log(`--- ${kase}`);
  dist = OLD;
  versionFrom = null;
  expired = false;
  // A browser that visited before: the old build installed in its offline cache.
  await p.goto(SITE, { waitUntil: "networkidle0" });
  await p.evaluate(async () => {
    for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    for (const k of await caches.keys()) await caches.delete(k);
  });
  await p.goto(SITE, { waitUntil: "networkidle0" });
  await p.waitForFunction(() => navigator.serviceWorker.controller, { timeout: 60000 }).catch(() => p.reload({ waitUntil: "networkidle0" }));
  await sleep(3000);
  await p.reload({ waitUntil: "networkidle0" });
  await sleep(1000);
  await log("old build, installed:");
  // The new build goes live.
  if (kase === "update never arrives") versionFrom = NEW;
  else dist = NEW;
  if (kase === "login expired") expired = true;
  await p.reload({ waitUntil: "networkidle0" }).catch(() => {});
  await waitNotice(kase === "login fine" ? /Update ready/ : kase === "login expired" ? /Sign in again/ : /new version is ready/);
  if (kase === "login fine") {
    await expect("reopened:", { notice: /^Update ready/ });
    await click(".update-prompt button.primary");
  } else if (kase === "login expired") {
    await expect("reopened:", { notice: /Sign in again/ });
    await click(".update-prompt a.button");
    await log("after Sign in:");
    // The new build came from the server; its offline copy follows in the background.
    await waitNotice(/Update ready/);
    await expect("its offline copy follows:", { notice: /^Update ready/ });
    await click(".update-prompt button.primary");
  } else {
    await expect("reopened:", { notice: /^A new version is ready/ });
    // The live build is the new one now (as it would be on the server).
    dist = NEW;
    versionFrom = null;
    await click(".update-prompt button.primary");
  }
  await sleep(2500);
  await p.reload({ waitUntil: "networkidle0" });
  await sleep(1500);
  await expect("on the new build:", { version: JSON.parse(readFileSync(join(NEW, "version.json"), "utf8")).build, notice: null });
}
await browser.close();
server.close();
console.log(ok ? "\nAll three ways out of an old build work." : "\nSomething didn't work (✗ above).");
process.exit(ok ? 0 : 1);
