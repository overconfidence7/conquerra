// Makes the saved-game fixture (session 13): a real save, in the format of the day, that later sessions must keep
// loading. Run once: pnpm --filter web exec tsx scripts/make-save-fixture.ts
import { writeFileSync } from "node:fs";
import { maps } from "@conquerra/content/maps";
import { recruitBot } from "@conquerra/bots";
import { LocalGame } from "../src/host/localGame";

let t = Date.UTC(2026, 9, 6, 12, 0, 0);
const g = new LocalGame(maps.embervale!, { mapId: "embervale", bots: 3, botLevel: "captain", luck: 0.3, fog: true, mode: "classic", turnSeconds: 300 }, "fixture-session-13", () => t);
let u = g.update();
for (let i = 0; i < 4; i++) {
  u = g.lockIn(recruitBot.plan(g.ctx, u.view));
  t += 120_000;
}
const save = g.snapshot({ app: "session-13 fixture" });
writeFileSync("../../packages/engine/test/fixtures/save-v2-session13.json", JSON.stringify(save));
console.log(`turn ${save.state.turn}, state v${save.state.version}, ${JSON.stringify(save).length} bytes`);
