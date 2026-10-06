import type { GameContext, PlayerView } from "@conquerra/engine";
import { MARK_ICON, MARK_NAME, missionGoal, rewardText, turnsLeft, windfallText } from "../logic/cards";
import { handFull, setChoices } from "../logic/spoils";
import { namer } from "../logic/text";
import { useGame } from "../store";
import { Frame } from "./Frame";

/**
 * Your cards (session 13): the Spoils hand with the sets you can turn in (one tap each), and your open Fate missions
 * with their deadlines (tap one to light up its target on the map). Loaded the first time it's opened.
 */
export default function CardsSheet({ ctx, view, onClose, onShowMission }: { ctx: GameContext; view: PlayerView; onClose(): void; onShowMission(id: string): void }) {
  const { selected, queue, turnInSpoils, remove } = useGame();
  const n = namer(ctx, view);
  const hand = view.me.spoils;
  const choices = setChoices(ctx, view, selected, n);
  const queued = queue.find((o) => o.kind === "spoils");
  const full = handFull(ctx, view);
  const cfg = ctx.rules.spoils;
  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <Frame className="dialog cards-sheet" role="dialog" label="Your cards" title="Your cards" extra={<button className="link" onClick={onClose}>Close</button>}>
        <div className="scroll">
          {hand.length > 0 && (
            <section>
              <h3>Spoils</h3>
              <ul className="hand" aria-label="Your Spoils cards">
                {hand.map((m, i) => (
                  <li key={i} className={`spoils-card ${m}`}>
                    <span className="glyph" aria-hidden>
                      {MARK_ICON[m]}
                    </span>
                    {MARK_NAME[m]}
                  </li>
                ))}
              </ul>
              {full && !queued && <p className="warn small">Your hand is full ({cfg.handLimit} cards): turn in a set this turn, or one goes in for you as the turn ends.</p>}
              {queued?.kind === "spoils" ? (
                <p className="arriving small">
                  Turning in this turn: {choices.find((c) => c.set === queued.set && (!c.territory || c.territory === queued.territory))?.label ?? queued.set}.{" "}
                  <button className="link" onClick={() => remove(queued.id)}>
                    Keep the cards
                  </button>
                </p>
              ) : null}
              {choices.length > 0 ? (
                <div className="choice">
                  {choices.map((c) => (
                    <button
                      key={c.set}
                      className={`wide set-btn ${queued?.kind === "spoils" && queued.set === c.set ? "on" : "primary"}`}
                      onClick={() => {
                        turnInSpoils(c.set, c.territory);
                        onClose();
                      }}
                      title={c.help}
                    >
                      Turn in {c.label.replace(/^./, (x) => x.toLowerCase())}
                    </button>
                  ))}
                  {choices.some((c) => c.set === "tower" || c.set === "laurel") && (
                    <p className="muted small">A fort or culture goes on the territory you have selected (if it can), else where it's most needed. It happens in its turn with your other orders.</p>
                  )}
                </div>
              ) : (
                <p className="muted small">Three alike, or one of each, make a set. You earn a card at the end of each turn you take land (one a turn).</p>
              )}
              <details className="small muted">
                <summary>What the sets give</summary>
                <ul>
                  {(["sword", "tower", "laurel", "mixed"] as const).map((s) => (
                    <li key={s}>
                      {s === "mixed" ? "One of each" : `Three ${MARK_NAME[s]}s`}: {windfallText(ctx, s)}
                    </li>
                  ))}
                  <li>Windfalls don't grow with each set. Others see how many cards you hold, never which.</li>
                </ul>
              </details>
            </section>
          )}
          {view.me.missions.length > 0 && (
            <section>
              <h3>Missions</h3>
              <ul className="missions">
                {view.me.missions.map((m) => {
                  const left = turnsLeft(m, view.turn);
                  return (
                    <li key={m.id}>
                      <button className="mission" onClick={() => onShowMission(m.id)} title="Show it on the map">
                        <span>{missionGoal(ctx, m, n)}</span>
                        <span className="small">
                          <b>{rewardText(m)}</b> · {left === 0 ? "last turn" : `${left + 1} turns left`}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      </Frame>
    </div>
  );
}
