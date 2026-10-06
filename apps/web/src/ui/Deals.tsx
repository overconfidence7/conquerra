import { DEAL_KINDS, describeTerms, indexMap, type DealKind, type DealTerms, type GameContext, type Offer, type PlayerId, type PlayerView, type TradeSide } from "@conquerra/engine";
import { useEffect, useRef, type ReactNode } from "react";
import { bindingPrice, breakPrice, changedTerms, newOffer, ownerFrom } from "../logic/deals";
import { dealNames, namer } from "../logic/text";
import { useGame } from "../store";
import { Frame } from "./Frame";

/**
 * The deal card (session 14): propose a deal (a plain truce comes ready to send), or answer an offer to you (Accept
 * is one tap). Loaded the first time it's opened: nothing about diplomacy is in the start-up bundle.
 */

const KIND_NAME: Record<DealKind, string> = { truce: "Truce", trade: "Trade", war: "Joint war", passage: "Passage" };
const KIND_HELP: Record<DealKind, string> = {
  truce: "No attacks between you where it holds, for a few turns.",
  trade: "Gold now, gold each turn, or land that borders theirs.",
  war: "You both attack the same rival, with peace between you while it lasts.",
  passage: "Your armies march through their land (coming soon).",
};

function Steps({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange(v: number): void; label: string }) {
  return (
    <span className="stepper" role="group" aria-label={label}>
      <button onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`Less: ${label}`}>
        −
      </button>
      <span className="stepper-value">{value}</span>
      <button onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`More: ${label}`}>
        +
      </button>
    </span>
  );
}

const nameOf = (view: PlayerView, p: PlayerId) => (p === view.me.id ? "You" : (view.players.find((x) => x.id === p)?.name ?? p));

/** The terms as rows (where, how long, who gives what, the promise), with the ones a counteroffer changed marked. */
function TermRows({ ctx, view, offer, changed }: { ctx: GameContext; view: PlayerView; offer: Offer; changed?: Set<string> }) {
  const n = namer(ctx, view);
  const t = offer.terms;
  const rows: [string, ReactNode, boolean][] = [];
  const mark = (k: string) => !!changed?.has(k);
  if (t.kind === "truce") {
    const where = t.scope.kind === "all" ? "Everywhere between you" : t.scope.kind === "province" ? `In ${ctx.map.provinces.find((p) => p.id === (t.scope as { province: string }).province)?.name}` : `${t.scope.borders.length} border${t.scope.borders.length === 1 ? "" : "s"} (on the map)`;
    rows.push(["Where", where, mark("scope")]);
    rows.push(["How long", t.until ? `Until ${nameOf(view, t.until)} is knocked out (${t.turns} turns at most)` : `${t.turns} turns`, mark("turns") || mark("scope")]);
  }
  if (t.kind === "war") {
    rows.push(["Target", nameOf(view, t.target), mark("target")]);
    rows.push(["How long", `${t.turns} turns`, mark("turns")]);
  }
  if (t.kind === "passage") rows.push(["How long", `${t.turns} turns`, mark("turns")]);
  if (t.kind === "trade") {
    const side = (s: TradeSide) => {
      const parts: string[] = [];
      if (s.gold) parts.push(`${s.gold} gold now`);
      if (s.perTurn) parts.push(`${s.perTurn} gold a turn for ${t.turns ?? 1} turns`);
      for (const l of s.land ?? []) parts.push(n.place(l));
      return parts.join(", ") || "nothing";
    };
    const mine = offer.from === view.me.id;
    rows.push(["You give", side(mine ? t.give : t.get), mark(mine ? "give" : "get")]);
    rows.push([`${nameOf(view, mine ? offer.to : offer.from)} gives`, side(mine ? t.get : t.give), mark(mine ? "get" : "give")]);
  }
  rows.push(["Promise", offer.bond === "binding" ? `Binding: ${bindingPrice(ctx, view, offer)} gold each, the game holds you both to it` : `Handshake: free. Breaking it brings the Oathbreaker mark, ${breakPrice(ctx, view, offer)}.`, mark("bond")]);
  return (
    <dl className="deal-terms">
      {rows.map(([k, v, changedRow]) => (
        <div key={k} className={changedRow ? "changed" : ""}>
          <dt>{k}</dt>
          <dd>
            {v}
            {changedRow && <span className="changed-tag"> changed</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Propose: pick a card (its defaults filled in), change the terms if you like, pick the promise, Send. */
function Propose({ ctx, view, offer }: { ctx: GameContext; view: PlayerView; offer: Offer }) {
  const { editDeal, sendOffer, answers, setDealPick, closeDeal, busy } = useGame();
  const d = ctx.rules.diplomacy;
  const them = offer.to;
  const t = offer.terms;
  const answer = answers[offer.id];
  const set = (terms: DealTerms) => editDeal({ ...offer, terms });
  const living = view.players.filter((p) => p.eliminatedTurn === null && p.id !== view.me.id && p.id !== them);
  const idx = indexMap(ctx.map);
  const owner = ownerFrom(view);
  // Provinces where your land meets theirs (as far as you can see): the ones a province truce can name.
  const shared = ctx.map.provinces.filter((p) => (idx.provinceMembers.get(p.id) ?? []).some((x) => (owner(x) === view.me.id || owner(x) === them) && (idx.neighbors.get(x) ?? []).some((y) => owner(y) === (owner(x) === view.me.id ? them : view.me.id))));
  const price = bindingPrice(ctx, view, offer);
  const words = describeTerms(t, offer.from, offer.to, dealNames(namer(ctx, view)));
  // The answer arrives below the card's terms: bring it into view (on a phone it's under the fold).
  const said = useRef<HTMLDivElement>(null);
  useEffect(() => {
    said.current?.scrollIntoView({ block: "nearest" });
  }, [answer]);
  return (
    <>
      <div className="chips deal-kinds" role="radiogroup" aria-label="Deal card">
        {DEAL_KINDS.map((k) => (
          <button
            key={k}
            role="radio"
            aria-checked={t.kind === k}
            className={`chip ${t.kind === k ? "on" : ""}`}
            disabled={k === "passage"}
            title={KIND_HELP[k]}
            onClick={() => editDeal({ ...newOffer(ctx, view, them, k), id: offer.id, ...(offer.counterTo ? { counterTo: offer.counterTo } : {}) })}
          >
            {KIND_NAME[k]}
            {k === "passage" ? " (soon)" : ""}
          </button>
        ))}
      </div>
      <p className="muted small">{KIND_HELP[t.kind]}</p>

      {t.kind === "truce" && (
        <>
          <div className="row">
            <span>Where</span>
            <span className="chips">
              <button className={`chip ${t.scope.kind === "all" ? "on" : ""}`} onClick={() => set({ ...t, scope: { kind: "all" } })}>
                Everywhere
              </button>
              {shared.map((p) => (
                <button key={p.id} className={`chip ${t.scope.kind === "province" && t.scope.province === p.id ? "on" : ""}`} onClick={() => set({ ...t, scope: { kind: "province", province: p.id } })}>
                  {p.name}
                </button>
              ))}
              <button className={`chip ${t.scope.kind === "borders" ? "on" : ""}`} onClick={() => setDealPick("borders")}>
                {t.scope.kind === "borders" ? `${t.scope.borders.length} border${t.scope.borders.length === 1 ? "" : "s"}` : "Borders on the map"}
              </button>
            </span>
          </div>
          <div className="row">
            <span>How long</span>
            <Steps value={t.turns} min={d.truce.minTurns} max={Math.min(d.truce.maxTurns, d.maxTurns)} label="turns" onChange={(v) => set({ ...t, turns: v })} />
          </div>
          {living.length > 0 && (
            <div className="row">
              <span className="muted small">Until</span>
              <select
                className="deal-until"
                aria-label="Until"
                value={t.until ?? ""}
                onChange={(e) => set(e.target.value ? { ...t, until: e.target.value, turns: Math.min(d.truce.maxTurns, d.maxTurns) } : { kind: "truce", scope: t.scope, turns: t.turns })}
              >
                <option value="">Those turns</option>
                {living.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} is knocked out ({Math.min(d.truce.maxTurns, d.maxTurns)} turns at most)
                  </option>
                ))}
              </select>
            </div>
          )}
        </>
      )}

      {t.kind === "war" && (
        <>
          <div className="row">
            <span>Target</span>
            <span className="chips">
              {living.map((p) => (
                <button key={p.id} className={`chip ${t.target === p.id ? "on" : ""}`} onClick={() => set({ ...t, target: p.id })}>
                  {p.name}
                </button>
              ))}
            </span>
          </div>
          <div className="row">
            <span>How long</span>
            <Steps value={t.turns} min={d.war.minTurns} max={Math.min(d.war.maxTurns, d.maxTurns)} label="turns" onChange={(v) => set({ ...t, turns: v })} />
          </div>
        </>
      )}

      {t.kind === "trade" && (
        <>
          {(["give", "get"] as const).map((side) => {
            const s = t[side];
            const put = (patch: Partial<TradeSide>) => {
              const next = { ...s, ...patch };
              for (const k of Object.keys(next) as (keyof TradeSide)[]) if (!next[k] || (Array.isArray(next[k]) && !(next[k] as unknown[]).length)) delete next[k];
              const perTurn = (side === "give" ? next.perTurn : t.give.perTurn) || (side === "get" ? next.perTurn : t.get.perTurn);
              const { turns: _t, ...rest } = t;
              set({ ...rest, [side]: next, ...(perTurn ? { turns: t.turns ?? 3 } : {}) } as DealTerms);
            };
            return (
              <section key={side} className="trade-side">
                <h3>{side === "give" ? "You give" : `${nameOf(view, them)} gives`}</h3>
                <div className="row">
                  <span className="muted small">Gold now</span>
                  <Steps value={s.gold ?? 0} min={0} max={side === "give" ? view.me.gold : 60} label={`gold now (${side})`} onChange={(v) => put({ gold: v })} />
                </div>
                <div className="row">
                  <span className="muted small">Gold each turn</span>
                  <Steps value={s.perTurn ?? 0} min={0} max={20} label={`gold each turn (${side})`} onChange={(v) => put({ perTurn: v })} />
                </div>
                <div className="row">
                  <span className="muted small">Land {s.land?.length ? `(${s.land.map((l) => idx.byId.get(l)?.name).join(", ")})` : ""}</span>
                  <button className="chip" onClick={() => setDealPick(side)}>
                    Pick on the map
                  </button>
                </div>
              </section>
            );
          })}
          {((t.give.perTurn ?? 0) > 0 || (t.get.perTurn ?? 0) > 0) && (
            <div className="row">
              <span>Gold each turn for</span>
              <Steps value={t.turns ?? 1} min={1} max={Math.min(d.trade.maxPerTurnTurns, d.maxTurns)} label="turns of payments" onChange={(v) => set({ ...t, turns: v })} />
            </div>
          )}
        </>
      )}

      <div className="chips bond" role="radiogroup" aria-label="Promise">
        <button role="radio" aria-checked={offer.bond === "handshake"} className={`chip ${offer.bond === "handshake" ? "on" : ""}`} onClick={() => editDeal({ ...offer, bond: "handshake" })} title={`Free. You can break it, but breaking it brings the Oathbreaker mark, ${breakPrice(ctx, view, offer)}.`}>
          🤝 Handshake (free)
        </button>
        <button role="radio" aria-checked={offer.bond === "binding"} className={`chip ${offer.bond === "binding" ? "on" : ""}`} onClick={() => editDeal({ ...offer, bond: "binding" })} title="Each side pays up front, and the game holds you both to it: no attacks across it.">
          🔒 Binding ({price} gold each)
        </button>
      </div>
      <p className="deal-words">
        You offer {nameOf(view, them)} {words}.
      </p>
      {answer ? (
        <div ref={said} className={`deal-answer ${answer.accept ? "yes" : "no"}`} role="status">
          <p>
            <b>{nameOf(view, them)}:</b> “{answer.reason}”
          </p>
          <p className="small">{answer.accept ? "Agreed: it starts as the turn plays, before any move." : answer.counter ? "They sent a counteroffer." : "Declined."}</p>
          <button className="wide" onClick={closeDeal}>
            {answer.accept ? "Done" : "Close"}
          </button>
        </div>
      ) : (
        <button className="primary wide" disabled={busy} onClick={() => void sendOffer(offer)}>
          Send
        </button>
      )}
    </>
  );
}

/** An offer to you (or a counteroffer): Accept is one tap; Counter opens the same card from your side. */
function Incoming({ ctx, view, offer }: { ctx: GameContext; view: PlayerView; offer: Offer }) {
  const { answerOffer, counterOffer, diplomacy, answers } = useGame();
  const original = offer.counterTo ? diplomacy.find((o) => o.kind === "propose" && o.offer.id === offer.counterTo) : undefined;
  const changed = original?.kind === "propose" ? changedTerms(original.offer, offer) : undefined;
  const reason = offer.counterTo ? answers[offer.counterTo]?.reason : undefined;
  const answered = diplomacy.find((o) => o.kind === "answer" && o.from === offer.from && o.offer === offer.id);
  const words = describeTerms(offer.terms, offer.from, offer.to, dealNames(namer(ctx, view)));
  return (
    <>
      {(reason ?? offer.note) && (
        <p className={`deal-answer ${reason ? "no" : ""}`}>
          <b>{nameOf(view, offer.from)}:</b> “{reason ?? offer.note}”
        </p>
      )}
      <p className="deal-words">{words[0]!.toUpperCase() + words.slice(1)}.</p>
      <TermRows ctx={ctx} view={view} offer={offer} changed={changed} />
      {answered?.kind === "answer" ? (
        <p className="small">{answered.accept ? "You accepted: it starts as the turn plays, before any move." : "You declined."}</p>
      ) : (
        <div className="dialog-actions">
          <button className="primary" onClick={() => answerOffer(offer, true)}>
            Accept
          </button>
          <button onClick={() => counterOffer(offer)}>Counter</button>
          <button onClick={() => answerOffer(offer, false)}>Decline</button>
        </div>
      )}
      <p className="muted small">Not answered by the time the turn plays, it lapses.</p>
    </>
  );
}

const PICK_HELP = { borders: "Tap their land (or yours) along the border to add it to the truce", give: "Tap your land next to theirs to give it", get: "Tap their land next to yours to ask for it" } as const;

export default function DealSheet({ ctx, view }: { ctx: GameContext; view: PlayerView }) {
  const { deal, closeDeal, dealPick, setDealPick } = useGame();
  if (!deal) return null;
  // Picking on the map: the card steps aside for a slim banner.
  if (dealPick && deal.mode === "propose") {
    const t = deal.offer.terms;
    const count = t.kind === "truce" && t.scope.kind === "borders" ? t.scope.borders.length : t.kind === "trade" ? (t[dealPick === "get" ? "get" : "give"].land?.length ?? 0) : 0;
    return (
      <Frame className="pick-banner deal-pick slim" role="status">
        <span>
          {PICK_HELP[dealPick]} ({count} picked)
        </span>
        <button className="link" onClick={() => setDealPick(null)}>
          Done
        </button>
      </Frame>
    );
  }
  const other = deal.mode === "propose" ? deal.offer.to : deal.offer.from;
  const title = deal.mode === "propose" ? `A deal with ${nameOf(view, other)}` : deal.offer.counterTo ? `${nameOf(view, other)} counters` : `${nameOf(view, other)} offers a deal`;
  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && closeDeal()}>
      <Frame className="dialog deal-sheet" role="dialog" label={title} title={title} extra={<button className="link" onClick={closeDeal}>Close</button>}>
        <div className="scroll">{deal.mode === "propose" ? <Propose ctx={ctx} view={view} offer={deal.offer} /> : <Incoming ctx={ctx} view={view} offer={deal.offer} />}</div>
      </Frame>
    </div>
  );
}
