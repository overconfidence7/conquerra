import { dealLine, explainFizzle, explainHold, fizzleIsQuiet, governLine, spyLine, type GameContext, type PlayerId, type PlayerView, type ReplayEvent } from "@conquerra/engine";
import { fateLine, fateTone, MARK_NAME, missionLine, SET_NAME, troopWord } from "./cards";
import { army, BUILDING_NAME, dealNames, generalName, generalStatus, instructionDoing, SPECIALIST_NAME, WORLD_EVENT_NAME, type LogLine, type Namer, type Tone } from "./text";

/**
 * The turn report's lines (split from text.ts in session 14): plain English for every replay event. Loaded with the
 * turn report, after the first turn has played, so it isn't in the start-up bundle.
 */

/** Why a world event didn't happen, in plain words. */
const FAILED_WHY = {
  cost: "not enough Influence put toward it",
  cooldown: "that event is still resting",
  alreadyHit: "that player was already hit by an event this turn",
  capital: "events can't touch a capital",
  invalid: "that isn't a living player's land",
  lastLand: "it's that player's last territory",
  tooStrong: "too many troops there for an uprising",
  noRoom: "no neutral land next to it for mercenaries",
} as const;

/** One plain line for a world event the Fallen played (what it did, and to whom). */
/** "a plague", "an uprising": the Fallen's events as a headline says them (session 16). */
const FALLEN_STRIKE: Record<Extract<ReplayEvent, { type: "worldEvent" }>["event"], string> = { plague: "a plague", storm: "a storm", uprising: "an uprising", mercenaries: "mercenaries", famine: "a famine" };

export function worldEventLine(e: Extract<ReplayEvent, { type: "worldEvent" }>, n: Namer): string {
  const whose = n.isMe(e.against) ? "your" : `${n.who(e.against)}'s`;
  switch (e.event) {
    case "plague": {
      const lost = (e.losses ?? []).reduce((a, l) => a + l.troops, 0);
      return `The Fallen sent a plague on ${whose} land around ${n.place(e.target)}: ${lost} troop${lost === 1 ? "" : "s"} died.`;
    }
    case "storm":
      return `The Fallen sent a storm: the border between ${n.place(e.border![0])} and ${n.place(e.border![1])} was closed this turn.`;
    case "uprising":
      return e.flipped
        ? `The Fallen stirred an uprising in ${n.place(e.target)}: ${e.rebels} rebels threw ${n.isMe(e.against) ? "you" : n.who(e.against)} out, and hold it now.`
        : `The Fallen stirred an uprising in ${n.place(e.target)}, but ${e.rebels ? `its ${e.rebels} rebels` : "the rebels"} couldn't take it.`;
    case "mercenaries":
      return `The Fallen hired ${e.troops} mercenaries: a neutral army now holds ${n.place(e.at!)}, next to ${whose} ${n.place(e.target)}.`;
    case "famine":
      return `The Fallen sent a famine on ${whose} land: ${Math.round((e.cut ?? 0) * 100)}% of this turn's income is lost.`;
  }
}

/** "Your Leader, holding Galeholt," for a replay line about an order a general wrote (or a fight where it stood). */
function generalPhrase(view: PlayerView | undefined, n: Namer, general: PlayerId | undefined, at?: string): string | null {
  if (!general || !view) return null;
  const st = generalStatus(view, general);
  const doing = st?.instruction ? instructionDoing(st.instruction, n, at ?? st.at).replace(/^./, (c) => c.toLowerCase()) : null;
  return doing ? `${generalName(n, general)}, ${doing},` : generalName(n, general);
}

/**
 * Plain-English line for a replay event, or null to skip it. Uses only what the replay contains,
 * so fogged events stay vague ("A battle somewhere in Northreach").
 */
export function narrate(ctx: GameContext, e: ReplayEvent, n: Namer): LogLine | null {
  const { who, place, isMe } = n;
  const verb = (id: string | null, you: string, they: string) => (isMe(id) ? you : they);
  switch (e.type) {
    case "turnStart":
      return { text: `Turn order: ${e.seats.map(who).join(" → ")}`, tone: "quiet" };
    case "surface": {
      const prov = ctx.map.provinces.find((p) => p.id === e.province)?.name ?? e.province;
      if (e.what === "fate") return { text: e.yours ? `Your Fate card fell in the fog: something stirs in ${prov}.` : `Something stirs in ${prov}.`, tone: "quiet" };
      return { text: e.what === "battle" ? `Distant fighting somewhere in ${prov}.` : `A Leader fell somewhere in ${prov}.`, tone: "quiet" };
    }
    case "initiative":
      return { text: e.timing === "first" ? "You seized the initiative." : "You lay in wait.", tone: "info" };
    case "fizzled": {
      const target = e.order.kind === "move" ? e.order.to : undefined;
      return {
        text: explainFizzle(e, n, { plannedTroops: target ? n.planned?.(target) : undefined }),
        tone: fizzleIsQuiet(e) ? "info" : "bad",
      };
    }
    case "recruited":
      return { text: `${who(e.player)} recruited ${e.count} at ${place(e.territory)}.`, tone: isMe(e.player) ? "info" : "quiet" };
    case "hired":
      return { text: `${who(e.player)} hired ${SPECIALIST_NAME[e.specialist].toLowerCase()} at ${place(e.territory)}.`, tone: isMe(e.player) ? "info" : "quiet" };
    case "built":
      return {
        text: `${who(e.player)} ${e.doneAtEndOfTurn === null ? "built" : "started building"} a ${BUILDING_NAME[e.building].toLowerCase()} at ${place(e.territory)}.`,
        tone: isMe(e.player) ? "info" : "quiet",
      };
    case "completed":
      return { text: `${isMe(e.player) ? "Your" : `${who(e.player)}'s`} ${BUILDING_NAME[e.building].toLowerCase()} at ${place(e.territory)} is finished.`, tone: "quiet" };
    case "invested":
      return { text: `${who(e.player)} raised culture at ${place(e.territory)} to ${e.culture}.`, tone: "quiet" };
    case "moved":
      // Right of passage: "You marched 8 troops from Ashfell through Galeholt and Pinemark to Oakcrest." (Land on the
      // way that changed hands: it stopped short, and says where it meant to go.)
      if (e.through?.length || e.stopped) {
        const way = e.through?.length ? ` through ${e.through.map(place).join(" and ")}` : "";
        const short = e.stopped ? `, stopping there: land on the way to ${place(e.stopped)} had changed hands` : "";
        return { text: `${who(e.player)} marched ${army(e.army)} from ${place(e.from)}${way} to ${place(e.to)}${short}.`, tone: e.stopped && isMe(e.player) ? "info" : "quiet" };
      }
      if (e.general && isMe(e.player))
        return { text: `${generalPhrase(n.view, n, e.general)} ${e.retreat ? "pulled back" : "moved"} ${army(e.army)} from ${place(e.from)} to ${place(e.to)}.`, tone: "info" };
      return {
        text: `${who(e.player)} ${e.retreat ? "retreated" : "moved"} ${army(e.army)} from ${place(e.from)} to ${place(e.to)}${e.withLeader ? " with the Leader" : ""}.`,
        tone: e.retreat && isMe(e.player) ? "info" : "quiet",
      };
    case "battle": {
      const mine = isMe(e.player);
      const vsMe = isMe(e.defender);
      // Both armies and both sides' losses: "You attacked Ashfell (Gules, 8 troops) with 10 troops and took it: you lost 3, they lost 8."
      const defenders = `${vsMe ? "yours" : e.defender ? who(e.defender) : "neutral"}, ${army(e.defenders)}`;
      const way = e.through?.length ? `, marching through ${e.through.map(place).join(" and ")}` : "";
      const leader = e.withLeader ? (mine ? " and your Leader" : " and their Leader") : "";
      const head = `${who(e.player)} attacked ${place(e.to)} (${defenders}) with ${army(e.attackers)}${leader}${way}`;
      // Culture is lost when land changes hands (session 16).
      const lostCulture = e.captured && e.defense.culture > (e.keptCulture ?? 0) ? ` Its culture (level ${e.defense.culture}) was lost.` : "";
      // A general's own fights read as its story: "Your Leader, pushing toward Old March, took Ashfell (...)".
      const g = mine && e.general ? generalPhrase(n.view, n, e.general) : null;
      if (g)
        return {
          text: `${g} ${e.captured ? "took" : "attacked"} ${place(e.to)} (${defenders}) with ${army(e.attackers)}${e.captured ? "" : " and was driven back"}: you lost ${e.result.attackerLosses}, they lost ${e.result.defenderLosses}.${lostCulture}`,
          tone: e.captured ? "good" : "bad",
        };
      const guard = vsMe && !e.captured && e.defense.leader && n.view?.me.command ? generalPhrase(n.view, n, n.view.me.id, e.to) : null;
      if (guard)
        return { text: `${guard} drove back ${who(e.player)}'s attack on ${place(e.to)} (${army(e.attackers)}): you lost ${e.result.defenderLosses}, they lost ${e.result.attackerLosses}.`, tone: "good" };
      const result = e.captured ? "and took it" : verb(e.player, "and were driven back", "and was driven back");
      const lossA = `${mine ? "you" : vsMe ? "they" : who(e.player)} lost ${e.result.attackerLosses}`;
      const lossD = `${vsMe ? "you" : mine ? "they" : "the defenders"} lost ${e.result.defenderLosses}`;
      const held = explainHold(ctx, e, vsMe);
      const lostSpecs = e.specialistsLost.length ? ` Specialists lost: ${e.specialistsLost.map((s) => SPECIALIST_NAME[s].toLowerCase()).join(", ")}.` : "";
      const tone: Tone = mine ? (e.captured ? "good" : "bad") : vsMe ? (e.captured ? "bad" : "good") : "quiet";
      return { text: `${head} ${result}: ${lossA}, ${lossD}.${held ? ` ${held}` : ""}${lostSpecs}${lostCulture}`, tone };
    }
    case "leaderKilled":
      return { text: `${isMe(e.player) ? "Your" : `${who(e.player)}'s`} Leader fell at ${place(e.territory)}.`, tone: isMe(e.player) ? "bad" : "good" };
    case "leaderReturned":
      return { text: `${isMe(e.player) ? "Your" : `${who(e.player)}'s`} Leader returned at ${place(e.territory)}.`, tone: "info" };
    case "eliminated":
      return {
        text: isMe(e.player)
          ? `You have been eliminated${e.by ? ` by ${who(e.by)}` : ""}.`
          : `${who(e.player)} has been eliminated${e.by ? ` by ${who(e.by)}` : ""}.`,
        tone: isMe(e.player) ? "bad" : isMe(e.by) ? "good" : "info",
      };
    case "generalCaptured":
      return isMe(e.player)
        ? { text: `${who(e.general)} joins you as a captured general, at ${place(e.territory)}. Give them an instruction, or move troops there for them to command.`, tone: "good" }
        : { text: `${who(e.general)} now serves ${who(e.player)} as a captured general.`, tone: "info" };
    case "generalLost":
      return isMe(e.player)
        ? { text: `${who(e.general)}, your captured general, is gone for good: ${place(e.territory)} ${e.by ? `fell to ${who(e.by)}` : "was lost"}.`, tone: "bad" }
        : { text: `${who(e.player)}'s captured general ${who(e.general)} is gone for good, at ${place(e.territory)}.`, tone: isMe(e.by) ? "good" : "quiet" };
    case "generalReleased":
      return { text: `You let ${who(e.general)} go (you may keep two captured generals).`, tone: "info" };
    case "worldEvent":
      // Aimed at you (session 16): said plainly first. "The Fallen have turned on you: a plague in Old March."
      return {
        text: isMe(e.against) ? `The Fallen have turned on you: ${FALLEN_STRIKE[e.event]} in ${place(e.target)}. ${worldEventLine(e, n)}` : worldEventLine(e, n),
        tone: isMe(e.against) ? "bad" : e.by.some(isMe) ? "good" : "info",
      };
    case "worldEventFailed":
      return { text: `Your ${WORLD_EVENT_NAME[e.event].toLowerCase()} on ${place(e.target)} didn't happen (${FAILED_WHY[e.reason]}); your Influence wasn't spent.`, tone: "info" };
    case "spoilsEarned":
      return { text: `You earned a Spoils card: ${MARK_NAME[e.mark]} (you hold ${e.hand}).`, tone: "good" };
    case "spoilsTurnedIn": {
      const what = SET_NAME[e.set].toLowerCase();
      // What the set gave (session 16): every set gives gold; troops say where they went.
      const spread = e.spread?.length ? `${troopWord(e.troops)} (${e.spread.map((x) => `${x.troops} at ${place(x.territory)}`).join(", ")})` : `${troopWord(e.troops)} at ${place(e.at)}`;
      const gold = e.gold ? ` and ${e.gold} gold` : "";
      const gave =
        e.set === "tower"
          ? `a fort and ${troopWord(e.troops)} at ${place(e.at)}${gold}`
          : e.set === "laurel"
            ? `culture rises at ${listPlaces(e.culture.map(place))}${gold}`
            : e.set === "mixed"
              ? `${e.building ? `a ${BUILDING_NAME[e.building].toLowerCase()} at ${place(e.at)}, ` : ""}${spread}${gold}`
              : `${spread}${gold}`;
      if (!isMe(e.player)) return { text: `${who(e.player)} turned in Spoils (${what}): ${gave}.`, tone: "info" };
      return { text: e.orderId === null ? `Your hand was full, so ${what} were turned in for you: ${gave}.` : `You turned in ${what}: ${gave}.`, tone: "good" };
    }
    case "fate":
      return { text: fateLine(ctx, e, n), tone: fateTone(e, n) };
    case "missionDrawn":
      return { text: `Your Fate card is a mission: ${missionLine(ctx, e.mission, n)}.`, tone: "info" };
    case "missionDone":
      return isMe(e.player)
        ? { text: `Mission done: ${missionLine(ctx, e.mission, n)}.`, tone: "good" }
        : { text: `${who(e.player)} completed a mission${e.at ? ` (its reward came at ${place(e.at)})` : ""}.`, tone: "quiet" };
    case "missionFailed":
      return { text: `Mission ${e.why === "lost" ? "failed (you lost the land)" : "lapsed"}: ${missionLine(ctx, e.mission, n)}.`, tone: "info" };
    case "income":
      return {
        text: `Income +${e.income}${e.famine ? `, famine −${e.famine}` : ""}, upkeep −${e.upkeep}: you now have ${e.goldAfter} gold.${e.deserted ? ` ${e.deserted} troops deserted (unpaid upkeep).` : ""}`,
        tone: e.deserted ? "bad" : "info",
      };
    case "gameOver":
      return { text: e.winner === "draw" ? "The game ends in a draw." : `${who(e.winner)} ${verb(e.winner, "win", "wins")} the game!`, tone: isMe(e.winner) ? "good" : "info" };
    // Diplomacy (session 14): the engine's own wording.
    case "dealStarted":
      return { text: dealLine(e, dealNames(n))!, tone: isMe(e.deal.a) || isMe(e.deal.b) ? "good" : "info" };
    case "dealEnded":
      return { text: dealLine(e, dealNames(n))!, tone: "info" };
    case "dealBroken":
      return { text: dealLine(e, dealNames(n))!, tone: isMe(e.by) || isMe(e.a) || isMe(e.b) ? "bad" : "info" };
    case "dealFailed":
    case "offerLapsed":
      return { text: dealLine(e, dealNames(n))!, tone: "quiet" };
    case "tribute":
      return { text: dealLine(e, dealNames(n))!, tone: e.short ? "bad" : "info" };
    // "Govern this province" (session 15): "Your Leader governs Old March: kept 3 gold, raised culture in Pinemark."
    case "governed":
    case "purseHome":
      return { text: governLine(e, { general: (g) => generalName(n, g), place, province: (id) => ctx.map.provinces.find((p) => p.id === id)?.name ?? id }), tone: "info" };
    // Spies (session 15): only their owner hears of them (a fooled spy reads exactly like one that got in).
    case "spyHired":
    case "spy":
    case "spyCaught": {
      const text = spyLine(e, { place, province: (id) => ctx.map.provinces.find((p) => p.id === id)?.name ?? id });
      const tone: Tone = e.type === "spy" ? (e.outcome === "in" ? "good" : e.outcome === "killed" ? "bad" : "info") : e.type === "spyCaught" ? "good" : "info";
      return { text, tone };
    }
    // What came into view goes in its own part of the report (logic/report.ts).
    case "vision":
      return null;
  }
}

/**
 * The whole turn as log lines. Fighting in the fog is folded into one line at the end
 * ("Fighting in the fog: The Vale ×2, Saltcoast") so it doesn't drown out your own battles.
 */
export function narrateTurn(ctx: GameContext, events: readonly ReplayEvent[], n: Namer): LogLine[] {
  const lines: LogLine[] = [];
  const fog = new Map<string, number>();
  let fallen = 0;
  for (const e of events) {
    if (e.type === "surface" && e.what !== "fate") {
      if (e.what === "battle") fog.set(e.province, (fog.get(e.province) ?? 0) + 1);
      else fallen++;
      continue;
    }
    const line = narrate(ctx, e, n);
    if (line) lines.push(line);
  }
  const prov = (id: string) => ctx.map.provinces.find((p) => p.id === id)?.name ?? id;
  const notes: string[] = [];
  if (fog.size) notes.push(`Fighting in the fog: ${[...fog].map(([p, k]) => (k > 1 ? `${prov(p)} ×${k}` : prov(p))).join(", ")}.`);
  if (fallen) notes.push(`${fallen === 1 ? "A Leader" : `${fallen} Leaders`} fell out of sight.`);
  if (notes.length) {
    // Keep the economy line last.
    const at = lines.findIndex((l) => l.text.startsWith("Income"));
    lines.splice(at < 0 ? lines.length : at, 0, { text: notes.join(" "), tone: "quiet" });
  }
  return lines;
}

const listPlaces = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}` : (xs[0] ?? ""));
