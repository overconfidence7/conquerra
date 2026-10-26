/**
 * Session 35 (Nate's call, Oct 20): the strong spots go to bots first. Marks, for every table session 34b measured on
 * Rootholm and Krakenmere (8 to 20 seats) and Krakenmere 14 (session 35's search), the spots that win more than twice
 * their fair share on fresh games, and writes them as layout version 3 (`packages/content/data/maps/layout-versions.json`):
 * each table that gains a mark gets its layout as it ships now (spots and head start unchanged) with `strong` beside
 * it, so a game made before keeps its deal (version 2 or 1) and its history replays.
 *
 *   npx tsx apps/sim/scripts/s35-strong.ts [--dry]
 *
 * The shares: the proof on fresh games (300, `proof ... new` for a table version 2 changed or session 35 pinned,
 * `proof ... today` for one left as it was) and the second proof where there is one (600 more, `s34b-confirm.txt` or
 * `s35-confirm.txt`), weighted by games.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { maps } from "@conquerra/content/maps";
import { layoutFor } from "@conquerra/engine";

const root = join(import.meta.dirname, "../../..");
const dry = process.argv.includes("--dry");
const file = join(root, "packages/content/data/maps/layout-versions.json");
type Layout = { players: number; slots: string[]; bonus?: Record<string, number>; strong?: string[] };
const versions = JSON.parse(readFileSync(file, "utf8")) as Record<string, Record<string, { maxPlayers: number; layouts: Layout[] }>>;
const v2 = versions["2"]!;
const TABLES = [
  ["rootholm", 8, "s34b"], ["rootholm", 10, "s34b"], ["rootholm", 12, "s34b"], ["rootholm", 16, "s34b"], ["rootholm", 20, "s34b"],
  ["krakenmere", 8, "s34b"], ["krakenmere", 10, "s34b"], ["krakenmere", 12, "s34b"], ["krakenmere", 13, "s34b"], ["krakenmere", 14, "s35"],
] as const;

const v3: Record<string, { maxPlayers: number; layouts: Layout[] }> = {};
for (const [id, n, tag] of TABLES) {
  const text = readFileSync(join(root, `docs/sims/${tag}-layouts-${id}${n}.txt`), "utf8");
  // Which layout ships today: the search's ("new") where version 2 changed the table or session 35 pinned it, else
  // the one before ("today").
  const changed = tag === "s35" || !!v2[id]?.layouts.some((l) => l.players === n);
  const which = changed ? "new" : "today";
  const proof = new RegExp(`^proof ${id}:${n} ${which}: (.*)$`, "m").exec(text)?.[1];
  if (!proof) throw new Error(`${tag}-layouts-${id}${n}.txt: no "proof ${which}" line`);
  const share = new Map<string, number>();
  for (const m of proof.split(" | ")[0]!.matchAll(/\((t\d+)(?: \+\d)?\) ([\d.]+)%/g)) share.set(m[1]!, Number(m[2]) / 100);
  let games = 300;
  // The second proof (600 games): its shares in the layout's own order (today: the map's own layout; new: the pin).
  const cf = join(root, `docs/sims/${tag}-confirm.txt`);
  const line = existsSync(cf) ? readFileSync(cf, "utf8").split("\n").find((l) => l.startsWith(`confirm ${id}:${n} (`) && l.includes(`) ${which}: `)) : undefined;
  if (line) {
    const order = which === "new" ? (JSON.parse(/^(?:pin|keep) \S+: (\[.*?\])/m.exec(text)![1]!) as string[]) : layoutFor(maps[id]!, n, 1)!.slots;
    const more = line.split(" | ")[1]!.split(" / ").map((x) => Number(x.replace("%", "")) / 100);
    order.forEach((t, i) => share.set(t, (share.get(t)! * 300 + more[i]! * 600) / 900));
    games = 900;
  }
  // (Session 35's own table ships the search's pin with its bonus; the others as layout version 2 deals them.)
  const pinned = (): Layout => {
    const b = JSON.parse(/^bonus \S+: (\{.*\})$/m.exec(text)![1]!) as Record<string, number>;
    return { players: n, slots: JSON.parse(/^(?:pin|keep) \S+: (\[.*?\])/m.exec(text)![1]!) as string[], ...(Object.keys(b).length ? { bonus: b } : {}) };
  };
  const ships = tag === "s35" ? pinned() : layoutFor(maps[id]!, n, 2)!;
  if ([...share.keys()].sort().join() !== [...ships.slots].sort().join()) throw new Error(`${id}:${n}: the sims' spots aren't the layout that ships`);
  const strong = ships.slots.filter((t) => share.get(t)! > 2 / n);
  console.log(`${id}:${n} (${games} games, fair ${(100 / n).toFixed(1)}%): strong ${strong.map((t) => `${maps[id]!.territories.find((x) => x.id === t)!.name} (${t}) ${(100 * share.get(t)!).toFixed(1)}%`).join(", ") || "none"}${strong.some((t) => ships.bonus?.[t]) ? " (one has a start bonus)" : ""}`);
  if (!strong.length && tag !== "s35") continue;
  const entry = (v3[id] ??= { maxPlayers: 0, layouts: [] });
  entry.layouts.push({ ...ships, ...(strong.length ? { strong } : {}) });
  entry.maxPlayers = Math.max(entry.maxPlayers, n);
}
if (!dry) {
  versions["3"] = v3;
  writeFileSync(file, `${JSON.stringify(versions, null, 1)}\n`);
  console.log(`layout-versions.json: version 3, ${Object.entries(v3).map(([m, e]) => `${m} ${e.layouts.map((l) => l.players).join("/")}`).join(", ")}`);
}
