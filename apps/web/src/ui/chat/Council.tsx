import { councilLine, type LeaderVoice } from "@conquerra/content/lines";
import type { PlayerView } from "@conquerra/engine";
import { useEffect, useRef, useState } from "react";
import type { CouncilAsk, TurnReport } from "../../host/protocol";
import { houseOf } from "../../map/houses";
import { useGame } from "../../store";
import { answeredIn, councilItems, saveAnswer, type CouncilItem } from "./councilStore";
import { markCouncilRead } from "./chatStore";

/**
 * Your council (session 29): a chat only you can see. After each turn your leaders' lines pile up here as a
 * conversation (the report and the Chronicle still show them too), your Leader first, each name in its House colour.
 * Now and then one asks you something: you answer by multiple choice, and the choice goes through the Leaders panel's
 * own path (it shows there as your change). Unanswered by lock-in, it lapses.
 */
export const COUNCIL_CHAT = {
  name: "Your council",
  empty: "Your leaders haven't said anything yet. They will.",
  you: "You",
  lapsed: "No answer.",
} as const;

const colourOf = (view: PlayerView, leaderKey: string) => houseOf(view, leaderKey.split(":")[1] ?? null).color;

function Asked({ ask, report, live }: { ask: CouncilAsk; report: TurnReport; live: boolean }) {
  const g = useGame();
  const [, redraw] = useState(0);
  const game = g.view?.gameId;
  const pick = answeredIn(game, ask.id);
  const answer = (i: number) => {
    const ch = ask.choices[i]!;
    if (ch.instruct !== undefined) void g.setInstruction(ask.leader, ch.instruct);
    if (ch.budget) void g.setBudget(ask.leader, ch.budget);
    saveAnswer(game, ask.id, i);
    redraw((n) => n + 1);
  };
  const voice: LeaderVoice = ask.style ?? "neutral";
  if (pick !== null)
    return (
      <>
        <div className="chat-line you">
          <div className="chat-who">
            <b>{COUNCIL_CHAT.you}</b>
          </div>
          <div className="chat-text">{ask.choices[pick]?.label}</div>
        </div>
        <div className="chat-line">
          <div className="chat-who">
            <b style={{ color: g.view ? colourOf(g.view, ask.leader) : undefined }}>{ask.name}</b>
          </div>
          <div className="chat-text">{councilLine({ game: g.view?.gameId ?? "", turn: report.turn, who: ask.leader, voice }, "ack", {}, ask.id)}</div>
        </div>
      </>
    );
  if (!live) return <p className="muted small">{COUNCIL_CHAT.lapsed}</p>;
  return (
    <div className="chat-choices" role="group" aria-label={ask.text}>
      {ask.choices.map((c, i) => (
        <button key={i} className="chat-choice" onClick={() => answer(i)}>
          {c.label}
        </button>
      ))}
    </div>
  );
}

export function CouncilChat() {
  const { view, chronicle, ready, report } = useGame();
  const end = useRef<HTMLDivElement>(null);
  const items = view ? councilItems(chronicle, view.gameId, view.me.id) : [];
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
    // (On screen: read.)
    const last = items.at(-1)?.id;
    if (last !== undefined) markCouncilRead(last);
  }, [items.length]);
  if (!view) return null;
  if (!items.length) return <p className="muted small chat-empty">{COUNCIL_CHAT.empty}</p>;
  // A question can be answered while its turn is being planned, until you lock in.
  const locked = ready.includes(view.me.id);
  return (
    <div className="chat-lines council" role="log" aria-live="polite">
      {items.map((it: CouncilItem, i) => {
        const same = i > 0 && items[i - 1]!.leader === it.leader && items[i - 1]!.turn === it.turn;
        const r = chronicle.find((x) => x.turn === it.turn) ?? report;
        return (
          <div key={it.id} className="chat-line">
            {!same && (
              <div className="chat-who">
                <b style={{ color: colourOf(view, it.leader) }}>{it.name}</b> <span className="muted">turn {it.turn}</span>
              </div>
            )}
            <div className="chat-text">{it.text}</div>
            {it.ask && r && <Asked ask={it.ask} report={r} live={it.turn + 1 === view.turn && !locked && !view.winner} />}
          </div>
        );
      })}
      <div ref={end} />
    </div>
  );
}
