import type { FateEvent, FateMission } from "@conquerra/content";
import { cultureProtection } from "./economy";
import { borderKey, worldEventEffect } from "./fallen";
import type { MapIndex } from "./mapIndex";
import { Rng } from "./rng";
import { homeOf } from "./spoils";
import type { GameContext, GameEvent, GameState, LandChange, Mission, PlayerId, PlayerState, StepEvent, TerritoryId } from "./types";

/**
 * The Fate deck (session 13, design additions §6). Every number and every card is in rules.fate (packages/content).
 *
 * Everyone still in draws one card a turn, automatically, as the turn ends (so it's there when the next turn's
 * planning starts). The draws come from the game's seed (the deck's own sequence), so they're provably fair and a
 * saved game replays exactly.
 *  - About 7 in 10 are events. An event lands on a random territory anywhere on the map (not near whoever drew it),
 *    built only from what the game already has: troops, gold, borders, culture, buildings. Plague, the uprising and a
 *    closed crossing are the Fallen's own world events (`worldEventEffect`). Because events land between turns, you
 *    always plan with them in front of you: none can make a "guaranteed" attack fail.
 *    Caps: never on a capital; never takes a player's last territory or knocks anyone out; one Fate event per
 *    territory a turn; culture protects (each level blocks 15% of a bad effect; all-or-nothing ones are shrugged off
 *    with that chance).
 *  - About 3 in 10 are missions for the drawer: a goal with a deadline and a reward, checked from the game at the
 *    end of every turn. At most 2 open; a third draw becomes an event instead.
 */

/** What resolveTurn lends the deck: the board, how to announce, and the turn's events so far. */
export interface FateHost {
  ctx: GameContext;
  s: GameState;
  idx: MapIndex;
  emit(e: GameEvent): void;
  visionChanged(): void;
  readonly events: readonly StepEvent[];
}

const living = (s: GameState) => s.players.filter((p) => p.eliminatedTurn === null);
/** A capital its living owner still holds. */
const isCapital = (s: GameState, t: TerritoryId) => s.players.some((p) => p.eliminatedTurn === null && p.capital === t && s.territories[t]?.owner === p.id);

function pickWeighted<T extends { weight: number }>(rng: Rng, list: readonly T[]): T | null {
  const total = list.reduce((a, x) => a + x.weight, 0);
  if (total <= 0) return null;
  let r = rng.next() * total;
  for (const x of list) {
    r -= x.weight;
    if (r < 0) return x;
  }
  return list[list.length - 1] ?? null;
}
const pickOne = <T>(rng: Rng, list: readonly T[]): T | null => (list.length ? list[rng.int(list.length)]! : null);

// ---------- Events ----------

/** Where this event could land this turn (empty: it can't). */
function eligible(h: FateHost, ev: FateEvent, hit: ReadonlySet<TerritoryId>): TerritoryId[] {
  const { s, idx, ctx } = h;
  const rules = ctx.rules;
  const alive = new Set(living(s).map((p) => p.id));
  const held = (t: TerritoryId) => {
    const o = s.territories[t]!.owner;
    return o !== null && alive.has(o);
  };
  return idx.ids.filter((t) => {
    if (hit.has(t) || isCapital(s, t)) return false;
    const x = s.territories[t]!;
    switch (ev.effect) {
      case "gold":
        return held(t);
      case "troops":
        return held(t) || (ev.neutral && x.owner === null);
      case "culture":
        return held(t) && x.culture < rules.culture.max;
      case "finishBuilding":
      case "burnBuilding":
        return held(t) && x.construction !== null;
      case "sickness":
        return held(t) && x.troops >= ev.minTroops;
      case "plague":
        return held(t) && x.troops > rules.setup.minGarrison;
      case "uprising":
        return held(t) && x.troops <= rules.fallen.events.uprising.maxTroops && idx.ids.some((o) => o !== t && s.territories[o]!.owner === x.owner);
      case "closeBorder":
        return (idx.neighbors.get(t) ?? []).some((n) => idx.border(t, n) === ev.border && !isCapital(s, n) && !hit.has(n) && !s.closures.some((c) => borderKey(c.a, c.b) === borderKey(t, n)));
    }
  });
}

/** One Fate event on `at`: changes the board and announces it (with what follows, like a Leader falling). */
function strike(h: FateHost, rng: Rng, ev: FateEvent, at: TerritoryId, drawer: PlayerId, hit: Set<TerritoryId>) {
  const { s, idx, ctx } = h;
  const rules = ctx.rules;
  const t = s.territories[at]!;
  const holder = t.owner;
  const p = holder ? s.players.find((x) => x.id === holder)! : null;
  const prot = cultureProtection(rules, t.culture);
  const base = { type: "fate" as const, drawer, card: ev.id, at, holder, tone: ev.tone };
  const shrug = () => h.emit({ ...base, shrugged: true, land: [{ territory: at, culture: t.culture }] });
  hit.add(at);
  switch (ev.effect) {
    case "gold": {
      if (!p) return;
      if (ev.amount >= 0) {
        p.gold += ev.amount;
        h.emit({ ...base, shrugged: false, land: [], gold: ev.amount });
      } else {
        const loss = Math.min(p.gold, Math.round(-ev.amount * (1 - prot)));
        if (loss <= 0 && prot > 0) return shrug();
        p.gold -= loss;
        h.emit({ ...base, shrugged: false, land: [], gold: -loss });
      }
      return;
    }
    case "troops":
      t.troops += ev.amount;
      h.emit({ ...base, shrugged: false, land: [{ territory: at, troops: t.troops }], troops: ev.amount });
      return;
    case "culture":
      t.culture = Math.min(rules.culture.max, t.culture + ev.amount);
      h.emit({ ...base, shrugged: false, land: [{ territory: at, culture: t.culture }], culture: t.culture });
      return;
    case "finishBuilding": {
      const b = t.construction!.building;
      t.building = b;
      t.construction = null;
      if (b === "watchtower") h.visionChanged();
      h.emit({ ...base, shrugged: false, land: [{ territory: at, building: b, construction: null }], building: b });
      return;
    }
    case "burnBuilding": {
      if (rng.next() < prot) return shrug();
      const b = t.construction!.building;
      t.construction = null;
      h.emit({ ...base, shrugged: false, land: [{ territory: at, construction: null }], building: b });
      return;
    }
    case "sickness": {
      const lose = Math.min(Math.max(0, t.troops - rules.setup.minGarrison), Math.floor(t.troops * ev.share * (1 - prot)));
      if (lose <= 0) return shrug();
      t.troops -= lose;
      h.emit({ ...base, shrugged: false, land: [{ territory: at, troops: t.troops }], troops: -lose });
      return;
    }
    case "closeBorder": {
      if (rng.next() < prot) return shrug();
      const across = pickOne(
        rng,
        (idx.neighbors.get(at) ?? []).filter((n) => idx.border(at, n) === ev.border && !isCapital(s, n) && !hit.has(n) && !s.closures.some((c) => borderKey(c.a, c.b) === borderKey(at, n))),
      )!;
      // The Fallen's storm, lent a closed-borders list of its own: it's closed through the whole of the next turn.
      const closed = new Set<string>();
      const eff = worldEventEffect({ ctx, s, idx, emit: h.emit, closed, famine: new Map(), visionChanged: h.visionChanged }, "storm", at, across, 1);
      if (typeof eff === "string" || !eff.border) return;
      s.closures.push({ a: eff.border[0], b: eff.border[1], turn: s.turn + 1 });
      hit.add(across);
      h.emit({ ...base, shrugged: false, land: [], border: eff.border, until: s.turn + 1 });
      return;
    }
    case "plague":
    case "uprising": {
      // The Fallen's own events (culture's protection is built in). A plague at this share of the troops.
      const strength = ev.effect === "plague" ? ev.share / rules.fallen.events.plague.share : 1;
      const eff = worldEventEffect({ ctx, s, idx, emit: h.emit, closed: new Set(), famine: new Map(), visionChanged: h.visionChanged }, ev.effect, at, undefined, strength);
      if (typeof eff === "string") return shrug();
      const land: LandChange[] = [];
      let troops = 0;
      for (const l of eff.losses ?? []) {
        land.push({ territory: l.territory, troops: s.territories[l.territory]!.troops });
        troops -= l.troops;
        hit.add(l.territory);
      }
      if (ev.effect === "plague" && !eff.losses?.length) return shrug();
      if (eff.flipped) land.push({ territory: at, owner: null, troops: t.troops, specialists: [], culture: 0 });
      h.emit({
        ...base,
        shrugged: false,
        land,
        ...(ev.effect === "plague" ? { troops } : { rebels: eff.rebels ?? 0, flipped: !!eff.flipped }),
      });
      for (const f of eff.then ?? []) h.emit(f());
      return;
    }
  }
}

function drawEvent(h: FateHost, rng: Rng, drawer: PlayerId, hit: Set<TerritoryId>) {
  const options = h.ctx.rules.fate.events.map((ev) => ({ ev, where: eligible(h, ev, hit), weight: ev.weight })).filter((o) => o.where.length > 0);
  const pick = pickWeighted(rng, options);
  if (!pick) return;
  strike(h, rng, pick.ev, pickOne(rng, pick.where)!, drawer, hit);
}

// ---------- Missions ----------

/** Provinces next to a player's land that they don't fully hold (their neighbours are always in sight). */
function provincesNear(h: FateHost, pid: PlayerId): string[] {
  const { s, idx } = h;
  const out = new Set<string>();
  for (const t of idx.ids) {
    if (s.territories[t]!.owner !== pid) continue;
    for (const n of idx.neighbors.get(t) ?? []) if (s.territories[n]!.owner !== pid) out.add(idx.byId.get(n)!.province);
  }
  return [...out].sort();
}

/** A mission card made concrete for this player (its target chosen), or null if it doesn't fit them now. */
function makeMission(h: FateHost, rng: Rng, def: FateMission, p: PlayerState): Omit<Mission, "id"> | null {
  const { s, idx, ctx } = h;
  const mine = idx.ids.filter((t) => s.territories[t]!.owner === p.id);
  const frontier = mine.filter((t) => (idx.neighbors.get(t) ?? []).some((n) => s.territories[n]!.owner !== p.id && s.territories[n]!.owner !== null));
  const base = { card: def.id, kind: def.kind, deadline: s.turn + def.turns, reward: { ...def.reward } };
  switch (def.kind) {
    case "takeIn": {
      const province = pickOne(rng, provincesNear(h, p.id));
      return province ? { ...base, province } : null;
    }
    case "takeFrom": {
      const rivals = new Set<PlayerId>();
      for (const t of mine) for (const n of idx.neighbors.get(t) ?? []) {
        const o = s.territories[n]!.owner;
        if (o && o !== p.id) rivals.add(o);
      }
      const rival = pickOne(rng, [...rivals].sort());
      return rival ? { ...base, rival } : null;
    }
    case "spree":
      return { ...base, need: def.need ?? 3, progress: 0 };
    case "cross": {
      const ok = mine.some((t) => (idx.neighbors.get(t) ?? []).some((n) => idx.border(t, n) === def.border && s.territories[n]!.owner !== p.id));
      return ok && def.border ? { ...base, border: def.border } : null;
    }
    case "hold": {
      const territory = pickOne(rng, frontier.filter((t) => t !== p.capital));
      return territory ? { ...base, territory } : null;
    }
    case "noLoss":
      return frontier.length ? { ...base } : null;
    case "whole": {
      const near = [...new Set(mine.map((t) => idx.byId.get(t)!.province))].sort().filter((prov) => {
        const members = idx.provinceMembers.get(prov) ?? [];
        const have = members.filter((m) => s.territories[m]!.owner === p.id).length;
        return have < members.length && have * 2 >= members.length;
      });
      const province = pickOne(rng, near);
      return province ? { ...base, province } : null;
    }
    case "fort": {
      const territory = pickOne(rng, frontier.filter((t) => !s.territories[t]!.building && !s.territories[t]!.construction));
      return territory ? { ...base, territory } : null;
    }
    case "culture": {
      const provs = [...new Set(mine.filter((t) => s.territories[t]!.culture < ctx.rules.culture.max).map((t) => idx.byId.get(t)!.province))].sort();
      const province = pickOne(rng, provs);
      return province ? { ...base, province } : null;
    }
  }
}

function drawMission(h: FateHost, rng: Rng, p: PlayerState): Mission | null {
  const options = h.ctx.rules.fate.missions.map((def) => ({ def, weight: def.weight }));
  // Try the cards in a seeded order of preference until one fits this player.
  while (options.length) {
    const pick = pickWeighted(rng, options);
    if (!pick) return null;
    options.splice(options.indexOf(pick), 1);
    const m = makeMission(h, rng, pick.def, p);
    if (m) return { id: `m${h.s.nextMission++}`, ...m };
  }
  return null;
}

/** What this turn's events say each player did: land taken (and across what), land lost, culture raised. */
function turnFacts(h: FateHost) {
  const took = new Map<PlayerId, { to: TerritoryId; from: TerritoryId; defender: PlayerId | null }[]>();
  const lost = new Set<PlayerId>();
  const invested = new Map<PlayerId, TerritoryId[]>();
  for (const e of h.events) {
    if (e.type === "battle" && e.captured) {
      took.set(e.player, [...(took.get(e.player) ?? []), { to: e.to, from: e.from, defender: e.defender }]);
      if (e.defender) lost.add(e.defender);
    } else if (e.type === "worldEvent" && e.flipped) lost.add(e.against);
    else if (e.type === "fate" && e.land.some((l) => l.owner === null) && e.holder) lost.add(e.holder);
    else if (e.type === "invested") invested.set(e.player, [...(invested.get(e.player) ?? []), e.territory]);
  }
  return { took, lost, invested };
}

/** Pay a mission's reward. */
function payOut(h: FateHost, p: PlayerState, m: Mission, at: TerritoryId | null) {
  const { s, idx, ctx } = h;
  const home = homeOf(s, idx, p.id);
  const land: LandChange[] = [];
  let gold = m.reward.gold ?? 0;
  const spot = at && s.territories[at]?.owner === p.id ? at : home;
  if (m.reward.troops && spot) {
    s.territories[spot]!.troops += m.reward.troops;
    land.push({ territory: spot, troops: s.territories[spot]!.troops });
  }
  if (m.reward.culture && spot) {
    const x = s.territories[spot]!;
    x.culture = Math.min(ctx.rules.culture.max, x.culture + m.reward.culture);
    land.push({ territory: spot, culture: x.culture });
  }
  if (m.reward.specialist && home) {
    const x = s.territories[home]!;
    if (x.specialists.length < ctx.rules.specialists.maxPerArmy && x.troops > 0) {
      x.specialists.push({ id: `s${s.nextId++}`, type: m.reward.specialist });
      if (m.reward.specialist === "scouts") h.visionChanged();
      land.push({ territory: home, specialists: x.specialists.map((sp) => ({ ...sp })) });
    } else gold += ctx.rules.specialists[m.reward.specialist].cost; // no room: its price in gold instead
  }
  p.gold += gold;
  h.emit({ type: "missionDone", player: p.id, mission: { ...m }, at: land[0]?.territory ?? spot ?? null, gold, land });
}

/**
 * As the turn ends: each open mission is checked against the game (and this turn's events). Done ones pay out; ones
 * whose land was lost, or whose deadline is this turn, lapse.
 */
export function checkMissions(h: FateHost) {
  const { s, idx } = h;
  const facts = turnFacts(h);
  for (const p of living(s)) {
    const keep: Mission[] = [];
    for (const m of p.missions) {
      const took = facts.took.get(p.id) ?? [];
      const last = s.turn >= m.deadline;
      let done: TerritoryId | null | false = false;
      let failed = false;
      switch (m.kind) {
        case "takeIn": {
          const hit = took.find((x) => idx.byId.get(x.to)!.province === m.province);
          if (hit) done = hit.to;
          break;
        }
        case "takeFrom": {
          const hit = took.find((x) => x.defender === m.rival);
          if (hit) done = hit.to;
          break;
        }
        case "spree":
          m.progress = (m.progress ?? 0) + took.length;
          if (m.progress >= (m.need ?? 3)) done = took[took.length - 1]?.to ?? null;
          break;
        case "cross": {
          const won = h.events.find((e) => e.type === "battle" && e.player === p.id && e.captured && idx.border(e.from, e.to) === m.border);
          if (won && won.type === "battle") done = won.to;
          break;
        }
        case "hold":
          if (s.territories[m.territory!]!.owner !== p.id) failed = true;
          else if (last) done = m.territory!;
          break;
        case "noLoss":
          if (facts.lost.has(p.id)) failed = true;
          else if (last) done = null;
          break;
        case "whole":
          if ((idx.provinceMembers.get(m.province!) ?? []).every((t) => s.territories[t]!.owner === p.id)) done = null;
          break;
        case "fort": {
          const x = s.territories[m.territory!]!;
          if (x.owner !== p.id) failed = true;
          else if (x.building === "fort" || x.construction?.building === "fort") done = m.territory!;
          break;
        }
        case "culture": {
          const raised = (facts.invested.get(p.id) ?? []).find((t) => idx.byId.get(t)!.province === m.province && s.territories[t]!.owner === p.id);
          if (raised) {
            m.territory = raised;
            done = raised;
          }
          break;
        }
      }
      if (done !== false) payOut(h, p, m, done);
      else if (failed || last) h.emit({ type: "missionFailed", player: p.id, mission: { ...m }, why: failed ? "lost" : "expired" });
      else keep.push(m);
    }
    p.missions = keep;
  }
}

/** As the turn ends, after the missions are checked: everyone still in draws one Fate card, in seat order. */
export function drawFate(h: FateHost, seats: readonly PlayerId[]) {
  const { s, ctx } = h;
  const cfg = ctx.rules.fate;
  // The opening turns stay quiet: the first draw comes at the end of turn `firstDrawTurn` (a save replayed under
  // older rules, without the number, drew from turn 1).
  if (!s.settings.fate || s.winner || s.turn < (cfg.firstDrawTurn ?? 1)) return;
  const rng = new Rng(s.decks.fate);
  /** One Fate event per territory a turn. */
  const hit = new Set<TerritoryId>();
  for (const pid of seats) {
    const p = s.players.find((x) => x.id === pid)!;
    if (p.eliminatedTurn !== null) continue;
    const mission = rng.next() < cfg.missionShare && p.missions.length < cfg.maxMissions ? drawMission(h, rng, p) : null;
    if (mission) {
      p.missions.push(mission);
      h.emit({ type: "missionDrawn", player: pid, mission: { ...mission } });
    } else drawEvent(h, rng, pid, hit);
  }
  s.decks.fate = rng.state;
}
