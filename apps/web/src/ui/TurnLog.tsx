import type { GameContext, PlayerView } from "@conquerra/engine";
import type { TurnReport } from "../host/protocol";
import { namer, narrateTurn } from "../logic/text";

/** Turn report: what you saw happen, as plain text (the animated replay comes in session 3). */
export function TurnLogLines({ ctx, view, report }: { ctx: GameContext; view: PlayerView; report: TurnReport }) {
  const lines = narrateTurn(ctx, report.events, namer(ctx, view));
  return (
    <ul className="log">
      {lines.map((l, i) => (
        <li key={i} className={`tone-${l.tone}`}>
          {l.text}
        </li>
      ))}
    </ul>
  );
}

export function TurnLog({ ctx, view, report, onClose }: { ctx: GameContext; view: PlayerView; report: TurnReport; onClose(): void }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2>What happened on turn {report.turn}</h2>
        <TurnLogLines ctx={ctx} view={view} report={report} />
        <button className="primary wide" onClick={onClose} autoFocus>
          Continue to turn {view.turn}
        </button>
      </div>
    </div>
  );
}
