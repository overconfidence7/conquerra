import { screenLine } from "@conquerra/content/lines";
import type { PlayerView } from "@conquerra/engine";
import { awardsFor, type Award } from "../logic/awards";
import { houseOf } from "../map/houses";
import { PowerGraph } from "./PowerGraph";
import { personaLine, portraitOf } from "./PlayersPanel";
import { useGame } from "../store";
import { useArtUrl } from "./art";
import { useEffect, useState } from "react";
import { music } from "../sound/music";
import { Frame } from "./Frame";
import "./over.css";
import { MapView, readTactical } from "./MapView";
import { PlayersPanel } from "./PlayersPanel";
import { ReportBody } from "./TurnReport";

/** The awards, each with the winner's portrait and House colour. */
function Awards({ view }: { view: PlayerView }) {
  const awards = awardsFor(view);
  if (!awards.length) return null;
  return (
    <section className="awards">
      <h3>Awards</h3>
      <ul>
        {awards.map((a) => (
          <AwardCard key={a.id} view={view} award={a} />
        ))}
      </ul>
    </section>
  );
}

function AwardCard({ view, award }: { view: PlayerView; award: Award }) {
  const first = award.winners[0]!;
  const seat = Math.max(0, view.players.findIndex((p) => p.id === first));
  const portrait = useArtUrl(portraitOf(seat));
  const names = award.winners.map((p) => (p === view.me.id ? "You" : (view.players.find((x) => x.id === p)?.name ?? p)));
  return (
    <li className={`award ${award.winners.includes(view.me.id) ? "mine" : ""}`} style={{ borderLeftColor: houseOf(view, first).color }}>
      {portrait && <img src={portrait} alt="" />}
      <span>
        <b>{award.title}</b>
        <span className="who">{names.join(" and ")}{award.winners.length > 1 ? " (shared)" : ""}</span>
        <span className="small muted">
          {award.for}: {award.value}.
        </span>
        <span className="small award-remark">{award.remark}</span>
      </span>
    </li>
  );
}

/** A finished online game (session 27): watch any turn again, from your own seat, as you saw it. */
function WatchATurn({ last }: { last: number }) {
  const [turn, setTurn] = useState(last);
  const [busy, setBusy] = useState(false);
  return (
    <div className="watch-turn">
      <label>
        <span className="field-name">Watch a turn again</span>
        <select value={turn} onChange={(e) => setTurn(Number(e.target.value))}>
          {Array.from({ length: last }, (_, i) => last - i).map((n) => (
            <option key={n} value={n}>
              Turn {n}
            </option>
          ))}
        </select>
      </label>
      <button
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void import("../host/onlineActions").then((m) => m.watchTurn(turn)).finally(() => setBusy(false));
        }}
      >
        {busy ? "Getting it…" : "Watch"}
      </button>
    </div>
  );
}

export function GameOver() {
  const { ctx, view, report, fastForwarded, playAgain, seats, fair, online, error } = useGame();
  const emblem = useArtUrl("emblem");
  // Victory or defeat in full (batch 4, session 21), behind the results.
  const keyArt = useArtUrl(view && view.winner === view.me.id ? "art-victory" : "art-defeat");
  // The victory or defeat sting (session 24): what played before fades away under it.
  const won = !!view && view.winner === view.me.id;
  useEffect(() => music.play(won ? "victory" : "defeat", 1500), [won]);
  if (!ctx || !view) return null;
  const me = view.players.find((p) => p.id === view.me.id)!;
  const winner = view.winner;
  // A bot's level and personality are revealed now (session 17): "Lady Morwen wins", then "Marshal, the Turtle".
  const winnerSeat = winner && winner !== "draw" ? seats?.[winner] : undefined;
  const winnerName = winner === "draw" ? null : view.players.find((p) => p.id === winner)?.name;
  const youWon = winner === view.me.id;
  const outBy = me.eliminatedBy ? view.players.find((p) => p.id === me.eliminatedBy)?.name : null;
  return (
    <div className={`over ${keyArt ? "with-art" : ""} ${view.winner === view.me.id ? "won" : "lost"}`} style={keyArt ? ({ "--key-art": `url("${keyArt}")` } as React.CSSProperties) : undefined}>
      {/* Embers drift up over a defeat, petals fall over a victory (session 21). */}
      <div className="over-motes" aria-hidden>
        {Array.from({ length: 18 }, (_, i) => (
          <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${-((i * 1.7) % 9)}s`, animationDuration: `${7 + (i % 5)}s` }} />
        ))}
      </div>
      <Frame>
        <div className="logo">
          {emblem && <img src={emblem} alt="" />}
          <h1 style={winner && winner !== "draw" ? { color: houseOf(view, winner).glow } : undefined}>
            {youWon ? "Victory!" : winner === "draw" ? "A draw" : `${winnerName} wins`}
          </h1>
        </div>
        {winnerSeat && <p className="persona-line">{personaLine(winnerSeat)}</p>}
        <p>
          {screenLine(youWon ? "overWon" : winner === "draw" ? "overDraw" : "overLost", `${view.gameId}|over`, { n: view.turn, winner: winnerName ?? "" })}
          {me.eliminatedTurn !== null && ` You were knocked out on turn ${me.eliminatedTurn}${outBy ? ` by ${outBy}` : ""}.`}
          {fastForwarded > 0 && ` The bots fought on for ${fastForwarded} more turn${fastForwarded === 1 ? "" : "s"}.`}
        </p>
        <button className="primary big" onClick={playAgain}>
          Play again
        </button>
        {/* Online (session 26): provably fair. The seed the dice came from, and the fingerprint shown before turn 1. */}
        {fair?.seed && (
          <p className="muted small fair-line">
            Fair play: the dice came from the seed <code>{fair.seed}</code>. Its SHA-256 fingerprint, <code>{fair.seedHash}</code>, was fixed before turn 1, so nothing was changed along the way.
          </p>
        )}
        {online && <WatchATurn last={view.turn} />}
        {online && error && <p className="warn small">{error}</p>}
        {/* The end of the game (session 16): the power graph and the awards (everything is revealed now). */}
        <PowerGraph view={view} territories={ctx.map.territories.length} />
        <Awards view={view} />
        <PlayersPanel view={view} />
        <div className="over-map">
          <MapView ctx={ctx} view={view} queue={[]} selected={null} draft={null} showTargets={false} onTap={() => {}} tactical={readTactical()} tools />
        </div>
        {report && (
          <details>
            <summary>Your last turn</summary>
            <ReportBody ctx={ctx} view={view} report={report} />
          </details>
        )}
      </Frame>
    </div>
  );
}
