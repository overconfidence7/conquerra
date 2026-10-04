import { describe, expect, it } from "vitest";
import { createGame, indexMap, recordSighting, resolveTurn, Rng, seedRng, updateIntel, viewFor, visionFor } from "../src";
import type { GameState, Order, OrdersByPlayer } from "../src";
import { board, ctxWith, embervaleCtx, lineGame, mv } from "./helpers";

/** Line map a-b-c-d-e, with p1's memory rebuilt from the test layout. */
function lineSetup(layout: Parameters<typeof board>[1]) {
  const ctx = ctxWith();
  const s = lineGame(ctx);
  board(s, layout);
  updateIntel(ctx, s);
  return { ctx, s };
}

describe("last seen intel (v0.2 §8)", () => {
  it("remembers land on sight, and keeps the old values once it slips into the fog", () => {
    const { ctx, s } = lineSetup({ a: ["p1", 5], b: ["p1", 3], c: ["p1", 2], d: ["p2", 20], e: ["p2", 5] });
    // p1 holds a-c, so it sees d (the border) but not e.
    expect(s.intel.p1!.d).toEqual({ owner: "p2", troops: 20, building: null, turn: 1 });
    expect(s.intel.p1!.e).toBeUndefined();

    // p2 takes c. p1 now holds only a-b, so d drops into the fog at that moment: p1 last saw it just after p2's
    // army marched out of it (20 - 15 = 5), during turn 1.
    const r1 = resolveTurn(ctx, s, { p2: [mv("d", "c", 15)] });
    const v1 = viewFor(ctx, r1.state, "p1");
    expect(v1.turn).toBe(2);
    expect(v1.territories.c).toMatchObject({ detail: "full", owner: "p2" });
    expect(v1.territories.d).toEqual({ detail: "fogged", lastSeen: { owner: "p2", troops: 5, building: null, turn: 1 } });
    expect(v1.territories.e).toEqual({ detail: "fogged" });

    // d changes behind the fog; p1's memory doesn't.
    const r2 = resolveTurn(ctx, r1.state, { p2: [{ id: "r", kind: "recruit", territory: "e", count: 3 } as Order] });
    const v2 = viewFor(ctx, r2.state, "p1");
    expect(v2.territories.d).toEqual({ detail: "fogged", lastSeen: { owner: "p2", troops: 5, building: null, turn: 1 } });
    // The land p1 can still see is fresh.
    expect(r2.state.intel.p1!.c!.turn).toBe(3);
  });

  it("records buildings, and what you see replaces what you remembered", () => {
    const { ctx, s } = lineSetup({ a: ["p1", 30], b: ["p1", 3], c: ["p2", 2, [], { building: "fort" }], d: ["p2", 4], e: ["p2", 5] });
    expect(s.intel.p1!.c).toMatchObject({ owner: "p2", building: "fort" });
    const r = resolveTurn(ctx, s, { p1: [mv("b", "c", 2), mv("a", "b", 25)] });
    // Whatever happened at c, p1 still sees it and its memory matches the truth now.
    const t = r.state.territories.c!;
    expect(r.state.intel.p1!.c).toEqual({ owner: t.owner, troops: t.troops, building: t.building, turn: 2 });
  });

  it("never remembers anything the player couldn't have seen at the time", () => {
    const ctx = embervaleCtx();
    const idx = indexMap(ctx.map);
    let stale = 0;
    let midTurn = 0;
    for (const seed of ["memory-1", "memory-2", "memory-3"]) {
      let s = createGame(ctx, { gameId: "m", seed, players: [1, 2, 3, 4].map((i) => ({ id: `p${i}`, name: `P${i}` })) });
      for (const p of s.players) p.gold = 60;
      const history = new Map<number, GameState>([[s.turn, s]]);
      /** Every moment of each turn: the real board after each step (copied, with who could see what). */
      const moments = new Map<number, GameState[]>();
      const rng = new Rng(seedRng(`${seed}-orders`));
      for (let turn = 0; turn < 25 && !s.winner; turn++) {
        // Each player throws its biggest army at a random neighbour, so borders move and land drops into the fog.
        const orders: OrdersByPlayer = {};
        for (const p of s.players) {
          const mine = idx.ids.filter((id) => s.territories[id]!.owner === p.id);
          if (!mine.length) continue;
          const from = mine.reduce((a, b) => (s.territories[b]!.troops > s.territories[a]!.troops ? b : a));
          const ns = idx.neighbors.get(from)!;
          orders[p.id] = [{ id: `r${turn}`, kind: "recruit", territory: p.capital, count: 3 }, mv(from, ns[rng.int(ns.length)]!, "all")];
        }
        const steps: GameState[] = [s];
        const resolving = s.turn;
        s = resolveTurn(ctx, s, orders, (_e, live) => steps.push(JSON.parse(JSON.stringify(live)) as GameState)).state;
        moments.set(resolving, steps);
        history.set(s.turn, s);

        for (const p of s.players) {
          for (const [id, mem] of Object.entries(s.intel[p.id] ?? {})) {
            if (mem.turn < s.turn) stale++;
            // Owned land never holds 0 troops, so neither does a memory of it.
            if (mem.owner) expect(mem.troops).toBeGreaterThan(0);
            const matches = (st: GameState) => {
              const t = st.territories[id]!;
              return t.owner === mem.owner && t.troops === mem.troops && t.building === mem.building;
            };
            // Either it was in sight when that turn's planning began and matches the truth then exactly...
            const then = history.get(mem.turn)!;
            if (visionFor(ctx, then, p.id).has(id) && matches(then)) continue;
            // ...or it was seen during that turn's resolution: at some step it was in sight (just before or just
            // after it) and the memory matches the board right after that step.
            const during = moments.get(mem.turn) ?? [];
            const seenAt = during.findIndex(
              (st, k) => k > 0 && matches(st) && (visionFor(ctx, st, p.id).has(id) || visionFor(ctx, during[k - 1]!, p.id).has(id)),
            );
            expect(seenAt, `${p.id} remembers ${id} as ${JSON.stringify(mem)}`).toBeGreaterThan(0);
            midTurn++;
          }
          for (const t of Object.values(s.territories)) if (t.owner) expect(t.troops).toBeGreaterThan(0);
          // The view never carries a fogged territory's current state, only the memory.
          const v = viewFor(ctx, s, p.id);
          for (const [id, tv] of Object.entries(v.territories)) {
            if (tv.detail === "full") continue;
            expect(Object.keys(tv).sort()).toEqual(tv.lastSeen ? ["detail", "lastSeen"] : ["detail"]);
            if (tv.lastSeen) expect(tv.lastSeen).toEqual(s.intel[p.id]![id]);
          }
        }
      }
    }
    // Plenty of the checked entries were old ones, from land that had slipped into the fog, and plenty were seen
    // part-way through a turn.
    expect(stale).toBeGreaterThan(100);
    expect(midTurn).toBeGreaterThan(20);
  });

  it("remembers the capture of your own land, even once it's deep in the fog", () => {
    // p1 holds a and c; b is empty. p2 takes c, leaving p1 with only a, which can't see c.
    const { ctx, s } = lineSetup({ a: ["p1", 5], c: ["p1", 1], d: ["p2", 20], e: ["p2", 5] });
    const r = resolveTurn(ctx, s, { p2: [mv("d", "c", 10)] });
    const battle = r.events.find((e) => e.type === "battle")!;
    expect(battle).toMatchObject({ captured: true });
    const v = viewFor(ctx, r.state, "p1");
    // Seen as it fell, during turn 1: on turn 2 it reads "Seen last turn".
    expect(v.territories.c).toEqual({ detail: "fogged", lastSeen: { owner: "p2", troops: r.state.territories.c!.troops, building: null, turn: 1 } });
    // Not "still mine, 1 troop", which is what the old memory said.
    expect(s.intel.p1!.c).toMatchObject({ owner: "p1", troops: 1 });
  });

  it("a battle that wipes out both sides leaves the last defender holding (never 0 troops)", () => {
    const { ctx, s } = lineSetup({ a: ["p1", 5], b: ["p1", 2], c: ["p2", 1], e: ["p2", 5] });
    const r = resolveTurn(ctx, s, { p1: [mv("b", "c", 1)] });
    const battle = r.events.find((e) => e.type === "battle");
    expect(battle).toMatchObject({ captured: false, result: { attackerLosses: 1, defenderLosses: 0 } });
    expect(r.state.territories.c).toMatchObject({ owner: "p2", troops: 1 });
    expect(r.state.intel.p1!.c).toMatchObject({ owner: "p2", troops: 1 });
  });

  it("keeps no memory with fog off", () => {
    const ctx = embervaleCtx();
    const s = createGame(ctx, { gameId: "f", seed: "nofog", players: [{ id: "p1", name: "A" }, { id: "p2", name: "B" }], settings: { fog: false } });
    expect(s.intel).toEqual({ p1: {}, p2: {} });
    expect(resolveTurn(ctx, s, {}).state.intel).toEqual({ p1: {}, p2: {} });
  });

  it("a forged entry (a fooled spy, M3) looks exactly like a real sighting", () => {
    const { ctx, s } = lineSetup({ a: ["p1", 5], b: ["p1", 3], d: ["p2", 20], e: ["p2", 5] });
    recordSighting(s, "p1", "e", { owner: "p2", troops: 2, building: null, turn: 1 });
    expect(viewFor(ctx, s, "p1").territories.e).toEqual({ detail: "fogged", lastSeen: { owner: "p2", troops: 2, building: null, turn: 1 } });
  });

  it("shows whose capital a territory is, once you can see it", () => {
    const { ctx, s } = lineSetup({ a: ["p1", 5], b: ["p1", 3], c: ["p1", 3], d: ["p1", 3], e: ["p2", 5] });
    const v = viewFor(ctx, s, "p1");
    expect(v.territories.a).toMatchObject({ capitalOf: "p1" });
    expect(v.territories.e).toMatchObject({ capitalOf: "p2" });
    expect(v.territories.b).toMatchObject({ capitalOf: null });
    // A captured capital isn't labelled as one while someone else holds it.
    s.territories.e!.owner = "p1";
    expect(viewFor(ctx, s, "p1").territories.e).toMatchObject({ capitalOf: null });
  });
});
