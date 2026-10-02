import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { runGame } from "./runGame";
// Dev helper: find the longest of N games so we can study it with trace.ts.
const n = Number(process.argv[2] ?? 6), games = Number(process.argv[3] ?? 100);
const ctx = { map: maps[n > 6 ? "greatmarch" : "embervale"]!, rules: defaultRules };
const res = Array.from({ length: games }, (_, i) => runGame(ctx, `long-${n}-${i}`, n, {}));
res.sort((a, b) => b.turns - a.turns);
console.log(res.slice(0, 5).map((g) => `${g.seed}: ${g.turns} turns`).join("\n"));
