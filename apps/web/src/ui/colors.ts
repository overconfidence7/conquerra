import type { PlayerView } from "@conquerra/engine";

/** You are always blue; bots get the rest in seat order. */
const PALETTE = ["#3b82f6", "#dc2626", "#d97706", "#16a34a", "#9333ea", "#0d9488"];
export const NEUTRAL = "#d6cfb8";

export function colorOf(view: PlayerView, owner: string | null): string {
  if (!owner) return NEUTRAL;
  const i = view.players.findIndex((p) => p.id === owner);
  return PALETTE[i % PALETTE.length] ?? NEUTRAL;
}
