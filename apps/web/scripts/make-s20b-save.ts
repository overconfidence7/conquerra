// Session 20b's screenshot save (docs/art/screens/s20b-save.json): a real Wyrmland game (you and 5 Marshals; a sharp
// stand-in plays your turns) to turn 12, then walls put in by hand so every case shows at once:
//  - your joined wall round five territories (your capital and four of its neighbours),
//  - a single walled territory of yours elsewhere,
//  - a rival's three-territory wall next to your army (the card's "Walled: N defend" and the odds preview),
//  - a rival's wall you saw two turns ago and can't see now (remembered, greyed).
// Culture 5 and a fort on each, walled as the engine would have them at the end of a turn. The history is dropped
// (the game no longer plays back move by move), the snapshot loads like any save.
//   pnpm --filter web exec tsx scripts/make-s20b-save.ts
import { writeFileSync } from "node:fs";
import { maps } from "@conquerra/content/maps";
import { makeMarshalBot } from "@conquerra/bots";
import { indexMap, updateIntel, viewFor, type GameState, type TerritoryId } from "@conquerra/engine";
import { HUMAN_ID, LocalGame } from "../src/host/localGame";

const you = makeMarshalBot("conqueror");
let t = Date.UTC(2026, 9, 8, 18, 0, 0);
const g = new LocalGame(maps.wyrmland!, { mapId: "wyrmland", bots: 5, botLevel: "marshal", luck: 0.3, fog: true, mode: "classic", turnSeconds: null, leaderName: "Aldric", stewardName: "Odo" }, "s20b-shots-1", () => t);
let u = g.update();
const state = () => (g as unknown as { state: GameState }).state;
while (state().turn < 12 && !u.view.winner) {
  const sighted = viewFor(g.ctx, { ...state(), settings: { ...state().settings, fog: false } }, HUMAN_ID);
  u = g.lockIn(you.plan(g.ctx, sighted));
  t += 60_000;
}
const s = state();
const idx = indexMap(g.ctx.map);
const land = (a: TerritoryId, b: TerritoryId) => idx.border(a, b) !== "sea";
const wall = (id: TerritoryId, troops?: number) => Object.assign(s.territories[id]!, { culture: 5, building: "fort", construction: null, walled: true, ...(troops ? { troops } : {}) });
const me = s.players.find((p) => p.id === HUMAN_ID)!;
const mine = (id: TerritoryId) => s.territories[id]!.owner === HUMAN_ID;
// Your five: the capital and four of your territories joined to it over land.
const five: TerritoryId[] = [me.capital];
for (let h = 0; h < five.length && five.length < 5; h++)
  for (const n of idx.neighbors.get(five[h]!)!) if (five.length < 5 && mine(n) && land(five[h]!, n) && !five.includes(n)) five.push(n);
for (const x of five) wall(x, Math.max(4, s.territories[x]!.troops));
// A single walled territory of yours, not touching the five.
const single = idx.ids.find((x) => mine(x) && !five.includes(x) && !five.some((f) => idx.neighbors.get(f)!.includes(x)) && !s.territories[x]!.building);
if (single) wall(single, 6);
// A rival's three next to your land (one of them touching yours).
const sees = (x: TerritoryId) => viewFor(g.ctx, s, HUMAN_ID).territories[x]!.detail === "full";
let rival: TerritoryId[] = [];
for (const x of idx.ids) {
  const o = s.territories[x]!.owner;
  if (!o || o === HUMAN_ID || !idx.neighbors.get(x)!.some(mine) || five.includes(x)) continue;
  const chain = [x];
  for (let h = 0; h < chain.length && chain.length < 3; h++)
    for (const n of idx.neighbors.get(chain[h]!)!) if (chain.length < 3 && s.territories[n]!.owner === o && land(chain[h]!, n) && !chain.includes(n)) chain.push(n);
  if (chain.length === 3) {
    rival = chain;
    break;
  }
}
rival.forEach((x, i) => wall(x, [5, 4, 4][i]));
// Your army next to it (for the odds preview).
const front = rival.length ? idx.neighbors.get(rival[0]!)!.find(mine) : undefined;
if (front) s.territories[front]!.troops = 24;
// A rival's wall you remember: two of a rival's territories out of sight, walled when you last saw them two turns ago.
const fogged = idx.ids.filter((x) => s.territories[x]!.owner && s.territories[x]!.owner !== HUMAN_ID && !sees(x) && !rival.includes(x));
const remembered: TerritoryId[] = [];
for (const x of fogged) {
  const n = idx.neighbors.get(x)!.find((y) => fogged.includes(y) && s.territories[y]!.owner === s.territories[x]!.owner && land(x, y) && idx.neighbors.get(y)!.every((z) => !sees(z) || !rival.includes(z)));
  if (n) {
    remembered.push(x, n);
    break;
  }
}
for (const x of remembered) {
  wall(x);
  s.intel[HUMAN_ID]![x] = { owner: s.territories[x]!.owner, troops: s.territories[x]!.troops, building: "fort", turn: s.turn - 2, walled: true };
}
updateIntel(g.ctx, s);
const save = g.snapshot({ app: "session-20b screenshots" });
delete (save as { history?: unknown }).history;
save.state = JSON.parse(JSON.stringify(s));
writeFileSync("../../docs/art/screens/s20b-save.json", JSON.stringify(save));
const name = (x: TerritoryId) => g.ctx.map.territories.find((m) => m.id === x)!.name;
console.log(JSON.stringify({ five, single, rival, front, remembered }));
console.log(`turn ${s.turn}: your five ${five.map(name).join(", ")}; single ${single ? name(single) : "-"}; rival's three ${rival.map(name).join(", ")}; remembered ${remembered.map(name).join(", ")}`);
