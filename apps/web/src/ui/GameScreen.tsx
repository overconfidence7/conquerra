import type { GameContext, PlayerView } from "@conquerra/engine";
import { useMemo } from "react";
import { isMine, planQueue } from "../logic/orders";
import { describeOrder, namer, orderTags } from "../logic/text";
import { knockedOut, useGame } from "../store";
import { colorOf } from "./colors";
import { MapView } from "./MapView";
import { Panel } from "./Panel";
import { TurnLog, TurnLogLines } from "./TurnLog";

function LeaderStatus({ view }: { view: PlayerView }) {
  const { leader, cooldowns } = view.me;
  if (!leader.alive) return <span title="Your Leader comes back at the end of this turn">👑 Fallen</span>;
  const ready = (n: number) => (n === 0 ? "ready" : `${n} turn${n === 1 ? "" : "s"}`);
  return (
    <span title="Seize the Initiative: one order goes first. Lie in Wait: one order goes last.">
      👑 ⚡{ready(cooldowns.seize)} ⏳{ready(cooldowns.lie)}
    </span>
  );
}

/** Shown once when you're knocked out while the game goes on. */
function KnockedOutChoice({ view }: { view: PlayerView }) {
  const { watch, seeResult, busy } = useGame();
  const me = view.players.find((p) => p.id === view.me.id)!;
  const by = me.eliminatedBy ? view.players.find((p) => p.id === me.eliminatedBy)?.name : null;
  return (
    <div className="overlay">
      <div className="dialog" role="dialog" aria-label="You have been knocked out">
        <h2>You've been knocked out</h2>
        <p>
          {by ? `${by} took your last territory` : "You lost your last territory"} on turn {me.eliminatedTurn}. The others fight on.
        </p>
        <div className="choice">
          <button className="primary wide" onClick={watch} disabled={busy} autoFocus>
            Watch to the end
          </button>
          <p className="muted small">See the whole map and each turn's report. You can skip ahead any time.</p>
          <button className="wide" onClick={seeResult} disabled={busy}>
            {busy ? "The bots are finishing the game…" : "See the result"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** While watching after being knocked out: next turn, skip ahead, and the last turn's report. */
function WatchPanel({ ctx, view }: { ctx: GameContext; view: PlayerView }) {
  const { report, watchNext, seeResult, busy } = useGame();
  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Watching · turn {view.turn}</h2>
      </div>
      <p className="muted small">You're out, so you see the whole map. The bots play on.</p>
      <button className="primary wide" onClick={watchNext} disabled={busy}>
        {busy ? "Playing…" : "Next turn ▶"}
      </button>
      <button className="wide" onClick={seeResult} disabled={busy}>
        Skip to the end ⏭
      </button>
      {report && (
        <div className="watch-report">
          <h3>Turn {report.turn}</h3>
          <TurnLogLines ctx={ctx} view={view} report={report} />
        </div>
      )}
    </div>
  );
}

export function GameScreen() {
  const { ctx, view, queue, selected, draft, report, showReport, watching, busy, error, tap, clearSelection, remove, shift, lockIn, setShowReport } = useGame();
  const plan = useMemo(() => (ctx && view ? planQueue(ctx, view, queue) : null), [ctx, view, queue]);
  if (!ctx || !view || !plan) return null;
  const n = namer(ctx, view);
  const out = knockedOut(view);
  const territories = Object.values(view.territories).filter((t) => t.detail === "full" && t.owner === view.me.id).length;

  return (
    <div className="game">
      <header className="topbar">
        <span className="brand">Conquerra</span>
        <span>Turn {view.turn}{view.settings.turnLimit ? ` / ${view.settings.turnLimit}` : ""}</span>
        <span title="Gold now → after your queued orders">
          💰 {view.me.gold}
          {plan.goldLeft !== view.me.gold && <span className="muted"> → {plan.goldLeft}</span>}
        </span>
        <span>🏳 {territories}</span>
        <LeaderStatus view={view} />
        <span className="players">
          {view.players.map((p) => (
            <span key={p.id} className={`dot ${p.eliminatedTurn !== null ? "out" : ""}`} style={{ background: colorOf(view, p.id) }} title={`${p.name}${p.eliminatedTurn !== null ? " (out)" : ""}`} />
          ))}
        </span>
        {report && (
          <button className="link" onClick={() => setShowReport(true)}>
            Last turn
          </button>
        )}
      </header>

      <main className="layout">
        <section className="map-wrap">
          <MapView
            ctx={ctx}
            view={view}
            queue={out ? [] : queue}
            selected={out ? null : selected}
            draft={out ? null : draft}
            showTargets={!out && (plan.free.get(selected ?? "") ?? 0) > 0}
            onTap={out ? () => {} : tap}
            onBackground={clearSelection}
          />
        </section>

        <aside className="side">
          {out ? (
            watching ? (
              <WatchPanel ctx={ctx} view={view} />
            ) : (
              <p className="muted">You're out of the game.</p>
            )
          ) : (
          <>
          <Panel ctx={ctx} view={view} plan={plan} queue={queue} selected={selected} draft={draft} />

          <div className="panel queue">
            <div className="panel-head">
              <h2>Orders ({queue.length})</h2>
              <span className="muted">💰 {plan.goldLeft} left</span>
            </div>
            {queue.length === 0 && <p className="muted small">No orders yet. Orders run in this order, one per player at a time.</p>}
            <ol>
              {queue.map((o, i) => (
                <li key={o.id}>
                  <div className="order-line">
                    <span className="order-n">{i + 1}</span>
                    <span className="order-text">
                      {describeOrder(o, n, o.kind === "move" && !isMine(view, o.to))}
                      {plan.costs[i]! > 0 && <span className="cost"> {plan.costs[i]}g</span>}
                      {orderTags(o).map((t) => (
                        <span key={t} className="tag">
                          {t}
                        </span>
                      ))}
                    </span>
                    <span className="order-tools">
                      <button onClick={() => shift(o.id, -1)} disabled={i === 0} aria-label="move up">
                        ↑
                      </button>
                      <button onClick={() => shift(o.id, 1)} disabled={i === queue.length - 1} aria-label="move down">
                        ↓
                      </button>
                      <button onClick={() => remove(o.id)} aria-label="delete">
                        ✕
                      </button>
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {error && <p className="warn">{error}</p>}
          <button className="primary wide lock" disabled={busy} onClick={lockIn}>
            {busy ? "Resolving…" : queue.length ? `Lock in ${queue.length} order${queue.length === 1 ? "" : "s"}` : "Lock in (no orders)"}
          </button>
          </>
          )}
          {out && error && <p className="warn">{error}</p>}
        </aside>
      </main>

      {showReport && report && <TurnLog ctx={ctx as GameContext} view={view} report={report} onClose={() => setShowReport(false)} />}
      {out && !watching && <KnockedOutChoice view={view} />}
    </div>
  );
}
