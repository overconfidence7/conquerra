import type { PlayerView } from "@conquerra/engine";
import { houseOf } from "../map/houses";

/** A player's House colour (you are always Azure; the bots take the next tinctures in seat order). */
export function colorOf(view: PlayerView, owner: string | null): string {
  return houseOf(view, owner).color;
}
