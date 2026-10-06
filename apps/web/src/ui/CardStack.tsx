import type { GameContext, PlayerView } from "@conquerra/engine";
import { MARK_ICON, MARK_NAME } from "../logic/cards";
import { handFull } from "../logic/spoils";

/**
 * Your Spoils cards as a small fanned stack with their count (on the Leader card; on a phone, by the map buttons).
 * Nothing shows until you hold a card or have a mission. Full hand: it glows red and says so.
 */
export function CardStack({ ctx, view, onOpen, compact = false }: { ctx: GameContext; view: PlayerView; onOpen(): void; compact?: boolean }) {
  const hand = view.me.spoils;
  const missions = view.me.missions.length;
  if (!hand.length && !missions) return null;
  const full = handFull(ctx, view);
  const label = [
    hand.length ? `${hand.length} Spoils card${hand.length === 1 ? "" : "s"}${full ? ", hand full: turn in a set this turn" : ""}` : "",
    missions ? `${missions} mission${missions === 1 ? "" : "s"}` : "",
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <button className={`card-stack ${full ? "full" : ""} ${compact ? "compact" : ""}`} onClick={onOpen} aria-label={label} title={label}>
      {hand.length > 0 && (
        <span className="fan" aria-hidden>
          {hand.slice(-3).map((m, i) => (
            <span key={i} className={`mini-card ${m}`} style={{ transform: `rotate(${(i - (Math.min(3, hand.length) - 1) / 2) * 12}deg)` }} title={MARK_NAME[m]}>
              {MARK_ICON[m]}
            </span>
          ))}
        </span>
      )}
      {!compact && (
        <span className="stack-text">
          {hand.length > 0 && <b>{full ? "Hand full" : `Spoils ${hand.length}`}</b>}
          {missions > 0 && <span className="small">{missions === 1 ? "1 mission" : `${missions} missions`}</span>}
        </span>
      )}
      {compact && <span className="count">{hand.length || `M${missions}`}</span>}
    </button>
  );
}
