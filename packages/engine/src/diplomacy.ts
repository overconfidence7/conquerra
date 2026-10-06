import type { Rules } from "@conquerra/content";
import { cultureKept, cultureProtection } from "./economy";
import { indexMap, type MapIndex } from "./mapIndex";
import type {
  Deal,
  DealKind,
  DealProblem,
  DealRecord,
  DealTerms,
  GameContext,
  GameEvent,
  GameState,
  LandChange,
  Offer,
  OrdersByPlayer,
  PlayerId,
  TerritoryId,
  TruceScope,
} from "./types";

/**
 * Diplomacy (session 14, design additions §2): preset deals between two players.
 *
 *  - **When a deal starts (the re-confirm rule):** an offer and its acceptance are orders that take no slot. A deal
 *    starts only if both sides confirm during the same planning phase, as the turn resolves, before any move. An offer
 *    nobody confirmed lapses as the turn resolves; one between two players who fought each other that turn is voided.
 *  - **Truce:** no attacks between the two across the borders it covers (everywhere, a province, or named borders).
 *    A joint war includes a truce everywhere between the partners.
 *  - **Handshake:** free; an attack across it breaks it (Oathbreaker: a public mark, a gold fine and unrest on the
 *    breaker's land next to the wronged player, all scaled by the deal's size). **Binding:** each side pays gold up
 *    front; an attack across it is called off; gold owed each turn is taken automatically; it can't be broken.
 *  - **Every deal expires**; one deal of each kind between the same two players at a time; a knocked-out player's
 *    deals end; the Fallen don't make deals.
 *
 * The pure helpers here (what a truce covers, a deal's size and price, whether terms make sense) are shared with the
 * bots and the page, so they all judge a deal exactly as the engine plays it. Every number is in `rules.diplomacy`.
 */

/** Who holds a territory (from the game, or from what a player can see). */
export type OwnerOf = (t: TerritoryId) => PlayerId | null;

export const isParty = (d: { a: PlayerId; b: PlayerId }, p: PlayerId) => d.a === p || d.b === p;
export const otherSide = (d: { a: PlayerId; b: PlayerId }, p: PlayerId) => (d.a === p ? d.b : d.a);
export const between = (d: { a: PlayerId; b: PlayerId }, p: PlayerId, q: PlayerId) => (d.a === p && d.b === q) || (d.a === q && d.b === p);
export const pairKey = (p: PlayerId, q: PlayerId) => (p < q ? `${p}|${q}` : `${q}|${p}`);

/** Is the border between `x` and `y` inside a truce's scope? */
export function scopeHas(idx: MapIndex, scope: TruceScope, x: TerritoryId, y: TerritoryId): boolean {
  switch (scope.kind) {
    case "all":
      return true;
    case "province":
      return idx.byId.get(x)?.province === scope.province || idx.byId.get(y)?.province === scope.province;
    case "borders":
      return scope.borders.some(([p, q]) => (p === x && q === y) || (p === y && q === x));
  }
}

/**
 * Does a truce (or a joint war's truce between its partners) cover an attack from `from` into `to`? Only while the two
 * are held by the deal's two sides, one each.
 */
export function covers(idx: MapIndex, d: Pick<Deal, "a" | "b" | "terms">, from: TerritoryId, to: TerritoryId, owner: OwnerOf): boolean {
  if (d.terms.kind !== "truce" && d.terms.kind !== "war") return false;
  const x = owner(from), y = owner(to);
  if (!x || !y || x === y || !between(d, x, y)) return false;
  return d.terms.kind === "war" || scopeHas(idx, d.terms.scope, from, to);
}

/** The deal standing between an attack from `from` into `to`, a binding one first (null: none). */
export function dealAcross(idx: MapIndex, deals: readonly Deal[], from: TerritoryId, to: TerritoryId, owner: OwnerOf): Deal | null {
  let hit: Deal | null = null;
  for (const d of deals)
    if (covers(idx, d, from, to, owner)) {
      if (d.bond === "binding") return d;
      hit ??= d;
    }
  return hit;
}

/** Every border a truce (or joint war) covers right now, as pairs [a's territory, b's territory]. */
export function coveredBorders(idx: MapIndex, d: Pick<Deal, "a" | "b" | "terms">, owner: OwnerOf): [TerritoryId, TerritoryId][] {
  if (d.terms.kind !== "truce" && d.terms.kind !== "war") return [];
  const out: [TerritoryId, TerritoryId][] = [];
  for (const t of idx.ids) {
    if (owner(t) !== d.a) continue;
    for (const n of idx.neighbors.get(t) ?? []) if (owner(n) === d.b && covers(idx, d, t, n, owner)) out.push([t, n]);
  }
  return out;
}

/** How many turns a deal runs (a trade with nothing paid each turn is done at once: 1). */
export const dealTurns = (t: DealTerms): number => (t.kind === "trade" ? (hasPerTurn(t) ? (t.turns ?? 1) : 1) : t.turns);
const hasPerTurn = (t: Extract<DealTerms, { kind: "trade" }>) => (t.give.perTurn ?? 0) > 0 || (t.get.perTurn ?? 0) > 0;

/** All the gold a trade moves (now and over its turns), and its land. */
export function tradeTotals(t: Extract<DealTerms, { kind: "trade" }>) {
  const turns = hasPerTurn(t) ? (t.turns ?? 1) : 0;
  const side = (s: typeof t.give) => (s.gold ?? 0) + (s.perTurn ?? 0) * turns;
  return { give: side(t.give), get: side(t.get), land: (t.give.land?.length ?? 0) + (t.get.land?.length ?? 0), turns };
}

/**
 * A deal's size: how much land a truce covers, how long it runs, how much gold and land it trades; a joint war and
 * passage carry their own weight, and "until X is knocked out" counts as big. Scales the Oathbreaker penalty and a
 * binding pact's price.
 */
export function dealSize(rules: Rules, idx: MapIndex, terms: DealTerms, a: PlayerId, b: PlayerId, owner: OwnerOf): number {
  const z = rules.diplomacy.size;
  switch (terms.kind) {
    case "truce": {
      const land = new Set(coveredBorders(idx, { a, b, terms }, owner).flat());
      return land.size * z.perTerritory + terms.turns * z.perTurn + (terms.until ? z.untilKnockedOut : 0);
    }
    case "war":
      return z.war + terms.turns * z.perTurn;
    case "passage":
      return z.passage + terms.turns * z.perTurn;
    case "trade": {
      const t = tradeTotals(terms);
      return (t.give + t.get) * z.perGold + t.land * z.perLand + t.turns * z.perTurn;
    }
  }
}

/** What each side pays up front for a binding pact of this size. */
export const bindingCost = (rules: Rules, size: number) => Math.round(rules.diplomacy.binding.costBase + rules.diplomacy.binding.costPerSize * size);

/** Breaking a handshake deal of this size: the fine (gold) and the unrest (troops that may desert). */
export function oathPenalty(rules: Rules, size: number): { fine: number; unrest: number } {
  const o = rules.diplomacy.oathbreaker;
  return { fine: Math.round(o.fineBase + o.finePerSize * size), unrest: Math.round(o.unrestPerSize * size) };
}

const okTurns = (n: number, r: { minTurns: number; maxTurns: number }, max: number) => Number.isInteger(n) && n >= r.minTurns && n <= Math.min(r.maxTurns, max);
const okGold = (n: number | undefined) => n === undefined || (Number.isInteger(n) && n >= 0);

/**
 * Do the terms make sense on their own (lengths within the rules, amounts whole and not negative, something to
 * trade)? Null if so. The board is checked as the deal starts (`dealProblem`).
 */
export function termsProblem(rules: Rules, terms: DealTerms): DealProblem | null {
  const r = rules.diplomacy;
  switch (terms.kind) {
    case "truce":
      if (!okTurns(terms.turns, r.truce, r.maxTurns)) return "invalid";
      if (terms.scope.kind === "borders" && !terms.scope.borders.length) return "invalid";
      return null;
    case "war":
      return okTurns(terms.turns, r.war, r.maxTurns) ? null : "invalid";
    case "passage":
      return okTurns(terms.turns, r.passage, r.maxTurns) ? null : "invalid";
    case "trade": {
      const sides = [terms.give, terms.get];
      if (!sides.every((s) => okGold(s.gold) && okGold(s.perTurn))) return "invalid";
      if (hasPerTurn(terms) && !(Number.isInteger(terms.turns) && terms.turns! >= 1 && terms.turns! <= Math.min(r.trade.maxPerTurnTurns, r.maxTurns))) return "invalid";
      const t = tradeTotals(terms);
      if (t.give + t.get + t.land === 0) return "invalid";
      if (t.land > r.trade.maxLand) return "land";
      return null;
    }
  }
}

/** The board as a deal check needs it (the engine passes the game; the page and the bots pass what they see). */
export interface DealBoard {
  owner: OwnerOf;
  troops(t: TerritoryId): number;
  /** Whose capital stands here, or a Leader or captured general (land with one in it can't be traded). */
  pinned(t: TerritoryId): boolean;
}

/**
 * Can `giver` hand this land to `receiver`? Each territory is the giver's, not a capital and not holding a Leader or
 * general, borders the receiver's land, and has a neighbour of the giver's (not traded) for its troops to step back
 * to; the receiver must have a neighbouring army with a troop to spare to move in. Null if so.
 */
export function landProblem(idx: MapIndex, rules: Rules, b: DealBoard, giver: PlayerId, receiver: PlayerId, land: readonly TerritoryId[]): DealProblem | null {
  if (new Set(land).size !== land.length) return "land";
  const spare = new Map<TerritoryId, number>();
  for (const t of land) {
    if (!idx.byId.has(t) || b.owner(t) !== giver || b.pinned(t)) return "land";
    const nbs = idx.neighbors.get(t) ?? [];
    if (!nbs.some((n) => b.owner(n) === giver && !land.includes(n))) return "land";
    const from = moveInFrom(idx, b, receiver, t, spare);
    if (!from) return "land";
    spare.set(from, (spare.get(from) ?? 0) + 1);
  }
  return null;
}

/** The receiver's strongest army next to `t` with a troop to spare (beyond the garrison and any already sent). */
function moveInFrom(idx: MapIndex, b: DealBoard, receiver: PlayerId, t: TerritoryId, used: ReadonlyMap<TerritoryId, number>, garrison = 1): TerritoryId | null {
  let best: TerritoryId | null = null;
  let most = 0;
  for (const n of idx.neighbors.get(t) ?? []) {
    if (b.owner(n) !== receiver) continue;
    const left = b.troops(n) - (used.get(n) ?? 0);
    if (left > garrison && left > most) (best = n), (most = left);
  }
  return best;
}

// ---------- In the engine: a turn's diplomacy ----------

/** What the engine's turn gives the diplomacy rules. */
export interface DiplomacyHost {
  ctx: GameContext;
  s: GameState;
  idx: MapIndex;
  emit(e: GameEvent): void;
  visionChanged(): void;
  /** Pairs of players who attacked each other this turn (`pairKey`): it voids their open offers. */
  readonly fought: Set<string>;
  /** This turn's offers that didn't start a deal, and whether they were declined. */
  readonly offers: { offer: Offer; declined: boolean }[];
}

const living = (s: GameState, p: PlayerId) => s.players.some((x) => x.id === p && x.eliminatedTurn === null);
const playerOf = (s: GameState, p: PlayerId) => s.players.find((x) => x.id === p)!;
const ownerIn = (s: GameState): OwnerOf => (t) => s.territories[t]?.owner ?? null;

function boardOf(s: GameState): DealBoard {
  return {
    owner: ownerIn(s),
    troops: (t) => s.territories[t]?.troops ?? 0,
    pinned: (t) =>
      s.players.some((p) => p.capital === t || (p.leader.alive && p.leader.territory === t) || p.captured.some((g) => g.territory === t)),
  };
}

/** Why this offer can't start a deal right now (null: it can). */
export function dealProblem(ctx: GameContext, s: GameState, offer: Offer): DealProblem | null {
  const { from: a, to: b, terms } = offer;
  if (a === b || !living(s, a) || !living(s, b)) return "gone";
  const t = termsProblem(ctx.rules, terms);
  if (t) return t;
  if (s.deals.some((d) => between(d, a, b) && d.terms.kind === terms.kind)) return "exists";
  const idx = indexMap(ctx.map);
  if (terms.kind === "truce") {
    if (terms.until && (terms.until === a || terms.until === b || !living(s, terms.until))) return "target";
    if (terms.scope.kind === "province" && !idx.provinceMembers.has(terms.scope.province)) return "invalid";
    if (terms.scope.kind === "borders" && terms.scope.borders.some(([x, y]) => !(idx.neighbors.get(x) ?? []).includes(y))) return "invalid";
    // A truce with the target of your binding joint war can't be made (a handshake one breaks the war instead).
    if (s.deals.some((d) => d.terms.kind === "war" && d.bond === "binding" && ((isParty(d, a) && d.terms.target === b) || (isParty(d, b) && d.terms.target === a)))) return "pact";
  }
  if (terms.kind === "war") {
    const target = terms.target;
    if (target === a || target === b || !living(s, target)) return "target";
    // You can't go to war on someone you have a truce with.
    if (s.deals.some((d) => (d.terms.kind === "truce" || d.terms.kind === "war") && (between(d, a, target) || between(d, b, target)))) return "pact";
  }
  if (terms.kind === "trade") {
    const board = boardOf(s);
    if (terms.give.land?.length && landProblem(idx, ctx.rules, board, a, b, terms.give.land)) return "land";
    if (terms.get.land?.length && landProblem(idx, ctx.rules, board, b, a, terms.get.land)) return "land";
    if ((terms.give.land ?? []).some((x) => (terms.get.land ?? []).includes(x))) return "land";
  }
  const size = dealSize(ctx.rules, idx, terms, a, b, ownerIn(s));
  const cost = offer.bond === "binding" ? bindingCost(ctx.rules, size) : 0;
  const nowA = terms.kind === "trade" ? (terms.give.gold ?? 0) : 0;
  const nowB = terms.kind === "trade" ? (terms.get.gold ?? 0) : 0;
  if (playerOf(s, a).gold < cost + nowA || playerOf(s, b).gold < cost + nowB) return "gold";
  return null;
}


/**
 * As the turn starts, before any move: handshake deals renounced, then this planning phase's offers and answers. An
 * accepted offer starts its deal at once (in seat order); the rest are kept until the turn ends, when they lapse.
 */
export function diplomacyStart(h: DiplomacyHost, seats: readonly PlayerId[], orders: OrdersByPlayer) {
  const { s } = h;
  if (!s.settings.diplomacy || !h.ctx.rules.diplomacy) return;
  const list = (p: PlayerId) => (Array.isArray(orders[p]) ? orders[p]! : []);
  for (const pid of seats)
    for (const o of list(pid)) {
      if (o.kind !== "break") continue;
      const d = s.deals.find((x) => x.id === o.deal);
      if (d && isParty(d, pid) && d.bond === "handshake") breakDeal(h, d, pid, "renounced", undefined, o.note);
    }
  const offers = new Map<string, Offer>();
  for (const pid of seats)
    for (const o of list(pid)) {
      if (o.kind !== "propose" || o.offer.from !== pid || o.offer.to === pid || !living(s, pid) || !s.players.some((p) => p.id === o.offer.to)) continue;
      const key = `${pid}|${o.offer.id}`;
      if (!offers.has(key)) offers.set(key, JSON.parse(JSON.stringify(o.offer)) as Offer);
    }
  const answered = new Map<string, boolean>();
  for (const pid of seats)
    for (const o of list(pid)) {
      if (o.kind !== "answer") continue;
      const key = `${o.from}|${o.offer}`;
      const offer = offers.get(key);
      if (!offer || offer.to !== pid || answered.has(key)) continue;
      answered.set(key, o.accept);
      if (o.accept) startDeal(h, offer);
    }
  for (const [key, offer] of offers) if (!answered.get(key)) h.offers.push({ offer, declined: answered.get(key) === false });
}

function startDeal(h: DiplomacyHost, offer: Offer) {
  const { s, ctx, idx } = h;
  const why = dealProblem(ctx, s, offer);
  if (why) {
    h.emit({ type: "dealFailed", offer, why });
    return;
  }
  const { from: a, to: b, terms, bond } = offer;
  const A = playerOf(s, a), B = playerOf(s, b);
  // A handshake truce with the target of your joint war breaks the war (you made peace with the enemy).
  if (terms.kind === "truce")
    for (const w of [...s.deals])
      if (w.terms.kind === "war" && ((isParty(w, a) && w.terms.target === b) || (isParty(w, b) && w.terms.target === a)))
        breakDeal(h, w, isParty(w, a) ? a : b, "truceWithTarget");
  const size = dealSize(ctx.rules, idx, terms, a, b, ownerIn(s));
  const cost = bond === "binding" ? bindingCost(ctx.rules, size) : 0;
  const paid: Record<PlayerId, number> = {};
  const gold: Record<PlayerId, number> = {};
  if (cost) {
    A.gold -= cost;
    B.gold -= cost;
    paid[a] = cost;
    paid[b] = cost;
  }
  const land: LandChange[] = [];
  if (terms.kind === "trade") {
    const give = terms.give.gold ?? 0, get = terms.get.gold ?? 0;
    A.gold += get - give;
    B.gold += give - get;
    if (give || get) {
      gold[a] = get - give;
      gold[b] = give - get;
    }
    land.push(...handOver(h, a, b, terms.give.land ?? []), ...handOver(h, b, a, terms.get.land ?? []));
  }
  const turns = dealTurns(terms);
  const deal: Deal = { id: `d${s.nextDeal++}`, a, b, terms, bond, start: s.turn, last: s.turn + turns - 1, size, ...(terms.kind === "war" ? { struck: [] } : {}) };
  h.emit({ type: "dealStarted", deal: JSON.parse(JSON.stringify(deal)) as Deal, paid, gold, land });
  // A trade with nothing owed each turn is done at once.
  if (terms.kind === "trade" && !hasPerTurn(terms)) record(s, deal, "kept");
  else s.deals.push(deal);
}

/**
 * Land changes hands by agreement: the giver's troops (and specialists) step back to its own strongest neighbouring
 * territory, one of the receiver's troops moves in from its strongest neighbouring army, and buildings stay with the
 * land while its culture is lost (as on a conquest, session 16). Returns the land as it is afterwards.
 */
function handOver(h: DiplomacyHost, giver: PlayerId, receiver: PlayerId, land: readonly TerritoryId[]): LandChange[] {
  const { s, idx, ctx } = h;
  const out = new Map<TerritoryId, LandChange>();
  const note = (t: TerritoryId) => {
    const x = s.territories[t]!;
    out.set(t, { territory: t, owner: x.owner, troops: x.troops, specialists: x.specialists.map((sp) => ({ ...sp })), culture: x.culture });
  };
  for (const t of land) {
    const here = s.territories[t]!;
    const back = (idx.neighbors.get(t) ?? [])
      .filter((n) => s.territories[n]!.owner === giver && !land.includes(n))
      .sort((x, y) => s.territories[y]!.troops - s.territories[x]!.troops || (x < y ? -1 : 1))[0];
    const from = moveInFrom(idx, boardOf(s), receiver, t, new Map());
    // (Checked as the deal started; a two-way swap of neighbouring land can leave one piece with nowhere to go: it stays.)
    if (here.owner !== giver || !back || !from) continue;
    const home = s.territories[back]!;
    home.troops += here.troops;
    const room = Math.max(0, ctx.rules.specialists.maxPerArmy - home.specialists.length);
    home.specialists.push(...here.specialists.slice(0, room));
    s.territories[from]!.troops -= 1;
    here.owner = receiver;
    here.troops = 1;
    here.culture = cultureKept(ctx.rules, here.culture);
    here.specialists = [];
    for (const x of [t, back, from]) note(x);
  }
  if (land.length) h.visionChanged();
  return [...out.values()];
}

function record(s: GameState, d: Deal, how: DealRecord["how"], extra: Partial<DealRecord> = {}) {
  s.record.push({ deal: d.id, kind: d.terms.kind, bond: d.bond, a: d.a, b: d.b, start: d.start, end: s.turn, how, ...extra });
}

/**
 * Troops desert from `lands` (lowest culture first, then the biggest armies), up to `amount`, never below the
 * garrison; culture talks its share out of it (the same rule as unrest when upkeep can't be paid). Returns the land as
 * it is afterwards and how many left.
 */
export function desert(h: Pick<DiplomacyHost, "s" | "ctx">, lands: readonly TerritoryId[], amount: number): { land: LandChange[]; lost: number } {
  const { s, ctx } = h;
  const garrison = ctx.rules.setup.minGarrison;
  let short = amount;
  let lost = 0;
  const land: LandChange[] = [];
  const sorted = [...lands].sort((x, y) => {
    const tx = s.territories[x]!, ty = s.territories[y]!;
    return tx.culture - ty.culture || ty.troops - tx.troops || (x < y ? -1 : 1);
  });
  for (const id of sorted) {
    if (short <= 0) break;
    const t = s.territories[id]!;
    const due = Math.min(Math.max(0, t.troops - garrison), short);
    const lose = Math.floor(due * (1 - cultureProtection(ctx.rules, t.culture)));
    t.troops -= lose;
    if (t.troops === 0) t.specialists = [];
    short -= due;
    lost += lose;
    if (lose > 0) land.push({ territory: id, troops: t.troops, specialists: t.specialists.map((x) => ({ ...x })) });
  }
  return { land, lost };
}

/**
 * A handshake deal broken by `by`: it ends, and `by` gets the public Oathbreaker mark, pays the fine (what it can) and
 * suffers unrest on its land next to the wronged player (culture protects), all scaled by the deal's size.
 */
export function breakDeal(h: DiplomacyHost, d: Deal, by: PlayerId, how: Extract<GameEvent, { type: "dealBroken" }>["how"], at?: TerritoryId, note?: string) {
  const { s, ctx, idx } = h;
  s.deals = s.deals.filter((x) => x.id !== d.id);
  const victim = otherSide(d, by);
  const p = playerOf(s, by);
  const { fine, unrest } = oathPenalty(ctx.rules, d.size);
  const paid = Math.min(Math.max(0, p.gold), fine);
  p.gold -= paid;
  p.oathbreaker = s.turn + ctx.rules.diplomacy.oathbreaker.markTurns;
  const owner = ownerIn(s);
  const near = idx.ids.filter((t) => owner(t) === by && (idx.neighbors.get(t) ?? []).some((n) => owner(n) === victim));
  const { land, lost } = desert(h, near, unrest);
  record(s, d, "broken", { by, ...(at ? { at } : {}) });
  h.emit({ type: "dealBroken", deal: d.id, kind: d.terms.kind, a: d.a, b: d.b, by, how, ...(at ? { at } : {}), ...(note ? { note } : {}), mark: p.oathbreaker, fine: paid, unrest: lost, land });
}

/**
 * An attack by `pid` from `from` into `to`, about to happen: the deal it crosses (if any). A binding pact calls it off
 * (returns the deal); a handshake deal breaks, and the attack goes on (returns null). Also notes who fought whom (it
 * voids their open offers) and which joint-war partners struck their target.
 */
export function attackAcross(h: DiplomacyHost, pid: PlayerId, from: TerritoryId, to: TerritoryId): Deal | null {
  const { s, idx } = h;
  const defender = s.territories[to]?.owner ?? null;
  if (!defender || defender === pid) return null;
  if (s.deals.length) {
    const d = dealAcross(idx, s.deals, from, to, ownerIn(s));
    if (d?.bond === "binding") return d;
    if (d) breakDeal(h, d, pid, "attack", to);
    for (const w of s.deals) if (w.terms.kind === "war" && w.terms.target === defender && isParty(w, pid) && !w.struck!.includes(pid)) w.struck!.push(pid);
  }
  h.fought.add(pairKey(pid, defender));
  return null;
}

/** Is an attack from `from` into `to` covered by any deal (a follow-through never picks one)? */
export function anyDealAcross(h: Pick<DiplomacyHost, "s" | "idx">, from: TerritoryId, to: TerritoryId): boolean {
  return h.s.deals.length > 0 && dealAcross(h.idx, h.s.deals, from, to, ownerIn(h.s)) !== null;
}

/**
 * As the turn ends (after income): gold owed each turn is paid (a binding pact takes it, and anything short becomes
 * unrest; a handshake payment that can't be made breaks the deal), deals whose side was knocked out end, deals that
 * met their goal or ran their course end, and offers that didn't start a deal lapse.
 */
export function diplomacyEndOfTurn(h: DiplomacyHost) {
  const { s } = h;
  if (!h.ctx.rules.diplomacy) return;
  for (const d of [...s.deals]) {
    if (d.terms.kind !== "trade" || !s.deals.includes(d) || !living(s, d.a) || !living(s, d.b)) continue;
    for (const [from, to, side] of [[d.a, d.b, d.terms.give], [d.b, d.a, d.terms.get]] as const) {
      const owed = side.perTurn ?? 0;
      if (!owed || !s.deals.includes(d)) continue;
      const payer = playerOf(s, from), payee = playerOf(s, to);
      if (d.bond === "binding") {
        const gold = Math.min(Math.max(0, payer.gold), owed);
        payer.gold -= gold;
        payee.gold += gold;
        const short = owed - gold;
        const { land } = short > 0 ? desert(h, h.idx.ids.filter((t) => s.territories[t]!.owner === from), short) : { land: [] };
        h.emit({ type: "tribute", deal: d.id, from, to, gold, short, land });
      } else if (payer.gold >= owed) {
        payer.gold -= owed;
        payee.gold += owed;
        h.emit({ type: "tribute", deal: d.id, from, to, gold: owed, short: 0, land: [] });
      } else breakDeal(h, d, from, "payment");
    }
  }
  for (const d of [...s.deals]) {
    let why: Extract<GameEvent, { type: "dealEnded" }>["why"] | null = null;
    if (!living(s, d.a) || !living(s, d.b)) why = "knockedOut";
    else if ((d.terms.kind === "truce" && d.terms.until && !living(s, d.terms.until)) || (d.terms.kind === "war" && !living(s, d.terms.target))) why = "goal";
    else if (d.last <= s.turn) why = "expired";
    if (!why) continue;
    s.deals = s.deals.filter((x) => x.id !== d.id);
    const idle = d.terms.kind === "war" ? [d.a, d.b].filter((p) => !d.struck!.includes(p)) : [];
    record(s, d, why === "knockedOut" ? "ended" : "kept", idle.length ? { idle } : {});
    h.emit({ type: "dealEnded", deal: d.id, kind: d.terms.kind, a: d.a, b: d.b, why, ...(idle.length ? { idle } : {}) });
  }
  for (const { offer, declined } of h.offers)
    h.emit({ type: "offerLapsed", offer, why: h.fought.has(pairKey(offer.from, offer.to)) ? "voided" : declined ? "declined" : "unanswered" });
}

/**
 * Right of passage (session 15): the players whose land `p` may move through. A passage deal lets its proposer (`a`)
 * through the other side's land, and both ways if it's mutual.
 */
export function passageFor(deals: readonly Pick<Deal, "a" | "b" | "terms">[], p: PlayerId): PlayerId[] {
  const out: PlayerId[] = [];
  for (const d of deals) {
    if (d.terms.kind !== "passage") continue;
    if (d.a === p) out.push(d.b);
    else if (d.b === p && d.terms.mutual) out.push(d.a);
  }
  return out;
}

/** Players this player has a truce with (or a joint war alongside): the ones a general may not raid. */
export function partnersOf(deals: readonly Pick<Deal, "a" | "b" | "terms">[], p: PlayerId): PlayerId[] {
  return deals.filter((d) => isParty(d, p) && (d.terms.kind === "truce" || d.terms.kind === "war")).map((d) => otherSide(d, p));
}

/** The defaults a deal card comes with (the page fills them in; change any). */
export function defaultTerms(rules: Rules, kind: DealKind, target?: PlayerId): DealTerms {
  const r = rules.diplomacy;
  switch (kind) {
    case "truce":
      return { kind, scope: { kind: "all" }, turns: r.truce.defaultTurns };
    case "trade":
      return { kind, give: { gold: 10 }, get: {} };
    case "war":
      return { kind, target: target ?? "", turns: r.war.defaultTurns };
    case "passage":
      return { kind, turns: r.passage.defaultTurns, mutual: false };
  }
}

