import { spiesOn, type Order, type PlayerId, type TerritoryId } from "@conquerra/engine";
import type { Board } from "./board";

/**
 * The Captain's spies (session 15, design additions §8). It hires one or two when it has gold to spare, and judges only
 * from what it sees, its memory and its own spies' reports (false ones included):
 *  - its first spy goes into the province of its main target (the runaway leader, its focus, a fast attacker, else
 *    the strongest rival it borders): the province that rival holds whole, its capital's first;
 *  - its second stands guard in a province it holds whole that a rival borders (defenders block other spies);
 *  - a spy already there, or on its way, is left alone.
 * The Recruit doesn't use spies. Every number is in `rules.spies` (`bots`).
 */
export function captainSpies(b: Board, newId: () => string, gold: number): { orders: Order[]; spent: number } {
  const { view, rules, idx, me, look0, owned } = b;
  const r = rules.spies;
  const out: Order[] = [];
  if (!spiesOn(view) || !r || !b.on("spies")) return { orders: out, spent: 0 };
  const province = (t: TerritoryId) => idx.byId.get(t)!.province;
  const members = (p: string) => idx.provinceMembers.get(p) ?? [];
  const holds = (who: PlayerId, p: string) => members(p).length > 0 && members(p).every((t) => look0(t) === who);

  // Whose secrets it wants: its main target, else the strongest rival next to it.
  const strongest = [...b.facing].sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1))[0]?.[0] ?? null;
  const mark = b.runaway ?? b.focus ?? b.raider ?? strongest;
  let attack: string | null = null;
  if (mark) {
    const known = ctxProvinces(b).filter((p) => holds(mark, p));
    const capitalProv = idx.ids.find((t) => b.seen(t)?.capitalOf === mark);
    // A province it holds whole (its capital's first), else where most of its land is (the spy travels there and
    // lifts the fog on the way).
    attack =
      (capitalProv && known.includes(province(capitalProv)) ? province(capitalProv) : null) ??
      known[0] ??
      [...new Set(idx.ids.filter((t) => look0(t) === mark).map(province))].sort((x, y) => members(y).filter((t) => look0(t) === mark).length - members(x).filter((t) => look0(t) === mark).length || (x < y ? -1 : 1))[0] ??
      null;
  }
  // A province of ours to guard: held whole, with a rival next to it.
  const guard =
    ctxProvinces(b)
      .filter((p) => holds(me.id, p) && members(p).some((t) => idx.neighbors.get(t)!.some((x) => !!b.rivalAt(x))))
      .sort((x, y) => Number(members(y).includes(me.capital)) - Number(members(x).includes(me.capital)) || (x < y ? -1 : 1))[0] ?? null;

  const spies = [...view.spies].sort((x, y) => x.id.length - y.id.length || (x.id < y.id ? -1 : 1));
  const jobs = [attack, guard].filter((x): x is string => !!x);
  spies.forEach((spy, i) => {
    const job = jobs[i] ?? attack;
    if (!job) return;
    const there = province(spy.at) === job;
    if (spy.target === job || (there && !spy.target)) return;
    out.push({ id: newId(), kind: "spy", spy: spy.id, to: job });
  });

  // Hire one when there's gold to spare (and something to do with it), at the capital or a barracks.
  let spent = 0;
  const site = owned(me.capital) ? me.capital : b.mine.find((t) => b.seen(t)?.building === "barracks");
  if (site && jobs.length > spies.length && spies.length < Math.min(r.max, r.bots.max) && view.turn >= r.bots.fromTurn && gold >= r.cost + r.bots.reserve) {
    out.push({ id: newId(), kind: "hireSpy", territory: site });
    spent = r.cost;
  }
  return { orders: out, spent };
}

const ctxProvinces = (b: Board) => b.ctx.map.provinces.map((p) => p.id);
