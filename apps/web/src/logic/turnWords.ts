import { CLOUD } from "../map/status";
import type { PlayerView } from "@conquerra/engine";
import type { Namer } from "./text";

/**
 * Session 33: the words for blackout's cloud and the first turn's head starts, apart from text.ts (which loads with
 * the lobby): only the game screen's report, log and cards use them.
 */

/**
 * Session 33, blackout fog: a crossing or a border between two places, as a person reads it. With land under the
 * cloud on one side: "the river crossing from Dawnrest into the cloud" (never the cloud land's name); both: "a river
 * crossing in the cloud".
 */
export function crossingWords(n: Namer, what: string, a: string, b: string): string {
  const [pa, pb] = [n.place(a), n.place(b)];
  if (pa === CLOUD && pb === CLOUD) return `a ${what} in the cloud`;
  if (pa === CLOUD || pb === CLOUD) return `the ${what} from ${pa === CLOUD ? pb : pa} into the cloud`;
  return `the ${what} between ${pa} and ${pb}`;
}

/** Session 33: "from Ashfell", or "out of the cloud" for land you've never seen (blackout). */
export const fromWords = (n: Namer, id: string) => (n.place(id) === CLOUD ? "out of the cloud" : `from ${n.place(id)}`);
/** Session 33: places on the way, "the cloud" once however many of them are under it. */
export const wayWords = (n: Namer, ids: readonly string[]) => [...new Set(ids.map((t) => n.place(t)))].join(" and ");

/**
 * Session 33b: what a capital started with besides troops (a random map's income head start, version 5), in words:
 * "a market", "a market and a level of culture"; empty without one.
 */
const andList = (xs: readonly string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}` : xs.join(""));
function startExtras(p: { startBuilding?: string; startCulture?: number }): string[] {
  const out: string[] = [];
  if (p.startBuilding === "market") out.push("a market");
  if (p.startCulture) out.push(p.startCulture === 1 ? "a level of culture" : `${p.startCulture} levels of culture`);
  return out;
}

/**
 * The start bonus (session 23), in a line: "Rookhome starts with 4 extra troops (an exposed spot)." Session 33b: and
 * its market ("Stoneshire starts with 6 extra troops and a market (an exposed spot)."). Null without one. (Moved here
 * from text.ts in 33b: only the game screen uses it.)
 */
export function startBonusLine(view: PlayerView, place: (id: string) => string): string | null {
  const n = view.me.startBonus ?? 0;
  const what = [...(n > 0 ? [`${n} extra troop${n === 1 ? "" : "s"}`] : []), ...startExtras(view.me)];
  return what.length ? `${place(view.me.capital)} starts with ${andList(what)} (an exposed spot).` : null;
}

/**
 * Session 33: everyone else's head start, for the first turn's report: "Head starts for the exposed spots: Kit +5, Lady
 * Morwen +2." Session 33b: "Baron Krell +6 with a market and a level of culture, Queen Isolde +1."
 */
export function headStartsLine(view: PlayerView): string | null {
  const others = view.players.filter((p) => p.id !== view.me.id && ((p.startBonus ?? 0) > 0 || startExtras(p).length)).sort((a, b) => (b.startBonus ?? 0) - (a.startBonus ?? 0) || (a.name < b.name ? -1 : 1));
  const one = (p: (typeof others)[number]) => {
    const extras = startExtras(p);
    return `${p.name}${p.startBonus ? ` +${p.startBonus}` : ""}${extras.length ? ` with ${andList(extras)}` : ""}`;
  };
  return others.length ? `Head starts for the exposed spots: ${others.map(one).join(", ")}.` : null;
}
