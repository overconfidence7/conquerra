import type { BuildingType } from "@conquerra/content";
import { setsIn, type GameContext, type PlayerView } from "@conquerra/engine";
import { useState } from "react";
import { MARK_ICON, MARK_NAME, missionGoal, rewardText, SET_FLAVOUR, SET_NAME, SPOILS_RULE, turnsLeft, windfallText } from "../logic/cards";
import { BUILDING_NAME } from "../logic/text";
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
  // One of each gives a finished building of your choice (session 16): a fort unless you pick another.
  const [building, setBuilding] = useState<BuildingType>("fort");
  const choices = setChoices(ctx, view, selected, n, building);
  const can = new Set(setsIn(hand));
  const queued = queue.find((o) => o.kind === "spoils");
  const full = handFull(ctx, view);
  const cfg = ctx.rules.spoils;
  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <Frame className="dialog cards-sheet" role="dialog" label="Your cards" title="Your cards" extra={<button className="link" onClick={onClose}>Close</button>}>
        <div className="scroll">
          {hand.length > 0 && (
            <section>
              <h3>Your Spoils</h3>
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
                        turnInSpoils(c.set, c.territory, c.building);
                        onClose();
                      }}
                      title={c.help}
                    >
                      Turn in {c.label.replace(/^./, (x) => x.toLowerCase())}
                    </button>
                  ))}
                  {choices.some((c) => c.set === "mixed") && (
                    <div className="chips" role="radiogroup" aria-label="One of each: which building">
                      <span className="muted small">One of each builds:</span>
                      {(["fort", "market", "barracks", "watchtower"] as const).map((b) => (
                        <button key={b} role="radio" aria-checked={building === b} className={`chip ${building === b ? "on" : ""}`} onClick={() => setBuilding(b)}>
                          {BUILDING_NAME[b]}
                        </button>
                      ))}
                    </div>
                  )}
                  {choices.some((c) => c.set !== "sword") && (
                    <p className="muted small">A building, a fort or culture goes on the territory you have selected (if it can), else where it's most needed. It happens in its turn with your other orders.</p>
                  )}
                </div>
              ) : (
                <p className="muted small">You earn a card at the end of each turn you take land (one a turn).</p>
              )}
            </section>
          )}
          {/* The sets, always shown (session 16), the ones your hand can make lit, the best one marked. */}
          {view.settings.spoils && (
            <section>
              <h3>{SPOILS_RULE}</h3>
              <table className="spoils-table">
                <tbody>
                  {(["mixed", "sword", "tower", "laurel"] as const).map((s) => (
                    <tr key={s} className={can.has(s) ? "lit" : ""}>
                      <th scope="row">
                        {s === "mixed" ? `${MARK_ICON.sword}${MARK_ICON.tower}${MARK_ICON.laurel}` : MARK_ICON[s].repeat(3)} {SET_NAME[s]}
                        {s === "mixed" && <span className="best"> best</span>}
                      </th>
                      <td>
                        {windfallText(ctx, s)}
                        <span className="block small muted flavour">{SET_FLAVOUR[s]}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="muted small">Windfalls don't grow with each set. Others see how many cards you hold, never which.</p>
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
