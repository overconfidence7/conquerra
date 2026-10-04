import type { GameContext, Order, PlayerView } from "@conquerra/engine";
import { amountPill, isAttack, planQueue, type QueuePlan } from "../logic/orders";
import { describeOrder, namer, orderTags } from "../logic/text";
import { useGame } from "../store";
import { Frame } from "./Frame";
import { moreCue } from "./moreCue";

/** Your orders for this turn, in the order they'll run. Reorder or delete; gold left at the top. */
export function OrderQueue({ ctx, view, plan, queue, bare = false }: { ctx: GameContext; view: PlayerView; plan: QueuePlan; queue: readonly Order[]; bare?: boolean }) {
  const { remove, shift } = useGame();
  const n = namer(ctx, view);
  const body = (
    <>
      {queue.length === 0 && <p className="muted small">No orders yet. Tap your land, then a neighbour to attack; or use the round buttons.</p>}
      <ol ref={moreCue}>
        {queue.map((o, i) => {
          const before = o.kind === "move" ? planQueue(ctx, view, queue.slice(0, i)) : null;
          const hop = plan.hop[i];
          return (
            <li key={o.id} className={`order-line ${hop && hop > 1 ? "hop" : ""}`}>
              <span className="order-n">{i + 1}</span>
              <span className="order-text">
                {o.kind === "move" && before
                  ? describeOrder(o, n, isAttack(view, o, before), amountPill(plan.sent[i] ?? 0, o.troops, before.estimated.has(o.from)))
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
    <Frame className="queue" title={`Orders (${queue.length})`} extra={<span className="cost">{plan.goldLeft}g left</span>}>
      {body}
    </Frame>
  );
}
