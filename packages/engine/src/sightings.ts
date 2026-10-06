import type { SpecialistType } from "@conquerra/content";
import type { LastSeen } from "./intel";
import { recordSighting } from "./intel";
import { indexMap, type MapIndex } from "./mapIndex";
import type { GameContext, GameState, PlayerId, Specialist, StepEvent, TerritoryId } from "./types";

/**
 * Vision through the turn (decided Oct 4: "the fog lifts during the replay").
 *
 * At the start of the turn you see exactly what you saw while planning. After each step that changes what you can
 * see (you take land, you lose land, a watchtower is finished, scouts move), your vision is worked out again from the
 * game as it is at that moment. So a chain pushing into the fog reveals the land step by step, and land around
 * something you lose fogs over from that step on.
 *
 * Worked out from the start-of-turn state plus the turn's event log, never from extra copies of the game: the event
 * log is what the server stores (M4). `TurnVision` replays the events onto a light copy of the board and keeps, for
 * each player it follows, a count of how many of their territories see each territory.
 */

/** What one step changed in a player's vision. */
export interface VisionDelta {
  /** Land that just came into view. */
  revealed: TerritoryId[];
  /** Land that just fogged over. */
  fogged: TerritoryId[];
}

/** Every territory within `radius` borders of `t` (including `t`), cached per map. */
const ballCache = new WeakMap<MapIndex, Map<number, Map<TerritoryId, TerritoryId[]>>>();
function ball(idx: MapIndex, t: TerritoryId, radius: number): TerritoryId[] {
  let byRadius = ballCache.get(idx);
  if (!byRadius) ballCache.set(idx, (byRadius = new Map()));
  let byT = byRadius.get(radius);
  if (!byT) byRadius.set(radius, (byT = new Map()));
  let hit = byT.get(t);
  if (hit) return hit;
  const seen = new Set([t]);
  let frontier = [t];
  for (let r = 0; r < radius; r++) {
    const next: TerritoryId[] = [];
    for (const f of frontier)
      for (const n of idx.neighbors.get(f) ?? [])
        if (!seen.has(n)) {
          seen.add(n);
          next.push(n);
        }
    frontier = next;
  }
  hit = [...seen];
  byT.set(t, hit);
  return hit;
}

/** A light, independent copy of the parts of the game a turn changes (no memory, no dice). */
function copyBoard(s: GameState): GameState {
  const territories: GameState["territories"] = {};
  for (const [id, t] of Object.entries(s.territories))
    territories[id] = { ...t, specialists: t.specialists.map((x) => ({ ...x })), construction: t.construction ? { ...t.construction } : null };
  return {
    ...s,
    players: s.players.map((p) => ({ ...p, leader: { ...p.leader }, cooldowns: { ...p.cooldowns }, captured: p.captured.map((g) => ({ ...g })) })),
    territories,
    intel: {},
  };
}

/** The territories an event touches (where something about the land may have changed). */
function placesOf(e: StepEvent): TerritoryId[] {
  switch (e.type) {
    case "moved":
    case "battle":
      return [e.from, e.to];
    case "recruited":
    case "hired":
    case "built":
    case "completed":
    case "invested":
      return [e.territory];
    case "income":
      return e.deserters.map((d) => d.territory);
    case "worldEvent":
      return [...(e.losses ?? []).map((l) => l.territory), ...(e.flipped ? [e.target] : []), ...(e.at ? [e.at] : [])];
    default:
      return [];
  }
}

export class TurnVision {
  readonly board: GameState;
  private readonly idx: MapIndex;
  /** For each followed player who doesn't see everything: territory -> how many of their territories see it. */
  private readonly cover = new Map<PlayerId, Map<TerritoryId, number>>();
  /** Followed players who see the whole board (fog off, already out, or out / game over by the end of this turn). */
  private readonly all = new Set<PlayerId>();
  /** Players who are knocked out this turn, or everyone if the game ends: they see the whole turn (revealed at its start). */
  private readonly revealAtStart = new Set<PlayerId>();
  private started = false;
  /** Troops and specialists resting after a failed attack (they never move again this turn). */
  private readonly spentSpecialists = new Set<string>();

  constructor(
    private readonly ctx: GameContext,
    before: GameState,
    events: readonly StepEvent[],
    readonly players: readonly PlayerId[],
  ) {
    this.idx = indexMap(ctx.map);
    this.board = copyBoard(before);
    const gameEnds = events.some((e) => e.type === "gameOver");
    for (const pid of players) {
      const p = before.players.find((x) => x.id === pid);
      if (!before.settings.fog || !p || p.eliminatedTurn !== null || before.winner) {
        this.all.add(pid);
        continue;
      }
      // Knocked out this turn (or the game ends): you watch the whole turn, as a spectator would. (Not with the
      // Fallen on: then you keep your own vision to the end of the turn, and see the political map from the next.)
      const knockedOut = events.some((e) => e.type === "eliminated" && e.player === pid);
      if (gameEnds || (knockedOut && !before.settings.fallen)) this.revealAtStart.add(pid);
      const c = new Map<TerritoryId, number>();
      this.cover.set(pid, c);
      for (const id of this.idx.ids) {
        const r = this.radius(id, pid);
        if (r >= 0) for (const n of ball(this.idx, id, r)) c.set(n, (c.get(n) ?? 0) + 1);
      }
    }
  }

  /** Can this player see the territory in detail right now (at the current step)? */
  sees(pid: PlayerId, t: TerritoryId): boolean {
    if (this.all.has(pid)) return true;
    return (this.cover.get(pid)?.get(t) ?? 0) > 0;
  }

  /** Everything the player sees right now. */
  visible(pid: PlayerId): Set<TerritoryId> {
    if (this.all.has(pid)) return new Set(this.idx.ids);
    return new Set([...(this.cover.get(pid) ?? new Map<TerritoryId, number>())].filter(([, n]) => n > 0).map(([t]) => t));
  }

  /** How far `t` lets `pid` see (-1 if it isn't theirs). Same rule as `visionFor`. */
  private radius(t: TerritoryId, pid: PlayerId): number {
    const terr = this.board.territories[t]!;
    if (terr.owner !== pid) return -1;
    const { rules } = this.ctx;
    let r = rules.vision.base;
    if (terr.building === "watchtower") r = Math.max(r, rules.vision.base + rules.buildings.watchtower.vision);
    if (terr.specialists.some((s) => s.type === "scouts")) r = Math.max(r, rules.vision.base + rules.specialists.scouts.vision);
    return r;
  }

  /** Play the next event onto the board. Returns the players whose vision changed, with what changed. */
  step(e: StepEvent): Map<PlayerId, VisionDelta> {
    const changes = new Map<PlayerId, VisionDelta>();
    // Knocked out this turn: the fog lifts off everything at the very start, as it does for a spectator.
    if (!this.started) {
      this.started = true;
      for (const pid of this.revealAtStart) {
        const revealed = this.idx.ids.filter((t) => !this.sees(pid, t));
        this.all.add(pid);
        this.cover.delete(pid);
        if (revealed.length) changes.set(pid, { revealed, fogged: [] });
      }
    }

    const places = placesOf(e);
    const followed = (pid: PlayerId | null): pid is PlayerId => pid !== null && this.cover.has(pid);
    const beforeState = places.map((t) => ({ t, owner: this.board.territories[t]!.owner }));
    const radiusBefore = beforeState.map(({ t, owner }) => (followed(owner) ? this.radius(t, owner) : -1));
    this.apply(e);

    /** First-touch "was it visible" per player and territory, to report only net changes for the step. */
    const was = new Map<PlayerId, Map<TerritoryId, boolean>>();
    const bump = (pid: PlayerId, cells: TerritoryId[], d: number) => {
      const c = this.cover.get(pid)!;
      let w = was.get(pid);
      if (!w) was.set(pid, (w = new Map()));
      for (const n of cells) {
        const cur = c.get(n) ?? 0;
        if (!w.has(n)) w.set(n, cur > 0);
        c.set(n, cur + d);
      }
    };
    beforeState.forEach(({ t, owner }, i) => {
      const owner1 = this.board.territories[t]!.owner;
      const r0 = radiusBefore[i]!;
      const r1 = followed(owner1) ? this.radius(t, owner1) : -1;
      if (owner === owner1 && r0 === r1) return;
      if (followed(owner) && r0 >= 0) bump(owner, ball(this.idx, t, r0), -1);
      if (followed(owner1) && r1 >= 0) bump(owner1, ball(this.idx, t, r1), +1);
    });
    for (const [pid, w] of was) {
      const delta: VisionDelta = changes.get(pid) ?? { revealed: [], fogged: [] };
      for (const [t, before] of w) {
        const now = this.sees(pid, t);
        if (now && !before) delta.revealed.push(t);
        else if (!now && before) delta.fogged.push(t);
      }
      if (delta.revealed.length || delta.fogged.length) changes.set(pid, delta);
    }
    return changes;
  }

  /** Apply one event to the board copy, exactly as the engine did. */
  private apply(e: StepEvent) {
    const b = this.board;
    const terr = (id: TerritoryId) => b.territories[id]!;
    const player = (id: PlayerId) => b.players.find((p) => p.id === id)!;
    const moveGeneral = (owner: PlayerId, of: PlayerId, to: TerritoryId) => {
      const g = player(owner).captured.find((x) => x.of === of);
      if (g) g.territory = to;
    };
    /** The specialists an army took with it: the first fresh ones of each type listed, in board order. */
    const take = (from: TerritoryId, types: readonly SpecialistType[]): Specialist[] => {
      const want = [...types];
      const out: Specialist[] = [];
      for (const s of terr(from).specialists) {
        if (this.spentSpecialists.has(s.id)) continue;
        const i = want.indexOf(s.type);
        if (i >= 0) (out.push(s), want.splice(i, 1));
      }
      const ids = new Set(out.map((s) => s.id));
      terr(from).specialists = terr(from).specialists.filter((s) => !ids.has(s.id));
      return out;
    };
    switch (e.type) {
      case "recruited":
        terr(e.territory).troops += e.count;
        player(e.player).gold -= e.cost;
        break;
      case "hired":
        terr(e.territory).specialists.push({ id: `s${b.nextId++}`, type: e.specialist });
        player(e.player).gold -= e.cost;
        break;
      case "built": {
        const t = terr(e.territory);
        if (e.doneAtEndOfTurn === null) t.building = e.building;
        else t.construction = { building: e.building, doneAtEndOfTurn: e.doneAtEndOfTurn };
        player(e.player).gold -= e.cost;
        break;
      }
      case "completed":
        terr(e.territory).building = e.building;
        terr(e.territory).construction = null;
        break;
      case "invested":
        terr(e.territory).culture = e.culture;
        player(e.player).gold -= e.cost;
        break;
      case "moved": {
        const specs = take(e.from, e.army.specialists);
        terr(e.from).troops -= e.army.troops;
        terr(e.to).troops += e.army.troops;
        terr(e.to).specialists.push(...specs);
        if (e.withLeader) player(e.player).leader.territory = e.to;
        if (e.withGeneral) moveGeneral(e.player, e.withGeneral, e.to);
        break;
      }
      case "battle": {
        const from = terr(e.from), to = terr(e.to);
        const specs = take(e.from, e.attackers.specialists);
        from.troops -= e.attackers.troops;
        const survivors = e.attackers.troops - e.result.attackerLosses;
        to.troops -= e.result.defenderLosses;
        if (e.captured) {
          to.owner = e.player;
          to.troops = survivors;
          to.specialists = specs;
          if (e.withLeader) player(e.player).leader.territory = e.to;
          if (e.withGeneral) moveGeneral(e.player, e.withGeneral, e.to);
        } else {
          if (to.troops <= 0) to.specialists = [];
          if (survivors > 0) {
            from.troops += survivors;
            from.specialists.push(...specs);
            for (const s of specs) this.spentSpecialists.add(s.id);
          }
        }
        break;
      }
      case "leaderKilled":
        player(e.player).leader = { alive: false, territory: null };
        break;
      case "leaderReturned":
        player(e.player).leader = { alive: true, territory: e.territory };
        break;
      case "eliminated": {
        const p = player(e.player);
        p.eliminatedTurn = b.turn;
        p.eliminatedBy = e.by;
        p.leader = { alive: false, territory: null };
        p.captured = [];
        break;
      }
      case "generalCaptured":
        player(e.player).captured.push({ of: e.general, territory: e.territory, instruction: null });
        break;
      case "worldEvent":
        for (const l of e.losses ?? []) terr(l.territory).troops -= l.troops;
        if (e.flipped) {
          const t = terr(e.target);
          t.owner = null;
          t.troops = e.rebels!;
          t.specialists = [];
        }
        if (e.at) terr(e.at).troops += e.troops!;
        break;
      case "generalLost":
      case "generalReleased": {
        const p = player(e.player);
        p.captured = p.captured.filter((g) => g.of !== e.general);
        break;
      }
      case "income":
        player(e.player).gold = e.goldAfter;
        for (const d of e.deserters) terr(d.territory).troops -= d.troops;
        break;
      case "gameOver":
        b.winner = e.winner;
        b.endReason = e.reason;
        break;
      default:
        break;
    }
  }
}

/** What a player remembers of a territory they see on the board right now. */
export function sightingOf(board: GameState, t: TerritoryId, turn: number): LastSeen {
  const terr = board.territories[t]!;
  return { owner: terr.owner, troops: terr.troops, building: terr.building, turn };
}

/**
 * Put everything each player saw during the turn into their memory, as it was when they saw it: land that came into
 * view and land that fogged over (including land they took and lost again, and land they watched fall). Later
 * sightings replace earlier ones; the end-of-turn update (`updateIntel`) runs after this. Stamped with the turn being
 * resolved, so on the next turn it reads "Seen last turn".
 */
export function recordTurnSightings(ctx: GameContext, before: GameState, events: readonly StepEvent[], players: readonly PlayerId[], into: GameState): void {
  if (!players.length) return;
  const tv = new TurnVision(ctx, before, events, players);
  for (const e of events)
    for (const [pid, d] of tv.step(e)) for (const t of [...d.revealed, ...d.fogged]) recordSighting(into, pid, t, sightingOf(tv.board, t, before.turn));
}
