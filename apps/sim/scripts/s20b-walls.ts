/**
 * Session 20b: Walls in play. One line per (label, table): who builds walls and when, length and the runaway measures,
 * the walled-runaway check, and each seat kind's win rate. Seats are rotated each game.
 *   npx tsx apps/sim/scripts/s20b-walls.ts <games> <tables: embervale:4,wyrmland:6,rootholm:8> <seats> <label>=<rules json> ...
 * `<seats>`: comma list, the last fills the table ("marshal" deals personalities from each game's seed;
 * "delegate-80+walls39,delegate-80+nowalls,marshal" puts a walling and a non-walling delegating seat at one table).
 * A label's rules are merged into the game's: `on={}`, `off={"walls":{"on":false}}`, `reach2={"walls":{"reach":2}}`.
 * Options: --seed s (default s20b).
 */
import { runTournament, type TournamentSpec } from "../src/tournament";

const argv = process.argv.slice(2);
const si = argv.indexOf("--seed");
const seed = si >= 0 ? argv.splice(si, 2)[1]! : "s20b";
const [games = "500", tablesArg = "embervale:4,wyrmland:6,rootholm:8", seatsArg = "marshal", ...labels] = argv;
const pct = (k: number, of: number) => `${((100 * k) / Math.max(1, of)).toFixed(1)}%`;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const median = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]! : NaN);

for (const l of labels.length ? labels : ["on={}", 'off={"walls":{"on":false}}']) {
  const i = l.indexOf("=");
  const label = l.slice(0, i);
  const rules = JSON.parse(l.slice(i + 1)) as Record<string, unknown>;
  for (const t of tablesArg.split(",")) {
    const [map, n] = t.split(":") as [string, string];
    const players = Number(n);
    const head = seatsArg.split(",");
    const seats = [...head.slice(0, -1), ...Array(Math.max(0, players - head.length + 1)).fill(head[head.length - 1])];
    const spec: TournamentSpec = { map, players, seats, games: Number(games), seed, fog: true, diplomacy: true, ...(Object.keys(rules).length ? { rules } : {}) };
    const t0 = Date.now();
    const r = await runTournament(spec);
    // Each seat kind's win rate (dealt Marshals counted together as "marshal").
    const base = (k: string) => k.replace(/^marshal-[a-z]+/, "marshal");
    const kinds = [...new Set(r.flatMap((g) => g.kinds.map(base)))];
    const rate = (k: string) => {
      let of = 0, won = 0;
      for (const g of r) g.kinds.forEach((x, s) => base(x) === k && (of++, g.seats[s]!.won && won++));
      return `${k} ${pct(won, of)} (${((won / Math.max(1, of)) * players).toFixed(2)}x)`;
    };
    const all = r.flatMap((g) => g.seats.map((s, k) => ({ ...s, kind: g.kinds[k]! })));
    // Who builds walls: share of seats that ever walled land, by Marshal personality (or seat kind), and when.
    const byKind = new Map<string, typeof all>();
    for (const s of all) byKind.set(s.kind.replace(/\+.*$/, ""), [...(byKind.get(s.kind.replace(/\+.*$/, "")) ?? []), s]);
    const builders = [...byKind]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([k, xs]) => {
        const w = xs.filter((s) => s.firstWall !== null);
        return `${k} ${pct(w.length, xs.length)}${w.length ? ` (first t${median(w.map((s) => s.firstWall!))}, peak ${avg(w.map((s) => s.walledPeak)).toFixed(1)})` : ""}`;
      })
      .join(", ");
    const anyWall = r.filter((g) => g.seats.some((s) => s.firstWall !== null)).length;
    const firsts = r.map((g) => Math.min(...g.seats.map((s) => s.firstWall ?? Infinity))).filter((x) => Number.isFinite(x));
    const wallBattles = all.reduce((a, s) => a + s.wallBattles, 0), wallHolds = all.reduce((a, s) => a + s.wallHolds, 0);
    // Length and runaways.
    const turns = r.map((g) => g.turns);
    const won = r.filter((g) => g.winner !== "draw");
    const at10 = r.filter((g) => g.topShareTurn10 !== null);
    const half = won.filter((g) => g.leaderHalfway !== null);
    const past10 = won.filter((g) => g.leaderTurn10 !== null);
    // The walled-runaway check: the halfway leader, its share of land walled then, and whether walls made it unstoppable.
    const leaders = half.map((g) => ({ g, s: g.seats.find((s) => s.player === g.leaderHalfway)! }));
    const walledShare = leaders.map(({ s }) => s.walledHalfway / Math.max(1, s.landHalfway));
    const walledLeaders = leaders.filter(({ s }) => s.walledHalfway / Math.max(1, s.landHalfway) >= 0.1);
    const plainLeaders = leaders.filter(({ s }) => s.walledHalfway / Math.max(1, s.landHalfway) < 0.1);
    const lw = (xs: typeof leaders) => `${pct(xs.filter(({ g, s }) => g.winner === s.player).length, xs.length)} of ${xs.length}`;
    console.log(
      `${label.padEnd(10)} ${t.padEnd(12)} ${kinds.map(rate).join(", ")} | fair ${(100 / players).toFixed(1)}% | ` +
        `walls in ${pct(anyWall, r.length)} of games, first t${median(firsts)}; builders: ${builders} | wall battles ${(wallBattles / r.length).toFixed(2)}/game, held ${pct(wallHolds, wallBattles)} | ` +
        `length avg ${avg(turns).toFixed(1)}, median ${median(turns)}, at the cap ${pct(turns.filter((x) => x >= 60).length, turns.length)} | half-map by 10 ${pct(at10.filter((g) => g.topShareTurn10! > 0.5).length, at10.length)}, ` +
        `halfway leader won ${pct(half.filter((g) => g.leaderHalfway === g.winner).length, half.length)}, comebacks ${pct(past10.filter((g) => g.leaderTurn10 !== g.winner).length, past10.length)} | ` +
        `halfway leader's land walled ${(100 * avg(walledShare)).toFixed(1)}% (end ${(100 * avg(leaders.map(({ s }) => s.walledEnd / Math.max(1, s.landEnd)))).toFixed(1)}%); it won: walled 10%+ ${lw(walledLeaders)}, less ${lw(plainLeaders)} | ${((Date.now() - t0) / 1000).toFixed(0)}s`,
    );
  }
}
