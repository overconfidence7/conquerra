import type { PlayerView } from "@conquerra/engine";
import { useState } from "react";
import { canProposeTo, dealMarks, isOathbreaker, markText, type DealMark } from "../logic/deals";
import { HOUSES, houseOf } from "../map/houses";
import { useGame } from "../store";
import { useArtUrl, useShield } from "./art";
import { colorOf } from "./colors";
import { Frame } from "./Frame";

const portraitOf = (seat: number) => `leader-${String((seat % 10) + 1).padStart(2, "0")}`;

const MARK_GLYPH: Record<DealMark["kind"], string> = { truce: "🤝", trade: "⚖", war: "⚔", passage: "↝" };

/** One small mark per deal: its kind, a seal on a binding one, the House it's with, and turns left. */
function Marks({ view, marks }: { view: PlayerView; marks: DealMark[] }) {
  if (!marks.length) return null;
  return (
    <span className="deal-marks">
      {marks.map((m) => (
        <span key={m.id} className={`deal-mark ${m.bond} ${m.pending ? "pending" : ""}`} title={`${markText(view, m)} with ${m.with === view.me.id ? "you" : (view.players.find((p) => p.id === m.with)?.name ?? m.with)}${m.bond === "binding" ? " (binding)" : ""}`}>
          <i className="with" style={{ background: colorOf(view, m.with) }} aria-hidden />
          {MARK_GLYPH[m.kind]}
          {m.bond === "binding" && <span className="seal" aria-label="binding">🔒</span>}
          <span className="left">{m.pending ? "new" : m.turnsLeft}</span>
        </span>
      ))}
    </span>
  );
}

function PlayerRow({ view, id, seat, open, onToggle }: { view: PlayerView; id: string; seat: number; open: boolean; onToggle(): void }) {
  const { pageDeals, openPropose } = useGame();
  const p = view.players.find((x) => x.id === id)!;
  const house = houseOf(view, id);
  const shield = useShield(house);
  const portrait = useArtUrl(portraitOf(seat));
  const out = p.eliminatedTurn !== null;
  const marks = dealMarks(view, pageDeals(), id);
  const can = canProposeTo(view, id);
  const oath = isOathbreaker(view, id);
  const body = (
    <>
      {shield ? <img className="shield" src={shield} alt="" /> : <span />}
      {portrait ? <img className="portrait" src={portrait} alt="" /> : <span />}
      <span>
        <span className="pname">
          {id === view.me.id ? "You" : p.name}
          {oath && <span className="oath" title={`Broke a deal: Oathbreaker until turn ${p.oathbreaker}`}>Oathbreaker</span>}
        </span>
        <span className="house">House {house.name}</span>
        <Marks view={view} marks={marks} />
      </span>
      <span className="state">{out ? `Out (turn ${p.eliminatedTurn})` : "In"}</span>
    </>
  );
  return (
    <li className={`player ${out ? "out" : ""} ${open ? "open" : ""}`}>
      {can ? (
        <button className="player-btn" onClick={onToggle} aria-expanded={open}>
          {body}
        </button>
      ) : (
        <div className="player-btn">{body}</div>
      )}
      {open && can && (
        <div className="player-more">
          {marks.map((m) => (
            <p key={m.id} className="small">
              {markText(view, m)} with {m.with === view.me.id ? "you" : (view.players.find((x) => x.id === m.with)?.name ?? m.with)}
              {m.bond === "binding" ? " (binding)" : ""}
            </p>
          ))}
          <button className="primary" onClick={() => openPropose(id)}>
            Propose a deal
          </button>
        </div>
      )}
    </li>
  );
}

/**
 * Every House: shield (colour and pattern), name, Leader portrait, and whether they're still in. No territory counts
 * (decided). Diplomacy (session 14): a small mark for each deal (a seal on a binding one) with turns left, the
 * Oathbreaker mark, and tap a rival for Propose.
 */
export function PlayersPanel({ view }: { view: PlayerView }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Frame title="Houses" className="slim">
      <ul className="players">
        {view.players.slice(0, HOUSES.length).map((p, i) => (
          <PlayerRow key={p.id} view={view} id={p.id} seat={i} open={open === p.id} onToggle={() => setOpen((o) => (o === p.id ? null : p.id))} />
        ))}
      </ul>
    </Frame>
  );
}

export { portraitOf };
