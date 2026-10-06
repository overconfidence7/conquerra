import type { GameContext, GameEvent, GameState, OrdersByPlayer, PlayerId, PlayerState, Spy, SpyStatus, TerritoryDetail, TerritoryId } from "./types";
import { recordSighting } from "./intel";
import { indexMap, type MapIndex } from "./mapIndex";
import { Rng } from "./rng";
import { trueDetail } from "./view";
import { visionFor } from "./vision";

/**
 * Spies (session 15, design additions §8, with Nate's Oct 6 decisions). Every number is in `rules.spies`.
 *
 *  - **A spy is its own piece**, hired at your capital or a barracks (8 gold, 1 gold upkeep, up to 5). Only its owner
 *    ever sees it.
 *  - **Spies act between turns.** Sending one (or calling it home) is an order that takes no slot; as the turn ends,
 *    after every army's move, called-home spies are back at the capital, the others travel 2 territories toward the
 *    province they were sent to, and every contest is run.
 *  - **Travelling** in a province no single player holds whole, a spy lifts the fog 2 territories around it.
 *  - **Infiltrating:** entering a province one player holds whole is an attempt. Only that player can defend it, with
 *    spies stationed in it. Spy against spy (at most 3 a side count): each attacking spy beyond the first cancels one
 *    defender; what's left decides: 0 infiltrates (the fog stays lifted on the whole province every turn), 1 blocked
 *    (it's home again), 2 killed (every spy in the attempt), 3 fooled (it thinks it got in, and sees a false picture
 *    close to the truth). The contest runs again whenever the province's holder or its defence changes.
 *  - **The defender is told** when a spy is blocked or killed, never when one is fooled. Spies never affect combat.
 *  - **Reports:** as the turn ends, each player's spies report what they see (`state.spyIntel`), and it goes into
 *    their "last seen" memory. A fooled spy's report is made from the true state with the game's seeded random numbers
 *    (`decks.spies`) and stored exactly like a true one, so nothing in a player's view tells the two apart. What you see
 *    yourself always wins: your own land and the land bordering it are never in a spy report.
 *
 * Spy intel is a report between turns, not live vision: during the replay, a battle in a spied province shows only as
 * "a battle in ..." whether the spy is real or fooled.
 */

/** Spies are in the game (a setting, and only with fog: with fog off there's nothing to spy on). */
export const spiesOn = (s: Pick<GameState, "settings">) => s.settings.spies !== false && s.settings.fog;

/** Who holds the whole of a province (null: no single player does). */
export function wholeHolder(idx: MapIndex, s: GameState, province: string): PlayerId | null {
  const members = idx.provinceMembers.get(province) ?? [];
  const first = members.length ? s.territories[members[0]!]!.owner : null;
  return first && members.every((t) => s.territories[t]!.owner === first) ? first : null;
}

/** What the engine's turn gives the spy rules. */
export interface SpyHost {
  ctx: GameContext;
  s: GameState;
  idx: MapIndex;
  emit(e: GameEvent): void;
  /** The capital if they hold it, else their strongest territory. */
  homeOf(p: PlayerState): TerritoryId | null;
}

const provinceOf = (idx: MapIndex, t: TerritoryId) => idx.byId.get(t)!.province;
const byId = (a: Spy, b: Spy) => (a.id.length - b.id.length) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Hire a spy at `territory`. Null if it worked, else why not. */
export function hireSpy(h: SpyHost, p: PlayerState, territory: TerritoryId, orderId: string): { code: "invalid" | "notHeld" | "hireSite" | "spyCap" | "notEnoughGold"; gold?: number; cost?: number } | null {
  const { s, ctx } = h;
  const r = ctx.rules.spies;
  if (!spiesOn(s)) return { code: "invalid" };
  const t = s.territories[territory];
  if (!t || t.owner !== p.id) return { code: "notHeld" };
  if (territory !== p.capital && t.building !== "barracks") return { code: "hireSite" };
  if (s.spies.filter((x) => x.owner === p.id).length >= r.max) return { code: "spyCap" };
  if (p.gold < r.cost) return { code: "notEnoughGold", gold: p.gold, cost: r.cost };
  p.gold -= r.cost;
  const spy: Spy = { id: `y${s.nextSpy++}`, owner: p.id, at: territory, target: null, recalled: false, status: "travel" };
  spy.status = statusAt(h.idx, s, spy);
  s.spies.push(spy);
  h.emit({ type: "spyHired", player: p.id, orderId, territory, spy: spy.id, cost: r.cost });
  return null;
}

/** As the turn starts: where each player sends their spies (a province), or which they call home. Takes no slot. */
export function spyOrders(h: SpyHost, seats: readonly PlayerId[], orders: OrdersByPlayer) {
  const { s, idx } = h;
  if (!spiesOn(s)) return;
  for (const pid of seats)
    for (const o of Array.isArray(orders[pid]) ? orders[pid]! : []) {
      if (o.kind !== "spy") continue;
      const spy = s.spies.find((x) => x.id === o.spy && x.owner === pid);
      if (!spy) continue;
      if (o.to === null) {
        spy.recalled = true;
        spy.target = null;
      } else if (idx.provinceMembers.has(o.to)) {
        spy.recalled = false;
        spy.target = provinceOf(idx, spy.at) === o.to ? null : o.to;
      }
    }
}

/** Where a spy stands, before any contest: in a province no one holds whole (travel), or one its owner does (defend). */
function statusAt(idx: MapIndex, s: GameState, spy: Spy): SpyStatus {
  const holder = wholeHolder(idx, s, provinceOf(idx, spy.at));
  return holder === null ? "travel" : holder === spy.owner ? "defend" : "in";
}

/** The next step from `at` on a shortest way to the nearest territory of `province` (ties by map order). */
function nextStep(idx: MapIndex, at: TerritoryId, province: string): TerritoryId | null {
  const prev = new Map<TerritoryId, TerritoryId | null>([[at, null]]);
  const q = [at];
  while (q.length) {
    const t = q.shift()!;
    if (t !== at && provinceOf(idx, t) === province) {
      let step = t;
      while (prev.get(step) !== at) step = prev.get(step)!;
      return step;
    }
    for (const n of idx.neighbors.get(t) ?? [])
      if (!prev.has(n)) {
        prev.set(n, t);
        q.push(n);
      }
  }
  return null;
}

/**
 * As the turn ends (after the card decks): spies of players knocked out are gone; spies called home are back at the
 * capital; the rest travel toward where they were sent (stopping at a province someone else holds whole: an attempt);
 * then every contest that's new, or whose province's holder or defence changed, is run.
 */
export function spiesEndOfTurn(h: SpyHost) {
  const { s, ctx, idx } = h;
  if (!s.spies?.length) return;
  const r = ctx.rules.spies;
  const player = (id: PlayerId) => s.players.find((p) => p.id === id)!;
  s.spies = s.spies.filter((x) => player(x.owner).eliminatedTurn === null).sort(byId);
  const home = (spy: Spy): boolean => {
    const at = h.homeOf(player(spy.owner));
    if (!at) return false;
    spy.at = at;
    spy.target = null;
    spy.recalled = false;
    spy.status = statusAt(idx, s, spy);
    delete spy.holder, delete spy.defence, delete spy.fooled;
    return true;
  };
  const gone = new Set<string>();
  /** The province each infiltrating spy was in as the turn ended, before anything moved. */
  const wasIn = new Map(s.spies.filter((x) => x.status === "in").map((x) => [x.id, provinceOf(idx, x.at)]));

  // Called home: back at the capital as the next turn starts.
  for (const spy of s.spies) {
    if (!spy.recalled) continue;
    if (home(spy)) h.emit({ type: "spy", player: spy.owner, spies: [spy.id], province: provinceOf(idx, spy.at), outcome: "home", territory: spy.at });
    else gone.add(spy.id);
  }
  const inProvince = (owner: PlayerId, province: string) => s.spies.filter((x) => x.owner === owner && !gone.has(x.id) && provinceOf(idx, x.at) === province).length;

  // Travel: `travel` territories toward the province it was sent to. Entering a province someone else holds whole is an
  // attempt to infiltrate it (it stops there); at most `maxPerProvince` of yours go into one province.
  for (const spy of s.spies) {
    if (gone.has(spy.id) || !spy.target) continue;
    for (let step = 0; step < r.travel && spy.target; step++) {
      const next = nextStep(idx, spy.at, spy.target);
      if (!next) {
        spy.target = null;
        break;
      }
      const prov = provinceOf(idx, next);
      const holder = wholeHolder(idx, s, prov);
      const stops = prov === spy.target || (holder !== null && holder !== spy.owner);
      if (stops && provinceOf(idx, spy.at) !== prov && inProvince(spy.owner, prov) >= r.maxPerProvince) break;
      spy.at = next;
      if (prov === spy.target) spy.target = null;
      if (stops) break;
    }
  }

  // Where each spy stands now: travelling, defending, or facing a contest in a rival's province.
  const groups = new Map<string, Spy[]>();
  for (const spy of s.spies) {
    if (gone.has(spy.id)) continue;
    const prov = provinceOf(idx, spy.at);
    const holder = wholeHolder(idx, s, prov);
    if (holder === null || holder === spy.owner) {
      spy.status = holder === null ? "travel" : "defend";
      delete spy.holder, delete spy.defence, delete spy.fooled;
      continue;
    }
    const key = `${spy.owner}|${prov}`;
    groups.set(key, [...(groups.get(key) ?? []), spy]);
  }

  // Spy against spy: each attacking spy beyond the first cancels one defender; what's left decides.
  for (const key of [...groups.keys()].sort()) {
    const group = groups.get(key)!;
    const owner = group[0]!.owner;
    const prov = provinceOf(idx, group[0]!.at);
    const holder = wholeHolder(idx, s, prov)!;
    const defence = Math.min(r.maxPerProvince, s.spies.filter((x) => x.owner === holder && !gone.has(x.id) && provinceOf(idx, x.at) === prov).length);
    // A contest runs for spies new to this province, or when its holder or its defence changed.
    const fresh = group.filter((x) => wasIn.get(x.id) !== prov || x.holder !== holder || x.defence !== defence);
    if (!fresh.length) continue;
    const attackers = Math.min(r.maxPerProvince, group.length);
    const left = Math.min(3, Math.max(0, defence - (attackers - 1)));
    const territory = fresh[0]!.at;
    if (left === 0 || left === 3) {
      // Infiltrated, or fooled (it thinks it got in: its owner is told exactly the same). Spies already inside that
      // survive a contest run again say nothing.
      const arrived = fresh.filter((x) => wasIn.get(x.id) !== prov || x.holder !== holder).map((x) => x.id);
      for (const x of group) Object.assign(x, { status: "in", holder, defence, fooled: left === 3 });
      if (arrived.length) h.emit({ type: "spy", player: owner, spies: arrived, province: prov, outcome: "in", territory });
      continue;
    }
    const ids = group.map((x) => x.id);
    if (left === 1) {
      // Blocked: the spies come home.
      for (const x of group) if (!home(x)) gone.add(x.id);
    } else for (const x of group) gone.add(x.id);
    h.emit({ type: "spy", player: owner, spies: ids, province: prov, outcome: left === 1 ? "blocked" : "killed", territory });
    h.emit({ type: "spyCaught", player: holder, province: prov, outcome: left === 1 ? "blocked" : "killed", spies: ids.length });
  }
  s.spies = s.spies.filter((x) => !gone.has(x.id));
}

/**
 * After the turn number moves on: each player's spy report (`state.spyIntel`), and what it shows goes into their "last
 * seen" memory. True for travelling spies (the land around them) and real infiltrations (the whole province); a fooled
 * spy's province is a false picture close to the truth. Land the player sees directly is left out.
 */
export function spyReports(ctx: GameContext, s: GameState) {
  s.spyIntel = {};
  if (!spiesOn(s) || s.winner) return;
  const idx = indexMap(ctx.map);
  const r = ctx.rules.spies;
  const rng = new Rng(s.decks.spies);
  for (const p of s.players) {
    if (p.eliminatedTurn !== null) continue;
    const mine = s.spies.filter((x) => x.owner === p.id).sort(byId);
    if (!mine.length) continue;
    const direct = visionFor(ctx, s, p.id);
    const real = new Set<TerritoryId>();
    const fooled = new Set<string>();
    for (const spy of mine) {
      if (spy.status === "travel") for (const t of around(idx, spy.at, r.sight)) real.add(t);
      else if (spy.status === "in") {
        if (spy.fooled) fooled.add(provinceOf(idx, spy.at));
        else for (const t of idx.provinceMembers.get(provinceOf(idx, spy.at)) ?? []) real.add(t);
      }
    }
    const report: Record<TerritoryId, TerritoryDetail> = {};
    for (const t of idx.ids) if (real.has(t) && !direct.has(t)) report[t] = trueDetail(s, t);
    for (const prov of [...fooled].sort()) {
      const land = (idx.provinceMembers.get(prov) ?? []).filter((t) => !direct.has(t) && !real.has(t));
      Object.assign(report, forgedDetails(ctx, s, land, rng));
    }
    // In map order, like every other view of the map.
    const ordered: Record<TerritoryId, TerritoryDetail> = {};
    for (const t of idx.ids) if (report[t]) ordered[t] = report[t];
    s.spyIntel[p.id] = ordered;
    for (const [t, d] of Object.entries(ordered)) recordSighting(s, p.id, t, { owner: d.owner, troops: d.troops, building: d.building, turn: s.turn });
  }
  s.decks.spies = rng.state;
}

/** Every territory within `radius` borders of `t` (including `t`). */
function around(idx: MapIndex, t: TerritoryId, radius: number): TerritoryId[] {
  const seen = new Set([t]);
  let frontier = [t];
  for (let i = 0; i < radius; i++) {
    const next: TerritoryId[] = [];
    for (const f of frontier) for (const n of idx.neighbors.get(f) ?? []) if (!seen.has(n)) (seen.add(n), next.push(n));
    frontier = next;
  }
  return [...seen];
}

/**
 * A fooled spy's false picture of `land`, close to the truth: the owner (and buildings, and whose capital it is) are
 * right; each House's troops and specialists are moved around its own land there and each army is off by up to
 * `troopJitter`; some culture is a level off; Leaders and captured generals stand somewhere else of their House's. Made
 * from the true state with the game's seeded random numbers, in the same shape as the truth.
 */
export function forgedDetails(ctx: GameContext, s: GameState, land: readonly TerritoryId[], rng: Rng): Record<TerritoryId, TerritoryDetail> {
  const f = ctx.rules.spies.fooled;
  const out: Record<TerritoryId, TerritoryDetail> = {};
  for (const t of land) out[t] = trueDetail(s, t);
  const owners = [...new Set(land.map((t) => out[t]!.owner ?? ""))].sort();
  for (const o of owners) {
    const theirs = land.filter((t) => (out[t]!.owner ?? "") === o);
    // Armies moved around (troops and their specialists), then each off by a little.
    const troops = rng.shuffle(theirs.map((t) => out[t]!.troops));
    const specs = rng.shuffle(theirs.flatMap((t) => out[t]!.specialists));
    theirs.forEach((t, i) => {
      const d = out[t]!;
      d.troops = Math.max(1, Math.round(troops[i]! * (1 + (rng.next() * 2 - 1) * f.troopJitter)));
      d.specialists = [];
      if (rng.next() < f.cultureChance) d.culture = Math.max(0, Math.min(ctx.rules.culture.max, d.culture + (rng.next() < 0.5 ? -1 : 1)));
    });
    for (const sp of specs) {
      const room = theirs.filter((t) => out[t]!.specialists.length < ctx.rules.specialists.maxPerArmy);
      if (room.length) out[room[rng.int(room.length)]!]!.specialists.push(sp);
    }
    // Leaders and captured generals somewhere else of their House's (if it has more land there).
    for (const key of ["leaders", "generals"] as const) {
      const standing = theirs.flatMap((t) => out[t]![key]);
      for (const t of theirs) out[t]![key] = [];
      for (const who of standing) out[theirs[rng.int(theirs.length)]!]![key].push(who);
    }
  }
  return out;
}
