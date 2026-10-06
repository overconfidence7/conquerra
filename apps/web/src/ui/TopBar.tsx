import type { PlayerView } from "@conquerra/engine";
import { useEffect, useState } from "react";
import { formatClock, remainingMs, timerTone, type TurnClock } from "../logic/timer";
import { useArtUrl } from "./art";
import { Frame } from "./Frame";
import { Icon } from "./icons";

/** The countdown: calm, gold at one minute, red at fifteen seconds. Counts down to the host's deadline. */
export function TimerPill({ clock, paused }: { clock: TurnClock | null; paused: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!clock) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [clock]);
  if (!clock) return <span className="timer none">No timer</span>;
  const left = remainingMs(clock, now);
  if (clock.pausedLeft !== undefined)
    return (
      <span className="timer paused" role="timer" aria-label={`Paused, ${formatClock(left)} left to give orders`} data-tone="paused" title={`${formatClock(left)} left when you resume`}>
        Paused
      </span>
    );
  const tone = paused ? "calm" : timerTone(left);
  return (
    <span className={`timer ${tone}`} role="timer" aria-label={`${formatClock(left)} left to give orders`} data-tone={tone}>
      {formatClock(left)}
    </span>
  );
}

interface Props {
  view: PlayerView;
  gold: number;
  goldAfter: number;
  income: number;
  clock: TurnClock | null;
  replaying: boolean;
  phone: boolean;
  /** One of the Fallen: Influence (and what you earn a turn) shows instead of gold. */
  fallen?: { influence: number; perTurn: number } | null;
  /** Pause / resume the turn timer (only with a timer running). */
  onPause?: (() => void) | null;
  /** Open the Chronicle (session 16; on a phone it's with the map buttons instead). */
  onChronicle?: (() => void) | null;
  onSettings(): void;
}

/** Logo · gold (+N per turn), or Influence for the Fallen · Turn N, the timer and Pause · settings. */
export function TopBar({ view, gold, goldAfter, income, clock, replaying, phone, fallen, onPause, onChronicle, onSettings }: Props) {
  const emblem = useArtUrl("emblem");
  const coin = useArtUrl("icon-gold");
  const isPaused = clock?.pausedLeft !== undefined;
  return (
    <Frame className="topbar">
      {emblem && <img className="emblem" src={emblem} alt="" />}
      <span className="brand">Conquerra</span>
      {fallen ? (
        <span className="stat influence-stat" title="Your Influence, and what you earn each turn">
          {Math.floor(fallen.influence)} <span className="unit">Influence</span>
          <span className="plus">+{fallen.perTurn}</span>
        </span>
      ) : (
        <span className="stat" title="Gold now, after your queued orders, and what you'll earn this turn">
          {coin && <img src={coin} alt="Gold" />}
          {gold}
          {goldAfter !== gold && <span className="after">→{goldAfter}</span>}
          <span className="plus">+{income}</span>
        </span>
      )}
      <span className="spacer" />
      <span className="turn">
        {replaying ? "Replay" : `Turn ${view.turn}`}
        {view.settings.turnLimit ? <span className="muted">/{view.settings.turnLimit}</span> : null}
        <TimerPill clock={clock} paused={replaying} />
        {onPause && clock && (
          <button className={`icon-btn pause-btn ${isPaused ? "on" : ""}`} onClick={onPause} aria-label={isPaused ? "Resume the timer" : "Pause the timer"} aria-pressed={isPaused} title={isPaused ? "Resume" : "Pause"}>
            {isPaused ? <Icon.play /> : <Icon.pause />}
          </button>
        )}
      </span>
      <span className="spacer" />
      {onChronicle && !phone && (
        <button className="chronicle-btn" onClick={onChronicle} title="Every turn so far: battles, Fate and the Fallen, deals, spies and your leaders">
          <Icon.scroll /> Chronicle
        </button>
      )}
      <button className="icon-btn" onClick={onSettings} aria-label="Settings">
        <Icon.gear />
      </button>
    </Frame>
  );
}
