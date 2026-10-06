import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { createGame, resolveTurn, replayFor, viewFor, type GameContext, type ReplayEvent } from "@conquerra/engine";
import { recruitBot } from "@conquerra/bots";
import { describe, expect, it } from "vitest";
import { BEAT_MS, buildTimeline, frameAt, replayView, TARGET_MAX_MS } from "../src/replay/timeline";
import { toastFor } from "../src/replay/toasts";

const ctx: GameContext = { map: maps.embervale!, rules: defaultRules };
const army = (troops: number) => ({ troops, specialists: [] });
const battle = (step: number, from: string, to: string, captured: boolean): ReplayEvent => ({
  type: "battle",
  step,
  player: "p2",
  orderId: "x",
  from,
  to,
  defender: "p1",
  attackers: army(10),
  withLeader: false,
  defenders: army(4),
  result: { attackStrength: 10, defenseStrength: 4, expectedDefenderLosses: 4, expectedAttackerLosses: 2, defenderLosses: 4, attackerLosses: 2 },
  captured,
  specialistsLost: [],
  defense: { fort: false, culture: 0, leader: false },
});
const t = (i: number) => ctx.map.territories[i]!.id;

describe("replay timeline", () => {
  const events: ReplayEvent[] = [
    { type: "turnStart", step: 0, turn: 3, seats: ["p1", "p2"] },
    { type: "recruited", step: 1, player: "p1", orderId: "a", territory: t(0), count: 3, cost: 9 },
    { type: "recruited", step: 2, player: "p2", orderId: "b", territory: t(5), count: 2, cost: 6 },
    { type: "moved", step: 3, player: "p1", orderId: "c", from: t(0), to: t(1), army: army(5), withLeader: false, retreat: false },
    battle(4, t(5), t(1), true),
    { type: "surface", step: 5, what: "battle", province: ctx.map.provinces[3]!.id },
    { type: "income", step: 6, player: "p1", income: 9, upkeep: 0, goldAfter: 20, deserted: 0, deserters: [] },
  ];

  it("plays in step order, folds the recruits into one beat, and leaves the income for the report", () => {
    const tl = buildTimeline([...events].reverse());
    expect(tl.beats.map((b) => b.kind)).toEqual(["intro", "pop", "march", "battle", "pulse"]);
    expect(tl.beats[1]!.events).toHaveLength(2);
    // Back to back, no gaps or overlaps.
    for (let i = 1; i < tl.beats.length; i++) expect(tl.beats[i]!.start).toBe(tl.beats[i - 1]!.start + tl.beats[i - 1]!.duration);
    expect(tl.total).toBe(tl.beats.at(-1)!.start + tl.beats.at(-1)!.duration);
  });

  it("a battle gets the most time; the land changes hands only once the result shows", () => {
    const tl = buildTimeline(events);
    const b = tl.beats.find((x) => x.kind === "battle")!;
    expect(b.duration).toBe(BEAT_MS.battle);
    const early = frameAt(tl, b.start + 100);
    expect(early.marches).toHaveLength(1);
    expect(early.applied).toBe(4); // everything before the battle
    const late = frameAt(tl, b.start + b.duration * 0.9);
    expect(late.clashes[0]).toMatchObject({ captured: true, attackerLosses: 2, defenderLosses: 4 });
    expect(late.applied).toBe(5);
  });

  it("Skip: the end shows every event applied and nothing animating", () => {
    const tl = buildTimeline(events);
    const end = frameAt(tl, tl.total);
    expect(end.done).toBe(true);
    expect(end.applied).toBe(6); // all but the income line, which comes after the last beat
    expect(end.marches.length + end.clashes.length + end.pops.length + end.pulses.length).toBe(0);
  });

  it("a typical turn plays in about 10-20 seconds", () => {
    const g = createGame(ctx, { gameId: "r", seed: "replay-pace", players: [1, 2, 3, 4].map((i) => ({ id: `p${i}`, name: `P${i}` })) });
    let s = g;
    const lengths: number[] = [];
    for (let turn = 0; turn < 14 && !s.winner; turn++) {
      const orders = Object.fromEntries(s.players.filter((p) => p.eliminatedTurn === null).map((p) => [p.id, recruitBot.plan(ctx, viewFor(ctx, s, p.id))]));
      const r = resolveTurn(ctx, s, orders);
      lengths.push(buildTimeline(replayFor(ctx, s, r, "p1")).total);
      s = r.state;
    }
    const sorted = [...lengths].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)]!;
    expect(median).toBeGreaterThanOrEqual(8000);
    expect(median).toBeLessThanOrEqual(20000);
    expect(Math.max(...lengths)).toBeLessThanOrEqual(TARGET_MAX_MS * 1.5);
  });

  it("a huge turn is squeezed toward 20 seconds", () => {
    const many: ReplayEvent[] = Array.from({ length: 30 }, (_, i) => battle(i, t(i % 10), t((i % 10) + 1), false));
    const tl = buildTimeline(many);
    expect(tl.total).toBeLessThanOrEqual(TARGET_MAX_MS * 1.3);
    expect(tl.total).toBeGreaterThan(TARGET_MAX_MS * 0.9);
  });

  it("the map part-way through: troops leave, land changes hands, recruits arrive (only on land you saw)", () => {
    const g = createGame(ctx, { gameId: "r", seed: "rv", players: [{ id: "p1", name: "A" }, { id: "p2", name: "B" }] });
    const view = viewFor(ctx, g, "p1");
    const mine = Object.entries(view.territories).find(([, v]) => v.detail === "full" && v.owner === "p1")![0];
    const fogged = Object.entries(view.territories).find(([, v]) => v.detail === "fogged")![0];
    const ev: ReplayEvent[] = [
      { type: "recruited", step: 0, player: "p1", orderId: "a", territory: mine, count: 3, cost: 9 },
      { type: "recruited", step: 1, player: "p2", orderId: "b", territory: fogged, count: 3, cost: 9 },
      { ...battle(2, fogged, mine, true) },
    ];
    const before = view.territories[mine] as { troops: number };
    expect((replayView(view, ev, 1).territories[mine] as { troops: number }).troops).toBe(before.troops + 3);
    expect(replayView(view, ev, 2).territories[fogged]).toEqual(view.territories[fogged]);
    expect(replayView(view, ev, 3).territories[mine]).toMatchObject({ owner: "p2", troops: 8 });
    // The view itself is never changed.
    expect((view.territories[mine] as { troops: number }).troops).toBe(before.troops);
  });
});

describe("fogged events in the replay", () => {
  const view = { me: { id: "p1" } as never, players: [{ id: "p1", name: "A", eliminatedTurn: null, eliminatedBy: null, spoils: 0 }, { id: "p2", name: "B", eliminatedTurn: null, eliminatedBy: null, spoils: 0 }] };
  it("never reveal names or numbers: only the kind of thing and the province", () => {
    const prov = ctx.map.provinces[2]!;
    for (const what of ["battle", "leaderFell", "fate"] as const) {
      const e: ReplayEvent = { type: "surface", step: 3, what, province: prov.id };
      const toast = toastFor(ctx, view, e)!;
      expect(toast.text).toContain(prov.name);
      expect(toast.text).not.toMatch(/\d/);
      for (const terr of ctx.map.territories) expect(toast.text.includes(terr.name) && !prov.name.includes(terr.name)).toBe(false);
      expect(toast.house).toBeNull();
      const frame = frameAt(buildTimeline([e]), 100);
      expect(frame.pulses).toEqual([{ province: prov.id, what, progress: expect.any(Number) }]);
      expect(frame.marches.length + frame.clashes.length + frame.pops.length).toBe(0);
    }
  });

  it("a real fogged battle reaches the timeline as a surface pulse only", () => {
    // Play bot turns until p1's replay contains a surface event, then check the timeline built from it.
    let s = createGame(ctx, { gameId: "f", seed: "fog-pulse", players: [1, 2, 3, 4, 5].map((i) => ({ id: `p${i}`, name: `P${i}` })) });
    let found: ReplayEvent[] | null = null;
    for (let turn = 0; turn < 25 && !found && !s.winner; turn++) {
      const orders = Object.fromEntries(s.players.filter((p) => p.eliminatedTurn === null).map((p) => [p.id, recruitBot.plan(ctx, viewFor(ctx, s, p.id))]));
      const r = resolveTurn(ctx, s, orders);
      const ev = replayFor(ctx, s, r, "p1");
      if (ev.some((e) => e.type === "surface")) found = ev;
      s = r.state;
    }
    expect(found).not.toBeNull();
    const tl = buildTimeline(found!);
    for (const b of tl.beats.filter((x) => x.kind === "pulse")) for (const e of b.events) expect(Object.keys(e).sort()).toEqual(["province", "step", "type", "what"]);
  });

  it("toasts for things you saw use House names", () => {
    expect(toastFor(ctx, view, battle(1, t(0), t(1), true))!.text).toBe(`Gules captures ${ctx.map.territories[1]!.name}`);
    expect(toastFor(ctx, view, { type: "moved", step: 1, player: "p2", orderId: "x", from: t(0), to: t(1), army: army(1), withLeader: false, retreat: false })).toBeNull();
  });
});
