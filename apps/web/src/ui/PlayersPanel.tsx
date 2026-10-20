import type { PlayerView } from "@conquerra/engine";
import type { SeatInfo } from "../host/protocol";
import { useState } from "react";
import { canProposeTo, dealMarks, isOathbreaker, markText, type DealMark } from "../logic/deals";
import { houseOf } from "../map/houses";
import { useLayout } from "./useLayout";
import { useGame } from "../store";
import { useArtUrl, useShield } from "./art";
import { colorOf } from "./colors";
import { myOfferState, PEOPLE_DEAL_SHORT, PEOPLE_DEAL_STATUS, withdrawOffer } from "../logic/peopleDeals";
import { chatWith, useChat } from "./chat/chatStore";
import { Frame } from "./Frame";

const portraitOf = (seat: number) => `leader-${String((seat % 10) + 1).padStart(2, "0")}`;

/** A bot's level and personality, once it's shown (session 17): "Marshal, the Turtle", "Captain". */
export const personaLine = (s: SeatInfo) => (s.level === "marshal" ? `Marshal, ${s.personality ?? "the Marshal"}` : s.level === "captain" ? "Captain" : "Recruit");

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
          {m.bond === "binding" && <span className="deal-seal" aria-label="binding">🔒</span>}
          <span className="left">{m.pending ? "new" : m.turnsLeft}</span>
        </span>
      ))}
    </span>
  );
}

function PlayerRow({ view, id, seat, open, onToggle }: { view: PlayerView; id: string; seat: number; open: boolean; onToggle(): void }) {
  const { pageDeals, openPropose, seats, people, leftSeats, ready, diplomacy, talks } = useGame();
  // Online (session 27): a person's seat a Marshal plays now.
  const gone = leftSeats?.[id];
  const persona = id !== view.me.id ? seats?.[id] : undefined;
  // (A seat a Marshal took from a person says so below instead of "Marshal, Neutral".)
  // Online (session 26): a person at the table, not a bot (no counts, as always).
  const person = id !== view.me.id && !!people?.includes(id);
  const p = view.players.find((x) => x.id === id)!;
  const house = houseOf(view, id);
  const shield = useShield(house);
  const portrait = useArtUrl(portraitOf(seat));
  const out = p.eliminatedTurn !== null;
  const marks = dealMarks(view, pageDeals(), id);
  // Session 28: people take offers too (the room relays them). Session 29: never from a seat a Marshal plays now (you
  // watch; you can't deal).
  const can = canProposeTo(view, id, !!leftSeats?.[view.me.id]);
  // Your offers to this person this turn, and where each stands (a person who has locked in takes no more).
  const mine = person ? diplomacy.flatMap((o) => (o.kind === "propose" && o.offer.to === id ? [o.offer] : [])) : [];
  const lockedIn = person && ready.includes(id);
  const oath = isOathbreaker(view, id);
  const body = (
    <>
      {shield ? <img className="shield" src={shield} alt="" /> : <span />}
      {portrait ? <img className="portrait" src={portrait} alt="" /> : <span />}
      <span className="who">
        <span className="pname">
          {id === view.me.id ? "You" : p.name}
          {gone && (
            <span className="bot-mark" style={{ color: colorOf(view, id) }}>
              {" "}
              (bot)
            </span>
          )}
        </span>
        {gone && <span className="persona">{gone.why === "resigned" ? `A Marshal since turn ${gone.turn} (resigned)` : `A Marshal since turn ${gone.turn} (three missed turns)`}</span>}
        {person && <span className="persona">A person</span>}
        {persona && !gone && <span className="persona">{personaLine(persona)}</span>}
        <span className="house">
          House {house.name}
          {oath && <span className="oath" title={`Broke a deal: Oathbreaker until turn ${p.oathbreaker}`}>Oathbreaker</span>}
        </span>
        <Marks view={view} marks={marks} />
      </span>
      <span className="state">
        {out ? `Out (turn ${p.eliminatedTurn})` : "In"}
        {/* Online (session 27): a person who has locked in this turn. */}
        {!out && people?.includes(id) && ready.includes(id) && <span className="ready-tick" title="Locked in this turn">✓ locked in</span>}
      </span>
    </>
  );
  // Online (session 28): a chat bubble on each person (one-to-one), while they and you are still playing. Session 29:
  // on each bot too (its offers, "Say something", a deal), while it's in the game.
  const bot = !!people && id !== view.me.id && !people.includes(id) && !gone && !out;
  const bubble = (person || bot) && !gone && !leftSeats?.[view.me.id];
  return (
    <li className={`player ${out ? "out" : ""} ${open ? "open" : ""} ${bubble ? "has-chat" : ""}`}>
      {can ? (
        <button className="player-btn" onClick={onToggle} aria-expanded={open}>
          {body}
        </button>
      ) : (
        <div className="player-btn">{body}</div>
      )}
      {bubble && (
        <button className="chat-bubble" onClick={() => void chatWith(id)} aria-label={`Chat with ${p.name}`} title={`Chat with ${p.name}`}>
          💬
        </button>
      )}
      {open && can && (
        <div className="player-more">
          {marks.map((m) => (
            <p key={m.id} className="small">
              {markText(view, m)} with {m.with === view.me.id ? "you" : (view.players.find((x) => x.id === m.with)?.name ?? m.with)}
              {m.bond === "binding" ? " (binding)" : ""}
            </p>
          ))}
          {mine.map((o) => {
            const where = myOfferState(talks, o.id, view.me.id) ?? "open";
            return (
              <p key={o.id} className="small">
                Your {o.terms.kind === "war" ? "joint war" : o.terms.kind}: {PEOPLE_DEAL_SHORT[where](p.name)}{" "}
                {(where === "open" || where === "accepted") && !ready.includes(view.me.id) && (
                  <button className="link small" onClick={() => void withdrawOffer(o)}>
                    Withdraw
                  </button>
                )}
              </p>
            );
          })}
          {lockedIn ? (
            <p className="small muted">{PEOPLE_DEAL_STATUS.lockedIn(p.name)}</p>
          ) : (
            <button className="primary" onClick={() => openPropose(id)}>
              Propose a deal
            </button>
          )}
        </div>
      )}
    </li>
  );
}

/** Session 34: a phone shows this many Houses at a big table before "and 12 more". */
export const PHONE_ROWS = 8;
export const PANEL_TEXT = { more: (n: number) => `and ${n} more`, fewer: "Show fewer" } as const;

/**
 * Session 34, a big table on a phone: who shows first. You, the other people at the table, then the bots you have a
 * deal with, then everyone else in seat order (the knocked out last). Nothing here is a standing: no land, no score.
 */
export function phoneOrder(view: PlayerView, people: readonly string[] | null | undefined, dealt: ReadonlySet<string>): string[] {
  const rank = (p: PlayerView["players"][number]) => (p.id === view.me.id ? 0 : people?.includes(p.id) ? 1 : p.eliminatedTurn !== null ? 4 : dealt.has(p.id) ? 2 : 3);
  return view.players.map((p, i) => ({ id: p.id, r: rank(p), i })).sort((a, b) => a.r - b.r || a.i - b.i).map((x) => x.id);
}

/**
 * Every House: shield (colour and pattern), name, Leader portrait, and whether they're still in. No territory counts
 * (decided). Diplomacy (session 14): a small mark for each deal (a seal on a binding one) with turns left, the
 * Oathbreaker mark, and tap a rival for Propose. Session 34: up to 20 rows; on a phone at a big table, the first
 * PHONE_ROWS (`phoneOrder`) and "and 12 more", which opens the rest.
 */
export function PlayersPanel({ view }: { view: PlayerView }) {
  const [open, setOpen] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const { online, people, leftSeats, pageDeals } = useGame();
  const phone = useLayout().layout === "phone";
  const seatOf = new Map(view.players.map((p, i) => [p.id, i]));
  const order = phone && view.players.length > 10 ? phoneOrder(view, people, new Set(view.players.filter((p) => dealMarks(view, pageDeals(), p.id).some((m) => m.with === view.me.id)).map((p) => p.id))) : view.players.map((p) => p.id);
  const shown = phone && !all && order.length > PHONE_ROWS + 1 ? order.slice(0, PHONE_ROWS) : order;
  // Online (session 28): a group chat with any people at the table.
  const canGroup = !!online && (people ?? []).some((id) => id !== view.me.id && !leftSeats?.[id]) && !leftSeats?.[view.me.id];
  return (
    <Frame title="Houses" className="slim">
      <ul className="players">
        {shown.map((id) => (
          <PlayerRow key={id} view={view} id={id} seat={seatOf.get(id)!} open={open === id} onToggle={() => setOpen((o) => (o === id ? null : id))} />
        ))}
      </ul>
      {shown.length < order.length ? (
        <button className="link small players-more" onClick={() => setAll(true)}>
          {PANEL_TEXT.more(order.length - shown.length)}
        </button>
      ) : all && phone ? (
        <button className="link small players-more" onClick={() => setAll(false)}>
          {PANEL_TEXT.fewer}
        </button>
      ) : null}
      {canGroup && (
        <button className="link small players-group" onClick={() => useChat.setState({ open: true, grouping: true, selected: null, popup: null })}>
          Group…
        </button>
      )}
    </Frame>
  );
}

export { portraitOf };
