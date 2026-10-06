import { indexMap } from "./mapIndex";
import { PRESETS } from "./presets";
import type { FizzleCode, FizzleDetail, FizzledOrder, GameContext, GameEvent, PlayerId, PresetId, TerritoryId } from "./types";

/**
 * Plain words for the turn report: why an order didn't happen, and why a defence held.
 * Shared by the game screen, the simulator and `pnpm sim --replay`, so they all say the same thing.
 */

type FizzledEvent = Extract<GameEvent, { type: "fizzled" }>;
type BattleEvent = Extract<GameEvent, { type: "battle" }>;

export interface PlaceNames {
  place(id: TerritoryId): string;
  /** A player's name ("Lady Morwen"); "you" for the reader. Optional: without it, "them". */
  player?(id: PlayerId): string;
}

const troops = (n: number) => `${n} troop${n === 1 ? "" : "s"}`;
const presetName = (id: PresetId) => `"${PRESETS.find((p) => p.id === id)?.name ?? id}"`;
const BUILDING: Record<string, string> = { fort: "fort", market: "market", barracks: "barracks", watchtower: "watchtower" };

/** "attack from Greyrest on Ashfell", "fort at Pinemark", ... */
export function describeFizzledOrder(o: FizzledOrder, n: PlaceNames): string {
  const at = (id: TerritoryId | undefined) => (id ? n.place(id) : "somewhere");
  switch (o.kind) {
    case "move":
      return o.attack ? `attack from ${at(o.from)} on ${at(o.to)}` : `move from ${at(o.from)} to ${at(o.to)}`;
    case "recruit":
      return `recruiting at ${at(o.territory)}`;
    case "hire":
      return `hiring ${o.specialist ?? "a specialist"} at ${at(o.territory)}`;
    case "build":
      return `${BUILDING[o.building] ?? "building"} at ${at(o.territory)}`;
    case "invest":
      return `culture raise at ${at(o.territory)}`;
    case "retreat":
      return `retreat from ${at(o.from)}`;
    case "advance":
      return `push on from ${at(o.from)}`;
    default:
      return "order";
  }
}

export interface ExplainOptions {
  /** The target's army as you saw it while planning, for "(you planned for 1)". */
  plannedTroops?: number;
}

/** Why a failed condition stopped the order. */
function conditionWhy(d: FizzleDetail, o: FizzledOrder, n: PlaceNames, opts: ExplainOptions): string {
  const place = d.territory ? n.place(d.territory) : "there";
  if (d.fogged) return `you couldn't see ${place} when it came up, and conditions can't see through fog`;
  const preset = o.preset;
  const because = (id: PresetId, fallback: string, did = "stopped it") => (preset === id ? `so ${presetName(id)} ${did}` : fallback);
  switch (d.condition) {
    case "odds": {
      const held = d.troops ?? 0;
      let what: string;
      if (opts.plannedTroops !== undefined && opts.plannedTroops < held) what = `by the time it came up, ${place} held ${troops(held)} (you planned for ${opts.plannedTroops})`;
      else if (d.attackers !== undefined) what = `by the time it came up, only ${troops(d.attackers)} of yours could go against ${troops(held)} at ${place}`;
      else what = `by the time it came up, ${place} held ${troops(held)}`;
      return `${what}, ${because("onlyIfStronger", "so it no longer looked likely to win")}`;
    }
    case "enemyNotGrown":
      return `enemy troops next to ${place} grew from ${d.before ?? 0} to ${d.now ?? 0}, ${because("holdIfThreatened", "so it held back", "kept the troops home")}`;
    case "outnumbered":
      return d.negated
        ? `an enemy army of ${troops(d.troops ?? 0)} stood next to your ${d.attackers ?? 0} at ${place}, so ${presetName("retreatIfOutnumbered")} pulled them back instead`
        : `no bigger enemy army stood next to your ${troops(d.attackers ?? 0)} at ${place}, so they stayed put`;
    case "attackedThisTurn":
      return d.negated ? `${place} was attacked earlier this turn` : `nobody attacked ${place} this turn, ${because("reinforceIfHit", "so the troops stayed home", "kept the troops home")}`;
    case "owns":
      return d.negated ? `your condition wasn't met: you held ${place}` : `your condition wasn't met: you didn't hold ${place}`;
    case "notOwns":
      return d.negated ? `your condition wasn't met: you didn't hold ${place}` : `your condition wasn't met: you held ${place}`;
    case "ownerIs":
      return `your condition wasn't met: ${place} ${d.negated ? "had the owner you named" : "had a different owner"}`;
    case "minTroops":
      return `your condition wasn't met: ${place} had ${troops(d.troops ?? 0)}, ${d.negated ? "at least" : "fewer than"} ${d.need ?? 0}`;
    case "maxTroops":
      return `your condition wasn't met: ${place} had ${troops(d.troops ?? 0)}, ${d.negated ? "no more than" : "more than"} ${d.need ?? 0}`;
    case "goldAtLeast":
      return `your condition wasn't met: you had ${d.gold ?? 0} gold, ${d.negated ? "at least" : "less than"} ${d.need ?? 0}`;
    case "leaderAlive":
      return `your condition wasn't met: your Leader ${d.negated ? "was alive" : "had fallen"}`;
    default:
      return "its condition wasn't met";
  }
}

/** One reason per code. Typed as a full record, so a new code can't be added without its sentence. */
const WHY: Record<FizzleCode, (d: FizzleDetail, o: FizzledOrder, n: PlaceNames, opts: ExplainOptions) => string> = {
  eliminated: () => "you had been knocked out",
  condition: conditionWhy,
  notEnoughGold: (d) => `you had ${d.gold ?? 0} gold left and it costs ${d.cost ?? "more"}`,
  notHeld: (d, _o, n) => `you no longer held ${d.territory ? n.place(d.territory) : "that land"}`,
  recruitSite: (d, _o, n) =>
    `${d.territory ? n.place(d.territory) : "that land"} isn't a recruit site (recruit at your capital, a barracks, or anywhere in a province you hold completely)`,
  hireSite: () => "specialists are hired only at your capital or a barracks",
  badCount: () => "it asked for no troops",
  invalid: () => "the game couldn't make sense of it (the places don't connect, or something in it is unknown)",
  armyFull: (d, _o, n) => `the army at ${d.territory ? n.place(d.territory) : "that place"} already carried as many specialists as it can`,
  noTroopsForSpecialist: (d, _o, n) => `there were no troops at ${d.territory ? n.place(d.territory) : "that place"} for them to travel with`,
  cultureLocked: (d) => `it needs culture ${d.need ?? 0} in the province and you had ${d.have ?? 0}`,
  hasBuilding: (d, _o, n) => `${d.territory ? n.place(d.territory) : "that land"} already has a building`,
  cultureMax: (d, _o, n) => `${d.territory ? n.place(d.territory) : "that land"}'s culture is already at its highest`,
  lostStart: (d, _o, n) => `by the time it came up you no longer held ${d.territory ? n.place(d.territory) : "the land it started from"}`,
  notConnected: () => "those territories aren't next to each other",
  pathBlocked: (d, _o, n) => `you no longer held ${d.territory ? n.place(d.territory) : "the land in between"}, the land in between`,
  needsCavalry: () => "only an army with cavalry can move two territories at once",
  resting: (d, _o, n) => `the troops at ${d.territory ? n.place(d.territory) : "that place"} had fallen back from a failed attack and were resting`,
  garrisonOnly: (d, _o, n) => `only the garrison was left at ${d.territory ? n.place(d.territory) : "that place"} (1 troop always stays)`,
  nowhereToRetreat: (d, _o, n) => `you held no land next to ${d.territory ? n.place(d.territory) : "it"} to fall back to`,
  noTarget: (d, _o, n) => `no neighbour of ${d.territory ? n.place(d.territory) : "it"} looked likely to fall`,
  manualHopFirst: (d, _o, n) => `your own next order from ${d.territory ? n.place(d.territory) : "there"} went instead`,
  storm: (d, _o, n) => `the way across${d.territory ? ` into ${n.place(d.territory)}` : ""} was closed this turn (a storm, a flood or a rockslide)`,
  noSet: () => "you no longer held that set of Spoils cards",
  passage: (d, _o, n) =>
    d.player
      ? `you may pass through ${n.player?.(d.player) ?? "their"} land, but never stop or fight there`
      : `you had no right of passage through ${d.territory ? n.place(d.territory) : "the land on the way"} when it came up (it changed hands, or the deal ended)`,
  pact: (d, _o, n) => `you have a binding pact with ${d.player ? (n.player?.(d.player) ?? "them") : "them"} across that border, and the game holds both sides to it`,
};

/**
 * "Your attack from Greyrest on Ashfell was called off: by the time it came up, Ashfell held 14 troops (you planned
 * for 1), so "Only if still stronger" stopped it."
 */
export function explainFizzle(e: FizzledEvent, n: PlaceNames, opts: ExplainOptions = {}): string {
  const why = (WHY[e.reason] ?? (() => "it couldn't happen"))(e.detail ?? {}, e.order, n, opts);
  const retreated = e.detail?.condition === "outnumbered" && e.detail.negated;
  const backup = e.usedFallback && !retreated ? " Its backup plan ran instead." : "";
  return `Your ${describeFizzledOrder(e.order, n)} was called off: ${why}.${backup}`;
}

/** Fizzles that are just a plan working as intended (no one to reinforce, no need to retreat) read as news, not as bad. */
export function fizzleIsQuiet(e: FizzledEvent): boolean {
  const d = e.detail ?? {};
  return e.reason === "manualHopFirst" || e.usedFallback || (d.condition === "outnumbered" && !d.negated) || (d.condition === "attackedThisTurn" && !d.negated);
}

const TERRAIN_WORD: Record<string, string> = { forest: "forest", hills: "hills", mountains: "mountains", swamp: "swamp" };
const BORDER_WORD: Record<string, string> = { river: "a river to cross", pass: "a mountain pass", sea: "a landing from the sea" };

const listWords = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}` : (xs[0] ?? ""));

/**
 * Why an attack failed, in one line: "They held: hills and a fort." (or "You held: …" when you were the defender).
 * Null if the attack captured.
 */
export function explainHold(ctx: GameContext, e: BattleEvent, defenderIsYou = false): string | null {
  if (e.captured) return null;
  const idx = indexMap(ctx.map);
  const reasons: string[] = [];
  const terrain = idx.byId.get(e.to)?.terrain;
  if (terrain && (ctx.rules.terrain[terrain]?.defenseMult ?? 1) > 1 && TERRAIN_WORD[terrain]) reasons.push(TERRAIN_WORD[terrain]!);
  if (e.defense?.fort) reasons.push("a fort");
  const border = idx.border(e.from, e.to);
  if (border && BORDER_WORD[border]) reasons.push(BORDER_WORD[border]!);
  if (e.defense?.culture) reasons.push(`loyal land (culture ${e.defense.culture})`);
  if (e.defense?.leader) reasons.push(defenderIsYou ? "your Leader" : "their Leader");
  if (e.defenders.specialists.includes("healers")) reasons.push("healers");
  const wasLikely = e.result.expectedDefenderLosses >= e.defenders.troops && e.result.expectedAttackerLosses < e.attackers.troops;
  if (wasLikely) reasons.push("bad luck");
  else if (e.defenders.troops >= e.attackers.troops || !reasons.length) reasons.unshift(`${troops(e.defenders.troops)} against ${e.attackers.troops}`);
  return `${defenderIsYou ? "You" : "They"} held: ${listWords(reasons)}.`;
}
