import { leaderNames, type Rules } from "@conquerra/content";
import { distancesFrom, type MapIndex } from "./mapIndex";
import { Rng, seedRng } from "./rng";
import {
  MILITARY_COMMANDS,
  STEWARD_COMMANDS,
  type Budget,
  type GameContext,
  type GameEvent,
  type GameState,
  type Instruction,
  type LeaderKind,
  type LeaderRecord,
  type LeaderRef,
  type Order,
  type PlayerId,
  type PlayerState,
  type TerritoryId,
} from "./types";

/**
 * Leaders you delegate to (session 18, design additions §4 "REDESIGN"). Every player has two leaders from the start:
 * their **Leader** (military: it stands on the map with an army and keeps its +20% in battle) and their **Steward**
 * (culture, buildings, forts and the economy; it never stands on the map and can't be lost). Knocking a player out
 * gives you both of theirs, up to `rules.leaders.maxOfKind` of each kind (your own included).
 *
 * Each leader has a **purse**: your gold, set aside. As income comes in each turn it's paid its **budget** (a share of
 * the turn's income, or an exact amount), and unspent gold stays there, so it can save up. The purse pays for the
 * orders its leader writes (the planner is in @conquerra/bots). You can take gold back at any time, and purses pay
 * your upkeep before anyone deserts, so they can't be used to dodge costs.
 *
 * This file is the rules side: names, budgets, purses, commands, capture and the cap. Pure and deterministic.
 */

export const leaderKey = (r: LeaderRef): string => `${r.kind}:${r.of}`;
export const sameLeader = (a: LeaderRef, b: LeaderRef): boolean => a.kind === b.kind && a.of === b.of;
export const refOf = (r: LeaderRef): LeaderRef => ({ kind: r.kind, of: r.of });

/** One of a player's leaders, by kind and whose it was first. */
export function findLeader(p: Pick<PlayerState, "leaders">, r: LeaderRef): LeaderRecord | undefined {
  return (p.leaders ?? []).find((x) => sameLeader(x, r));
}

/** The leader an order's purse belongs to: the Steward or military leader that wrote it (null: you wrote it). */
export function authorOf(o: Pick<Order, "general" | "steward">): LeaderRef | null {
  if (o.steward) return { kind: "steward", of: o.steward };
  if (o.general) return { kind: "leader", of: o.general };
  return null;
}

/** Is this a command for a military Leader (else a Steward's)? */
export const isMilitaryCommand = (i: Pick<Instruction, "kind">): boolean => (MILITARY_COMMANDS as readonly string[]).includes(i.kind);
export const isStewardCommand = (i: Pick<Instruction, "kind">): boolean => (STEWARD_COMMANDS as readonly string[]).includes(i.kind);
export const commandFits = (kind: LeaderKind, i: Pick<Instruction, "kind">): boolean => (kind === "leader" ? isMilitaryCommand(i) : isStewardCommand(i));

/** No budget: nothing paid in. */
export const NO_BUDGET: Budget = { share: 0 };
export const isShareBudget = (b: Budget): b is { share: number } => "share" in b;

/** What a budget pays in this turn, given the turn's income (only income actually earned counts for a share). */
export function budgetAmount(b: Budget, earned: number): number {
  if (isShareBudget(b)) return Math.floor(Math.max(0, b.share) * Math.max(0, earned));
  return Math.max(0, Math.floor(b.gold));
}

/** A budget within the rules (a share from 0 to 1, or a whole amount up to the cap), or null if it makes no sense. */
export function cleanBudget(rules: Rules, b: unknown): Budget | null {
  if (typeof b !== "object" || b === null) return null;
  const x = b as Record<string, unknown>;
  if (typeof x.share === "number" && Number.isFinite(x.share)) return { share: Math.min(1, Math.max(0, x.share)) };
  if (typeof x.gold === "number" && Number.isFinite(x.gold)) return { gold: Math.min(rules.leaders.maxGoldBudget, Math.max(0, Math.floor(x.gold))) };
  return null;
}

/** A leader's name as typed: trimmed, inner spaces squeezed, at most the rules' length (null if nothing's left). */
export function cleanName(rules: Rules, name: string | undefined): string | null {
  const n = (name ?? "").replace(/\s+/g, " ").trim().slice(0, rules.leaders.nameMaxLength).trim();
  return n.length ? n : null;
}

/**
 * Names for every seat's Leader and Steward, dealt from the game's seed (its own sequence, so the dice never change):
 * no two Leaders alike, and no two Stewards, until the lists run out.
 */
export function dealLeaderNames(seed: string, players: readonly PlayerId[]): Record<PlayerId, { leader: string; steward: string }> {
  const rng = new Rng(seedRng(`${seed}|leader-names`));
  const leaders = rng.shuffle(leaderNames.leaders);
  const stewards = rng.shuffle(leaderNames.stewards);
  return Object.fromEntries(players.map((p, i) => [p, { leader: leaders[i % leaders.length]!, steward: stewards[i % stewards.length]! }]));
}

/** A sensible name for your Leader (or Steward), for the lobby to fill in: from a seed of the page's choosing. */
export function suggestLeaderName(kind: LeaderKind, seed: string): string {
  const list = kind === "leader" ? leaderNames.leaders : leaderNames.stewards;
  return list[new Rng(seedRng(`${seed}|suggest-${kind}`)).int(list.length)]!;
}

/**
 * A player's own two leaders at the start: the Leader with no command and no budget (you order its army, as before);
 * the Steward on "Run the realm" with `stewardShare` of your income if `delegate` (a person's seat), else idle (a bot
 * plans its whole realm itself).
 */
export function startingLeaders(rules: Rules, of: PlayerId, names: { leader: string; steward: string }, delegate: boolean, share = rules.leaders.stewardShare): LeaderRecord[] {
  return [
    { kind: "leader", of, name: names.leader, command: null, budget: { ...NO_BUDGET }, purse: 0 },
    { kind: "steward", of, name: names.steward, command: delegate ? { kind: "realm" } : null, budget: delegate ? { share } : { ...NO_BUDGET }, purse: 0 },
  ];
}

/**
 * Your Steward's share at the start (session 19): `stewardShare`, or `stewardShareCrowded` on a crowded table (at most
 * `crowdedTerritories` territories a player), where buildings pay back too slowly for more.
 */
export function startingStewardShare(rules: Rules, territories: number, players: number): number {
  const l = rules.leaders;
  return territories / Math.max(1, players) <= (l.crowdedTerritories ?? 12) ? (l.stewardShareCrowded ?? l.stewardShare) : l.stewardShare;
}

/** Where a leader stands: your own Leader (while alive), a captured Leader, or nowhere (a Steward, or gone). */
export function leaderAt(p: Pick<PlayerState, "id" | "leader" | "captured">, r: LeaderRef): TerritoryId | null {
  if (r.kind === "steward") return null;
  if (r.of === p.id) return p.leader.alive ? p.leader.territory : null;
  return p.captured.find((g) => g.of === r.of)?.territory ?? null;
}

/** The whole purse total (shown, smaller, next to the treasury). */
export const pursesTotal = (p: Pick<PlayerState, "leaders">): number => (p.leaders ?? []).reduce((a, l) => a + l.purse, 0);

// ---------- During a turn ----------

/** What the turn gives the leaders' rules. */
export interface LeadersHost {
  ctx: GameContext;
  s: GameState;
  idx: MapIndex;
  emit(e: GameEvent): void;
}

/** A captured military Leader is gone for good: its record goes, and its purse comes home. Returns that gold. */
export function loseCaptured(p: PlayerState, of: PlayerId): number {
  p.captured = p.captured.filter((g) => g.of !== of);
  const r = findLeader(p, { kind: "leader", of });
  if (!r) return 0;
  p.leaders = p.leaders.filter((x) => x !== r);
  p.gold += r.purse;
  return r.purse;
}

/** Let a captured leader go: its purse comes home. */
function release(h: LeadersHost, p: PlayerState, r: LeaderRef) {
  const gold = r.kind === "leader" ? loseCaptured(p, r.of) : releaseSteward(p, r.of);
  h.emit({ type: "generalReleased", player: p.id, general: r.of, ...(r.kind === "steward" ? { steward: true } : {}), ...(gold ? { gold } : {}) });
}

function releaseSteward(p: PlayerState, of: PlayerId): number {
  const r = findLeader(p, { kind: "steward", of });
  if (!r) return 0;
  p.leaders = p.leaders.filter((x) => x !== r);
  p.gold += r.purse;
  return r.purse;
}

/**
 * Is this a sensible command for this leader (it fits the leader's kind, places and provinces exist, a rival is
 * another player still in and not a partner for a raid)?
 */
export function validCommand(h: LeadersHost, p: PlayerState, kind: LeaderKind, i: Instruction, partners: readonly PlayerId[]): boolean {
  if (!commandFits(kind, i)) return false;
  const rival = (id: PlayerId) => id !== p.id && h.s.players.some((x) => x.id === id && x.eliminatedTurn === null);
  const province = (id: string) => h.idx.provinceMembers.has(id);
  switch (i.kind) {
    case "hold":
    case "military":
    case "economy":
    case "realm":
      return true;
    case "push":
    case "expand":
      return h.idx.byId.has(i.territory);
    case "raid":
      // Never a player you have a truce or a joint war with.
      return rival(i.player) && !partners.includes(i.player);
    case "defend":
      return "territory" in i ? h.idx.byId.has(i.territory) : rival(i.player);
    case "front":
      return Array.isArray(i.provinces) && i.provinces.length > 0 && i.provinces.every((x) => typeof x === "string" && province(x)) && new Set(i.provinces).size === i.provinces.length;
    case "buildUp":
    case "culture":
      return province(i.province);
    case "fortify":
      return i.player === undefined || rival(i.player);
  }
  return false;
}

/** Commands only one leader may hold at a time: running the whole military, and running the realm. */
const ONE_AT_A_TIME = new Set(["military", "realm"]);

/**
 * As the turn starts, before any order: captured leaders you let go, then (if you still have one too many of a
 * kind) the ones that go by default, then commands, then budgets and gold taken back. A leader you don't have, or a
 * command or budget that makes no sense, is ignored.
 */
export function commandLeaders(h: LeadersHost, p: PlayerState, list: readonly Order[], partners: readonly PlayerId[]) {
  const { rules } = h.ctx;
  p.leaders ??= [];
  for (const o of list) {
    if (o.kind !== "release" || o.general === p.id) continue;
    const r: LeaderRef = { kind: o.role === "steward" ? "steward" : "leader", of: o.general };
    if (findLeader(p, r)) release(h, p, r);
  }
  const max = rules.leaders.maxOfKind;
  // One too many military Leaders: the ones nearest the front stay (the fewest borders from land another player holds).
  if (p.captured.length + 1 > max) {
    const front = h.idx.ids.filter((t) => {
      const o = h.s.territories[t]!.owner;
      return o !== null && o !== p.id;
    });
    const far = (t: TerritoryId) => {
      const d = distancesFrom(h.idx, t);
      return front.length ? Math.min(...front.map((f) => d.get(f) ?? 1e9)) : 0;
    };
    const ranked = p.captured.map((g, i) => ({ g, i, d: far(g.territory) })).sort((a, b) => a.d - b.d || a.i - b.i);
    for (const r of ranked.slice(max - 1)) release(h, p, { kind: "leader", of: r.g.of });
  }
  // One too many Stewards: the ones with the most in their purse stay (then the first captured).
  const stewards = p.leaders.filter((l) => l.kind === "steward" && l.of !== p.id);
  if (stewards.length + 1 > max)
    for (const r of stewards.map((l, i) => ({ l, i })).sort((a, b) => b.l.purse - a.l.purse || a.i - b.i).slice(max - 1)) release(h, p, r.l);

  for (const o of list) {
    if (o.kind !== "instruct") continue;
    const r = findLeader(p, { kind: o.role === "steward" ? "steward" : "leader", of: o.general });
    if (!r) continue;
    if (o.instruction && !validCommand(h, p, r.kind, o.instruction, partners)) continue;
    // Only one leader runs the whole military, and only one the realm: the newest order wins.
    if (o.instruction && ONE_AT_A_TIME.has(o.instruction.kind)) for (const x of p.leaders) if (x !== r && x.command?.kind === o.instruction.kind) x.command = null;
    r.command = o.instruction ? (JSON.parse(JSON.stringify(o.instruction)) as Instruction) : null;
  }
  for (const o of list) {
    if (o.kind !== "budget") continue;
    const r = findLeader(p, { kind: o.role === "steward" ? "steward" : "leader", of: o.general });
    if (!r) continue;
    if (o.budget !== undefined) {
      const b = cleanBudget(rules, o.budget);
      if (b) r.budget = b;
    }
    if (typeof o.takeBack === "number" && o.takeBack > 0 && r.purse > 0) {
      const gold = Math.min(r.purse, Math.floor(o.takeBack));
      if (gold <= 0) continue;
      r.purse -= gold;
      p.gold += gold;
      h.emit({ type: "purseTaken", player: p.id, leader: refOf(r), gold });
    }
  }
}

/**
 * Upkeep you couldn't pay (`short` gold): your leaders' purses pay it before anyone deserts, the fullest first.
 * Returns what's still short, and who paid what.
 */
export function pursesPayUpkeep(p: PlayerState, short: number): { short: number; paid: (LeaderRef & { gold: number })[] } {
  const paid: (LeaderRef & { gold: number })[] = [];
  const order = (p.leaders ?? []).map((l, i) => ({ l, i })).sort((a, b) => b.l.purse - a.l.purse || a.i - b.i);
  for (const { l } of order) {
    if (short <= 0) break;
    const gold = Math.min(l.purse, short);
    if (gold <= 0) continue;
    l.purse -= gold;
    short -= gold;
    paid.push({ ...refOf(l), gold });
  }
  return { short, paid };
}

/**
 * As income comes in (after upkeep): each leader's budget is paid into its purse from your treasury, in roster order
 * (your Leader, your Steward, then captured ones), never more than the treasury holds. `earned` is the turn's income
 * after upkeep (a share is of that; a bad turn pays shares nothing).
 */
export function payBudgets(p: PlayerState, earned: number): (LeaderRef & { gold: number })[] {
  const paid: (LeaderRef & { gold: number })[] = [];
  for (const l of p.leaders ?? []) {
    const gold = Math.min(p.gold, budgetAmount(l.budget, earned));
    if (gold <= 0) continue;
    p.gold -= gold;
    l.purse += gold;
    paid.push({ ...refOf(l), gold });
  }
  return paid;
}

/**
 * A player is knocked out: their own Leader and Steward join whoever knocked them out (the Leader at the captor's
 * home, with no army until troops are there), with no command and no budget. Everything else of theirs is gone.
 */
export function captureLeaders(h: LeadersHost, loser: PlayerState, captor: PlayerState, home: TerritoryId) {
  const own = (kind: LeaderKind) => findLeader(loser, { kind, of: loser.id });
  captor.leaders ??= [];
  const fresh = (kind: LeaderKind, fallback: string): LeaderRecord => ({ kind, of: loser.id, name: own(kind)?.name ?? fallback, command: null, budget: { ...NO_BUDGET }, purse: 0 });
  captor.captured.push({ of: loser.id, territory: home });
  captor.leaders.push(fresh("leader", `${loser.name}'s Leader`));
  h.emit({ type: "generalCaptured", player: captor.id, general: loser.id, territory: home });
  captor.leaders.push(fresh("steward", `${loser.name}'s Steward`));
  h.emit({ type: "stewardCaptured", player: captor.id, steward: loser.id });
}
