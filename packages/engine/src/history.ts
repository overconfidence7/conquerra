import type { GameState, PlayerId, PlayerStats, StepEvent, TerritoryState } from "./types";

/**
 * The game's record for its end (session 16, Nate #11): how much land each House held after every turn (the power
 * graph), and what each did (the awards), tallied from each turn's events. Hidden from everyone until the game ends:
 * nobody is shown land counts during play.
 */

export const emptyStats = (): PlayerStats => ({ battlesWon: 0, captures: 0, holds: 0, culture: 0, buildings: 0, infiltrations: 0, dealsKept: 0, dealsBroken: 0, leadersKilled: 0, fateGood: 0, recruited: 0 });

/** Territories each player holds (every player listed, 0 for none). */
export function landHeld(territories: Readonly<Record<string, Pick<TerritoryState, "owner">>>, players: readonly PlayerId[]): Record<PlayerId, number> {
  const out: Record<PlayerId, number> = Object.fromEntries(players.map((p) => [p, 0]));
  for (const t of Object.values(territories)) if (t.owner && t.owner in out) out[t.owner]!++;
  return out;
}

/** Add this turn to the record: the land held as it ended, and what each House did (from the turn's events). */
export function recordTurn(s: GameState, events: readonly StepEvent[], recordFrom: number) {
  const ids = s.players.map((p) => p.id);
  s.history.push({ turn: s.turn, land: landHeld(s.territories, ids) });
  const st = (p: PlayerId | null | undefined): PlayerStats | null => (p ? (s.stats[p] ??= emptyStats()) : null);
  for (const e of events) {
    switch (e.type) {
      case "battle": {
        const a = st(e.player), d = st(e.defender);
        if (e.captured) {
          if (a) (a.battlesWon++, a.captures++);
          if (a && e.defense.leader) a.leadersKilled++;
        } else if (d) (d.battlesWon++, d.holds++);
        break;
      }
      case "invested":
        st(e.player)!.culture++;
        break;
      case "recruited":
        st(e.player)!.recruited += e.count;
        break;
      case "built":
        if (e.doneAtEndOfTurn === null) st(e.player)!.buildings++;
        break;
      case "completed":
        st(e.player)!.buildings++;
        break;
      case "spoilsTurnedIn": {
        const p = st(e.player)!;
        p.culture += e.culture.length;
        if (e.fort || e.building) p.buildings++;
        break;
      }
      case "fate":
        if (e.holder && !e.shrugged) {
          const p = st(e.holder)!;
          if (e.tone === "good") p.fateGood++;
          if (e.culture) p.culture++;
          if (e.building && e.tone === "good") p.buildings++;
        }
        break;
      case "missionDone":
        if (e.mission.reward.culture) st(e.player)!.culture += e.mission.reward.culture;
        break;
      case "governed":
        for (const x of e.spent) {
          if (x.what === "culture") st(e.player)!.culture++;
          if (x.what === "fort") st(e.player)!.buildings++;
        }
        break;
      case "spy":
        if (e.outcome === "in") st(e.player)!.infiltrations += e.spies.length;
        break;
      case "dealBroken":
        st(e.by)!.dealsBroken++;
        break;
    }
  }
  // Deals that ran their course this turn: both sides kept them.
  for (const r of s.record.slice(recordFrom))
    if (r.how === "kept") for (const p of [r.a, r.b]) st(p)!.dealsKept++;
}
