import type { ArmySnapshot, StepEvent } from "@conquerra/engine";

const army = (a: ArmySnapshot) => `${a.troops} troops${a.specialists.length ? ` + ${a.specialists.join(", ")}` : ""}`;

/** Plain-English line for each replay event (also a starting point for the in-game log). */
export function narrate(e: StepEvent, name: (id: string | null) => string, place: (id: string) => string): string {
  switch (e.type) {
    case "turnStart":
      return `── Turn ${e.turn} ── order: ${e.seats.map(name).join(" → ")}`;
    case "initiative":
      return `${name(e.player)} ${e.timing === "first" ? "seizes the initiative" : "lies in wait"}`;
    case "fizzled":
      return `${name(e.player)}'s order fizzled (${e.reason})${e.usedFallback ? " → backup plan" : ""}`;
    case "recruited":
      return `${name(e.player)} recruits ${e.count} troops at ${place(e.territory)} (${e.cost}g)`;
    case "hired":
      return `${name(e.player)} hires ${e.specialist} at ${place(e.territory)} (${e.cost}g)`;
    case "built":
      return `${name(e.player)} ${e.doneAtEndOfTurn === null ? "builds" : "starts building"} a ${e.building} at ${place(e.territory)} (${e.cost}g)`;
    case "completed":
      return `${name(e.player)}'s ${e.building} at ${place(e.territory)} is finished`;
    case "invested":
      return `${name(e.player)} raises culture at ${place(e.territory)} to ${e.culture} (${e.cost}g)`;
    case "moved":
      return `${name(e.player)} ${e.retreat ? "retreats" : "moves"} ${army(e.army)} ${place(e.from)} → ${place(e.to)}${e.withLeader ? " with their leader" : ""}`;
    case "battle":
      return `${name(e.player)} attacks ${place(e.to)} (${name(e.defender)}) from ${place(e.from)}: ${army(e.attackers)} vs ${army(e.defenders)} → loses ${e.result.attackerLosses}, kills ${e.result.defenderLosses}${e.captured ? " — CAPTURED" : " — held"}${e.specialistsLost.length ? ` (lost: ${e.specialistsLost.join(", ")})` : ""}`;
    case "leaderKilled":
      return `${name(e.player)}'s leader falls at ${place(e.territory)}`;
    case "leaderReturned":
      return `${name(e.player)}'s leader returns at ${place(e.territory)}`;
    case "eliminated":
      return `☠ ${name(e.player)} is eliminated${e.by ? ` by ${name(e.by)}` : ""}`;
    case "income":
      return `${name(e.player)}: +${e.income}g income, -${e.upkeep}g upkeep → ${e.goldAfter}g${e.deserted ? ` (${e.deserted} deserted)` : ""}`;
    case "gameOver":
      return `★ Game over (${e.reason}): ${e.winner === "draw" ? "draw" : `${name(e.winner)} wins`}`;
  }
}
