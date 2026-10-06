import { recruitLabel, type GameContext, type Order, type PlayerView } from "@conquerra/engine";
import { amountPill, isAttack, planQueue, recruitedBy, type QueuePlan } from "../logic/orders";
import { describeOrder, namer, orderTags } from "../logic/text";
import { useGame } from "../store";
import { GeneralPortrait } from "./Command";
import { Frame } from "./Frame";
import { moreCue } from "./moreCue";

/** Your orders for this turn, in the order they'll run. Reorder or delete; gold left at the top. */
export function OrderQueue({ ctx, view, plan, queue, bare = false, onFold }: { ctx: GameContext; view: PlayerView; plan: QueuePlan; queue: readonly Order[]; bare?: boolean; /** Desktop: fold the dock down to a slim bar. */ onFold?: () => void }) {
  const { remove, shift, openRecruit, recruit } = useGame();
  const n = namer(ctx, view);
  const body = (
    <>
      {queue.length === 0 && <p className="muted small">No orders yet. Tap your land, then a neighbour to attack; or use the round buttons.</p>}
      <ol ref={moreCue}>
        {queue.map((o, i) => {
          const before = o.kind === "move" ? planQueue(ctx, view, queue.slice(0, i)) : null;
          const hop = plan.hop[i];
          return (
            <li key={o.id} className={`order-line ${hop && hop > 1 ? "hop" : ""} ${recruit?.order === o.id ? "editing" : ""}`}>
              <span className="order-n">{i + 1}</span>
              <span
                className={`order-text ${o.kind === "recruit" ? "editable" : ""}`}
                // A recruit can be edited: tap it to change where and how many.
                {...(o.kind === "recruit" ? { role: "button", tabIndex: 0, title: "Change where and how many", onClick: () => openRecruit(o.id) } : {})}
              >
                {/* Written by a general: its portrait first, so you're never surprised. */}
                {o.general && <GeneralPortrait view={view} general={o.general} size={22} />}
                {o.kind === "move" && before
                  ? describeOrder(o, n, isAttack(view, o, before), amountPill(plan.sent[i] ?? 0, o.troops, before.estimated.has(o.from)))
                  : o.kind === "recruit"
                    ? describeOrder(o, n, false, typeof o.count === "number" ? String(recruitedBy(ctx, plan, i)) : `${recruitedBy(ctx, plan, i)}, ${recruitLabel(o.count)}`)
                    : describeOrder(o, n, false)}
                {hop !== null && hop !== undefined && <span className="tag hop">Hop {hop}</span>}
                {plan.costs[i]! > 0 && <span className="cost">{plan.costs[i]}g</span>}
                {orderTags(o).map((t) => (
                  <span key={t} className="tag">
                    {t}
                  </span>
                ))}
              </span>
              <span className="order-tools">
                <button onClick={() => shift(o.id, -1)} disabled={i === 0} aria-label="Move up">
                  ↑
                </button>
                <button onClick={() => remove(o.id)} aria-label="Delete">
                  ✕
                </button>
              </span>
            </li>
          );
        })}
      </ol>
    </>
  );
  if (bare) return <div className="queue">{body}</div>;
  return (
    <Frame
      className="queue"
      title={`Orders (${queue.length})`}
      extra={
        <span className="queue-extra">
          <span className="cost">{plan.goldLeft}g left</span>
          {onFold && (
            <button className="fold" onClick={onFold} aria-label="Fold the order queue and minimap down" aria-expanded>
              ▾
            </button>
          )}
        </span>
      }
    >
      {body}
    </Frame>
  );
}
