import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { createGame, replayFor, resolveTurn, viewFor, type GameContext, type ReplayEvent } from "@conquerra/engine";
import { recruitBot } from "@conquerra/bots";
import { describe, expect, it } from "vitest";
import { fitCamera, landFrame, type Camera, type Viewport } from "../src/map/camera";
import { CAMERA_HOLD_MS, centredOn, focusOf, inView, planReplayCamera, replaySpots } from "../src/replay/camera";
import { buildTimeline } from "../src/replay/timeline";

const ctx: GameContext = { map: maps.embervale!, rules: defaultRules };
const spots = replaySpots(ctx.map);
// A laptop screen with the menus over the map (top bar, right column, bottom dock).
const vp: Viewport = { width: 1440, height: 900, insets: { top: 72, right: 340, bottom: 232, left: 8 } };
const army = (troops: number) => ({ troops, specialists: [] });
const ids = ctx.map.territories.map((t) => t.id);
const at = (id: string) => spots.territory.get(id)!;
const dist = (a: string, b: string) => Math.hypot(at(a).x - at(b).x, at(a).y - at(b).y);
// Two territories far apart, so zoomed in on one the other is off screen.
const [here, far] = (() => {
  let best: [string, string] = [ids[0]!, ids[1]!];
  for (const a of ids) for (const b of ids) if (dist(a, b) > dist(...best)) best = [a, b];
  return best;
})();
const zoomedIn: Camera = centredOn({ x: 0, y: 0, scale: 3 }, vp, at(here));
const battle = (step: number, to: string): ReplayEvent => ({
  type: "battle",
  step,
  player: "p2",
  orderId: "x",
  from: to,
  to,
  defender: "p1",
  attackers: army(10),
  withLeader: false,
  defenders: army(4),
  result: { attackStrength: 10, defenseStrength: 4, expectedDefenderLosses: 4, expectedAttackerLosses: 2, defenderLosses: 4, attackerLosses: 2 },
  captured: true,
  specialistsLost: [],
});
const recruit = (step: number, territory: string): ReplayEvent => ({ type: "recruited", step, player: "p1", orderId: "r", territory, count: 3, cost: 6 });
const intro: ReplayEvent = { type: "turnStart", step: 0, turn: 2, seats: ["p1", "p2"] };

describe("replay camera", () => {
  it("stays put when everything happens on screen (the whole map in view)", () => {
    const home = fitCamera(landFrame(ctx.map.geometry!), vp);
    const tl = buildTimeline([intro, recruit(1, here), battle(2, far)]);
    expect(planReplayCamera(tl, spots, home, vp)).toEqual([]);
  });

  it("eases to an off-screen battle as it starts, at the same zoom, then back home at the end", () => {
    const tl = buildTimeline([intro, recruit(1, here), battle(2, far)]);
    expect(inView(zoomedIn, vp, at(here))).toBe(true);
    expect(inView(zoomedIn, vp, at(far))).toBe(false);
    const moves = planReplayCamera(tl, spots, zoomedIn, vp);
    const b = tl.beats.find((x) => x.kind === "battle")!;
    expect(moves).toHaveLength(2);
    expect(moves[0]!.at).toBe(b.start);
    expect(moves[0]!.cam).toEqual(centredOn(zoomedIn, vp, at(far)));
    expect(moves[0]!.cam.scale).toBe(zoomedIn.scale);
    expect(inView(moves[0]!.cam, vp, at(far))).toBe(true);
    expect(moves[1]).toMatchObject({ at: tl.total, cam: zoomedIn });
  });

  it("goes straight home for a spot that home can see, and doesn't move for one already in view", () => {
    const tl = buildTimeline([intro, battle(1, far), battle(2, far), battle(3, here)]);
    const moves = planReplayCamera(tl, spots, zoomedIn, vp);
    // Out to the far battle once (the second one is already in view), then home for the battle there; no extra trip.
    expect(moves.map((m) => m.cam)).toEqual([centredOn(zoomedIn, vp, at(far)), zoomedIn]);
  });

  it("recruits and marches never move it, and it holds still for a while after each glide", () => {
    const march: ReplayEvent = { type: "moved", step: 2, player: "p1", orderId: "m", from: here, to: far, army: army(3), withLeader: false, retreat: false };
    expect(planReplayCamera(buildTimeline([intro, recruit(1, far), march]), spots, zoomedIn, vp)).toEqual([]);
    // A short fogged pulse away, then right after it a battle back home: too soon to swing back, so it waits for the end.
    const farProvince = ctx.map.territories.find((t) => t.id === far)!.province;
    const tl = buildTimeline([intro, { type: "surface", step: 1, what: "battle", province: farProvince }, battle(2, here)]);
    const moves = planReplayCamera(tl, spots, zoomedIn, vp);
    expect(tl.beats[2]!.start - tl.beats[1]!.start).toBeLessThan(CAMERA_HOLD_MS);
    expect(moves.map((m) => m.at)).toEqual([tl.beats[1]!.start, tl.total]);
  });

  it("your own battles come first: one cuts short the hold after a fogged pulse", () => {
    const farProvince = ctx.map.territories.find((t) => t.id === far)!.province;
    const tl = buildTimeline([intro, { type: "surface", step: 1, what: "battle", province: farProvince }, battle(2, here)]);
    // p1 is attacked at home right after the camera went off to the pulse: it comes straight back for that.
    const moves = planReplayCamera(tl, spots, zoomedIn, vp, "p1");
    expect(moves.map((m) => m.at)).toEqual([tl.beats[1]!.start, tl.beats[2]!.start]);
    expect(moves[1]!.cam).toEqual(zoomedIn);
    // Someone else's battle doesn't cut a hold short.
    expect(planReplayCamera(tl, spots, zoomedIn, vp, "p3").map((m) => m.at)).toEqual([tl.beats[1]!.start, tl.total]);
  });

  it("a fogged battle is aimed at its pulse (the province centre), never closer than you were", () => {
    const farProvince = ctx.map.territories.find((t) => t.id === far)!.province;
    const pulse: ReplayEvent = { type: "surface", step: 1, what: "battle", province: farProvince };
    const tl = buildTimeline([intro, pulse]);
    expect(focusOf(tl.beats[1]!, spots)).toEqual(spots.province.get(farProvince));
    const moves = planReplayCamera(tl, spots, zoomedIn, vp);
    expect(moves[0]!.cam).toEqual(centredOn(zoomedIn, vp, spots.province.get(farProvince)!));
    for (const m of moves) expect(m.cam.scale).toBe(zoomedIn.scale);
  });

  it("in real games, only ever pans (never zooms) and only to a beat's own spot or back home", () => {
    let planned = 0;
    for (const seed of ["cam-a", "cam-b"]) {
      let state = createGame(ctx, { gameId: "cam", seed, players: [1, 2, 3, 4].map((i) => ({ id: `p${i}`, name: `P${i}` })) });
      for (let turn = 0; turn < 6 && state.winner === null; turn++) {
        const s = state;
        const orders = Object.fromEntries(s.players.filter((p) => p.eliminatedTurn === null).map((p) => [p.id, recruitBot.plan(ctx, viewFor(ctx, s, p.id))]));
        const result = resolveTurn(ctx, state, orders);
        const tl = buildTimeline(replayFor(ctx, state, result, "p1"));
        const moves = planReplayCamera(tl, spots, zoomedIn, vp);
        planned += moves.length;
        const allowed = [zoomedIn, ...tl.beats.flatMap((b) => (focusOf(b, spots) ? [centredOn(zoomedIn, vp, focusOf(b, spots)!)] : []))];
        for (const [i, m] of moves.entries()) {
          // It holds still between glides, except to follow the next hop of a chain it's already following.
          const beat = tl.beats.find((b) => b.start === m.at);
          const prevBeat = tl.beats.find((b) => b.start === moves[i - 1]?.at);
          const e = beat?.events[0], pe = prevBeat?.events[0];
          const chainHop = e?.type === "battle" && pe?.type === "battle" && e.player === pe.player && e.from === pe.to;
          if (i > 0 && i < moves.length - 1 && !chainHop) expect(m.at - moves[i - 1]!.at).toBeGreaterThanOrEqual(CAMERA_HOLD_MS);
          expect(m.cam.scale).toBe(zoomedIn.scale);
          expect(allowed).toContainEqual(m.cam);
        }
        if (moves.length) expect(moves.at(-1)!.cam).toEqual(zoomedIn);
        state = result.state;
      }
    }
    expect(planned).toBeGreaterThan(0);
  });
});
