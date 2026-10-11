import type { MapDef } from "@conquerra/content";
import { screenLine } from "@conquerra/content/lines";
import type { PlayerView, ReplayEvent } from "@conquerra/engine";
import { houseOf } from "../map/houses";
import { RESULT_AT, type Beat, type Timeline } from "./timeline";

/**
 * Title cards (session 21, docs/09 §1): a short banner across the top for the moments that matter, at most two a
 * turn: a capital falling ("Galeholt falls to House Gules"), a House knocked out ("House Vert is no more"), a deal
 * broken ("Lady Morwen breaks the truce"). Only for
 * what you saw: they're built from your replay's events, and a fogged event (a "surface" pulse) never gets one.
 * The language pass (session 22): your own big loss gets a plain title (your Leader comments in the report); a
 * rival's misfortune and a broken deal get a sarcastic subline under it (the line library's screens).
 */

export interface TitleCard {
  /** ms into the replay it shows, and for how long. */
  at: number;
  ms: number;
  text: string;
  /** A dry line under it (a rival's misfortune, a broken deal), or none. */
  sub?: string;
  /** The House it's about (its colour on the card), or null. */
  house: string | null;
  /** Higher first when there are too many. */
  weight: number;
  /** The event it's for: its small banner (toast) doesn't show as well (session 22: one headline per event). Null: the comeback, which is about the whole turn. */
  event: ReplayEvent | null;
}

/** At most this many a turn. */
export const MAX_CARDS = 2;
export const CARD_MS = 2200;

/**
 * `comeback`: your House is back from a quarter of its most land to over half of it (the host worked it out from your
 * own land; session 23). Its card plays as the replay ends, with a sarcastic subline.
 */
export function titleCards(tl: Timeline, before: PlayerView, map: MapDef, comeback = false): TitleCard[] {
  const me = before.me.id;
  const name = new Map(map.territories.map((t) => [t.id, t.name]));
  // Capitals this view knows of: yours, and any it has seen.
  const capitals = new Map<string, string>([[before.me.capital, me]]);
  for (const [id, t] of Object.entries(before.territories)) if (t.detail === "full" && t.capitalOf) capitals.set(id, t.capitalOf);
  const house = (p: string | null) => houseOf(before, p).name;
  const cards: TitleCard[] = [];
  const at = (b: Beat, share: number) => b.start + b.duration * share;
  // Which subline: the game's public id, the turn and the event (a replay or a reload says the same).
  let k = 0;
  const seed = () => `${before.gameId}|${before.turn}|title${k++}`;
  for (const b of tl.beats) {
    for (const e of b.events) {
      if (e.type === "battle" && e.captured && capitals.has(e.to)) {
        const owner = capitals.get(e.to)!;
        const yours = owner === me;
        const text = yours ? `${name.get(e.to)} falls to House ${house(e.player)}` : e.player === me ? `${name.get(e.to)} is yours` : `${name.get(e.to)} falls to House ${house(e.player)}`;
        const sub = !yours ? screenLine("titleCapitalFalls", seed(), { house: `House ${house(owner)}` }) : undefined;
        cards.push({ at: at(b, RESULT_AT), ms: CARD_MS, text, ...(sub ? { sub } : {}), house: e.player, weight: yours || e.player === me ? 3 : 2, event: e });
      } else if (e.type === "dealBroken") {
        const who = (p: string) => before.players.find((x) => x.id === p)?.name ?? "A House";
        const what = e.kind === "war" ? "joint war" : e.kind === "passage" ? "right of passage" : e.kind;
        const other = e.by === e.a ? e.b : e.a;
        const text = e.by === me ? `You break the ${what} with ${who(other)}` : `${who(e.by)} breaks the ${what}`;
        const sub = e.by !== me ? screenLine("titleDealBroken", seed()) : undefined;
        cards.push({ at: at(b, 0.2), ms: CARD_MS, text, ...(sub ? { sub } : {}), house: e.by, weight: e.by === me || other === me ? 3 : 1, event: e });
      } else if (e.type === "eliminated") {
        const text = e.player === me ? "Your House is no more" : `House ${house(e.player)} is no more`;
        const sub = e.player !== me ? screenLine("titleHouseOut", seed(), { house: `House ${house(e.player)}` }) : undefined;
        cards.push({ at: b.start, ms: CARD_MS, text, ...(sub ? { sub } : {}), house: e.player, weight: e.player === me || e.by === me ? 4 : 1, event: e });
      }
    }
  }
  // (Once a game, and your own: it outranks every other card that turn.)
  if (comeback) {
    const last = tl.beats.at(-1);
    const end = last ? last.start + last.duration : 0;
    cards.push({ at: Math.max(0, end - CARD_MS), ms: CARD_MS, text: `House ${house(me)} is back`, sub: screenLine("titleComeback", `${before.gameId}|${before.turn}|comeback`), house: me, weight: 5, event: null });
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
