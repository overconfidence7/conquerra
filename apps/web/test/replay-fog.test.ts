import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { recruitBot } from "@conquerra/bots";
import {
  createGame,
  replayFor,
  resolveTurn,
  viewFor,
  type GameContext,
  type GameState,
  type PlayerView,
  type ReplayEvent,
  type TerritoryView,
  type VisionEvent,
} from "@conquerra/engine";
import { describe, expect, it } from "vitest";
import { groupReport } from "../src/logic/report";
import { namer } from "../src/logic/text";
import { centredOn, inView, planReplayCamera, replaySpots } from "../src/replay/camera";
import { buildTimeline, frameAt, replayView, RESULT_AT } from "../src/replay/timeline";
import type { Viewport } from "../src/map/camera";

const ctx: GameContext = { map: maps.embervale!, rules: defaultRules };

/** Play bot turns, keeping each turn's view before, its replay for p1, and the view after. */
function botTurns(seed: string, players: number, turns: number) {
  let s = createGame(ctx, { gameId: "rf", seed, players: Array.from({ length: players }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}` })) });
  const out: { before: PlayerView; events: ReplayEvent[]; after: PlayerView; full: ReturnType<typeof resolveTurn>; state: GameState }[] = [];
  for (let t = 0; t < turns && !s.winner; t++) {
    const st = s;
    const orders = Object.fromEntries(st.players.filter((p) => p.eliminatedTurn === null).map((p) => [p.id, recruitBot.plan(ctx, viewFor(ctx, st, p.id))]));
    const r = resolveTurn(ctx, st, orders);
    out.push({ before: viewFor(ctx, st, "p1"), events: replayFor(ctx, st, r, "p1"), after: viewFor(ctx, r.state, "p1"), full: r, state: st });
    s = r.state;
  }
  return out;
}

/** What the map draws for a territory (everything but the list of reasons it's in sight). */
function drawn(t: TerritoryView) {
  if (t.detail !== "full") return t;
  const { seenBy: _s, specialists, ...rest } = t;
  return { ...rest, specialists: specialists.map((s) => s.type).sort() };
}

describe("the fog lifts during the replay (on screen)", () => {
  it("the fog lifts around captured land as the battle's result shows, not before", () => {
    const vision: VisionEvent = { type: "vision", step: 4, revealed: {}, fogged: {} };
    const tid = ctx.map.territories[3]!.id;
    vision.revealed[tid] = { detail: "full", seenBy: ["border"], owner: null, troops: 2, specialists: [], building: null, construction: null, culture: 0, leaders: [], capitalOf: null };
    const events: ReplayEvent[] = [
      { type: "turnStart", step: 0, turn: 3, seats: ["p1"] },
      {
        type: "battle", step: 4, player: "p1", orderId: "a", from: ctx.map.territories[1]!.id, to: ctx.map.territories[2]!.id, defender: null,
        attackers: { troops: 9, specialists: [] }, withLeader: false, defenders: { troops: 1, specialists: [] },
        result: { attackStrength: 9, defenseStrength: 1, expectedDefenderLosses: 1, expectedAttackerLosses: 0, defenderLosses: 1, attackerLosses: 0 }, captured: true, specialistsLost: [], defense: { fort: false, culture: 0, leader: false },
      },
      vision,
    ];
    const tl = buildTimeline(events);
    // The vision event doesn't get a beat of its own: it rides on the battle.
    expect(tl.beats.map((b) => b.kind)).toEqual(["intro", "battle"]);
    const b = tl.beats[1]!;
    expect(frameAt(tl, b.start + b.duration * (RESULT_AT - 0.05)).applied).toBe(1);
    expect(frameAt(tl, b.start + b.duration * (RESULT_AT + 0.02)).applied).toBe(3);
  });

  it("land that comes into view gets its snapshot; land that fogs over takes the 'last seen' look", () => {
    const g = createGame(ctx, { gameId: "r", seed: "rv", players: [{ id: "p1", name: "A" }, { id: "p2", name: "B" }] });
    const view = viewFor(ctx, g, "p1");
    const seen = Object.keys(view.territories).find((id) => view.territories[id]!.detail === "full" && (view.territories[id] as { owner: string | null }).owner === null)!;
    const hidden = Object.keys(view.territories).find((id) => view.territories[id]!.detail === "fogged")!;
    const ev: ReplayEvent[] = [
      {
        type: "vision", step: 1,
        revealed: { [hidden]: { detail: "full", seenBy: ["border"], owner: "p2", troops: 7, specialists: [], building: "fort", construction: null, culture: 1, leaders: ["p2"], capitalOf: null } },
        fogged: { [seen]: { owner: null, troops: 1, building: null, turn: 1 } },
      },
    ];
    const v = replayView(view, ev, 1);
    expect(v.territories[hidden]).toMatchObject({ detail: "full", owner: "p2", troops: 7, building: "fort", leaders: ["p2"] });
    expect(v.territories[seen]).toEqual({ detail: "fogged", lastSeen: { owner: null, troops: 1, building: null, turn: 1 } });
    // Before the vision event, nothing has changed.
    expect(replayView(view, ev, 0).territories[hidden]).toEqual(view.territories[hidden]);
  });

  it("in real games, the replay starts from the start-of-turn fog and ends exactly on the new turn's view", () => {
    let turnsChecked = 0, revealed = 0;
    for (const seed of ["fog-end-1", "fog-end-2", "fog-end-3"])
      for (const turn of botTurns(seed, 4, 14)) {
        const tl = buildTimeline(turn.events);
        // Watch again / the start: the map is the view from before the turn.
        expect(replayView(turn.before, turn.events, frameAt(tl, 0).applied)).toEqual(turn.before);
        // Skip / the end: every event applied.
        const end = replayView(turn.before, turn.events, frameAt(tl, tl.total).applied);
        expect(frameAt(tl, tl.total).applied).toBeGreaterThanOrEqual(turn.events.map((e) => e.type).lastIndexOf("vision") + 1);
        // A rival's unpaid upkeep (troops deserting) isn't in your replay; skip land where that happened.
        const deserted = new Set(turn.full.events.flatMap((e) => (e.type === "income" && e.player !== "p1" ? e.deserters.map((d) => d.territory) : [])));
        for (const id of Object.keys(turn.after.territories)) {
          if (deserted.has(id)) continue;
          const want = turn.after.territories[id]!;
          const got = end.territories[id]!;
          // Fog: exactly the same land in sight.
          expect(got.detail, `${id} on turn ${turn.before.turn}`).toBe(want.detail);
          if (want.detail === "full") {
            // One known gap: a rival retaking its own capital from you (the view can't know it was theirs) gets its
            // "Capital" label when the turn ends.
            const retaken = turn.events.some((e) => e.type === "battle" && e.captured && e.to === id && e.player !== "p1");
            const g = drawn(got) as Record<string, unknown>, w = drawn(want) as Record<string, unknown>;
            if (retaken) delete g.capitalOf, delete w.capitalOf;
            expect(g, `${id} on turn ${turn.before.turn}`).toEqual(w);
          }
          // Land that fogged over during the turn shows what was last seen (the new view may know it fresher).
          else if (got.detail === "fogged" && got.lastSeen && want.lastSeen) expect(got.lastSeen.owner).toBe(want.lastSeen.owner);
        }
        revealed += turn.events.filter((e) => e.type === "vision").length;
        turnsChecked++;
      }
    expect(turnsChecked).toBeGreaterThan(30);
    expect(revealed).toBeGreaterThan(10);
  });

  it("the turn report lists what came out of the fog", () => {
    const view = viewFor(ctx, createGame(ctx, { gameId: "r", seed: "rep", players: [{ id: "p1", name: "A" }, { id: "p2", name: "B" }] }), "p1");
    const ids = ctx.map.territories.map((t) => t.id);
    const full = (owner: string | null, troops: number, extra: Partial<Extract<TerritoryView, { detail: "full" }>> = {}) =>
      ({ detail: "full", seenBy: ["border"], owner, troops, specialists: [], building: null, construction: null, culture: 0, leaders: [], capitalOf: null, ...extra }) as Extract<TerritoryView, { detail: "full" }>;
    const events: ReplayEvent[] = [
      { type: "vision", step: 3, revealed: { [ids[5]!]: full("p2", 8, { building: "fort" }), [ids[6]!]: full(null, 1) }, fogged: {} },
      { type: "vision", step: 9, revealed: { [ids[7]!]: full("p2", 12, { capitalOf: "p2", leaders: ["p2"] }) }, fogged: {} },
      { type: "surface", step: 12, what: "battle", province: ctx.map.provinces[0]!.id },
    ];
    const g = groupReport(ctx, events, namer(ctx, view));
    const name = (i: number) => ctx.map.territories[i]!.name;
    expect(g.fog.map((l) => l.text)).toEqual([
      `Spotted B at ${name(5)} (8, fort) and ${name(7)} (12).`,
      `Found B's capital: ${name(7)}.`,
      `B's Leader is at ${name(7)}.`,
      "1 neutral territory came into view.",
      `A battle in ${ctx.map.provinces[0]!.name}`,
    ]);
  });
});

describe("the replay camera follows a chain", () => {
  const spots = replaySpots(ctx.map);
  const vp: Viewport = { width: 1440, height: 900, insets: { top: 72, right: 340, bottom: 232, left: 8 } };
  const at = (id: string) => spots.territory.get(id)!;
  /** A path of neighbouring territories heading away from where the camera starts. */
  const path = (() => {
    const g = ctx.map.borders;
    const nbrs = (id: string) => g.flatMap((b) => (b.a === id ? [b.b] : b.b === id ? [b.a] : []));
    const start = ctx.map.territories[0]!.id;
    const p = [start];
    for (let i = 0; i < 4; i++) {
      const cur = p.at(-1)!;
      const next = nbrs(cur).filter((n) => !p.includes(n)).sort((a, b) => Math.hypot(at(b).x - at(start).x, at(b).y - at(start).y) - Math.hypot(at(a).x - at(start).x, at(a).y - at(start).y))[0]!;
      p.push(next);
    }
    return p;
  })();
  const hop = (step: number, from: string, to: string): ReplayEvent => ({
    type: "battle", step, player: "p1", orderId: `h${step}`, from, to, defender: null,
    attackers: { troops: 20, specialists: [] }, withLeader: false, defenders: { troops: 1, specialists: [] },
    result: { attackStrength: 20, defenseStrength: 1, expectedDefenderLosses: 1, expectedAttackerLosses: 0, defenderLosses: 1, attackerLosses: 0 }, captured: true, specialistsLost: [], defense: { fort: false, culture: 0, leader: false },
  });

  it("keeps a chain that runs off screen in view, hop by hop, even on a busy (squeezed) turn", () => {
    // Zoomed right in on the first territory, so each hop runs off the edge.
    const home = centredOn({ x: 0, y: 0, scale: 9 }, vp, at(path[0]!));
    const filler: ReplayEvent[] = Array.from({ length: 12 }, (_, i) => ({ type: "surface", step: 100 + i, what: "battle", province: ctx.map.provinces[i % ctx.map.provinces.length]!.id }));
    const events: ReplayEvent[] = [{ type: "turnStart", step: 0, turn: 2, seats: ["p1"] }, hop(1, path[0]!, path[1]!), hop(2, path[1]!, path[2]!), hop(3, path[2]!, path[3]!), hop(4, path[3]!, path[4]!), ...filler];
    const tl = buildTimeline(events);
    const moves = planReplayCamera(tl, spots, home, vp);
    // At every hop's start the camera (as planned so far) has that hop's target in view.
    for (const b of tl.beats.filter((x) => x.kind === "battle")) {
      const cam = [...moves].reverse().find((m) => m.at <= b.start)?.cam ?? home;
      const e = b.events[0] as Extract<ReplayEvent, { type: "battle" }>;
      expect(inView(cam, vp, at(e.to)), `hop to ${e.to}`).toBe(true);
    }
    expect(moves.at(-1)!.cam).toEqual(home);
  });
});
