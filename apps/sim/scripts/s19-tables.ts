/**
 * Session 19: whole tables (Marshals by default), each line one change: length, within 40, the three runaway measures
 * and comebacks, at several table sizes.
 *   npx tsx apps/sim/scripts/s19-tables.ts <games> <tables: embervale:4,wyrmland:6,...> <label>=<json change> ...
 * A change is {"rules": {...}, "settings": {...}, "judgement": {...}, "seats": ["captain"]} (all optional).
 */
import { runTournament, type TournamentSpec } from "../src/tournament";

const [games = "500", tablesArg = "embervale:4,wyrmland:6,greatmarch:10", ...changes] = process.argv.slice(2);
const pct = (k: number, of: number) => `${((100 * k) / Math.max(1, of)).toFixed(1)}%`;
for (const c of changes.length ? changes : ["today={}"]) {
  const i = c.indexOf("=");
  const label = c.slice(0, i);
  const ch = JSON.parse(c.slice(i + 1)) as { rules?: Record<string, unknown>; settings?: Record<string, unknown>; judgement?: Record<string, unknown>; seats?: string[] };
  for (const t of tablesArg.split(",")) {
    const [map, n] = t.split(":") as [string, string];
    const spec: TournamentSpec = { map, players: Number(n), seats: ch.seats ?? ["marshal"], games: Number(games), seed: "s19T", fog: true, diplomacy: true, ...(ch.rules ? { rules: ch.rules } : {}), ...(ch.settings ? { settings: ch.settings } : {}), ...(ch.judgement ? { tweak: { judgement: ch.judgement } } : {}) };
    const r = await runTournament(spec);
    const turns = r.map((g) => g.turns);
    const at10 = r.filter((g) => g.topShareTurn10 !== null);
    const won = r.filter((g) => g.winner !== "draw");
    const half = won.filter((g) => g.leaderHalfway);
    const past10 = won.filter((g) => g.leaderTurn10);
    const seatWins = Array.from({ length: spec.players }, (_, s) => r.filter((g) => g.seats[s]!.won).length / r.length);
    const out = r.flatMap((g) => g.seats).filter((s) => s.out !== null && s.out <= 6).length / r.flatMap((g) => g.seats).length;
    console.log(
      `${label.padEnd(14)} ${t.padEnd(14)} ${(turns.reduce((a, b) => a + b, 0) / turns.length).toFixed(1)} turns (median ${[...turns].sort((a, b) => a - b)[Math.floor(turns.length / 2)]}), ${pct(turns.filter((x) => x <= 40).length, turns.length)} within 40 | half-map at 10 ${pct(at10.filter((g) => g.topShareTurn10! > 0.5).length, at10.length)}, halfway leader won ${pct(half.filter((g) => g.leaderHalfway === g.winner).length, half.length)}, comebacks ${pct(past10.filter((g) => g.leaderTurn10 !== g.winner).length, past10.length)} | seats ${(100 * Math.min(...seatWins)).toFixed(0)}–${(100 * Math.max(...seatWins)).toFixed(0)}% | out by 6 ${(100 * out).toFixed(1)}% | draws ${pct(r.length - won.length, r.length)}`,
    );
  }
}
