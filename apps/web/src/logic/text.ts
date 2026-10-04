import type { BuildingType, SpecialistType, Terrain } from "@conquerra/content";
import { amountLabel, indexMap, PRESETS, type ArmySnapshot, type GameContext, type Order, type PlayerView, type ReplayEvent } from "@conquerra/engine";

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
  who(id: string | null): string;
  place(id: string): string;
  isMe(id: string | null): boolean;
}

export function namer(ctx: GameContext, view: PlayerView): Namer {
  const idx = indexMap(ctx.map);
  return {
    who: (id) => (id === null ? "neutral" : id === view.me.id ? "You" : (view.players.find((p) => p.id === id)?.name ?? id)),
    place: (id) => idx.byId.get(id)?.name ?? id,
    isMe: (id) => id === view.me.id,
  };
}

const army = (a: ArmySnapshot) =>
  `${a.troops} troop${a.troops === 1 ? "" : "s"}${a.specialists.length ? ` + ${a.specialists.map((s) => SPECIALIST_NAME[s].toLowerCase()).join(", ")}` : ""}`;
const presetName = (id: string) => PRESETS.find((p) => p.id === id)?.name ?? id;

/** One line for an order in the queue. */
/** `sending`: what a move sends, e.g. "about 9, 3/4" (defaults to its share, e.g. "3/4"). */
export function describeOrder(o: Order, n: Namer, attack: boolean, sending?: string): string {
  switch (o.kind) {
    case "recruit":
      return `Recruit ${o.count} at ${n.place(o.territory)}`;
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
  }
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
      return { text: e.what === "battle" ? `Distant fighting somewhere in ${prov}.` : `A Leader fell somewhere in ${prov}.`, tone: "quiet" };
    }
    case "initiative":
      return { text: e.timing === "first" ? "You seized the initiative." : "You lay in wait.", tone: "info" };
    case "fizzled":
      return {
        text: `Your order didn't happen: ${e.reason}${e.usedFallback ? " (backup plan used)" : ""}.`,
        tone: e.usedFallback ? "info" : "bad",
      };
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
      return {
        text: `${who(e.player)} ${e.retreat ? "retreated" : "moved"} ${army(e.army)} from ${place(e.from)} to ${place(e.to)}${e.withLeader ? " with the Leader" : ""}.`,
        tone: e.retreat && isMe(e.player) ? "info" : "quiet",
      };
    case "battle": {
      const mine = isMe(e.player);
      const vsMe = isMe(e.defender);
      const head = `${who(e.player)} attacked ${place(e.to)}${e.defender && !vsMe ? ` (${who(e.defender)})` : e.defender ? " (yours)" : " (neutral)"}`;
      const result = e.captured ? "and took it" : verb(e.player, "but were driven back", "but was driven back");
      const losses = `lost ${e.result.attackerLosses}, killed ${e.result.defenderLosses}`;
      const lostSpecs = e.specialistsLost.length ? ` Specialists lost: ${e.specialistsLost.map((s) => SPECIALIST_NAME[s].toLowerCase()).join(", ")}.` : "";
      const tone: Tone = mine ? (e.captured ? "good" : "bad") : vsMe ? (e.captured ? "bad" : "good") : "quiet";
      return { text: `${head} with ${army(e.attackers)} ${result} (${losses}).${lostSpecs}`, tone };
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
    case "income":
      return {
        text: `Income +${e.income}, upkeep −${e.upkeep}: you now have ${e.goldAfter} gold.${e.deserted ? ` ${e.deserted} troops deserted (unpaid upkeep).` : ""}`,
        tone: e.deserted ? "bad" : "info",
      };
    case "gameOver":
      return { text: e.winner === "draw" ? "The game ends in a draw." : `${who(e.winner)} ${verb(e.winner, "win", "wins")} the game!`, tone: isMe(e.winner) ? "good" : "info" };
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
    if (e.type === "surface") {
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
