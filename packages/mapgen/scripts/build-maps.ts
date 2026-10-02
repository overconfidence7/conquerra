/**
 * Builds the test maps with the map maker and writes them into the game's content, plus a debug preview of each
 * into docs/maps/. Run from the repo root:  pnpm build-maps
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import { defaultRules } from "@conquerra/content";
import { applyRenames, generateMap, MAP_CONFIGS, mapPreviewSvg, type NameFile } from "../src/index";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

const only = process.argv[2];
const catalog: object[] = [];
for (const opts of MAP_CONFIGS) {
  if (only && opts.id !== only) continue;
  const made = generateMap(opts, defaultRules);
  const { attempt, check, rejected } = made;
  // Nate's renames (packages/mapgen/names/<map>.json).
  const namesFile = join(root, "packages/mapgen/names", `${opts.id}.json`);
  const names: NameFile = existsSync(namesFile) ? JSON.parse(readFileSync(namesFile, "utf8")) : { renames: {} };
  const { map, unknown } = applyRenames(made.map, names.renames);
  for (const u of unknown) console.log(`  ! names/${opts.id}.json: there's no place called "${u}" on ${opts.name} (check the spelling)`);
  catalog.push({ id: map.id, name: map.name, territories: map.territories.length, minPlayers: map.minPlayers, maxPlayers: map.maxPlayers, recommendedPlayers: map.recommendedPlayers });
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
if (!only) writeFileSync(join(root, "packages/content/data/maps/catalog.json"), `${JSON.stringify(catalog, null, 2)}\n`);
