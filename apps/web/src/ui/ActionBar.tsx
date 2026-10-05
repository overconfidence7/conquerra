import type { ReactElement } from "react";
import type { GameContext, PlayerView } from "@conquerra/engine";
import { actionBarState } from "../logic/actions";
import type { QueuePlan } from "../logic/orders";
import { useGame } from "../store";
import { useArtUrl } from "./art";
import { ArtIcon } from "./ArtIcon";
import { Icon } from "./icons";

interface Props {
  ctx: GameContext;
  view: PlayerView;
  plan: QueuePlan;
  spendOpen: boolean;
  onSpend(): void;
  /** Move/Attack: on a phone it opens the army sheet. */
  onMove?(): void;
  disabled?: boolean;
}

/**
 * The round buttons: Move/Attack, Recruit, Spend (hire or build), Culture, Retreat. Recruit is one tap (all you can
 * afford, at the selected territory if it can recruit, else the capital); the others act on the selected territory.
 */
export function ActionBar({ ctx, view, plan, spendOpen, onSpend, onMove, disabled }: Props) {
  const { selected, select, quickRecruit, add } = useGame();
  const a = actionBarState(ctx, view, plan, selected);
  const mineSelected = a.spend.ok;
  const btn = (key: string, label: string, icon: ReactElement, ok: boolean, why: string | undefined, onClick: () => void, on = false, count?: number, tip?: string) => (
    <button key={key} className={`round ${on ? "on" : ""}`} disabled={disabled || !ok} title={ok ? (tip ?? label) : why} aria-label={count ? `${label} ${count}` : label} onClick={onClick}>
      {icon}
      <span>{label}</span>
      {count ? <b className="count">{count}</b> : null}
    </button>
  );
  return (
    <div className="actions" role="toolbar" aria-label="Actions">
      {btn("move", "Attack", <ArtIcon name="icon-troops" size={30} />, true, undefined, () => {
        if (!mineSelected) select(view.me.capital);
        onMove?.();
      }, mineSelected && !spendOpen)}
      {btn("recruit", "Recruit", <ArtIcon name="icon-barracks" size={30} />, a.recruit.ok, a.recruit.why, quickRecruit, false, a.recruit.ok ? a.recruit.count : undefined)}
      {btn("spend", "Spend", <ArtIcon name="icon-gold" size={30} />, a.spend.ok, a.spend.why, onSpend, spendOpen)}
      {btn("culture", "Culture", <ArtIcon name="icon-culture" size={30} />, a.culture.ok, a.culture.why, () => selected && add({ kind: "invest", territory: selected }), false, undefined, a.culture.next)}
      {btn("retreat", "Retreat", <Icon.retreat />, a.retreat.ok, a.retreat.why, () => selected && add({ kind: "retreat", from: selected }))}
    </div>
  );
}

/** The Lock in wax seal. */
export function LockSeal({ count, busy, disabled, onLock }: { count: number; busy: boolean; disabled?: boolean; onLock(): void }) {
  const seal = useArtUrl("seal");
  return (
    <button className="seal" onClick={onLock} disabled={busy || disabled} aria-label={`Lock in ${count} order${count === 1 ? "" : "s"}`}>
      {seal && <img src={seal} alt="" />}
      <span className="label">{busy ? "Sealing…" : "Lock in"}</span>
      {count > 0 && <span className="badge">{count}</span>}
    </button>
  );
}
