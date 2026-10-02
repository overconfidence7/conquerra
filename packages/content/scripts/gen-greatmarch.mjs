// Generates data/maps/greatmarch.json: an 80-territory test map for up to 10 players.
// Deterministic (no Math.random), so re-running gives the same file.
//   node packages/content/scripts/gen-greatmarch.mjs
import { writeFileSync } from "node:fs";

const COLS = 10, ROWS = 8;
const hash = (n) => {
  let x = (n * 2654435761) >>> 0;
  x = (x ^ (x >>> 15)) >>> 0; x = Math.imul(x, 2246822507) >>> 0; x = (x ^ (x >>> 13)) >>> 0;
  return x / 4294967296;
};
const terrainFor = (i) => {
  const r = hash(i + 7);
  return r < 0.5 ? "plains" : r < 0.68 ? "forest" : r < 0.82 ? "hills" : r < 0.9 ? "mountains" : "swamp";
};
const syllA = ["Ash", "Bram", "Cold", "Dun", "Elm", "Frost", "Gold", "Hollow", "Iron", "Kings", "Long", "Mire", "North", "Oak", "Pine", "Raven", "Stone", "Thorn", "Wolf", "Yew"];
const syllB = ["ford", "moor", "watch", "mere", "holt", "wick", "port", "fell", "gate", "vale", "reach", "barrow", "hearth", "march"];
const id = (r, c) => `g${String(r * COLS + c).padStart(2, "0")}`;

const provinceNames = ["Amberfold", "Brightwater", "Cinderhold", "Dawnmere", "Emberlands", "Farrow", "Greywood", "Highcrown", "Ivoryshore", "Jadefen",
  "Kestrel Downs", "Lowmarch", "Mistvale", "Nettlebrook", "Oldkeep", "Pale Steppe", "Queensreach", "Redcliff", "Silverrun", "Thornwall"];
const provinces = [];
const territories = [];
const used = new Set();
for (let r = 0; r < ROWS; r++)
  for (let c = 0; c < COLS; c++) {
    const i = r * COLS + c;
    const p = Math.floor(r / 2) * (COLS / 2) + Math.floor(c / 2);
    let name;
    for (let k = 0; ; k++) {
      name = syllA[Math.floor(hash(i * 31 + k) * syllA.length)] + syllB[Math.floor(hash(i * 17 + k * 5 + 3) * syllB.length)];
      if (!used.has(name)) break;
    }
    used.add(name);
    territories.push({ id: id(r, c), name, province: `p${p}`, terrain: terrainFor(i), x: 60 + c * 100 + (r % 2) * 50, y: 60 + r * 90 });
  }
for (let p = 0; p < 20; p++) provinces.push({ id: `p${p}`, name: provinceNames[p], bonus: hash(p + 101) < 0.5 ? 2 : 3 });

const borders = [];
const add = (a, b) => {
  const ta = territories.find((t) => t.id === a), tb = territories.find((t) => t.id === b);
  const rough = ["mountains", "hills"].includes(ta.terrain) || ["mountains", "hills"].includes(tb.terrain);
  const h = hash(borders.length * 13 + 5);
  const type = rough && h < 0.5 ? "pass" : !rough && h < 0.08 ? "river" : "normal";
  borders.push({ a, b, type });
};
for (let r = 0; r < ROWS; r++)
  for (let c = 0; c < COLS; c++) {
    if (c + 1 < COLS) add(id(r, c), id(r, c + 1));
    if (r + 1 < ROWS) {
      add(id(r, c), id(r + 1, c));
      // offset rows: even rows also touch down-left, odd rows down-right (a hex-like grid)
      const dc = r % 2 === 0 ? -1 : 1;
      if (c + dc >= 0 && c + dc < COLS) add(id(r, c), id(r + 1, c + dc));
    }
  }

const capitalSlots = [id(0, 0), id(0, 4), id(0, 9), id(2, 2), id(2, 7), id(5, 2), id(5, 7), id(7, 0), id(7, 5), id(7, 9), id(3, 5), id(4, 0)];

const map = { id: "greatmarch", name: "Greatmarch (test map, up to 10 players)", minPlayers: 2, maxPlayers: 10, recommendedPlayers: { min: 8, max: 10 }, territories, provinces, borders, capitalSlots };
writeFileSync(new URL("../data/maps/greatmarch.json", import.meta.url), JSON.stringify(map, null, 1) + "\n");
console.log(`greatmarch: ${territories.length} territories, ${borders.length} borders, ${provinces.length} provinces`);
