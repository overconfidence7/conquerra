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
  /**
   * The colour owned land takes on (the House tint, painted in shaders.ts): tuned per House on the art test bench
   * so none muddies the ground.
   */
  land: string;
  /** The pattern's colour, and text on a solid fill of `color`. */
  ink: string;
  pattern: Pattern;
}

/**
 * The ten House tinctures (docs/06-art-direction.md). You choose yours in the lobby (Gules, red, by default since
 * session 16); the bots take the rest in this order.
 * Each also has its own pattern, so colourblind players can tell them apart.
 */
export const HOUSES: readonly House[] = [
  { name: "Azure", color: "#2f6fe0", glow: "#5b9bff", land: "#2f6fe0", ink: "#ffffff", pattern: "plain" },
  { name: "Gules", color: "#d2342b", glow: "#ff5a4a", land: "#d2342b", ink: "#ffffff", pattern: "chevron" },
  { name: "Or", color: "#e2ad1c", glow: "#ffd23f", land: "#e2ad1c", ink: "#2a1d05", pattern: "pale" },
  { name: "Vert", color: "#2e9e4f", glow: "#4fe07a", land: "#2e9e4f", ink: "#ffffff", pattern: "bend" },
  { name: "Purpure", color: "#8e44c9", glow: "#c07bff", land: "#8e44c9", ink: "#ffffff", pattern: "fess" },
  { name: "Tenné", color: "#d9731e", glow: "#ff9a3d", land: "#d9731e", ink: "#ffffff", pattern: "saltire" },
  // Teal replaced Celeste (session 5): clearly apart from Azure and Vert, also for colourblind players.
  { name: "Teal", color: "#1aa6a6", glow: "#4fe3dc", land: "#1aa6a6", ink: "#ffffff", pattern: "cross" },
  { name: "Murrey", color: "#a3325f", glow: "#e0558d", land: "#a3325f", ink: "#ffffff", pattern: "chief" },
  { name: "Argent", color: "#e4e6ec", glow: "#ffffff", land: "#e4e6ec", ink: "#1d2430", pattern: "bordure" },
  { name: "Sable", color: "#2a2b33", glow: "#9aa0b4", land: "#3d404c", ink: "#f2f2f2", pattern: "quarterly" },
];

/** Your House unless you choose another in the lobby: Gules, red (session 16, Nate). */
export const DEFAULT_HOUSE = 1;

/** Each tincture in plain words, for the lobby's House choice. */
export const HOUSE_PLAIN: readonly string[] = ["blue", "red", "gold", "green", "purple", "orange", "teal", "mulberry", "silver", "black"];

/** Unowned land. */
export const NEUTRAL_HOUSE: House = { name: "Neutral", color: "#d8cdb0", glow: "#f3ead2", land: "#d8cdb0", ink: "#2b2418", pattern: "plain" };

/** Which House a player is: the one chosen in the lobby (session 16; older views: their seat in the player list). */
export function houseIndex(view: { players: readonly { id: string; house?: number }[] }, owner: string | null): number {
  if (!owner) return -1;
  const i = view.players.findIndex((p) => p.id === owner);
  return i < 0 ? -1 : (view.players[i]!.house ?? i);
}

export function houseOf(view: { players: readonly { id: string; house?: number }[] }, owner: string | null): House {
  const i = houseIndex(view, owner);
  return i < 0 ? NEUTRAL_HOUSE : HOUSES[i % HOUSES.length]!;
}

/** "#rrggbb" -> 0xrrggbb, for the renderer. */
export const hexNum = (hex: string) => parseInt(hex.slice(1), 16);
