import type { MapDef } from "@conquerra/content";
import type { GoalCondition, TutorialDef } from "@conquerra/content/tutorials";
import type { PlayerView, TerritoryView } from "@conquerra/engine";

/**
 * A tutorial's goal, checked (session 31). Pure and deterministic: it reads your own view of the game (`viewFor`)
 * and the map, nothing else, so it never knows more than you do. Checked as each turn's planning starts.
 */

type Full = Extract<TerritoryView, { detail: "full" }>;
const yours = (view: PlayerView, id: string): Full | null => {
  const t = view.territories[id];
  return t && t.detail === "full" && t.owner === view.me.id ? t : null;
};
const inProvince = (map: MapDef, province: string) => map.territories.filter((t) => t.province === province).map((t) => t.id);
const where = (map: MapDef, c: { territory?: string; province?: string }) => (c.territory ? [c.territory] : c.province ? inProvince(map, c.province) : []);

export function conditionMet(map: MapDef, view: PlayerView, c: GoalCondition): boolean {
  switch (c.kind) {
    case "hold":
      return c.territories.every((id) => !!yours(view, id));
    case "province":
      return inProvince(map, c.province).every((id) => !!yours(view, id));
    case "troops":
      return (yours(view, c.territory)?.troops ?? 0) >= c.atLeast;
    case "culture":
      return where(map, c).some((id) => (yours(view, id)?.culture ?? 0) >= c.atLeast);
    case "building":
      return where(map, c).some((id) => yours(view, id)?.building === c.building);
    case "gold":
      return view.me.gold >= c.atLeast;
    case "walled":
      return c.territories.every((id) => !!yours(view, id) && !!view.walls?.some((w) => w.owner === view.me.id && w.territories.includes(id)));
    case "spoils":
      return view.me.spoils.length >= c.atLeast;
    case "missionDone":
      return !view.me.missions.some((m) => m.id === c.mission);
    case "deal": {
      const mine = (d: { kind: string; a: string; b: string }) => d.kind === c.deal && ((d.a === view.me.id && d.b === c.with) || (d.b === view.me.id && d.a === c.with));
      return view.deals.some((d) => mine(d) && view.turn - d.start >= c.kept) || view.record.some((r) => mine(r) && r.how === "kept" && r.end - r.start + 1 >= c.kept);
    }
    case "leader": {
      const l = view.me.leaders.find((x) => x.kind === c.leader && x.of === view.me.id);
      if (!l) return false;
      const funded = "share" in l.budget ? l.budget.share > 0 : l.budget.gold > 0;
      return (!c.command || !!l.command) && (!c.budget || funded);
    }
  }
}

export type GoalState = { kind: "done" } | { kind: "open"; turnsLeft: number } | { kind: "missed" };

/**
 * Where the goal stands at the start of this turn's planning. `startTurn`: the turn the lesson began on. You get
 * `goal.turns` turns: the goal is met by the start of turn `startTurn + turns`, or missed after it.
 */
export function goalState(def: Pick<TutorialDef, "goal">, map: MapDef, view: PlayerView, startTurn: number): GoalState {
  const by = startTurn + def.goal.turns;
  const met = def.goal.all.every((c) => conditionMet(map, view, c));
  // (A goal to hold to the end is met only at its last check.)
  if (met && (!def.goal.hold || view.turn >= by)) return { kind: "done" };
  const out = view.me.eliminatedTurn !== null || view.winner !== null;
  if (out || view.turn >= by) return { kind: "missed" };
  return { kind: "open", turnsLeft: by - view.turn };
}

/** The turn the goal is due by ("by turn 3"). */
export const dueTurn = (def: Pick<TutorialDef, "goal">, startTurn: number) => startTurn + def.goal.turns;

/** Session 31: a scenario file that doesn't read as one. */
export const SCENARIO_FILE_PROBLEM = "This scenario file can't be read: something in it is missing or out of range.";

export const GOAL_TEXT = {
  done: (met: string) => `Goal: ${met}. Done.`,
  open: (left: number) => (left === 1 ? "Goal: not yet, this is the last turn" : `Goal: not yet, ${left} turns left`),
  missed: "Goal: missed this time.",
  by: (turn: number) => `By turn ${turn}`,
} as const;

/** The turn report's first line in a lesson. */
export function goalLine(def: Pick<TutorialDef, "goal" | "words">, state: GoalState): string {
  return state.kind === "done" ? GOAL_TEXT.done(def.words.met) : state.kind === "missed" ? GOAL_TEXT.missed : GOAL_TEXT.open(state.turnsLeft);
}
