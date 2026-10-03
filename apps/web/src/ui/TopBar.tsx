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
  onSettings(): void;
}

/** Logo · gold (+N per turn) · Turn N and the timer · settings. */
export function TopBar({ view, gold, goldAfter, income, clock, replaying, onSettings }: Props) {
  const emblem = useArtUrl("emblem");
  const coin = useArtUrl("icon-gold");
  return (
    <Frame className="topbar">
      {emblem && <img className="emblem" src={emblem} alt="" />}
      <span className="brand">Conquerra</span>
      <span className="stat" title="Gold now, after your queued orders, and what you'll earn this turn">
        {coin && <img src={coin} alt="Gold" />}
        {gold}
        {goldAfter !== gold && <span className="after">→{goldAfter}</span>}
        <span className="plus">+{income}</span>
      </span>
      <span className="spacer" />
      <span className="turn">
        {replaying ? "Replay" : `Turn ${view.turn}`}
        {view.settings.turnLimit ? <span className="muted">/{view.settings.turnLimit}</span> : null}
        <TimerPill clock={clock} paused={replaying} />
      </span>
      <span className="spacer" />
      <button className="icon-btn" onClick={onSettings} aria-label="Settings">
        <Icon.gear />
      </button>
    </Frame>
  );
}
