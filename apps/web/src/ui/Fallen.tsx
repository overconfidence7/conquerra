import { WORLD_EVENT_KINDS, type GameContext, type PlayerView, type WorldEventKind } from "@conquerra/engine";
import { describeOrder, namer, WORLD_EVENT_NAME } from "../logic/text";
import { useGame } from "../store";
import { Frame } from "./Frame";
import { ReportBody } from "./TurnReport";

/** What each event does, in one plain line, with this game's numbers. */
export function eventHelp(ctx: GameContext, k: WorldEventKind): string {
  const e = ctx.rules.fallen.events;
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  switch (k) {
    case "plague":
      return `${pct(e.plague.share)} of a player's troops in one province die (never the last one; capitals are spared).`;
    case "storm":
      return "Closes one border for a turn: nobody moves or attacks across it.";
    case "uprising":
      return `${e.uprising.rebels} rebels rise in land held by ${e.uprising.maxTroops} troops or fewer; if they're more, it turns neutral.`;
    case "mercenaries":
      return `${e.mercenaries.troops} neutral troops appear next to a player's land, blocking its way.`;
    case "famine":
      return `A player loses ${pct(e.famine.share)} of this turn's income.`;
  }
}

/** Influence each of the Fallen earns a turn, with this many Fallen. */
export const influencePerTurn = (ctx: GameContext, view: PlayerView) =>
  ctx.rules.fallen.influenceBase + ctx.rules.fallen.influencePerOtherFallen * Math.max(0, view.players.filter((p) => p.eliminatedTurn !== null).length - 1);

/**
 * One of the Fallen, watching: your Influence, the five world events as cards (cost, what it does, when it's ready),
 * the ones you've planned this turn, then Next turn. Pick a card, then tap the land to aim at.
 */
export function FallenPanel({ ctx, view, replaying }: { ctx: GameContext; view: PlayerView; replaying: boolean }) {
  const { report, watchNext, seeResult, busy, fallenOrders, aiming, aimEvent, setPledge, removeFallenOrder } = useGame();
  const n = namer(ctx, view);
  const cfg = ctx.rules.fallen;
  const pledged = fallenOrders.reduce((a, o) => a + (o.kind === "worldEvent" ? o.influence : 0), 0);
  const left = Math.floor(view.me.influence) - pledged;
  return (
    <Frame className="watch-panel fallen-panel" title={`One of the Fallen · turn ${view.turn}`}>
      <div className="influence">
        <b>{Math.floor(view.me.influence)}</b> Influence <span className="muted small">(+{influencePerTurn(ctx, view)} a turn{pledged ? `, ${left} left after this turn's events` : ""})</span>
      </div>
      {aiming ? (
        <p className="arriving">
          {aiming.event === "storm" && aiming.target ? `Now tap the land across the border from ${n.place(aiming.target)}.` : `Tap a living player's land to aim the ${WORLD_EVENT_NAME[aiming.event].toLowerCase()} at.`}{" "}
          <button className="link" onClick={() => aimEvent(null)}>
            Cancel
          </button>
        </p>
      ) : (
        <ul className="event-cards" aria-label="World events">
          {WORLD_EVENT_KINDS.map((k) => {
            const cost = cfg.events[k].cost;
            const rest = view.eventCooldowns[k];
            const ok = !replaying && rest === 0 && left >= cost;
            return (
              <li key={k}>
                <button className="event-card" disabled={!ok} onClick={() => aimEvent(k)} title={eventHelp(ctx, k)}>
                  <span className="event-name">
                    {WORLD_EVENT_NAME[k]} <span className="cost">{cost}</span>
                  </span>
                  <span className="small block">{eventHelp(ctx, k)}</span>
                  <span className="small muted block">{rest > 0 ? `Resting: ready in ${rest} turn${rest === 1 ? "" : "s"}` : left < cost ? `Needs ${cost - left} more Influence` : "Ready"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {fallenOrders.length > 0 && (
        <ol className="fallen-orders">
          {fallenOrders.map((o) =>
            o.kind === "worldEvent" ? (
              <li key={o.id} className="order-line">
                <span className="order-text">{describeOrder(o, n, false)}</span>
                {/* More Influence makes it stronger, up to its limit. */}
                {o.influence < Math.floor(cfg.events[o.event].cost * cfg.maxStrength) && left > 0 && (
                  <button className="chip" onClick={() => setPledge(o.id, Math.min(o.influence + left, Math.floor(cfg.events[o.event].cost * cfg.maxStrength)))}>
                    Stronger
                  </button>
                )}
                <button onClick={() => removeFallenOrder(o.id)} aria-label="Delete">
                  ✕
                </button>
              </li>
            ) : null,
          )}
        </ol>
      )}
      <p className="muted small">One event a turn can land on each player; none touches a capital or knocks anyone out. Other Fallen aiming at the same thing add their Influence to yours.</p>
      <button className="primary wide" onClick={() => void watchNext()} disabled={busy || replaying}>
        {busy ? "Playing…" : "Next turn ▶"}
      </button>
      <button className="wide" onClick={seeResult} disabled={busy}>
        Skip to the end ⏭
      </button>
      {report && !replaying && (
        <div className="watch-report">
          <ReportBody ctx={ctx} view={view} report={report} />
        </div>
      )}
    </Frame>
  );
}
