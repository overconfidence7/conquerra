// Session 20c's screenshot saves: Wyrmland games (you and 5 Marshals for the first, 5 Captains for the second) where your Leader is Aldric, the Conqueror,
// and your Steward Odo, the Turtle. Your seat is played by a sharp stand-in (a Marshal planning with fog off).
//  - docs/art/screens/s20c-home.json: the first turn from 12 where a rival army you can see could get behind your
//    front (your Leader on Run the military then writes a sweep of your own land);
//  - docs/art/screens/s20c-save.json: once you hold about 76% of the map with two or three rivals left (finishing).
//   pnpm --filter web exec tsx scripts/make-s20c-save.ts
import { writeFileSync } from "node:fs";
import { maps } from "@conquerra/content/maps";
import { makeMarshalBot } from "@conquerra/bots";
import { readBoard } from "../../../packages/bots/src/board";
import { planHomeSweep } from "../../../packages/bots/src/marshal/home";
import { viewFor, type GameState } from "@conquerra/engine";
import { HUMAN_ID, LocalGame } from "../src/host/localGame";

const you = makeMarshalBot("conqueror");
const want = process.argv[2] ?? "both";
let homeDone = want === "finish", finishDone = want === "home";
for (let seed = 0; seed < 60 && !(homeDone && finishDone); seed++) {
  let t = Date.UTC(2026, 9, 8, 12, 0, 0);
  const g = new LocalGame(
    maps.wyrmland!,
    { mapId: "wyrmland", bots: 5, botLevel: homeDone ? "captain" : "marshal", luck: 0.3, fog: true, mode: "classic", turnSeconds: null, leaderName: "Aldric", stewardName: "Odo", leaderPersonality: "conqueror", stewardPersonality: "turtle" },
    `s20c-shots-${seed}`,
    () => t,
  );
  let u = g.update();
  let home = homeDone;
  for (let i = 0; i < 70 && !u.view.winner; i++) {
    const state = (g as unknown as { state: GameState }).state;
    const ctx = g.ctx;
    if (!home && state.turn >= 12) {
      const b = readBoard(ctx, u.view, { chainMargin: 1.25 });
      if (!b) break;
      const free = new Map(b.mine.map((x) => [x, Math.max(0, b.troopsAt(x) - 1)]));
      const h = planHomeSweep(b, free, () => "x", { troops: 3, reach: 8, atPeace: () => false });
      if (h.orders.length >= 3) {
        writeFileSync("../../docs/art/screens/s20c-home.json", JSON.stringify(g.snapshot({ app: "session-20c screenshots" })));
        console.log(`seed ${seed}: home sweep at turn ${state.turn}: ${h.exposed.join(", ")}`);
        home = homeDone = true;
      }
    }
    const held = new Map<string, number>();
    for (const tr of ctx.map.territories) {
      const o = state.territories[tr.id]!.owner;
      if (o) held.set(o, (held.get(o) ?? 0) + 1);
    }
    const share = (held.get(HUMAN_ID) ?? 0) / ctx.map.territories.length;
    const rivals = [...held.keys()].filter((p) => p !== HUMAN_ID).length;
    if (!finishDone && share >= 0.76 && rivals >= 2 && rivals <= 3) {
      writeFileSync("../../docs/art/screens/s20c-save.json", JSON.stringify(g.snapshot({ app: "session-20c screenshots" })));
      console.log(`seed ${seed}: turn ${state.turn}, you hold ${(share * 100).toFixed(0)}%, ${rivals} rivals: ${[...held].filter(([p]) => p !== HUMAN_ID).map(([p, n]) => `${p} ${n}`).join(", ")}`);
      finishDone = true;
      break;
    }
    const sighted = viewFor(ctx, { ...state, settings: { ...state.settings, fog: false } }, HUMAN_ID);
    try {
      u = g.lockIn(you.plan(ctx, sighted));
    } catch {
      break;
    }
    t += 60_000;
  }
  console.log(`seed ${seed}: no`);
}
