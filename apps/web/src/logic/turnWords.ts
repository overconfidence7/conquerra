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

/** Session 33: everyone else's head start, for the first turn's report: "Head starts for the exposed spots: Kit +5, Lady Morwen +2." */
export function headStartsLine(view: PlayerView): string | null {
  const others = view.players.filter((p) => p.id !== view.me.id && (p.startBonus ?? 0) > 0).sort((a, b) => b.startBonus! - a.startBonus! || (a.name < b.name ? -1 : 1));
  return others.length ? `Head starts for the exposed spots: ${others.map((p) => `${p.name} +${p.startBonus}`).join(", ")}.` : null;
}
