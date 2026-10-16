import { spiesOn, type Order, type PlayerId, type TerritoryId } from "@conquerra/engine";
import type { Board } from "./board";
import { cloudBorders, provinceOpen } from "./known";

/**
 * The Captain's spies (session 15, design additions §8). It hires one or two when it has gold to spare, and judges only
 * from what it sees, its memory and its own spies' reports (false ones included):
 *  - its first spy goes into the province of its main target (the runaway leader, its focus, a fast attacker, else
 *    the strongest rival it borders): the province that rival holds whole, its capital's first;
 *  - its second stands guard in a province it holds whole that a rival borders (defenders block other spies);
 *  - a spy already there, or on its way, is left alone.
 * The Recruit doesn't use spies. Every number is in `rules.spies` (`bots`).
 */
export function captainSpies(b: Board, newId: () => string, gold: number, limits?: { max: number; fromTurn: number; reserve: number }): { orders: Order[]; spent: number } {
  const { view, rules, idx, me, look0, owned } = b;
  const r = rules.spies;
  // (The Marshal's personalities set their own limits; the Captain's are the rules' `spies.bots`.)
  const lim = limits ?? r?.bots;
  const out: Order[] = [];
  if (!spiesOn(view) || !r || !b.on("spies")) return { orders: out, spent: 0 };
  // (Under blackout a spy always stands on land it can see; `?? ""` only keeps a stray id from throwing.)
  const province = (t: TerritoryId) => idx.byId.get(t)?.province ?? "";
  const members = (p: string) => idx.provinceMembers.get(p) ?? [];
  // (Session 32: a province reaching into the cloud can't be known to be held whole.)
  const holds = (who: PlayerId, p: string) => members(p).length > 0 && members(p).every((t) => look0(t) === who) && !provinceOpen(b.ctx.map, p);

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
  // Session 32, blackout: a spy with no rival to watch heads for the cloud (the known province with the most borders
  // into it; its report lifts the cloud as it goes, as a person's does). Never with standard fog (no cloud).
  const cloudAt = (p: string) => members(p).reduce((a, t) => a + cloudBorders(b.ctx.map, t), 0);
  const cloud = ctxProvinces(b).filter((p) => cloudAt(p) > 0 && !holds(me.id, p)).sort((x, y) => cloudAt(y) - cloudAt(x) || (x < y ? -1 : 1))[0] ?? null;
  spies.forEach((spy, i) => {
    const job = jobs[i] ?? attack ?? cloud;
    if (!job) return;
    const there = province(spy.at) === job;
    if (spy.target === job || (there && !spy.target)) return;
    out.push({ id: newId(), kind: "spy", spy: spy.id, to: job });
  });

  // Hire one when there's gold to spare (and something to do with it), at the capital or a barracks.
  let spent = 0;
  const site = owned(me.capital) ? me.capital : b.mine.find((t) => b.seen(t)?.building === "barracks");
  if (site && lim && jobs.length > spies.length && spies.length < Math.min(r.max, lim.max) && view.turn >= lim.fromTurn && gold >= r.cost + lim.reserve) {
    out.push({ id: newId(), kind: "hireSpy", territory: site });
    spent = r.cost;
  }
  return { orders: out, spent };
}

const ctxProvinces = (b: Board) => b.ctx.map.provinces.map((p) => p.id);
