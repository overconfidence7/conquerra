// Lists the voice test's failures by file (and the lines matching an argument): `npx tsx packages/content/test/voice-report.ts [text]`.
import { collect, failures } from "./voiceScan";
const all = collect();
const f = failures(all);
console.log(`strings: ${all.length}, failures: ${f.length}`);
const by = new Map<string, number>();
for (const x of f) { const k = x.split(" | ")[0]!.split(":")[0]!; by.set(k, (by.get(k) ?? 0) + 1); }
console.log([...by].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${n} ${k}`).join("\n"));
if (process.argv[2]) console.log(f.filter((x) => x.includes(process.argv[2]!)).join("\n"));
