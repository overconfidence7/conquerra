import type { GameEvent, PurseGoal, PlayerId, TerritoryId } from "./types";

/**
 * "Govern this province" (session 15) was replaced by leaders' purses in session 18 (leaders.ts). Only its wording
 * stays, so replays and Chronicles from older saves still read.
 */

/** Names for the governing lines: a general ("Your Leader", or the captured general's name), places and provinces. */
export interface GovernNames {
  general(id: PlayerId): string;
  place(t: TerritoryId): string;
  province(id: string): string;
}

/** "A fort at Pinemark: 5 of 8 gold" (what a governing general is saving toward, as progress). */
export function goalLine(goal: PurseGoal & { saved: number }, n: Pick<GovernNames, "place">): string {
  const what = goal.what === "fort" ? `A fort at ${n.place(goal.territory)}` : goal.what === "culture" ? `Culture at ${n.place(goal.territory)}` : `Troops at ${n.place(goal.territory)}`;
  return `${what}: ${Math.min(goal.saved, goal.cost)} of ${goal.cost} gold`;
}

/** "Your Leader governs Old March: kept 3 gold, raised culture in Pinemark." (and what it's saving toward). */
export function governLine(e: Extract<GameEvent, { type: "governed" | "purseHome" }>, n: GovernNames): string {
  const who = n.general(e.general);
  if (e.type === "purseHome") return `${who} no longer governs ${n.province(e.province)}${e.gold ? `: the ${e.gold} gold it was saving went home` : ""}.`;
  const did = e.spent.map((x) =>
    x.what === "fort" ? `began a fort at ${n.place(x.territory)}` : x.what === "culture" ? `raised culture in ${n.place(x.territory)}` : `raised ${x.troops} troop${x.troops === 1 ? "" : "s"} at ${n.place(x.territory)}`,
  );
  const saving = !did.length && e.toward ? ` (${goalLine(e.toward, n).replace(/^A /, "a ").replace(/^Culture/, "culture").replace(/^Troops/, "troops")})` : "";
  return `${who} governs ${n.province(e.province)}: kept ${e.kept} gold${did.length ? `, ${did.join(", ")}` : saving}.`;
}
