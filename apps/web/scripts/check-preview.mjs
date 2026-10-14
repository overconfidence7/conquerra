/**
 * Checks the private preview is locked: a request with no login must get Cloudflare Access's sign-in, never the
 * game. Runs at the end of `pnpm deploy:preview`, and on its own with `pnpm check:preview`.
 */
const SITE = process.env.PREVIEW_URL ?? "https://conquerra.overconfidenceonline.com/";
// "?lab=maps" and "?lab=bench": the map lab and the art test bench are on the preview only, behind the same sign-in.
// Session 26: the online API and a game's WebSocket too (the Worker checks the sign-in itself as well, but Access
// must stop them first).
const paths = ["", "index.html", "manifest.webmanifest", "sw.js", "art/manifest.json", "?lab=maps", "?lab=bench", "?game=abcdefghijkm", "api/me", "api/games", "api/games/abcdefghijkm/ws"];
let ok = true;
for (const p of paths) {
  const url = new URL(p, SITE).toString();
  let res;
  try {
    res = await fetch(url, { redirect: "manual", headers: { "user-agent": "conquerra-preview-check" } });
  } catch (e) {
    console.log(`?  ${url}: couldn't connect (${e.cause?.code ?? e.message}). Is the domain live yet?`);
    ok = false;
    continue;
  }
  const loc = res.headers.get("location") ?? "";
  // Access answers a request with no login by redirecting to its sign-in page (or 401/403 for some requests).
  const locked = ([301, 302, 303, 307].includes(res.status) && loc.includes("cloudflareaccess.com")) || res.status === 401 || res.status === 403;
  const body = res.status === 200 ? await res.text() : "";
  if (locked) console.log(`✓  ${url}: locked (${res.status}${loc ? ` → ${new URL(loc).host}` : ""})`);
  else {
    ok = false;
    console.log(`✗  ${url}: NOT locked (${res.status})${body.includes("Conquerra") ? " and it served the game!" : ""}`);
  }
}
// A real WebSocket to a game, with no sign-in: it must never open.
const wsUrl = new URL("api/games/abcdefghijkm/ws", SITE).toString().replace(/^http/, "ws");
const opened = await new Promise((resolve) => {
  let ws;
  try {
    ws = new WebSocket(wsUrl);
  } catch {
    return resolve(false);
  }
  const done = (v) => (clearTimeout(timer), resolve(v));
  const timer = setTimeout(() => (ws.close(), done(false)), 10_000);
  ws.onopen = () => (ws.close(), done(true));
  ws.onerror = () => done(false);
});
if (opened) {
  ok = false;
  console.log(`✗  ${wsUrl}: a WebSocket OPENED with no sign-in!`);
} else console.log(`✓  ${wsUrl}: locked (no WebSocket without signing in)`);
if (!ok) {
  console.log("\nThe preview is not locked behind Access. Check the Access application (README, 'The private preview').");
  process.exit(1);
}
console.log("\nThe preview is locked: only people allowed by the Access policy can open it.");
