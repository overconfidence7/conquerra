import type { MapDef } from "@conquerra/content";
import type { PlayerView } from "@conquerra/engine";
import { houseOf } from "../map/houses";
import { RESULT_AT, type Beat, type Timeline } from "./timeline";

/**
 * Title cards (session 21, docs/09 §1): a short banner across the top for the moments that matter, at most two a
 * turn: a capital falling ("Galeholt falls to House Gules"), a House knocked out ("House Vert is no more"). Only for
 * what you saw: they're built from your replay's events, and a fogged event (a "surface" pulse) never gets one.
 * Plain words for now; the language pass (session 22) gives them their final voice.
 */

export interface TitleCard {
  /** ms into the replay it shows, and for how long. */
  at: number;
  ms: number;
  text: string;
  /** The House it's about (its colour on the card), or null. */
  house: string | null;
  /** Higher first when there are too many. */
  weight: number;
}

/** At most this many a turn. */
export const MAX_CARDS = 2;
export const CARD_MS = 2200;

export function titleCards(tl: Timeline, before: PlayerView, map: MapDef): TitleCard[] {
  const me = before.me.id;
  const name = new Map(map.territories.map((t) => [t.id, t.name]));
  // Capitals this view knows of: yours, and any it has seen.
  const capitals = new Map<string, string>([[before.me.capital, me]]);
  for (const [id, t] of Object.entries(before.territories)) if (t.detail === "full" && t.capitalOf) capitals.set(id, t.capitalOf);
  const house = (p: string | null) => houseOf(before, p).name;
  const cards: TitleCard[] = [];
  const at = (b: Beat, share: number) => b.start + b.duration * share;
  for (const b of tl.beats) {
    for (const e of b.events) {
      if (e.type === "battle" && e.captured && capitals.has(e.to)) {
        const yours = capitals.get(e.to) === me;
        const text = yours ? `Your capital, ${name.get(e.to)}, falls to House ${house(e.player)}` : e.player === me ? `${name.get(e.to)} falls to you` : `${name.get(e.to)} falls to House ${house(e.player)}`;
        cards.push({ at: at(b, RESULT_AT), ms: CARD_MS, text, house: e.player, weight: yours || e.player === me ? 3 : 2 });
      } else if (e.type === "eliminated") {
        const text = e.player === me ? "Your House is no more" : `House ${house(e.player)} is no more`;
        cards.push({ at: b.start, ms: CARD_MS, text, house: e.player, weight: e.player === me || e.by === me ? 4 : 1 });
      }
    }
  }
  // The most important ones, then in time order, and never two on screen at once.
  const kept: TitleCard[] = [];
  for (const c of [...cards].sort((a, b) => b.weight - a.weight || a.at - b.at)) {
    if (kept.length >= MAX_CARDS) break;
    if (kept.some((k) => Math.abs(k.at - c.at) < CARD_MS)) continue;
    kept.push(c);
  }
  return kept.sort((a, b) => a.at - b.at);
}

/** The card on screen at `t`, if any. */
export function cardAt(cards: readonly TitleCard[], t: number): TitleCard | null {
  return cards.find((c) => t >= c.at && t < c.at + c.ms) ?? null;
}
