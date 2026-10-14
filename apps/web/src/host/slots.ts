import type { SaveSummary } from "@conquerra/engine";

/** The save slots on this device (session 13): the autosave ("auto": Continue) and a few you save to yourself. */
export const SLOTS = ["slot1", "slot2", "slot3"] as const;
export type SlotId = "auto" | (typeof SLOTS)[number];

/** What a slot shows: map, players, turn and when it was saved. */
export interface SlotInfo {
  slot: SlotId;
  savedAt: number;
  summary: SaveSummary;
}
