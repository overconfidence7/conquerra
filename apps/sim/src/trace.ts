import { defaultRules, maps } from "@conquerra/content";
import { recruitBot } from "@conquerra/bots";
import { createGame, incomeFor, resolveTurn, viewFor } from "@conquerra/engine";
// Dev helper: one game, a line per turn with each player's land / troops / gold / income.
const n = Number(process.argv[2] ?? 4), seed = process.argv[3] ?? "trace";
const map = maps[n > 6 ? "greatmarch" : "embervale"]!;
const ctx = { map, rules: defaultRules };
let s = createGame(ctx, { gameId: `sim-${seed}`, seed, players: Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}` })) });
while (!s.winner) {
  const orders = Object.fromEntries(s.players.filter((p) => p.eliminatedTurn === null).map((p) => [p.id, recruitBot.plan(ctx, viewFor(ctx, s, p.id))]));
  s = resolveTurn(ctx, s, orders).state;
  const row = s.players.map((p) => {
    const land = Object.values(s.territories).filter((t) => t.owner === p.id);
    if (!land.length) return "   --   ";
    return `${land.length}/${land.reduce((a, t) => a + t.troops, 0)}/${p.gold}/${incomeFor(ctx, s, p.id).net}`;
  });
  const neutral = Object.values(s.territories).filter((t) => !t.owner).length;
  console.log(`t${String(s.turn).padStart(2)} neutral ${String(neutral).padStart(2)} | ${row.map((r) => r.padEnd(16)).join(" ")}`);
}
console.log(s.winner, s.endReason);
