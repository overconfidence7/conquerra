import { cultureProtection } from "./economy";
import type { MapIndex } from "./mapIndex";
import { WORLD_EVENT_KINDS, type GameContext, type GameEvent, type GameState, type Order, type OrdersByPlayer, type PlayerId, type TerritoryId, type WorldEventKind } from "./types";

/**
 * The Fallen (session 12, design outline §9): knocked-out players earn Influence each turn and spend it, alone or
 * pooled, on world events aimed at a living player's land. Every number is in rules.fallen (packages/content).
 *
 * Caps, so events can't decide a game:
 *  - no event takes or aims at a capital, and none can knock a player out (plague always leaves the garrison, an
 *    uprising never takes a player's last territory);
 *  - at most one event lands on each living player per turn;
 *  - each kind of event rests for its cooldown after it's played (for all the Fallen);
 *  - culture protects: each level blocks its share of the effect (15% a level, as with unrest).
 *
 * Each event is one function of (board, target, strength) that doesn't care who played it, so a Fate deck could
 * draw the same events later.
 */

/** What resolveTurn lends the events: the board, and how to announce and record what happened. */
export interface WorldEventHost {
  ctx: GameContext;
  s: GameState;
  idx: MapIndex;
  emit(e: GameEvent): void;
  /** Borders closed by a storm this turn ("a|b", sorted). */
  closed: Set<string>;
  /** Income lost to famine this turn, by player (a share of it). */
  famine: Map<PlayerId, number>;
  /** Land changed hands (vision has to be worked out again). */
  visionChanged(): void;
}

export const borderKey = (a: TerritoryId, b: TerritoryId) => (a < b ? `${a}|${b}` : `${b}|${a}`);

type Failure = Extract<GameEvent, { type: "worldEventFailed" }>["reason"];
type Effect = Omit<Extract<GameEvent, { type: "worldEvent" }>, "type" | "event" | "target" | "against" | "by" | "spent"> & {
  /** What follows from it, announced right after the event (a Leader falling, a captured general lost). */
  then?: GameEvent[];
};

/** A capital its living owner still holds. */
const isCapital = (s: GameState, t: TerritoryId) => s.players.some((p) => p.eliminatedTurn === null && p.capital === t && s.territories[t]?.owner === p.id);

/**
 * One world event on `target` at `strength` (1 = as bought; up to rules.fallen.maxStrength with pooled Influence).
 * Changes the board and returns what happened, or why it can't happen (then nothing changed).
 */
export function worldEventEffect(h: WorldEventHost, event: WorldEventKind, target: TerritoryId, across: TerritoryId | undefined, strength: number): Effect | Failure {
  const { s, idx, ctx } = h;
  const rules = ctx.rules;
  const cfg = rules.fallen.events;
  const t = s.territories[target]!;
  const against = t.owner!;
  const prot = (c: number) => 1 - cultureProtection(rules, c);
  const garrison = rules.setup.minGarrison;
  switch (event) {
    case "plague": {
      const share = Math.min(0.6, cfg.plague.share * strength);
      const province = idx.byId.get(target)!.province;
      const losses: { territory: TerritoryId; troops: number }[] = [];
      for (const id of idx.provinceMembers.get(province) ?? []) {
        const x = s.territories[id]!;
        if (x.owner !== against || isCapital(s, id)) continue;
        const lose = Math.min(Math.max(0, x.troops - garrison), Math.floor(x.troops * share * prot(x.culture)));
        if (lose <= 0) continue;
        x.troops -= lose;
        losses.push({ territory: id, troops: lose });
      }
      return { losses };
    }
    case "storm": {
      if (!across || !(idx.neighbors.get(target) ?? []).includes(across)) return "invalid";
      if (isCapital(s, across)) return "capital";
      h.closed.add(borderKey(target, across));
      return { border: target < across ? [target, across] : [across, target] };
    }
    case "uprising": {
      if (t.troops > cfg.uprising.maxTroops) return "tooStrong";
      if (!idx.ids.some((id) => id !== target && s.territories[id]!.owner === against)) return "lastLand";
      const rebels = Math.round(cfg.uprising.rebels * strength * prot(t.culture));
      const flipped = rebels > t.troops;
      const then: GameEvent[] = [];
      if (flipped) {
        t.owner = null;
        t.troops = rebels;
        t.specialists = [];
        const p = s.players.find((x) => x.id === against)!;
        if (p.leader.alive && p.leader.territory === target) {
          p.leader = { alive: false, territory: null };
          then.push({ type: "leaderKilled", player: against, territory: target });
        }
        for (const g of p.captured.filter((g) => g.territory === target)) then.push({ type: "generalLost", player: against, general: g.of, territory: target, by: null });
        p.captured = p.captured.filter((g) => g.territory !== target);
        h.visionChanged();
      }
      return { rebels, flipped, ...(then.length ? { then } : {}) };
    }
    case "mercenaries": {
      const spot = (idx.neighbors.get(target) ?? []).filter((n) => s.territories[n]!.owner === null).sort()[0];
      if (!spot) return "noRoom";
      const troops = Math.max(1, Math.round(cfg.mercenaries.troops * strength * prot(t.culture)));
      s.territories[spot]!.troops += troops;
      return { at: spot, troops };
    }
    case "famine": {
      const p = s.players.find((x) => x.id === against)!;
      const capCulture = s.territories[p.capital]?.owner === against ? s.territories[p.capital]!.culture : 0;
      const cut = Math.round(Math.min(0.9, cfg.famine.share * strength) * prot(capCulture) * 100) / 100;
      h.famine.set(against, cut);
      return { cut };
    }
  }
}

/**
 * As the turn starts, before anyone's orders: the Fallen's pledges, pooled by event and place, become world events
 * (biggest pledges first within each kind, kinds in a fixed order). An event that can't happen costs nothing.
 */
export function playWorldEvents(h: WorldEventHost, orders: OrdersByPlayer) {
  const { s, ctx } = h;
  if (!s.settings.fallen) return;
  const rules = ctx.rules.fallen;
  /** Influence each of the Fallen has left to pledge this turn. */
  const left = new Map<PlayerId, number>();
  const groups = new Map<string, { event: WorldEventKind; target: TerritoryId; across?: TerritoryId; pledges: { player: PlayerId; influence: number }[] }>();
  for (const p of s.players) {
    if (p.eliminatedTurn === null) continue;
    left.set(p.id, p.influence);
    for (const o of (Array.isArray(orders[p.id]) ? orders[p.id]! : []) as Order[]) {
      if (o.kind !== "worldEvent" || !WORLD_EVENT_KINDS.includes(o.event) || !h.idx.byId.has(o.target)) continue;
      const pledge = Math.min(Math.max(0, Math.floor(o.influence)), left.get(p.id)!);
      if (pledge <= 0) continue;
      left.set(p.id, left.get(p.id)! - pledge);
      const across = o.event === "storm" ? o.across : undefined;
      const key = `${o.event}|${o.target}|${across ?? ""}`;
      const g = groups.get(key) ?? { event: o.event, target: o.target, ...(across ? { across } : {}), pledges: [] };
      g.pledges.push({ player: p.id, influence: pledge });
      groups.set(key, g);
    }
  }
  const total = (g: { pledges: { influence: number }[] }) => g.pledges.reduce((a, x) => a + x.influence, 0);
  const order = [...groups.entries()].sort(
    ([ka, a], [kb, b]) => WORLD_EVENT_KINDS.indexOf(a.event) - WORLD_EVENT_KINDS.indexOf(b.event) || total(b) - total(a) || (ka < kb ? -1 : 1),
  );
  const hit = new Set<PlayerId>();
  for (const [, g] of order) {
    const fail = (reason: Failure) => {
      for (const x of g.pledges) h.emit({ type: "worldEventFailed", player: x.player, event: g.event, target: g.target, reason });
    };
    const cfg = rules.events[g.event];
    const owner = h.s.territories[g.target]!.owner;
    const sum = total(g);
    if (s.eventCooldowns[g.event] > 0) fail("cooldown");
    else if (!owner || s.players.find((p) => p.id === owner)?.eliminatedTurn !== null) fail("invalid");
    else if (isCapital(s, g.target)) fail("capital");
    else if (hit.has(owner)) fail("alreadyHit");
    else if (sum < cfg.cost) fail("cost");
    else {
      const spent = Math.min(sum, Math.floor(cfg.cost * rules.maxStrength));
      const effect = worldEventEffect(h, g.event, g.target, g.across, spent / cfg.cost);
      if (typeof effect === "string") {
        fail(effect);
        continue;
      }
      // Each pays their share of what was spent (pledges beyond the strongest event come back).
      let paid = 0;
      g.pledges.forEach((x, i) => {
        const pay = i === g.pledges.length - 1 ? spent - paid : Math.floor((x.influence * spent) / sum);
        paid += pay;
        s.players.find((p) => p.id === x.player)!.influence -= pay;
      });
      s.eventCooldowns[g.event] = cfg.cooldown;
      hit.add(owner);
      const { then, ...shown } = effect;
      h.emit({ type: "worldEvent", event: g.event, target: g.target, against: owner, by: g.pledges.map((x) => x.player), spent, ...shown });
      for (const e of then ?? []) h.emit(e);
    }
  }
}

/** End of the turn: each of the Fallen earns Influence (more the more of them there are), and the cooldowns run down. */
export function fallenEndOfTurn(ctx: GameContext, s: GameState) {
  for (const k of WORLD_EVENT_KINDS) s.eventCooldowns[k] = Math.max(0, s.eventCooldowns[k] - 1);
  if (!s.settings.fallen) return;
  const fallen = s.players.filter((p) => p.eliminatedTurn !== null);
  const each = ctx.rules.fallen.influenceBase + ctx.rules.fallen.influencePerOtherFallen * Math.max(0, fallen.length - 1);
  for (const p of fallen) p.influence += each;
}
