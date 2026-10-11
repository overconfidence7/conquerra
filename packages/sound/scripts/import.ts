/**
 * `pnpm sound:import`: makes the game's sound files from the packs in sound/incoming/ (see src/import.ts).
 *   pnpm sound:import              every cue
 *   pnpm sound:import battle fog   just these cues (the rest stay as they are)
 */
import { existsSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { creditsMarkdown, importSounds, missingInputs, writeRegistry } from "../src/import";
import { RECIPE } from "../src/recipe";
import { CREDIT_BY_ID, CREDITS, REGISTRY } from "../src/registry";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const incoming = join(root, "sound/incoming");
const outDir = join(root, "apps/web/public/sound");
const only = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const known = new Set(RECIPE.cues.map((c) => c.cue));
for (const c of only) if (!known.has(c)) throw new Error(`No cue called "${c}" in data/recipe.json`);

const missing = missingInputs({ recipe: RECIPE, credits: CREDIT_BY_ID, incoming }).filter((m) => !only.length || only.some((c) => m.includes(`-${c}`)));
if (missing.length) {
  console.error(`Can't import yet:\n  ${missing.join("\n  ")}\n\nThe packs go in sound/incoming/ (see docs/sound/credits.md for where each one comes from).`);
  process.exit(1);
}

const files = importSounds({ recipe: RECIPE, credits: CREDIT_BY_ID, incoming, outDir, only: only.length ? new Set(only) : undefined, previous: REGISTRY.files, log: (l) => console.log(l) });
writeRegistry(join(root, "packages/sound/data/registry.json"), files);
writeFileSync(join(root, "docs/sound/credits.md"), creditsMarkdown(CREDITS, files));
// Files no cue makes any more.
const keep = new Set(files.map((f) => f.file.replace(/^sound\//, "")));
if (existsSync(outDir)) for (const f of readdirSync(outDir)) if (!keep.has(f)) (rmSync(join(outDir, f)), console.log(`removed ${f} (no cue makes it now)`));
const kb = (k: string) => files.filter((f) => f.kind === k).reduce((a, f) => a + f.bytes, 0) / 1024;
console.log(`\n${files.length} files from ${RECIPE.cues.length} cues: effects ${kb("sfx").toFixed(0)} KB, music ${kb("music").toFixed(0)} KB, ambience ${kb("ambience").toFixed(0)} KB.`);
