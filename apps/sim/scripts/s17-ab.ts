/**
 * Session 17, Part 2: try a change to the Marshal (A/B). One Marshal of each personality against Captains, on each
 * table, with the change merged in (`--tweak` JSON, as `pnpm tournament`); prints each personality's win rate and the
 * Marshals' average against fair, per table.
 *   npx tsx apps/sim/scripts/s17-ab.ts '<tweak json or {}>' [games=300] [tables=embervale:4,wyrmland:6] [label] [personalities=all]
 */
import { PERSONALITY_IDS } from "@conquerra/bots";
import { runTournament, type TournamentSpec } from "../src/tournament";

const tweak = JSON.parse(process.argv[2] ?? "{}");
const games = Number(process.argv[3] ?? 300);
const tables = (process.argv[4] ?? "embervale:4,wyrmland:6").split(",").map((t) => t.split(":") as [string, string]);
const label = process.argv[5] ?? JSON.stringify(tweak);
const only = process.argv[6] ? process.argv[6].split(",") : PERSONALITY_IDS;
const lines: string[] = [];
for (const [map, n] of tables) {
  const players = Number(n);
  const rates: number[] = [];
  const parts: string[] = [];
  for (const p of only) {
    const spec: TournamentSpec = { map, players, seats: [`marshal-${p}`, ...Array.from({ length: players - 1 }, () => "captain")], games, seed: "s17ab", fog: true, diplomacy: true, tweak };
    const r = await runTournament(spec);
    const rate = r.filter((g) => g.seats.some((s, i) => g.kinds[i] === `marshal-${p}` && s.won)).length / r.length;
    rates.push(rate);
    parts.push(`${p} ${(100 * rate).toFixed(1)}%`);
  }
  const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
  lines.push(`${map}:${players} — Marshals ${(100 * avg).toFixed(1)}% (fair ${(100 / players).toFixed(1)}%, ×${(avg * players).toFixed(2)}): ${parts.join(", ")}`);
}
console.log(`[${label}]\n${lines.join("\n")}`);
