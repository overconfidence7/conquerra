/**
 * Imports Nate's art from art/incoming/ into the game (apps/web/public/art/), then says what's still missing.
 * Run from the repo root:  pnpm art:import
 * Also writes contact sheets of the polish pass's art (session 21) to docs/art/screens/import-*.png: each piece over
 * grass, the navy menus and sand, blended as the game draws it.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatReport, importArt } from "../src/import";
import { ASSETS } from "../src/registry";
import { contactSheet } from "./contact-sheet";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const artDir = join(root, "apps/web/public/art");
const { manifest, report } = await importArt({ incomingDir: join(root, "art/incoming"), outDir: artDir });
console.log(formatReport(report));
const fx = ASSETS.filter((a) => a.kind === "fx").map((a) => a.name);
const batch4 = ["terrain-hills", "tree-conifer-1", "tree-conifer-2", "scaffold", "bridge-wood", "icon-rangers", "icon-standard-bearer", "icon-spy", "figure-rangers", "figure-standard-bearer", "figure-spy", "landmark-windmill-body", "landmark-windmill-sails", "art-title", "art-victory", "art-defeat"];
const n1 = await contactSheet(manifest, artDir, fx, join(root, "docs/art/screens/import-fx.png"));
const n2 = await contactSheet(manifest, artDir, batch4, join(root, "docs/art/screens/import-batch4.png"));
console.log(`\nContact sheets: docs/art/screens/import-fx.png (${n1} effects), import-batch4.png (${n2} pieces).`);
console.log("The game picks the new art up on its next load (refresh the page).");
