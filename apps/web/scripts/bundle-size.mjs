/**
 * The game's start-up bundle: what index.html loads before the lobby shows (the entry script, anything it
 * preloads, and the stylesheet), raw and gzipped. Also fails if any map-lab or bench code got into it.
 *
 *   pnpm build && node apps/web/scripts/bundle-size.mjs
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const dist = join(dirname(fileURLToPath(import.meta.url)), "../dist");
const html = readFileSync(join(dist, "index.html"), "utf8");
const files = [...html.matchAll(/(?:src|href)="\/?(assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1]);
// Static imports between the start-up chunks (Vite hoists shared code into chunks the entry imports).
const seen = new Set();
const queue = [...files];
while (queue.length) {
  const f = queue.shift();
  if (seen.has(f)) continue;
  seen.add(f);
  if (!f.endsWith(".js")) continue;
  const code = readFileSync(join(dist, f), "utf8");
  for (const m of code.matchAll(/(?:^|[;\n}])\s*import\s*(?:[\w${},\s*]+from\s*)?["']\.\/([^"']+\.js)["']/g)) queue.push(`assets/${m[1]}`);
}
let raw = 0, gz = 0;
const rows = [];
let leaked = [];
for (const f of seen) {
  const buf = readFileSync(join(dist, f));
  raw += buf.length;
  const g = gzipSync(buf).length;
  gz += g;
  rows.push(`  ${f.padEnd(44)} ${(buf.length / 1024).toFixed(1).padStart(7)} KB  (gzip ${(g / 1024).toFixed(1)} KB)`);
  const text = buf.toString("utf8");
  for (const marker of ["Map lab", "Art test bench", "Sound bench", "generateMap", "Sim this map", "What a bot knew"]) if (text.includes(marker)) leaked.push(`${f} contains "${marker}"`);
}
console.log(`Start-up bundle (what loads before the lobby):\n${rows.join("\n")}\n  total ${(raw / 1024).toFixed(1)} KB, gzip ${(gz / 1024).toFixed(1)} KB`);
// Session 32: the allowance is Step 0's size (396.2 KB, once Zod left the start-up code: the content data is used as it
// stands, checked by a test) plus 2 KB. (Session 31: 468.1 plus 2.) A deploy stops above it.
const ALLOWANCE_KB = 398.2;
if (raw / 1024 > ALLOWANCE_KB) {
  console.log(`
The start-up bundle is over its allowance of ${ALLOWANCE_KB} KB. Move something out of the lobby's first paint.`);
  process.exit(1);
}
if (leaked.length) {
  console.log(`\nLab code leaked into the start-up bundle:\n  ${leaked.join("\n  ")}`);
  process.exit(1);
}
