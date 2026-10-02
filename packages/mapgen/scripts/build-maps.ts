/**
 * Builds the test maps with the map maker and writes them into the game's content, plus a debug preview of each
 * into docs/maps/. Run from the repo root:  pnpm build-maps
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import { defaultRules } from "@conquerra/content";
import { generateMap, MAP_CONFIGS, mapPreviewSvg } from "../src/index";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");


const only = process.argv[2];
for (const opts of MAP_CONFIGS) {
  if (only && opts.id !== only) continue;
  const { map, attempt, check, rejected } = generateMap(opts, defaultRules);
  writeFileSync(join(root, "packages/content/data/maps", `${map.id}.json`), JSON.stringify(map) + "\n");
  mkdirSync(join(root, "docs/maps"), { recursive: true });
  const png = new Resvg(mapPreviewSvg(map), { fitTo: { mode: "width", value: 1600 }, font: { loadSystemFonts: true } }).render().asPng();
  writeFileSync(join(root, "docs/maps", `${map.id}.png`), png);
  const types: Record<string, number> = {};
  for (const b of map.borders) types[b.type] = (types[b.type] ?? 0) + 1;
  console.log(
    `${map.name}: seed attempt ${attempt} (${rejected.length} rejected), ${map.territories.length} territories, ${map.provinces.length} provinces,`,
    `borders ${JSON.stringify(types)}, choke points ${JSON.stringify(check.chokePoints)}, ${map.geometry!.decorations.length} decorations`,
  );
  for (const r of rejected) console.log(`  rejected ${r}`);
}
