import type { SpecialistType } from "@conquerra/content";
import { indexMap, type GameContext, type Order, type PlayerView, type TerritoryId } from "@conquerra/engine";
import { useEffect, useState } from "react";
import {
  affordableTroops,
  buildOptions,
  hireOptions,
  isAttack,
  isMine,
  isRecruitSite,
  justEnough,
  leaderCanJoin,
  nextCultureCost,
  ODDS_LABEL,
  oddsFor,
  presetsFor,
  seen,
  timingAvailable,
  type MoveDraft,
  type QueuePlan,
} from "../logic/orders";
import { BUILDING_HELP, BUILDING_ICON, BUILDING_NAME, SPECIALIST_HELP, SPECIALIST_ICON, SPECIALIST_NAME, TERRAIN_ICON, namer } from "../logic/text";
import { useGame } from "../store";
import { colorOf } from "./colors";

const CROSSING = { river: "🌊 Across a river", pass: "⛰ Through a mountain pass", sea: "⛵ Over a sea lane" } as const;

interface Props {
  ctx: GameContext;
  view: PlayerView;
  plan: QueuePlan;
  queue: readonly Order[];
  selected: TerritoryId | null;
  draft: MoveDraft | null;
  /** The Spend button is on: show hiring and building for the selected territory. */
  spendOpen?: boolean;
}

/** The context panel: a draft move/attack if one is open, otherwise the selected territory. */
export function Panel(props: Props) {
  if (props.draft) return <DraftPanel {...props} draft={props.draft} />;
  if (props.selected) return <TerritoryPanel {...props} selected={props.selected} />;
  return (
    <div className="panel hint">
      <p>Tap one of your territories, then a neighbour to move or attack.</p>
      <p className="muted small">Or use the round buttons: Recruit is one tap.</p>
    </div>
  );
}

function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange(v: number): void }) {
  return (
    <span className="stepper">
      <button onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="less">
        −
      </button>
      <span className="stepper-value">{value}</span>
      <button onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="more">
        +
      </button>
    </span>
  );
}

/** Presets shown up front; the rest wait behind "More". */
const MAIN_PRESETS = new Set(["onlyIfStronger", "followThrough"]);

function DraftPanel({ ctx, view, plan, queue, draft }: Props & { draft: MoveDraft }) {
  const { updateDraft, addDraft, clearSelection, select } = useGame();
  const [more, setMore] = useState(false);
  const n = namer(ctx, view);
  const attack = isAttack(view, draft);
  const max = plan.free.get(draft.from) ?? 0;
  const odds = attack ? oddsFor(ctx, view, draft) : null;
  const target = seen(view, draft.to);
  const enough = attack ? justEnough(ctx, view, plan, draft) : null;
  const crossing = indexMap(ctx.map).border(draft.via ?? draft.from, draft.to) ?? "normal";
  const quick = [
    ...(enough !== null ? [{ label: "Just enough", value: enough }] : []),
    { label: "Half", value: Math.max(1, Math.ceil(max / 2)) },
    { label: "All", value: max },
  ];
  return (
    <div className="panel">
      <div className="panel-head">
        <h2>
          {attack ? "Attack" : "Move to"} {n.place(draft.to)}
        </h2>
        <button className="link" onClick={clearSelection}>
          Cancel
        </button>
      </div>
      <p className="muted">
        From {n.place(draft.from)}
        {draft.via ? ` via ${n.place(draft.via)} (cavalry)` : ""}
        {attack && target ? ` · defenders: ${target.troops}${target.owner ? ` (${n.who(target.owner)})` : " (neutral)"}` : ""}
      </p>

      <div className="row">
        <span>Troops</span>
        <Stepper value={draft.troops} min={max > 0 ? 1 : 0} max={max} onChange={(troops) => updateDraft({ troops })} />
        <input
          type="range"
          min={max > 0 ? 1 : 0}
          max={max}
          value={draft.troops}
          onChange={(e) => updateDraft({ troops: Number(e.target.value) })}
          aria-label="troops"
        />
      </div>
      {max > 1 && (
        <div className="chips">
          {quick.map((q) => (
            <button key={q.label} className={`chip ${draft.troops === q.value ? "on" : ""}`} onClick={() => updateDraft({ troops: q.value })}>
              {q.label} ({q.value})
            </button>
          ))}
        </div>
      )}
      {odds && <div className={`odds odds-${odds}`}>Odds: {ODDS_LABEL[odds]}</div>}
      {attack && crossing !== "normal" && (
        <p className="muted small">
          {CROSSING[crossing]}: attack ×{ctx.rules.borders[crossing].attackMult}
        </p>
      )}
      {max === 0 && <p className="warn">No troops left to send from here this turn.</p>}

      <div className="chips">
        {presetsFor(view, draft).filter((p) => more || MAIN_PRESETS.has(p.id) || draft.preset === p.id).map((p) => (
          <button
            key={p.id}
            className={`chip ${draft.preset === p.id ? "on" : ""}`}
            title={p.description}
            onClick={() => updateDraft({ preset: draft.preset === p.id ? null : p.id })}
          >
            {p.name}
          </button>
        ))}
        <button className="chip" onClick={() => setMore((m) => !m)} aria-expanded={more}>
          {more ? "Less" : "More…"}
        </button>
      </div>

      {view.me.leader.alive && (more || draft.withLeader || draft.timing) && (
        <div className="chips">
          {leaderCanJoin(view, draft.from) && (
            <button className={`chip leader ${draft.withLeader ? "on" : ""}`} onClick={() => updateDraft({ withLeader: !draft.withLeader })} title="Your Leader goes with this army: +20% strength">
              👑 Leader leads (+20%)
            </button>
          )}
          {(timingAvailable(view, queue, "first") || draft.timing === "first") && (
            <button
              className={`chip leader ${draft.timing === "first" ? "on" : ""}`}
              onClick={() => updateDraft({ timing: draft.timing === "first" ? null : "first" })}
              title="This order goes before everyone else's. Then it rests for a few turns."
            >
              ⚡ Seize the Initiative
            </button>
          )}
          {(timingAvailable(view, queue, "last") || draft.timing === "last") && (
            <button
              className={`chip leader ${draft.timing === "last" ? "on" : ""}`}
              onClick={() => updateDraft({ timing: draft.timing === "last" ? null : "last" })}
              title="This order goes after everyone else's. Pairs well with Reinforce if hit."
            >
              ⏳ Lie in Wait
            </button>
          )}
        </div>
      )}

      {view.me.leader.alive && !more && !draft.withLeader && !draft.timing && <p className="muted small">More… has the Leader and the other backup plans.</p>}
      <button className="primary wide" disabled={draft.troops <= 0} onClick={addDraft}>
        Add {attack ? "attack" : "move"}
      </button>
      {draft.preset && <p className="muted small">{presetsFor(view, draft).find((p) => p.id === draft.preset)?.description}</p>}
      {isMine(view, draft.to) && (
        <button className="link small" onClick={() => select(draft.to)}>
          Just select {n.place(draft.to)} instead
        </button>
      )}
    </div>
  );
}

function TerritoryPanel({ ctx, view, plan, selected, spendOpen }: Props & { selected: TerritoryId }) {
  const { add } = useGame();
  const idx = indexMap(ctx.map);
  const n = namer(ctx, view);
  const def = idx.byId.get(selected)!;
  const province = ctx.map.provinces.find((p) => p.id === def.province)!;
  const terrain = ctx.rules.terrain[def.terrain];
  const v = seen(view, selected);
  const mine = isMine(view, selected);
  const affordable = affordableTroops(ctx, plan);
  const [recruit, setRecruit] = useState(affordable);
  // Default the recruit amount to "as many as you can afford" whenever that changes.
  useEffect(() => setRecruit(affordable), [affordable, selected]);

  const header = (
    <>
      <div className="panel-head">
        <h2>
          {TERRAIN_ICON[def.terrain]} {def.name}
        </h2>
        {v && (
          <span className="owner-tag" style={{ background: colorOf(view, v.owner) }}>
            {n.who(v.owner)}
          </span>
        )}
      </div>
      <p className="muted small">
        {province.name} (+{province.bonus} if you hold it all) · {def.terrain}, defense ×{terrain.defenseMult}, +{terrain.income} gold
      </p>
    </>
  );

  if (!v)
    return (
      <div className="panel">
        {header}
        <p className="muted">Hidden by fog. You can see the land, but not who holds it or how many troops are there.</p>
      </div>
    );

  const facts = (
    <ul className="facts">
      <li>
        <b>{v.troops}</b> troops{mine && plan.free.get(selected) !== undefined ? ` (${plan.free.get(selected)} free to move)` : ""}
      </li>
      {v.specialists.length > 0 && <li>{v.specialists.map((s) => `${SPECIALIST_ICON[s.type]} ${SPECIALIST_NAME[s.type]}`).join(", ")}</li>}
      {v.building && <li>{`${BUILDING_ICON[v.building]} ${BUILDING_NAME[v.building]}`}</li>}
      {v.construction && <li>🚧 Building a {BUILDING_NAME[v.construction.building].toLowerCase()}</li>}
      {v.culture > 0 && <li>✦ Culture {v.culture}</li>}
      {v.leaders.length > 0 && <li>👑 {v.leaders.map((l) => (n.isMe(l) ? "Your Leader" : `${n.who(l)}'s Leader`)).join(", ")}</li>}
    </ul>
  );
  if (!mine)
    return (
      <div className="panel">
        {header}
        {facts}
      </div>
    );

  const site = isRecruitSite(view, selected);
  const cultureCost = nextCultureCost(ctx, plan, selected);
  const hires = hireOptions(ctx, view, plan, selected);
  const hasOwnNeighbour = (idx.neighbors.get(selected) ?? []).some((t) => isMine(view, t));
  return (
    <div className="panel">
      {header}
      {facts}
      <p className="muted small">Tap a neighbour on the map to move or attack.</p>

      {site && (
        <div className="action">
          <div className="row">
            <button disabled={recruit < 1} onClick={() => add({ kind: "recruit", territory: selected, count: recruit })}>
              Recruit {recruit}
            </button>
            <Stepper value={recruit} min={affordable > 0 ? 1 : 0} max={affordable} onChange={setRecruit} />
            <span className="muted small">{ctx.rules.troops.cost} gold each</span>
          </div>
        </div>
      )}

      {spendOpen && site && (
        <div className="action">
          <h3>Hire a specialist</h3>
          <div className="grid-buttons">
            {hires.map((h) => (
              <button
                key={h.specialist}
                disabled={!h.ok}
                title={h.why ?? SPECIALIST_HELP[h.specialist]}
                onClick={() => add({ kind: "hire", territory: selected, specialist: h.specialist as SpecialistType })}
              >
                {SPECIALIST_ICON[h.specialist]} {SPECIALIST_NAME[h.specialist]} <span className="cost">{h.cost}g</span>
                <span className="small muted block">{h.why ?? SPECIALIST_HELP[h.specialist]}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {spendOpen && !site && <p className="muted small">Specialists are hired at your capital or a barracks.</p>}

      {spendOpen && !plan.building.has(selected) && (
        <div className="action">
          <h3>Build</h3>
          <div className="grid-buttons">
            {buildOptions(ctx, plan, selected).map((b) => (
              <button key={b.building} disabled={!b.ok} onClick={() => add({ kind: "build", territory: selected, building: b.building })}>
                {BUILDING_ICON[b.building]} {BUILDING_NAME[b.building]} <span className="cost">{b.cost}g</span>
                <span className="small muted block">{BUILDING_HELP[b.building]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {spendOpen && hasOwnNeighbour && (
        <button onClick={() => add({ kind: "retreat", from: selected, preset: { id: "retreatIfOutnumbered" } })} title="Only pull back if a bigger enemy army is next door">
          ↩ Retreat only if outnumbered
        </button>
      )}
      {!spendOpen && cultureCost !== null && <p className="muted small">Culture here: {plan.culture.get(selected) ?? 0}. Raising it costs {cultureCost}g.</p>}
    </div>
  );
}
