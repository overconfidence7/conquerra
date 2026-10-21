/** Session 34b: one try of a random map at a version, timed (the room and the pages are told the try that passed). */
import { defaultRules } from "@conquerra/content";
import { randomMap } from "../src/index";
const [id = "400-island-quiet-heron", ...versions] = process.argv.slice(2);
for (const v of versions.length ? versions : ["6", "7"]) {
  const first = randomMap(id, defaultRules, { version: Number(v) });
  const t0 = performance.now();
  randomMap(id, defaultRules, { version: Number(v), attempt: first.attempt });
  console.log(`${id} version ${v}: try ${first.attempt}, ${((performance.now() - t0) / 1000).toFixed(1)} s for that one try, ${first.map.capitalLayouts!.length} layouts`);
}
