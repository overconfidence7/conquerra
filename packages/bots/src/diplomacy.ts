import {
  between,
  bindingCost,
  covers,
  DEAL_NAME,
  dealSize,
  dealTurns,
  indexMap,
  isParty,
  landProblem,
  oathPenalty,
  otherSide,
  passageFor,
  previewAttack,
  termsProblem,
  type DealBoard,
  type DealKind,
  type DealTerms,
  type DealView,
  type GameContext,
  type Offer,
  type Order,
  type OrdersByPlayer,
  type PlayerId,
  type PlayerView,
  type ReplayEvent,
  type TerritoryId,
} from "@conquerra/engine";
import { CAPTAIN_CHAIN_MARGIN, readBoard, type Board } from "./board";
import { say, speakerOf, type Speaker } from "./say";

/**
 * The bots' diplomacy (session 14, design additions §2). Nate's requirement: strong, explainable logic behind every
 * yes and no. Every judgement here is made from the bot's own view only (`viewFor`), and every answer comes with
 * one plain reason line, the strongest of the things it weighed:
 *  - its fronts, and where its armies are needed ("I need my army in the west")
 *  - who's ahead, by the Captain's runaway rule ("You're running away with the map")
 *  - what the deal frees up or costs (troops held on that border, gold, land)
 *  - its trust in the proposer ("You broke our truce at Old March")
 * It never helps a runaway leader (no truce that frees it, no trade that gives it anything), and it's always open to
 * a joint war against one. When an offer is close it may counter once (binding instead of a handshake, a shorter
 * truce, more gold). The Recruit uses simpler rules. Every number is in `rules.diplomacy.bots`.
 *
 * Negotiation is a host action (`negotiate`): in single player the host asks each bot to answer during planning; in
 * M4 the same offers and answers travel between people. Offers and answers become orders (`propose`, `answer`), so a
 * saved game and `pnpm sim --replay` reproduce exactly.
 */

export type DiplomatLevel = "captain" | "recruit";

/**
 * A bot with diplomacy of its own (session 17: the Marshal, with its memory and personality): it answers offers and
 * proposes deals itself. The Captain and the Recruit are named by their level.
 */
export interface Diplomat {
  judge(ctx: GameContext, view: PlayerView, offer: Offer, lastTurn?: readonly ReplayEvent[]): Answer;
  propose(ctx: GameContext, view: PlayerView, lastTurn?: readonly ReplayEvent[]): Offer[];
}

/** A bot's answer to an offer, whoever it is. */
export const judgeBy = (ctx: GameContext, who: DiplomatLevel | Diplomat, view: PlayerView, offer: Offer, lastTurn?: readonly ReplayEvent[]): Answer =>
  typeof who === "string" ? judgeOffer(ctx, view, offer, who, lastTurn) : who.judge(ctx, view, offer, lastTurn);

/** A bot's answer: yes or no, the one line it says, and (sometimes) a counteroffer instead of a plain no. */
export interface Answer {
  accept: boolean;
  reason: string;
  counter?: Offer;
}

/** One thing a bot weighed, and how much: the strongest one in the verdict's direction is the reason it gives. */
interface Factor {
  w: number;
  text: string;
}

const OPTS = { chainMargin: CAPTAIN_CHAIN_MARGIN };
/** After a deal with someone ends, wait this many turns before proposing the same kind to them again. */
const RE_ASK_TURNS = 3;
/** A front we can't afford: the rival's army there is this many times ours. */
const AFFORD = 1.5;

// ---------- Names and directions, for the reason lines ----------

export function namesFor(ctx: GameContext, view: PlayerView) {
  const idx = indexMap(ctx.map);
  return {
    name: (p: PlayerId) => (p === view.me.id ? "me" : (view.players.find((x) => x.id === p)?.name ?? p)),
    place: (t: TerritoryId) => idx.byId.get(t)?.name ?? t,
    province: (id: string) => ctx.map.provinces.find((p) => p.id === id)?.name ?? id,
  };
}

/** "the west", "the north-east": where `land` lies from the middle of our realm. */
export function direction(ctx: GameContext, mine: readonly TerritoryId[], land: readonly TerritoryId[]): string {
  const idx = indexMap(ctx.map);
  const mid = (ts: readonly TerritoryId[]) => {
    const ps = ts.map((t) => idx.byId.get(t)!);
    return { x: ps.reduce((a, p) => a + p.x, 0) / ps.length, y: ps.reduce((a, p) => a + p.y, 0) / ps.length };
  };
  if (!land.length || !mine.length) return "there";
  const a = mid(mine), b = mid(land);
  const dx = b.x - a.x, dy = b.y - a.y;
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return "the middle";
  const ns = dy < 0 ? "north" : "south", ew = dx < 0 ? "west" : "east";
  if (Math.abs(dx) > 2 * Math.abs(dy)) return `the ${ew}`;
  if (Math.abs(dy) > 2 * Math.abs(dx)) return `the ${ns}`;
  return `the ${ns}-${ew}`;
}

// ---------- Trust ----------

/**
 * How far this bot trusts `p` (0 to 100), worked out from the deal record it can see: down a lot for a deal `p` broke
 * with it, a little for a joint war `p` let fall through, up slowly for each deal kept, and down for a public
 * Oathbreaker mark. `why`: the line it gives when trust is what decides ("You broke our truce at Old March").
 * The record is part of the game state, so trust is part of the saved game.
 */
export function trustIn(ctx: GameContext, view: PlayerView, p: PlayerId, sp: Speaker = speakerOf(view)): { score: number; why: string | null } {
  const r = ctx.rules.diplomacy.bots;
  const me = view.me.id;
  const n = namesFor(ctx, view);
  let score = r.trustStart;
  let why: string | null = null;
  for (const x of view.record) {
    if (!isParty(x, p)) continue;
    const withMe = isParty(x, me);
    if (x.how === "broken" && x.by === p && withMe) {
      score -= r.trustBroken;
      why = x.at ? say(sp, "brokeOurAt", { deal: DEAL_NAME[x.kind], place: n.place(x.at) }, p) : say(sp, "brokeOur", { deal: DEAL_NAME[x.kind] }, p);
    } else if (withMe && x.how === "kept") {
      if (x.idle?.includes(p)) {
        score -= r.trustWarIdle;
        why ??= say(sp, "warFellThrough", {}, p);
      } else score += r.trustKept;
    }
  }
  const mark = view.players.find((x) => x.id === p)?.oathbreaker ?? 0;
  if (mark >= view.turn) {
    score -= r.trustOathbreaker;
    const last = [...view.record].reverse().find((x) => x.how === "broken" && x.by === p);
    why ??= last ? say(sp, "oathbreakerTo", { rival: n.name(otherSide(last, p)) }, p) : say(sp, "oathbreaker", {}, p);
  }
  return { score: Math.max(0, Math.min(100, score)), why };
}

// ---------- Reading the board for a deal ----------

/** The board as a deal check needs it, from what this bot can see. */
export function dealBoard(view: PlayerView): DealBoard {
  const seen = (t: TerritoryId) => {
    const v = view.territories[t];
    return v && v.detail === "full" ? v : null;
  };
  return {
    owner: (t) => {
      const v = view.territories[t];
      return v?.detail === "full" ? v.owner : (v?.lastSeen?.owner ?? null);
    },
    troops: (t) => seen(t)?.troops ?? 0,
    pinned: (t) => {
      const v = seen(t);
      return !v || !!v.capitalOf || v.leaders.length > 0 || v.generals.length > 0 || t === view.me.capital;
    },
  };
}

/** Troops of ours on the land next to `rival`'s, and theirs next to ours, as far as we see. */
export function frontWith(b: Board, rival: PlayerId) {
  let mine = 0;
  const land: TerritoryId[] = [];
  for (const t of b.frontier)
    if (b.facesRival(t, rival)) {
      mine += b.troopsAt(t);
      land.push(t);
    }
  return { mine, theirs: b.facing.get(rival) ?? 0, land };
}

/**
 * The clear leader as far as this bot can tell (for deals only; attacks keep the Captain's runaway rule): the most
 * land it knows of, a good third more than anyone else's (its own included), and at least a fifth of the map.
 */
export function leads(b: Board, p: PlayerId): boolean {
  const est = [...b.knownLand].filter(([q]) => b.alive.some((x) => x.id === q)).sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1));
  if (b.alive.length < 3 || est[0]?.[0] !== p) return false;
  const land = est[0][1];
  const next = Math.max(b.mine.length, est[1]?.[1] ?? 0);
  return land >= LEAD_OVER * next && land >= LEAD_SHARE * b.idx.ids.length;
}
const LEAD_OVER = 1.35;
const LEAD_SHARE = 0.2;

/** Does a deal on these terms help the proposer (so a runaway may not have it)? */
export function helpsProposer(t: DealTerms): boolean {
  if (t.kind !== "trade") return true;
  const g = t.get;
  return (g.gold ?? 0) > 0 || (g.perTurn ?? 0) > 0 || (g.land?.length ?? 0) > 0;
}

// ---------- Judging an offer ----------

/**
 * A bot's answer to an offer made to it, from its own view only, with one plain reason. `lastTurn`: what it watched
 * in last turn's replay (it judges fronts as the Captain does).
 */
export function judgeOffer(ctx: GameContext, view: PlayerView, offer: Offer, level: DiplomatLevel, lastTurn?: readonly ReplayEvent[]): Answer {
  const me = view.me.id;
  const p = offer.from;
  const t = offer.terms;
  const rules = ctx.rules;
  const no = (reason: string): Answer => ({ accept: false, reason });
  // The Captain and the Recruit speak plainly. (`x`: tells apart two answers of the same kind in one turn.)
  const sp = speakerOf(view);
  const x = offer.id;
  if (offer.to !== me || p === me) return no(say(sp, "notForMe", {}, x));
  if (termsProblem(rules, t)) return no(say(sp, "badTerms", {}, x));
  if (view.deals.some((d) => between(d, me, p) && d.kind === t.kind)) return no(say(sp, "alreadyHave", { deal: DEAL_NAME[t.kind] }, x));
  const b = readBoard(ctx, view, OPTS, lastTurn);
  if (!b) return no(say(sp, "nothingLeft", {}, x));
  const n = namesFor(ctx, view);
  const idx = indexMap(ctx.map);
  const owner = dealBoard(view).owner;
  const cost = offer.bond === "binding" ? bindingCost(rules, dealSize(rules, idx, t, p, me, owner)) : 0;
  const myGold = view.me.gold - (t.kind === "trade" ? (t.get.gold ?? 0) : 0);
  if (cost > 0 && cost > myGold) return no(say(sp, "cantSpare", { n: cost }, x));
  // Never help a runaway leader; always open to a joint war against one.
  if (b.runaway === p && helpsProposer(t)) return no(say(sp, t.kind === "passage" ? "runawayPass" : "runawayGrow", {}, x));
  // Deals are a softer test than attacks: under fog a runaway may not look like one yet, so the clear leader (as far
  // as it can tell) doesn't get help either.
  if (helpsProposer(t) && t.kind !== "war" && leads(b, p)) return no(say(sp, t.kind === "passage" ? "strongestPass" : "strongestGrow", {}, x));
  // Right of passage (session 15): never for someone attacking a partner of ours.
  if (t.kind === "passage") {
    const ally = attackingPartner(view, p, lastTurn);
    if (ally) return no(say(sp, "atWarWithPartner", { rival: n.name(ally) }, x));
  }
  const trust = trustIn(ctx, view, p, sp);
  const r = rules.diplomacy.bots;

  const verdict = level === "recruit" ? recruitWeighs(ctx, b, offer, sp) : captainWeighs(ctx, view, b, offer, cost, sp);
  const score = verdict.factors.reduce((a, f) => a + f.w, 0);
  const strongest = (sign: 1 | -1) => [...verdict.factors].filter((f) => Math.sign(f.w) === sign).sort((x, y) => Math.abs(y.w) - Math.abs(x.w))[0]?.text;
  const isCounter = !!offer.counterTo;
  const counterOf = (terms: DealTerms, bond = offer.bond, why: string): Answer => ({
    accept: false,
    reason: why,
    counter: { id: `${me}-t${view.turn}-c-${offer.id}`, from: me, to: p, terms, bond, counterTo: offer.id },
  });

  // Trust: a handshake from someone it can't trust is a no; if the deal is good, it asks for a binding pact instead.
  if (offer.bond === "handshake" && trust.score < r.trustMin) {
    const price = bindingCost(rules, dealSize(rules, idx, t, me, p, owner));
    if (score > r.acceptMargin && !isCounter && level === "captain" && price <= myGold)
      return counterOf(t, "binding", say(sp, "makeBinding", { why: trust.why ?? say(sp, "noTrustYet", {}, x) }, x));
    return no(trust.why ?? say(sp, "noTrust", {}, x));
  }
  if (score > r.acceptMargin && strongest(1)) return { accept: true, reason: strongest(1)! };
  // Close: one counteroffer (never to a counteroffer).
  if (verdict.counter && !isCounter && score >= -r.counterMargin && level === "captain") return counterOf(verdict.counter.terms, offer.bond, verdict.counter.why);
  return no(strongest(-1) ?? say(sp, "noHelp", {}, x));
}

/** What the Captain weighs for each kind of deal (the Marshal weighs the same, plus its personality). */
export function captainWeighs(ctx: GameContext, view: PlayerView, b: Board, offer: Offer, cost: number, sp: Speaker = speakerOf(view)): { factors: Factor[]; counter?: { terms: DealTerms; why: string } } {
  const p = offer.from;
  const t = offer.terms;
  const n = namesFor(ctx, view);
  const rules = ctx.rules;
  const f: Factor[] = [];
  /** A reason, in the speaker's voice (the offer's id keeps two answers in one turn apart). */
  const why = (key: Parameters<typeof say>[1], vars?: Parameters<typeof say>[2]) => say(sp, key, vars, offer.id);
  if (cost) f.push({ w: -cost / 4, text: why("bindingCosts", { n: cost }) });
  const front = frontWith(b, p);
  /** The biggest army facing us from anyone else, and where. */
  const others = [...b.facing].filter(([q]) => q !== p).sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1));
  const [other, otherTroops] = others[0] ?? [null, 0];
  const otherLand = other ? frontWith(b, other).land : [];

  switch (t.kind) {
    case "truce": {
      if (!front.land.length) {
        f.push({ w: 1, text: why("noBorderPeace") });
        if (cost) f.push({ w: -2, text: why("noBorderBinding") });
        break;
      }
      // Military first: a truce needs a reason.
      f.push({ w: -1, text: why("handsFree") });
      if (b.focus === p && front.mine >= front.theirs) f.push({ w: -8, text: why("targetNotStopping") });
      if (b.runaway && b.runaway !== p && b.facing.has(b.runaway)) f.push({ w: 5, text: why("needArmyRunaway", { rival: n.name(b.runaway) }) });
      // Another front where we're the weaker side: the army is needed there.
      if (other && other !== b.runaway && otherTroops >= 4) {
        const there = frontWith(b, other);
        if (there.theirs > there.mine) f.push({ w: 2 + Math.min(3, (there.theirs - there.mine) / 6), text: why("needArmyIn", { where: direction(ctx, b.mine, otherLand) }) });
      }
      // The balance on our own border.
      const lean = Math.max(-3, Math.min(3, (front.theirs - front.mine) / Math.max(4, front.mine)));
      if (lean > 0) f.push({ w: lean, text: why("theirArmyBigger") });
      else if (lean < 0) f.push({ w: lean, text: why("holdingFine") });
      if (b.capThreatened && b.capital && b.facesRival(b.capital, p)) f.push({ w: 5, text: why("capitalDoor") });
      if (front.mine >= 2 * Math.max(1, front.theirs) && !b.shieldsLeader.has(p)) f.push({ w: -2, text: why("strongerFight") });
      if (b.shieldsLeader.has(p)) f.push({ w: 2, text: why("shieldsRunaway", { rival: n.name(b.runaway!) }) });
      if (t.until && t.until === b.runaway) f.push({ w: 2, text: why("peaceUntil", { rival: n.name(t.until) }) });
      if (t.turns > rules.diplomacy.truce.defaultTurns) f.push({ w: -(t.turns - rules.diplomacy.truce.defaultTurns) * 0.75, text: why("truceTooLong", { n: t.turns }) });
      const short = Math.min(t.turns, rules.diplomacy.truce.defaultTurns);
      if (t.turns > short || t.until) return { factors: f, counter: { terms: { kind: "truce", scope: t.scope, turns: short }, why: why("counterTruce", { n: short, m: t.turns }) } };
      return { factors: f };
    }
    case "war": {
      const target = t.target;
      const vs = frontWith(b, target);
      // Always open to a joint war against a runaway leader (or the clear leader, as far as it can tell).
      if (target === b.runaway || leads(b, target)) {
        const gladly = why(target === b.runaway ? "gladlyRunaway" : "gladlyStrongest", { target: n.name(target) });
        return { factors: [{ w: 10, text: gladly }], counter: t.turns > rules.diplomacy.war.defaultTurns ? { terms: { ...t, turns: rules.diplomacy.war.defaultTurns }, why: why("counterWar", { n: rules.diplomacy.war.defaultTurns }) } : undefined };
      }
      if (b.focus === p && front.mine >= front.theirs) f.push({ w: -6, text: why("targetNoWar") });
      if (b.shieldsLeader.has(target)) f.push({ w: -8, text: why("shieldsTarget", { target: n.name(target), rival: n.name(b.runaway!) }) });
      if (view.deals.some((d) => between(d, view.me.id, target) && (d.kind === "truce" || d.kind === "war"))) f.push({ w: -10, text: why("truceWithTarget", { target: n.name(target) }) });
      if (!vs.land.length) f.push({ w: -4, text: why("cantReach", { target: n.name(target) }) });
      else {
        if (b.focus === target) f.push({ w: 5, text: why("bothWant", { target: n.name(target) }) });
        if (vs.mine >= vs.theirs) f.push({ w: 3, text: why("targetWeak", { target: n.name(target) }) });
        else f.push({ w: -3, text: why("targetStrong", { target: n.name(target) }) });
      }
      // Too long is the one thing a shorter war fixes.
      if (t.turns > rules.diplomacy.war.defaultTurns) {
        f.push({ w: -1.5, text: why("warTooLong") });
        return { factors: f, counter: { terms: { ...t, turns: rules.diplomacy.war.defaultTurns }, why: why("counterWar", { n: rules.diplomacy.war.defaultTurns }) } };
      }
      return { factors: f };
    }
    case "passage": {
      if (b.focus === p) f.push({ w: -8, text: why("targetNoPassage") });
      if (front.land.length && front.theirs > front.mine) f.push({ w: -4, text: why("noArmiesInLand") });
      else f.push({ w: 1, text: why("mayPass") });
      // Where can they go through our land? To someone we'd like beaten, gladly.
      const beyond = reachedThrough(b, p);
      const foe = [b.runaway, b.focus].find((x): x is PlayerId => !!x && x !== p && beyond.has(x));
      if (foe) f.push({ w: 4, text: why("beatFoe", { rival: n.name(foe) }) });
      if (t.mutual) f.push({ w: 0.5, text: why("mutualFair") });
      if (t.turns > rules.diplomacy.passage.defaultTurns) {
        f.push({ w: -(t.turns - rules.diplomacy.passage.defaultTurns) * 0.75, text: why("passageTooLong", { n: t.turns }) });
        return { factors: f, counter: { terms: { ...t, turns: rules.diplomacy.passage.defaultTurns }, why: why("counterPassage", { n: rules.diplomacy.passage.defaultTurns }) } };
      }
      return { factors: f };
    }
    case "trade": {
      const v = tradeValue(ctx, view, b, t, why);
      if (v.cantPay) return { factors: [{ w: -20, text: why("cantPay") }] };
      if (v.giveLandBad) f.push({ w: -20, text: v.giveLandBad });
      const net = v.gain - v.cost;
      const fair = () => (!v.costWords ? why("giftGladly", { gain: v.gainWords }) : v.gainWords ? why("fairPrice", { gain: v.gainWords, cost: v.costWords }) : why("fairPricePlain"));
      f.push({ w: net / 2, text: net >= 0 ? fair() : why("notEnough", { cost: v.costWords || "too much", gain: v.gainWords || "too little" }) });
      if (v.needGold) f.push({ w: -3, text: why("needGold") });
      // Short of gold: gold now is worth more than gold later.
      if ((t.give.gold ?? 0) > 0 && view.me.gold < rules.troops.cost * 5) f.push({ w: 1.5, text: why("useGold") });
      // Close: ask for the difference in gold.
      const more = Math.ceil(-net) + 1;
      if (net < 0 && more <= 12 && !v.giveLandBad) {
        const terms: DealTerms = { ...t, give: { ...t.give, gold: (t.give.gold ?? 0) + more } };
        return { factors: f, counter: { terms, why: why("counterGold", { n: (t.give.gold ?? 0) + more }) } };
      }
      return { factors: f };
    }
  }
  return { factors: f };
}

/**
 * Is `p` attacking a partner of this bot's (someone it has a truce, a joint war or passage with)? From what it watched
 * last turn (a battle by `p` on that partner's land), and from the public deals (a joint war aimed at that partner).
 */
export function attackingPartner(view: PlayerView, p: PlayerId, lastTurn?: readonly ReplayEvent[]): PlayerId | null {
  const me = view.me.id;
  const partners = new Set(view.deals.filter((d) => isParty(d, me) && d.kind !== "trade").map((d) => otherSide(d, me)));
  partners.delete(p);
  for (const e of lastTurn ?? []) if (e.type === "battle" && e.player === p && e.defender && partners.has(e.defender)) return e.defender;
  for (const d of view.deals) if (d.kind === "war" && d.target && partners.has(d.target) && isParty(d, p)) return d.target;
  return null;
}

/**
 * The rivals `p` could reach through our land: players (as far as we know) holding land next to ours that isn't
 * next to `p`'s, within the passage limit. What right of passage would open up for them.
 */
function reachedThrough(b: Board, p: PlayerId): Set<PlayerId> {
  const out = new Set<PlayerId>();
  const max = b.rules.diplomacy.passage.maxThrough;
  const start = b.mine.filter((t) => b.idx.neighbors.get(t)!.some((x) => b.look0(x) === p));
  const depth = new Map(start.map((t) => [t, 1]));
  const q = [...start];
  while (q.length) {
    const t = q.shift()!;
    const d = depth.get(t)!;
    for (const x of b.idx.neighbors.get(t)!) {
      const o = b.look0(x);
      if (o === b.me.id) {
        if (d < max && !depth.has(x)) (depth.set(x, d + 1), q.push(x));
      } else if (o && o !== p) out.add(o);
    }
  }
  return out;
}

/**
 * The Captain asks a neighbour for right of passage when a rival it wants beaten (the runaway leader) lies beyond that
 * neighbour's land and doesn't border ours: the neighbour's land is the way through. Returns that neighbour, if any.
 */
function passageToward(b: Board, target: PlayerId): PlayerId | null {
  const max = b.rules.diplomacy.passage.maxThrough;
  let best: { q: PlayerId; d: number } | null = null;
  for (const q of [...b.facing.keys()].sort()) {
    if (q === target) continue;
    // Through q's land from ours, at most `max` territories, to land next to the target's.
    const start = b.idx.ids.filter((t) => b.look0(t) === q && b.idx.neighbors.get(t)!.some(b.owned));
    const depth = new Map(start.map((t) => [t, 1]));
    const queue = [...start];
    while (queue.length) {
      const t = queue.shift()!;
      const d = depth.get(t)!;
      if (b.idx.neighbors.get(t)!.some((x) => b.look0(x) === target)) {
        if (!best || d < best.d) best = { q, d };
        break;
      }
      if (d >= max) continue;
      for (const x of b.idx.neighbors.get(t)!) if (b.look0(x) === q && !depth.has(x)) (depth.set(x, d + 1), queue.push(x));
    }
  }
  return best?.q ?? null;
}

/** What a trade is worth to this bot, in gold: what it gets, what it gives, in words, and anything that rules it out. */
function tradeValue(ctx: GameContext, view: PlayerView, b: Board, t: Extract<DealTerms, { kind: "trade" }>, why: (key: "noCapital" | "guardsCapital", vars?: { place: string }) => string) {
  const n = namesFor(ctx, view);
  const turns = dealTurns(t);
  const each = t.give.perTurn || t.get.perTurn ? turns : 0;
  const landWorth = (x: TerritoryId) => 2 * b.valueOf(x);
  const words = (s: typeof t.give) => {
    const parts: string[] = [];
    if (s.gold) parts.push(`${s.gold} gold`);
    if (s.perTurn) parts.push(`${s.perTurn} gold a turn`);
    for (const l of s.land ?? []) parts.push(n.place(l));
    return parts.join(" and ");
  };
  // What we get: the proposer's `give`; what we give: `get`.
  const gain = (t.give.gold ?? 0) + (t.give.perTurn ?? 0) * each * 0.8 + (t.give.land ?? []).reduce((a, x) => a + landWorth(x), 0);
  // Land it gives up is worth more to it than the same land would be to buy (it holds it, and it's income every turn).
  let cost = (t.get.gold ?? 0) + (t.get.perTurn ?? 0) * each + (t.get.land ?? []).reduce((a, x) => a + 3 * b.valueOf(x) + 4 + (b.isFrontier(x) ? 2 : 0), 0);
  let giveLandBad: string | null = null;
  for (const x of t.get.land ?? []) {
    if (x === b.capital || x === view.me.capital) giveLandBad = why("noCapital");
    else if (b.idx.neighbors.get(x)!.includes(view.me.capital)) {
      giveLandBad = why("guardsCapital", { place: n.place(x) });
      cost += 20;
    }
  }
  const cantPay = (t.get.gold ?? 0) > view.me.gold;
  const needGold = (t.get.gold ?? 0) > 0 && b.capThreatened && view.me.gold - (t.get.gold ?? 0) < ctx.rules.troops.cost * 4;
  return { gain, cost, gainWords: words(t.give), costWords: words(t.get), giveLandBad, cantPay, needGold };
}

/** The Recruit's simpler rules: a truce when it's weaker, not when it's stronger; fair gold; never gives land. */
function recruitWeighs(ctx: GameContext, b: Board, offer: Offer, sp: Speaker): { factors: Factor[]; counter?: { terms: DealTerms; why: string } } {
  const p = offer.from;
  const why = (key: Parameters<typeof say>[1]) => say(sp, key, {}, offer.id);
  const t = offer.terms;
  const mineLand = b.mine.length, theirs = b.knownLand.get(p) ?? 0;
  switch (t.kind) {
    case "truce":
      return { factors: [mineLand < theirs ? { w: 2, text: why("recruitWeaker") } : { w: -2, text: why("recruitStronger") }] };
    case "war": {
      const target = b.knownLand.get(t.target) ?? 0;
      if (t.target === b.runaway) return { factors: [{ w: 3, text: why("recruitGladly") }] };
      return { factors: [mineLand > target ? { w: 1, text: why("recruitJoin") } : { w: -1, text: why("recruitTooStrong") }] };
    }
    case "passage":
      return { factors: [{ w: -1, text: why("recruitNoPassage") }] };
    case "trade": {
      const each = t.give.perTurn || t.get.perTurn ? dealTurns(t) : 0;
      const net = (t.give.gold ?? 0) + (t.give.perTurn ?? 0) * each - (t.get.gold ?? 0) - (t.get.perTurn ?? 0) * each;
      if (t.get.land?.length) return { factors: [{ w: -2, text: why("recruitNoLand") }] };
      return { factors: [net >= 0 ? { w: 1, text: why("recruitFair") } : { w: -1, text: why("recruitNo") }] };
    }
  }
}

// ---------- Proposing ----------

/** Did we offer this kind of deal to `to` last turn and get no deal? (Then it waits a turn before asking again.) */
function askedLastTurn(lastTurn: readonly ReplayEvent[] | undefined, me: PlayerId, to: PlayerId, kind: DealKind) {
  return (lastTurn ?? []).some((e) => e.type === "offerLapsed" && e.offer.from === me && e.offer.to === to && e.offer.terms.kind === kind);
}

/**
 * The deals a bot proposes as planning starts, best first, at most `rules.diplomacy.bots.offersPerTurn`:
 *  - the Captain: a joint war against a runaway leader (with a rival that borders it), a truce on a front it can't
 *    afford while fighting elsewhere, a trade for land that completes a province, or one when it's short of gold
 *  - the Recruit: only a truce with a stronger neighbour (it never proposes trades)
 */
export function proposeOffers(ctx: GameContext, view: PlayerView, level: DiplomatLevel, lastTurn?: readonly ReplayEvent[], read?: Board, voice: string | null = null): Offer[] {
  const rules = ctx.rules;
  const cap = rules.diplomacy.bots.offersPerTurn;
  if (!cap || !view.settings.diplomacy || view.winner || view.turn < 2) return [];
  // (The Marshal reads the board its own way and passes it in; the Captain and the Recruit read it here.)
  const b = read ?? readBoard(ctx, view, OPTS, lastTurn);
  if (!b) return [];
  const me = view.me.id;
  const out: Offer[] = [];
  let k = 0;
  const has = (q: PlayerId, kind: DealKind) => view.deals.some((d) => between(d, me, q) && d.kind === kind);
  /** A deal of this kind with `q` that ended in the last few turns: let it rest before asking again. */
  const recent = (q: PlayerId, kind: DealKind) => view.record.some((x) => x.kind === kind && between(x, me, q) && x.end >= view.turn - RE_ASK_TURNS);
  const ok = (q: PlayerId, kind: DealKind) =>
    q !== me && b.alive.some((x) => x.id === q) && !has(q, kind) && !recent(q, kind) && !askedLastTurn(lastTurn, me, q, kind) && trustIn(ctx, view, q).score >= rules.diplomacy.bots.trustMin;
  const add = (to: PlayerId, terms: DealTerms, note: string) => out.length < cap && out.push({ id: `${me}-t${view.turn}-o${k++}`, from: me, to, terms, bond: "handshake", note });
  const n = namesFor(ctx, view);
  const truceTurns = rules.diplomacy.truce.defaultTurns;
  // Offers in the plain voice (the Marshal passes its own offers' notes through `voice` below).
  const sp = speakerOf(view, voice);
  const note = (key: Parameters<typeof say>[1], vars?: Parameters<typeof say>[2]) => say(sp, key, vars, `o${out.length}`);

  if (level === "recruit") {
    for (const [q] of [...b.facing].sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1)))
      if (q !== b.runaway && (b.knownLand.get(q) ?? 0) > b.mine.length * 1.2 && ok(q, "truce")) add(q, { kind: "truce", scope: { kind: "all" }, turns: truceTurns }, note("offerRecruitTruce"));
    return out;
  }

  // A joint war against a runaway leader, with a rival that borders it (or with anyone, if we border it ourselves).
  const R = b.runaway;
  if (R && R !== me && !view.deals.some((d) => between(d, me, R) && (d.kind === "truce" || d.kind === "war"))) {
    const bordersR = (q: PlayerId) => b.idx.ids.some((x) => b.look0(x) === q && b.idx.neighbors.get(x)!.some((y) => b.look0(y) === R));
    const partner = b.alive
      .map((x) => x.id)
      .filter((q) => q !== R && ok(q, "war") && (bordersR(q) || b.facing.has(R)))
      .sort((x, y) => (b.knownLand.get(y) ?? 0) - (b.knownLand.get(x) ?? 0) || (x < y ? -1 : 1))[0];
    if (partner) add(partner, { kind: "war", target: R, turns: rules.diplomacy.war.defaultTurns }, note("offerRunawayWar", { target: n.name(R) }));
  }

  // Right of passage toward a rival we want a front with but don't border (the runaway leader first): through a
  // neighbour's land that reaches it.
  const open = passageFor(view.deals.filter((d) => d.terms).map((d) => ({ a: d.a, b: d.b, terms: d.terms! })), me);
  const fronts0 = b.alive.map((x) => x.id).filter((q) => !b.facing.has(q) && b.wantsFront(q)).sort((x, y) => Number(y === R) - Number(x === R) || (b.knownLand.get(x) ?? 0) - (b.knownLand.get(y) ?? 0) || (x < y ? -1 : 1));
  for (const target of fronts0) {
    if (out.length >= cap) break;
    const way = passageToward(b, target);
    if (!way || open.includes(way) || !ok(way, "passage")) continue;
    const key = target === R ? "offerPassageRunaway" : (b.knownLand.get(target) ?? 0) <= 3 ? "offerPassageBeaten" : "offerPassage";
    add(way, { kind: "passage", turns: rules.diplomacy.passage.defaultTurns, mutual: false }, note(key, { target: n.name(target) }));
    break;
  }

  // A truce on a front we can't afford while another front needs us (never with the runaway or our target).
  const fronts = [...b.facing].filter(([, troops]) => troops >= 4).sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1));
  if (fronts.length >= 2 || b.capThreatened)
    for (const [q, troops] of fronts) {
      if (q === R || q === b.focus || !ok(q, "truce")) continue;
      const f = frontWith(b, q);
      if (troops > f.mine * AFFORD || (b.capThreatened && b.capital && b.facesRival(b.capital, q))) {
        const elsewhere = fronts.find(([o]) => o !== q);
        add(q, { kind: "truce", scope: { kind: "all" }, turns: truceTurns }, elsewhere ? note("offerTruceNeeded", { where: direction(ctx, b.mine, frontWith(b, elsewhere[0]).land) }) : note("offerTrucePlain"));
        break;
      }
    }

  // A trade for land that completes a province of ours.
  const board = dealBoard(view);
  const reserve = rules.troops.cost * 4;
  for (const t of b.idx.ids) {
    if (out.length >= cap) break;
    const v = b.seen(t);
    if (!v || !v.owner || v.owner === me || v.owner === R || !ok(v.owner, "trade")) continue;
    const prov = b.idx.byId.get(t)!.province;
    const missing = (b.idx.provinceMembers.get(prov) ?? []).filter((x) => !b.owned(x));
    if (missing.length !== 1 || landProblem(b.idx, rules, board, v.owner, me, [t])) continue;
    const price = Math.min(Math.round(3 * b.valueOf(t)) + 6, view.me.gold - reserve);
    if (price < 4) continue;
    add(v.owner, { kind: "trade", give: { gold: price }, get: { land: [t] } }, note("offerBuyLand", { place: n.place(t), province: n.province(prov), n: price }));
  }

  // Short of gold: sell a poor, quiet piece of border land to a neighbour (never next to our capital).
  if (out.length < cap && view.me.gold < rules.troops.cost * 3 && view.turn >= 5)
    for (const t of [...b.frontier].sort((x, y) => b.valueOf(x) - b.valueOf(y) || (x < y ? -1 : 1))) {
      const buyer = b.idx.neighbors.get(t)!.map((x) => b.rivalAt(x)).find((q): q is PlayerId => !!q && q !== R && ok(q, "trade"));
      if (!buyer || b.idx.neighbors.get(t)!.includes(view.me.capital) || landProblem(b.idx, rules, board, me, buyer, [t])) continue;
      add(buyer, { kind: "trade", give: { land: [t] }, get: { gold: Math.round(3 * b.valueOf(t)) + 6 } }, note("offerSellLand", { place: n.place(t) }));
      break;
    }
  return out;
}

// ---------- Keeping its word ----------

/** Gold a capital is worth to take, and the win: what the Captain weighs against breaking its word. */
const CAPITAL_GAIN = 40;
const WIN_GAIN = 1000;

/**
 * The Captain keeps its word, except when breaking a handshake deal clearly pays: a rival's capital it's sure to take
 * across it, or the win (with fog off: under fog it can't be sure land is a rival's last). The gain must be at least `breakGain` times the penalty (the fine, the troops that would
 * desert, and the trust it loses). Returns the `break` orders, each with the line it says.
 */
export function captainBreaks(ctx: GameContext, view: PlayerView, lastTurn?: readonly ReplayEvent[]): Order[] {
  const handshakes = view.deals.filter((d) => d.bond === "handshake" && d.terms && (d.kind === "truce" || d.kind === "war"));
  if (!handshakes.length) return [];
  const b = readBoard(ctx, view, OPTS, lastTurn);
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
    // The win: the last rival's last territory. Under fog it can't know that land is their last, so only with fog off.
    const win = !view.settings.fog && b.alive.length === 2 && theirs.length === 1 && sure(theirs[0]!);
    const gain = win ? WIN_GAIN : capital ? CAPITAL_GAIN + b.valueOf(capital) : 0;
    if (!gain || gain < rules.diplomacy.bots.breakGain * penalty) continue;
    const note = win ? say(speakerOf(view), "breakWin", { deal: DEAL_NAME[d.kind] }, d.id) : say(speakerOf(view), "breakCapital", { place: n.place(capital!), deal: DEAL_NAME[d.kind] }, d.id);
    out.push({ id: `${view.me.id}-t${view.turn}-break-${d.id}`, kind: "break", deal: d.id, note });
  }
  return out;
}

/** The view without these deals (the Captain plans as if a deal it's breaking were already gone). */
export const withoutDeals = (view: PlayerView, ids: readonly string[]): PlayerView => (ids.length ? { ...view, deals: view.deals.filter((d) => !ids.includes(d.id)) } : view);

// ---------- Respecting deals ----------

/**
 * Every bot, and every general, honours its deals: no order attacks across a truce (or a joint war's truce) as far as
 * it can see, and every move carries a guard that calls it off if the land turns out to be a partner's when it plays
 * (a chain into the fog). With no deals, the orders are untouched.
 */
export function respectDeals(ctx: GameContext, view: PlayerView, orders: readonly Order[]): Order[] {
  const me = view.me.id;
  const mine = view.deals.filter((d) => d.terms && isParty(d, me) && (d.kind === "truce" || d.kind === "war"));
  if (!mine.length) return [...orders];
  const idx = indexMap(ctx.map);
  const owner = dealBoard(view).owner;
  const partners = [...new Set(mine.map((d) => otherSide(d, me)))];
  const blocked = (from: TerritoryId, to: TerritoryId) => mine.some((d) => covers(idx, d as Required<Pick<DealView, "a" | "b" | "terms">>, from, to, owner));
  const guard = (o: Order): Order => {
    const g: Order = { ...o };
    if (g.kind === "move") g.conditions = [...(g.conditions ?? []), ...partners.map((p) => ({ kind: "not" as const, condition: { kind: "ownerIs" as const, territory: g.to, player: p } }))];
    if (g.then) g.then = guard(g.then);
    if (g.fallback) g.fallback = guard(g.fallback);
    return g;
  };
  return orders.filter((o) => !(o.kind === "move" && blocked(o.via ?? o.from, o.to))).map(guard);
}

/**
 * The view with deals agreed this planning phase (both sides confirmed) added, as if in force: a bot plans its moves
 * knowing the truce it just agreed starts before any of them.
 */
export function withAgreed(view: PlayerView, agreed: readonly Offer[]): PlayerView {
  const mine = agreed.filter((o) => isParty({ a: o.from, b: o.to }, view.me.id));
  if (!mine.length) return view;
  const extra: DealView[] = mine.map((o) => ({
    id: `agreed-${o.from}-${o.id}`,
    kind: o.terms.kind,
    bond: o.bond,
    a: o.from,
    b: o.to,
    start: view.turn,
    last: view.turn + dealTurns(o.terms) - 1,
    terms: o.terms,
    size: 0,
    borders: [],
  }));
  return { ...view, deals: [...view.deals, ...extra] };
}

// ---------- Negotiating (a host action) ----------

/** One offer between bots this planning phase, and its answer (null: it went to the human, who answers on the page). */
export interface Talk {
  offer: Offer;
  answer: Answer | null;
}

const proposeOrder = (o: Offer): Order => ({ id: `propose-${o.id}`, kind: "propose", offer: o });
export const answerOrder = (o: Offer, accept: boolean): Order => ({ id: `answer-${o.from}-${o.id}`, kind: "answer", from: o.from, offer: o.id, accept });

/**
 * As planning starts, the host asks each bot (in seat-list order, so games stay deterministic) what it proposes. An
 * offer to another bot is answered at once (one counteroffer allowed, answered at once too); one to the human waits
 * for the page (at most `offersToYouPerTurn` a turn from all the bots together). The result is each bot's diplomacy
 * orders for the turn, the offers to the human, and every exchange (with its reason) for the simulator's report.
 */
export function negotiate(
  ctx: GameContext,
  bots: readonly { id: PlayerId; level: DiplomatLevel | Diplomat }[],
  viewOf: (p: PlayerId) => PlayerView,
  lastTurn: (p: PlayerId) => readonly ReplayEvent[] | undefined,
  human: PlayerId | null,
): { orders: OrdersByPlayer; toHuman: Offer[]; talks: Talk[] } {
  const orders: OrdersByPlayer = {};
  const toHuman: Offer[] = [];
  const talks: Talk[] = [];
  const push = (p: PlayerId, o: Order) => (orders[p] ??= []).push(o);
  const level = new Map(bots.map((x) => [x.id, x.level]));
  /** Pairs and kinds already agreed (or offered) this turn, so nobody makes the same deal twice. */
  const engaged = new Set<string>();
  const key = (a: PlayerId, c: PlayerId, kind: DealKind) => `${a < c ? `${a}|${c}` : `${c}|${a}`}|${kind}`;
  let humanLeft = ctx.rules.diplomacy.bots.offersToYouPerTurn;
  for (const bot of bots) {
    const view = viewOf(bot.id);
    if (view.players.find((p) => p.id === bot.id)?.eliminatedTurn !== null) continue;
    const offers = typeof bot.level === "string" ? proposeOffers(ctx, view, bot.level, lastTurn(bot.id)) : bot.level.propose(ctx, view, lastTurn(bot.id));
    for (const o of offers) {
      const k = key(o.from, o.to, o.terms.kind);
      if (engaged.has(k)) continue;
      if (o.to === human) {
        if (humanLeft <= 0) continue;
        humanLeft--;
        engaged.add(k);
        push(bot.id, proposeOrder(o));
        toHuman.push(o);
        talks.push({ offer: o, answer: null });
        continue;
      }
      const to = level.get(o.to);
      if (!to) continue;
      push(bot.id, proposeOrder(o));
      const ans = judgeBy(ctx, to, viewOf(o.to), o, lastTurn(o.to));
      talks.push({ offer: o, answer: ans });
      engaged.add(k);
      if (ans.accept) push(o.to, answerOrder(o, true));
      else if (ans.counter) {
        push(o.to, answerOrder(o, false));
        push(o.to, proposeOrder(ans.counter));
        const back = judgeBy(ctx, bot.level, view, ans.counter, lastTurn(bot.id));
        talks.push({ offer: ans.counter, answer: back });
        if (back.accept) push(bot.id, answerOrder(ans.counter, true));
      } else push(o.to, answerOrder(o, false));
    }
  }
  return { orders, toHuman, talks };
}

/**
 * The offers both sides confirmed in these orders (each `propose` with a matching `accept`), for planning moves as if
 * those deals were already in force.
 */
export function agreedIn(orders: OrdersByPlayer): Offer[] {
  const offers = new Map<string, Offer>();
  for (const [p, list] of Object.entries(orders)) for (const o of list ?? []) if (o.kind === "propose" && o.offer.from === p) offers.set(`${p}|${o.offer.id}`, o.offer);
  const out: Offer[] = [];
  for (const [p, list] of Object.entries(orders))
    for (const o of list ?? []) {
      if (o.kind !== "answer" || !o.accept) continue;
      const offer = offers.get(`${o.from}|${o.offer}`);
      if (offer && offer.to === p) out.push(offer);
    }
  return out;
}
