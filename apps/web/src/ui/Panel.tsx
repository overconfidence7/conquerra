import type { SpecialistType } from "@conquerra/content";
import { amountLabel, indexMap, recruitLabel, type GameContext, type Order, type PlayerView, type TerritoryId } from "@conquerra/engine";
import { lazy, Suspense, useEffect, useState } from "react";
import {
  affordableTroops,
  amountChoices,
  amountPill,
  buildOptions,
  hireOptions,
  isAttack,
  isHireSite,
  isHop,
  isMine,
  isRecruitSite,
  planQueue,
  RECRUIT_CHOICES,
  recruitedBy,
  sameRecruit,
  justEnough,
  leaderCanJoin,
  nextCultureCost,
  ODDS_LABEL,
  oddsAreEstimate,
  oddsFor,
  presetsFor,
  sameAmount,
  seen,
  spyHireOption,
  timingAvailable,
  troopsOf,
  type MoveDraft,
  type QueuePlan,
} from "../logic/orders";
import { BUILDING_HELP, BUILDING_NAME, SPECIALIST_HELP, SPECIALIST_NAME, SPY_HELP, TERRAIN_ICON, namer } from "../logic/text";
import { closedNow } from "../logic/cards";
import { attackCheck } from "../logic/deals";
import { ArtIcon, buildingIcon, specialistIcon } from "./ArtIcon";
import { useGame } from "../store";
import { nearestRecruitSite, RECRUIT_RULE } from "../logic/actions";
import { colorOf } from "./colors";
import { cultureLine, cultureNext, placeFacts, wallAt, wallHint, wallLine } from "../map/card";

/** Your spies where they stand (session 15): loaded the first time there's one to show. */
const SpyRows = lazy(() => import("./Spies").then((m) => ({ default: m.SpyRows })));
/** Is there anything about spies to show here (one of yours, or a spy's report)? */
const spyNews = (view: PlayerView, t: TerritoryId) => view.spies.some((s) => s.at === t) || ((v) => v?.detail === "full" && v.seenBy.includes("spy"))(view.territories[t]);
import { CardRows } from "./TerritoryCard";
import { CommandRow } from "./Command";
import { pathSummary, planPath, type PathKind } from "../logic/paths";
import { passageNow } from "../logic/deals";
import { HintButton } from "./HintButton";
import { generalIn } from "../logic/generals";

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

/** The context panel: a draft move/attack if one is open, else the Recruit panel if it's open, else the selected territory. */
export function Panel(props: Props) {
  const recruit = useGame((s) => s.recruit);
  const path = useGame((s) => s.path);
  if (path) return <PathPanel {...props} path={path} />;
  if (props.draft) return <DraftPanel {...props} draft={props.draft} />;
  if (recruit) return <RecruitPanel {...props} order={recruit.order} />;
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

/**
 * The Recruit panel: how much of your gold to spend (All, 3/4, 1/2, 1/4, or an exact number under More) and where.
 * Every recruit site glows on the map; tap one to recruit there instead. Split troops across sites with
 * "Somewhere else too". With no recruit to edit, it says why the selected land can't recruit and offers the nearest site.
 */
function RecruitPanel({ ctx, view, queue, selected, order: orderId }: Props & { order: string | null }) {
  const { recruitAt, setRecruitAmount, splitRecruit, closeRecruit, remove } = useGame();
  const [more, setMore] = useState(false);
  const n = namer(ctx, view);
  const cost = ctx.rules.troops.cost;
  const i = queue.findIndex((o) => o.id === orderId);
  const order = i >= 0 ? queue[i]! : null;
  const head = (title: string) => (
    <div className="panel-head">
      <h2>{title}</h2>
      <button className="link" onClick={closeRecruit}>
        Done
      </button>
    </div>
  );
  if (!order || order.kind !== "recruit") {
    const cant = selected && !isRecruitSite(ctx, view, selected) ? selected : null;
    const nearest = nearestRecruitSite(ctx, view, selected);
    return (
      <div className="panel recruit-panel">
        {head("Recruit")}
        {cant && (
          <p className="warn">
            {n.place(cant)} can't recruit. {RECRUIT_RULE}.
          </p>
        )}
        {nearest && (
          <button className="primary wide" onClick={() => recruitAt(nearest)}>
            Recruit at {n.place(nearest)}
            {cant ? " (nearest)" : ""}
          </button>
        )}
        <p className="muted small">Or tap a glowing territory on the map.</p>
      </div>
    );
  }
  const plan = planQueue(ctx, view, queue);
  const troops = recruitedBy(ctx, plan, i);
  // An exact number can go up to what the gold left by then buys.
  const max = Math.floor(planQueue(ctx, view, queue.slice(0, i)).goldLeft / cost);
  const exact = typeof order.count === "number";
  return (
    <div className="panel recruit-panel">
      {head(`Recruit at ${n.place(order.territory)}`)}
      <div className="row send-row">
        <span>Troops</span>
        <span className="pill" aria-label="troops to recruit">
          {troops} · {troops * cost}g
        </span>
      </div>
      <div className="chips share-chips" role="radiogroup" aria-label="How much of your gold">
        {RECRUIT_CHOICES.map((a) => (
          <button key={recruitLabel(a)} role="radio" aria-checked={sameRecruit(order.count, a)} className={`chip ${sameRecruit(order.count, a) ? "on" : ""}`} onClick={() => setRecruitAmount(order.id, a)}>
            {recruitLabel(a)}
          </button>
        ))}
        <button className="chip" onClick={() => setMore((m) => !m)} aria-expanded={more}>
          {more ? "Less" : "More…"}
        </button>
      </div>
      <p className="muted small">Of your gold, {cost} gold a troop.</p>
      {(more || exact) && max > 0 && (
        <div className="row">
          <span className="muted small">Exactly</span>
          <Stepper value={exact ? Math.min(Number(order.count), max) : Math.max(1, troops)} min={1} max={max} onChange={(v) => setRecruitAmount(order.id, v)} />
        </div>
      )}
      {troops === 0 && <p className="warn">No gold left for this one: the orders before it spend it all.</p>}
      <p className="muted small">Tap a glowing territory to recruit there instead.</p>
      <div className="row">
        <button onClick={splitRecruit} title="Split your recruits: this one takes half, the next site you tap gets the rest">
          + Somewhere else too
        </button>
        <button className="link" onClick={() => remove(order.id)}>
          Remove
        </button>
      </div>
    </div>
  );
}

/**
 * Orders along a path (session 16): the shortest way or the full sweep to where you tapped, drawn on the map as a
 * numbered chain, with what it adds. Confirm puts its orders in your queue as one chain; each is an ordinary hop you
 * can change or delete there.
 */
function PathPanel({ ctx, view, queue, path }: Props & { path: { from: TerritoryId; to: TerritoryId; kind: PathKind } }) {
  const { setPathKind, confirmPath, cancelPath, pageDeals } = useGame();
  const n = namer(ctx, view);
  const open = passageNow(view, pageDeals());
  const plans = { shortest: planPath(ctx, view, queue, pageDeals(), open, { ...path, kind: "shortest" }), sweep: planPath(ctx, view, queue, pageDeals(), open, { ...path, kind: "sweep" }) };
  const p = plans[path.kind];
  const leader = p.orders.some((o) => o.kind === "move" && o.withLeader);
  return (
    <div className="panel path-panel">
      <div className="panel-head">
        <h2>Path to {n.place(path.to)}</h2>
        <button className="link" onClick={cancelPath}>
          Cancel
        </button>
      </div>
      <p className="muted">From {n.place(path.from)}</p>
      <div className="chips" role="radiogroup" aria-label="Which way">
        {(["shortest", "sweep"] as const).map((k) => (
          <button key={k} role="radio" aria-checked={path.kind === k} className={`chip ${path.kind === k ? "on" : ""}`} onClick={() => setPathKind(k)} title={PATH_HELP[k]} aria-label={`${k === "shortest" ? "Shortest way" : "Full sweep"}: ${plans[k].orders.length} order${plans[k].orders.length === 1 ? "" : "s"}`}>
            {k === "shortest" ? "Shortest way" : "Full sweep"} · {plans[k].orders.length}
          </button>
        ))}
      </div>
      <p className="muted small">{PATH_HELP[path.kind]}</p>
      <p className={p.orders.length ? "path-summary" : "warn"} role="status">
        {pathSummary(p, (t) => n.place(t))}
      </p>
      {p.orders.length > 0 && (
        <p className="muted small">
          Each hop sends All (leaving 1 behind) and attacks only if still stronger{leader ? "; your Leader goes along" : ""}. Your own land is walked through, never attacked.
        </p>
      )}
      <button className="primary wide" disabled={!p.orders.length} onClick={confirmPath}>
        Confirm: add {p.orders.length} {p.orders.length === 1 ? "order" : "orders"}
        <EnterHint />
      </button>
      <p className="muted small">They go in your orders as one chain: change or delete any step there.</p>
    </div>
  );
}

/** "↵" on a confirm button: Enter does it (on a laptop; hidden on a phone, where there's no keyboard). */
function EnterHint() {
  return (
    <kbd className="enter-hint" title="Enter confirms, Esc cancels">
      ↵
    </kbd>
  );
}

const PATH_HELP = {
  shortest: "The fewest steps there, through your own land where it can.",
  sweep: "Takes every territory it can between here and there, sweeping steadily toward the end, then ends there.",
} as const;

/** Presets shown up front; the rest wait behind "More". */
const MAIN_PRESETS = new Set(["onlyIfStronger", "followThrough"]);

function DraftPanel({ ctx, view, plan, queue, draft }: Props & { draft: MoveDraft }) {
  const { updateDraft, addDraft, clearSelection, select, pageDeals, startPath } = useGame();
  const [more, setMore] = useState(false);
  const n = namer(ctx, view);
  const attack = isAttack(view, draft, plan);
  const max = plan.free.get(draft.from) ?? 0;
  const troops = troopsOf(ctx, view, plan, draft);
  const estimate = oddsAreEstimate(plan, draft);
  const odds = attack ? oddsFor(ctx, view, plan, draft, troops) : null;
  const target = seen(view, draft.to);
  // A walled target (session 20b): its wall's shared garrison defends it too (the odds count it).
  const wall = attack ? wallAt(view, draft.to) : null;
  const enough = attack ? justEnough(ctx, view, plan, draft) : null;
  const lastStep = draft.through?.[draft.through.length - 1] ?? draft.via ?? draft.from;
  const crossing = indexMap(ctx.map).border(lastStep, draft.to) ?? "normal";
  // Just enough only when it would do; the exact number lives under More.
  const chips = amountChoices(attack).filter((a) => a !== "enough" || enough !== null);
  const exact = typeof draft.amount === "number";
  // Across a deal of yours: a binding pact blocks the attack; a handshake truce warns what breaking it costs.
  const check = attack ? attackCheck(ctx, view, pageDeals(), lastStep, draft.to) : null;
  const blocked = !!check && "block" in check;
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
        {draft.through ? ` through ${draft.through.map((t) => n.place(t)).join(", ")} (right of passage: it can't stop there)` : ""}
        {attack && target ? ` · defenders: ${wall ? wall.defend[draft.to] : target.troops}${target.owner ? ` (${n.who(target.owner)})` : " (neutral)"}` : ""}
      </p>
      {attack && wall && (
        <p className="muted small wall-note">
          {wallLine(ctx, view, draft.to)}: its wall lends its spare troops to this battle, and the odds count them.
        </p>
      )}
      {isHop(plan, draft.from) && <p className="muted small">A chained hop: the army that should arrive in {n.place(draft.from)} pushes on, in your next slot after it gets there.</p>}
      {draft.raise && <p className="arriving">Your attack on {n.place(draft.from)} will send All instead of Just enough, so there's an army to push on with.</p>}

      <div className="row send-row">
        <span>Send</span>
        <span className="pill" aria-label="troops to send">{amountPill(troops, draft.amount, estimate)}</span>
      </div>
      {max > 0 && (
        <div className="chips share-chips" role="radiogroup" aria-label="How many to send">
          {chips.map((a) => (
            <button key={amountLabel(a)} role="radio" aria-checked={sameAmount(draft.amount, a)} className={`chip ${sameAmount(draft.amount, a) ? "on" : ""}`} onClick={() => updateDraft({ amount: a })}>
              {amountLabel(a)}
            </button>
          ))}
        </div>
      )}
      {/* Your Leader goes with an army leaving its land by default (session 16); one tap leaves it home. */}
      {leaderCanJoin(view, draft.from, plan) && (
        <div className="chips leader-choice" role="radiogroup" aria-label="Your Leader">
          <button role="radio" aria-checked={draft.withLeader} className={`chip ${draft.withLeader ? "on" : ""}`} onClick={() => updateDraft({ withLeader: true })} title="Your Leader goes with this army (+20% strength) and carries on with it through a chain">
            👑 Leader goes (+20%)
          </button>
          <button role="radio" aria-checked={!draft.withLeader} className={`chip ${!draft.withLeader ? "on" : ""}`} onClick={() => updateDraft({ withLeader: false })} title="Your Leader stays where it is">
            Stays home
          </button>
        </div>
      )}
      {(more || exact) && max > 0 && (
        <div className="row">
          <span className="muted small">Exactly</span>
          <Stepper value={exact ? Math.min(Number(draft.amount), max) : troops} min={1} max={max} onChange={(v) => updateDraft({ amount: v })} />
        </div>
      )}
      {odds && (
        <div className={`odds odds-${odds}`}>
          Odds{estimate ? " (estimate)" : ""}: {ODDS_LABEL[odds]}
        </div>
      )}
      {odds && odds !== "unknown" && estimate && <p className="muted small">Its army depends on how the battle before it goes.</p>}
      {closedNow(view, lastStep, draft.to) && (
        <p className="warn small">The way across is closed this turn (a flood or a rockslide): this order won't go.</p>
      )}
      {attack && crossing !== "normal" && (
        <p className="muted small">
          {CROSSING[crossing]}: attack ×{ctx.rules.borders[crossing].attackMult}
        </p>
      )}
      {max === 0 && <p className="warn">No troops left to send from here this turn.</p>}
      {check && <p className={`warn deal-warn ${blocked ? "" : "small"}`} role="alert">{"block" in check ? check.block : check.warn}</p>}

      <div className="chips">
        {presetsFor(view, draft, plan).filter((p) => more || MAIN_PRESETS.has(p.id) || draft.preset === p.id).map((p) => (
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

      {view.me.leader.alive && (more || draft.timing) && (timingAvailable(view, queue, "first") || timingAvailable(view, queue, "last") || draft.timing) && (
        <div className="chips">
          {(timingAvailable(view, queue, "first") || draft.timing === "first") && (
            <HintButton
              className={`chip ${draft.timing === "first" ? "on" : ""}`}
              aria-pressed={draft.timing === "first"}
              onClick={() => updateDraft({ timing: draft.timing === "first" ? null : "first" })}
              hint={`Seize the Initiative: this order goes before everyone else's. Your Leader can do it once every ${ctx.rules.leader.seizeInitiativeCooldown} turns.`}
            >
              Initiative
            </HintButton>
          )}
          {(timingAvailable(view, queue, "last") || draft.timing === "last") && (
            <HintButton
              className={`chip ${draft.timing === "last" ? "on" : ""}`}
              aria-pressed={draft.timing === "last"}
              onClick={() => updateDraft({ timing: draft.timing === "last" ? null : "last" })}
              hint={`Lie in Wait: this order goes after everyone else's, once you've seen where they struck. Pairs well with Reinforce if hit. Once every ${ctx.rules.leader.lieInWaitCooldown} turns.`}
            >
              Wait
            </HintButton>
          )}
        </div>
      )}

      {!more && !draft.timing && <p className="muted small">More… has an exact number{view.me.leader.alive ? ", Initiative and Wait" : ""} and the other backup plans.</p>}
      <button className="primary wide" disabled={troops <= 0 || blocked} onClick={addDraft}>
        Add {attack ? "attack" : "move"}
        <EnterHint />
      </button>
      {draft.preset && <p className="muted small">{presetsFor(view, draft, plan).find((p) => p.id === draft.preset)?.description}</p>}
      {isMine(view, draft.to) && (
        <button className="link small" onClick={() => select(draft.to)}>
          Just select {n.place(draft.to)} instead
        </button>
      )}
      <button className="link small" onClick={() => startPath(draft.from)} title="Tap a place further away: the shortest way there, or sweep up everything in between">
        Further? Path…
      </button>
    </div>
  );
}

function TerritoryPanel({ ctx, view, plan, selected, spendOpen }: Props & { selected: TerritoryId }) {
  const { add, recruitAt, startPath } = useGame();
  const idx = indexMap(ctx.map);
  const n = namer(ctx, view);
  const def = idx.byId.get(selected)!;
  const v = seen(view, selected);
  const mine = isMine(view, selected);
  const affordable = affordableTroops(ctx, plan);

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
      <ul className="chips" aria-label="About this place">
        {placeFacts(ctx, view, selected).map((f) => (
          <li key={f.key}>
            {f.icon ? <ArtIcon name={f.icon} size={16} /> : <span aria-hidden>{TERRAIN_ICON[def.terrain]}</span>}
            {f.text}
          </li>
        ))}
      </ul>
      {plan.captured.has(selected) && (
        <p className="arriving">
          Your attack should take this: about {plan.arriving.get(selected) ?? 0} arrive. Tap a neighbour to push on from here.
        </p>
      )}
    </>
  );

  if (!v)
    return (
      <div className="panel">
        {header}
        {/* What you last saw there (with "?" and how long ago), as on the territory card. */}
        <CardRows ctx={ctx} view={view} id={selected} />
      </div>
    );

  const facts = (
    <ul className="facts">
      <li className="with-icon">
        <ArtIcon name="icon-troops" size={18} />
        <span>
          <b>{v.troops}</b> {v.troops === 1 ? "troop" : "troops"}
          {mine && plan.free.get(selected) !== undefined ? `, ${plan.free.get(selected)} can move` : ""}
          {/* The start bonus (session 23), on turn 1 at your capital. */}
          {selected === view.me.capital && view.turn === 1 && view.me.startBonus ? ` (${view.me.startBonus} of them extra at the start: a harder spot)` : ""}
        </span>
      </li>
      {/* Walls (session 20b): who'd defend it, with the wall's garrison. */}
      {wallAt(view, selected) && (
        <li className="with-icon wall-row">
          <ArtIcon name="icon-fort" size={18} />
          {wallLine(ctx, view, selected)}
        </li>
      )}
      {v.specialists.length > 0 && (
        <li>
          {v.specialists.map((s, i) => (
            <span key={i} className="with-icon">
              <ArtIcon name={specialistIcon(s.type)} size={18} />
              {SPECIALIST_NAME[s.type]}
            </span>
          ))}
        </li>
      )}
      {v.building && (
        <li className="with-icon">
          <ArtIcon name={buildingIcon(v.building)} size={18} />
          {BUILDING_NAME[v.building]}
        </li>
      )}
      {v.construction && (
        <li className="with-icon">
          <ArtIcon name={buildingIcon(v.construction.building)} size={18} />
          {BUILDING_NAME[v.construction.building]}: ⏳ ready next turn
        </li>
      )}
      {(v.culture > 0 || mine) && (
        <li className="with-icon">
          <ArtIcon name="icon-culture" size={18} />
          {cultureLine(ctx, view, selected, mine ? (plan.culture.get(selected) ?? v.culture) : v.culture, plan.culture)}
        </li>
      )}
      {v.leaders.length > 0 && <li className="with-icon"><ArtIcon name="icon-crown" size={18} />{v.leaders.map((l) => (n.isMe(l) ? "Your Leader" : `${n.who(l)}'s Leader`)).join(", ")}</li>}
    </ul>
  );
  const spies = spyNews(view, selected) && (
    <Suspense fallback={null}>
      <SpyRows ctx={ctx} view={view} at={selected} />
    </Suspense>
  );
  if (!mine)
    return (
      <div className="panel">
        {header}
        {facts}
        {spies}
      </div>
    );

  const site = isRecruitSite(ctx, view, selected);
  const hireHere = isHireSite(view, selected);
  const cultureCost = nextCultureCost(ctx, plan, selected);
  const hires = hireOptions(ctx, view, plan, selected);
  const spyHire = spyHireOption(ctx, view, plan, selected);
  const hasOwnNeighbour = (idx.neighbors.get(selected) ?? []).some((t) => isMine(view, t));
  // One of your generals stands here: what it's doing, and Command.
  const general = generalIn(view, selected);
  return (
    <div className="panel">
      {header}
      {general && <CommandRow key={general} ctx={ctx} view={view} general={general} />}
      {facts}
      {spies}
      <div className="row">
        <p className="muted small grow">Tap a neighbour on the map to move or attack.</p>
        {(plan.free.get(selected) ?? 0) > 0 && (
          <button onClick={() => startPath(selected)} title="Orders along a path: tap a place further away, then take the shortest way there or sweep up everything in between">
            Path…
          </button>
        )}
      </div>

      {site && (
        <div className="action">
          <div className="row">
            <button disabled={affordable < 1} onClick={() => recruitAt(selected)}>
              Recruit here ({affordable})
            </button>
            <span className="muted small">{ctx.rules.troops.cost} gold each</span>
          </div>
        </div>
      )}

      {spendOpen && hireHere && (
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
                <ArtIcon name={specialistIcon(h.specialist as SpecialistType)} size={22} /> {SPECIALIST_NAME[h.specialist]} <span className="cost">{h.cost}g</span>
                <span className="small muted block">{h.why ?? SPECIALIST_HELP[h.specialist]}</span>
              </button>
            ))}
            {spyHire && (
              <button disabled={!spyHire.ok} title={spyHire.why ?? SPY_HELP} onClick={() => add({ kind: "hireSpy", territory: selected })}>
                <ArtIcon name="icon-spy" size={20} /> Spy <span className="cost">{spyHire.cost}g</span>
                <span className="small muted block">{spyHire.why ?? SPY_HELP}</span>
              </button>
            )}
          </div>
        </div>
      )}
      {spendOpen && !hireHere && <p className="muted small">Specialists are hired at your capital or a barracks.</p>}

      {spendOpen && !plan.building.has(selected) && (
        <div className="action">
          <h3>Build</h3>
          <div className="grid-buttons">
            {buildOptions(ctx, plan, selected).map((b) => (
              <button key={b.building} disabled={!b.ok} onClick={() => add({ kind: "build", territory: selected, building: b.building })}>
                <ArtIcon name={buildingIcon(b.building)} size={22} /> {BUILDING_NAME[b.building]} <span className="cost">{b.cost}g</span>
                <span className="small muted block">
                  {BUILDING_HELP[b.building]}
                  {b.building === "fort" && wallHint(ctx, view, selected, "fort", plan.culture) ? ` ${wallHint(ctx, view, selected, "fort", plan.culture)}.` : ""}
                </span>
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
      {!spendOpen && cultureCost !== null && <p className="muted small">Next: {cultureNext(ctx, view, selected, plan.culture.get(selected) ?? 0, plan.culture)}</p>}
    </div>
  );
}
