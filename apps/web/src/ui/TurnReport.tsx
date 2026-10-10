import type { GameContext, PlayerView } from "@conquerra/engine";
import type { TurnReport as Report } from "../host/protocol";
import { groupReport } from "../logic/report";
import type { LogLine } from "../logic/text";
import { namer } from "../logic/text";
import { useGame } from "../store";
import { Frame } from "./Frame";

function Lines({ lines }: { lines: LogLine[] }) {
  return (
    <ul className="log">
      {lines.map((l, i) => (
        <li key={i} className={`tone-${l.tone}`} style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
          {l.text}
        </li>
      ))}
    </ul>
  );
}

/** The turn report, grouped: your gains and losses, then what you saw, then the fog. */
export function ReportBody({ ctx, view, report }: { ctx: GameContext; view: PlayerView; report: Report }) {
  // Your view while you planned this turn, so a called-off attack can say what you planned for.
  const before = useGame((s) => s.lastBefore);
  const g = groupReport(ctx, report.events, namer(ctx, view, before?.turn === report.turn ? before : null));
  return (
    <>
      <section className="report-group">
        <h3>Your gains and losses</h3>
        {g.yours.length ? <Lines lines={g.yours} /> : <p className="muted small">Nothing happened to you this turn.</p>}
      </section>
      {g.seen.length > 0 && (
        <section className="report-group">
          <h3>What you saw</h3>
          <Lines lines={g.seen} />
        </section>
      )}
      {g.fog.length > 0 && (
        <section className="report-group">
          <h3>What came out of the fog</h3>
          <Lines lines={g.fog} />
        </section>
      )}
    </>
  );
}

export function TurnReportDialog({ ctx, view, report, autoLocked, onClose, onWatchAgain }: { ctx: GameContext; view: PlayerView; report: Report; autoLocked: boolean; onClose(): void; onWatchAgain(): void }) {
  return (
    <div className="overlay" onClick={onClose}>
      <Frame className="dialog" role="dialog" label="Turn report" title={`Turn ${report.turn} report`}>
        <div className="scroll" onClick={(e) => e.stopPropagation()}>
          {autoLocked && <p className="tcard-intel">Time ran out, so your orders were locked in for you.</p>}
          <ReportBody ctx={ctx} view={view} report={report} />
        </div>
        <div className="dialog-actions" onClick={(e) => e.stopPropagation()}>
          <button onClick={onWatchAgain}>Watch again</button>
          <button className="primary" onClick={onClose} autoFocus>
            On to turn {view.turn}
          </button>
        </div>
      </Frame>
    </div>
  );
}
