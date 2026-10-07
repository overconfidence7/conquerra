import { marshalData, type MarshalJudgement } from "@conquerra/content";
import {
  distancesFrom,
  isMilitaryCommand,
  isRecruitSiteIn,
  leaderAt,
  leaderKey,
  type GameContext,
  type Instruction,
  type LeaderRecord,
  type LeaderRef,
  type MilitaryCommand,
  type Order,
  type PlayerView,
  type ReplayEvent,
  type StewardCommand,
  type TerritoryId,
} from "@conquerra/engine";
import type { Board } from "../board";
import { respectDeals } from "../diplomacy";
import { launchesFrom, planGeneral } from "../generals";
import { think } from "./judge";
import { freshMemory, type MarshalMemory } from "./memory";
import { marshalBoard, planMarshal, type Steer } from "./plan";
import { planSteward } from "./steward";

/**
 * Your leaders plan (session 18, design additions §4 "REDESIGN"). Every leader with a command writes its orders each
 * turn with the Marshal's brain (`planMarshal`, steered by the command), from your view only, paid from its own purse:
 *
 *  - Hold here, Defend this border, Push toward a place, Raid a rival: its own army, as in session 12, judged on the
 *    Marshal's reading of the board, and it recruits for that army from its purse.
 *  - Expand our empire in this direction (Nate's): toward a target territory. It commands its own army and our armies in
 *    the provinces on the way, and values land by how much closer it gets (the leading edge most, widening the head
 *    next) and by whole provinces on the way (it takes and secures them rather than a thin line). Through empty, weak
 *    land it chains fast (the Marshal's chaining); where rival armies stand it's careful: it only takes land where what
 *    arrives would hold, and keeps honest garrisons. At the target it stops and holds.
 *  - Command this front: every army of ours in the marked provinces, recruiting for them.
 *  - Run the military: every army and all the recruiting.
 *  - The Steward's commands: spending only (steward.ts).
 *
 * Overlaps: a narrower command keeps its armies over a wider one: a leader's own army first, then fronts, then the way
 * an Expand leader is taking, then Run the military. A leader of yours with no command keeps its army for you.
 * Only one leader may run the military and one the realm (the engine keeps it so).
 */

export interface LeadersRequest {
  ctx: GameContext;
  view: PlayerView;
  lastTurn?: readonly ReplayEvent[];
  /** What the leaders remember between turns (the Marshal's memory, for reading a runaway). */
  memory?: MarshalMemory;
  judgement?: MarshalJudgement;
  /** Commands changed this turn but not played yet (the page), by `leaderKey`; null: no command. */
  commands?: Record<string, Instruction | null>;
  /** Purses as they'll be when the turn starts (gold taken back this turn), by `leaderKey`. */
  purses?: Record<string, number>;
  /** Plan only these leaders (by `leaderKey`; default: all with a command). */
  only?: readonly string[];
}

export interface LeadersPlan {
  orders: Order[];
  memory: MarshalMemory;
  /** How many orders each leader wrote (for the page and the sims). */
  written: Record<string, number>;
}

/** Which of our armies each leader commands this turn (a narrower command keeps its armies over a wider one). */
export interface Claims {
  /** Territory -> the leader (by key) commanding the army there. */
  armies: Map<TerritoryId, string>;
  /** Territories where a leader of yours with no command stands: yours to order. */
  yours: Set<TerritoryId>;
}

const STYLE = () => marshalData.leaders.style;

/** Every military leader's and Steward's command as it will be this turn (the page's changes on top of the game's). */
function commandsOf(view: PlayerView, overrides: Record<string, Instruction | null> = {}): { l: LeaderRecord; command: Instruction | null }[] {
  return (view.me.leaders ?? []).map((l) => ({ l, command: leaderKey(l) in overrides ? overrides[leaderKey(l)]! : l.command }));
}

/** The provinces an Expand leader is taking on its way to `target`: within `width` steps of a shortest way there. */
export function expandCorridor(b: Board, from: TerritoryId, target: TerritoryId, width = marshalData.leaders.expand.width): Set<string> {
  const dFrom = distancesFrom(b.idx, from);
  const dTo = distancesFrom(b.idx, target);
  const total = dFrom.get(target) ?? 0;
  const out = new Set<string>();
  for (const t of b.idx.ids) if ((dFrom.get(t) ?? 1e9) + (dTo.get(t) ?? 1e9) <= total + width) out.add(b.idx.byId.get(t)!.province);
  return out;
}

/** Work out which leader commands which of our armies (see the overlap rule above). */
export function claimArmies(b: Board, view: PlayerView, list: { l: LeaderRecord; command: Instruction | null }[]): Claims {
  const armies = new Map<TerritoryId, string>();
  const yours = new Set<TerritoryId>();
  const military = list.filter((x) => x.l.kind === "leader");
  const claim = (t: TerritoryId, key: string) => {
    if (b.owned(t) && !armies.has(t) && !yours.has(t)) armies.set(t, key);
  };
  // 1. Each military leader's own army: its own if it has a command, yours if it hasn't.
  for (const { l, command } of military) {
    const at = leaderAt(view.me, l);
    if (!at || !b.owned(at)) continue;
    if (command) claim(at, leaderKey(l));
    else yours.add(at);
  }
  // 2. Fronts.
  for (const { l, command } of military)
    if (command?.kind === "front") for (const p of command.provinces) for (const t of b.idx.provinceMembers.get(p) ?? []) claim(t, leaderKey(l));
  // 3. The way an Expand leader is taking (until it's there).
  for (const { l, command } of military) {
    const at = leaderAt(view.me, l);
    if (command?.kind !== "expand" || !at || b.owned(command.territory)) continue;
    const way = expandCorridor(b, at, command.territory);
    for (const t of b.mine) if (way.has(b.idx.byId.get(t)!.province)) claim(t, leaderKey(l));
  }
  // 4. Run the military: everything else.
  for (const { l, command } of military) if (command?.kind === "military") for (const t of b.mine) claim(t, leaderKey(l));
  return { armies, yours };
}

/**
 * Every leader's orders for this turn, from your view: each command planned by the Marshal (with its scope and the
 * leader's purse), tagged with the leader that wrote it (its purse pays), and honouring every deal of yours.
 */
export function planLeaders(req: LeadersRequest): LeadersPlan {
  const { ctx, view, lastTurn } = req;
  const J = req.judgement ?? marshalData.judgement;
  const thought = think(ctx, view, J, req.memory ?? freshMemory(), lastTurn);
  const written: Record<string, number> = {};
  const list = commandsOf(view, req.commands).filter((x) => !!x.command && (!req.only || req.only.includes(leaderKey(x.l))));
  if (!list.length || view.me.eliminatedTurn !== null) return { orders: [], memory: thought.memory, written };
  const b = marshalBoard(ctx, view, thought.insight, lastTurn);
  if (!b) return { orders: [], memory: thought.memory, written };
  const claims = claimArmies(b, view, commandsOf(view, req.commands));
  const taken = new Set<TerritoryId>();
  const purseOf = (l: LeaderRecord) => req.purses?.[leaderKey(l)] ?? l.purse;
  const orders: Order[] = [];
  // Military leaders first (they lead the main armies), then Stewards.
  const ordered = [...list].sort((x, y) => Number(x.l.kind === "steward") - Number(y.l.kind === "steward"));
  for (const { l, command } of ordered) {
    const key = leaderKey(l);
    let n = 0;
    const tag = l.kind === "steward" ? { steward: l.of } : { general: l.of };
    const prefix = `${view.me.id}-t${view.turn}-${l.kind === "steward" ? "s" : "l"}${l.of}-`;
    const own = (os: Order[]) => os.map((o) => ({ ...o, id: `${prefix}${n++}`, ...tag }) as Order);
    let mine: Order[] = [];
    if (l.kind === "steward") {
      if (!isMilitaryCommand(command!)) mine = own(planSteward(b, marshalData.leaders.steward, command as StewardCommand, purseOf(l), () => `${prefix}x${n++}`, taken, ctx.rules.game.maxTurnsHard));
    } else if (isMilitaryCommand(command!)) {
      mine = own(planMilitary(ctx, view, b, J, l, command as MilitaryCommand, purseOf(l), claims, thought, lastTurn));
    }
    written[key] = mine.length;
    orders.push(...mine);
  }
  return { orders: respectDeals(ctx, view, orders), memory: thought.memory, written };
}

/** One military leader's orders. */
function planMilitary(
  ctx: GameContext,
  view: PlayerView,
  b: Board,
  J: MarshalJudgement,
  l: LeaderRecord,
  command: MilitaryCommand,
  purse: number,
  claims: Claims,
  thought: ReturnType<typeof think>,
  lastTurn?: readonly ReplayEvent[],
): Order[] {
  const key = leaderKey(l);
  const at = leaderAt(view.me, l);
  const isOwn = l.of === view.me.id;
  const goes: Partial<Order> = isOwn ? { withLeader: true } : { withGeneral: l.of };
  const margin = J.attackFloor?.chainMargin ?? STYLE().attack.chainMargin;
  // At the target, Expand stops and holds there (or marches the last steps through our own land).
  const reached = command.kind === "expand" && b.owned(command.territory);
  const single = command.kind === "hold" || command.kind === "defend" || command.kind === "push" || command.kind === "raid" || reached;
  if (single) {
    if (!at || !b.owned(at)) return [];
    const instruction: Instruction = reached ? (at === (command as { territory: TerritoryId }).territory ? { kind: "hold" } : { kind: "push", territory: (command as { territory: TerritoryId }).territory }) : command;
    // Recruits from its purse join its army first (so they march with it), where it stands if it can recruit there.
    const troop = ctx.rules.troops.cost;
    const count = Math.floor(purse / troop);
    const pre: Order[] = [];
    let plannedView = view;
    if (count > 0) {
      const here = isRecruitSiteIn(ctx, view, at);
      const site = here ? at : nearestSite(ctx, view, b, at);
      if (site) {
        pre.push({ id: "r", kind: "recruit", territory: site, count } as Order);
        if (here) plannedView = withTroops(view, at, count);
        else if (b.idx.neighbors.get(site)!.includes(at)) pre.push({ id: "m", kind: "move", from: site, to: at, troops: count } as Order);
        else {
          const step = stepToward(b, site, at);
          if (step) pre.push({ id: "m", kind: "move", from: site, to: step, troops: count } as Order);
        }
      }
    }
    const board = plannedView === view ? b : marshalBoard(ctx, plannedView, thought.insight, lastTurn);
    return [...pre, ...planGeneral(ctx, plannedView, l.of, instruction, lastTurn, { chainMargin: margin }, board)];
  }

  // Expand, Command this front, Run the military: the Marshal's planner, steered.
  const commands = (t: TerritoryId) => claims.armies.get(t) === key;
  const steer: Steer = { commands, buys: { troops: true, specialists: true, barracks: command.kind !== "expand" }, timing: isOwn };
  if (command.kind === "front") {
    const provinces = new Set(command.provinces);
    const inFront = (t: TerritoryId) => provinces.has(b.idx.byId.get(t)!.province);
    steer.goal = (t) => inFront(t) && commands(t);
    steer.recruitAt = (t) => inFront(t) || b.idx.neighbors.get(t)!.some(inFront);
  } else if (command.kind === "expand") {
    const target = command.territory;
    const E = marshalData.leaders.expand;
    const dT = distancesFrom(b.idx, target);
    const way = at ? expandCorridor(b, at, target) : new Set<string>();
    const head = Math.min(...b.mine.filter(commands).map((t) => dT.get(t) ?? 1e9));
    const provinceOf = (t: TerritoryId) => b.idx.byId.get(t)!.province;
    // What the advance is worth: closer than our nearest land most, as close next (widening the head), and land that
    // completes a province on the way (securing it, behind the head too). Nothing off the way.
    steer.aim = (t, base) => {
      if (!way.has(provinceOf(t))) return null;
      const d = dT.get(t) ?? 1e9;
      const prov = b.idx.provinceMembers.get(provinceOf(t)) ?? [];
      const takingWhole = prov.filter((x) => b.owned(x)).length * 2 >= prov.length;
      const mult = d < head ? E.ahead : d === head ? E.level : takingWhole ? E.province : 0;
      return mult > 0 ? Math.max(base, 0.5) * mult + (takingWhole ? E.province : 0) : null;
    };
    // Slow and safe where it's contested (rival armies next to the land), fast through empty land.
    steer.careful = (t) => b.idx.neighbors.get(t)!.some((x) => !!b.rivalAt(x) && b.troopsAt(x) > b.garrison);
    steer.goal = (t) => commands(t);
  }
  const plan = planMarshal({ ctx, view, personality: STYLE(), judgement: J, memory: thought.memory, insight: thought, ...(lastTurn ? { lastTurn } : {}), scope: { kind: "leader", steer }, purse });
  const orders = plan.orders.filter((o) => o.kind !== "break");
  return at && commands(at) ? carryLeader(orders, at, goes, command.kind === "expand" ? distancesFrom(b.idx, command.territory) : null) : orders;
}

/**
 * The leader goes with its army's main move (its own Leader adds +20%): the biggest attack out of where it stands (for
 * Expand, the one that gets closest), and on through that attack's chain. With no attack, a march carrying most of
 * the army takes it along.
 */
function carryLeader(orders: Order[], at: TerritoryId, goes: Partial<Order>, toward: Map<TerritoryId, number> | null): Order[] {
  const moves = orders.filter((o): o is Extract<Order, { kind: "move" }> => o.kind === "move" && o.from === at);
  if (!moves.length) return orders;
  const size = (o: Extract<Order, { kind: "move" }>) => (typeof o.troops === "number" ? o.troops : 1e6);
  const main = [...moves].sort((x, y) => (toward ? (toward.get(x.to) ?? 0) - (toward.get(y.to) ?? 0) : 0) || size(y) - size(x) || (x.to < y.to ? -1 : 1))[0]!;
  const along = new Set<string>([main.id]);
  let head = main.to;
  for (const o of orders) if (o.kind === "move" && o.from === head && o.troops === "all") (along.add(o.id), (head = o.to));
  return orders.map((o) => (along.has(o.id) ? ({ ...o, ...goes } as Order) : o));
}

/** The view as it will be once `count` recruits stand in `t` (so the army that marches counts them). */
function withTroops(view: PlayerView, t: TerritoryId, count: number): PlayerView {
  const v = view.territories[t];
  if (!v || v.detail !== "full") return view;
  return { ...view, territories: { ...view.territories, [t]: { ...v, troops: v.troops + count } } };
}

/** Our recruit site nearest `at` through our own land. */
function nearestSite(ctx: GameContext, view: PlayerView, b: Board, at: TerritoryId): TerritoryId | null {
  const d = ownDistances(b, at);
  return [...d.keys()].filter((t) => isRecruitSiteIn(ctx, view, t)).sort((x, y) => d.get(x)! - d.get(y)! || (x < y ? -1 : 1))[0] ?? null;
}

function ownDistances(b: Board, from: TerritoryId): Map<TerritoryId, number> {
  const d = new Map<TerritoryId, number>([[from, 0]]);
  const q = [from];
  for (let h = 0; h < q.length; h++)
    for (const nb of b.idx.neighbors.get(q[h]!)!)
      if (b.owned(nb) && !d.has(nb)) {
        d.set(nb, d.get(q[h]!)! + 1);
        q.push(nb);
      }
  return d;
}

function stepToward(b: Board, from: TerritoryId, to: TerritoryId): TerritoryId | null {
  const d = ownDistances(b, to);
  const here = d.get(from);
  if (here === undefined) return null;
  return b.idx.neighbors.get(from)!.filter((x) => b.owned(x) && d.get(x) === here - 1).sort()[0] ?? null;
}

/**
 * Put leaders' orders together with yours (session 18). Your orders come first: an order of yours out of a territory
 * takes that army back from its leader for the turn (all that leader's orders out of its own army step aside, and any
 * leader order out of that territory), and a build or culture of yours on a territory takes that place back from a
 * Steward. Seize the Initiative and Lie in Wait go on one order only: yours win. `placement`: the leaders' orders
 * mixed in with yours (one of yours, then one of theirs) or after yours.
 */
export function mergeLeaderOrders(view: PlayerView, own: readonly Order[], leaders: readonly Order[], placement: "mixed" | "after" = "mixed"): Order[] {
  const ownFrom = new Set(own.map(launchesFrom).filter((t): t is TerritoryId => !!t));
  const places = new Set(own.flatMap((o) => (o.kind === "build" || o.kind === "invest" ? [o.territory] : [])));
  // A leader leading one army (Hold, Defend, Push, Raid) steps aside altogether when you order that army; one with
  // a wider command just loses the armies you order.
  const taken = new Set<string>();
  for (const l of view.me.leaders ?? []) {
    const at = l.kind === "leader" ? leaderAt(view.me, l) : null;
    if (at && ownFrom.has(at) && (l.command?.kind === "hold" || l.command?.kind === "defend" || l.command?.kind === "push" || l.command?.kind === "raid")) taken.add(l.of);
  }
  const timings = new Set(own.map((o) => o.timing).filter(Boolean));
  const kept = leaders
    .filter((o) => {
      if (o.general && taken.has(o.general)) return false;
      const from = launchesFrom(o);
      if (from && ownFrom.has(from)) return false;
      if ((o.kind === "build" || o.kind === "invest") && places.has(o.territory)) return false;
      return true;
    })
    .map((o) => (o.timing && timings.has(o.timing) ? (({ timing: _t, ...rest }) => rest as Order)(o) : o));
  if (placement === "after") return [...own, ...kept];
  const out: Order[] = [];
  for (let i = 0; i < Math.max(own.length, kept.length); i++) {
    if (own[i]) out.push(own[i]!);
    if (kept[i]) out.push(kept[i]!);
  }
  return out;
}

export type { LeaderRef };
