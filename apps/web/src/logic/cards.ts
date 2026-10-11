import type { BorderType, FateEvent } from "@conquerra/content";
import { indexMap, type GameContext, type Mission, type PlayerView, type ReplayEvent, type SpoilsMark, type SpoilsSet, type TerritoryId } from "@conquerra/engine";
import { BUILDING_NAME, SPECIALIST_NAME, type Namer } from "./text";

/**
 * The words for the two card decks (session 13): Spoils (earned by conquest, turned in as sets) and Fate (one draw a
 * turn: an event somewhere on the map, or a mission for you).
 */

/** "1 troop", "6 troops". */
export const troopWord = (n: number) => `${n} troop${n === 1 ? "" : "s"}`;
/** "1 rebel", "4 rebels". */
export const rebelWord = (n: number) => `${n} rebel${n === 1 ? "" : "s"}`;

export const MARK_NAME: Record<SpoilsMark, string> = { sword: "Sword", tower: "Tower", laurel: "Laurel" };
export const MARK_ICON: Record<SpoilsMark, string> = { sword: "⚔", tower: "♜", laurel: "❦" };
export const SET_NAME: Record<SpoilsSet, string> = { sword: "Three Swords", tower: "Three Towers", laurel: "Three Laurels", mixed: "One of each" };
/** A line of flavour under each set's rule (session 22), never instead of it. */
export const SET_FLAVOUR: Record<SpoilsSet, string> = {
  sword: "Troops and gold, and nobody asks where they came from.",
  tower: "A fort, finished and delivered. The masons have already left.",
  laurel: "Culture by royal decree. The poets are paid in compliments.",
  mixed: "A little of everything, which is why it pays best.",
};

/** What a set gives, with this game's numbers ("8 troops at your capital"). */
export function windfallText(ctx: GameContext, set: SpoilsSet): string {
  const c = ctx.rules.spoils;
  switch (set) {
    case "sword":
      return `${troopWord(c.sword.troops)}, spread over your most threatened territories, and ${c.sword.gold} gold`;
    case "tower":
      return `a finished fort on land you choose, ${troopWord(c.tower.garrison)} there, and ${c.tower.gold} gold`;
    case "laurel":
      return `+${c.laurel.culture} culture on ${c.laurel.territories} territories in a province you choose, and ${c.laurel.gold} gold`;
    case "mixed":
      return `${troopWord(c.mixed.troops)} spread over your front, a finished building of your choice (fort, market, barracks or watchtower) on land you choose, and ${c.mixed.gold} gold`;
  }
}

/** The Spoils rule in a line (the card stack and the sheet; session 16). */
export const SPOILS_RULE = "Collect three: three alike, or one of each (best)";

/** The Fate events' names, as the report and the replay call them. */
export const FATE_NAME: Record<string, string> = {
  harvest: "A bountiful harvest",
  wanderers: "A wandering band",
  pilgrims: "Pilgrims",
  masons: "Master masons",
  hoard: "A hidden hoard",
  veterans: "Veterans return",
  ford: "A flooded ford",
  rockslide: "A rockslide",
  squall: "Squalls at sea",
  fire: "Fire in the works",
  fever: "Camp fever",
  blight: "Blight",
  plague: "Plague",
  uprising: "An uprising",
};
/** One word over the land in the replay. */
export const FATE_LABEL: Record<string, string> = {
  harvest: "Harvest",
  wanderers: "Wanderers",
  pilgrims: "Pilgrims",
  masons: "Masons",
  hoard: "Hoard",
  veterans: "Veterans",
  ford: "Flood",
  rockslide: "Rockslide",
  squall: "Squalls",
  fire: "Fire",
  fever: "Fever",
  blight: "Blight",
  plague: "Plague",
  uprising: "Uprising",
};
export const fateName = (card: string) => FATE_NAME[card] ?? "A twist of fate";
/** Fate names that are plural ("Squalls at sea strike Hollydale", session 24). */
export const FATE_PLURAL: ReadonlySet<string> = new Set(["squall", "veterans"]);
/** "strikes" or "strike", agreeing with the card's name. */
export const fateStrikes = (card: string) => (FATE_PLURAL.has(card) ? "strike" : "strikes");

const CROSSING: Record<BorderType, string> = { normal: "border", river: "river crossing", pass: "pass", sea: "sea lane" };

type FateEv = Extract<ReplayEvent, { type: "fate" }>;

/** One plain line for a Fate event you could see: what happened, where, and to whom. */
export function fateLine(ctx: GameContext, e: FateEv, n: Namer): string {
  const def = ctx.rules.fate.events.find((x) => x.id === e.card) as FateEvent | undefined;
  const name = fateName(e.card);
  const where = n.place(e.at);
  const holder = e.holder === null ? "neutral" : n.isMe(e.holder) ? "you" : n.who(e.holder);
  const drew = n.isMe(e.drawer) ? "Your Fate card: " : "Fate: ";
  if (e.shrugged) {
    const culture = e.land[0]?.culture;
    return `${drew}${name} threatened ${where}, but its loyal people${culture ? ` (culture ${culture})` : ""} saw it off.`;
  }
  const n2 = (k: number, w: string) => `${k} ${w}${k === 1 ? "" : "s"}`;
  switch (def?.effect) {
    case "gold":
      return (e.gold ?? 0) >= 0
        ? `${drew}${name} in ${where}: ${holder === "you" ? "you gain" : `${holder} gains`} ${e.gold} gold.`
        : `${drew}${name} in ${where}: ${holder === "you" ? "you lose" : `${holder} loses`} ${-(e.gold ?? 0)} gold.`;
    case "troops":
      return e.holder === null
        ? `${drew}${name} of ${e.troops} settles in ${where} (neutral land: harder to take now).`
        : `${drew}${name} of ${e.troops} joins ${holder === "you" ? "you" : holder} in ${where}.`;
    case "culture":
      return `${drew}${name} settle in ${where}: its culture rises to ${e.culture}.`;
    case "finishBuilding":
      return `${drew}${name} finish the ${e.building ? BUILDING_NAME[e.building].toLowerCase() : "building"} at ${where} at once.`;
    case "burnBuilding":
      return `${drew}${name}: the ${e.building ? BUILDING_NAME[e.building].toLowerCase() : "building"} going up at ${where} burns down.`;
    case "sickness":
    case "plague":
      return `${drew}${name} at ${where}: ${n2(-(e.troops ?? 0), "troop")} ${holder === "you" ? "of yours " : ""}died.`;
    case "closeBorder": {
      const [a, b] = e.border ?? [e.at, e.at];
      return `${drew}${name}: the ${CROSSING[def.border]} between ${n.place(a)} and ${n.place(b)} is closed all of turn ${e.until}.`;
    }
    case "uprising":
      return e.flipped
        ? `${drew}${name} in ${where}: ${rebelWord(e.rebels ?? 0)} threw ${holder === "you" ? "you" : holder} out and hold it now.`
        : `${drew}${name} in ${where}, but its ${rebelWord(e.rebels ?? 0)} couldn't take it.`;
    default:
      return `${drew}${name} in ${where}.`;
  }
}

/** Is this Fate event good or bad for you? (Good news for you, bad news for you, or someone else's.) */
export function fateTone(e: FateEv, n: Namer): "good" | "bad" | "info" {
  if (!n.isMe(e.holder) || e.shrugged) return e.shrugged && n.isMe(e.holder) ? "good" : "info";
  return e.tone === "good" ? "good" : "bad";
}

/** What a mission pays, in a few words ("+8 gold", "a free Siege"). */
export function rewardText(m: Mission): string {
  const r = m.reward;
  const parts: string[] = [];
  if (r.gold) parts.push(`+${r.gold} gold`);
  if (r.troops) parts.push(`+${troopWord(r.troops)} ${m.territory && (m.kind === "fort" || m.kind === "hold") ? "there" : "at your capital"}`);
  if (r.culture) parts.push(`+${r.culture} culture ${m.territory || m.province ? "there" : "at your capital"}`);
  if (r.specialist) parts.push(`a free ${SPECIALIST_NAME[r.specialist]}`);
  return parts.join(", ");
}

const BORDER_PHRASE: Record<string, string> = { river: "a river", pass: "a mountain pass", sea: "a sea lane" };

/** The goal, in plain words ("Take any territory in Old March by turn 7"). */
export function missionGoal(ctx: GameContext, m: Mission, n: Namer): string {
  const prov = (id?: string) => ctx.map.provinces.find((p) => p.id === id)?.name ?? "that province";
  const by = `by the end of turn ${m.deadline}`;
  switch (m.kind) {
    case "takeIn":
      return `Take any territory in ${prov(m.province)} ${by}`;
    case "takeFrom":
      return `Take a territory from ${m.rival ? n.who(m.rival) : "a rival"} ${by}`;
    case "spree":
      return `Take ${m.need} territories ${by}${m.progress ? ` (${m.progress} so far)` : ""}`;
    case "cross":
      return `Win a battle across ${BORDER_PHRASE[m.border ?? "river"]} ${by}`;
    case "hold":
      return `Hold ${m.territory ? n.place(m.territory) : "your land"} through turn ${m.deadline}`;
    case "noLoss":
      return `Lose no land through turn ${m.deadline}`;
    case "whole":
      return `Hold all of ${prov(m.province)} ${by}`;
    case "fort":
      return `Build a fort at ${m.territory ? n.place(m.territory) : "your land"} ${by}`;
    case "culture":
      return `Raise culture anywhere in ${prov(m.province)} ${by}`;
  }
}

/** "Take any territory in Old March by the end of turn 7: +8 gold". */
export const missionLine = (ctx: GameContext, m: Mission, n: Namer) => `${missionGoal(ctx, m, n)}: ${rewardText(m)}`;

/** Turns left (0 = this is the last turn). */
export const turnsLeft = (m: Mission, turn: number) => Math.max(0, m.deadline - turn);

/**
 * The land a mission is about, lit up on the map when you tap it: its territory; the province to take or complete; a
 * rival's land next to yours; or your land on the right kind of crossing (and the land across it).
 */
export function missionTargets(ctx: GameContext, view: PlayerView, m: Mission): TerritoryId[] {
  const idx = indexMap(ctx.map);
  const mine = (t: TerritoryId) => {
    const v = view.territories[t];
    return v?.detail === "full" && v.owner === view.me.id;
  };
  const owner = (t: TerritoryId) => {
    const v = view.territories[t];
    return v?.detail === "full" ? v.owner : (v?.lastSeen?.owner ?? null);
  };
  if (m.territory && m.kind !== "culture") return [m.territory];
  switch (m.kind) {
    case "takeIn":
    case "whole":
      return (idx.provinceMembers.get(m.province ?? "") ?? []).filter((t) => !mine(t));
    case "culture":
      return (idx.provinceMembers.get(m.province ?? "") ?? []).filter(mine);
    case "takeFrom":
      return idx.ids.filter((t) => owner(t) === m.rival && (idx.neighbors.get(t) ?? []).some(mine));
    case "cross": {
      const out = new Set<TerritoryId>();
      for (const t of idx.ids.filter(mine))
        for (const n of idx.neighbors.get(t) ?? []) if (idx.border(t, n) === m.border && !mine(n)) (out.add(t), out.add(n));
      return [...out];
    }
    case "spree":
      return idx.ids.filter((t) => !mine(t) && (idx.neighbors.get(t) ?? []).some(mine));
    case "noLoss":
    default:
      return idx.ids.filter((t) => mine(t) && (idx.neighbors.get(t) ?? []).some((n) => !mine(n)));
  }
}

/** Is the way from `a` to `b` closed this turn (a flooded ford, a rockslide)? */
export const closedNow = (view: PlayerView, a: TerritoryId, b: TerritoryId) => view.closures.some((c) => c.turn === view.turn && ((c.a === a && c.b === b) || (c.a === b && c.b === a)));
