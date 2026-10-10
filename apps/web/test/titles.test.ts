import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { createGame, viewFor, type GameContext, type ReplayEvent } from "@conquerra/engine";
import { describe, expect, it } from "vitest";
import { capitalFalls, planReplayCamera, PUSH_IN, replaySpots } from "../src/replay/camera";
import { buildTimeline } from "../src/replay/timeline";
import { cardAt, MAX_CARDS, titleCards } from "../src/replay/titles";

/** Session 21: title cards for the moments that matter, and the camera's push-in on a capital. */
const ctx: GameContext = { map: maps.embervale!, rules: defaultRules };
const g = createGame(ctx, { gameId: "t", seed: "titles", players: [1, 2, 3, 4].map((i) => ({ id: `p${i}`, name: `P${i}` })) });
const view = viewFor(ctx, g, "p1");
const cap = view.me.capital;
const nb = ctx.map.borders.find((b) => b.a === cap || b.b === cap)!;
const from = nb.a === cap ? nb.b : nb.a;
const army = (troops: number) => ({ troops, specialists: [] });
const battle = (step: number, to: string, captured: boolean, defender = "p1"): ReplayEvent => ({
  type: "battle",
  step,
  player: "p2",
  orderId: "x",
  from,
  to,
  defender,
  attackers: army(10),
  withLeader: false,
  defenders: army(4),
  result: { attackStrength: 10, defenseStrength: 4, expectedDefenderLosses: 4, expectedAttackerLosses: 2, defenderLosses: 4, attackerLosses: 2 },
  captured,
  specialistsLost: [],
  defense: { fort: false, culture: 0, leader: false },
});

describe("title cards", () => {
  it("your capital falling gets one, a battle elsewhere doesn't", () => {
    const tl = buildTimeline([battle(1, from, true, "p3"), battle(2, cap, true)]);
    const cards = titleCards(tl, view, ctx.map);
    expect(cards).toHaveLength(1);
    expect(cards[0]!.text).toMatch(new RegExp(`^Your capital, ${ctx.map.territories.find((t) => t.id === cap)!.name}, falls to House .+$`));
    expect(cardAt(cards, cards[0]!.at + 10)).toBe(cards[0]);
    expect(cardAt(cards, cards[0]!.at - 10)).toBeNull();
  });

  it("a House knocked out gets one; never more than two a turn, never two at once", () => {
    const ev: ReplayEvent[] = [battle(1, cap, true), { type: "eliminated", step: 2, player: "p3", by: "p2" }, { type: "eliminated", step: 3, player: "p4", by: "p2" }, { type: "eliminated", step: 4, player: "p1", by: "p2" }];
    const cards = titleCards(buildTimeline(ev), view, ctx.map);
    expect(cards.length).toBeLessThanOrEqual(MAX_CARDS);
    expect(cards.map((c) => c.text)).toContain("Your House is no more");
    for (let i = 1; i < cards.length; i++) expect(cards[i]!.at - cards[i - 1]!.at).toBeGreaterThanOrEqual(cards[i - 1]!.ms);
  });

  it("never for a fogged event: a fogged battle, even at your capital's province, is only a pulse", () => {
    const prov = ctx.map.territories.find((t) => t.id === cap)!.province;
    const tl = buildTimeline([{ type: "surface", step: 1, what: "battle", province: prov }]);
    expect(titleCards(tl, view, ctx.map)).toEqual([]);
  });
});

describe("the camera on a capital falling", () => {
  it("pushes in on it and pulls back out as its beat ends", () => {
    const tl = buildTimeline([battle(1, cap, true)]);
    const spots = replaySpots(ctx.map);
    const home = { x: 0, y: 0, scale: 1 };
    const vp = { width: 1440, height: 900 };
    const moves = planReplayCamera(tl, spots, home, vp, "p1", { pushIn: (b) => capitalFalls(b, new Set([cap])) });
    expect(moves.length).toBeGreaterThanOrEqual(2);
    expect(moves[0]!.cam.scale).toBeCloseTo(PUSH_IN);
    expect(moves.at(-1)!.cam.scale).toBeCloseTo(1);
  });
});

describe("the camera stays on what you can see", () => {
  it("in real fogged games, with the push-ins, every move goes to a beat's own spot or back home", async () => {
    const { recruitBot } = await import("@conquerra/bots");
    const { replayFor, resolveTurn } = await import("@conquerra/engine");
    const { bigMoment, focusOf } = await import("../src/replay/camera");
    const spots = replaySpots(ctx.map);
    const home = { x: 0, y: 0, scale: 1 };
    const vp = { width: 1440, height: 900 };
    let state = createGame(ctx, { gameId: "cam2", seed: "cam-push", players: [1, 2, 3, 4].map((i) => ({ id: `p${i}`, name: `P${i}` })) });
    let moves = 0;
    for (let turn = 0; turn < 10 && state.winner === null; turn++) {
      const s = state;
      const orders = Object.fromEntries(s.players.filter((p) => p.eliminatedTurn === null).map((p) => [p.id, recruitBot.plan(ctx, viewFor(ctx, s, p.id))]));
      const result = resolveTurn(ctx, state, orders);
      const tl = buildTimeline(replayFor(ctx, state, result, "p1"));
      const before = viewFor(ctx, state, "p1");
      const capitals = new Set([before.me.capital, ...Object.entries(before.territories).flatMap(([id, t]) => (t.detail === "full" && t.capitalOf ? [id] : []))]);
      for (const m of planReplayCamera(tl, spots, home, vp, "p1", { pushIn: (b) => bigMoment(b, capitals) })) {
        moves++;
        const centre = { x: (vp.width / 2 - m.cam.x) / m.cam.scale, y: (vp.height / 2 - m.cam.y) / m.cam.scale };
        // Centred where home is, or exactly on a beat's own spot (a battle, a pulse's province): nowhere else.
        const homeCentre = { x: (vp.width / 2 - home.x) / home.scale, y: (vp.height / 2 - home.y) / home.scale };
        const near = (p: { x: number; y: number }) => Math.hypot(p.x - centre.x, p.y - centre.y) < 1e-6;
        const ok = near(homeCentre) || tl.beats.some((b) => !!focusOf(b, spots) && near(focusOf(b, spots)!));
        expect(ok).toBe(true);
        expect(m.cam.scale).toBeGreaterThanOrEqual(home.scale);
      }
      state = result.state;
    }
    expect(moves).toBeGreaterThan(0);
  });
});
