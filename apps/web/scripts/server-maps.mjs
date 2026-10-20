/**
 * The maps the game room plays on (session 26): every official map without its drawing data (`geometry`), which the
 * engine and the bots never read and which is 98% of each file. The page loads the full map from its own cache; the
 * Worker carries only these, so it stays far under the Free plan's script size.
 *
 *   node apps/web/scripts/server-maps.mjs          writes apps/web/server/maps.json
 *
 * `apps/web/test/server.test.ts` checks the committed file is exactly what this makes.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const dir = join(root, "packages/content/data/maps");

export function slimMaps() {
  const catalog = JSON.parse(readFileSync(join(dir, "catalog.json"), "utf8"));
  // Session 34: with each map's big tables joined, as `withBigTables` (packages/content/src/bigTables.ts) does.
  const big = JSON.parse(readFileSync(join(dir, "big-tables.json"), "utf8"));
  // Session 34b: and their later layout versions (`layoutVersions`, oldest first).
  const versions = JSON.parse(readFileSync(join(dir, "layout-versions.json"), "utf8"));
  const out = {};
  for (const { id } of catalog) {
    const { geometry: _drawing, ...map } = JSON.parse(readFileSync(join(dir, `${id}.json`), "utf8"));
    const b = big[id];
    if (b) {
      const own = map.capitalLayouts ?? [];
      Object.assign(map, { maxPlayers: Math.max(map.maxPlayers, b.maxPlayers), capitalLayouts: [...own, ...b.layouts.filter((l) => !own.some((o) => o.players === l.players))] });
    }
    const later = Object.entries(versions)
      .filter(([, maps]) => maps[id])
      .map(([v, maps]) => ({ version: Number(v), ...maps[id] }))
      .sort((x, y) => x.version - y.version);
    if (later.length) Object.assign(map, { maxPlayers: Math.max(map.maxPlayers, ...later.map((l) => l.maxPlayers)), layoutVersions: later.map((l) => ({ version: l.version, layouts: l.layouts })) });
    out[id] = map;
  }
  return `${JSON.stringify(out)}\n`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const text = slimMaps();
  writeFileSync(join(root, "apps/web/server/maps.json"), text);
  console.log(`apps/web/server/maps.json: ${Object.keys(JSON.parse(text)).length} maps, ${(text.length / 1024).toFixed(0)} KB`);
}
