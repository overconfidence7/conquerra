/**
 * Session 20b: pin the fair-seat search's layouts. Reads the "recipe" lines of docs/sims/s20b-fair-<map><n>.txt and,
 * where the check on fresh games says the new layout is fairer than the map's own (a smaller spread), writes it into
 * the map's recipe (`capitals` in packages/mapgen/src/configs.ts) and changes only that table size's entry in the
 * map file's `capitalLayouts`. Prints what it pinned and what it kept.
 *   npx tsx apps/sim/scripts/s20b-pin-seats.ts [--dry]
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "../../..");
const dry = process.argv.includes("--dry");
const sims = join(root, "docs/sims");
const spread = (line: string) => Number(/spread (\d+) pts/.exec(line)?.[1] ?? NaN);
const pins = new Map<string, Record<number, string[]>>();
for (const f of readdirSync(sims).filter((x) => /^s20b-fair-.*\.txt$/.test(x)).sort()) {
  const text = readFileSync(join(sims, f), "utf8");
  const recipe = /^recipe ([a-z-]+):(\d+): capitals: \{\d+: (\[.*\])\}$/m.exec(text);
  const before = /^check \S+ before: (.*)$/m.exec(text)?.[1];
  const after = /^check \S+ after: (.*)$/m.exec(text)?.[1];
  if (!recipe || !before || !after) {
    console.log(`${f}: not finished`);
    continue;
  }
  const [, map, n, slots] = recipe;
  const b = spread(before), a = spread(after);
  if (!(a < b)) {
    console.log(`${map}:${n}: kept the map's own layout (fresh games: ${b} -> ${a} pts)`);
    continue;
  }
  console.log(`${map}:${n}: pinned ${slots} (fresh games: spread ${b} -> ${a} pts)`);
  pins.set(map!, { ...(pins.get(map!) ?? {}), [Number(n)]: JSON.parse(slots!) as string[] });
}
if (dry) process.exit(0);
const configs = join(root, "packages/mapgen/src/configs.ts");
let src = readFileSync(configs, "utf8");
for (const [map, layouts] of pins) {
  // The map file: only the pinned table sizes' entries change.
  const file = join(root, `packages/content/data/maps/${map}.json`);
  let json = readFileSync(file, "utf8");
  for (const [n, slots] of Object.entries(layouts)) {
    const re = new RegExp(`\\{"players":${n},"slots":\\[[^\\]]*\\]\\}`);
    if (!re.test(json)) throw new Error(`${map}: no ${n}-player layout in the map file`);
    json = json.replace(re, `{"players":${n},"slots":${JSON.stringify(slots)}}`);
  }
  writeFileSync(file, json);
  // The recipe: merge into its `capitals` (adding the key if it has none). One-line recipes end their line with "},";
  // Embervale's spreads over several lines and ends with a line "  },".
  const NL = String.fromCharCode(10);
  const at = src.indexOf(`id: "${map}"`);
  if (at < 0) throw new Error(`no recipe for ${map}`);
  const lineEnd = src.indexOf(NL, at);
  const oneLine = src.slice(at, lineEnd).trimEnd().endsWith("},");
  const blockEnd = oneLine ? lineEnd : src.indexOf(`${NL}  },`, at);
  const block = src.slice(at, blockEnd);
  const existing = /capitals: \{([^}]*)\}/.exec(block);
  const merged: Record<string, string[]> = {};
  if (existing) for (const m of existing[1]!.matchAll(/(\d+): (\[[^\]]*\])/g)) merged[m[1]!] = JSON.parse(m[2]!) as string[];
  for (const [n, slots] of Object.entries(layouts)) merged[n] = slots;
  const text = `capitals: {${Object.entries(merged).map(([n, sl]) => `${n}: ${JSON.stringify(sl)}`).join(", ")}}`;
  let next: string;
  if (existing) next = block.replace(/capitals: \{[^}]*\}/, text);
  else if (oneLine) {
    const close = block.lastIndexOf("}");
    next = `${block.slice(0, close)}, ${text}${block.slice(close)}`;
  } else next = `${block},${NL}    ${text}`;
  src = src.slice(0, at) + next + src.slice(blockEnd);
}
writeFileSync(configs, src);
console.log(`pinned ${[...pins].map(([m, l]) => `${m} ${Object.keys(l).join("/")}`).join(", ") || "nothing"}`);
