import type { StepEvent, Units } from "@conquerra/engine";

const u = (x: Units) =>
  [x.infantry && `${x.infantry} inf`, x.cavalry && `${x.cavalry} cav`, x.siege && `${x.siege} siege`].filter(Boolean).join(", ") || "nothing";

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
      return `${name(e.player)} recruits ${e.count} ${e.unit} at ${place(e.territory)} (${e.cost}g)`;
    case "built":
      return `${name(e.player)} builds a ${e.building} at ${place(e.territory)} (${e.cost}g)`;
    case "moved":
      return `${name(e.player)} moves ${u(e.units)} ${place(e.from)} → ${place(e.to)}${e.withLeader ? " with their leader" : ""}`;
    case "battle":
      return `${name(e.player)} attacks ${place(e.to)} (${name(e.defender)}) from ${place(e.from)}: ${u(e.attackers)} vs ${u(e.defenders)} → loses ${e.result.attackerLosses}, kills ${e.result.defenderLosses}${e.captured ? " — CAPTURED" : " — held"}`;
    case "leaderKilled":
      return `${name(e.player)}'s leader falls at ${place(e.territory)}`;
    case "leaderRaised":
      return `${name(e.player)} raises a new leader`;
    case "eliminated":
      return `☠ ${name(e.player)} is eliminated${e.by ? ` by ${name(e.by)}` : ""}`;
    case "income":
      return `${name(e.player)}: +${e.income}g income, -${e.upkeep}g upkeep → ${e.goldAfter}g${e.deserted ? ` (${e.deserted} deserted)` : ""}`;
    case "gameOver":
      return `★ Game over (${e.reason}): ${e.winner === "draw" ? "draw" : `${name(e.winner)} wins`}`;
  }
}
