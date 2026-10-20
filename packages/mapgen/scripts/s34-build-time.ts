/**
 * Session 34: how long a random 300 or 400 takes to make in one try (the try that passed, as the room and the pages
 * are told it) at version 5 (10 seats) and version 6 (20 seats): the layout search for 11 to 20 players is the extra.
 *   pnpm --filter @conquerra/mapgen exec tsx scripts/s34-build-time.ts [n=6]
 */
import { defaultRules } from "@conquerra/content";
import { randomMap, randomMapId, RandomMapFailed, seedWords, type RandomShape, type RandomSize } from "../src/index";

const n = Number(process.argv[2] ?? 6);
for (const size of [300, 400] as RandomSize[])
  for (const version of [5, 6]) {
    const times: number[] = [];
    for (let i = 0; i < n && times.length < n; i++) {
      const shape: RandomShape = (["island", "inland", "twins"] as const)[i % 3]!;
      const id = randomMapId(size, shape, seedWords(i));
      let attempt: number;
      try {
        attempt = randomMap(id, defaultRules, { version }).attempt;
      } catch (e) {
        if (e instanceof RandomMapFailed) continue;
        throw e;
      }
      const t0 = performance.now();
      randomMap(id, defaultRules, { version, attempt });
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    console.log(`${size} at version ${version}: one try ${(times[Math.floor(times.length / 2)]! / 1000).toFixed(1)} s median, ${(times.at(-1)! / 1000).toFixed(1)} s worst (${times.length} maps)`);
  }
