import { useEffect, useState } from "react";
import { openOnline, refreshOnline, resignFromList, setOnlineLobby, startOnline } from "../host/onlineActions";
import { NameField } from "./NameField";
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

/** Finished: the game is over, or your seat left it (you resigned, or a Marshal took it after missed turns). */
export const finished = (g: OnlineGameInfo) => g.status === "over" || !!g.left;

/** Session 30: a finished game where you were the only person (bots in every other seat) leaves the list after a day. */
export const SOLO_KEPT_MS = 24 * 3600_000;
const CLEARED_KEY = "conquerra.finishedCleared";

/** The finished games still shown: not cleared on this device, and not a day-old game you played alone with bots. */
export function finishedShown(games: readonly OnlineGameInfo[], now: number, cleared: ReadonlySet<string>): OnlineGameInfo[] {
  return games.filter((g) => finished(g) && !cleared.has(g.id) && !(g.players.every((p) => p.bot || p.you) && now - g.created > SOLO_KEPT_MS));
}

function readCleared(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(CLEARED_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

/** What a game in the list is waiting on: you, someone else, or nobody (it's over). */
export function waitingLine(g: OnlineGameInfo, now: number): { text: string; yours: boolean } {
  if (g.status === "waiting") {
    const line = `Waiting for players, ${g.seated ?? 1} of ${g.seats ?? g.players.length} seated`;
    return { text: g.host ? line : `${line}. The host starts it.`, yours: false };
  }
  const over = g.winner === "you" ? "Over: you won." : g.winner ? `Over: ${g.winner} won.` : "Over.";
  // Session 28: once the game is over, the result first; and the turn you left on, never the game's turn now.
  const on = g.leftTurn ? ` on turn ${g.leftTurn}` : "";
  if (g.left === "resigned") return { text: g.status === "over" ? `${over} You left${on}.` : `You left this game${on}. It goes on without you.`, yours: false };
  if (g.left === "taken") return { text: g.status === "over" ? `${over} A Marshal took your seat${on}.` : "A Marshal took your seat after three missed turns. You can watch.", yours: false };
  if (g.status === "over") return { text: over.slice(0, -1), yours: false };
  const left = timeLeft(g.deadline, now);
  if (g.waitingOn.includes("you")) return { text: `Waiting on you${left ? `, ${left}` : ""}`, yours: true };
  if (g.waitingOn.length) return { text: `Waiting on ${g.waitingOn.join(", ")}${left ? `, ${left}` : ""}`, yours: false };
  return { text: "The turn is being played", yours: false };
}

function GameRow({ g, now, busy }: { g: OnlineGameInfo; now: number; busy: boolean }) {
  const wait = waitingLine(g, now);
  const [leaving, setLeaving] = useState(false);
  // A game under way that you're still playing: "Leave this game" resigns (a Marshal takes your seat).
  const canLeave = g.status === "playing" && !g.left;
  const others = g.players.filter((p) => !p.you).map((p) => p.name);
  return (
    <li className={`online-game ${wait.yours ? "yours" : ""}`}>
      <span className="online-game-text">
        <b>{g.mapName}</b> {g.status !== "waiting" && <span className="muted">· turn {g.turn}</span>}
        {others.length > 0 && <span className="small block muted">with {others.join(", ")}</span>}
        <span className={`small block ${wait.yours ? "gold" : ""}`}>{wait.text}</span>
        {canLeave &&
          (leaving ? (
            <span className="small block">
              A Marshal plays your seat for the rest of the game.{" "}
              <button className="link small" disabled={busy} onClick={() => void resignFromList(g.id)}>
                Resign
              </button>{" "}
              <button className="link small" onClick={() => setLeaving(false)}>
                Keep it
              </button>
            </span>
          ) : (
            <button className="link small" onClick={() => setLeaving(true)}>
              Leave this game
            </button>
          ))}
      </span>
      <button className={wait.yours ? "primary" : ""} disabled={busy} onClick={() => void openOnline(g.id, g.code)}>
        {g.status === "waiting" ? "Open the table" : finished(g) ? "See it" : "Continue"}
      </button>
    </li>
  );
}

export default function OnlineBlock() {
  const { onlineLobby, onlineGames, onlineProblem, busy, error, lobby } = useGame();
  const [tried, setTried] = useState(false);
  const [showFinished, setShowFinished] = useState(false);
  const [cleared, setCleared] = useState(readCleared);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    void refreshOnline();
    // The list's clocks move on while the lobby is open, and the list comes in fresh every half minute.
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    const fresh = setInterval(() => void refreshOnline(), 30_000);
    return () => (clearInterval(tick), clearInterval(fresh));
  }, []);
  const off = onlineProblem?.includes("isn't switched on");
  // Session 33b: a random map's table waits for the lobby's picture, which says which of its tries passed: the room then
  // makes that one try (a big map's six tries could take the room past its time limit).
  const mapReady = useGame((s) => !s.lobby.mapId.startsWith("random:") || (s.randomPreview?.mapId === s.lobby.mapId && !!s.randomPreview.preview));
  const done = onlineGames ? finishedShown(onlineGames, now, cleared) : [];
  // "Clear finished": hides them on this device (they stay on the server for their week).
  const clearFinished = () => {
    const next = new Set([...cleared, ...done.map((g) => g.id)]);
    // (Only ids still in the list are worth keeping.)
    const kept = [...next].filter((id) => onlineGames?.some((g) => g.id === id));
    try {
      localStorage.setItem(CLEARED_KEY, JSON.stringify(kept));
    } catch {
      // Private mode: cleared until the page reloads.
    }
    setCleared(new Set(kept));
    setShowFinished(false);
  };
  return (
    <>
      <div className="online-new">
        <NameField />
        <span className="field-name">New online game</span>
        <span className="muted small">
          The map, opponents, House and rules above, played on the server: close the tab and come back any time, on any device. You get a link to send your friends, and you start the game once
          they've sat down. Empty seats are bots.
        </span>
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
          disabled={busy || off || !mapReady}
          onClick={() => {
            setTried(true);
            void startOnline();
          }}
        >
          {busy && tried ? (lobby.mapId.startsWith("random:") ? "Building the map…" : "Making the table…") : "Make a game link"}
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
        {onlineGames?.filter((g) => !finished(g)).length === 0 && <p className="muted small">None going. Make one above.</p>}
        {!!onlineGames?.filter((g) => !finished(g)).length && (
          <ul className="online-games">
            {onlineGames.filter((g) => !finished(g)).map((g) => (
              <GameRow key={g.id} g={g} now={now} busy={busy} />
            ))}
          </ul>
        )}
        {!!done.length && (
          <div className="online-finished">
            <button className="link small" aria-expanded={showFinished} onClick={() => setShowFinished(!showFinished)}>
              {showFinished ? "▾" : "▸"} Finished ({done.length}, kept for a week)
            </button>
            {showFinished && (
              <>
                <ul className="online-games">
                  {done.map((g) => (
                    <GameRow key={g.id} g={g} now={now} busy={busy} />
                  ))}
                </ul>
                <button className="link small" onClick={clearFinished}>
                  Clear finished
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
