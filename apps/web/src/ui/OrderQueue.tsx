import type { GameContext, Order, PlayerView } from "@conquerra/engine";
import { isMine, type QueuePlan } from "../logic/orders";
import { describeOrder, namer, orderTags } from "../logic/text";
import { useGame } from "../store";
import { Frame } from "./Frame";

/** Your orders for this turn, in the order they'll run. Reorder or delete; gold left at the top. */
export function OrderQueue({ ctx, view, plan, queue, bare = false }: { ctx: GameContext; view: PlayerView; plan: QueuePlan; queue: readonly Order[]; bare?: boolean }) {
  const { remove, shift } = useGame();
  const n = namer(ctx, view);
  const body = (
    <>
      {queue.length === 0 && <p className="muted small">No orders yet. Tap your land, then a neighbour to attack; or use the round buttons.</p>}
      <ol>
        {queue.map((o, i) => (
          <li key={o.id} className="order-line">
            <span className="order-n">{i + 1}</span>
            <span className="order-text">
              {describeOrder(o, n, o.kind === "move" && !isMine(view, o.to))}
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
        ))}
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
