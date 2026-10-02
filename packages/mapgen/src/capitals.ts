import type { Rng } from "@conquerra/engine";
import { fairnessOf, type Fairness, type FairnessTable } from "./checks";

/**
 * Find a fair capital layout for `n` players among the candidate territories: several random starts, each spread
 * out greedily (the next capital as far as possible from the others), then improved by swapping one capital at
 * a time. The best-scoring fair layout wins.
 */
export function findLayout(rng: Rng, n: number, candidateIds: readonly string[], tbl: FairnessTable): { slots: string[]; fairness: Fairness } | null {
  const T = tbl.ids.length;
  const candidates = candidateIds.map((id) => tbl.ids.indexOf(id));
  if (candidates.length < n) return null;
  let best: { slots: number[]; fairness: Fairness } | null = null;
  for (let start = 0; start < 20; start++) {
    const slots = [candidates[rng.int(candidates.length)]!];
    while (slots.length < n) {
      let pick = -1, far = -1;
      for (const c of candidates) {
        if (slots.includes(c)) continue;
        let m = 99;
        for (const s of slots) m = Math.min(m, tbl.dist[s * T + c]!);
        if (m > far || (m === far && rng.next() < 0.35)) (far = m), (pick = c);
      }
      slots.push(pick);
    }
    // Once capitals are spread out about as far as this start managed, even income matters more than extra distance.
    const gapGoal = Math.max(2, Math.min(...fairnessOf(slots, tbl).nearest) - 1);
    const score = (f: Fairness) => (f.fair ? 1000 : 0) + Math.min(gapGoal, Math.min(...f.nearest)) * 100 + f.score * 0.01 + (f.income.length ? (Math.min(...f.income) / Math.max(1e-9, Math.max(...f.income))) * 80 : 0) - (Math.max(...f.nearest) - Math.min(...f.nearest)) * 40;
    let f = fairnessOf(slots, tbl);
    for (let pass = 0; pass < 3; pass++) {
      let improved = false;
      for (let i = 0; i < n; i++)
        for (const c of candidates) {
          if (slots.includes(c)) continue;
          const old = slots[i]!;
          slots[i] = c;
          const tf = fairnessOf(slots, tbl);
          if (score(tf) > score(f)) (f = tf), (improved = true);
          else slots[i] = old;
        }
      if (!improved) break;
    }
    const better = !best || (f.fair && !best.fairness.fair) || (f.fair === best.fairness.fair && f.score > best.fairness.score);
    if (better) best = { slots: [...slots], fairness: f };
  }
  return best && { slots: best.slots.map((i) => tbl.ids[i]!).sort(), fairness: best.fairness };
}
