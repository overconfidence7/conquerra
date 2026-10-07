/**
 * Try the map maker on many seeds: how often each shape and size passes the checks, how long it takes, and why
 * attempts are rejected. Saves a debug picture of each map it makes.
 *
 *   pnpm --filter @conquerra/mapgen try-maps --shapes archipelago,crescent --sizes 60,120 --seeds 5 --out ../../docs/maps/try
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import { defaultRules } from "@conquerra/content";
import { generateMap, LAND_SHAPES, mapPreviewSvg, recipeFor, type LandShape } from "../src/index";

const args = process.argv.slice(2);
const arg = (name: string, dflt: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1]! : dflt;
};
const shapes = arg("shapes", LAND_SHAPES.join(",")).split(",") as LandShape[];
const sizes = arg("sizes", "60,80,100,120").split(",").map(Number);
const seeds = Number(arg("seeds", "4"));
const first = Number(arg("first", "1"));
const out = arg("out", "");
const mask = arg("mask", "");
const pictures = out && !args.includes("--no-pictures");
if (out) mkdirSync(resolve(out), { recursive: true });

for (const shape of shapes)
  for (const size of sizes) {
    const times: number[] = [], tries: number[] = [];
    let failed = 0;
    const reasons = new Map<string, number>();
    for (let i = first; i < first + seeds; i++) {
      const recipe = recipeFor(shape, size, `${shape}-${size}-${i}`, mask ? { mask } : {});
      const t0 = performance.now();
      try {
        const r = generateMap({ ...recipe, maxAttempts: 25 }, defaultRules);
        times.push(performance.now() - t0);
        tries.push(r.attempt);
        for (const why of r.rejected) {
          const k = why.replace(/^[^:]+: /, "").replace(/t\d+/g, "tN").replace(/\d+(\.\d+)?/g, "#").slice(0, 70);
          reasons.set(k, (reasons.get(k) ?? 0) + 1);
        }
        if (pictures) {
          const png = new Resvg(mapPreviewSvg(r.map), { fitTo: { mode: "width", value: 1200 }, font: { loadSystemFonts: true } }).render().asPng();
          writeFileSync(join(resolve(out), `${recipe.id}.png`), png);
        }
      } catch (e) {
        if (process.env.DEBUG_MAPS) console.error(e);
        failed++;
        times.push(performance.now() - t0);
        const lines = (e as Error).message.split("\n");
        // A one-line error (not a list of failed checks) is a bug or a bad recipe: say it (session 19).
        const msg = lines.length > 1 ? lines.slice(1) : [`error: ${lines[0]}`];
        for (const why of msg) {
          const k = why.replace(/^[^:]+: /, "").replace(/t\d+/g, "tN").replace(/\d+(\.\d+)?/g, "#").slice(0, 70);
          reasons.set(k, (reasons.get(k) ?? 0) + 1);
        }
      }
    }
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
    console.log(
      `${shape.padEnd(15)} ${String(size).padStart(3)}: ${seeds - failed}/${seeds} made, avg ${Math.round(avg(times))} ms (max ${Math.round(Math.max(...times))}), avg try ${avg(tries).toFixed(1)}`,
    );
    for (const [k, v] of [...reasons].sort((a, b) => b[1] - a[1]).slice(0, 4)) console.log(`      ${v}x ${k}`);
  }
