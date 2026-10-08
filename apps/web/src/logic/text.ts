import type { LeaderNote } from "@conquerra/bots";
import type { BuildingType, SpecialistType, Terrain } from "@conquerra/content";
import { amountLabel, findLeader, leaderAt, recruitLabel, indexMap, PRESETS, DEAL_NAME, type ArmySnapshot, type Budget, type DealNames, type GameContext, type Instruction, type LeaderRef, type Order, type PlayerId, type PlayerView } from "@conquerra/engine";
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
    case "instruct": {
      const ref: LeaderRef = { kind: o.role === "steward" ? "steward" : "leader", of: o.general };
      return `${leaderName(n, ref)}: ${o.instruction ? instructionName(o.instruction, n, ref.kind) : ref.kind === "steward" ? "no command" : "you give the orders"}`;
    }
    case "budget": {
      const ref: LeaderRef = { kind: o.role === "steward" ? "steward" : "leader", of: o.general };
      return `${leaderName(n, ref)}: ${[o.budget ? `budget ${budgetLabel(o.budget)}` : "", o.takeBack ? "take its purse back" : ""].filter(Boolean).join(", ")}`;
    }
    case "release":
      return `Let ${leaderName(n, { kind: o.role === "steward" ? "steward" : "leader", of: o.general })} go`;
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

/** "Leader" or "Steward". */
export const KIND_NAME = { leader: "Leader", steward: "Steward" } as const;

/**
 * A leader of yours, as the start of a sentence (session 18): "Your Leader, Aldric", "Your Steward, Odo", or a captured
 * one, "Aldric, Lady Morwen's old Leader". Without a name to hand: "Your Leader", "Lady Morwen's Leader".
 */
export function leaderName(n: Namer, r: LeaderRef): string {
  const name = n.view ? findLeader(n.view.me, r)?.name : undefined;
  if (n.isMe(r.of)) return name ? `Your ${KIND_NAME[r.kind]}, ${name}` : `Your ${KIND_NAME[r.kind]}`;
  return name ? `${name}, ${n.who(r.of)}'s old ${KIND_NAME[r.kind]}` : `${n.who(r.of)}'s ${KIND_NAME[r.kind]}`;
}

/** A leader's name alone ("Aldric"), else what it is ("Your Leader"). */
export function leaderShortName(n: Namer, r: LeaderRef): string {
  return (n.view ? findLeader(n.view.me, r)?.name : undefined) ?? (n.isMe(r.of) ? `Your ${KIND_NAME[r.kind]}` : `${n.who(r.of)}'s ${KIND_NAME[r.kind]}`);
}

/** A military leader's name (the session 12 wording, by whose Leader it was). */
export function generalName(n: Namer, general: PlayerId): string {
  return leaderName(n, { kind: "leader", of: general });
}

const provinceName = (n: Namer, id: string) => n.ctx?.map.provinces.find((p) => p.id === id)?.name ?? id;
const provinceList = (n: Namer, ids: readonly string[]) => (ids.length > 2 ? `${ids.slice(0, 2).map((x) => provinceName(n, x)).join(", ")} and ${ids.length - 2} more` : ids.map((x) => provinceName(n, x)).join(" and "));

/** A command, as you'd give it ("Push toward Old March", "Run the realm"). */
export function instructionName(i: Instruction, n: Namer, kind: LeaderRef["kind"] = "leader"): string {
  switch (i.kind) {
    case "hold":
      return "Hold here";
    case "defend":
      return "territory" in i ? `Defend the border toward ${n.place(i.territory)}` : `Defend the border with ${n.who(i.player)}`;
    case "push":
      return `Push toward ${n.place(i.territory)}`;
    case "raid":
      return `Raid ${n.who(i.player)}`;
    case "expand":
      return `Expand toward ${n.place(i.territory)}`;
    case "front":
      return `Command the front in ${provinceList(n, i.provinces)}`;
    case "military":
      return "Run the military";
    case "cleanup":
      return "Clean up";
    case "pushBack":
      return `Push back ${n.who(i.player)}`;
    case "report":
      return `Report to ${leaderShortName(n, { kind, of: i.to })}`;
    case "buildUp":
      return `Build up ${provinceName(n, i.province)}`;
    case "fortify":
      return i.player ? `Fortify the frontier with ${n.who(i.player)}` : "Fortify the frontier";
    case "culture":
      return `Raise culture in ${provinceName(n, i.province)}`;
    case "economy":
      return "Grow the economy";
    case "realm":
      return "Run the realm";
  }
}

/**
 * A leader's reason for this turn, in a plain line (session 20): "Finishing them off: Lady Morwen (3 territories left)",
 * "Going for Pinemark and Fernhollow; Baron Krell's main army at Galeholt (40) is too big for now", "Saving 14 gold for
 * a barracks at Galeholt (nowhere to recruit)".
 */
export function leaderNoteLine(note: LeaderNote, n: Namer): string {
  switch (note.kind) {
    case "finishing":
      return `Finishing them off: ${note.rivals.map((r) => `${n.who(r.rival)} (${r.land} ${r.land === 1 ? "territory" : "territories"} left)`).join(", ")}`;
    case "pushBack": {
      const going = note.going.length ? `Going for ${note.going.map((t) => n.place(t)).join(" and ")}` : `Looking for ${n.who(note.rival)}'s weak land`;
      if (note.striking) return `${going}, ${n.who(note.rival)}'s main army among it`;
      return note.avoiding ? `${going}; ${n.who(note.rival)}'s main army at ${n.place(note.avoiding.at)} (${note.avoiding.troops}) is too big for now` : going;
    }
    case "saving":
      return `Saving ${note.gold} gold: nowhere to recruit until ${note.at ? `the barracks at ${n.place(note.at)}` : "a barracks"} is up`;
  }
}

/** What a leader is doing ("Holding Galeholt", "Expanding toward Old March", "Running the realm"). */
export function instructionDoing(i: Instruction, n: Namer, at: string | null, kind: LeaderRef["kind"] = "leader"): string {
  switch (i.kind) {
    case "hold":
      return at ? `Holding ${n.place(at)}` : "Holding its ground";
    case "defend":
      return "territory" in i ? `Defending the border toward ${n.place(i.territory)}` : `Defending the border with ${n.who(i.player)}`;
    case "push":
      return `Pushing toward ${n.place(i.territory)}`;
    case "raid":
      return `Raiding ${n.who(i.player)}`;
    case "expand":
      return `Expanding toward ${n.place(i.territory)}`;
    case "front":
      return `Commanding the front in ${provinceList(n, i.provinces)}`;
    case "military":
      return "Running the military";
    case "cleanup":
      return "Cleaning up";
    case "pushBack":
      return `Pushing back ${n.who(i.player)}`;
    case "report":
      return `Reports to ${leaderShortName(n, { kind, of: i.to })}`;
    case "buildUp":
      return `Building up ${provinceName(n, i.province)}`;
    case "fortify":
      return i.player ? `Fortifying the frontier with ${n.who(i.player)}` : "Fortifying the frontier";
    case "culture":
      return `Raising culture in ${provinceName(n, i.province)}`;
    case "economy":
      return "Growing the economy";
    case "realm":
      return "Running the realm";
  }
}

/** A budget in words: "20% of income", "8 gold a turn", "no budget". */
export function budgetLabel(b: Budget): string {
  if ("share" in b) return b.share > 0 ? `${Math.round(b.share * 100)}% of income` : "no budget";
  return b.gold > 0 ? `${b.gold} gold a turn` : "no budget";
}

/** Where a leader stands now and its command, from your view (null if it isn't yours). */
export function leaderStatus(view: PlayerView, r: LeaderRef): { at: string | null; instruction: Instruction | null } | null {
  const l = findLeader(view.me, r);
  return l ? { at: leaderAt(view.me, r), instruction: l.command } : null;
}

/** Where a military leader stands now and its command (session 12's name for it). */
export function generalStatus(view: PlayerView, general: PlayerId): { at: string | null; instruction: Instruction | null } | null {
  return leaderStatus(view, { kind: "leader", of: general });
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
/** One line per map in the lobby: who it suits and what it plays like (session 19). */
export const MAP_SUITS: Record<string, string> = {
  embervale: "The quick map, for 4–6: close quarters, so hold your capital early.",
  greatmarch: "A crowded continent for 8–10: many neighbours, long wars.",
  "shattered-isles": "Islands for 4–6: every crossing is by sea, so choke points decide the game.",
  "twin-realms": "Two continents for 4–8, joined by one land bridge: a natural front line.",
  "moon-coast": "A crescent for 4–8: short fronts, long marches, lots of comebacks.",
  ringsea: "A ring of land round an inland sea, for 6–10; the island in the middle reaches every shore.",
  crownlands: "A crown for 6–10: five peninsula points, each a natural stronghold.",
  wyrmland: "The dragon, for 6–8: a long neck and tail mean long marches.",
  ashwing: "A phoenix for 6–8: wide wings to grow in, and a narrow neck worth holding.",
  "sundered-crowns": "Two great continents for 6–8, joined only by islets and sea lanes: big battles at the crossing.",
  krakenmere: "One of the two biggest maps, for 8–10: a kraken's six arms, each a long peninsula with a choke where it joins.",
  rootholm: "One of the two biggest maps, for 8–10: a tree of life with a broad crown, one trunk to fight over, and roots far below.",
};

export function mapChoiceLabel(m: { name: string; territories: number; recommendedPlayers: { min: number; max: number } }): string {
  return `${m.name} · ${m.territories} territories · suits ${m.recommendedPlayers.min}–${m.recommendedPlayers.max} players`;
}
