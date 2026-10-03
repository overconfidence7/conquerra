import type { PlayerView } from "@conquerra/engine";

/** A heraldic pattern on a House's banner and shield, so Houses differ by more than colour. */
export type Pattern = "plain" | "chevron" | "pale" | "bend" | "fess" | "saltire" | "cross" | "chief" | "bordure" | "quarterly";

export interface House {
  /** The tincture's name. */
  name: string;
  /** Main colour: banners, pills, territory tint. */
  color: string;
  /** Border glow on the map (brighter or lighter where the tincture itself would vanish on the land). */
  glow: string;
  /** The pattern's colour, and text on a solid fill of `color`. */
  ink: string;
  pattern: Pattern;
}

/**
 * The ten House tinctures (docs/06-art-direction.md), in seat order: you are always the first (Azure).
 * Each also has its own pattern, so colourblind players can tell them apart.
 */
export const HOUSES: readonly House[] = [
  { name: "Azure", color: "#2f6fe0", glow: "#5b9bff", ink: "#ffffff", pattern: "plain" },
  { name: "Gules", color: "#d2342b", glow: "#ff5a4a", ink: "#ffffff", pattern: "chevron" },
  { name: "Or", color: "#e2ad1c", glow: "#ffd23f", ink: "#2a1d05", pattern: "pale" },
  { name: "Vert", color: "#2e9e4f", glow: "#4fe07a", ink: "#ffffff", pattern: "bend" },
  { name: "Purpure", color: "#8e44c9", glow: "#c07bff", ink: "#ffffff", pattern: "fess" },
  { name: "Tenné", color: "#d9731e", glow: "#ff9a3d", ink: "#ffffff", pattern: "saltire" },
  // Teal replaced Celeste (session 5): clearly apart from Azure and Vert, also for colourblind players.
  { name: "Teal", color: "#1aa6a6", glow: "#4fe3dc", ink: "#ffffff", pattern: "cross" },
  { name: "Murrey", color: "#a3325f", glow: "#e0558d", ink: "#ffffff", pattern: "chief" },
  { name: "Argent", color: "#e4e6ec", glow: "#ffffff", ink: "#1d2430", pattern: "bordure" },
  { name: "Sable", color: "#2a2b33", glow: "#9aa0b4", ink: "#f2f2f2", pattern: "quarterly" },
];

/** Unowned land. */
export const NEUTRAL_HOUSE: House = { name: "Neutral", color: "#d8cdb0", glow: "#f3ead2", ink: "#2b2418", pattern: "plain" };

/** Which House a player is: their seat in the player list. */
export function houseIndex(view: Pick<PlayerView, "players">, owner: string | null): number {
  if (!owner) return -1;
  return view.players.findIndex((p) => p.id === owner);
}

export function houseOf(view: Pick<PlayerView, "players">, owner: string | null): House {
  const i = houseIndex(view, owner);
  return i < 0 ? NEUTRAL_HOUSE : HOUSES[i % HOUSES.length]!;
}

/** "#rrggbb" -> 0xrrggbb, for the renderer. */
export const hexNum = (hex: string) => parseInt(hex.slice(1), 16);
