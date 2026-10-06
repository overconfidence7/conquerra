import type { BuildingType, SpecialistType, Terrain } from "@conquerra/content";
import { amountLabel, recruitLabel, indexMap, PRESETS, DEAL_NAME, type ArmySnapshot, type DealNames, type GameContext, type Instruction, type Order, type PlayerId, type PlayerView } from "@conquerra/engine";
import { SET_NAME } from "./cards";

export const SPECIALIST_ICON: Record<SpecialistType, string> = { cavalry: "🐎", siege: "🎯", scouts: "🔭", engineers: "🔨", healers: "⚕️", rangers: "🏹", standardBearer: "🚩" };
export const SPECIALIST_NAME: Record<SpecialistType, string> = { cavalry: "Cavalry", siege: "Siege", scouts: "Scouts", engineers: "Engineers", healers: "Healers", rangers: "Rangers", standardBearer: "Standard-bearer" };
export const SPECIALIST_HELP: Record<SpecialistType, string> = {
  cavalry: "Moves 2 territories (through your own land)",
  siege: "Cancels enemy forts when attacking",
  scouts: "Sees 1 territory further",
  engineers: "Finishes buildings here instantly",
  healers: "Loses 25% fewer troops",
  rangers: "Attacking, forest, hills and swamp defend like plains",
  standardBearer: "Attacks 10% stronger",
};
export const SPY_HELP = "Its own piece: send it to a province to see behind the lines, or guard one you hold whole (free in your own land, 1 gold a turn while away)";
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
  /** The game's map and rules (province names for deal lines). */
  ctx?: GameContext;
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
    ctx,
    who: (id) => (id === null ? "neutral" : id === view.me.id ? "You" : (view.players.find((p) => p.id === id)?.name ?? id)),
    place: (id) => idx.byId.get(id)?.name ?? id,
    isMe: (id) => id === view.me.id,
    planned: (id) => {
      const t = before?.territories[id];
      return !t ? undefined : t.detail === "full" ? t.troops : t.lastSeen?.troops;
    },
  };
}

export const army = (a: ArmySnapshot) =>
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
      return `${attack ? "Attack" : "Move"} ${n.place(o.to)} from ${n.place(o.from)}${o.via ? ` via ${n.place(o.via)}` : ""}${o.through?.length ? ` through ${o.through.map((t) => n.place(t)).join(", ")}` : ""} with ${sending ?? amountLabel(o.troops)}`;
    case "instruct":
      return `${generalName(n, o.general)}: ${o.instruction ? instructionName(o.instruction, n) : "you give the orders"}`;
    case "release":
      return `Let ${generalName(n, o.general)} go`;
    case "worldEvent":
      return `${WORLD_EVENT_NAME[o.event]} on ${n.place(o.target)}${o.across ? ` and ${n.place(o.across)}` : ""} (${o.influence} influence)`;
    case "spoils":
      return `Turn in Spoils: ${SET_NAME[o.set].toLowerCase()}${(o.set === "tower" || o.set === "laurel") && o.territory ? ` at ${n.place(o.territory)}` : ""}`;
    case "propose":
      return `Offer ${n.who(o.offer.to)} a ${DEAL_NAME[o.offer.terms.kind]}${o.offer.bond === "binding" ? " (binding)" : ""}`;
    case "answer":
      return `${o.accept ? "Accept" : "Decline"} ${n.who(o.from)}'s offer`;
    case "break": {
      const d = n.view?.deals.find((x) => x.id === o.deal);
      return d ? `Break your ${DEAL_NAME[d.kind]} with ${n.who(d.a === n.view!.me.id ? d.b : d.a)}` : "Break a deal";
    }
    case "hireSpy":
      return `Hire a spy at ${n.place(o.territory)}`;
    case "spy":
      return o.to ? `Send your spy to ${n.ctx?.map.provinces.find((p) => p.id === o.to)?.name ?? o.to}` : "Call your spy home";
  }
}

/** The engine's deal wording, with this page's names (yours is "you"). */
export function dealNames(n: Namer): DealNames {
  return {
    you: n.view?.me.id ?? null,
    player: (id) => n.view?.players.find((p) => p.id === id)?.name ?? n.who(id),
    place: n.place,
    province: (id) => n.ctx?.map.provinces.find((p) => p.id === id)?.name ?? id,
  };
}

export const WORLD_EVENT_NAME = { plague: "Plague", storm: "Storm", uprising: "Uprising", mercenaries: "Mercenaries", famine: "Famine" } as const;

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
    case "govern":
      return "Govern this province";
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
    case "govern": {
      const province = at ? n.ctx?.map.provinces.find((p) => p.id === n.ctx?.map.territories.find((t) => t.id === at)?.province)?.name : null;
      return province ? `Governing ${province}` : "Governing its province";
    }
  }
}

/** Where a general stands now and its instruction, from your view (null if it isn't yours or has none). */
export function generalStatus(view: PlayerView, general: PlayerId): { at: string | null; instruction: Instruction | null } | null {
  if (general === view.me.id) return { at: view.me.leader.alive ? view.me.leader.territory : null, instruction: view.me.command };
  const g = view.me.captured.find((x) => x.of === general);
  return g ? { at: g.territory, instruction: g.instruction } : null;
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

/** One line per map in the lobby's map list: "The Ringsea · 100 territories · suits 6–10 players". */
export function mapChoiceLabel(m: { name: string; territories: number; recommendedPlayers: { min: number; max: number } }): string {
  return `${m.name} · ${m.territories} territories · suits ${m.recommendedPlayers.min}–${m.recommendedPlayers.max} players`;
}
