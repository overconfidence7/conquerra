/**
 * Session 33: random maps' graded head start, the runs of one setting put together (`docs/sims/run-s33-random.sh`
 * writes `s33-random-<tag>-<size>-from<start>.json` with every game, or only the text report for the first runs).
 *
 *   npx tsx apps/sim/scripts/s33-combine.ts [--prefix s33b] <tag> [<tag> ...]
 *
 * Session 33b: `--prefix s33b` reads session 33b's runs (`run-s33b-random.sh`), and sizes 300 and 400 when there.
 * For each size: games, wins by the winner's spot's exposure rank (safest first) against fair, the furthest from fair,
 * the harder spots' wins, the average turns and the share within 40, over every run of that tag.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dir = "docs/sims";
const SIZES = [
  [40, 4],
  [80, 4],
  [120, 6],
  [200, 8],
  [300, 8],
  [300, 10],
  [400, 10],
] as const;
const argv = process.argv.slice(2);
const pi = argv.indexOf("--prefix");
const prefix = pi >= 0 ? argv.splice(pi, 2)[1]! : "s33";

interface Game {
  winnerSeat: number | null;
  turns: number;
  error?: string;
  spotRank?: number;
  harder?: boolean;
  harderSpots?: number;
  extra?: number[];
  market?: number[];
}
interface Tally {
  games: number;
  byRank: number[];
  turns: number;
  within40: number;
  harderGames: number;
  harderWins: number;
  harderSeats: number;
  /** Session 33b: each rank's head start (troops) and markets, summed over the games that say. */
  extra: number[];
  market: number[];
  said: number;
  within60: number;
}

function fromJson(file: string, t: Tally) {
  const games = (JSON.parse(readFileSync(file, "utf8")) as { games: Game[] }).games.filter((g) => !g.error);
  for (const g of games) {
    t.games++;
    t.turns += g.turns;
    if (g.turns <= 40) t.within40++;
    if (g.turns < 60) t.within60++;
    if (g.extra) (t.said++, g.extra.forEach((x, i) => (t.extra[i]! += x)), g.market?.forEach((x, i) => (t.market[i]! += x)));
    if (g.spotRank !== undefined) t.byRank[g.spotRank]!++;
    if ((g.harderSpots ?? 0) > 0) (t.harderGames++, (t.harderSeats += g.harderSpots!), g.harder && t.harderWins++);
  }
}

/** The first runs kept only the text: counts back from its percentages (draws, which have no rank, are rare). */
function fromText(file: string, t: Tally, players: number) {
  const s = readFileSync(file, "utf8");
  if (!/^Time:/m.test(s)) return; // (still running)
  const n = Number(/Games: (\d+) played/.exec(s)![1]);
  const pcts = /exposure \(safest first[^)]*\): ([^\n]+)/.exec(s)![1]!.split(" / ").map((x) => parseFloat(x));
  const avg = parseFloat(/Turns: avg ([\d.]+)/.exec(s)![1]!);
  const within = parseFloat(/within 40: (\d+)%/.exec(s)![1]!);
  t.games += n;
  t.turns += avg * n;
  t.within40 += (within / 100) * n;
  pcts.forEach((p, i) => (t.byRank[i]! += Math.round((p * n) / 100)));
  const h = /Harder spots: marked on (\d+) of \d+ maps \(([\d.]+) a map\); they won ([\d.]+)%/.exec(s);
  if (h) {
    const maps = Number(h[1]);
    t.harderGames += maps;
    t.harderSeats += parseFloat(h[2]!) * maps;
    t.harderWins += Math.round((parseFloat(h[3]!) * maps) / 100);
  }
  if (pcts.length !== players) throw new Error(`${file}: ${pcts.length} ranks`);
}

for (const tag of argv) {
  console.log(`\n=== ${tag} ===`);
  console.log("| Size | Games | By exposure (safest first) | Furthest from fair | On average | Harder spots' wins (fair) | Avg turns (within 40) |");
  console.log("|---|---|---|---|---|---|---|");
  console.log("(Runs kept as JSON add three columns: the head start in troops by rank, the share of each rank with a market, and the share of games over before the 60-turn cap.)");
  for (const [size, players] of SIZES) {
    const t: Tally = { games: 0, byRank: Array(players).fill(0), turns: 0, within40: 0, harderGames: 0, harderWins: 0, harderSeats: 0, extra: Array(players).fill(0), market: Array(players).fill(0), said: 0, within60: 0 };
    const files = readdirSync(dir).filter((f) => f.startsWith(`${prefix}-random-${tag}-${size}-${size === 300 ? `${players}p-` : ""}from`));
    for (const f of files.filter((f) => f.endsWith(".json"))) fromJson(join(dir, f), t);
    for (const f of files.filter((f) => f.endsWith(".txt") && !existsSync(join(dir, f.replace(/\.txt$/, ".json"))))) fromText(join(dir, f), t, players);
    if (!t.games) continue;
    const ranked = t.byRank.reduce((a, b) => a + b, 0);
    const fair = 100 / players;
    const pct = t.byRank.map((w) => (100 * w) / Math.max(1, ranked));
    const worst = Math.max(...pct.map((p) => Math.abs(p - fair)));
    const mean = pct.reduce((a, p) => a + Math.abs(p - fair), 0) / players;
    const harder = t.harderGames ? `${((100 * t.harderWins) / t.harderGames).toFixed(1)}% (${((100 * t.harderSeats) / t.harderGames / players).toFixed(1)})` : "none";
    const start = t.said ? ` | ${t.extra.map((x) => (x / t.said).toFixed(1)).join(" / ")} | ${t.market.map((x) => `${Math.round((100 * x) / t.said)}%`).join(" / ")} | ${Math.round((100 * t.within60) / t.games)}%` : "";
    console.log(`| ${size}, ${players} players | ${t.games} | ${pct.map((p) => p.toFixed(1)).join(" / ")} | ${worst.toFixed(1)} | ${mean.toFixed(1)} | ${harder} | ${(t.turns / t.games).toFixed(1)} (${((100 * t.within40) / t.games).toFixed(0)}%)${start} |`);
  }
}
