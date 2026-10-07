/**
 * Counts the taps for a basic turn on a 384 px phone (recruit, two attacks, lock in), on the Ringsea. Then, on the
 * next turn, the taps to give your Leader an instruction after selecting its territory (Command, Push toward a place,
 * the place on the map: session 12 asks for 3 or fewer). Then diplomacy (session 14): proposing a plain truce from the
 * Players panel (4 or fewer), and accepting an offer once it's open (1). Then spies (session 15): hiring one at your
 * capital, and next turn sending it to a province (about 3: its territory, Send…, a province on the map). Then orders
 * along a path (session 16): your land, Path…, a place three steps away, Confirm (and one more for the full sweep).
 * Then leaders (session 18): every command and the budget, from your Leader's portrait (the Leaders sheet).
 *   node apps/web/scripts/tap-count.mjs [screenshot.png] [command-screenshot.png]
 * Needs the built game running (`pnpm build`, `pnpm --filter web preview`).
 */
import puppeteer from "puppeteer-core";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--enable-gpu", "--use-angle=d3d11"] });
const page = await browser.newPage();
await page.emulate({ viewport: { width: 384, height: 832, deviceScaleFactor: 2.5, isMobile: true, hasTouch: true }, userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36" });
await page.goto(process.env.MAP_URL ?? "http://localhost:4173/", { waitUntil: "networkidle0" });
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

// Next turn: give your Leader an instruction.
await page.waitForFunction(() => window.__conquerraStore.getState().replay !== null || window.__conquerraStore.getState().view.turn > 1, { timeout: 60000 });
await page.evaluate(() => window.__conquerraStore.getState().endReplay());
await page.evaluate(() => window.__conquerraStore.getState().setShowReport(false));
await sleep(800);
const leaderAt = await page.evaluate(() => window.__conquerraStore.getState().view.me.leader.territory);
// Scroll the map to it (as you would), then tap it.
await page.evaluate((id) => { const g = window.__conquerraStore.getState().ctx.map.geometry; const t = g.territories.find((x) => x.id === id); const r = window.__conquerraMap; r.centreOn(t.label.x, t.label.y + 220 / r.camera.cam.scale); }, leaderAt);
await page.evaluate(() => window.__conquerraStore.getState().clearSelection());
await sleep(900);
await page.touchscreen.tap(...(await screenOf(leaderAt)));
await sleep(600);
console.log("selected your Leader's territory (not counted):", leaderAt, JSON.stringify(await st()));
let cmd = 0;
const cmdTap = async (f, what) => { await f(); cmd++; await sleep(600); console.log(`  ${cmd} ${what}`); };
const byText = (t) => page.evaluate((t) => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.trim().startsWith(t) && x.offsetParent); if (!b) return false; b.scrollIntoView({ block: "center" }); return true; }, t);
const tapText = async (t) => { if (!(await byText(t))) throw new Error(`no button "${t}"`); const r = await page.evaluate((t) => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.trim().startsWith(t) && x.offsetParent); const q = b.getBoundingClientRect(); return [q.x + q.width / 2, q.y + q.height / 2]; }, t); await page.touchscreen.tap(r[0], r[1]); };
await page.screenshot({ path: process.argv[3]?.replace(".png", "-sel.png") ?? "sel.png" });
await cmdTap(() => tapText("Command"), "Command");
await cmdTap(() => tapText("Push toward a place"), "Push toward a place");
await sleep(600);
// A place two steps away that's on screen (the sheet folds away while you pick).
const two = await page.evaluate((from) => { const g = window.__conquerraStore.getState(); const nb = (t) => g.ctx.map.borders.flatMap((b) => (b.a === t ? [b.b] : b.b === t ? [b.a] : [])); return nb(from).flatMap(nb).filter((t) => t !== from && !nb(from).includes(t)); }, leaderAt);
let far = two[0];
for (const t of two) { const [x, y] = await screenOf(t); if (x > 20 && x < 364 && y > 140 && y < 700) { far = t; break; } }
await cmdTap(async () => page.touchscreen.tap(...(await screenOf(far))), "the place on the map");
await sleep(800);
const done = await page.evaluate(() => { const g = window.__conquerraStore.getState(); return { instructions: g.instructions, generalOrders: g.queue.filter((o) => o.general).length }; });
console.log("instruction taps:", cmd, JSON.stringify(done));
await page.screenshot({ path: process.argv[3] ?? "taps-command.png" });

// Diplomacy: propose a plain truce from the Players panel, counting every tap.
await page.evaluate(() => window.__conquerraStore.getState().clearSelection());
await sleep(500);
let deal = 0;
const dealTap = async (f, what) => { await f(); deal++; await sleep(600); console.log(`  ${deal} ${what}`); };
const rival = await page.evaluate(() => { const g = window.__conquerraStore.getState(); return g.view.players.find((p) => p.id !== g.view.me.id && p.eliminatedTurn === null).name; });
await dealTap(async () => page.tap('button[aria-label="Players"]'), "Players");
await dealTap(() => tapText(rival), `the player (${rival})`);
await dealTap(() => tapText("Propose a deal"), "Propose a deal");
await dealTap(() => tapText("Send"), "Send");
const sent = await page.evaluate(() => { const g = window.__conquerraStore.getState(); return { offer: g.diplomacy.find((o) => o.kind === "propose")?.offer.terms, answer: Object.values(g.answers)[0] }; });
console.log("propose-a-truce taps:", deal, JSON.stringify(sent));
await page.screenshot({ path: process.argv[3]?.replace(".png", "-propose.png") ?? "taps-propose.png" });
// Accepting an offer: open it from its toast (not counted), then Accept.
await page.evaluate(() => { const g = window.__conquerraStore.getState(); g.closeDeal(); const from = g.view.players.find((p) => p.id !== g.view.me.id && p.eliminatedTurn === null).id; window.__conquerraStore.setState({ offers: [{ id: "tap-test", from, to: g.view.me.id, terms: { kind: "truce", scope: { kind: "all" }, turns: 3 }, bond: "handshake", note: "Let's have peace on our border." }] }); });
await sleep(600);
await page.tap(".offer-toast");
await sleep(600);
let acc = 0;
await (async () => { await tapText("Accept"); acc++; await sleep(500); })();
const accepted = await page.evaluate(() => window.__conquerraStore.getState().diplomacy.some((o) => o.kind === "answer" && o.accept));
console.log("accept taps (once open):", acc, "accepted:", accepted);

// Spies: hire one at your capital (its territory, Spend, Spy), lock in; next turn send it (its territory, Send…, a province).
await page.evaluate(() => { const g = window.__conquerraStore.getState(); g.closeDeal(); window.__conquerraStore.setState({ offers: [] }); g.clearSelection(); document.querySelector('button[aria-label="Players"][aria-pressed="true"]')?.click(); });
await sleep(500);
const cap = await page.evaluate(() => window.__conquerraStore.getState().view.me.capital);
await page.evaluate((id) => { const g = window.__conquerraStore.getState().ctx.map.geometry; const t = g.territories.find((x) => x.id === id); const r = window.__conquerraMap; r.centreOn(t.label.x, t.label.y + 220 / r.camera.cam.scale); }, cap);
await sleep(900);
let hire = 0;
const hireTap = async (f, what) => { await f(); hire++; await sleep(600); console.log(`  ${hire} ${what}`); };
await hireTap(async () => page.touchscreen.tap(...(await screenOf(cap))), "your capital");
await hireTap(() => tapText("Spend"), "Spend");
await hireTap(() => tapText("🕵 Spy"), "Spy");
const hired = await page.evaluate(() => window.__conquerraStore.getState().queue.some((o) => o.kind === "hireSpy"));
console.log("hire-a-spy taps:", hire, "queued:", hired);
await page.evaluate(() => window.__conquerraStore.getState().clearSelection());
await page.evaluate(() => window.__conquerraStore.getState().lockIn());
await page.waitForFunction(() => window.__conquerraStore.getState().view.spies.length > 0, { timeout: 60000 });
await page.evaluate(() => { const g = window.__conquerraStore.getState(); g.endReplay(); g.setShowReport(false); g.clearSelection(); });
await sleep(800);
const spyAt = await page.evaluate(() => window.__conquerraStore.getState().view.spies[0].at);
await page.evaluate((id) => { const g = window.__conquerraStore.getState().ctx.map.geometry; const t = g.territories.find((x) => x.id === id); const r = window.__conquerraMap; r.centreOn(t.label.x, t.label.y + 220 / r.camera.cam.scale); }, spyAt);
await sleep(900);
let send = 0;
const sendTap = async (f, what) => { await f(); send++; await sleep(600); console.log(`  ${send} ${what}`); };
await sendTap(async () => page.touchscreen.tap(...(await screenOf(spyAt))), "your spy's territory");
await sendTap(() => tapText("Send…"), "Send…");
// A territory in another province that's on screen (the sheet folds away while you pick).
const dest = await page.evaluate(async (from) => {
  const g = window.__conquerraStore.getState(); const r = window.__conquerraMap; const c = r.camera.cam;
  const prov = (t) => g.ctx.map.territories.find((x) => x.id === t).province;
  return g.ctx.map.geometry.territories.filter((t) => prov(t.id) !== prov(from)).map((t) => ({ id: t.id, x: t.label.x * c.scale + c.x, y: t.label.y * c.scale + c.y })).find((t) => t.x > 70 && t.x < 354 && t.y > 160 && t.y < 600);
}, spyAt);
await sendTap(async () => page.touchscreen.tap(dest.x, dest.y), `a province on the map (${dest.id})`);
const sentSpy = await page.evaluate(() => window.__conquerraStore.getState().queue.find((o) => o.kind === "spy"));
console.log("send-a-spy taps:", send, JSON.stringify(sentSpy));
await page.screenshot({ path: process.argv[3]?.replace(".png", "-spy.png") ?? "taps-spy.png" });

// Orders along a path (session 16): from your capital to a place three steps away, the shortest way, then the full sweep.
for (const kind of ["shortest", "sweep"]) {
  await page.evaluate(() => { const g = window.__conquerraStore.getState(); g.clearSelection(); window.__conquerraStore.setState({ queue: [] }); });
  const capNow = await page.evaluate(() => window.__conquerraStore.getState().view.me.capital);
  await page.evaluate((id) => { const g = window.__conquerraStore.getState().ctx.map.geometry; const t = g.territories.find((x) => x.id === id); const r = window.__conquerraMap; r.centreOn(t.label.x, t.label.y + 160 / r.camera.cam.scale); }, capNow);
  await sleep(900);
  let pathTaps = 0;
  const pathTap = async (f, what) => { await f(); pathTaps++; await sleep(600); console.log(`  ${pathTaps} ${what}`); };
  await pathTap(async () => page.touchscreen.tap(...(await screenOf(capNow))), "your capital");
  await pathTap(() => tapText("Path…"), "Path…");
  const three = await page.evaluate((from) => {
    const g = window.__conquerraStore.getState(); const r = window.__conquerraMap; const c = r.camera.cam;
    const nb = (t) => g.ctx.map.borders.flatMap((b) => (b.a === t ? [b.b] : b.b === t ? [b.a] : []));
    const d = new Map([[from, 0]]); const q = [from];
    while (q.length) { const t = q.shift(); for (const n of nb(t)) if (!d.has(n)) (d.set(n, d.get(t) + 1), q.push(n)); }
    return [...d].filter(([, k]) => k === 3).map(([id]) => { const t = g.ctx.map.geometry.territories.find((x) => x.id === id); return { id, x: t.label.x * c.scale + c.x, y: t.label.y * c.scale + c.y }; }).find((t) => t.x > 70 && t.x < 354 && t.y > 140 && t.y < 700);
  }, capNow);
  await pathTap(async () => page.touchscreen.tap(three.x, three.y), `the place (${three.id})`);
  if (kind === "sweep") await pathTap(() => tapText("Full sweep"), "Full sweep");
  const box = await page.evaluate(() => document.querySelector(".path-summary, .path-panel .warn")?.textContent);
  await page.screenshot({ path: process.argv[3]?.replace(".png", `-path-${kind}.png`) ?? `taps-path-${kind}.png` });
  await pathTap(() => tapText("Confirm"), "Confirm");
  const added = await page.evaluate(() => window.__conquerraStore.getState().queue.filter((o) => o.kind === "move").length);
  console.log(`path (${kind}) taps:`, pathTaps, JSON.stringify({ box, ordersAdded: added }));
}
// Leaders (session 18): every command, from your Leader's portrait (it opens the Leaders sheet with your Leader open).
const leaderTaps = {};
const openLeaders = async (steward) => {
  await page.evaluate(() => { const g = window.__conquerraStore.getState(); g.clearSelection(); g.openLeader(null); window.__conquerraStore.setState({ queue: [], instructions: {}, budgets: {} }); });
  await sleep(500);
  // Start from the map with the sheet closed (as after any other move).
  if (await page.evaluate(() => !!document.querySelector(".leader-list")?.offsetParent)) (await page.tap('button[aria-label="Leaders"]'), await sleep(500));
  await page.evaluate(() => window.__conquerraStore.getState().openLeader(null));
  let n = 0;
  const t = async (f, what) => { await f(); n++; await sleep(600); console.log(`  ${n} ${what}`); };
  await t(async () => page.tap('button[aria-label="Leaders"]'), "your Leader's portrait");
  if (steward) await t(async () => { const r = await page.evaluate(() => { const b = document.querySelectorAll(".leader-row .leader-head")[1]; b.scrollIntoView({ block: "center" }); const q = b.getBoundingClientRect(); return [q.x + q.width / 2, q.y + q.height / 2]; }); await page.touchscreen.tap(r[0], r[1]); }, "your Steward");
  return { t, count: () => n };
};
const onScreen = async (from, steps) => page.evaluate(({ from, steps }) => {
  const g = window.__conquerraStore.getState(); const r = window.__conquerraMap; const c = r.camera.cam;
  const nb = (t) => g.ctx.map.borders.flatMap((b) => (b.a === t ? [b.b] : b.b === t ? [b.a] : []));
  const d = new Map([[from, 0]]); const q = [from];
  while (q.length) { const t = q.shift(); for (const n of nb(t)) if (!d.has(n)) (d.set(n, d.get(t) + 1), q.push(n)); }
  return [...d].filter(([, k]) => k === steps).map(([id]) => { const t = g.ctx.map.geometry.territories.find((x) => x.id === id); return { id, x: t.label.x * c.scale + c.x, y: t.label.y * c.scale + c.y }; }).find((t) => t.x > 70 && t.x < 354 && t.y > 140 && t.y < 700);
}, { from, steps });
const commandTaps = async (name, steward, then) => {
  const { t, count } = await openLeaders(steward);
  await t(() => tapText("Command"), "Command");
  await t(() => tapText(name), name);
  if (then) await then(t);
  await sleep(800);
  const got = await page.evaluate(() => window.__conquerraStore.getState().instructions);
  leaderTaps[name] = count();
  console.log(`${name} taps:`, count(), JSON.stringify(got));
};
const capNow2 = await page.evaluate(() => window.__conquerraStore.getState().view.me.capital);
await page.evaluate((id) => { const g = window.__conquerraStore.getState().ctx.map.geometry; const t = g.territories.find((x) => x.id === id); const r = window.__conquerraMap; r.centreOn(t.label.x, t.label.y); }, capNow2);
await sleep(900);
await commandTaps("Expand our empire in this direction", false, async (t) => { const x = await onScreen(capNow2, 3); await t(() => page.touchscreen.tap(x.x, x.y), `a territory on the map (${x.id})`); });
await page.screenshot({ path: process.argv[3]?.replace(".png", "-expand.png") ?? "taps-expand.png" });
await commandTaps("Command this front", false, async (t) => { const x = await onScreen(capNow2, 1); await t(() => page.touchscreen.tap(x.x, x.y), `a province on the map (${x.id})`); await t(() => tapText("Confirm"), "Confirm"); });
await commandTaps("Run the military", false);
await commandTaps("Hold here", false);
await commandTaps("Raid a rival", false, async (t) => { await t(() => page.evaluate(() => document.querySelector(".rival-chip")?.click()), "a rival"); });
await commandTaps("Run the realm", true);
await commandTaps("Grow the economy", true);
await commandTaps("Build up this province", true, async (t) => { const x = await onScreen(capNow2, 0) ?? await onScreen(capNow2, 1); await t(() => page.touchscreen.tap(x.x, x.y), `a province on the map (${x.id})`); });
await commandTaps("Fortify this frontier", true, async (t) => { await t(() => tapText("Wherever most threatened"), "Wherever most threatened"); });
await commandTaps("Raise culture here", true, async (t) => { const x = await onScreen(capNow2, 1); await t(() => page.touchscreen.tap(x.x, x.y), `a province on the map (${x.id})`); });
// A budget: your Leader's portrait, Budget, 30%.
{
  const { t, count } = await openLeaders(false);
  await t(() => tapText("Budget"), "Budget");
  await t(() => tapText("30%"), "30%");
  const b = await page.evaluate(() => window.__conquerraStore.getState().budgets);
  leaderTaps["Budget (your Leader, 30%)"] = count();
  console.log("budget taps:", count(), JSON.stringify(b));
}
{
  const { t, count } = await openLeaders(true);
  await t(() => tapText("Budget"), "Budget");
  await t(() => tapText("30%"), "30%");
  leaderTaps["Budget (your Steward, 30%)"] = count();
  console.log("steward budget taps:", count());
}
console.log("LEADER TAPS", JSON.stringify(leaderTaps));
await browser.close();
