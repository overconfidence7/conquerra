import { isShareBudget, leaderAt, leaderKey, pursesTotal, type Budget, type GameContext, type LeaderRecord, type Order, type PlayerView, type TerritoryId } from "@conquerra/engine";
import type { LeaderNote } from "@conquerra/bots";
import { incomeEstimate } from "../logic/actions";
import { lazy, Suspense, useState } from "react";
import { authorKey } from "../logic/generals";
import { missionGoal, rewardText, turnsLeft } from "../logic/cards";
import { budgetLabel, instructionDoing, KIND_NAME, leaderNoteLine, namer } from "../logic/text";
import { useGame } from "../store";
import { CardStack } from "./CardStack";
import { GeneralPortrait } from "./Command";
import { colorOf } from "./colors";
import { Frame } from "./Frame";

/** The Command menu: loaded the first time it's opened. */
const CommandMenu = lazy(() => import("./CommandMenu"));

/**
 * A Steward's mark until Steward portraits are made (a later art batch): its House's shield, with a quill.
 */
export function StewardSeal({ color, size = 36 }: { color: string; size?: number }) {
  return (
    <svg className="steward-seal" width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <path d="M20 3 L35 8 V19 C35 28 28 34 20 37 C12 34 5 28 5 19 V8 Z" fill={color} stroke="#c9a45c" strokeWidth="2.2" />
      <path d="M27 9 C21 12 16 19 14 29 L16 29 C18 21 22 15 27 9 Z" fill="#f3e8cc" stroke="#3a2c18" strokeWidth="0.8" />
      <path d="M14 29 L12.5 33" stroke="#3a2c18" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** A leader's portrait: a military leader's is its House's Leader portrait; a Steward's, the House shield with a quill. */
export function LeaderPortrait({ view, l, size = 36 }: { view: PlayerView; l: Pick<LeaderRecord, "kind" | "of">; size?: number }) {
  return l.kind === "leader" ? <GeneralPortrait view={view} general={l.of} size={size} /> : <StewardSeal color={colorOf(view, l.of)} size={size} />;
}

/** One line on what a leader is doing this turn. */
function doingLine(ctx: GameContext, view: PlayerView, l: LeaderRecord, command: LeaderRecord["command"], paused: boolean, note?: LeaderNote): string {
  const n = namer(ctx, view);
  const at = leaderAt(view.me, l);
  if (l.kind === "leader" && l.of === view.me.id && !view.me.leader.alive) return "Fallen: returns at the end of this turn.";
  if (!command) return l.kind === "leader" ? "No command: you order its army." : "No command: it waits, saving its purse.";
  const doing = instructionDoing(command, n, at, l.kind);
  if (paused) return `${doing}, but you gave its army an order: yours to command this turn.`;
  if ((command.kind === "push" || command.kind === "expand") && at === command.territory) return `Holding ${n.place(at)}: it got there.`;
  // Its reason for this turn (session 20): finishing a rival off, pushing one back, or what it's saving for.
  if (note) return note.kind === "finishing" ? leaderNoteLine(note, n) : `${doing}. ${leaderNoteLine(note, n)}.`;
  return doing;
}

/** The share of your income other leaders' budgets take, and their exact amounts (this turn's changes included). */
function othersBudgets(view: PlayerView, budgets: Record<string, { budget?: Budget }>, except: string): { share: number; gold: number } {
  let share = 0, gold = 0;
  for (const l of view.me.leaders ?? []) {
    const k = leaderKey(l);
    if (k === except) continue;
    const b = budgets[k]?.budget ?? l.budget;
    if (isShareBudget(b)) share += b.share;
    else gold += b.gold;
  }
  return { share, gold };
}

/**
 * The budget control: a share of income (chips), or an exact amount each turn. Budgets add up to at most all of your
 * income (session 20): the chips offer only what's left, and the exact amount stops at the income that's left.
 */
function BudgetControl({ ctx, budget, left, leftGold, onSet }: { ctx: GameContext; budget: Budget; left: number; leftGold: number; onSet(b: Budget): void }) {
  const [exact, setExact] = useState(isShareBudget(budget) ? "" : String(budget.gold));
  const max = Math.max(0, Math.min(ctx.rules.leaders.maxGoldBudget, leftGold));
  const chips = ctx.rules.leaders.shareChips.filter((s) => s <= left + 1e-9);
  // What's left exactly, when it isn't one of the chips (80% given away: "20%").
  if (left > 1e-9 && !chips.some((s) => Math.abs(s - left) < 1e-9) && left < Math.max(...ctx.rules.leaders.shareChips)) chips.push(Math.round(left * 100) / 100);
  return (
    <div className="action budget">
      <p className="small">Each turn, as income comes in, its purse gets{left < 1 - 1e-9 ? ` (${Math.round(left * 100)}% of your income is left to give)` : ""}:</p>
      <div className="chips" role="radiogroup" aria-label="Share of your income">
        {chips.map((s) => (
          <button key={s} role="radio" aria-checked={isShareBudget(budget) && Math.abs(budget.share - s) < 1e-9} className={`chip ${isShareBudget(budget) && Math.abs(budget.share - s) < 1e-9 ? "on" : ""}`} onClick={() => onSet({ share: s })}>
            {Math.round(s * 100)}%
          </button>
        ))}
      </div>
      <label className="small budget-exact">
        or exactly
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={max}
          value={exact}
          placeholder="8"
          aria-label="An exact amount of gold each turn"
          onChange={(e) => {
            setExact(e.target.value);
            const v = Math.floor(Number(e.target.value));
            if (e.target.value !== "" && Number.isFinite(v)) onSet({ gold: Math.max(0, Math.min(max, v)) });
          }}
        />
        gold a turn
      </label>
    </div>
  );
}

/**
 * The Leaders panel (session 18): every leader of yours (your Leader and Steward, then captured ones) with its portrait,
 * name, kind, what it's doing, its purse and budget. Tap one for Command, Budget and Take back. Desktop: the right
 * column; phone: the Leaders sheet, opened from your Leader's portrait.
 */
export function LeadersPanel({ ctx, view, queue, onShow, onCards }: { ctx: GameContext; view: PlayerView; queue: readonly Order[]; onShow(t: TerritoryId): void; /** Open your cards (Spoils and missions). */ onCards(): void }) {
  const { instructions, budgets, paused, leaderOpen, openLeader, setBudget, takeBack, showMission, mission, leaderNotes } = useGame();
  const [menu, setMenu] = useState<"command" | "budget" | null>(null);
  const n = namer(ctx, view);
  const leaders = view.me.leaders ?? [];
  const total = pursesTotal(view.me);
  const counts = new Map<string, number>();
  for (const o of queue) {
    const k = authorKey(o);
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const ready = (k: number) => (k === 0 ? "ready" : `in ${k} turn${k === 1 ? "" : "s"}`);
  const all = othersBudgets(view, budgets, "");
  const income = Math.max(0, incomeEstimate(ctx, view));
  return (
    <Frame className="slim leaders" title="Leaders" extra={total > 0 ? <span className="cost" title="Gold in your leaders' purses">{total}g in purses</span> : undefined}>
      <p className="small budgets-total" aria-label="Your leaders' budgets">
        Budgets: <b>{Math.round(all.share * 100)}%</b> of income{all.gold > 0 ? ` + ${all.gold}g a turn` : ""}
      </p>
      <ul className="leader-list" aria-label="Your leaders">
        {leaders.map((l) => {
          const key = leaderKey(l);
          const open = leaderOpen === key;
          const command = key in instructions ? instructions[key]! : l.command;
          const budget = budgets[key]?.budget ?? l.budget;
          const taking = budgets[key]?.takeBack ?? 0;
          const purse = Math.max(0, l.purse - taking);
          const own = l.of === view.me.id;
          const at = leaderAt(view.me, l);
          const written = counts.get(key) ?? 0;
          return (
            <li key={key} className={`leader-row ${open ? "open" : ""}`}>
              <button className="leader-head" aria-expanded={open} onClick={() => (openLeader(open ? null : key), setMenu(null))}>
                <LeaderPortrait view={view} l={l} size={own && l.kind === "leader" ? 44 : 36} />
                <span className="leader-who">
                  <b>{l.name}</b> <span className="muted small">{own ? `your ${KIND_NAME[l.kind]}` : `${n.who(l.of)}'s old ${KIND_NAME[l.kind]}`}</span>
                  <span className="block small">{doingLine(ctx, view, l, command, paused.includes(key), key in instructions ? undefined : leaderNotes[key])}</span>
                  <span className="block small purse-line">
                    Purse <b>{purse}g</b>
                    {taking > 0 && <span className="muted"> ({taking}g coming home)</span>} · {budgetLabel(budget)}
                    {written > 0 && <span className="muted"> · {written} order{written === 1 ? "" : "s"} this turn</span>}
                  </span>
                </span>
              </button>
              {open && (
                <div className="leader-tools">
                  <div className="row-buttons">
                    <button className={menu === "command" ? "on" : ""} onClick={() => setMenu(menu === "command" ? null : "command")}>
                      Command
                    </button>
                    <button className={menu === "budget" ? "on" : ""} onClick={() => setMenu(menu === "budget" ? null : "budget")}>
                      Budget
                    </button>
                    {purse > 0 && (
                      <button onClick={() => void takeBack(key)} title="Bring its purse back into your treasury (it arrives as the turn starts)">
                        Take back {purse}g
                      </button>
                    )}
                    {at && (
                      <button className="link" onClick={() => onShow(at)}>
                        Show
                      </button>
                    )}
                  </div>
                  {own && l.kind === "leader" && view.me.leader.alive && (
                    <p className="powers small">
                      Seize the Initiative {ready(view.me.cooldowns.seize)} · Lie in Wait {ready(view.me.cooldowns.lie)}
                    </p>
                  )}
                  {menu === "command" && (
                    <Suspense fallback={null}>
                      <CommandMenu view={view} general={key} kind={l.kind} current={command} onDone={() => setMenu(null)} />
                    </Suspense>
                  )}
                  {menu === "budget" &&
                    (() => {
                      const o = othersBudgets(view, budgets, key);
                      return <BudgetControl ctx={ctx} budget={budget} left={Math.max(0, 1 - o.share)} leftGold={Math.floor(income * Math.max(0, 1 - o.share)) - o.gold} onSet={(b) => void setBudget(key, b)} />;
                    })()}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <CardStack ctx={ctx} view={view} onOpen={onCards} />
      {view.me.missions.length > 0 && (
        <ul className="mission-lines" aria-label="Your missions">
          {view.me.missions.map((m) => {
            const left = turnsLeft(m, view.turn);
            return (
              <li key={m.id}>
                <button className={`mission-line ${mission === m.id ? "on" : ""}`} onClick={() => showMission(mission === m.id ? null : m.id)} title="Light it up on the map" aria-pressed={mission === m.id}>
                  <span className="mission-mark" aria-hidden>
                    ◆
                  </span>
                  <span>
                    {missionGoal(ctx, m, n).replace(/ by the end of turn \d+$/, "")} <b>{rewardText(m)}</b>
                    <span className={`due ${left === 0 ? "last" : ""}`}>{left === 0 ? "last turn" : `${left + 1} turns`}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Frame>
  );
}

/**
 * Where your leaders' orders go in your queue (Nate's setting, session 18): mixed in with yours (one of yours, then one
 * of theirs), or after yours. In Settings, and as a small switch at the top of the queue.
 */
export function PlacementSwitch({ compact = false }: { compact?: boolean }) {
  const { leaderPlacement, setLeaderPlacement } = useGame();
  const options: ["mixed" | "after", string][] = [
    ["mixed", "Mixed in"],
    ["after", "After mine"],
  ];
  return (
    <div className={compact ? "placement small" : "menu-item"} role="radiogroup" aria-label="Leaders' orders">
      <span>{compact ? "Leaders" : "Leaders' orders"}</span>
      <span className="seg">
        {options.map(([c, label]) => (
          <button key={c} role="radio" aria-checked={leaderPlacement === c} className={leaderPlacement === c ? "on" : ""} onClick={() => setLeaderPlacement(c)}>
            {label}
          </button>
        ))}
      </span>
    </div>
  );
}
