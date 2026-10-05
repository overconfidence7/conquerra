import { defaultRules, type MapDef } from "@conquerra/content";
import { explainChecks, fairnessRows, sizeSpread, type CheckRow } from "@conquerra/mapgen";
import type { SimReport } from "@conquerra/simcore";
import { useMemo } from "react";
import type { LabMade } from "./core";

/*
 * The lab's panels. Each takes a finished map (or a finished sim), never a recipe, so the player map builder
 * can show the same panels for a map drawn by hand.
 */

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** `checkMap` in plain words: one line per rule, a tick or a cross, and the numbers. */
export function ChecksPanel({ map, limits }: { map: MapDef; limits: { minChokePoints: number; minSeaLanes?: number } }) {
  const rows: CheckRow[] = useMemo(() => explainChecks(map, defaultRules, limits), [map, limits]);
  const failed = rows.filter((r) => !r.ok).length;
  return (
    <section className="lab-card" data-panel="checks">
      <h3>Checks {failed ? <span className="bad">· {failed} failed</span> : <span className="good">· all pass</span>}</h3>
      <ul className="lab-checks">
        {rows.map((r) => (
          <li key={r.label} className={r.ok ? "ok" : "fail"}>
            <span className="mark">{r.ok ? "✓" : "✗"}</span>
            <span>
              {r.label}
              {r.detail && <small>{r.detail}</small>}
              {r.problems.slice(0, 3).map((p) => (
                <small key={p} className="bad">
                  {p}
                </small>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Capital fairness at every player count: how far apart, and how even the land around each one is. */
export function FairnessTable({ map }: { map: MapDef }) {
  const rows = useMemo(() => fairnessRows(map, defaultRules), [map]);
  return (
    <section className="lab-card" data-panel="fairness">
      <h3>Fair capitals</h3>
      <table className="lab-table">
        <thead>
          <tr>
            <th>Players</th>
            <th title="Borders from each capital to its nearest rival (closest pair – furthest pair)">Apart</th>
            <th title="Gold a turn from the land each capital is nearest to (least – most)">Nearby gold</th>
            <th title="Least ÷ most (fair: 70% or more)">Even</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.players} className={r.fair ? "" : "bad"}>
              <td className="num">{r.players}</td>
              <td className="num">{r.gap.min === r.gap.max ? r.gap.min : `${r.gap.min}–${r.gap.max}`}</td>
              <td className="num">
                {r.income.min}–{r.income.max}
              </td>
              <td className="num">{pct(r.income.ratio)}</td>
              <td>{r.fair ? "✓" : "✗"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="lab-note">Fair: every capital within 1 border as far from its nearest rival as the others, and nearby gold within 30%.</p>
    </section>
  );
}

/** How even the territory sizes are: a small bar chart of sizes as a share of the average. */
export function SizeSpreadPanel({ map }: { map: MapDef }) {
  const s = useMemo(() => sizeSpread(map), [map]);
  if (!s) return null;
  const most = Math.max(...s.bands.map((b) => b.count));
  return (
    <section className="lab-card" data-panel="sizes">
      <h3>Territory sizes</h3>
      <p className="lab-note">
        Smallest {s.min}% of average, biggest {s.max}%.
      </p>
      <div className="lab-bars">
        {s.bands.map((b) => (
          <div key={b.from} className="bar" title={`${b.count} territories`}>
            <span className="num">{b.count}</span>
            <i style={{ height: `${(48 * b.count) / Math.max(1, most)}px` }} />
            <small>{b.to >= 1000 ? `${b.from}%+` : `${b.from}–${b.to}`}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

/** What making the map took: time, the try that passed, and why each earlier try failed. */
export function AttemptsPanel({ made }: { made: LabMade }) {
  return (
    <section className="lab-card" data-panel="attempts">
      <h3>
        {made.map ? `Made in ${(made.ms / 1000).toFixed(1)} s` : `No map in ${(made.ms / 1000).toFixed(1)} s`}
        {made.map && <span className="muted"> · {made.attempt === 1 ? "first try" : `try ${made.attempt}`}</span>}
      </h3>
      {made.error && <p className="bad">{made.error}</p>}
      {made.rejected.length > 0 && (
        <ol className="lab-attempts">
          {made.rejected.map((r, i) => {
            const [seed, ...why] = r.split(": ");
            return (
              <li key={i}>
                <b>{seed}</b> {why.join(": ")}
              </li>
            );
          })}
        </ol>
      )}
      {made.fingerprint && (
        <p className="lab-note">
          Fingerprint <code>{made.fingerprint}</code> (the same recipe makes the same fingerprint everywhere)
        </p>
      )}
    </section>
  );
}

/** "Sim this map": length, seats, runaways and where the fighting happens. */
export function SimResults({ report, ms, crashed }: { report: SimReport; ms: number; crashed: number }) {
  const fair = 1 / report.players;
  return (
    <div className="lab-sim-results" data-panel="sim-results">
      <p>
        <b className="num">{report.games}</b> games at {report.players} players in {(ms / 1000).toFixed(0)} s{crashed ? `, ${crashed} crashed` : ""}.
      </p>
      <table className="lab-table">
        <tbody>
          <tr>
            <th>Game length</th>
            <td>
              <b className="num">{report.turns.avg.toFixed(1)}</b> turns on average (median {report.turns.median}, {report.turns.min}–{report.turns.max})
            </td>
          </tr>
          <tr>
            <th>Within 40 turns</th>
            <td className={report.upTo40 >= 0.5 ? "good" : "bad"}>
              {pct(report.upTo40)} of games · {pct(report.in30to40)} in 30–40
            </td>
          </tr>
          <tr>
            <th>Seat wins</th>
            <td>
              {report.seatWins.map((w, i) => (
                <span key={i} className={Math.abs(w - fair) > fair * 0.5 ? "bad" : ""}>
                  {i ? " / " : ""}
                  {pct(w)}
                </span>
              ))}{" "}
              <span className="muted">(fair {pct(fair)} each{report.draws ? `; draws ${pct(report.draws)}` : ""})</span>
            </td>
          </tr>
          <tr>
            <th>Half the map by turn 10</th>
            <td>{pct(report.runaway.halfMapByTurn10)} of games</td>
          </tr>
          <tr>
            <th>Halfway leader wins</th>
            <td>{pct(report.runaway.halfwayLeaderWins)}</td>
          </tr>
          <tr>
            <th>Comebacks</th>
            <td>{pct(report.runaway.comebacks)} of games past turn 10</td>
          </tr>
          <tr>
            <th>Battles</th>
            <td>
              {report.battles.perGame.toFixed(0)} a game: {pct(report.battles.passShare)} through passes, {pct(report.battles.seaShare)} across sea lanes
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
