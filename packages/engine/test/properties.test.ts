import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createGame, indexMap, resolveTurn, type GameState, type Order, type OrdersByPlayer } from "../src";
import { embervaleCtx } from "./helpers";

const ctx = embervaleCtx();
const idx = indexMap(ctx.map);
const ids = idx.ids;

/** Random (often nonsensical) orders: the engine must survive anything a client could send. */
const orderArb: fc.Arbitrary<Order> = fc.oneof(
  fc.record({
    id: fc.string({ maxLength: 4 }),
    kind: fc.constant("move" as const),
    from: fc.constantFrom(...ids),
    to: fc.constantFrom(...ids),
    units: fc.oneof(
      fc.constant("all" as const),
      fc.record({ infantry: fc.integer({ min: -5, max: 50 }), cavalry: fc.integer({ min: 0, max: 10 }) }),
    ),
    withLeader: fc.boolean(),
  }),
  fc.record({
    id: fc.string({ maxLength: 4 }),
    kind: fc.constant("recruit" as const),
    territory: fc.constantFrom(...ids),
    unit: fc.constantFrom("infantry" as const, "cavalry" as const, "siege" as const),
    count: fc.integer({ min: -2, max: 8 }),
  }),
  fc.record({
    id: fc.string({ maxLength: 4 }),
    kind: fc.constant("build" as const),
    territory: fc.constantFrom(...ids),
    building: fc.constantFrom("fort" as const, "market" as const, "barracks" as const, "watchtower" as const),
  }),
);

/** Smarter random orders: moves from territories the player actually holds to neighbors. */
function plausibleOrders(s: GameState, pid: string, picks: number[]): Order[] {
  const mine = ids.filter((id) => s.territories[id]!.owner === pid);
  return picks.map((n, i) => {
    const from = mine[n % Math.max(1, mine.length)] ?? ids[0]!;
    const nbrs = idx.neighbors.get(from)!;
    return { id: `${pid}-${i}`, kind: "move", from, to: nbrs[n % nbrs.length]!, units: "all", withLeader: n % 3 === 0 } as Order;
  });
}

function checkInvariants(s: GameState) {
  for (const id of ids) {
    const t = s.territories[id]!;
    for (const v of Object.values(t.units)) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    }
    if (t.owner) expect(s.players.some((p) => p.id === t.owner)).toBe(true);
  }
  for (const p of s.players) {
    expect(p.gold).toBeGreaterThanOrEqual(0);
    const owns = ids.some((id) => s.territories[id]!.owner === p.id);
    if (p.eliminatedTurn !== null) {
      expect(owns).toBe(false);
      expect(p.leader.alive).toBe(false);
    } else expect(owns).toBe(true);
    if (p.leader.alive) expect(s.territories[p.leader.territory!]!.owner).toBe(p.id);
  }
}

describe("engine properties", () => {
  it("survives random orders and keeps every invariant", () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.array(fc.tuple(fc.array(orderArb, { maxLength: 6 }), fc.array(fc.nat(), { maxLength: 6 })), { minLength: 1, maxLength: 8 }),
        (seed, turns) => {
          let s = createGame(ctx, {
            gameId: "prop",
            seed,
            players: [
              { id: "p1", name: "A" },
              { id: "p2", name: "B" },
              { id: "p3", name: "C" },
            ],
          });
          for (const [junk, picks] of turns) {
            if (s.winner) break;
            const orders: OrdersByPlayer = {
              p1: junk,
              p2: plausibleOrders(s, "p2", picks),
              p3: [...plausibleOrders(s, "p3", picks.slice().reverse()), ...junk],
            };
            s = resolveTurn(ctx, s, orders).state;
            checkInvariants(s);
          }
        },
      ),
      { numRuns: 150 },
    );
  });

  it("is deterministic: same seed and orders give byte-identical results", () => {
    fc.assert(
      fc.property(fc.string(), fc.array(fc.array(fc.nat(), { maxLength: 6 }), { minLength: 1, maxLength: 6 }), (seed, turns) => {
        const run = () => {
          let s = createGame(ctx, { gameId: "det", seed, players: [{ id: "p1", name: "A" }, { id: "p2", name: "B" }] });
          const log: string[] = [];
          for (const picks of turns) {
            if (s.winner) break;
            const r = resolveTurn(ctx, s, { p1: plausibleOrders(s, "p1", picks), p2: plausibleOrders(s, "p2", picks) });
            log.push(JSON.stringify(r.events));
            s = r.state;
          }
          return JSON.stringify(s) + log.join("");
        };
        expect(run()).toBe(run());
      }),
      { numRuns: 100 },
    );
  });
});
