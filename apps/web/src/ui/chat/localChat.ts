import { useEffect } from "react";
import type { ChatLine, TurnReport } from "../../host/protocol";
import { applyChat, resetChat } from "./chatStore";

/**
 * Session 29, Part 4: chat in single player. There's no room: the table chat is the bots' lines to you, which ride with
 * each turn's report (worked out in the game's worker from your own replay, as online), and your council comes from
 * your Chronicle as online. Nothing is written: the bots never read free text, and only you are at the table.
 */

/** The bots' lines in one report, as chat lines (their ids are the turn and the line). */
export function localLines(r: TurnReport): ChatLine[] {
  return (r.table ?? []).map((t, i) => ({ id: r.turn * 100 + i + 1, chat: "table", from: { name: t.name, house: t.house, seat: t.bot, bot: true as const }, text: t.text, at: r.turn, turn: r.turn }));
}

/** Single player: the table chat, from the Chronicle when the game opens, and each turn's lines as they come. */
export function useLocalChat(on: boolean, gameId: string | null, chronicle: readonly TurnReport[]) {
  useEffect(() => {
    if (!on || !gameId) return;
    resetChat(gameId, null);
    applyChat({ chats: [{ id: "table", kind: "table" }], lines: chronicle.flatMap(localLines), canWrite: false });
    // (Only when the game changes: later turns come through the effect below.)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, gameId]);
  const latest = chronicle.at(-1);
  useEffect(() => {
    if (on && latest?.table?.length) applyChat({ chats: [], lines: localLines(latest), canWrite: false });
  }, [on, latest]);
}
