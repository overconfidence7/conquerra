import { defaultRules, marshalData, type Personality } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { createGame, replayFor, resolveTurn, viewFor, type GameContext, type GameState, type Order, type OrdersByPlayer, type PlayerId, type ReplayEvent } from "@conquerra/engine";
import { forFog, makeDelegateSeat, makeMarshalBot, marshalBoard, personality, PERSONALITY_IDS, think, freshMemory, type Bot } from "@conquerra/bots";
import { describe, expect, it } from "vitest";

/**
 * Session 33, Part 2: the Turtle, the Opportunist and your leaders under blackout. A personality's `blackout` block
 * (content) overrides a few of its attack values only when the game's fog is blackout, read in one place (`forFog`,
 * where the Marshal's plan takes its personality); your leaders get their own scout's drive (`explore.leaders`). With
 * standard fog none of it does anything: the same orders, game for game.
 */
const ctx: GameContext = { map: maps.embervale!, rules: defaultRules };
const ids = ["p1", "p2", "p3", "p4"];

/** Every order each seat gives over `turns` turns (the first seat's bot as given, the others Conquerors). */
function play(first: Bot, fog: true | "blackout", turns: number, seed = "s33-tune"): Order[][] {
  const bots = new Map<PlayerId, Bot>(ids.map((p, i) => [p, i === 0 ? first : makeMarshalBot("conqueror")]));
  let s: GameState = createGame(ctx, { gameId: `tune-${seed}`, seed, players: ids.map((id) => ({ id, name: id.toUpperCase() })), settings: { fog, luck: 0.3 }, startBonus: true });
  let last = new Map<PlayerId, ReplayEvent[]>();
  const out: Order[][] = [];
  while (!s.winner && s.turn <= turns) {
    const orders: OrdersByPlayer = {};
    for (const p of s.players.filter((x) => x.eliminatedTurn === null)) orders[p.id] = bots.get(p.id)!.plan(ctx, viewFor(ctx, s, p.id), last.get(p.id));
    out.push(orders.p1 ?? []);
    const before = s;
    const r = resolveTurn(ctx, s, orders);
    s = r.state;
    last = new Map(s.players.filter((p) => p.eliminatedTurn === null).map((p) => [p.id, replayFor(ctx, before, r, p.id)]));
  }
  return out;
}
const without = (p: Personality): Personality => {
  const { blackout: _, ...rest } = p;
  return rest;
};

describe("session 33: the personalities and your leaders under blackout", () => {
  it("the blackout values (content): the Turtle builds later and less, the Opportunist vultures less; the other four have none", () => {
    const blackout = { settings: { fog: "blackout" as const } }, std = { settings: { fog: true } } as const;
    for (const id of PERSONALITY_IDS) {
      const P = personality(id);
      // With standard fog, the very same personality.
      expect(forFog(P, std as never)).toBe(P);
      if (!P.blackout) {
        expect(forFog(P, blackout as never)).toBe(P);
        continue;
      }
      const B = forFog(P, blackout as never);
      expect(B.attack).toEqual({ ...P.attack, ...P.blackout.attack });
      expect(B.defend).toEqual({ ...P.defend, ...P.blackout.defend });
      expect(B.build).toEqual({ ...P.build, ...P.blackout.build });
      expect({ ...B, attack: P.attack, defend: P.defend, build: P.build }).toEqual(P);
    }
    expect(PERSONALITY_IDS.filter((id) => personality(id).blackout).sort()).toEqual(["opportunist", "turtle"]);
    const t = forFog(personality("turtle"), blackout as never).build, o = forFog(personality("opportunist"), blackout as never).attack;
    const T = personality("turtle").build;
    expect(t.marketsFrom).toBeGreaterThan(T.marketsFrom);
    expect(t.cultureFrom).toBeGreaterThan(T.cultureFrom);
    expect(t.realm!).toBeLessThan(T.realm!);
    expect(o.vulture).toBeLessThan(personality("opportunist").attack.vulture);
    expect(o.vulture).toBeGreaterThan(0);
  });

  it("with standard fog a Turtle's and an Opportunist's orders are the same with or without their blackout values; under blackout they differ", () => {
    for (const id of ["turtle", "opportunist"] as const) {
      const P = personality(id);
      expect(play(makeMarshalBot(P), true, 16)).toEqual(play(makeMarshalBot(without(P)), true, 16));
    }
    // The Turtle under blackout: its blackout values change what it does (no markets or culture before turn 6).
    expect(play(makeMarshalBot(personality("turtle")), "blackout", 16)).not.toEqual(play(makeMarshalBot(without(personality("turtle"))), "blackout", 16));
  }, 240_000);

  it("your leaders' scout's drive (explore.leaders): their boards value land into the cloud by its weight; nothing with standard fog", () => {
    const game = (fog: true | "blackout") => createGame(ctx, { gameId: "x", seed: "x", players: ids.map((id) => ({ id, name: id })), settings: { fog }, startBonus: true });
    const values = (fog: true | "blackout", weight: number) => {
      const keep = marshalData.explore.leaders.weight;
      marshalData.explore.leaders.weight = weight;
      try {
        const view = viewFor(ctx, game(fog), "p1");
        const b = marshalBoard(ctx, view, think(ctx, view, marshalData.judgement, freshMemory()).insight, undefined, true)!;
        return { b, at: new Map(b.idx.ids.map((t) => [t, b.valueOf(t)])) };
      } finally {
        marshalData.explore.leaders.weight = keep;
      }
    };
    const dark0 = values("blackout", 0), dark5 = values("blackout", 5);
    expect([...dark0.at].some(([t, v]) => dark5.at.get(t)! > v)).toBe(true);
    const std0 = values(true, 0), std5 = values(true, 5);
    expect(std0.b.cloudShare).toBe(0);
    expect([...std5.at]).toEqual([...std0.at]);
  });

  it("your Leader on Run the military hires Scouts early under blackout, as the Marshal does; never with standard fog", () => {
    const scouts = (fog: true | "blackout") => [0, 1, 2].reduce((n, g) => n + play(makeDelegateSeat(), fog, 6, `s33-scouts-${g}`).flat().filter((o) => o.kind === "hire" && o.specialist === "scouts").length, 0);
    expect(scouts("blackout")).toBeGreaterThan(0);
    expect(scouts(true)).toBe(0);
  }, 240_000);

  it("with standard fog the delegating seat plays the same whatever explore.leaders says (weight, Scouts, watchtowers)", () => {
    const keep = { ...marshalData.explore.leaders };
    const run = () => play(makeDelegateSeat(), true, 10, "s33-delegate");
    try {
      Object.assign(marshalData.explore.leaders, { weight: 0, scoutTurn: 0, watchtowers: 0, watchtowerTurn: 0 });
      const plain = run();
      Object.assign(marshalData.explore.leaders, { weight: 6, scoutTurn: 10, scoutCloud: 0, watchtowers: 3, watchtowerTurn: 20 });
      expect(run()).toEqual(plain);
    } finally {
      Object.assign(marshalData.explore.leaders, keep);
    }
  }, 240_000);

  it("under blackout, a Steward running the realm with watchtowers set puts one up at the cloud's edge early on", () => {
    const keep = { ...marshalData.explore.leaders };
    try {
      Object.assign(marshalData.explore.leaders, { watchtowers: 1, watchtowerTurn: 6, scoutCloud: 0.3 });
      const orders = play(makeDelegateSeat(), "blackout", 6, "s33-delegate").flat();
      expect(orders.some((o) => o.kind === "build" && o.building === "watchtower")).toBe(true);
      Object.assign(marshalData.explore.leaders, { watchtowers: 0 });
      expect(play(makeDelegateSeat(), "blackout", 6, "s33-delegate").flat().some((o) => o.kind === "build" && o.building === "watchtower")).toBe(false);
    } finally {
      Object.assign(marshalData.explore.leaders, keep);
    }
  }, 240_000);
});
