// Session 20's screenshot save: an Embervale game (you and 3 Marshals) played until you hold about 80% of the map with
// two or three rivals left, so the Leaders panel can show Clean up and "Finishing them off" on a real position.
// Your seat is played by a sharp stand-in (a Marshal planning with fog off). Tries seeds until one gets there.
//   pnpm --filter web exec tsx scripts/make-s20-save.ts     (writes docs/art/screens/s20-save.json)
import { writeFileSync } from "node:fs";
import { maps } from "@conquerra/content/maps";
import { makeMarshalBot } from "@conquerra/bots";
import { viewFor, type GameState } from "@conquerra/engine";
import { HUMAN_ID, LocalGame } from "../src/host/localGame";

const you = makeMarshalBot("conqueror");
for (let seed = 0; seed < 40; seed++) {
  let t = Date.UTC(2026, 9, 7, 12, 0, 0);
  const g = new LocalGame(maps.embervale!, { mapId: "embervale", bots: 3, botLevel: "marshal", luck: 0.3, fog: true, mode: "classic", turnSeconds: null, leaderName: "Aldric", stewardName: "Odo" }, `s20-shots-${seed}`, () => t);
  let u = g.update();
  for (let i = 0; i < 70 && !u.view.winner; i++) {
    const state = (g as unknown as { state: GameState }).state;
    const ctx = g.ctx;
    const held = new Map<string, number>();
    for (const tr of ctx.map.territories) {
      const o = state.territories[tr.id]!.owner;
      if (o) held.set(o, (held.get(o) ?? 0) + 1);
    }
    const share = (held.get(HUMAN_ID) ?? 0) / ctx.map.territories.length;
    const rivals = [...held.keys()].filter((p) => p !== HUMAN_ID).length;
    if (share >= 0.76 && rivals >= 2 && rivals <= 3) {
      const save = g.snapshot({ app: "session-20 screenshots" });
      writeFileSync("../../docs/art/screens/s20-save.json", JSON.stringify(save));
      console.log(`seed ${seed}: turn ${state.turn}, you hold ${(share * 100).toFixed(0)}%, ${rivals} rivals: ${[...held].filter(([p]) => p !== HUMAN_ID).map(([p, n]) => `${p} ${n}`).join(", ")}`);
      process.exit(0);
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
