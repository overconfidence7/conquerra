// Writes voice-expected.json from the current failures: `npx tsx packages/content/test/voice-write-expected.ts`.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { failures, ROOT } from "./voiceScan";
const f = failures();
writeFileSync(join(ROOT, "packages/content/test/voice-expected.json"), `${JSON.stringify(f, null, 1)}\n`);
console.log(`${f.length} expected failures written`);
