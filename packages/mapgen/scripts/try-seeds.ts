/**
 * Try other seeds of an official map's recipe (everything else unchanged): which pass the checks, how many rivers,
 * passes and sea lanes each has, and a picture of each, to pick a new seed for that map.
 *
 *   pnpm --filter @conquerra/mapgen try-seeds crownlands mask-100- 6 24 --out ../../docs/maps/try-crownlands
 *
 * tries seeds mask-100-6 ... mask-100-29. Run from the repo root with `pnpm --filter ...`; --out is relative to
 * packages/mapgen. Pictures are the same debug preview `pnpm build-maps` saves in docs/maps/.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { defaultRules } from "@conquerra/content";
import { generateMap, MAP_CONFIGS, mapPreviewSvg } from "../src/index";

const args = process.argv.slice(2);
const [id, prefix, fromArg, countArg] = args;
const outAt = args.indexOf("--out");
const out = outAt >= 0 ? resolve(args[outAt + 1]!) : "";
const base = MAP_CONFIGS.find((c) => c.id === id);
if (!base || !prefix) {
  console.log("Usage: pnpm --filter @conquerra/mapgen try-seeds <mapId> <seed prefix> <first number> <how many> [--out folder]");
  process.exit(1);
}
if (out) mkdirSync(out, { recursive: true });
const from = Number(fromArg ?? 1), count = Number(countArg ?? 12);
console.log(`${base.name}: today's seed ${base.seed}; trying ${prefix}${from} .. ${prefix}${from + count - 1}`);
for (let i = from; i < from + count; i++) {
  const seed = `${prefix}${i}`;
  const t0 = performance.now();
  try {
    const r = generateMap({ ...base, seed, maxAttempts: 12 }, defaultRules);
    const g = r.map.geometry!;
    const types: Record<string, number> = {};
    for (const b of r.map.borders) types[b.type] = (types[b.type] ?? 0) + 1;
    const river = r.map.borders.filter((b) => b.type === "river").length;
    console.log(
      `${seed.padEnd(14)} try ${r.attempt}: rivers ${g.rivers.length} (${river} river borders), passes ${types.pass ?? 0}, sea lanes ${types.sea ?? 0},`,
      `choke points ${JSON.stringify(r.check.chokePoints)}, ${Math.round(performance.now() - t0)} ms`,
    );
    if (out) {
      const png = new Resvg(mapPreviewSvg(r.map), { fitTo: { mode: "width", value: 1000 }, font: { loadSystemFonts: true } }).render().asPng();
      writeFileSync(join(out, `${seed}.png`), png);
    }
  } catch (e) {
    console.log(`${seed.padEnd(14)} failed: ${(e as Error).message.split("\n")[1]?.slice(0, 100) ?? ""}`);
  }
}
