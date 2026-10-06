// The session 14 save fixture: a real save from the end of session 14 (game state version 5, with deals), made by
// session 14's own code. Later sessions must keep loading it.
import { writeFileSync } from "node:fs";
import { maps } from "@conquerra/content/maps";
import { recruitBot } from "@conquerra/bots";
import { LocalGame } from "../src/host/localGame";

let t = Date.UTC(2026, 9, 6, 18, 0, 0);
const g = new LocalGame(maps.embervale!, { mapId: "embervale", bots: 3, botLevel: "captain", luck: 0.3, fog: true, mode: "classic", turnSeconds: 300 }, "fixture-session-14", () => t);
let u = g.update();
for (let i = 0; i < 8; i++) {
  u = g.lockIn(recruitBot.plan(g.ctx, u.view));
  t += 120_000;
}
const save = g.snapshot({ app: "session-14 fixture" });
writeFileSync(process.argv[2]!, JSON.stringify(save));
console.log(`turn ${save.state.turn}, state v${save.state.version}, deals ${save.state.deals.length}, record ${save.state.record.length}, ${JSON.stringify(save).length} bytes`);
