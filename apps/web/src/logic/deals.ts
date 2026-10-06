import type { Answer } from "@conquerra/bots";
import {
  bindingCost,
  coveredBorders,
  covers,
  DEAL_NAME,
  dealSize,
  dealTurns,
  defaultTerms,
  indexMap,
  isParty,
  oathPenalty,
  otherSide,
  passageFor,
  type Bond,
  type DealKind,
  type DealTerms,
  type DealView,
  type GameContext,
  type Offer,
  type Order,
  type PlayerId,
  type PlayerView,
  type TerritoryId,
} from "@conquerra/engine";

/**
 * Diplomacy on the page (session 14). Small and pure, so the tap counts, the warnings and what shows when are tested
 * without a screen. The deals themselves are played by the engine; the bots' answers come from the host.
 */

/** Who holds a territory as far as you know: what you see, else what you last saw. */
export const ownerFrom =
  (view: PlayerView) =>
  (t: TerritoryId): PlayerId | null => {
    const v = view.territories[t];
    return v?.detail === "full" ? v.owner : (v?.lastSeen?.owner ?? null);
  };

const nameOf = (view: PlayerView, p: PlayerId) => (p === view.me.id ? "you" : (view.players.find((x) => x.id === p)?.name ?? p));
const living = (view: PlayerView) => view.players.filter((p) => p.eliminatedTurn === null);

/** Can you make deals right now (diplomacy on, still in, game going)? */
export const canDeal = (view: PlayerView) => view.settings.diplomacy !== false && view.winner === null && view.players.find((p) => p.id === view.me.id)?.eliminatedTurn === null;
/** Can you propose a deal to `p`? (A living rival: the Fallen don't make deals.) */
export const canProposeTo = (view: PlayerView, p: PlayerId) => canDeal(view) && p !== view.me.id && living(view).some((x) => x.id === p);

/** A fresh offer to `to`, with the deal card's defaults filled in (a plain truce by default). */
export function newOffer(ctx: GameContext, view: PlayerView, to: PlayerId, kind: DealKind = "truce", n = 1): Offer {
  const rivals = living(view).filter((p) => p.id !== view.me.id && p.id !== to);
  let terms = defaultTerms(ctx.rules, kind, rivals[0]?.id);
  if (terms.kind === "trade") terms = { kind: "trade", give: { gold: Math.max(0, Math.min(10, view.me.gold)) }, get: {} };
  return { id: `${view.me.id}-t${view.turn}-${n}`, from: view.me.id, to, terms, bond: "handshake" };
}

/** What each side pays up front for a binding pact on these terms (worked out as the engine will, from what you see). */
export const bindingPrice = (ctx: GameContext, view: PlayerView, o: Offer) => bindingCost(ctx.rules, dealSize(ctx.rules, indexMap(ctx.map), o.terms, o.from, o.to, ownerFrom(view)));

/** What breaking a handshake deal on these terms would cost, in plain words ("about 16 gold and unrest"). */
export function breakPrice(ctx: GameContext, view: PlayerView, o: Offer): string {
  const { fine } = oathPenalty(ctx.rules, dealSize(ctx.rules, indexMap(ctx.map), o.terms, o.from, o.to, ownerFrom(view)));
  return `about ${fine} gold and unrest`;
}

/**
 * Deals both sides have confirmed this planning phase, from your side: offers of yours a bot accepted, and offers to
 * you that you accepted. They start as the turn plays, before any move.
 */
export function agreedThisTurn(view: PlayerView, diplomacy: readonly Order[], answers: Readonly<Record<string, Answer>>, offers: readonly Offer[]): Offer[] {
  const out: Offer[] = [];
  for (const o of diplomacy) {
    if (o.kind === "propose" && answers[o.offer.id]?.accept) out.push(o.offer);
    if (o.kind === "answer" && o.accept) {
      const offer = offers.find((x) => x.from === o.from && x.id === o.offer);
      if (offer && offer.to === view.me.id) out.push(offer);
    }
  }
  return out;
}

/** A deal as the page reasons about it: in force, or agreed this turn (`pending`). */
export type PageDeal = DealView & { pending?: boolean };

/** Deals in force, plus the ones agreed this turn (with their terms: they're yours). */
export function dealsNow(ctx: GameContext, view: PlayerView, agreed: readonly Offer[]): PageDeal[] {
  const idx = indexMap(ctx.map);
  const owner = ownerFrom(view);
  const pending: PageDeal[] = agreed.map((o) => ({
    id: `agreed-${o.from}-${o.id}`,
    kind: o.terms.kind,
    bond: o.bond,
    a: o.from,
    b: o.to,
    start: view.turn,
    last: view.turn + dealTurns(o.terms) - 1,
    terms: o.terms,
    size: dealSize(ctx.rules, idx, o.terms, o.from, o.to, owner),
    borders: coveredBorders(idx, { a: o.from, b: o.to, terms: o.terms }, owner),
    ...(o.terms.kind === "passage" ? { mutual: o.terms.mutual, passage: passageLandSeen(view, o.from, o.to, o.terms.mutual) } : {}),
    pending: true,
  }));
  return [...view.deals, ...pending];
}

/** The land you can see that armies may pass through under a passage deal between `a` (who asked) and `b`. */
function passageLandSeen(view: PlayerView, a: PlayerId, b: PlayerId, mutual: boolean): TerritoryId[] {
  const grantors = mutual ? [a, b] : [b];
  return Object.entries(view.territories)
    .filter(([, v]) => v.detail === "full" && !!v.owner && grantors.includes(v.owner))
    .map(([t]) => t);
}

/** Whose land you may march through right now: deals in force and the ones agreed this turn (they start before any move). */
export const passageNow = (view: PlayerView, deals: readonly PageDeal[]): PlayerId[] =>
  passageFor(
    deals.filter((d) => d.terms).map((d) => ({ a: d.a, b: d.b, terms: d.terms! })),
    view.me.id,
  );

/**
 * Passage land on the map (session 15): every territory an army may pass through under a passage deal, where you can
 * see it. `open`: you may pass through it yourself. `pending`: agreed this turn.
 */
export function passageLines(view: PlayerView, deals: readonly PageDeal[]): { territory: TerritoryId; open: boolean; pending: boolean }[] {
  const open = new Set(passageNow(view, deals));
  const out = new Map<TerritoryId, { territory: TerritoryId; open: boolean; pending: boolean }>();
  for (const d of deals) {
    if (d.kind !== "passage") continue;
    for (const t of d.passage ?? []) {
      const v = view.territories[t];
      const mine = v?.detail === "full" && !!v.owner && open.has(v.owner);
      const prev = out.get(t);
      out.set(t, { territory: t, open: mine || !!prev?.open, pending: !!d.pending && (prev?.pending ?? true) });
    }
  }
  return [...out.values()];
}

export type AttackCheck = { block: string } | { warn: string } | null;

/**
 * An attack you're drafting from `from` into `to`, across a deal of yours: a binding pact can't be crossed (the game
 * won't queue it, and says why); a handshake truce can, but it breaks the deal, and the warning says what that costs.
 */
export function attackCheck(ctx: GameContext, view: PlayerView, deals: readonly PageDeal[], from: TerritoryId, to: TerritoryId): AttackCheck {
  const idx = indexMap(ctx.map);
  const owner = ownerFrom(view);
  const mine = deals.filter((d) => d.terms && isParty(d, view.me.id) && (d.kind === "truce" || d.kind === "war"));
  const hit = mine.filter((d) => covers(idx, d as Parameters<typeof covers>[1], from, to, owner));
  if (!hit.length) return null;
  const binding = hit.find((d) => d.bond === "binding");
  const d = binding ?? hit[0]!;
  const who = view.players.find((p) => p.id === otherSide(d, view.me.id))?.name ?? "them";
  const kind = DEAL_NAME[d.kind];
  if (binding) return { block: `You have a binding pact with ${who}: the game won't let this attack go.` };
  const { fine } = oathPenalty(ctx.rules, d.size ?? 0);
  return { warn: `This breaks your ${kind} with ${who}: Oathbreaker, about ${fine} gold and unrest.` };
}

/** One mark in the Players panel: a deal between this player and another (a seal on a binding one), and turns left. */
export interface DealMark {
  id: string;
  kind: DealKind;
  bond: Bond;
  with: PlayerId;
  turnsLeft: number;
  pending: boolean;
  /** A joint war's target. */
  target?: PlayerId;
}

/** The deal marks for player `p`: every deal they're in (public), soonest to end first. */
export function dealMarks(view: PlayerView, deals: readonly PageDeal[], p: PlayerId): DealMark[] {
  return deals
    .filter((d) => isParty(d, p))
    .map((d) => ({ id: d.id, kind: d.kind, bond: d.bond, with: otherSide(d, p), turnsLeft: d.last - view.turn + 1, pending: !!d.pending, ...(d.target || d.terms?.kind === "war" ? { target: d.target ?? (d.terms as Extract<DealTerms, { kind: "war" }>).target } : {}) }))
    .sort((x, y) => x.turnsLeft - y.turnsLeft || (x.id < y.id ? -1 : 1));
}

/** "Truce, 3 turns", "Joint war on Baron Krell, 2 turns", "Trade (starts this turn)". */
export function markText(view: PlayerView, m: DealMark): string {
  const kind = m.kind === "war" && m.target ? `Joint war on ${nameOf(view, m.target)}` : DEAL_NAME[m.kind][0]!.toUpperCase() + DEAL_NAME[m.kind].slice(1);
  if (m.pending) return `${kind} (starts this turn)`;
  return `${kind}, ${m.turnsLeft} turn${m.turnsLeft === 1 ? "" : "s"} left`;
}

/** Is this player marked an Oathbreaker right now? */
export const isOathbreaker = (view: PlayerView, p: PlayerId) => (view.players.find((x) => x.id === p)?.oathbreaker ?? 0) >= view.turn;

/** Which terms a counteroffer changed from the offer it answers (marked on the card). */
export function changedTerms(from: Offer, to: Offer): Set<string> {
  const out = new Set<string>();
  if (from.bond !== to.bond) out.add("bond");
  const a = from.terms, b = to.terms;
  if (a.kind !== b.kind) return out.add("kind");
  if ("turns" in a && "turns" in b && a.turns !== b.turns) out.add("turns");
  if (a.kind === "truce" && b.kind === "truce" && (JSON.stringify(a.scope) !== JSON.stringify(b.scope) || a.until !== b.until)) out.add("scope");
  if (a.kind === "war" && b.kind === "war" && a.target !== b.target) out.add("target");
  if (a.kind === "passage" && b.kind === "passage" && a.mutual !== b.mutual) out.add("scope");
  if (a.kind === "trade" && b.kind === "trade") {
    // A counter comes from the other side: their "give" is what the first offer called "get".
    const same = from.from === to.from;
    const [ga, gb] = same ? [a.give, a.get] : [a.get, a.give];
    if (JSON.stringify(ga) !== JSON.stringify(b.give)) out.add("give");
    if (JSON.stringify(gb) !== JSON.stringify(b.get)) out.add("get");
  }
  return out;
}

/** Your counteroffer to an offer: the same card from your side (a trade's sides swap), ready to change. */
export function counterFrom(view: PlayerView, o: Offer, n: number): Offer {
  const terms: DealTerms = o.terms.kind === "trade" ? { ...o.terms, give: { ...o.terms.get }, get: { ...o.terms.give } } : JSON.parse(JSON.stringify(o.terms));
  return { id: `${view.me.id}-t${view.turn}-${n}`, from: view.me.id, to: o.from, terms, bond: o.bond, counterTo: o.id };
}

/** The truce lines to draw on the map: every border a truce (or a joint war's truce) covers, where you can see it. */
export function truceLines(deals: readonly PageDeal[]): { a: TerritoryId; b: TerritoryId; bond: Bond; pending: boolean }[] {
  const out: { a: TerritoryId; b: TerritoryId; bond: Bond; pending: boolean }[] = [];
  const seen = new Set<string>();
  for (const d of deals) {
    if (d.kind !== "truce" && d.kind !== "war") continue;
    for (const [a, b] of d.borders) {
      const k = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ a, b, bond: d.bond, pending: !!d.pending });
    }
  }
  return out;
}

/** Offers to you still waiting for your answer (Accept, Counter or Decline before you lock in, or they lapse). */
export function waitingOffers(offers: readonly Offer[], diplomacy: readonly Order[]): Offer[] {
  return offers.filter((o) => !diplomacy.some((x) => x.kind === "answer" && x.from === o.from && x.offer === o.id));
}

/** Where a trade's land may come from: `giver`'s land next to `receiver`'s, as far as you can see (never a capital). */
export function tradeableLand(ctx: GameContext, view: PlayerView, giver: PlayerId, receiver: PlayerId): TerritoryId[] {
  const idx = indexMap(ctx.map);
  const owner = ownerFrom(view);
  return idx.ids.filter((t) => {
    const v = view.territories[t];
    if (v?.detail !== "full" || v.owner !== giver || v.capitalOf || t === view.me.capital) return false;
    return (idx.neighbors.get(t) ?? []).some((n) => owner(n) === receiver);
  });
}
