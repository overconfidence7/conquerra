import { houseOf } from "../map/houses";
import { useGame } from "../store";
import { useArtUrl } from "./art";
import { Frame } from "./Frame";
import { MapView, readTactical } from "./MapView";
import { PlayersPanel } from "./PlayersPanel";
import { ReportBody } from "./TurnReport";

export function GameOver() {
  const { ctx, view, report, fastForwarded, playAgain } = useGame();
  const emblem = useArtUrl("emblem");
  if (!ctx || !view) return null;
  const me = view.players.find((p) => p.id === view.me.id)!;
  const winner = view.winner;
  const winnerName = winner === "draw" ? null : view.players.find((p) => p.id === winner)?.name;
  const youWon = winner === view.me.id;
  const outBy = me.eliminatedBy ? view.players.find((p) => p.id === me.eliminatedBy)?.name : null;
  return (
    <div className="over">
      <Frame>
        <div className="logo">
          {emblem && <img src={emblem} alt="" />}
          <h1 style={winner && winner !== "draw" ? { color: houseOf(view, winner).glow } : undefined}>
            {youWon ? "Victory!" : winner === "draw" ? "A draw" : `${winnerName} wins`}
          </h1>
        </div>
        <p>
          {view.turn} turns played.
          {me.eliminatedTurn !== null && ` You were knocked out on turn ${me.eliminatedTurn}${outBy ? ` by ${outBy}` : ""}.`}
          {fastForwarded > 0 && ` The bots fought on for ${fastForwarded} more turn${fastForwarded === 1 ? "" : "s"}.`}
        </p>
        <button className="primary big" onClick={playAgain}>
          Play again
        </button>
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
