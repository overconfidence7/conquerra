import { useEffect, useState } from "react";
import { create } from "zustand";
import type { PlayerId, PlayerView } from "@conquerra/engine";
import type { PauseView } from "../../host/protocol";
import { formatClock } from "../../logic/timer";
import { useGame } from "../../store";
import { Frame } from "../Frame";

/**
 * Pause by vote on the page (session 28, design §10): the card that asks the table, the card while paused (with
 * Ready), the header's line ("Paused by Kit, 12:40 left") and what the page says when a vote fails or a pause ends.
 * The room decides everything; this shows it. Online only, never in the start-up bundle.
 */

/** What the page says (the voice guide applies). */
export const PAUSE_UI = {
  ask: (left: number) => `Ask the table for a pause: 15 minutes at most, and it starts only if everyone still playing agrees within a minute. You have ${left} left this game.`,
  asks: (who: string) => `${who} asks for a pause, 15 minutes at most. Agree?`,
  waiting: (yes: number, all: number) => `Waiting for the table: ${yes} of ${all} agreed.`,
  notEveryone: "Not everyone agreed.",
  noAnswer: (who: string) => `${who} didn't answer in time.`,
  started: (who: string) => `Paused by ${who}. Orders can still be set. Press Ready when you're set to go on.`,
  endedEarly: "Everyone is ready. The clock is running again.",
  ended: "The pause is over. The clock is running again.",
  header: (who: string, left: string) => `Paused by ${who}, ${left} left`,
  ready: (names: string) => `Ready: ${names}.`,
} as const;

interface PauseState {
  view: PauseView | null;
  /** The confirm card before asking (a tap on the clock, or Settings). */
  asking: boolean;
  act: ((a: "ask" | "yes" | "no" | "ready") => Promise<void>) | null;
}

export const usePause = create<PauseState>(() => ({ view: null, asking: false, act: null }));

const nameIn = (view: PlayerView | null, id: PlayerId) => (view?.me.id === id ? "you" : (view?.players.find((p) => p.id === id)?.name ?? id));
const list = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : (names[0] ?? ""));

/** The room's pause news, as a line for this page (or null: the cards say it). */
export function pauseLine(p: PauseView, view: PlayerView | null): string | null {
  const n = p.news;
  if (!n || !view) return null;
  const me = view.me.id;
  if (n.kind === "failed") {
    // (Only the one who asked is told why; for everyone else the card just goes.)
    const asker = usePause.getState().view?.vote?.by;
    if (asker !== me) return null;
    return n.why === "no" ? PAUSE_UI.notEveryone : PAUSE_UI.noAnswer(list(n.who.map((id) => (id === me ? "You" : nameIn(view, id)))));
  }
  // (A pause starting: its card says so, for everyone.)
  if (n.kind === "ended") return n.early ? PAUSE_UI.endedEarly : PAUSE_UI.ended;
  return null;
}

/** "12:40": what's left of a pause or a vote, ticking. */
function useLeft(endsAt: number | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (endsAt === undefined) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [endsAt]);
  return endsAt === undefined ? "" : formatClock(Math.max(0, endsAt - now));
}

/** The header's line while paused, for everyone: "Paused by Kit, 12:40 left". */
export function PausedLabel() {
  const p = usePause((s) => s.view?.paused);
  const view = useGame((s) => s.view);
  const left = useLeft(p?.endsAt);
  if (!p) return null;
  return (
    <span className="timer paused pause-online" role="timer" data-tone="paused">
      {PAUSE_UI.header(p.by === view?.me.id ? "you" : nameIn(view, p.by), left)}
    </span>
  );
}

/** The cards: ask (confirm), a vote to answer or wait on, and the pause with Ready. */
export function PauseCard({ top }: { top: number }) {
  const { view: p, asking, act } = usePause();
  const view = useGame((s) => s.view);
  const [busy, setBusy] = useState(false);
  const voteLeft = useLeft(p?.vote?.endsAt);
  if (!view || !act) return null;
  const me = view.me.id;
  const run = (a: "ask" | "yes" | "no" | "ready") => {
    setBusy(true);
    void act(a).finally(() => setBusy(false));
  };
  const style = { position: "absolute" as const, zIndex: 41, left: 8, right: 8, top, maxWidth: 520, margin: "0 auto" };
  if (p?.paused) {
    const ready = p.paused.ready.map((id) => (id === me ? "You" : nameIn(view, id)));
    return (
      <Frame className="slim notice pause-card" style={style} role="status">
        <p className="small">{PAUSE_UI.started(p.paused.by === me ? "you" : nameIn(view, p.paused.by))}</p>
        {ready.length > 0 && <p className="small muted">{PAUSE_UI.ready(list(ready))}</p>}
        {!p.paused.ready.includes(me) && (
          <button className="primary" disabled={busy} onClick={() => run("ready")}>
            Ready
          </button>
        )}
      </Frame>
    );
  }
  if (p?.vote) {
    const all = p.vote.yes.length + p.vote.waiting.length;
    if (p.vote.waiting.includes(me))
      return (
        <Frame className="slim notice pause-card" style={style} role="alertdialog" label="A pause vote">
          <p className="small">{PAUSE_UI.asks(nameIn(view, p.vote.by))}</p>
          <div className="dialog-actions">
            <button className="primary" disabled={busy} onClick={() => run("yes")}>
              Agree
            </button>
            <button disabled={busy} onClick={() => run("no")}>
              No
            </button>
            <span className="muted small">{voteLeft}</span>
          </div>
        </Frame>
      );
    if (p.vote.by === me)
      return (
        <Frame className="slim notice pause-card" style={style} role="status">
          <p className="small">{PAUSE_UI.waiting(p.vote.yes.length, all)}</p>
        </Frame>
      );
    return null;
  }
  if (asking)
    return (
      <Frame className="slim notice pause-card" style={style} role="dialog" label="Ask for a pause">
        <p className="small">{PAUSE_UI.ask(p?.left ?? 3)}</p>
        <div className="dialog-actions">
          <button className="primary" disabled={busy || (p?.left ?? 3) <= 0} onClick={() => (usePause.setState({ asking: false }), run("ask"))}>
            Ask for a pause
          </button>
          <button onClick={() => usePause.setState({ asking: false })}>Cancel</button>
        </div>
      </Frame>
    );
  return null;
}
