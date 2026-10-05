import type { GameSummary } from "./runGame";

/** Game-length target (Nate, Oct 5): games may run up to 30–40 turns. */
export const TARGET_TURNS = { from: 30, to: 40 } as const;

/** What "Sim this map" shows, worked out from a batch of finished games. */
export interface SimReport {
  games: number;
  players: number;
  turns: { avg: number; median: number; min: number; max: number };
  /** Share of games that finished within 40 turns, and inside 30–40. */
  upTo40: number;
  in30to40: number;
  /** Share of games each seat won (fair = 1 / players), and draws. */
  seatWins: number[];
  draws: number;
  /** The three runaway measures (docs/sim-results-m3-fixes.md). */
  runaway: {
    /** One player held more than half the map after turn 10 (of games that lasted that long). */
    halfMapByTurn10: number;
    /** The leader at the halfway point went on to win. */
    halfwayLeaderWins: number;
    /** The winner was not the leader after turn 10 (of games past turn 10). */
    comebacks: number;
  };
  /** Battles per game across each kind of border, and the share of all battles fought across passes and sea lanes. */
  battles: { perGame: number; byBorder: Record<"normal" | "river" | "pass" | "sea", number>; passShare: number; seaShare: number };
}

const share = (k: number, of: number) => (of ? k / of : 0);

export function simReport(results: readonly GameSummary[], players: number): SimReport {
  const n = results.length;
  const turns = results.map((g) => g.turns).sort((a, b) => a - b);
  const won = results.filter((g) => g.winner !== "draw");
  const at10 = results.filter((g) => g.topShareTurn10 !== null);
  const half = won.filter((g) => g.leaderHalfway !== null);
  const past10 = won.filter((g) => g.leaderTurn10 !== null);
  const kinds = ["normal", "river", "pass", "sea"] as const;
  const totals = Object.fromEntries(kinds.map((k) => [k, results.reduce((a, g) => a + (g.byBorder[k]?.battles ?? 0), 0)])) as Record<(typeof kinds)[number], number>;
  const allBattles = kinds.reduce((a, k) => a + totals[k], 0);
  return {
    games: n,
    players,
    turns: { avg: turns.reduce((a, b) => a + b, 0) / Math.max(1, n), median: turns[Math.floor(n / 2)] ?? 0, min: turns[0] ?? 0, max: turns[n - 1] ?? 0 },
    upTo40: share(results.filter((g) => g.turns <= TARGET_TURNS.to).length, n),
    in30to40: share(results.filter((g) => g.turns >= TARGET_TURNS.from && g.turns <= TARGET_TURNS.to).length, n),
    seatWins: Array.from({ length: players }, (_, i) => share(results.filter((g) => g.winnerSeat === i).length, n)),
    draws: share(results.filter((g) => g.winner === "draw").length, n),
    runaway: {
      halfMapByTurn10: share(at10.filter((g) => g.topShareTurn10! > 0.5).length, at10.length),
      halfwayLeaderWins: share(half.filter((g) => g.leaderHalfway === g.winner).length, half.length),
      comebacks: share(past10.filter((g) => g.leaderTurn10 !== g.winner).length, past10.length),
    },
    battles: {
      perGame: allBattles / Math.max(1, n),
      byBorder: Object.fromEntries(kinds.map((k) => [k, totals[k] / Math.max(1, n)])) as Record<(typeof kinds)[number], number>,
      passShare: share(totals.pass, allBattles),
      seaShare: share(totals.sea, allBattles),
    },
  };
}
