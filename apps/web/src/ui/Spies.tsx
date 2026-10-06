import { indexMap, type GameContext, type PlayerView, type TerritoryId } from "@conquerra/engine";
import { useGame } from "../store";

/**
 * Your spies where they stand (session 15): what each is doing, Send (then tap a province) and Recall. Only your own
 * spies ever show. A spy that was fooled reads exactly like one that got in.
 */
export function SpyRows({ ctx, view, at }: { ctx: GameContext; view: PlayerView; at: TerritoryId }) {
  const { queue, sendSpy, recallSpy, spyPick } = useGame();
  const idx = indexMap(ctx.map);
  const prov = (id: string) => ctx.map.provinces.find((p) => p.id === id)?.name ?? id;
  const here = view.spies.filter((s) => s.at === at);
  const t = view.territories[at];
  const reported = t?.detail === "full" && t.seenBy.includes("spy");
  if (!here.length && !reported) return null;
  const province = idx.byId.get(at)?.province ?? "";
  return (
    <div className="spy-rows">
      {reported && <p className="muted small">🕵 What your spy reported as the last turn ended.</p>}
      {here.map((s) => {
        const order = queue.find((o) => o.kind === "spy" && o.spy === s.id);
        const doing =
          s.status === "in"
            ? `inside ${prov(province)}: you see the whole province`
            : s.status === "defend"
              ? `on guard in ${prov(province)}: it blocks other spies`
              : `travelling: it lifts the fog 2 territories around it`;
        const next = order?.kind === "spy" ? (order.to ? `Going to ${prov(order.to)} as the turn ends.` : "Called home: back at your capital next turn.") : s.target ? `On its way to ${prov(s.target)}.` : null;
        return (
          <div key={s.id} className="spy-row">
            <p className="small">
              <span aria-hidden>{s.status === "in" ? "👁" : s.status === "defend" ? "🛡" : "🕵"}</span> Your spy, {doing}.{next ? ` ${next}` : ""}
            </p>
            <div className="row">
              <button className={spyPick === s.id ? "primary" : ""} onClick={() => sendSpy(s.id)} aria-pressed={spyPick === s.id}>
                Send…
              </button>
              {!(at === view.me.capital && !s.target) && <button onClick={() => recallSpy(s.id)}>Recall</button>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
