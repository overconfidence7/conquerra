/**
 * Session 28 screenshots into docs/art/screens/s28-*.jpg, two people against a local server: Nate on a desktop
 * (1440x900) and Kit on a 384 px phone.
 *  - s28-table-chat: the table screen's chat, before the start
 *  - s28-chat-desktop: the chat panel (the sidebar, a group chat)
 *  - s28-chat-popup-phone: the small pop-up when a message comes in
 *  - s28-chat-phone-list, s28-chat-phone-chat: the phone's two screens
 *  - s28-deal-offer-phone: a person's offer, with their note, on the other person's phone
 *   node apps/web/scripts/s28-shots.mjs
 * Needs `wrangler dev` on 8787 (pnpm build first; the sign-in stand-in takes each account from a dev_email cookie).
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const out = process.env.OUT ?? join(root, "docs/art/screens");
const URL = process.env.MAP_URL ?? "http://127.0.0.1:8787/";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--enable-gpu", "--use-angle=d3d11"] });
const shot = async (p, name) => {
  await sleep(900);
  await p.screenshot({ path: join(out, `${name}.jpg`), type: "jpeg", quality: 82 });
  console.log("  saved", `${name}.jpg`);
};
const click = (p, text) => p.evaluate((t) => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim().startsWith(t) || x.getAttribute("aria-label") === t); b?.click(); return !!b; }, text);
const waitText = (p, text, timeout = 20000) => p.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, text);
const type = async (p, text) => {
  await p.focus("textarea[aria-label='Your message']");
  await p.keyboard.type(text);
  await p.keyboard.press("Enter");
};

async function person(email, phone) {
  const ctx = await browser.createBrowserContext();
  await ctx.setCookie({ name: "dev_email", value: encodeURIComponent(email), domain: "127.0.0.1", path: "/" });
  const p = await ctx.newPage();
  if (phone) await p.emulate({ viewport: { width: 384, height: 832, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true }, userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36" });
  else await p.setViewport({ width: 1440, height: 900 });
  p.on("pageerror", (e) => console.log(`${email} page error:`, e.message));
  return p;
}

const nate = await person("nate@shots.test", false);
const kit = await person("kit@shots.test", true);
await nate.goto(URL, { waitUntil: "networkidle0" });
await nate.evaluate(() => fetch("/api/me", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "Nate" }) }));
const settings = { mapId: "embervale", bots: 3, botLevel: "marshal", luck: 0.3, fog: true, mode: "classic", turnSeconds: 600, house: 0 };
const { id, code } = await nate.evaluate((s) => fetch("/api/games", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ settings: s, leadersRun: true }) }).then((r) => r.json()), settings);
await nate.goto(`${URL}?game=${id}`, { waitUntil: "networkidle0" });
await waitText(nate, "Start");
await kit.goto(`${URL}?join=${code}`, { waitUntil: "networkidle0" });
await waitText(kit, "Take a seat");
await kit.evaluate(() => { const i = document.querySelector("input.name-input"); if (i) { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(i, "Kit"); i.dispatchEvent(new Event("input", { bubbles: true })); } });
await click(kit, "Take a seat");
await waitText(kit, "The table chat");
await type(kit, "Evening. Ready when you are.");
await waitText(nate, "Ready when you are");
await nate.focus("textarea[aria-label='Your message']");
await nate.keyboard.type("Two minutes, finding my reading glasses.");
await nate.keyboard.press("Enter");
await waitText(kit, "reading glasses");
await kit.evaluate(() => document.querySelector(".table-chat")?.scrollIntoView({ block: "center" }));
await shot(kit, "s28-table-chat");
await click(nate, "Start");
await nate.waitForFunction(() => window.__conquerraStore?.getState().screen === "game", { timeout: 30000 });
await kit.waitForFunction(() => window.__conquerraStore?.getState().screen === "game", { timeout: 30000 });
await sleep(2500);
// Nate offers Kit a truce, with a note.
await nate.evaluate(async () => {
  const st = window.__conquerraStore;
  st.getState().openPropose("p2", "truce");
  await new Promise((r) => setTimeout(r, 200));
  await st.getState().sendOffer({ ...st.getState().deal.offer, note: "Peace in the east while we deal with Morwen?" });
  st.getState().closeDeal();
});
await waitText(kit, "offers a truce");
await click(kit, "Nate offers a truce");
await waitText(kit, "Peace in the east");
await shot(kit, "s28-deal-offer-phone");
await click(kit, "Accept");
// Nate makes a group with Kit and writes in it: the pop-up on Kit's phone.
await click(nate, "Group…");
await waitText(nate, "Pick who's in it");
await nate.evaluate(() => [...document.querySelectorAll(".chat-tick")].find((l) => l.textContent.includes("Kit"))?.querySelector("input")?.click());
await nate.evaluate(() => { const i = document.querySelector(".chat-name-field input"); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(i, "The East"); i.dispatchEvent(new Event("input", { bubbles: true })); });
await nate.click(".chat-pick button.primary");
await nate.waitForSelector("textarea[aria-label='Your message']");
await sleep(400);
await type(nate, "Morwen has 3 troops on Saltmere. If you take Ashfell, I'll take the coast.");
await kit.waitForSelector(".chat-popup", { timeout: 15000 });
await shot(kit, "s28-chat-popup-phone");
await sleep(2100);
await type(nate, "Deal stands either way. I'll tell you when I move.");
await shot(nate, "s28-chat-desktop");
await click(kit, "Chat, 2 unread");
await waitText(kit, "The East");
await shot(kit, "s28-chat-phone-list");
await click(kit, "The East, 2 unread");
await waitText(kit, "take the coast");
await shot(kit, "s28-chat-phone-chat");
await browser.close();
