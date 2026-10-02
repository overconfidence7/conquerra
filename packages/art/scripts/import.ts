/**
 * Imports Nate's art from art/incoming/ into the game (apps/web/public/art/), then says what's still missing.
 * Run from the repo root:  pnpm art:import
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatReport, importArt } from "../src/import";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const { report } = await importArt({ incomingDir: join(root, "art/incoming"), outDir: join(root, "apps/web/public/art") });
console.log(formatReport(report));
console.log("\nThe game picks the new art up on its next load (refresh the page).");
