// Session 29: check "your turn" pushes against a real push service, end to end, with no game and no sign-in.
//
//   npx tsx apps/web/scripts/push-check.ts
//
// A Chrome window (a fresh, throwaway profile, notifications allowed; it closes itself after a few seconds: headless
// Chrome has no real push connection, and Google answers its subscriptions 410) subscribes with a throwaway VAPID key; the room's own code
// (server/webPush.ts) signs and encrypts a message and sends it to the push service Chrome chose (Google's); Chrome's
// service worker receives it and decrypts it. Prints what arrived. The real VAPID private key is never involved.
import { createServer } from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import puppeteer from "puppeteer-core";
import { b64u, pushRequest, type Vapid } from "../server/webPush";

const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PAGE = `<!doctype html><meta charset="utf-8"><title>push check</title><script>
window.got = null;
navigator.serviceWorker.addEventListener("message", (e) => (window.got = e.data));
window.subscribe = async (key) => {
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const raw = atob(key.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((key.length + 3) % 4));
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(raw, (c) => c.charCodeAt(0)) });
  return sub.toJSON();
};
</script>`;
const SW = `self.addEventListener("push", (e) => e.waitUntil((async () => {
  const text = e.data ? e.data.text() : "";
  for (const c of await self.clients.matchAll({ includeUncontrolled: true })) c.postMessage(text);
  await self.registration.showNotification("check", { body: text });
})()));
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));`;

const server = createServer((req, res) => {
  if (req.url === "/sw.js") return res.writeHead(200, { "content-type": "text/javascript" }).end(SW);
  res.writeHead(200, { "content-type": "text/html" }).end(PAGE);
}).listen(4999);

const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
const vapid: Vapid = { publicKey: b64u(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey))), privateKey: (await crypto.subtle.exportKey("jwk", pair.privateKey)).d!, subject: "mailto:conquerra@overconfidenceonline.com" };

const browser = await puppeteer.launch({ executablePath: CHROME, headless: false, userDataDir: mkdtempSync(join(tmpdir(), "push-check-")) });
try {
  await browser.defaultBrowserContext().overridePermissions("http://localhost:4999", ["notifications"]);
  const page = await browser.newPage();
  await page.goto("http://localhost:4999/");
  const sub = (await page.evaluate((k) => (window as unknown as { subscribe(k: string): Promise<unknown> }).subscribe(k), vapid.publicKey)) as { endpoint: string; keys: { p256dh: string; auth: string } };
  console.log(`subscribed at ${new URL(sub.endpoint).hostname}`);
  const message = JSON.stringify({ title: "Your turn in Conquerra", body: "Embervale, turn 12", url: "/?game=check", tag: "turn-check" });
  const res = await fetch(await pushRequest({ endpoint: sub.endpoint, ...sub.keys }, message, vapid, Math.floor(Date.now() / 1000), 60, "turn-check"));
  console.log(`the push service answered ${res.status} ${res.statusText}`);
  let got: unknown = null;
  for (let i = 0; i < 40 && !got; i++) {
    await new Promise((r) => setTimeout(r, 500));
    got = await page.evaluate(() => (window as unknown as { got: unknown }).got);
  }
  console.log(got ? `Chrome received and decrypted: ${got}` : "Nothing arrived in 20 s.");
  process.exitCode = got === message ? 0 : 1;
} finally {
  await browser.close();
  server.close();
}
