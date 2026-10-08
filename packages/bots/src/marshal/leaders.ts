import { marshalData, type MarshalJudgement, type Personality } from "@conquerra/content";
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
  type PlayerId,
  type PlayerView,
  type ReplayEvent,
  type StewardCommand,
  type TerritoryId,
} from "@conquerra/engine";
import type { Board } from "../board";
import { respectDeals } from "../diplomacy";
import { launchesFrom, planGeneral } from "../generals";
import { think } from "./judge";
import { remnantRivals } from "./finish";
import { freshMemory, type MarshalMemory } from "./memory";
import { carryLeader, marshalBoard, planMarshal, type Steer } from "./plan";
import { planSteward } from "./steward";
import type { Goes } from "./sweep";

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
  /** What each leader is up to this turn, in a line the Leaders panel says in words (session 20), by `leaderKey`. */
  notes: Record<string, LeaderNote>;
}

/**
 * A leader's plain reason for the turn (session 20): finishing a rival off (with the land it knows they hold), pushing
 * one back (the land it's going for, and the army it keeps clear of), or saving its purse for something it names.
 */
export type LeaderNote =
  | { kind: "finishing"; rivals: { rival: PlayerId; land: number }[] }
  | { kind: "pushBack"; rival: PlayerId; going: TerritoryId[]; avoiding: { at: TerritoryId; troops: number } | null; striking: boolean }
  | { kind: "saving"; gold: number; for: "barracks"; at: TerritoryId | null };

/** Which of our armies each leader commands this turn (a narrower command keeps its armies over a wider one). */
export interface Claims {
  /** Territory -> the leader (by key) commanding the army there. */
  armies: Map<TerritoryId, string>;
  /** Territories where a leader of yours with no command stands: yours to order. */
  yours: Set<TerritoryId>;
  /** Clean up (session 20): the rivals each leader on it is finishing, by `leaderKey`. */
  rivalsOf?: Map<string, PlayerId[]>;
}

const STYLE = () => marshalData.leaders.style;
/**
 * How a military leader plays (session 20c, Nate: personalities change play style): a leader with a personality plans
 * with that Marshal personality's block (its weights and switches), under its command's scope and purse; a Neutral
 * one with your leaders' own style.
 */
const styleOf = (l: LeaderRecord): Personality => (l.personality ? (marshalData.personalities.find((p) => p.id === l.personality) ?? STYLE()) : STYLE());
/** Commands a junior's army can work under (a leader that directs more than its own army). */
const SENIOR = new Set(["military", "expand", "front", "cleanup", "pushBack"]);

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

/**
 * Clean up works as one (session 20c, Nate: captured leaders work together): with several leaders cleaning up, or one
 * running the military, the senior is the one running the military, else your own Leader, else the first on Clean up;
 * the others on Clean up join its mass and sweep (their armies are its to move, their purses pay for its troops).
 */
export function cleanUpTeam(list: { l: LeaderRecord; command: Instruction | null }[], me: PlayerId): { senior: LeaderRecord; pooled: LeaderRecord[] } | null {
  const military = list.filter((x) => x.l.kind === "leader");
  const cleaners = military.filter((x) => x.command?.kind === "cleanup").map((x) => x.l);
  const runner = military.find((x) => x.command?.kind === "military")?.l;
  if (!cleaners.length || (!runner && cleaners.length < 2)) return null;
  const senior = runner ?? cleaners.find((l) => l.of === me) ?? cleaners[0]!;
  return { senior, pooled: cleaners.filter((l) => l !== senior) };
}

/** Work out which leader commands which of our armies (see the overlap rule above). */
export function claimArmies(b: Board, view: PlayerView, list: { l: LeaderRecord; command: Instruction | null }[]): Claims {
  const armies = new Map<TerritoryId, string>();
  const yours = new Set<TerritoryId>();
  const military = list.filter((x) => x.l.kind === "leader");
  const claim = (t: TerritoryId, key: string) => {
    if (b.owned(t) && !armies.has(t) && !yours.has(t)) armies.set(t, key);
  };
  const commandOf = (of: PlayerId) => military.find((x) => x.l.of === of)?.command ?? null;
  const team = cleanUpTeam(list, view.me.id);
  const pooled = new Set((team?.pooled ?? []).map(leaderKey));
  // 1. Each military leader's own army: its own if it has a command; your own Leader's is yours if it hasn't. (A
  // captured Leader with no command is just standing there: its army is Run the military's, session 20. They arrive
  // at your capital, and used to freeze its army.) A leader that reports to another: its senior's (session 20).
  for (const { l, command } of military) {
    const at = leaderAt(view.me, l);
    if (!at || !b.owned(at)) continue;
    if (command?.kind === "report") {
      const senior = commandOf(command.to);
      if (senior && SENIOR.has(senior.kind)) claim(at, leaderKey({ kind: "leader", of: command.to }));
    } else if (command && pooled.has(leaderKey(l))) claim(at, leaderKey(team!.senior));
    else if (command) claim(at, leaderKey(l));
    else if (l.of === view.me.id) yours.add(at);
  }
  // 2. Fronts.
  for (const { l, command } of military)
    if (command?.kind === "front") for (const p of command.provinces) for (const t of b.idx.provinceMembers.get(p) ?? []) claim(t, leaderKey(l));
  // 2b. Push back a rival (session 20): our land facing them (two steps from their land, as far as we know).
  for (const { l, command } of military) {
    if (command?.kind !== "pushBack") continue;
    const theirs = b.idx.ids.filter((t) => b.look0(t) === command.player);
    const d = new Map<TerritoryId, number>(theirs.map((t) => [t, 0]));
    const q = [...theirs];
    for (let h = 0; h < q.length; h++) if (d.get(q[h]!)! < 2) for (const nb of b.idx.neighbors.get(q[h]!)!) if (!d.has(nb)) (d.set(nb, d.get(q[h]!)! + 1), q.push(nb));
    for (const t of b.mine) if (d.has(t)) claim(t, leaderKey(l));
  }
  // 2c. Clean up (session 20): the leaders on it share out the rivals left, and each takes our land nearest its own.
  // (Clean up as one team: only its senior takes a share, if it's on Clean up; one running the military has it all.)
  const split = cleanUpSplit(b, view, team ? military.filter((x) => !pooled.has(leaderKey(x.l))) : military);
  for (const [t, key] of split.land) claim(t, key);
  // 3. The way an Expand leader is taking (until it's there).
  for (const { l, command } of military) {
    const at = leaderAt(view.me, l);
    if (command?.kind !== "expand" || !at || b.owned(command.territory)) continue;
    const way = expandCorridor(b, at, command.territory);
    for (const t of b.mine) if (way.has(b.idx.byId.get(t)!.province)) claim(t, leaderKey(l));
  }
  // 4. Run the military: everything else.
  for (const { l, command } of military) if (command?.kind === "military") for (const t of b.mine) claim(t, leaderKey(l));
  return { armies, yours, rivalsOf: split.rivals };
}

/**
 * Clean up (session 20, Nate): every leader on it works together. The rivals left (as far as we know, most land
 * first) are shared out: each to the leader on Clean up with the fewest so far, the nearest breaking ties (with more
 * leaders than rivals, a rival gets more than one). Each of our territories goes to the leader whose rivals' land is
 * nearest (within 10 steps: Run the military keeps the rest, if anyone's running it).
 */
function cleanUpSplit(b: Board, view: PlayerView, military: { l: LeaderRecord; command: Instruction | null }[]): { rivals: Map<string, PlayerId[]>; land: Map<TerritoryId, string> } {
  const rivals = new Map<string, PlayerId[]>();
  const land = new Map<TerritoryId, string>();
  const cleaners = military.filter((x) => x.command?.kind === "cleanup").map((x) => x.l);
  if (!cleaners.length) return { rivals, land };
  const left = remnantRivals(b, { territories: 0, share: 0 }, true);
  if (!left.length) return { rivals, land };
  const theirLand = new Map(left.map((r) => [r, b.idx.ids.filter((t) => b.look0(t) === r)]));
  const home = (l: LeaderRecord) => leaderAt(view.me, l) ?? (b.capital ?? b.mine[0]!);
  const dist = new Map(cleaners.map((l) => [leaderKey(l), distancesFrom(b.idx, home(l))]));
  const far = (l: LeaderRecord, r: PlayerId) => Math.min(...theirLand.get(r)!.map((t) => dist.get(leaderKey(l))!.get(t) ?? 1e9));
  for (const l of cleaners) rivals.set(leaderKey(l), []);
  const byLand = [...left].sort((x, y) => theirLand.get(y)!.length - theirLand.get(x)!.length || (x < y ? -1 : 1));
  for (const r of byLand) {
    const l = [...cleaners].sort((x, y) => rivals.get(leaderKey(x))!.length - rivals.get(leaderKey(y))!.length || far(x, r) - far(y, r) || (leaderKey(x) < leaderKey(y) ? -1 : 1))[0]!;
    rivals.get(leaderKey(l))!.push(r);
  }
  for (const l of cleaners)
    if (!rivals.get(leaderKey(l))!.length) rivals.get(leaderKey(l))!.push([...left].sort((x, y) => far(l, x) - far(l, y) || (x < y ? -1 : 1))[0]!);
  // Our land: to whichever leader's rivals are nearest.
  const near = new Map<string, Map<TerritoryId, number>>();
  for (const l of cleaners) {
    const starts = rivals.get(leaderKey(l))!.flatMap((r) => theirLand.get(r)!);
    const d = new Map<TerritoryId, number>(starts.map((t) => [t, 0]));
    const q = [...starts];
    for (let h = 0; h < q.length; h++) if (d.get(q[h]!)! < 10) for (const nb of b.idx.neighbors.get(q[h]!)!) if (!d.has(nb)) (d.set(nb, d.get(q[h]!)! + 1), q.push(nb));
    near.set(leaderKey(l), d);
  }
  const anyoneRuns = military.some((x) => x.command?.kind === "military");
  for (const t of b.mine) {
    const best = cleaners.map((l) => ({ k: leaderKey(l), d: near.get(leaderKey(l))!.get(t) })).filter((x) => x.d !== undefined || !anyoneRuns).sort((x, y) => (x.d ?? 1e9) - (y.d ?? 1e9) || (x.k < y.k ? -1 : 1))[0];
    if (best) land.set(t, best.k);
  }
  return { rivals, land };
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
  const notes: Record<string, LeaderNote> = {};
  const list = commandsOf(view, req.commands).filter((x) => !!x.command && (!req.only || req.only.includes(leaderKey(x.l))));
  if (!list.length || view.me.eliminatedTurn !== null) return { orders: [], memory: thought.memory, written, notes };
  const b = marshalBoard(ctx, view, thought.insight, lastTurn);
  if (!b) return { orders: [], memory: thought.memory, written, notes };
  const claims = claimArmies(b, view, commandsOf(view, req.commands));
  const taken = new Set<TerritoryId>();
  /** Forts the military leaders ask the Stewards for (session 20). */
  const asked = new Set<TerritoryId>();
  const purseOf = (l: LeaderRecord) => req.purses?.[leaderKey(l)] ?? l.purse;
  const orders: Order[] = [];
  // Military leaders first (they lead the main armies), then Stewards.
  const ordered = [...list].sort((x, y) => Number(x.l.kind === "steward") - Number(y.l.kind === "steward"));
  const team = cleanUpTeam(commandsOf(view, req.commands), view.me.id);
  const pooled = new Set((team?.pooled ?? []).map(leaderKey));
  for (const { l, command } of ordered) {
    const key = leaderKey(l);
    let n = 0;
    const tag = l.kind === "steward" ? { steward: l.of } : { general: l.of };
    const prefix = `${view.me.id}-t${view.turn}-${l.kind === "steward" ? "s" : "l"}${l.of}-`;
    // Its purse pays (a fallback too: a recruit whose site was lost recruits elsewhere, session 20).
    const tagged = (o: Order): Order => ({ ...o, ...tag, ...(o.fallback ? { fallback: tagged(o.fallback) } : {}), ...(o.then ? { then: tagged(o.then) } : {}) }) as Order;
    const own = (os: Order[]) => os.map((o) => ({ ...tagged(o), id: `${prefix}${n++}` }) as Order);
    let mine: Order[] = [];
    // A leader that reports to another plans nothing itself: its senior directs its army and spends its budget. So
    // does one on Clean up that has joined the team (session 20c): its senior's orders spend its purse.
    if (command!.kind === "report" || pooled.has(key)) mine = [];
    else if (l.kind === "steward") {
      if (!isMilitaryCommand(command!)) mine = own(planSteward(b, marshalData.leaders.steward, command as StewardCommand, purseOf(l), () => `${prefix}x${n++}`, taken, ctx.rules.game.maxTurnsHard, asked, l.personality ?? null));
    } else if (isMilitaryCommand(command!)) {
      const juniors = commandsOf(view, req.commands).filter((x) => x.l.kind === "leader" && x.command?.kind === "report" && x.command.to === l.of).map((x) => x.l);
      const team0 = team && team.senior === l ? team.pooled : [];
      const purse = purseOf(l) + team0.reduce((a, j) => a + purseOf(j), 0);
      const planned = planMilitary(ctx, view, b, J, l, command as MilitaryCommand, purse, claims, thought, lastTurn, [...juniors, ...team0]);
      mine = own(planned.orders);
      if (team0.length) mine = shareRecruits(mine, [l, ...team0].map((x) => ({ of: x.of, gold: purseOf(x) })), ctx.rules.troops.cost, () => `${prefix}${n++}`);
      for (const j of team0) if (planned.note) notes[leaderKey(j)] = planned.note;
      if (planned.note) notes[key] = planned.note;
      // Where it builds (a barracks), a Steward doesn't.
      for (const o of mine) if (o.kind === "build") taken.add(o.territory);
      for (const t of planned.forts) asked.add(t);
    }
    written[key] = mine.length;
    orders.push(...mine);
  }
  return { orders: respectDeals(ctx, view, orders), memory: thought.memory, written, notes };
}

/**
 * A team's troops (session 20c): the senior's recruits are paid from each purse in turn (the senior's first), an order
 * split where a purse runs out, each part tagged with the leader whose purse pays.
 */
function shareRecruits(orders: Order[], purses: { of: PlayerId; gold: number }[], cost: number, newId: () => string): Order[] {
  const left = purses.map((p) => ({ ...p }));
  const out: Order[] = [];
  for (const o of orders) {
    if (o.kind !== "recruit" || typeof o.count !== "number") {
      out.push(o);
      continue;
    }
    let count = o.count;
    let first = true;
    for (const p of left) {
      if (count <= 0) break;
      const n = Math.min(count, Math.floor(p.gold / cost));
      if (n <= 0) continue;
      p.gold -= n * cost;
      count -= n;
      const fb = o.fallback && o.fallback.kind === "recruit" ? { fallback: { ...o.fallback, id: newId(), count: n, general: p.of } as Order } : {};
      out.push({ ...o, ...(first ? {} : { id: newId() }), count: n, general: p.of, ...fb } as Order);
      first = false;
    }
    if (first) out.push(o);
  }
  return out;
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
  juniors: readonly LeaderRecord[] = [],
): { orders: Order[]; note: LeaderNote | null; forts: TerritoryId[] } {
  const key = leaderKey(l);
  const at = leaderAt(view.me, l);
  const isOwn = l.of === view.me.id;
  const goes: Goes = isOwn ? { withLeader: true } : { withGeneral: l.of };
  const P = styleOf(l);
  const margin = J.attackFloor?.chainMargin ?? P.attack.chainMargin;
  // At the target, Expand stops and holds there (or marches the last steps through our own land).
  const reached = command.kind === "expand" && b.owned(command.territory);
  const single = command.kind === "hold" || command.kind === "defend" || command.kind === "push" || command.kind === "raid" || reached;
  if (single) {
    if (!at || !b.owned(at)) return { orders: [], note: null, forts: [] };
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
    return { orders: [...pre, ...planGeneral(ctx, plannedView, l.of, instruction, lastTurn, { chainMargin: margin }, board)], note: null, forts: [] };
  }

  // Expand, Command this front, Run the military: the Marshal's planner, steered.
  const commands = (t: TerritoryId) => claims.armies.get(t) === key;
  const steer: Steer = { commands, buys: { troops: true, specialists: true, barracks: command.kind !== "expand" }, timing: isOwn, guardsCapital: command.kind === "military", rider: at && commands(at) ? { at, goes } : null };
  let pushing: { rival: PlayerId; biggest: { at: TerritoryId; troops: number } | null } | null = null;
  if (command.kind === "cleanup") {
    // Clean up (session 20): it finishes the rivals it was given (with the other leaders on Clean up), all of them.
    const mineToFinish = claims.rivalsOf?.get(key) ?? [];
    steer.cleanUp = true;
    steer.finishes = (r) => mineToFinish.includes(r);
    steer.aim = (t, base) => {
      const o = b.look(t).owner;
      if (o && mineToFinish.includes(o)) return Math.max(base, 0.5) * 2;
      return o ? null : base;
    };
  } else if (command.kind === "pushBack") {
    // Push back one rival (session 20, Nate): its weakly held land (the less there, the better), never anyone else's
    // (neutral land only on the way to theirs), and only where what arrives would hold next to its bigger armies.
    const R = command.player;
    const ofR = (t: TerritoryId) => b.look0(t) === R;
    const nearR = (t: TerritoryId) => b.idx.neighbors.get(t)!.some(ofR);
    steer.aim = (t, base) => (ofR(t) ? Math.max(base, 0.5) * (1 + 4 / (1 + b.look(t).troops)) : !b.look(t).owner && nearR(t) ? Math.max(base, 0.5) * 0.5 : null);
    steer.careful = (t) => b.idx.neighbors.get(t)!.some((x) => b.rivalAt(x) === R && b.troopsAt(x) > b.garrison * 3);
    steer.finishes = (r) => r === R;
    steer.goal = (t) => commands(t) && (nearR(t) || b.idx.neighbors.get(t)!.some(nearR));
    const stacks = b.idx.ids.filter((t) => ofR(t) && !!b.seen(t)).sort((x, y) => b.troopsAt(y) - b.troopsAt(x) || (x < y ? -1 : 1));
    pushing = { rival: R, biggest: stacks[0] && b.troopsAt(stacks[0]) > b.garrison * 3 ? { at: stacks[0], troops: b.troopsAt(stacks[0]) } : null };
  }
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
  const plan = planMarshal({ ctx, view, personality: P, judgement: J, memory: thought.memory, insight: thought, ...(lastTurn ? { lastTurn } : {}), scope: { kind: "leader", steer }, purse });
  let orders: Order[] = plan.orders.filter((o) => o.kind !== "break");
  if (at && commands(at) && !plan.leaderPlaced) orders = carryLeader(orders, at, goes, command.kind === "expand" ? distancesFrom(b.idx, command.territory) : null);
  // A leader that reports to this one goes with its own army's main move (its portrait shows on that order).
  for (const j of juniors) {
    const jat = leaderAt(view.me, j);
    if (jat && commands(jat)) orders = carryLeader(orders, jat, j.of === view.me.id ? { withLeader: true } : { withGeneral: j.of }, null);
  }
  // What it's up to, in a line (session 20).
  let note: LeaderNote | null = null;
  if (pushing) {
    const going = orders.flatMap((o) => (o.kind === "move" && b.look0(o.to) === pushing!.rival ? [o.to] : []));
    note = { kind: "pushBack", rival: pushing.rival, going: going.slice(0, 2), avoiding: pushing.biggest && !going.includes(pushing.biggest.at) ? pushing.biggest : null, striking: !!pushing.biggest && going.includes(pushing.biggest.at) };
  } else if (plan.finishing.length) note = { kind: "finishing", rivals: plan.finishing };
  else if (plan.saving) note = { kind: "saving", ...plan.saving };
  return { orders, note, forts: plan.fortsWanted };
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

export type { LeaderRef, PlayerId };
