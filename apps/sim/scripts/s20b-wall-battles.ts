/**
 * Session 20b: what a battle at a wall looks like in bot games (the attacker's army, the wall's own troops and what
 * it lent), and how walled land is held between battles.
 *   npx tsx apps/sim/scripts/s20b-wall-battles.ts <map:players> <games> <seats...>
 */
import { maps } from "@conquerra/content/maps";
import { defaultRules } from "@conquerra/content";
import { playTable } from "@conquerra/simcore";
import { botFor, seatsFor, stylesOf } from "../src/tournament";

const [table = "wyrmland:6", games = "40", ...seatArgs] = process.argv.slice(2);
const [map, n] = table.split(":") as [string, string];
const players = Number(n);
const seats = seatArgs.length ? seatArgs : ["marshal-turtle+walls39", "marshal"];
const spec = { map, players, seats: [...seats.slice(0, -1), ...Array(players - seats.length + 1).fill(seats[seats.length - 1])], games: Number(games), seed: "s20b-wb", fog: true, diplomacy: true };
const ctx = { map: maps[map]!, rules: defaultRules };
let battles = 0, held = 0, atk = 0, own = 0, lent = 0, lenders = 0, deterred = 0;
const walledTroops: number[] = [];
for (let i = 0; i < spec.games; i++) {
  const seed = `${spec.seed}-${i}`;
  const kinds = seatsFor(spec, i, seed);
  playTable(ctx, seed, kinds.map((k) => botFor(k)), {
    settings: { fog: true, diplomacy: true },
    styles: kinds.map(stylesOf),
    onTurn: (s) => {
      for (const t of Object.values(s.territories)) if (t.walled) walledTroops.push(t.troops);
    },
    onEvents: (_b, events) => {
      for (const e of events) {
        if (e.type !== "battle" || !e.wall) continue;
        battles++;
        if (!e.captured) held++;
        atk += e.attackers.troops;
        const l = e.wall.lent.reduce((a, x) => a + x.troops, 0);
        lent += l;
        own += e.defenders.troops - l;
        lenders += e.wall.lent.length;
      }
    },
  });
}
const avg = (x: number) => (battles ? (x / battles).toFixed(1) : "-");
walledTroops.sort((a, b) => a - b);
console.log(`${table} ${games} games (${seats.join(", ")}): ${battles} wall battles, held ${held}; attacker ${avg(atk)}, the wall's own ${avg(own)}, lent ${avg(lent)} by ${avg(lenders)} lenders | walled land each turn: troops median ${walledTroops[Math.floor(walledTroops.length / 2)] ?? "-"}, 75th ${walledTroops[Math.floor(walledTroops.length * 0.75)] ?? "-"}, ${walledTroops.length} territory-turns`);
void deterred;
