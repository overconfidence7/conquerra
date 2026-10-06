import type { BuildingType, SpecialistType, Terrain } from "@conquerra/content";
import { amountLabel, recruitLabel, explainFizzle, explainHold, fizzleIsQuiet, indexMap, PRESETS, type ArmySnapshot, type GameContext, type Instruction, type Order, type PlayerId, type PlayerView, type ReplayEvent } from "@conquerra/engine";
import { fateLine, fateTone, MARK_NAME, missionLine, SET_NAME } from "./cards";

export const SPECIALIST_ICON: Record<SpecialistType, string> = { cavalry: "🐎", siege: "🎯", scouts: "🔭", engineers: "🔨", healers: "⚕️" };
export const SPECIALIST_NAME: Record<SpecialistType, string> = { cavalry: "Cavalry", siege: "Siege", scouts: "Scouts", engineers: "Engineers", healers: "Healers" };
export const SPECIALIST_HELP: Record<SpecialistType, string> = {
  cavalry: "Moves 2 territories (through your own land)",
  siege: "Cancels enemy forts when attacking",
  scouts: "Sees 1 territory further",
  engineers: "Finishes buildings here instantly",
  healers: "Loses 25% fewer troops",
};
export const BUILDING_ICON: Record<BuildingType, string> = { fort: "🏰", market: "💰", barracks: "⚔️", watchtower: "🗼" };
export const BUILDING_NAME: Record<BuildingType, string> = { fort: "Fort", market: "Market", barracks: "Barracks", watchtower: "Watchtower" };
export const BUILDING_HELP: Record<BuildingType, string> = {
  fort: "Defense ×1.6 (ready end of next turn)",
  market: "+2 gold per turn",
  barracks: "Recruit and hire here",
  watchtower: "See 1 territory further",
};
export const TERRAIN_ICON: Record<Terrain, string> = { plains: "", forest: "🌲", hills: "⛰️", mountains: "🏔️", swamp: "🌾" };

/** Names for people and places, with "you" for the player. */
export interface Namer {
  /** Your own view, for lines about your generals. */
  view?: PlayerView;
  who(id: string | null): string;
  place(id: string): string;
  isMe(id: string | null): boolean;
  /** The army you saw on a territory while planning the turn (for "you planned for 1"), if you saw one. */
  planned?(id: string): number | undefined;
}

/** `before`: your view while you planned the turn being reported, so the report can say what you planned for. */
export function namer(ctx: GameContext, view: PlayerView, before?: PlayerView | null): Namer {
  const idx = indexMap(ctx.map);
  return {
    view,
    who: (id) => (id === null ? "neutral" : id === view.me.id ? "You" : (view.players.find((p) => p.id === id)?.name ?? id)),
    place: (id) => idx.byId.get(id)?.name ?? id,
    isMe: (id) => id === view.me.id,
    planned: (id) => {
      const t = before?.territories[id];
      return !t ? undefined : t.detail === "full" ? t.troops : t.lastSeen?.troops;
    },
  };
}

const army = (a: ArmySnapshot) =>
  `${a.troops} troop${a.troops === 1 ? "" : "s"}${a.specialists.length ? ` + ${a.specialists.map((s) => SPECIALIST_NAME[s].toLowerCase()).join(", ")}` : ""}`;
const presetName = (id: string) => PRESETS.find((p) => p.id === id)?.name ?? id;

/** One line for an order in the queue. */
/** `sending`: what a move sends, e.g. "about 9, 3/4" (defaults to its share, e.g. "3/4"), or what a recruit buys ("12, All"). */
export function describeOrder(o: Order, n: Namer, attack: boolean, sending?: string): string {
  switch (o.kind) {
    case "recruit":
      return `Recruit ${sending ?? recruitLabel(o.count)} at ${n.place(o.territory)}`;
    case "hire":
      return `Hire ${SPECIALIST_NAME[o.specialist].toLowerCase()} at ${n.place(o.territory)}`;
    case "build":
      return `Build a ${BUILDING_NAME[o.building].toLowerCase()} at ${n.place(o.territory)}`;
    case "invest":
      return `Raise culture at ${n.place(o.territory)}`;
    case "retreat":
      return `Retreat from ${n.place(o.from)}${o.preset ? " if outnumbered" : ""}`;
    case "advance":
      return `Advance from ${n.place(o.from)}`;
    case "move":
      return `${attack ? "Attack" : "Move"} ${n.place(o.to)} from ${n.place(o.from)}${o.via ? ` via ${n.place(o.via)}` : ""} with ${sending ?? amountLabel(o.troops)}`;
    case "instruct":
      return `${generalName(n, o.general)}: ${o.instruction ? instructionName(o.instruction, n) : "you give the orders"}`;
    case "release":
      return `Let ${generalName(n, o.general)} go`;
    case "worldEvent":
      return `${WORLD_EVENT_NAME[o.event]} on ${n.place(o.target)}${o.across ? ` and ${n.place(o.across)}` : ""} (${o.influence} influence)`;
    case "spoils":
      return `Turn in Spoils: ${SET_NAME[o.set].toLowerCase()}${(o.set === "tower" || o.set === "laurel") && o.territory ? ` at ${n.place(o.territory)}` : ""}`;
  }
}

export const WORLD_EVENT_NAME = { plague: "Plague", storm: "Storm", uprising: "Uprising", mercenaries: "Mercenaries", famine: "Famine" } as const;

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

/** A general's name: "Your Leader", or a captured general by the name of the player whose Leader it was. */
export function generalName(n: Namer, general: PlayerId): string {
  return n.isMe(general) ? "Your Leader" : n.who(general);
}

/** An instruction as a command ("Push toward Old March"). */
export function instructionName(i: Instruction, n: Namer): string {
  switch (i.kind) {
    case "hold":
      return "Hold here";
    case "defend":
      return "territory" in i ? `Defend the border toward ${n.place(i.territory)}` : `Defend the border with ${n.who(i.player)}`;
    case "push":
      return `Push toward ${n.place(i.territory)}`;
    case "raid":
      return `Raid ${n.who(i.player)}`;
  }
}

/** What a general is doing, as on the Leader card ("Holding Galeholt", "Pushing toward Old March"). */
export function instructionDoing(i: Instruction, n: Namer, at: string | null): string {
  switch (i.kind) {
    case "hold":
      return at ? `Holding ${n.place(at)}` : "Holding its ground";
    case "defend":
      return "territory" in i ? `Defending the border toward ${n.place(i.territory)}` : `Defending the border with ${n.who(i.player)}`;
    case "push":
      return `Pushing toward ${n.place(i.territory)}`;
    case "raid":
      return `Raiding ${n.who(i.player)}`;
  }
}

/** Where a general stands now and its instruction, from your view (null if it isn't yours or has none). */
export function generalStatus(view: PlayerView, general: PlayerId): { at: string | null; instruction: Instruction | null } | null {
  if (general === view.me.id) return { at: view.me.leader.alive ? view.me.leader.territory : null, instruction: view.me.command };
  const g = view.me.captured.find((x) => x.of === general);
  return g ? { at: g.territory, instruction: g.instruction } : null;
}

/** "Your Leader, holding Galeholt," for a replay line about an order a general wrote (or a fight where it stood). */
function generalPhrase(view: PlayerView | undefined, n: Namer, general: PlayerId | undefined, at?: string): string | null {
  if (!general || !view) return null;
  const st = generalStatus(view, general);
  const doing = st?.instruction ? instructionDoing(st.instruction, n, at ?? st.at).replace(/^./, (c) => c.toLowerCase()) : null;
  return doing ? `${generalName(n, general)}, ${doing},` : generalName(n, general);
}

/** Little tags under a queued order: preset, leader, timing. */
export function orderTags(o: Order): string[] {
  const tags: string[] = [];
  if (o.preset && o.kind !== "retreat") tags.push(presetName(o.preset.id));
  if (o.kind === "move" && o.withLeader) tags.push("👑 with Leader");
  if (o.timing === "first") tags.push("⚡ Seize the Initiative");
  if (o.timing === "last") tags.push("⏳ Lie in Wait");
  return tags;
}

export type Tone = "good" | "bad" | "info" | "quiet";
export interface LogLine {
  text: string;
  tone: Tone;
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
      const head = `${who(e.player)} attacked ${place(e.to)} (${defenders}) with ${army(e.attackers)}`;
      // A general's own fights read as its story: "Your Leader, pushing toward Old March, took Ashfell (...)".
      const g = mine && e.general ? generalPhrase(n.view, n, e.general) : null;
      if (g)
        return {
          text: `${g} ${e.captured ? "took" : "attacked"} ${place(e.to)} (${defenders}) with ${army(e.attackers)}${e.captured ? "" : " and was driven back"}: you lost ${e.result.attackerLosses}, they lost ${e.result.defenderLosses}.`,
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
      return { text: `${head} ${result}: ${lossA}, ${lossD}.${held ? ` ${held}` : ""}${lostSpecs}`, tone };
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
      return { text: worldEventLine(e, n), tone: isMe(e.against) ? "bad" : e.by.some(isMe) ? "good" : "info" };
    case "worldEventFailed":
      return { text: `Your ${WORLD_EVENT_NAME[e.event].toLowerCase()} on ${place(e.target)} didn't happen (${FAILED_WHY[e.reason]}); your Influence wasn't spent.`, tone: "info" };
    case "spoilsEarned":
      return { text: `You earned a Spoils card: ${MARK_NAME[e.mark]} (you hold ${e.hand}).`, tone: "good" };
    case "spoilsTurnedIn": {
      const what = SET_NAME[e.set].toLowerCase();
      const gave =
        e.set === "tower"
          ? `a fort and ${e.troops} troops at ${place(e.at)}`
          : e.set === "laurel"
            ? `culture rises at ${listPlaces(e.culture.map(place))}`
            : `${e.troops} troops at ${place(e.at)}${e.gold ? ` and ${e.gold} gold` : ""}`;
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

/** One line per map in the lobby's map list: "The Ringsea · 100 territories · suits 6–10 players". */
export function mapChoiceLabel(m: { name: string; territories: number; recommendedPlayers: { min: number; max: number } }): string {
  return `${m.name} · ${m.territories} territories · suits ${m.recommendedPlayers.min}–${m.recommendedPlayers.max} players`;
}
