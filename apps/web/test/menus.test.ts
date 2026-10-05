import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { createGame, incomeFor, resolveTurn, viewFor, type GameContext, type ReplayEvent } from "@conquerra/engine";
import { recruitBot } from "@conquerra/bots";
import { beforeEach, describe, expect, it } from "vitest";
import { LocalGame } from "../src/host/localGame";
import type { GameHost, LobbySettings } from "../src/host/protocol";
import { actionBarState, incomeEstimate, nearestRecruitSite } from "../src/logic/actions";
import { isMine, justEnough, moveTargets, planQueue } from "../src/logic/orders";
import { groupReport } from "../src/logic/report";
import { namer } from "../src/logic/text";
import { setHostFactory, useGame } from "../src/store";

const ctx: GameContext = { map: maps.embervale!, rules: defaultRules };

function inProcessHost(seed: string): GameHost {
  let game: LocalGame | null = null;
  return {
    start: async (s: LobbySettings) => (game = new LocalGame(s, seed)).start(),
    lockIn: async (orders, turn) => game!.lockIn(orders, turn),
    saveOrders: (orders, turn) => game?.saveOrders(orders, turn),
    onAutoLock: () => {},
    watchNext: async () => game!.watchNext(),
    finish: async () => game!.finish(),
    suggest: async () => game!.suggest(),
    save: async (notes) => game!.save(notes),
    dispose: () => {},
  };
}

describe("tap count: a typical turn takes 7 taps or fewer", () => {
  beforeEach(() => {
    setHostFactory(() => inProcessHost("taps"));
    useGame.getState().playAgain();
  });

  it("recruit, two attacks (with 'Only if still stronger'), lock in", async () => {
    await useGame.getState().start();
    let taps = 0;
    const tap = <T,>(f: () => T) => (taps++, f());
    const g = () => useGame.getState();
    // The game opens with your capital selected.
    expect(g().selected).toBe(g().view!.me.capital);
    // 1. Recruit (the round button): all you can afford, at the capital.
    tap(() => g().quickRecruit());
    // Two attacks on the nearest enemy or neutral land, each from the army with the most troops free.
    for (let k = 0; k < 2; k++) {
      const { ctx, view, queue, selected } = g();
      const plan = planQueue(ctx!, view!, queue);
      const sources = [...plan.free].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);
      const used = new Set(queue.flatMap((o) => (o.kind === "move" ? [o.to] : [])));
      const pick = sources.flatMap(([from]) => moveTargets(ctx!, view!, from).filter((t) => !isMine(view!, t.to) && !used.has(t.to)).map((t) => ({ from, to: t.to })))[0]!;
      if (selected !== pick.from) tap(() => g().tap(pick.from));
      tap(() => g().tap(pick.to));
      expect(g().draft?.preset).toBe("onlyIfStronger");
      // A first attack already sends "Just enough", so one army can make both attacks with no extra taps.
      const enough = justEnough(g().ctx!, g().view!, planQueue(g().ctx!, g().view!, g().queue), g().draft!);
      expect(g().draft?.amount).toBe(enough === null ? "all" : "enough");
      tap(() => g().addDraft());
    }
    await tap(() => g().lockIn());
    const q = g().report!;
    expect(q.turn).toBe(1);
    expect(q.events.filter((e) => e.type === "recruited" || e.type === "battle" || e.type === "fizzled").length).toBeGreaterThanOrEqual(3);
    console.log(`Typical turn: ${taps} taps`);
    expect(taps).toBeLessThanOrEqual(7);
  });

  it("recruit, an attack and a chained hop on from there, lock in", async () => {
    await useGame.getState().start();
    let taps = 0;
    const tap = <T,>(f: () => T) => (taps++, f());
    const g = () => useGame.getState();
    const cap = g().view!.me.capital;
    const near = (t: string) => ctx.map.borders.flatMap((b) => (b.a === t ? [b.b] : b.b === t ? [b.a] : []));
    tap(() => g().quickRecruit());
    // A neighbour to take, and a place beyond it the capital can't reach in one step.
    const beyondOf = (t: string) => near(t).find((x) => x !== cap && !near(cap).includes(x));
    const first = near(cap).find((t) => !isMine(g().view!, t) && beyondOf(t))!;
    const beyond = beyondOf(first)!;
    tap(() => g().tap(first));
    tap(() => g().addDraft());
    // Tap past the arrow: the next hop starts from where the army is heading, and sends All.
    tap(() => g().tap(beyond));
    expect(g().draft).toMatchObject({ from: first, to: beyond, amount: "all" });
    // The first attack sent Just enough: adding the hop raises it to All, so there is an army to push on with.
    expect(g().draft?.raise).toBe(g().queue[1]!.id);
    tap(() => g().addDraft());
    expect(g().queue.flatMap((o) => (o.kind === "move" ? [`${o.from}>${o.to}`] : []))).toEqual([`${cap}>${first}`, `${first}>${beyond}`]);
    await tap(() => g().lockIn());
    console.log(`Turn with a chained hop: ${taps} taps`);
    expect(taps).toBeLessThanOrEqual(7);
  });
});

describe("action bar", () => {
  it("Recruit goes to the selected territory if it can recruit (the capital when nothing is selected); otherwise the panel offers the nearest site", () => {
    const s = createGame(ctx, { gameId: "a", seed: "ab", players: [{ id: "p1", name: "A" }, { id: "p2", name: "B" }] });
    const view = viewFor(ctx, s, "p1");
    const plan = planQueue(ctx, view, []);
    const enemy = Object.keys(view.territories).find((t) => !isMine(view, t))!;
    const a = actionBarState(ctx, view, plan, enemy);
    // Can't recruit there: Recruit still works, with no place yet (the panel explains and offers the capital).
    expect(a.recruit).toMatchObject({ ok: true, at: null });
    expect(nearestRecruitSite(ctx, view, enemy)).toBe(view.me.capital);
    expect(actionBarState(ctx, view, plan, null).recruit).toMatchObject({ ok: true, at: view.me.capital });
    expect(actionBarState(ctx, view, plan, view.me.capital).recruit).toMatchObject({ ok: true, at: view.me.capital });
    expect(a.recruit.count).toBe(Math.floor(view.me.gold / ctx.rules.troops.cost));
    expect(a.spend.ok).toBe(false);
    expect(actionBarState(ctx, view, plan, view.me.capital).spend.ok).toBe(true);
  });

  it("the gold (+N per turn) matches what the engine pays", () => {
    let s = createGame(ctx, { gameId: "i", seed: "income", players: [1, 2, 3].map((i) => ({ id: `p${i}`, name: `P${i}` })) });
    for (let turn = 0; turn < 6; turn++) {
      for (const p of s.players) expect(incomeEstimate(ctx, viewFor(ctx, s, p.id))).toBe(incomeFor(ctx, s, p.id).net);
      const orders = Object.fromEntries(s.players.map((p) => [p.id, recruitBot.plan(ctx, viewFor(ctx, s, p.id))]));
      s = resolveTurn(ctx, s, orders).state;
    }
  });
});

describe("turn report", () => {
  it("puts your gains and losses first, then what you saw, then the fog", () => {
    const s = createGame(ctx, { gameId: "r", seed: "rep", players: [{ id: "p1", name: "A" }, { id: "p2", name: "Bob" }] });
    const view = viewFor(ctx, s, "p1");
    const n = namer(ctx, view);
    const t = (i: number) => ctx.map.territories[i]!.id;
    const ev: ReplayEvent[] = [
      { type: "recruited", step: 1, player: "p2", orderId: "a", territory: t(3), count: 2, cost: 6 },
      { type: "surface", step: 2, what: "battle", province: ctx.map.provinces[0]!.id },
      { type: "surface", step: 3, what: "battle", province: ctx.map.provinces[0]!.id },
      { type: "battle", step: 4, player: "p2", orderId: "b", from: t(1), to: t(2), defender: "p1", attackers: { troops: 5, specialists: [] }, withLeader: false, defenders: { troops: 1, specialists: [] }, result: { attackStrength: 5, defenseStrength: 1, expectedDefenderLosses: 1, expectedAttackerLosses: 0, defenderLosses: 1, attackerLosses: 0 }, captured: true, specialistsLost: [], defense: { fort: false, culture: 0, leader: false } },
      { type: "income", step: 5, player: "p1", income: 9, upkeep: 0, goldAfter: 20, deserted: 0, deserters: [] },
      { type: "recruited", step: 0, player: "p1", orderId: "c", territory: t(0), count: 3, cost: 9 },
    ];
    const r = groupReport(ctx, ev, n);
    expect(r.yours.map((l) => l.text)).toEqual([expect.stringMatching(/^Bob attacked .* and took it/), expect.stringMatching(/^You recruited 3/), expect.stringMatching(/^Income/)]);
    expect(r.seen.map((l) => l.text)).toEqual([expect.stringMatching(/^Bob recruited 2/)]);
    expect(r.fog).toEqual([{ text: `Battles in ${ctx.map.provinces[0]!.name} (2)`, tone: "quiet" }]);
  });
});

describe("Recruit panel", () => {
  beforeEach(() => {
    setHostFactory(() => inProcessHost("recruit-panel"));
    useGame.getState().playAgain();
  });

  it("one tap recruits All at the selected site and opens the panel; chips change the amount; splitting sends the rest elsewhere", async () => {
    await useGame.getState().start();
    const g = () => useGame.getState();
    const cap = g().view!.me.capital;
    g().quickRecruit();
    expect(g().queue).toMatchObject([{ kind: "recruit", territory: cap, count: "all" }]);
    const id = g().queue[0]!.id;
    expect(g().recruit).toEqual({ order: id });
    g().setRecruitAmount(id, { share: 0.25 });
    let plan = planQueue(g().ctx!, g().view!, g().queue);
    expect(plan.costs[0]).toBe(Math.floor((g().view!.me.gold * 0.25) / 2) * 2);
    g().setRecruitAmount(id, "all");
    // Somewhere else too: this one becomes half, and the next site tapped gets the rest.
    g().splitRecruit();
    expect(g().queue[0]).toMatchObject({ count: { share: 0.5 } });
    expect(g().recruit).toEqual({ order: null });
    g().tap(cap);
    expect(g().queue).toHaveLength(2);
    expect(g().queue[1]).toMatchObject({ kind: "recruit", territory: cap, count: "all" });
    plan = planQueue(g().ctx!, g().view!, g().queue);
    expect(plan.goldLeft).toBeLessThan(2);
    // Tapping land that can't recruit closes the panel and taps as usual.
    const other = Object.keys(g().view!.territories).find((t) => !isMine(g().view!, t))!;
    g().tap(other);
    expect(g().recruit).toBeNull();
  });

  it("a recruit in the queue can be reopened and moved; selecting land that can't recruit offers the nearest site", async () => {
    await useGame.getState().start();
    const g = () => useGame.getState();
    const cap = g().view!.me.capital;
    const other = Object.keys(g().view!.territories).find((t) => !isMine(g().view!, t))!;
    g().select(other);
    g().quickRecruit();
    // No order yet: the panel explains and offers the nearest site.
    expect(g().queue).toHaveLength(0);
    expect(g().recruit).toEqual({ order: null });
    g().recruitAt(nearestRecruitSite(g().ctx!, g().view!, other)!);
    expect(g().queue).toMatchObject([{ kind: "recruit", territory: cap }]);
    g().closeRecruit();
    g().openRecruit(g().queue[0]!.id);
    expect(g().selected).toBe(cap);
    g().remove(g().queue[0]!.id);
    expect(g().recruit).toBeNull();
  });
});
