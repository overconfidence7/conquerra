import type { PlayerView } from "@conquerra/engine";
import { useEffect, useRef, useState } from "react";
import { reducedMotion, useFx } from "../replay/fx/settings";
import { mixer } from "../sound/mixer";
import { Rolling } from "./Rolling";
import { formatClock, opensInMs, remainingMs, timerTone, type TurnClock } from "../logic/timer";
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
  const left = clock ? remainingMs(clock, now) : Infinity;
  // A soft tick in each of the last 10 seconds (session 24).
  const tickSec = !clock || paused || clock.pausedLeft !== undefined || left >= 10_000 || left <= 0 ? null : Math.ceil(left / 1000);
  const ticked = useRef<number | null>(null);
  useEffect(() => {
    if (tickSec !== null && tickSec !== ticked.current) mixer.play("timer-tick", tickSec);
    ticked.current = tickSec;
  }, [tickSec]);
  if (!clock) return <span className="timer none">No timer</span>;
  // The window hasn't opened yet (the replay, then a moment for the report; online, the table's longest replay plus
  // 10 s): no frozen full clock (session 27). During the replay the label beside it says "Replay"; after it, the time
  // until the countdown starts.
  const opensIn = opensInMs(clock, now);
  if (opensIn > 0)
    return paused ? null : (
      <span className="timer waiting" role="timer" aria-label={`The turn starts in ${Math.ceil(opensIn / 1000)} seconds`} data-tone="waiting">
        in {formatClock(opensIn)}
      </span>
    );
  if (clock.pausedLeft !== undefined)
    return (
      <span className="timer paused" role="timer" aria-label={`Paused, ${formatClock(left)} left to give orders`} data-tone="paused" title={`${formatClock(left)} left when you resume`}>
        Paused
      </span>
    );
  const tone = paused ? "calm" : timerTone(left);
  return (
    <span className={`timer ${tone}${!paused && left < 10_000 ? " ember" : ""}`} role="timer" aria-label={`${formatClock(left)} left to give orders`} data-tone={tone}>
      {formatClock(left)}
    </span>
  );
}

interface Props {
  view: PlayerView;
  gold: number;
  goldAfter: number;
  /** Gold in your leaders' purses (session 18): shown smaller, next to your treasury; once their orders this turn are paid for (session 20d). */
  purses?: number;
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
  /** Online (session 28): the chat button, with its unread count. */
  chat?: React.ReactNode;
  /** Online (session 28): shown instead of the countdown while the table is paused ("Paused by Kit, 12:40 left"). */
  pausedLabel?: React.ReactNode;
  /** Online (session 28): a tap on the countdown asks the table for a pause. */
  onClockTap?: (() => void) | null;
  onSettings(): void;
}

/** Logo · gold (+N per turn), or Influence for the Fallen · Turn N, the timer and Pause · settings. */
/**
 * The turn's gold coming in (session 21, docs/09 §4): as the replay ends and the new turn's gold is in, a few coins fly
 * from the map to the counter, which rolls up to the new total. Not with Effects off.
 */
function CoinsIn({ gold, replaying, target }: { gold: number; replaying: boolean; target: React.RefObject<HTMLElement | null> }) {
  const level = useFx((s) => s.level);
  const coinArt = useArtUrl("fx-coin");
  const planning = useRef(gold);
  const [flight, setFlight] = useState<{ key: number; x: number; y: number } | null>(null);
  useEffect(() => {
    if (replaying) return;
    if (gold > planning.current && level !== "off" && !reducedMotion() && target.current) {
      const r = target.current.getBoundingClientRect();
      setFlight({ key: Date.now(), x: r.left + 12, y: r.top + r.height / 2 });
      const t = setTimeout(() => setFlight(null), 1600);
      planning.current = gold;
      return () => clearTimeout(t);
    }
    planning.current = gold;
  }, [gold, replaying, level, target]);
  if (!flight || !coinArt) return null;
  return (
    <span className="coins-in" key={flight.key} aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <img key={i} src={coinArt} alt="" style={{ "--tx": `${flight.x}px`, "--ty": `${flight.y}px`, "--sx": `${44 + i * 3}vw`, "--sy": `${52 + ((i * 7) % 9)}vh`, animationDelay: `${i * 90}ms` } as React.CSSProperties} />
      ))}
    </span>
  );
}

export function TopBar({ view, gold, goldAfter, purses = 0, income, clock, replaying, phone, fallen, onPause, onChronicle, chat, pausedLabel, onClockTap, onSettings }: Props) {
  const emblem = useArtUrl("emblem");
  const coin = useArtUrl("icon-gold");
  const goldRef = useRef<HTMLSpanElement | null>(null);
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
        <span className="stat" ref={goldRef} title="Gold now, after your queued orders, and what you'll earn this turn">
          {coin && <img src={coin} alt="Gold" />}
          <Rolling value={gold} />
          <CoinsIn gold={gold} replaying={!!replaying} target={goldRef} />
          {goldAfter !== gold && <span className="after">→{goldAfter}</span>}
          <span className="plus">+{income}</span>
          {purses > 0 && (
            <span className="purses" title="Gold left in your leaders' purses once their orders this turn are paid for (yours: take it back any time)">
              {purses} in purses
            </span>
          )}
        </span>
      )}
      <span className="spacer" />
      <span className="turn">
        {replaying ? "Replay" : `Turn ${view.turn}`}
        {view.settings.turnLimit ? <span className="muted">/{view.settings.turnLimit}</span> : null}
        {pausedLabel ? (
          pausedLabel
        ) : onClockTap && !replaying && clock ? (
          <button className="clock-tap" onClick={onClockTap} title="Ask the table for a pause" aria-label="Ask the table for a pause">
            <TimerPill clock={clock} paused={replaying} />
          </button>
        ) : (
          <TimerPill clock={clock} paused={replaying} />
        )}
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
      {chat}
      <button className="icon-btn" onClick={onSettings} aria-label="Settings">
        <Icon.gear />
      </button>
    </Frame>
  );
}
