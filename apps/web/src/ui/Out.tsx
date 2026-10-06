import type { GameContext, PlayerView } from "@conquerra/engine";
import { useGame } from "../store";
import { FallenPanel } from "./Fallen";
import { Frame } from "./Frame";
import { ReportBody } from "./TurnReport";

/**
 * The screens for once you're knocked out (loaded only then): the choice, then the Fallen's panel (or, with the
 * Fallen off, watching the bots play on).
 */

/** Shown once when you're knocked out while the game goes on. */
export function KnockedOutChoice({ view }: { view: PlayerView }) {
  const { watch, seeResult, busy } = useGame();
  const me = view.players.find((p) => p.id === view.me.id)!;
  const by = me.eliminatedBy ? view.players.find((p) => p.id === me.eliminatedBy)?.name : null;
  // One of the Fallen: you keep playing, with Influence.
  const fallen = view.settings.fallen && view.settings.fog;
  if (fallen)
    return (
      <div className="overlay">
        <Frame className="dialog" role="dialog" label="You are one of the Fallen" title="You are one of the Fallen">
          <p>Spend Influence to shake the living.</p>
          <p className="muted small">
            {by ? `${by} took your last territory` : "You lost your last territory"} on turn {me.eliminatedTurn}. You see who holds what, but not their armies. You earn Influence every turn (more the more Fallen there are) and spend it on plagues, storms, uprisings, mercenaries and famines.
          </p>
          <div className="choice">
            <button className="primary wide" onClick={watch} disabled={busy} autoFocus>
              Watch to the end
            </button>
            <button className="wide" onClick={seeResult} disabled={busy}>
              {busy ? "The others are finishing the game…" : "Leave the game"}
            </button>
            <p className="muted small">Leaving: the others play on, and you see who won.</p>
          </div>
        </Frame>
      </div>
    );
  return (
    <div className="overlay">
      <Frame className="dialog" role="dialog" label="You have been knocked out" title="You've been knocked out">
        <p>
          {by ? `${by} took your last territory` : "You lost your last territory"} on turn {me.eliminatedTurn}. The others fight on.
        </p>
        <div className="choice">
          <button className="primary wide" onClick={watch} disabled={busy} autoFocus>
            Watch to the end
          </button>
          <p className="muted small">See the whole map and each turn's replay. You can skip ahead any time.</p>
          <button className="wide" onClick={seeResult} disabled={busy}>
            {busy ? "The bots are finishing the game…" : "See the result"}
          </button>
        </div>
      </Frame>
    </div>
  );
}

/** While watching after being knocked out: next turn, skip ahead, and the last turn's report. */
function WatchPanel({ ctx, view, replaying }: { ctx: GameContext; view: PlayerView; replaying: boolean }) {
  const { report, watchNext, seeResult, busy } = useGame();
  return (
    <Frame className="watch-panel" title={`Watching · turn ${view.turn}`}>
      <p className="muted small">You're out, so you see the whole map. The bots play on.</p>
      <button className="primary wide" onClick={watchNext} disabled={busy || replaying}>
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

/** While watching: the Fallen's panel, or (with the Fallen off) the plain watch panel. */
export function OutPanel({ ctx, view, replaying }: { ctx: GameContext; view: PlayerView; replaying: boolean }) {
  return view.settings.fallen && view.settings.fog ? <FallenPanel ctx={ctx} view={view} replaying={replaying} /> : <WatchPanel ctx={ctx} view={view} replaying={replaying} />;
}
