/**
 * Session 19: what each capital spot of a layout has around it: land closer to it than to any other capital (its
 * "share"), neutral land within 2 and 3 steps, how many rival capitals within 4 steps, its nearest rival, and how
 * many borders it has. To compare with the spots' win rates (s19-spots.ts).
 *   npx tsx apps/sim/scripts/s19-spot-geo.ts <map:players>
 */
import { maps } from "@conquerra/content/maps";
import { distancesFrom, indexMap } from "@conquerra/engine";
const [table = "embervale:4"] = process.argv.slice(2);
const [id, n] = table.split(":") as [string, string];
const map = maps[id]!;
const idx = indexMap(map);
const caps = map.capitalLayouts!.find((l) => l.players === Number(n))!.slots;
const d = new Map(caps.map((c) => [c, distancesFrom(idx, c)]));
const share = new Map(caps.map((c) => [c, 0]));
for (const t of idx.ids) {
  const ds = caps.map((c) => d.get(c)!.get(t) ?? 99);
  const m = Math.min(...ds);
  const who = caps.filter((_, i) => ds[i] === m);
  for (const c of who) share.set(c, share.get(c)! + 1 / who.length);
}
const name = (t: string) => map.territories.find((x) => x.id === t)!.name;
for (const c of caps) {
  const dc = d.get(c)!;
  const within = (k: number) => idx.ids.filter((t) => (dc.get(t) ?? 99) <= k).length - 1;
  const rivals = caps.filter((o) => o !== c).map((o) => dc.get(o) ?? 99);
  console.log(`${name(c).padEnd(14)} share ${share.get(c)!.toFixed(1).padStart(5)} | within 2: ${within(2)}, 3: ${within(3)} | rivals within 4: ${rivals.filter((x) => x <= 4).length}, nearest ${Math.min(...rivals)} | borders ${idx.neighbors.get(c)!.length}`);
}
