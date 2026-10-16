import { defaultRules, marshalData } from "@conquerra/content";
import { MapDef } from "@conquerra/content/schemas";
import { createGame, viewFor, type GameContext, type GameState, type Order } from "@conquerra/engine";
import { describe, expect, it } from "vitest";
import { chainOn, readBoard } from "../src/board";
import { makeMarshalBot } from "../src";
import { planHomeSweep } from "../src/marshal/home";
import { scenario } from "./scenario";

/**
 * Session 20c, Part 2 (Nate's second note): defensible pauses, a sweep of our own land before the attack, and the
 * Marshal's Leader with its main effort.
 */

/** A w x h grid with a random layout (two players, some neutral land), from a seed. */
function randomGrid(seed: number, w = 6, h = 5) {
  let x = seed >>> 0 || 1;
  const rnd = () => ((x = (x * 1103515245 + 12345) >>> 0), x / 2 ** 32);
  const ids: string[] = [];
  const territories = [];
  for (let c = 0; c < w; c++)
    for (let r = 0; r < h; r++) {
      const id = `${String.fromCharCode(97 + c)}${r}`;
      ids.push(id);
      territories.push({ id, name: id.toUpperCase(), province: `p${Math.floor(c / 2)}${Math.floor(r / 2)}`, terrain: rnd() < 0.2 ? ("hills" as const) : ("plains" as const), x: c * 100, y: r * 100 });
    }
  const borders = [];
  for (let c = 0; c < w; c++)
    for (let r = 0; r < h; r++) {
      const id = `${String.fromCharCode(97 + c)}${r}`;
      if (c + 1 < w) borders.push({ a: id, b: `${String.fromCharCode(98 + c)}${r}` });
      if (r + 1 < h) borders.push({ a: id, b: `${String.fromCharCode(97 + c)}${r + 1}` });
    }
  const provinces = [...new Set(territories.map((t) => t.province))].map((id) => ({ id, name: id.toUpperCase(), bonus: 2 }));
  const map = MapDef.parse({ id: "grid", name: "Grid", minPlayers: 2, maxPlayers: 2, recommendedPlayers: { min: 2, max: 2 }, territories, provinces, borders, capitalSlots: ["a0", `${String.fromCharCode(96 + w)}${h - 1}`] });
  const ctx: GameContext = { map, rules: defaultRules };
  const s: GameState = createGame(ctx, { gameId: "g", seed: `pauses-${seed}`, players: [{ id: "p1", name: "P1" }, { id: "p2", name: "P2" }], settings: { luck: 0, fate: false, diplomacy: false, spies: false } });
  for (const t of ids) {
    const left = t.charCodeAt(0) - 97 < w / 2;
    const owner = rnd() < 0.2 ? null : left ? (rnd() < 0.85 ? "p1" : "p2") : rnd() < 0.85 ? "p2" : "p1";
    s.territories[t] = { owner, troops: owner ? 1 + Math.floor(rnd() * rnd() * 30) : 1 + Math.floor(rnd() * 3), specialists: [], building: owner && rnd() < 0.08 ? "fort" : null, construction: null, culture: 0 };
  }
  s.territories.a0!.owner = "p1";
  s.intel = { p1: {}, p2: {} };
  return { ctx, s };
}

describe("defensible pauses (session 20c)", () => {
  it("a chain ends where it can hold (a rival army next to it wouldn't likely throw it out), or nowhere on it could (property test)", () => {
    let chains = 0, trimmed = 0;
    for (let seed = 1; seed <= 120; seed++) {
      const { ctx, s } = randomGrid(seed * 7919);
      const view = viewFor(ctx, s, "p1");
      const b = readBoard(ctx, view, { chainMargin: 1 })!;
      for (const from of b.frontier) {
        const troops = b.troopsAt(from) - 1;
        if (troops < 4) continue;
        const to = b.idx.neighbors.get(from)!.find((t) => !b.owned(t) && b.expectAt(from, t, troops, []).captureLikely);
        if (!to) continue;
        const ok = (t: string, arriving: number) => !b.exposed(t, arriving);
        const out: Order[] = [];
        const first: Order = { id: "x", kind: "move", from, to, troops };
        chainOn(b, { order: first, from, to, troops }, new Set([to]), 1, () => `h${out.length}`, (o) => out.push(o), { maxHops: 6, pause: { back: 9, ok } });
        // Replay the chain's arithmetic: where it stops, with what arrives there.
        const stops: { at: string; arriving: number }[] = [];
        let prev = from, at = to, sent = troops;
        stops.push({ at, arriving: Math.floor(sent - b.expectAt(prev, at, sent, []).expectedAttackerLosses) });
        for (const o of out) {
          if (o.kind !== "move") continue;
          sent = Math.floor(sent - b.expectAt(prev, at, sent, []).expectedAttackerLosses) - 1;
          prev = at;
          at = o.to;
          stops.push({ at, arriving: Math.floor(sent - b.expectAt(prev, at, sent, []).expectedAttackerLosses) });
        }
        chains++;
        const end = stops[stops.length - 1]!;
        if (!ok(end.at, end.arriving)) expect(stops.some((x) => ok(x.at, x.arriving)), `seed ${seed}: ${from}>${stops.map((x) => x.at).join(">")}`).toBe(false);
        // (Without pauses, would it have gone further?)
        const free: Order[] = [];
        chainOn(b, { order: first, from, to, troops }, new Set([to]), 1, () => `f${free.length}`, (o) => free.push(o), { maxHops: 6 });
        if (free.length > out.length) trimmed++;
      }
    }
    expect(chains).toBeGreaterThan(100);
    expect(trimmed).toBeGreaterThan(0);
  });

  it("the shared judgement pauses one hop back (your leaders and every Marshal)", () => {
    expect(marshalData.judgement.pause).toEqual({ back: 1 });
  });
});

describe("a sweep of our own land before the attack (session 20c)", () => {
  // a(capital, 12) b(1) c(1) d(1) | e: the rival's army | f
  const at = (army: number) =>
    scenario({ line: "abcdef", layout: { a: ["p1", 12], b: ["p1", 1], c: ["p1", 1], d: ["p1", 1], e: ["p2", army], f: ["p2", 2] }, caps: ["a", "f"] });
  const sweep = (army: number) => {
    const { ctx, s } = at(army);
    const view = viewFor(ctx, s, "p1");
    const b = readBoard(ctx, view, { chainMargin: 1.25 })!;
    const free = new Map(b.mine.map((t) => [t, Math.max(0, b.troopsAt(t) - 1)]));
    let n = 0;
    return { b, ...planHomeSweep(b, free, () => `h${n++}`, { troops: 3, reach: 8, atPeace: () => false }) };
  };

  it("fires when a rival army it can see could get behind the front: troops step into that land, taking back what it took", () => {
    const r = sweep(12);
    expect(r.exposed).toContain("c");
    const into = r.orders.filter((o): o is Extract<Order, { kind: "move" }> => o.kind === "move");
    expect(into.some((o) => o.to === "c")).toBe(true);
    for (const o of into) expect(o.preset?.id).toBe("onlyIfStronger");
    // From land the army can't reach (the capital), one step at a time.
    expect(into[0]!.from).toBe("a");
  });

  it("and only then: a rival army too small to get past the front leaves it quiet", () => {
    expect(sweep(2).orders).toEqual([]);
    expect(sweep(2).exposed).toEqual([]);
  });

  it("a Marshal queues it after its attacks (Part 2's tests: before them it cost wins)", () => {
    expect(marshalData.judgement.homeSweep).toEqual({ troops: 3, first: false });
    const { ctx, s } = at(12);
    s.players[0]!.gold = 0;
    const orders = makeMarshalBot("conqueror").plan(ctx, viewFor(ctx, s, "p1"));
    const home = orders.filter((o) => o.kind === "move" && o.to === "c" && o.preset?.id === "onlyIfStronger");
    expect(home.length).toBeGreaterThan(0);
  });
});

describe("the Marshal's Leader goes with its main effort after the opening (session 20c)", () => {
  it("from turn 15 (from turn 1 it made the strongest opener snowball on a crowded table)", () => {
    expect(marshalData.judgement.leaderGoesFrom).toBe(15);
  });

  it("standing at home with no attack of its own, it marches with its spare troops to where the biggest attack sets out", () => {
    // a(capital, Leader, 20) b(10) c(10) | d: weak rival land
    const { ctx, s } = scenario({ line: "abcde", layout: { a: ["p1", 20], b: ["p1", 10], c: ["p1", 30], d: ["p2", 2], e: ["p2", 3] }, caps: ["a", "e"] });
    // (After the opening: it leads the main effort from turn 15.)
    s.turn = 20;
    const orders = makeMarshalBot("conqueror").plan(ctx, viewFor(ctx, s, "p1"));
    const rides = orders.filter((o) => o.kind === "move" && o.withLeader);
    expect(rides.length).toBeGreaterThan(0);
    expect(rides[0]).toMatchObject({ from: "a" });
  });

  it("its Initiative goes on the attack its Leader leads", () => {
    const { ctx, s } = scenario({ line: "abcde", layout: { a: ["p2", 2], b: ["p1", 30], c: ["p1", 1], d: ["p1", 30], e: ["p2", 3] }, caps: ["d", "a"] });
    s.turn = 20;
    const orders = makeMarshalBot("conqueror").plan(ctx, viewFor(ctx, s, "p1"));
    // Its biggest attack goes from b (on their capital); the Leader stands at d, and the Initiative goes with it.
    const first = orders.find((o) => o.timing === "first");
    expect(first).toMatchObject({ kind: "move", from: "d", withLeader: true });
  });
});
