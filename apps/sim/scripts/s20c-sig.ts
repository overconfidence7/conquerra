/** Session 20c: session 17's personality signatures over many games (fronts a turn, land taken and lost by turn 8). */
import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { makeMarshalBot } from "@conquerra/bots";
import { playTable, type SeatStats } from "@conquerra/simcore";
import type { GameContext } from "@conquerra/engine";
const ember: GameContext = { map: { ...maps.embervale!, capitalLayouts: maps.embervale!.capitalLayouts!.map((l) => (l.players === 4 ? { players: 4, slots: ["t02", "t05", "t19", "t37"] } : l)) }, rules: defaultRules };
const kinds = ["turtle", "blitzer", "merchant", "conqueror"] as const;
const seats: Record<string, SeatStats[]> = {};
const N = Number(process.argv[2] ?? 100);
for (let g = 0; g < N; g++) {
  const order = kinds.map((_, i) => kinds[(i + g) % kinds.length]!);
  const r = playTable(ember, `sig-${g}`, order.map((k) => makeMarshalBot(k)), { maxTurns: 16 });
  r.seats.forEach((s, i) => (seats[order[i]!] ??= []).push(s));
}
const avg = (k: string, f: (s: SeatStats) => number) => seats[k]!.reduce((a, s) => a + f(s), 0) / seats[k]!.length;
for (const k of kinds) console.log(k.padEnd(10), "fronts/turn", avg(k, (s) => s.frontsPerTurn).toFixed(3), "took8", avg(k, (s) => s.took8).toFixed(2), "lost8", avg(k, (s) => s.lost8).toFixed(2), "forts+culture10", avg(k, (s) => s.forts10 + s.culture10).toFixed(2));
