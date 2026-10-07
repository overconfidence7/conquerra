import type { Personality } from "@conquerra/content";
import {
  between,
  bindingCost,
  DEAL_NAME,
  dealSize,
  indexMap,
  oathPenalty,
  otherSide,
  previewAttack,
  termsProblem,
  type DealKind,
  type DealTerms,
  type GameContext,
  type Offer,
  type Order,
  type PlayerId,
  type PlayerView,
  type ReplayEvent,
  type TerritoryId,
} from "@conquerra/engine";
import { attackingPartner, captainWeighs, dealBoard, frontWith, helpsProposer, leads, namesFor, proposeOffers, trustIn, type Answer } from "../diplomacy";
import type { Insight } from "./judge";
import { marshalBoard } from "./plan";

/**
 * The Marshal's diplomacy (session 17). It weighs an offer exactly as the Captain does (its fronts, who's ahead, what
 * the deal frees up or costs, trust), on its own reading of the board (its land estimates and runaway rule), and adds
 * its personality: how much it likes each kind of deal. When its style is what decides, it says so in its own voice
 * ("Peace suits me; my walls aren't finished."). Every answer still has one plain reason.
 */

const CAPITAL_GAIN = 40;
const WIN_GAIN = 1000;
/** Breaking a deal with the runaway leader to go after it: what that's worth (it still has to beat the penalty). */
const RUNAWAY_GAIN = 30;

/** The offer's kind, in the personality's voice: yes and no. */
const VOICE: Record<DealKind, [keyof Personality["voice"], keyof Personality["voice"]]> = {
  truce: ["truceYes", "truceNo"],
  war: ["warYes", "warNo"],
  trade: ["tradeYes", "tradeNo"],
  passage: ["passageYes", "passageNo"],
};

export function marshalJudge(ctx: GameContext, view: PlayerView, offer: Offer, P: Personality, insight: Insight, lastTurn?: readonly ReplayEvent[]): Answer {
  const me = view.me.id;
  const p = offer.from;
  const t = offer.terms;
  const rules = ctx.rules;
  const no = (reason: string): Answer => ({ accept: false, reason });
  if (offer.to !== me || p === me) return no("That offer isn't for me.");
  if (termsProblem(rules, t)) return no("Those terms don't fit the rules.");
  if (view.deals.some((d) => between(d, me, p) && d.kind === t.kind)) return no(`We already have a ${DEAL_NAME[t.kind]}.`);
  const b = marshalBoard(ctx, view, insight, lastTurn);
  if (!b) return no("I have nothing left to bargain with.");
  const n = namesFor(ctx, view);
  const idx = indexMap(ctx.map);
  const owner = dealBoard(view).owner;
  const cost = offer.bond === "binding" ? bindingCost(rules, dealSize(rules, idx, t, p, me, owner)) : 0;
  const myGold = view.me.gold - (t.kind === "trade" ? (t.get.gold ?? 0) : 0);
  if (cost > 0 && cost > myGold) return no(`I can't spare ${cost} gold for a binding pact.`);
  const grow = t.kind === "passage" ? "I won't let you through." : "I won't help you grow.";
  if (b.runaway === p && helpsProposer(t)) return no(`You're running away with the map. ${grow}`);
  if (helpsProposer(t) && t.kind !== "war" && leads(b, p)) return no(`You're the strongest of us. ${grow}`);
  if (t.kind === "passage") {
    const ally = attackingPartner(view, p, lastTurn);
    if (ally) return no(`You're at war with ${n.name(ally)}, who has a deal with me. I won't let you through.`);
  }
  const trust = trustIn(ctx, view, p);
  const r = rules.diplomacy.bots;
  const verdict = captainWeighs(ctx, view, b, offer, cost);
  // Its personality: how much it likes this kind of deal, said in its own voice.
  const bias = P.deals[t.kind];
  const [yes, nay] = VOICE[t.kind];
  if (bias) verdict.factors.push({ w: bias, text: P.voice[bias > 0 ? yes : nay] });
  // Every Marshal is in on a joint war against the runaway leader.
  if (t.kind === "war" && t.target === insight.runaway) verdict.factors.push({ w: 10, text: `Gladly: ${n.name(t.target)} is running away with the map.` });
  const score = verdict.factors.reduce((a, f) => a + f.w, 0);
  const strongest = (sign: 1 | -1) => [...verdict.factors].filter((f) => Math.sign(f.w) === sign).sort((x, y) => Math.abs(y.w) - Math.abs(x.w))[0]?.text;
  const isCounter = !!offer.counterTo;
  const counterOf = (terms: DealTerms, bond = offer.bond, why: string): Answer => ({
    accept: false,
    reason: why,
    counter: { id: `${me}-t${view.turn}-c-${offer.id}`, from: me, to: p, terms, bond, counterTo: offer.id },
  });
  if (offer.bond === "handshake" && trust.score < r.trustMin) {
    const price = bindingCost(rules, dealSize(rules, idx, t, me, p, owner));
    if (score > r.acceptMargin && !isCounter && price <= myGold) return counterOf(t, "binding", `${trust.why ?? "I don't trust you yet."} Make it binding and it's a deal.`);
    return no(trust.why ?? "I don't trust you.");
  }
  if (score > r.acceptMargin && strongest(1)) return { accept: true, reason: strongest(1)! };
  if (verdict.counter && !isCounter && score >= -r.counterMargin) return counterOf(verdict.counter.terms, offer.bond, verdict.counter.why);
  return no(strongest(-1) ?? "That doesn't help me.");
}

/**
 * The deals a Marshal proposes: the Captain's (a joint war against the runaway first, passage toward a front it wants,
 * a truce on a front it can't afford, a trade for land), on its own reading of the board; then its personality's own:
 * a joint war against its target, or a truce with a neighbour it isn't fighting. At most the rules' offers a turn.
 */
export function marshalPropose(ctx: GameContext, view: PlayerView, P: Personality, insight: Insight, lastTurn?: readonly ReplayEvent[]): Offer[] {
  const rules = ctx.rules;
  const cap = rules.diplomacy.bots.offersPerTurn;
  if (!cap || !view.settings.diplomacy || view.winner || view.turn < 2) return [];
  const b = marshalBoard(ctx, view, insight, lastTurn);
  if (!b) return [];
  const out = proposeOffers(ctx, view, "captain", lastTurn, b);
  if (out.length >= cap) return out;
  const me = view.me.id;
  const n = namesFor(ctx, view);
  const R = insight.runaway;
  const has = (q: PlayerId, kind: DealKind) => view.deals.some((d) => between(d, me, q) && d.kind === kind);
  const recent = (q: PlayerId, kind: DealKind) => view.record.some((x) => x.kind === kind && between(x, me, q) && x.end >= view.turn - 3);
  const askedLast = (q: PlayerId, kind: DealKind) => (lastTurn ?? []).some((e) => e.type === "offerLapsed" && e.offer.from === me && e.offer.to === q && e.offer.terms.kind === kind);
  const ok = (q: PlayerId, kind: DealKind) => q !== me && b.alive.some((x) => x.id === q) && !has(q, kind) && !recent(q, kind) && !askedLast(q, kind) && trustIn(ctx, view, q).score >= rules.diplomacy.bots.trustMin;
  const add = (to: PlayerId, terms: DealTerms, note: string) => out.length < cap && out.push({ id: `${me}-t${view.turn}-o${out.length}`, from: me, to, terms, bond: "handshake", note });

  // A joint war against its own target, with a rival that borders it (and isn't at peace with it).
  const target = b.focus ?? [...insight.fought].find((q) => b.facing.has(q)) ?? null;
  if (P.deals.offersWars && target && target !== me && !has(target, "truce")) {
    const bordersT = (q: PlayerId) => b.idx.ids.some((x) => b.look0(x) === q && b.idx.neighbors.get(x)!.some((y) => b.look0(y) === target));
    const partner = b.alive
      .map((x) => x.id)
      .filter((q) => q !== target && q !== R && ok(q, "war") && bordersT(q) && !view.deals.some((d) => between(d, q, target) && (d.kind === "truce" || d.kind === "war")))
      .sort((x, y) => (b.knownLand.get(y) ?? 0) - (b.knownLand.get(x) ?? 0) || (x < y ? -1 : 1))[0];
    if (partner) add(partner, { kind: "war", target, turns: rules.diplomacy.war.defaultTurns }, P.voice.offerWar.replace("{target}", n.name(target)));
  }
  // A truce with a neighbour it isn't fighting (never the runaway or its target).
  if (P.deals.offersTruces && out.length < cap) {
    const quiet = [...b.facing]
      .filter(([q]) => q !== R && q !== b.focus && q !== target && !insight.warTargets.has(q) && ok(q, "truce"))
      .sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1))[0];
    if (quiet) add(quiet[0], { kind: "truce", scope: { kind: "all" }, turns: rules.diplomacy.truce.defaultTurns }, P.voice.offerTruce);
  }
  return out;
}

/**
 * The Marshal keeps its word unless breaking a handshake deal pays by its own measure (its personality's `breakGain`
 * times the penalty: the Schemer's is low): a rival's capital it's sure to take across it, the win (fog off), or the
 * runaway leader it means to stop. It says why, in its own voice.
 */
export function marshalBreaks(ctx: GameContext, view: PlayerView, P: Personality, insight: Insight, lastTurn?: readonly ReplayEvent[]): Order[] {
  const handshakes = view.deals.filter((d) => d.bond === "handshake" && d.terms && (d.kind === "truce" || d.kind === "war"));
  if (!handshakes.length) return [];
  const b = marshalBoard(ctx, view, insight, lastTurn);
  if (!b) return [];
  const rules = ctx.rules;
  const n = namesFor(ctx, view);
  const out: Order[] = [];
  for (const d of handshakes) {
    const p = otherSide(d, view.me.id);
    const { fine, unrest } = oathPenalty(rules, d.size ?? 0);
    const penalty = fine + unrest * rules.troops.cost + rules.diplomacy.bots.trustBroken / 2;
    const theirs = b.idx.ids.filter((t) => b.look0(t) === p);
    const sure = (t: TerritoryId) =>
      b.idx.neighbors.get(t)!.some((f) => {
        if (!b.owned(f)) return false;
        const troops = b.troopsAt(f) - b.garrison;
        return troops > 0 && !!previewAttack(ctx, view, { from: f, to: t, troops, specialists: b.specsAt(f) })?.captureGuaranteed;
      });
    const capital = theirs.find((t) => b.seen(t)?.capitalOf === p && sure(t));
    const win = !view.settings.fog && b.alive.length === 2 && theirs.length === 1 && sure(theirs[0]!);
    const stop = p === insight.runaway && b.facing.has(p) && frontWith(b, p).mine >= frontWith(b, p).theirs;
    const gain = win ? WIN_GAIN : capital ? CAPITAL_GAIN + b.valueOf(capital) : stop ? RUNAWAY_GAIN : 0;
    if (!gain || gain < P.deals.breakGain * penalty) continue;
    const place = capital ? n.place(capital) : stop ? `Stopping ${n.name(p)}` : "The win";
    const note = win ? `One more battle wins the game; I won't let our ${DEAL_NAME[d.kind]} stop me.` : stop ? `You're running away with the map; our ${DEAL_NAME[d.kind]} is over.` : P.voice.breaks.replace("{place}", place);
    out.push({ id: `${view.me.id}-t${view.turn}-break-${d.id}`, kind: "break", deal: d.id, note });
  }
  return out;
}
