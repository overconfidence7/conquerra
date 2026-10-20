/**
 * Session 34: capital layouts for 11 and up on the two official 200s (Krakenmere and Rootholm), from each map's
 * own capital spots (28 and 32), so nothing about the map changes: the map maker's capitals stage search (60 starts,
 * the paper check), then the random maps' exposure band (4.0) and their graded head start (random map version 5's
 * troops, market and culture by exposure; the harder spots for the seat rule). Writes
 * `packages/content/data/maps/big-tables.json`, which the game joins to the map when it loads it (the map files, and so
 * the map lab's fingerprints, stay exactly as the map maker makes them).
 *
 *   pnpm --filter @conquerra/mapgen exec tsx scripts/big-layouts.ts [--check]
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { defaultRules, type MapDef } from "@conquerra/content";
import { mapFiles } from "@conquerra/content/maps";
import { Rng, seedRng } from "@conquerra/engine";
import { findLayout } from "../src/capitals";
import { adjacency, allDistances, exposureOf, fairnessTable, territoryIncome } from "../src/checks";
import { markHarder, randomVersionDef } from "../src/random";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
/**
 * The most seats each map gets. Rootholm's 32 spots make every count to 20 within the band (1.3 to 3.9 times). Krakenmere's
 * 28 make 11 to 13 within it (2.1 to 2.7 times) and no more: 14 is 5.7 times, 16 is 29 times (a spot with almost no room),
 * and from 18 two capitals must stand next to each other. So Krakenmere seats 13.
 */
const BIG: Record<string, number> = { krakenmere: 13, rootholm: 20 };
const FROM = 11, STARTS = 60, BAND = 4;
const v5 = randomVersionDef(5);

const out: Record<string, { maxPlayers: number; layouts: NonNullable<MapDef["capitalLayouts"]> }> = {};
for (const [id, TO] of Object.entries(BIG)) {
  const map = mapFiles[id]!;
  const dists = allDistances(map), adj = adjacency(map);
  const tbl = fairnessTable(dists, territoryIncome(map, defaultRules));
  const layouts: NonNullable<MapDef["capitalLayouts"]> = [];
  for (let n = FROM; n <= TO; n++) {
    const rng = new Rng(seedRng(`big-${id}-${n}`));
    const paper = findLayout(rng, n, map.capitalSlots, tbl, STARTS);
    if (!paper) throw new Error(`${id} at ${n}: not enough capital spots`);
    // The paper check (every capital about as far from its nearest rival) can't hold at 12 and up with only the map's
    // own spots, so the layout is the one whose exposure is most even (the band's own measure), from the paper
    // search's layout and STARTS random ones, a spot swapped at a time; never two capitals next to each other.
    const ratioOf = (slots: readonly string[]) => {
      const e = exposureOf(slots, dists, adj, BAND).exposure;
      const gap = Math.min(...slots.flatMap((a, i) => slots.slice(i + 1).map((b) => dists.get(a)!.get(b) ?? 99)));
      return Math.max(...e) / Math.max(1e-9, Math.min(...e)) + (gap < 2 ? 100 : 0);
    };
    let best = { slots: [...paper.slots], r: ratioOf(paper.slots) };
    for (let start = 0; start <= STARTS; start++) {
      const pool = [...map.capitalSlots];
      const slots = start === 0 ? [...paper.slots] : rng.shuffle(pool).slice(0, n);
      let r = ratioOf(slots);
      for (let improved = true; improved; ) {
        improved = false;
        for (let i = 0; i < n; i++)
          for (const c of map.capitalSlots) {
            if (slots.includes(c)) continue;
            const old = slots[i]!;
            slots[i] = c;
            const t = ratioOf(slots);
            if (t < r - 1e-9) (r = t), (improved = true);
            else slots[i] = old;
          }
      }
      if (r < best.r - 1e-9) best = { slots: [...slots].sort(), r };
    }
    const e = exposureOf(best.slots, dists, adj, BAND);
    const gaps = best.slots.map((a) => Math.min(...best.slots.filter((b) => b !== a).map((b) => dists.get(a)!.get(b) ?? 99)));
    console.log(`${id} ${n}: exposure ${best.r.toFixed(2)}x ${e.fair ? "within" : "OUTSIDE"} the band of ${BAND} (the paper search's ${ratioOf(paper.slots).toFixed(2)}x); nearest rival ${Math.min(...gaps)} to ${Math.max(...gaps)} borders`);
    layouts.push({ players: n, slots: best.slots });
  }
  // The head start and the harder spots, exactly as a version 5 random map's layout gets them.
  const marked = markHarder({ ...map, capitalLayouts: layouts.map((l) => ({ ...l })) }, 0, v5.grade, v5.start);
  out[id] = { maxPlayers: TO, layouts: marked.capitalLayouts! };
}
const text = `${JSON.stringify(out, null, 1)}\n`;
if (!process.argv.includes("--check")) writeFileSync(join(root, "packages/content/data/maps/big-tables.json"), text);
console.log(`big-tables.json: ${(text.length / 1024).toFixed(1)} KB`);
