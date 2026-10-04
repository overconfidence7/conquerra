import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SPECIALIST_TYPES } from "@conquerra/content";
import { createGame, indexMap, replayFor, resolveTurn, viewFor, type GameState, type Order, type OrdersByPlayer, type PresetId, type TroopAmount } from "../src";
import { embervaleCtx } from "./helpers";

const ctx = embervaleCtx();
const idx = indexMap(ctx.map);
const ids = idx.ids;
const presetIds: PresetId[] = ["onlyIfStronger", "holdIfThreatened", "retreatIfOutnumbered", "followThrough", "reinforceIfHit"];
const terr = fc.constantFrom(...ids);
const spec = fc.constantFrom(...SPECIALIST_TYPES);
const preset = fc.option(fc.record({ id: fc.constantFrom(...presetIds), next: fc.option(terr, { nil: undefined }) }), { nil: undefined });

/** Random (often nonsensical) orders: the engine must survive anything a client could send. */
const orderArb: fc.Arbitrary<Order> = fc.oneof(
  fc.record({
    id: fc.string({ maxLength: 4 }),
    kind: fc.constant("move" as const),
    from: terr,
    to: terr,
    via: fc.option(terr, { nil: undefined }),
    troops: fc.oneof(
      fc.constant("all" as const),
      fc.constant("enough" as const),
      fc.integer({ min: -5, max: 50 }),
      fc.constantFrom(0.25, 0.5, 0.75, 7, -1, Number.NaN).map((share) => ({ share }) as TroopAmount),
    ),
    specialists: fc.option(fc.oneof(fc.constant("all" as const), fc.array(spec, { maxLength: 3 })), { nil: undefined }),
    withLeader: fc.boolean(),
    preset,
  }),
  fc.record({ id: fc.string({ maxLength: 4 }), kind: fc.constant("recruit" as const), territory: terr, count: fc.integer({ min: -2, max: 8 }) }),
  fc.record({ id: fc.string({ maxLength: 4 }), kind: fc.constant("hire" as const), territory: terr, specialist: spec }),
  fc.record({ id: fc.string({ maxLength: 4 }), kind: fc.constant("invest" as const), territory: terr }),
  fc.record({ id: fc.string({ maxLength: 4 }), kind: fc.constant("retreat" as const), from: terr, preset }),
  fc.record({ id: fc.string({ maxLength: 4 }), kind: fc.constant("advance" as const), from: terr }),
  fc.record({
    id: fc.string({ maxLength: 4 }),
    kind: fc.constant("build" as const),
    territory: terr,
    building: fc.constantFrom("fort" as const, "market" as const, "barracks" as const, "watchtower" as const),
  }),
);

/** Smarter random orders: moves from territories the player actually holds to neighbors, plus spending. */
function plausibleOrders(s: GameState, pid: string, picks: number[]): Order[] {
  const mine = ids.filter((id) => s.territories[id]!.owner === pid);
  const amounts: TroopAmount[] = ["all", "enough", { share: 0.75 }, { share: 0.5 }, { share: 0.25 }, 3];
  let prev: Order | null = null;
  return picks.map((n, i): Order => {
    // Sometimes chain: push on from where the previous move went.
    const from = prev?.kind === "move" && n % 5 === 0 ? prev.to : (mine[n % Math.max(1, mine.length)] ?? ids[0]!);
    const nbrs = idx.neighbors.get(from)!;
    const id = `${pid}-${i}`;
    let o: Order;
    switch (n % 6) {
      case 0:
        o = { id, kind: "hire", territory: from, specialist: SPECIALIST_TYPES[n % SPECIALIST_TYPES.length]! };
        break;
      case 1:
        o = { id, kind: "invest", territory: from };
        break;
      default:
        o = { id, kind: "move", from, to: nbrs[n % nbrs.length]!, troops: amounts[(n >> 2) % amounts.length]!, withLeader: n % 3 === 0, ...(n % 4 === 0 ? { preset: { id: presetIds[n % presetIds.length]! } } : {}) };
    }
    prev = o;
    return o;
  });
}

function checkInvariants(s: GameState) {
  const seenSpecs = new Set<string>();
  for (const id of ids) {
    const t = s.territories[id]!;
    expect(Number.isInteger(t.troops)).toBe(true);
    expect(t.troops).toBeGreaterThanOrEqual(0);
    expect(t.specialists.length).toBeLessThanOrEqual(ctx.rules.specialists.maxPerArmy);
    if (t.specialists.length) expect(t.troops).toBeGreaterThan(0);
    for (const sp of t.specialists) {
      expect(seenSpecs.has(sp.id)).toBe(false);
      seenSpecs.add(sp.id);
    }
    expect(t.culture).toBeGreaterThanOrEqual(0);
    expect(t.culture).toBeLessThanOrEqual(ctx.rules.culture.max);
    if (t.owner) expect(s.players.some((p) => p.id === t.owner)).toBe(true);
    expect(t.building !== null && t.construction !== null).toBe(false);
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
        fc.array(fc.tuple(fc.array(orderArb, { maxLength: 8 }), fc.array(fc.nat(), { maxLength: 8 })), { minLength: 1, maxLength: 8 }),
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
          for (const p of s.players) p.gold = 200;
          for (const [junk, picks] of turns) {
            if (s.winner) break;
            const orders: OrdersByPlayer = {
              p1: junk,
              p2: plausibleOrders(s, "p2", picks),
              p3: [...plausibleOrders(s, "p3", picks.slice().reverse()), ...junk],
            };
            const before = s;
            const r = resolveTurn(ctx, s, orders);
            s = r.state;
            checkInvariants(s);
            for (const p of s.players) {
              viewFor(ctx, s, p.id);
              replayFor(ctx, before, r, p.id);
            }
          }
        },
      ),
      { numRuns: 150 },
    );
  }, 30000);

  it("is deterministic: same seed and orders give byte-identical results", () => {
    fc.assert(
      fc.property(fc.string(), fc.array(fc.array(fc.nat(), { maxLength: 8 }), { minLength: 1, maxLength: 6 }), (seed, turns) => {
        const run = () => {
          let s = createGame(ctx, { gameId: "det", seed, players: [{ id: "p1", name: "A" }, { id: "p2", name: "B" }] });
          for (const p of s.players) p.gold = 100;
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
  }, 30000);
});
