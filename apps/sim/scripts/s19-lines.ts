/**
 * Session 19: one seat against a table of others (seats rotated), one line per test, with the win rate against fair.
 *   npx tsx apps/sim/scripts/s19-lines.ts <map:players> <games> "<seat> vs <others>" ["<seat> vs <others>" ...]
 * `<others>` is one kind (the rest of the table) or a comma list for the whole table after the seat.
 * Prints each seat kind's share of wins too, and the table's length and runaways.
 */
import { runTournament } from "../src/tournament";

// Options (before the lines): --rules '<json>' merged into the rules, --settings '<json>' into the game settings, --seed s.
const argv = process.argv.slice(2);
const opt = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  if (i < 0) return undefined;
  const v = argv[i + 1]!;
  argv.splice(i, 2);
  return v;
};
const rules = opt("rules");
const settings = opt("settings");
const seedPrefix = opt("seed") ?? "s19";
const [table = "embervale:4", games = "300", ...lines] = argv;
const [map, n] = table.split(":") as [string, string];
const players = Number(n);
for (const line of lines) {
  const [seat, others] = line.split(" vs ").map((x) => x.trim()) as [string, string];
  const rest = others.includes(",") ? others.split(",") : Array.from({ length: players - 1 }, () => others);
  const t0 = Date.now();
  const r = await runTournament({ map, players, seats: [seat, ...rest], games: Number(games), seed: seedPrefix, fog: true, diplomacy: true, ...(rules ? { rules: JSON.parse(rules) } : {}), ...(settings ? { settings: JSON.parse(settings) } : {}) });
  // A dealt Marshal seat ("marshal+goes") shows up as "marshal-<personality>+goes".
  const isSeat = (k: string) => k === seat || (seat.startsWith("marshal+") && k.startsWith("marshal-") && k.slice(k.indexOf("+")) === seat.slice(7) && k.includes("+"));
  const mine = r.map((g) => g.seats[g.kinds.findIndex(isSeat)]!);
  const won = mine.filter((s) => s.won).length;
  const pct = (k: number, of: number) => `${((100 * k) / Math.max(1, of)).toFixed(1)}%`;
  const turns = r.reduce((a, g) => a + g.turns, 0) / r.length;
  const at10 = r.filter((g) => g.topShareTurn10 !== null);
  const decided = r.filter((g) => g.winner !== "draw" && g.leaderHalfway);
  const avg = (f: (s: (typeof mine)[number]) => number) => (mine.reduce((a, s) => a + f(s), 0) / mine.length).toFixed(1);
  console.log(
    `${table}${rules ? ` ${rules}` : ""}${settings ? ` ${settings}` : ""} ${seat} vs ${others}: won ${pct(won, r.length)} (x${((won / r.length) * players).toFixed(2)} fair) | ${turns.toFixed(1)} turns, half-map at 10 ${pct(at10.filter((g) => g.topShareTurn10! > 0.5).length, at10.length)}, halfway leader won ${pct(decided.filter((g) => g.leaderHalfway === g.winner).length, decided.length)} | land10 ${avg((s) => s.land10 ?? 0)}, troops ${avg((s) => s.gold.troops)}g, buildings ${avg((s) => s.gold.buildings)}g, culture ${avg((s) => s.gold.culture)}g, wars ${avg((s) => s.wars)}, truces ${avg((s) => s.truces)} (${((Date.now() - t0) / 1000).toFixed(0)}s)`,
  );
}
