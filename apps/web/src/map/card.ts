import type { GameContext, PlayerView, TerritoryId } from "@conquerra/engine";
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

export function territoryCard(ctx: GameContext, view: PlayerView, id: TerritoryId): TerritoryCard {
  const def = ctx.map.territories.find((t) => t.id === id)!;
  const province = ctx.map.provinces.find((p) => p.id === def.province);
  const gold = ctx.rules.terrain[def.terrain].income;
  const v = view.territories[id]!;
  const playerName = (owner: string | null) => (owner ? (view.players.find((p) => p.id === owner)?.name ?? "Unknown") : "Nobody (neutral)");
  const where = `${province?.name ?? ""} · ${TERRAIN_NAME[def.terrain]}`;
  const worth: CardLine = { label: "Gold", icon: "icon-gold", value: `+${gold} a turn${province ? ` · province +${province.bonus}` : ""}` };

  if (v.detail === "full") {
    const capital = v.capitalOf ? (v.capitalOf === view.me.id ? "Your capital" : "Capital") : null;
    const building = v.building ? BUILDING_NAME[v.building] : v.construction ? `${BUILDING_NAME[v.construction.building]} (being built)` : "None";
    const lines: CardLine[] = [
      { label: "Owner", value: playerName(v.owner), color: houseOf(view, v.owner).color },
      { label: "Troops", icon: "icon-troops", value: String(v.troops) },
      { label: "Building", value: building, ...(v.building || v.construction ? { icon: `icon-${v.building ?? v.construction!.building}` } : {}) },
      { label: "Culture", icon: "icon-culture", value: `${v.culture} of ${ctx.rules.culture.max}` },
      worth,
      { label: "Specialists", value: v.specialists.length ? v.specialists.map((s) => SPECIALIST_NAME[s.type]).join(", ") : "None" },
    ];
    if (v.leaders.length) lines.splice(2, 0, { label: "Leader", icon: "icon-crown", value: v.leaders.map((p) => (p === view.me.id ? "Yours" : playerName(p))).join(", ") });
    return { title: def.name, subtitle: capital ? `${capital} · ${where}` : where, lines, intel: null, uncertain: false };
  }
  if (v.lastSeen) {
    const s = v.lastSeen;
    return {
      title: def.name,
      subtitle: where,
      lines: [
        { label: "Owner", value: `${playerName(s.owner)}?`, color: houseOf(view, s.owner).color },
        { label: "Troops", icon: "icon-troops", value: `${s.troops}?` },
        { label: "Building", value: `${s.building ? BUILDING_NAME[s.building] : "None"}?` },
        worth,
      ],
      intel: seenAgo(view.turn, s.turn),
      uncertain: true,
    };
  }
  return { title: def.name, subtitle: where, lines: [worth], intel: "Unexplored", uncertain: true };
}
