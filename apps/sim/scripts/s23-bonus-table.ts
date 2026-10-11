/**
 * Session 23: the start-bonus table for docs/sim-results-m3-balance.md, from the runs in docs/sims/s23-bonus-*.txt.
 *   npx tsx apps/sim/scripts/s23-bonus-table.ts
 * One row per map and table size, in the order they were sized; one line per weak spot: its win rate before, the
 * bonus chosen and its win rate with it (all chosen bonuses together, the "check" run).
 */
import { readdirSync, readFileSync } from "node:fs";
import { maps } from "@conquerra/content/maps";

const ORDER = ["embervale:4", "embervale:6", "wyrmland:6", "wyrmland:8", "rootholm:8", "rootholm:10", "shattered-isles:4", "shattered-isles:6", "moon-coast:4", "moon-coast:8", "crownlands:6", "crownlands:10", "sundered-crowns:6", "sundered-crowns:8", "krakenmere:8", "krakenmere:10", "ashwing:6", "ashwing:8", "ringsea:6", "ringsea:10", "greatmarch:8", "greatmarch:10", "twin-realms:4", "twin-realms:8"];
const files = new Map(readdirSync("docs/sims").filter((f) => /^s23-bonus-[a-z-]+\d+\.txt$/.test(f)).map((f) => [f, readFileSync(`docs/sims/${f}`, "utf8")]));
const rate = (line: string, name: string) => new RegExp(`${name}(?: \\(\\+\\d\\))? ([\\d.]+)%`).exec(line)?.[1];
console.log("| Map and table | Fair | Weak spot | Before | Bonus | With the bonus | Reaches half of fair? |");
console.log("|---|---|---|---|---|---|---|");
for (const t of ORDER) {
  const [id, n] = t.split(":") as [string, string];
  const text = files.get(`s23-bonus-${id}${n}.txt`);
  const name = maps[id]!.name;
  const fair = 100 / Number(n);
  if (!text || !/^recipe /m.test(text)) {
    console.log(`| ${name} ${n} | ${fair.toFixed(1)}% | not reached (session 23b) | | | | |`);
    continue;
  }
  const chooses = [...text.matchAll(/^choose \S+ (.+?) \((t\d+)\): before ([\d.]+)%, \+(\d) -> ([\d.]+)%$/gm)];
  const check = /^check .*$/m.exec(text)?.[0] ?? "";
  if (!chooses.length) {
    console.log(`| ${name} ${n} | ${fair.toFixed(1)}% | none under half of fair | | | | |`);
    continue;
  }
  for (const [i, c] of chooses.entries()) {
    const after = rate(check, c[1]!) ?? c[5]!;
    const reaches = Number(after) >= fair / 2 ? "yes" : "**no** (listed)";
    console.log(`| ${i ? "" : `${name} ${n}`} | ${i ? "" : `${fair.toFixed(1)}%`} | ${c[1]} | ${c[3]}% | +${c[4]} | ${after}% | ${reaches} |`);
  }
}
