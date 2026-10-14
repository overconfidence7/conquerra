import { useEffect, useState } from "react";
import { openOnline, refreshOnline, setOnlineLobby, startOnline } from "../host/onlineActions";
import type { OnlineGameInfo } from "../host/protocol";
import { ONLINE_TIMER_CHOICES, timerLabel } from "../logic/timer";
import { useGame } from "../store";
import "./online.css";

/**
 * The lobby's Online block (session 26), inside its fold: a new online game (the map, opponents, House and rules
 * above, with an online timer and the missed-turn choice), and your online games with Continue. Loaded with the
 * fold, after the lobby is on screen (with the online host), never in the start-up bundle.
 */

/** "4 min left", "2 h 14 min left", "time's up". */
export function timeLeft(deadline: number | null, now: number): string {
  if (deadline === null) return "";
  const s = Math.round((deadline - now) / 1000);
  if (s <= 0) return "time's up";
  if (s < 60) return "under a minute left";
  const m = Math.ceil(s / 60);
  return m < 60 ? `${m} min left` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""} left`;
}

/** What a game in the list is waiting on: you, someone else, or nobody (it's over). */
export function waitingLine(g: OnlineGameInfo, now: number): { text: string; yours: boolean } {
  if (g.status === "over") return { text: g.winner === "you" ? "Over: you won" : g.winner ? `Over: ${g.winner} won` : "Over", yours: false };
  const left = timeLeft(g.deadline, now);
  if (g.waitingOn.includes("you")) return { text: `Waiting on you${left ? `, ${left}` : ""}`, yours: true };
  if (g.waitingOn.length) return { text: `Waiting on ${g.waitingOn.join(", ")}${left ? `, ${left}` : ""}`, yours: false };
  return { text: "The turn is being played", yours: false };
}

function GameRow({ g, now, busy }: { g: OnlineGameInfo; now: number; busy: boolean }) {
  const wait = waitingLine(g, now);
  const others = g.players.filter((p) => !p.you).map((p) => p.name);
  return (
    <li className={`online-game ${wait.yours ? "yours" : ""}`}>
      <span className="online-game-text">
        <b>{g.mapName}</b> <span className="muted">· turn {g.turn}</span>
        <span className="small block muted">with {others.join(", ")}</span>
        <span className={`small block ${wait.yours ? "gold" : ""}`}>{wait.text}</span>
      </span>
      <button className={wait.yours ? "primary" : ""} disabled={busy} onClick={() => void openOnline(g.id)}>
        {g.status === "over" ? "See it" : "Continue"}
      </button>
    </li>
  );
}

export default function OnlineBlock() {
  const { onlineLobby, onlineGames, onlineProblem, busy, error } = useGame();
  const [tried, setTried] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    void refreshOnline();
    // The list's clocks move on while the lobby is open, and the list comes in fresh every half minute.
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    const fresh = setInterval(() => void refreshOnline(), 30_000);
    return () => (clearInterval(tick), clearInterval(fresh));
  }, []);
  const off = onlineProblem?.includes("isn't switched on");
  return (
    <>
      <div className="online-new">
        <span className="field-name">New online game</span>
        <span className="muted small">The map, opponents, House and rules above, played on the server: close the tab and come back any time, on any device.</span>
        <div>
          <label className="online-timer">
            <span className="field-name">Turn timer</span>
            <select value={onlineLobby.turnSeconds} onChange={(e) => setOnlineLobby({ turnSeconds: Number(e.target.value) })}>
              {ONLINE_TIMER_CHOICES.map((t) => (
                <option key={t} value={t}>
                  {timerLabel(t)}
                  {t >= 3600 ? " (a long game)" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="check small">
          <input type="checkbox" checked={onlineLobby.leadersRun} onChange={(e) => setOnlineLobby({ leadersRun: e.target.checked })} />
          If I miss a turn with no orders, my leaders run my House
        </label>
        <span className="muted small">
          {onlineLobby.leadersRun
            ? "Miss a turn without giving orders and your Leader and Steward play it for you (the military on 80% of your income, the realm on 20%)."
            : "Miss a turn without giving orders and your House holds still that turn."}{" "}
          A turn ends early once you've locked in.
        </span>
        <button
          className="wide"
          disabled={busy || off}
          onClick={() => {
            setTried(true);
            void startOnline();
          }}
        >
          {busy && tried ? "Starting…" : "Start an online game"}
        </button>
        {tried && error && <p className="warn small">{error}</p>}
      </div>
      <div className="online-list">
        <span className="field-name">Your online games</span>
        {onlineProblem && (
          <p className="warn small">
            {onlineProblem}{" "}
            {!off && (
              <button className="link" onClick={() => void refreshOnline()}>
                Try again
              </button>
            )}
          </p>
        )}
        {onlineGames?.length === 0 && <p className="muted small">None yet. Start one above.</p>}
        {!!onlineGames?.length && (
          <ul className="online-games">
            {onlineGames.map((g) => (
              <GameRow key={g.id} g={g} now={now} busy={busy} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
