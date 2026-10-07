/**
 * Session 17, Part 2: the tournament. On each table (Embervale 4, the Twin Realms 6, Wyrmland 6 and 8, Greatmarch 10),
 * everything on (fog, the Fallen, both decks, diplomacy, spies):
 *  - one Marshal of each personality against Captains (300 games each),
 *  - a table of Marshals (personalities dealt from each game's seed), and a table of Captains (300 games each).
 * Every game's seats and behaviours go to <out>/<table>-<seats>.jsonl, and a plain summary to the console.
 *   npx tsx apps/sim/scripts/s17-tournament.ts <out> [games=300] [tables=all] [kinds=all]
 *   kinds: one (one Marshal of each personality), marshals, captains
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PERSONALITY_IDS } from "@conquerra/bots";
import { runTournament, summary, type TournamentSpec } from "../src/tournament";

const out = process.argv[2] ?? "s17-results";
const games = Number(process.argv[3] ?? 300);
const TABLES: [string, number][] = [["embervale", 4], ["twin-realms", 6], ["wyrmland", 6], ["wyrmland", 8], ["greatmarch", 10]];
const tables = process.argv[4] && process.argv[4] !== "all" ? TABLES.filter(([m, n]) => process.argv[4]!.split(",").includes(`${m}:${n}`)) : TABLES;
const kinds = process.argv[5] && process.argv[5] !== "all" ? process.argv[5].split(",") : ["one", "marshals", "captains"];
mkdirSync(out, { recursive: true });

for (const [map, players] of tables) {
  const runs: { name: string; seats: string[] }[] = [
    ...(kinds.includes("one") ? PERSONALITY_IDS.map((p) => ({ name: `one-${p}`, seats: [`marshal-${p}`, ...Array.from({ length: players - 1 }, () => "captain")] })) : []),
    ...(kinds.includes("marshals") ? [{ name: "marshals", seats: ["marshal"] }] : []),
    ...(kinds.includes("captains") ? [{ name: "captains", seats: ["captain"] }] : []),
  ];
  for (const run of runs) {
    const spec: TournamentSpec = { map, players, seats: run.seats, games, seed: "s17", fog: true, diplomacy: true };
    const t0 = Date.now();
    const results = await runTournament(spec);
    writeFileSync(join(out, `${map}-${players}-${run.name}.jsonl`), results.map((r) => JSON.stringify({ spec: { map, players }, ...r })).join("\n") + "\n");
    console.log(summary(spec, results, Date.now() - t0));
  }
}
