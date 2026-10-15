import type { Answer } from "@conquerra/bots";
import type { Offer, PlayerId } from "@conquerra/engine";
import type { PeopleOffer } from "../host/protocol";
import { useGame } from "../store";

/**
 * Deals between people on the page (session 28). The room relays each offer to its other side and tells both sides
 * when it's answered, countered, withdrawn or lapses; this works out what the page says and shows. Loaded with the
 * online code and the deal card, never in the start-up bundle.
 */

/** What the page says when an offer between people changes (the voice guide applies; players' notes are their own). */
export const PEOPLE_DEAL_NEWS = {
  accepted: (who: string) => `${who} accepted your offer. It starts as the turn plays.`,
  declined: (who: string) => `${who} said no.`,
  countered: (who: string) => `${who} sent a counteroffer. Open it from the top of the map.`,
  lapsed: (who: string) => `${who} locked in without answering, so your offer lapses.`,
  withdrawn: (who: string) => `${who} withdrew the offer.`,
} as const;

/** The deal card's lines for an offer you sent a person, by where it stands. */
export const PEOPLE_DEAL_STATUS = {
  open: (who: string) => `Sent to ${who}. ${who} answers in their own planning window, or it lapses when they lock in.`,
  accepted: (who: string) => `${who} accepted: it starts as the turn plays, before any move.`,
  declined: (who: string) => `${who} said no.`,
  countered: (who: string) => `${who} sent a counteroffer.`,
  lapsed: (who: string) => `${who} locked in without answering. It lapses.`,
  withdrawn: () => "You withdrew it.",
  lockedIn: (who: string) => `${who} has locked in, so offers to them wait for next turn.`,
} as const;

/** The same, short, for the Houses panel's row. */
export const PEOPLE_DEAL_SHORT = {
  open: (who: string) => `waiting for ${who}'s answer.`,
  accepted: (who: string) => `${who} accepted.`,
  declined: (who: string) => `${who} said no.`,
  countered: (who: string) => `${who} sent a counteroffer.`,
  lapsed: () => "lapsed (no answer).",
  withdrawn: () => "withdrawn.",
} as const;

type State = PeopleOffer["state"] | NonNullable<PeopleOffer["counterState"]>;

/** Where one of your own offers to a person stands (the original, or your counter), or null if it isn't yours. */
export function myOfferState(talks: readonly PeopleOffer[], offerId: string, me: PlayerId): State | null {
  for (const r of talks) {
    if (r.offer.from === me && r.offer.id === offerId) return r.state;
    if (r.counter?.from === me && r.counter.id === offerId) return r.counterState ?? "open";
  }
  return null;
}

/** The lines to show for what changed between two sets of talks, from \`me\`'s side. New offers to you show as toasts. */
export function talkNews(before: readonly PeopleOffer[], after: readonly PeopleOffer[], me: PlayerId, nameOf: (p: PlayerId) => string): string[] {
  const lines: string[] = [];
  for (const r of after) {
    const was = before.find((x) => x.offer.from === r.offer.from && x.offer.id === r.offer.id);
    const changed = (r.state !== (was?.state ?? "open"));
    if (r.offer.from === me && changed && r.state !== "open" && r.state !== "withdrawn") lines.push(PEOPLE_DEAL_NEWS[r.state](nameOf(r.offer.to)));
    if (r.offer.to === me && changed && r.state === "withdrawn") lines.push(PEOPLE_DEAL_NEWS.withdrawn(nameOf(r.offer.from)));
    if (r.counter) {
      const cs = r.counterState ?? "open";
      const cwas = was?.counter ? (was.counterState ?? "open") : "open";
      if (cs === cwas) continue;
      if (r.counter.from === me && cs !== "open" && cs !== "withdrawn") lines.push(PEOPLE_DEAL_NEWS[cs](nameOf(r.counter.to)));
      if (r.counter.to === me && cs === "withdrawn") lines.push(PEOPLE_DEAL_NEWS.withdrawn(nameOf(r.counter.from)));
    }
  }
  return lines;
}

/** Offers (and counters) from people still waiting on my answer. */
export const openToMe = (talks: readonly PeopleOffer[], me: PlayerId): Offer[] =>
  talks.flatMap((r) => [...(r.offer.to === me && r.state === "open" ? [r.offer] : []), ...(r.counter && r.counter.to === me && (r.counterState ?? "open") === "open" ? [r.counter] : [])]);

/**
 * The room's latest talks, on the page: the offers waiting on you (the bots' stay as they are), your offers a person
 * accepted counted as agreed (the map, the warnings), and an offer card closed if its offer was withdrawn. Returns
 * the lines to show.
 */
export function applyTalks(talks: PeopleOffer[]): string[] {
  const s = useGame.getState();
  const view = s.view;
  if (!view) return [];
  const me = view.me.id;
  const nameOf = (p: PlayerId) => view.players.find((x) => x.id === p)?.name ?? p;
  const news = talkNews(s.talks, talks, me, nameOf);
  const people = new Set(s.people ?? []);
  const open = openToMe(talks, me);
  // (Offers you've answered stay listed, so the page knows what you agreed: your answer is in your orders.)
  const answered = talks.flatMap((r) => [...(r.offer.to === me && (r.state === "accepted" || r.state === "declined") ? [r.offer] : []), ...(r.counter && r.counter.to === me && (r.counterState === "accepted" || r.counterState === "declined") ? [r.counter] : [])]);
  const offers = [...s.offers.filter((o) => !people.has(o.from)), ...open, ...answered];
  const answers: Record<string, Answer> = { ...s.answers };
  for (const r of talks) {
    if (r.offer.from === me) {
      if (r.state === "accepted") answers[r.offer.id] = { accept: true, reason: "" };
      else delete answers[r.offer.id];
    }
    if (r.counter?.from === me) {
      if (r.counterState === "accepted") answers[r.counter.id] = { accept: true, reason: "" };
      else delete answers[r.counter.id];
    }
  }
  // An offer card showing an offer that isn't open any more closes (it was withdrawn, or you answered elsewhere).
  const d = s.deal;
  const gone = d?.mode === "offer" && people.has(d.offer.from) && !open.some((o) => o.from === d.offer.from && o.id === d.offer.id) && !s.diplomacy.some((o) => o.kind === "answer" && o.from === d.offer.from && o.offer === d.offer.id);
  useGame.setState({ talks, offers, answers, ...(gone ? { deal: null, dealPick: null } : {}) });
  return news;
}

/** Take back an offer you made a person (before you lock in): it leaves your orders, and the room tells them. */
export async function withdrawOffer(offer: Offer) {
  const { host, diplomacy } = useGame.getState();
  useGame.setState({ diplomacy: diplomacy.filter((o) => !(o.kind === "propose" && o.offer.id === offer.id)) });
  try {
    await host?.withdrawOffer?.(offer.id);
  } catch (e) {
    useGame.setState({ error: e instanceof Error ? e.message : String(e) });
  }
}
