import type { CouncilAsk, TurnReport } from "../../host/protocol";

/**
 * Your council's conversation (session 29), built from your own Chronicle: each turn's leaders' lines (your Leader
 * first, then your Steward, then the leaders you captured), and a question when one was asked. Your answers are kept
 * on this device (the command itself goes into your orders like any change in the Leaders panel).
 */

export interface CouncilItem {
  /** In order: the turn, then the line (the question last). */
  id: number;
  turn: number;
  leader: string;
  name: string;
  text: string;
  ask?: CouncilAsk;
}

/** The council's chat id (it never goes to the room: only you have it). */
export const COUNCIL_ID = "council";

const key = (game: string) => `conquerra.council.${game}`;

function answers(game: string | null | undefined): Record<string, number> {
  if (!game) return {};
  try {
    return JSON.parse(localStorage.getItem(key(game)) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

/** Which choice you picked for a question (null: none yet). */
export function answeredIn(game: string | null | undefined, ask: string): number | null {
  const a = answers(game)[ask];
  return typeof a === "number" ? a : null;
}

export function saveAnswer(game: string | null | undefined, ask: string, pick: number) {
  if (!game) return;
  try {
    localStorage.setItem(key(game), JSON.stringify({ ...answers(game), [ask]: pick }));
  } catch {
    // A private window: the answer still went into your orders; this device just won't remember the words.
  }
}

/** Your Leader first, then your Steward, then the rest (leaders you captured). */
const rank = (leader: string, me: string) => (leader === `leader:${me}` ? 0 : leader === `steward:${me}` ? 1 : 2);

/** The council's lines so far. A line saying a question lapsed is left out if you did answer it (on this device). */
export function councilItems(chronicle: readonly TurnReport[], game: string | null | undefined, me: string): CouncilItem[] {
  const picked = answers(game);
  const out: CouncilItem[] = [];
  for (const r of [...chronicle].sort((a, b) => a.turn - b.turn)) {
    const voices = (r.voices ?? []).map((v, i) => ({ v, i })).filter(({ v }) => !(v.ask && v.ask in picked));
    voices.sort((a, b) => rank(a.v.leader, me) - rank(b.v.leader, me) || a.i - b.i);
    voices.forEach(({ v }, n) => out.push({ id: r.turn * 100 + n, turn: r.turn, leader: v.leader, name: v.name, text: v.text }));
    if (r.ask) out.push({ id: r.turn * 100 + 99, turn: r.turn, leader: r.ask.leader, name: r.ask.name, text: r.ask.text, ask: r.ask });
  }
  return out;
}

/** Lines you haven't read (`read`: the last one you have). */
export const councilUnread = (items: readonly CouncilItem[], read: number) => items.filter((i) => i.id > read).length;
