import { dealLine, explainFizzle, explainHold, governLine, spyLine, type ArmySnapshot, type GameContext, type StepEvent } from "@conquerra/engine";

const army = (a: ArmySnapshot) => `${a.troops} troops${a.specialists.length ? ` + ${a.specialists.join(", ")}` : ""}`;

/** Plain-English line for each replay event (also a starting point for the in-game log). */
export function narrate(ctx: GameContext, e: StepEvent, name: (id: string | null) => string, place: (id: string) => string): string {
  switch (e.type) {
    case "turnStart":
      return `── Turn ${e.turn} ── order: ${e.seats.map(name).join(" → ")}`;
    case "initiative":
      return `${name(e.player)} ${e.timing === "first" ? "seizes the initiative" : "lies in wait"}`;
    case "fizzled":
      return `${name(e.player)}: ${explainFizzle(e, { place }).replace(/^Your /, "")}`;
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
      return `${name(e.player)} attacks ${place(e.to)} (${name(e.defender)}) from ${place(e.from)}: ${army(e.attackers)} vs ${army(e.defenders)} → loses ${e.result.attackerLosses}, kills ${e.result.defenderLosses}${e.captured ? " — CAPTURED" : ` — ${explainHold(ctx, e)}`}${e.specialistsLost.length ? ` (lost: ${e.specialistsLost.join(", ")})` : ""}`;
    case "leaderKilled":
      return `${name(e.player)}'s leader falls at ${place(e.territory)}`;
    case "leaderReturned":
      return `${name(e.player)}'s leader returns at ${place(e.territory)}`;
    case "eliminated":
      return `☠ ${name(e.player)} is eliminated${e.by ? ` by ${name(e.by)}` : ""}`;
    case "income":
      return `${name(e.player)}: +${e.income}g income, -${e.upkeep}g upkeep → ${e.goldAfter}g${e.deserted ? ` (${e.deserted} deserted)` : ""}`;
    case "generalCaptured":
      return `${name(e.general)}'s Leader joins ${name(e.player)} as a captured general at ${place(e.territory)}`;
    case "generalLost":
      return `${name(e.player)} loses captured general ${name(e.general)} at ${place(e.territory)}`;
    case "generalReleased":
      return `${name(e.player)} lets captured ${e.steward ? "Steward" : "Leader"} ${name(e.general)} go${e.gold ? ` (${e.gold}g home)` : ""}`;
    case "stewardCaptured":
      return `${name(e.steward)}'s Steward joins ${name(e.player)}`;
    case "purseTaken":
      return `${name(e.player)} takes ${e.gold}g back from ${name(e.leader.of)}'s ${e.leader.kind === "steward" ? "Steward" : "Leader"}`;
    case "purses":
      return `${name(e.player)}'s purses: ${[...e.upkeep.map((x) => `${x.gold}g to upkeep`), ...e.paid.map((x) => `${x.gold}g to ${name(x.of)}'s ${x.kind === "steward" ? "Steward" : "Leader"}`)].join(", ")} → treasury ${e.goldAfter}g`;
    case "worldEvent":
      return `☄ The Fallen (${e.by.map(name).join(", ")}, ${e.spent} influence): ${e.event} on ${place(e.target)} (${name(e.against)})${e.losses ? `, losses ${e.losses.map((l) => `${place(l.territory)} -${l.troops}`).join(", ")}` : ""}${e.flipped !== undefined ? `, ${e.rebels} rebels ${e.flipped ? "take it" : "fail"}` : ""}${e.at ? `, ${e.troops} mercenaries at ${place(e.at)}` : ""}${e.cut !== undefined ? `, income cut ${Math.round(e.cut * 100)}%` : ""}${e.border ? `, border ${place(e.border[0])}–${place(e.border[1])} closed` : ""}`;
    case "worldEventFailed":
      return `${name(e.player)}: ${e.event} on ${place(e.target)} didn't happen (${e.reason})`;
    case "spoilsEarned":
      return `${name(e.player)} earns a Spoils card (${e.mark}; holds ${e.hand})`;
    case "spoilsTurnedIn":
      return `${name(e.player)} turns in Spoils (${e.set}${e.orderId === null ? ", at the hand limit" : ""}) at ${place(e.at)}: ${e.troops} troops${e.gold ? `, ${e.gold} gold` : ""}${e.fort ? ", a fort" : ""}${e.culture.length ? `, culture at ${e.culture.map(place).join(", ")}` : ""}`;
    case "fate":
      return `🂠 Fate (${name(e.drawer)}): ${e.card} at ${place(e.at)} (${name(e.holder)})${e.shrugged ? " — shrugged off" : ""}${e.gold ? `, gold ${e.gold > 0 ? "+" : ""}${e.gold}` : ""}${e.troops ? `, troops ${e.troops > 0 ? "+" : ""}${e.troops}` : ""}${e.border ? `, ${place(e.border[0])}–${place(e.border[1])} closed turn ${e.until}` : ""}${e.flipped ? ", rebels take it" : ""}`;
    case "missionDrawn":
      return `${name(e.player)} draws a mission: ${e.mission.card} (by turn ${e.mission.deadline})`;
    case "missionDone":
      return `${name(e.player)} completes mission ${e.mission.card}${e.gold ? ` (+${e.gold}g)` : ""}`;
    case "missionFailed":
      return `${name(e.player)}'s mission ${e.mission.card} ${e.why === "lost" ? "fails" : "lapses"}`;
    case "gameOver":
      return `★ Game over (${e.reason}): ${e.winner === "draw" ? "draw" : `${name(e.winner)} wins`}`;
    case "dealStarted":
    case "dealEnded":
    case "dealBroken":
    case "dealFailed":
    case "offerLapsed":
    case "tribute":
      return `🤝 ${dealLine(e, { you: null, player: (id) => name(id), place, province: (id) => ctx.map.provinces.find((p) => p.id === id)?.name ?? id }) ?? e.type}`;
    case "governed":
    case "purseHome":
      return `🏛 ${governLine(e, { general: (id) => `${name(id)}'s general`, place, province: (id) => ctx.map.provinces.find((p) => p.id === id)?.name ?? id })}`;
    case "spyHired":
    case "spy":
    case "spyCaught":
      return `🕵 ${name(e.player)}: ${spyLine(e, { place, province: (id) => ctx.map.provinces.find((p) => p.id === id)?.name ?? id })}`;
  }
}
