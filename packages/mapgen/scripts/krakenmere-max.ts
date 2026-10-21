/**
 * Session 34b: how many seats Krakenmere's 28 castle spots allow with a looser exposure band. For each count, the
 * layout whose exposure is most even (big-layouts.ts's search, more starts), never two capitals side by side.
 *   pnpm --filter @conquerra/mapgen exec tsx scripts/krakenmere-max.ts [from=13] [to=20] [starts=300]
 */
import { defaultRules } from "@conquerra/content";
import { mapFiles } from "@conquerra/content/maps";
import { Rng, seedRng } from "@conquerra/engine";
import { findLayout } from "../src/capitals";
import { adjacency, allDistances, exposureOf, fairnessTable, territoryIncome } from "../src/checks";

const [from = "13", to = "20", startsArg = "300", id = "krakenmere"] = process.argv.slice(2);
const map = mapFiles[id]!;
const dists = allDistances(map), adj = adjacency(map);
const tbl = fairnessTable(dists, territoryIncome(map, defaultRules));
const gapOf = (slots: readonly string[]) => Math.min(...slots.flatMap((a, i) => slots.slice(i + 1).map((b) => dists.get(a)!.get(b) ?? 99)));
const ratioOf = (slots: readonly string[]) => {
  const e = exposureOf(slots, dists, adj).exposure;
  return Math.max(...e) / Math.max(1e-9, Math.min(...e)) + (gapOf(slots) < 2 ? 100 : 0);
};
for (let n = Number(from); n <= Number(to); n++) {
  const rng = new Rng(seedRng(`kmax-${id}-${n}`));
  const paper = findLayout(rng, n, map.capitalSlots, tbl, 60)!;
  let best = { slots: [...paper.slots], r: ratioOf(paper.slots) };
  for (let start = 0; start <= Number(startsArg); start++) {
    const slots = start === 0 ? [...paper.slots] : rng.shuffle([...map.capitalSlots]).slice(0, n);
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
  const e = exposureOf(best.slots, dists, adj);
  console.log(`${id} ${n}: most even exposure ${best.r >= 100 ? `${(best.r - 100).toFixed(2)}x with two capitals side by side` : `${best.r.toFixed(2)}x`}, nearest rival ${gapOf(best.slots)}, room ${Math.min(...e.room)} to ${Math.max(...e.room)} | ${JSON.stringify(best.slots)}`);
}
