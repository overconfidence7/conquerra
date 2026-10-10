import { leaderLine, VOICES, type LeaderVoice } from "@conquerra/content/lines";
import { dealLine, explainFizzle, explainHold, findLeader, fizzleIsQuiet, governLine, spyLine, type GameContext, type LeaderRef, type PlayerView, type ReplayEvent } from "@conquerra/engine";
import { fateLine, fateTone, MARK_NAME, missionLine, SET_NAME, troopWord } from "./cards";
import { army, BUILDING_NAME, dealNames, generalName, instructionDoing, KIND_NAME, leaderName, leaderShortName, leaderStatus, SPECIALIST_NAME, styledName, WORLD_EVENT_NAME, type LogLine, type Namer, type Tone } from "./text";

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

/**
 * "Your Leader, Aldric, holding Galeholt," for a replay line about an order a leader wrote (or a fight where it
 * stood); a Steward's: "Your Steward, Odo, running the realm,".
 */
function leaderPhrase(view: PlayerView | undefined, n: Namer, r: LeaderRef | null | undefined, at?: string): string | null {
  if (!r || !view) return null;
  const st = leaderStatus(view, r);
  const doing = st?.instruction ? instructionDoing(st.instruction, n, at ?? st.at).replace(/^./, (c) => c.toLowerCase()) : null;
  return doing ? `${leaderName(n, r)}, ${doing},` : leaderName(n, r);
}
const generalPhrase = (view: PlayerView | undefined, n: Namer, general: string | undefined, at?: string) => (general ? leaderPhrase(view, n, { kind: "leader", of: general }, at) : null);

/** A purchase a leader of yours made from its purse: "Your Steward, Odo, running the realm, finished a market at Pinemark (6 gold)." */
function boughtBy(ctx: GameContext, e: Extract<ReplayEvent, { type: "recruited" | "hired" | "built" | "invested" }>, n: Namer): LogLine | null {
  if (!e.by || !n.isMe(e.player)) return null;
  const who = leaderPhrase(n.view, n, e.by) ?? leaderName(n, e.by);
  const did =
    e.type === "recruited"
      ? `recruited ${e.count} at ${n.place(e.territory)}`
      : e.type === "hired"
        ? `hired ${SPECIALIST_NAME[e.specialist].toLowerCase()} at ${n.place(e.territory)}`
        : e.type === "invested"
          ? `raised culture at ${n.place(e.territory)} to ${e.culture}`
          : `${e.doneAtEndOfTurn === null || ctx.rules.buildings[e.building].buildTurns <= 1 ? "finished" : "began"} a ${BUILDING_NAME[e.building].toLowerCase()} at ${n.place(e.territory)}`;
  return { text: `${who} ${did} (${e.cost} gold).`, tone: "info" };
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
      return boughtBy(ctx, e, n) ?? { text: `${who(e.player)} recruited ${e.count} at ${place(e.territory)}.`, tone: isMe(e.player) ? "info" : "quiet" };
    case "hired":
      return boughtBy(ctx, e, n) ?? { text: `${who(e.player)} hired ${SPECIALIST_NAME[e.specialist].toLowerCase()} at ${place(e.territory)}.`, tone: isMe(e.player) ? "info" : "quiet" };
    case "built":
      return boughtBy(ctx, e, n) ?? {
        text: `${who(e.player)} ${e.doneAtEndOfTurn === null ? "built" : "started building"} a ${BUILDING_NAME[e.building].toLowerCase()} at ${place(e.territory)}.`,
        tone: isMe(e.player) ? "info" : "quiet",
      };
    case "completed":
      return { text: `${isMe(e.player) ? "Your" : `${who(e.player)}'s`} ${BUILDING_NAME[e.building].toLowerCase()} at ${place(e.territory)} is finished.`, tone: "quiet" };
    case "invested":
      return boughtBy(ctx, e, n) ?? { text: `${who(e.player)} raised culture at ${place(e.territory)} to ${e.culture}.`, tone: "quiet" };
    // Walls (session 20b): "Pinemark is walled: its spare troops now help defend Ashfell and Galeholt."
    case "walled": {
      const list = e.territories.map(place);
      const names = list.length === 1 ? list[0]! : `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
      return isMe(e.player)
        ? { text: `${names} ${list.length === 1 ? "is" : "are"} walled: culture 5 and a fort. Its spare troops now help defend the rest of its wall, and the wall's help it.`, tone: "good" }
        : { text: `${who(e.player)} walled ${names}.`, tone: "info" };
    }
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
      const guard = vsMe && !e.captured && e.defense.leader && n.view && leaderStatus(n.view, { kind: "leader", of: n.view.me.id })?.instruction ? generalPhrase(n.view, n, n.view.me.id, e.to) : null;
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
          : isMe(e.by) && e.leader
            ? `${leaderName(n, e.leader)}, finished ${who(e.player)}.`
            : `${who(e.player)} has been eliminated${e.by ? ` by ${who(e.by)}` : ""}.`,
        tone: isMe(e.player) ? "bad" : isMe(e.by) ? "good" : "info",
      };
    case "generalCaptured":
      return isMe(e.player)
        ? { text: `${leaderShortName(n, { kind: "leader", of: e.general })}, ${who(e.general)}'s Leader, joins you at ${place(e.territory)}, reporting to ${leaderShortName(n, { kind: "leader", of: e.player })}: its army works with yours. Give it a command of its own in the Leaders panel.`, tone: "good" }
        : { text: `${who(e.general)}'s Leader now serves ${who(e.player)}.`, tone: "info" };
    case "stewardCaptured":
      return { text: `${leaderShortName(n, { kind: "steward", of: e.steward })}, ${who(e.steward)}'s Steward, joins you too, reporting to ${leaderShortName(n, { kind: "steward", of: e.player })}. Give it a command of its own in the Leaders panel.`, tone: "good" };
    case "generalLost":
      return isMe(e.player)
        ? { text: `${leaderShortName(n, { kind: "leader", of: e.general })}, your captured Leader, is gone for good: ${place(e.territory)} ${e.by ? `fell to ${who(e.by)}` : "was lost"}.${e.gold ? ` The ${e.gold} gold in its purse came home.` : ""}`, tone: "bad" }
        : { text: `${who(e.player)}'s captured Leader (once ${who(e.general)}'s) is gone for good, at ${place(e.territory)}.`, tone: isMe(e.by) ? "good" : "quiet" };
    case "generalReleased":
      return { text: `You let ${who(e.general)}'s ${e.steward ? "Steward" : "Leader"} go (you may keep ${(n.ctx?.rules.leaders.maxOfKind ?? 4)} of each kind, your own included).${e.gold ? ` The ${e.gold} gold in its purse came home.` : ""}`, tone: "info" };
    case "purseTaken":
      return { text: `You took ${e.gold} gold back from ${leaderShortName(n, e.leader)}'s purse (${n.isMe(e.leader.of) ? "your" : `${who(e.leader.of)}'s old`} ${KIND_NAME[e.leader.kind]}).`, tone: "info" };
    case "purses": {
      // (Upkeep the purses paid is on the income line.)
      if (!e.paid.length) return null;
      return { text: `Into purses: ${e.paid.map((x) => `${x.gold} gold to ${x.of === n.view?.me.id ? `your ${KIND_NAME[x.kind]}` : leaderShortName(n, x)}`).join(", ")}.`, tone: "quiet" };
    }
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
        text: `Income +${e.income}${e.famine ? `, famine −${e.famine}` : ""}, upkeep −${e.upkeep}: you now have ${e.goldAfter} gold.${e.fromPurses ? ` Your leaders' purses paid ${e.fromPurses} of it.` : ""}${e.deserted ? ` ${e.deserted} troops deserted (unpaid upkeep).` : ""}`,
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
    // "Govern this province" (session 15, old saves only): "Your Leader governs Old March: kept 3 gold, raised culture in Pinemark."
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
  const turn = events.find((e) => e.type === "turnStart")?.turn ?? n.view?.turn ?? 0;
  const fog = new Map<string, number>();
  let fallen = 0;
  // A leader of yours that took several territories reads as one line, where it took the first (session 18):
  // "Your Leader, Aldric, expanding toward Old March, took three territories: Ashfell, Galeholt and Pinemark."
  type Win = Extract<ReplayEvent, { type: "battle" }>;
  const wins = new Map<string, Win[]>();
  for (const e of events) if (e.type === "battle" && e.captured && e.general && n.isMe(e.player)) wins.set(e.general, [...(wins.get(e.general) ?? []), e]);
  for (const e of events) {
    if (e.type === "surface" && e.what !== "fate") {
      if (e.what === "battle") fog.set(e.province, (fog.get(e.province) ?? 0) + 1);
      else fallen++;
      continue;
    }
    const run = e.type === "battle" && e.captured && e.general ? wins.get(e.general) : undefined;
    if (run && run.length > 1) {
      if (run[0] === e) {
        const who = generalPhrase(n.view, n, e.general) ?? generalName(n, e.general!);
        const lost = run.reduce((a, x) => a + x.result.attackerLosses, 0), killed = run.reduce((a, x) => a + x.result.defenderLosses, 0);
        lines.push({ text: `${who} took ${COUNT_WORD[run.length] ?? run.length} territories: ${listPlaces(run.map((x) => n.place(x.to)))} (you lost ${lost}, they lost ${killed}).`, tone: "good" });
        const said = leaderSays(n, e.general!, run.map((x) => n.place(x.to)), e.defender ?? null, turn);
        if (said) lines.push({ text: said, tone: "info" });
      }
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

/**
 * A leader with a personality says something in its own voice when it took land (session 20c, Nate; its lines are in
 * the line library since session 22): "Aldric, the Conqueror: “Took Ashfell and Pinemark. Morwen's lot ran before
 * we got there.”" A Neutral leader says nothing. `turn`: the turn being told (which version it says depends on it).
 */
export function leaderSays(n: Namer, general: string, places: string[], rival: string | null, turn: number): string | null {
  const l = n.view ? findLeader(n.view.me, { kind: "leader", of: general }) : undefined;
  if (!l?.personality || !n.view || !(VOICES as readonly string[]).includes(l.personality)) return null;
  const whose = rival ? `${n.who(rival).replace(/^(Lady|Lord|Baron|Baroness|Queen|King|Duke|Duchess|Count|Countess|Prince|Princess|Sir|Dame) /, "")}'s lot` : "the locals";
  const text = leaderLine({ game: n.view.gameId, turn, who: `leader:${general}`, voice: l.personality as LeaderVoice }, "took", { places: listPlaces(places), rival: whose });
  return text ? `${styledName(l.name, l.personality)}: “${text[0]!.toUpperCase()}${text.slice(1)}”` : null;
}

const COUNT_WORD: Record<number, string> = { 2: "two", 3: "three", 4: "four", 5: "five", 6: "six", 7: "seven", 8: "eight", 9: "nine", 10: "ten" };
const listPlaces = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}` : (xs[0] ?? ""));
