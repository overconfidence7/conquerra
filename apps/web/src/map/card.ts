import { cultureProtection, investCost, type GameContext, type PlayerView, type TerritoryId } from "@conquerra/engine";
import { BUILDING_NAME, SPECIALIST_NAME } from "../logic/text";
import { houseOf } from "./houses";

/**
 * What the hover / tap-and-hold card says about a territory (docs/06-art-direction.md). Pure, so it's tested
 * without a screen. Uncertain values (last-seen intel) carry a "?".
 */
export interface CardLine {
  label: string;
  value: string;
  /** A House colour to show beside the value (owner). */
  color?: string;
  /** An illustrated icon (art name) to show beside the label. */
  icon?: string;
}

export interface TerritoryCard {
  title: string;
  /** Under the title: "Capital", province, terrain. */
  subtitle: string;
  lines: CardLine[];
  /** "Seen 2 turns ago", "Unexplored", or null when you can see it now. */
  intel: string | null;
  /** True when the details are old or unknown (the card shows them dimmed). */
  uncertain: boolean;
}

const TERRAIN_NAME = { plains: "Plains", forest: "Forest", hills: "Hills", mountains: "Mountains", swamp: "Swamp" } as const;

/** "seen last turn", "seen 3 turns ago". */
export function seenAgo(nowTurn: number, seenTurn: number): string {
  const n = nowTurn - seenTurn;
  if (n <= 0) return "Seen this turn";
  if (n === 1) return "Seen last turn";
  return `Seen ${n} turns ago`;
}

/** "½", "1", "1½": culture's gold, in halves. */
const halves = (x: number) => {
  const whole = Math.floor(x + 1e-9), half = x - whole > 0.25;
  return `${whole || !half ? whole : ""}${half ? "½" : ""}`;
};

/** Your culture in a province (the total that unlocks specialists there), counting `level` for `id` itself. */
function provinceCultureFor(ctx: GameContext, view: PlayerView, id: TerritoryId, level: number, levels?: ReadonlyMap<TerritoryId, number>): number {
  const province = ctx.map.territories.find((t) => t.id === id)!.province;
  let sum = 0;
  for (const t of ctx.map.territories) {
    if (t.province !== province) continue;
    if (t.id === id) sum += level;
    else {
      const v = view.territories[t.id];
      if (v?.detail === "full" && v.owner === view.me.id) sum += levels?.get(t.id) ?? v.culture;
    }
  }
  return sum;
}

/**
 * What culture does on a territory at `level`, one short phrase per effect ("defends +12%", "shrugs off 30% of
 * unrest", "+1 gold", "unlocks Siege in Pinemark"). Unlocks are only worked out for your own land.
 */
export function cultureEffects(ctx: GameContext, view: PlayerView, id: TerritoryId, level: number, levels?: ReadonlyMap<TerritoryId, number>): string[] {
  const r = ctx.rules;
  if (level <= 0) return [];
  const parts = [`defends +${Math.round(100 * level * r.culture.defensePerLevel)}%`, `shrugs off ${Math.round(100 * cultureProtection(r, level))}% of unrest`, `+${halves(level * r.culture.incomePerLevel)} gold`];
  const v = view.territories[id];
  if (v?.detail === "full" && v.owner === view.me.id) {
    const total = provinceCultureFor(ctx, view, id, level, levels);
    const unlocked = SPECIALISTS.filter((s) => r.specialists[s].cultureRequired > 0 && r.specialists[s].cultureRequired <= total).map((s) => SPECIALIST_NAME[s]);
    const province = ctx.map.provinces.find((p) => p.id === ctx.map.territories.find((t) => t.id === id)!.province);
    if (unlocked.length) parts.push(`unlocks ${listed(unlocked)} in ${province?.name ?? "this province"}`);
  }
  return parts;
}

/**
 * The card's culture line: what this territory's culture does, then (on your own land) the province's step on the
 * culture ladder: "Culture 2: defends +12%, shrugs off 30% of unrest, +1 gold. Culture 4 in Pinemark: Rangers. Next:
 * Standard-bearer at 6", or "No culture yet: raising it costs 3 gold. ...".
 */
export function cultureLine(ctx: GameContext, view: PlayerView, id: TerritoryId, level: number, levels?: ReadonlyMap<TerritoryId, number>): string {
  const v = view.territories[id];
  const mine = v?.detail === "full" && v.owner === view.me.id;
  const ladder = mine ? `. ${ladderLine(ctx, view, id, level, levels)}` : "";
  if (level <= 0) {
    const cost = investCost(ctx.rules, 0);
    return (mine && cost !== null ? `No culture yet: raising it costs ${cost} gold` : "No culture yet") + ladder;
  }
  // Culture is lost when land changes hands (session 16): on someone else's land, say so.
  const lost = v?.detail === "full" && !mine && v.owner ? ". Lost if you take it" : "";
  return `Culture ${level}: ${cultureEffects(ctx, view, id, level, levels).slice(0, 3).join(", ")}${lost}${ladder}`;
}

/**
 * The culture ladder (session 15) for your land's province: what its culture has unlocked most recently, and the next
 * step. "Culture 4 in Pinemark: Rangers. Next: Standard-bearer at 6"; at the top: "Culture 6 in Pinemark: Standard-
 * bearer, the top of the ladder".
 */
export function ladderLine(ctx: GameContext, view: PlayerView, id: TerritoryId, level: number, levels?: ReadonlyMap<TerritoryId, number>): string {
  const r = ctx.rules.specialists;
  const total = provinceCultureFor(ctx, view, id, level, levels);
  const province = ctx.map.provinces.find((p) => p.id === ctx.map.territories.find((t) => t.id === id)!.province)?.name ?? "this province";
  const steps = [...new Set(SPECIALISTS.map((s) => r[s].cultureRequired))].sort((a, b) => a - b);
  const reached = steps.filter((c) => c <= total).at(-1) ?? 0;
  const next = steps.find((c) => c > total);
  const at = (c: number) => listed(SPECIALISTS.filter((s) => r[s].cultureRequired === c).map((s) => SPECIALIST_NAME[s]));
  return `Culture ${total} in ${province}: ${at(reached)}${next === undefined ? ", the top of the ladder" : `. Next: ${at(next)} at ${next}`}`;
}

/**
 * What raising culture once more here adds (the Culture button and the panel show it before you tap):
 * "Culture 3 for 6 gold: defends +18% (was +12%), shrugs off 45% of unrest, +1½ gold, newly unlocks Healers in Pinemark".
 * Null when it's at the top.
 */
export function cultureNext(ctx: GameContext, view: PlayerView, id: TerritoryId, level: number, levels?: ReadonlyMap<TerritoryId, number>): string | null {
  const cost = investCost(ctx.rules, level);
  if (cost === null) return null;
  const r = ctx.rules;
  const now = cultureEffects(ctx, view, id, level, levels);
  const next = cultureEffects(ctx, view, id, level + 1, levels);
  const was = level > 0 ? ` (was +${Math.round(100 * level * r.culture.defensePerLevel)}%)` : "";
  const parts = [next[0] + was, next[1]!, next[2]!];
  const unlockNow = now[3] ?? "", unlockNext = next[3] ?? "";
  if (unlockNext && unlockNext !== unlockNow) {
    const fresh = unlockNext.replace(/^unlocks /, "").split(" in ")[0]!.split(/, | and /).filter((s) => !unlockNow.includes(s));
    const province = unlockNext.split(" in ").slice(1).join(" in ");
    parts.push(`newly unlocks ${listed(fresh)} in ${province}`);
  }
  return `Culture ${level + 1} for ${cost} gold: ${parts.join(", ")}`;
}

const SPECIALISTS = ["cavalry", "scouts", "siege", "engineers", "healers", "rangers", "standardBearer"] as const;
const listed = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/** One short fact about a place, with its icon: the panel shows these as a row of chips. */
export interface PlaceFact {
  key: "terrain" | "gold" | "province";
  /** An illustrated icon (art name), or null for the terrain (the panel uses its own terrain sign). */
  icon: string | null;
  text: string;
}

/**
 * Where a territory is and what it's worth, in plain words: "Forest, defends ×1.2", "+1 gold a turn",
 * "Pinemark +3 if you hold all 5 · you hold 3".
 */
export function placeFacts(ctx: GameContext, view: PlayerView, id: TerritoryId): PlaceFact[] {
  const def = ctx.map.territories.find((t) => t.id === id)!;
  const province = ctx.map.provinces.find((p) => p.id === def.province);
  const terrain = ctx.rules.terrain[def.terrain];
  const facts: PlaceFact[] = [
    { key: "terrain", icon: null, text: `${TERRAIN_NAME[def.terrain]}, defends ×${terrain.defenseMult}` },
    { key: "gold", icon: "icon-gold", text: `+${terrain.income} gold a turn` },
  ];
  if (province) {
    const members = ctx.map.territories.filter((t) => t.province === province.id);
    const held = members.filter((t) => {
      const v = view.territories[t.id];
      return v?.detail === "full" && v.owner === view.me.id;
    }).length;
    const all = held === members.length;
    facts.push({ key: "province", icon: "icon-crown", text: all ? `${province.name} +${province.bonus}: you hold all ${members.length}` : `${province.name} +${province.bonus} if you hold all ${members.length}${held ? ` · you hold ${held}` : ""}` });
  }
  return facts;
}

export function territoryCard(ctx: GameContext, view: PlayerView, id: TerritoryId): TerritoryCard {
  const def = ctx.map.territories.find((t) => t.id === id)!;
  const province = ctx.map.provinces.find((p) => p.id === def.province);
  const gold = ctx.rules.terrain[def.terrain].income;
  const v = view.territories[id]!;
  const playerName = (owner: string | null) => (owner ? (view.players.find((p) => p.id === owner)?.name ?? "Unknown") : "Nobody (neutral)");
  /** Plain words for who holds it: "Yours", "Held by Lady Morwen", "Neutral land". */
  const heldBy = (owner: string | null) => (owner === view.me.id ? "Yours" : owner ? `Held by ${playerName(owner)}` : "Neutral land");
  const where = `${province?.name ?? ""} · ${TERRAIN_NAME[def.terrain]}`;
  const members = province ? ctx.map.territories.filter((t) => t.province === province.id).length : 0;
  const worth: CardLine = { label: "Gold", icon: "icon-gold", value: `+${gold} gold a turn${province ? ` · ${province.name} +${province.bonus} if you hold all ${members}` : ""}` };
  const troops = (n: number) => `${n} ${n === 1 ? "troop" : "troops"}`;

  if (v.detail === "full") {
    const capital = v.capitalOf ? (v.capitalOf === view.me.id ? "Your capital" : "Capital") : null;
    const building = v.building ? BUILDING_NAME[v.building] : v.construction ? `${BUILDING_NAME[v.construction.building]}, being built (ready next turn)` : "No building";
    const lines: CardLine[] = [
      { label: "Owner", value: heldBy(v.owner), color: houseOf(view, v.owner).color },
      { label: "Troops", icon: "icon-troops", value: troops(v.troops) },
      { label: "Building", value: building, ...(v.building || v.construction ? { icon: `icon-${v.building ?? v.construction!.building}` } : {}) },
      { label: "Culture", icon: "icon-culture", value: cultureLine(ctx, view, id, v.culture) },
      worth,
      { label: "Specialists", value: v.specialists.length ? v.specialists.map((s) => SPECIALIST_NAME[s.type]).join(", ") : "No specialists", ...(v.specialists.length ? { icon: `icon-${v.specialists[0]!.type}` } : {}) },
    ];
    if (v.leaders.length) lines.splice(2, 0, { label: "Leader", icon: "icon-crown", value: v.leaders.map((p) => (p === view.me.id ? "Your Leader is here" : `${playerName(p)}'s Leader is here`)).join(", ") });
    return { title: def.name, subtitle: capital ? `${capital} · ${where}` : where, lines, intel: null, uncertain: false };
  }
  if (v.lastSeen?.political) {
    const s = v.lastSeen;
    return {
      title: def.name,
      subtitle: s.capitalOf ? `Capital · ${where}` : where,
      lines: [{ label: "Owner", value: heldBy(s.owner), color: houseOf(view, s.owner).color }, worth],
      intel: "You're one of the Fallen: you see who holds what, but not their armies.",
      uncertain: false,
    };
  }
  if (v.lastSeen) {
    const s = v.lastSeen;
    return {
      title: def.name,
      subtitle: where,
      lines: [
        { label: "Owner", value: `${heldBy(s.owner)}?`, color: houseOf(view, s.owner).color },
        { label: "Troops", icon: "icon-troops", value: `${troops(s.troops)}?` },
        { label: "Building", value: `${s.building ? BUILDING_NAME[s.building] : "No building"}?`, ...(s.building ? { icon: `icon-${s.building}` } : {}) },
        worth,
      ],
      intel: seenAgo(view.turn, s.turn),
      uncertain: true,
    };
  }
  return { title: def.name, subtitle: where, lines: [worth], intel: "Unexplored", uncertain: true };
}
