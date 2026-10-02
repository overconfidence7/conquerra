import { useGame } from "../store";
import { MapView } from "./MapView";
import { TurnLogLines } from "./TurnLog";

export function GameOver() {
  const { ctx, view, report, fastForwarded, playAgain } = useGame();
  if (!ctx || !view) return null;
  const me = view.players.find((p) => p.id === view.me.id)!;
  const winner = view.winner;
  const winnerName = winner === "draw" ? null : view.players.find((p) => p.id === winner)?.name;
  const youWon = winner === view.me.id;
  const outBy = me.eliminatedBy ? view.players.find((p) => p.id === me.eliminatedBy)?.name : null;
  return (
    <div className="over">
      <h1>{youWon ? "Victory!" : winner === "draw" ? "A draw" : `${winnerName} wins`}</h1>
      <p>
        {view.turn} turns played.
        {me.eliminatedTurn !== null && ` You were knocked out on turn ${me.eliminatedTurn}${outBy ? ` by ${outBy}` : ""}.`}
        {fastForwarded > 0 && ` The bots fought on for ${fastForwarded} more turn${fastForwarded === 1 ? "" : "s"}.`}
      </p>
      <button className="primary big" onClick={playAgain}>
        Play again
      </button>
      <div className="over-map">
        <MapView ctx={ctx} view={view} queue={[]} selected={null} draft={null} showTargets={false} onTap={() => {}} />
      </div>
      {report && (
        <details>
          <summary>Your last turn</summary>
          <TurnLogLines ctx={ctx} view={view} report={report} />
        </details>
      )}
    </div>
  );
}
