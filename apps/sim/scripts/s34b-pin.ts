/**
 * Session 34b: pin the 200s' layouts the search chose. Reads docs/sims/s34b-layouts-<map><n>.txt (s34b-layouts.ts) and
 * writes layout version 2 (`packages/content/data/maps/layout-versions.json`): for each table, the layout that ships
 * ("pin": the search's best, at least 5 points fairer on fresh games; "keep": the map's current spots) with the start
 * bonus sized on it. A table whose proof (fresh games again) doesn't bear the change out is left out (see below), so
 * version 1's layout and head start carry on there.
 *
 *   npx tsx apps/sim/scripts/s34b-pin.ts [--dry] [--version 2]
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "../../..");
const dry = process.argv.includes("--dry");
const vi = process.argv.indexOf("--version");
const VERSION = vi >= 0 ? process.argv[vi + 1]! : "2";
const sims = join(root, "docs/sims");
const file = join(root, "packages/content/data/maps/layout-versions.json");
const versions = JSON.parse(readFileSync(file, "utf8")) as Record<string, Record<string, { maxPlayers: number; layouts: { players: number; slots: string[]; bonus?: Record<string, number> }[] }>>;
const out: (typeof versions)[string] = { ...(versions[VERSION] ?? {}) };

const spreadOf = (line: string) => Number(/spread ([\d.]+) pts/.exec(line)?.[1] ?? NaN);
const bars = (line: string) => /best under 2x fair, worst above half/.test(line);
for (const f of readdirSync(sims).filter((x) => /^s34b-layouts-[a-z-]+\d+\.txt$/.test(x)).sort()) {
  const text = readFileSync(join(sims, f), "utf8");
  const decision = /^(pin|keep) ([a-z-]+):(\d+): (\[.*?\])/m.exec(text);
  const bonus = /^bonus \S+: (\{.*\})$/m.exec(text)?.[1];
  const today = /^proof \S+ today: (.*)$/m.exec(text)?.[1];
  const fresh = /^proof \S+ new: (.*)$/m.exec(text)?.[1];
  if (!decision || !bonus || !today || !fresh) {
    console.log(`${f}: not finished`);
    continue;
  }
  const [, how, map, n, slots] = decision;
  const players = Number(n);
  // (A second proof, s34b-confirm.ts on 600 more fresh games, where there is one: the two proofs' spreads averaged.)
  const confirm = existsSync(join(sims, "s34b-confirm.txt")) ? readFileSync(join(sims, "s34b-confirm.txt"), "utf8") : "";
  const lineOf = (which: string) => confirm.split("\n").find((l) => l.startsWith(`confirm ${map}:${n} (`) && l.includes(`) ${which}: `))?.split(`) ${which}: `)[1];
  const ct = lineOf("today"), cn = lineOf("new");
  const before = ct ? (spreadOf(today) + spreadOf(ct)) / 2 : spreadOf(today), after = cn ? (spreadOf(fresh) + spreadOf(cn)) / 2 : spreadOf(fresh);
  // A new layout (already at least 5 points fairer, bare, on the check's fresh games) ships with its bonus where the
  // proof's fresh games don't say it's worse than today's spots and head start; a kept layout changes (its bonus only)
  // where the proof says the new bonus is at least 5 points fairer than today's head start (the same bar as a layout).
  if (how === "pin" ? !(after <= before) : !(after <= before - 5)) {
    console.log(`${map}:${n}: left as it is (proof: today ${before.toFixed(1)} pts, new ${after.toFixed(1)} pts)`);
    continue;
  }
  const b = JSON.parse(bonus) as Record<string, number>;
  const layout = { players, slots: JSON.parse(slots!) as string[], ...(Object.keys(b).length ? { bonus: b } : {}) };
  const entry = out[map!] ?? { maxPlayers: players, layouts: [] };
  entry.layouts = [...entry.layouts.filter((l) => l.players !== players), layout].sort((x, y) => x.players - y.players);
  entry.maxPlayers = Math.max(entry.maxPlayers, players);
  out[map!] = entry;
  console.log(`${map}:${n}: ${how === "pin" ? "new spots" : "its spots"}, bonus ${JSON.stringify(b)} (proof: today ${before.toFixed(1)} pts${bars(today) ? ", bars met" : ""} -> new ${after.toFixed(1)} pts${bars(fresh) ? ", bars met" : ""})`);
}
if (!dry) {
  versions[VERSION] = Object.fromEntries(Object.entries(out).sort());
  writeFileSync(file, `${JSON.stringify(versions, null, 1)}\n`);
  console.log(`layout-versions.json: version ${VERSION}, ${Object.entries(out).map(([m, e]) => `${m} ${e.layouts.map((l) => l.players).join("/")}`).join(", ")}`);
}
