import { describe, expect, it } from "vitest";
import { createGame, replayFor, resolveTurn, stateFingerprint, updateIntel, viewFor } from "../src";
import type { Order } from "../src";
import { board, ctxWith, embervaleCtx, lineGame, mv } from "./helpers";

/**
 * Session 30: blackout fog. Land a player has never seen is `unknown` in their view (fog with no memory, so a bot reads
 * it as any fog); once seen it behaves as standard fog ("last seen"). Blackout changes only what a view shows, never
 * the game: the same orders make the same game with it on or off.
 */

function lineSetup(fog: true | "blackout", layout: Parameters<typeof board>[1]) {
  const ctx = ctxWith();
  const s = lineGame(ctx, { fog });
  board(s, layout);
  updateIntel(ctx, s);
  return { ctx, s };
}

describe("blackout fog (session 30)", () => {
  it("land never seen is unknown: no owner, no troops, no memory; land in sight is as ever", () => {
    const { ctx, s } = lineSetup("blackout", { a: ["p1", 5], b: ["p1", 3], c: ["p1", 2], d: ["p2", 20], e: ["p2", 5] });
    const v = viewFor(ctx, s, "p1");
    expect(v.territories.d).toMatchObject({ detail: "full", owner: "p2", troops: 20 });
    expect(v.territories.e).toEqual({ detail: "fogged", unknown: true });
    // Standard fog: the same land is plain fog, nothing more.
    const std = lineSetup(true, { a: ["p1", 5], b: ["p1", 3], c: ["p1", 2], d: ["p2", 20], e: ["p2", 5] });
    expect(viewFor(std.ctx, std.s, "p1").territories.e).toEqual({ detail: "fogged" });
  });

  it("a seen territory stays seen: once it slips into the fog it's last-seen intel, never unknown again", () => {
    const { ctx, s } = lineSetup("blackout", { a: ["p1", 5], b: ["p1", 3], c: ["p1", 2], d: ["p2", 20], e: ["p2", 5] });
    // p2 takes c; d drops out of p1's sight.
    const r1 = resolveTurn(ctx, s, { p2: [mv("d", "c", 15)] });
    const v1 = viewFor(ctx, r1.state, "p1");
    expect(v1.territories.d).toEqual({ detail: "fogged", lastSeen: { owner: "p2", troops: 5, building: null, turn: 1 } });
    expect(v1.territories.e).toEqual({ detail: "fogged", unknown: true });
    const r2 = resolveTurn(ctx, r1.state, { p2: [{ id: "r", kind: "recruit", territory: "e", count: 3 } as Order] });
    expect(viewFor(ctx, r2.state, "p1").territories.d).toMatchObject({ detail: "fogged", lastSeen: { owner: "p2" } });
  });

  it("the game itself is the same with blackout on or off: the same orders, the same state, turn after turn", () => {
    const ctx = embervaleCtx();
    const players = [1, 2, 3, 4].map((i) => ({ id: `p${i}`, name: `P${i}` }));
    let a = createGame(ctx, { gameId: "g", seed: "blackout-same", players, settings: { fog: true } });
    let b = createGame(ctx, { gameId: "g", seed: "blackout-same", players, settings: { fog: "blackout" } });
    for (let turn = 0; turn < 6; turn++) {
      const orders = Object.fromEntries(players.map((p) => [p.id, []]));
      a = resolveTurn(ctx, a, orders).state;
      b = resolveTurn(ctx, b, orders).state;
      expect(stateFingerprint({ ...b, settings: { ...b.settings, fog: true } })).toBe(stateFingerprint(a));
    }
    // And each player's view differs only by the unknown marks.
    for (const p of players) {
      const va = viewFor(ctx, a, p.id), vb = viewFor(ctx, b, p.id);
      const strip = (v: typeof vb) => JSON.stringify({ ...v, settings: null, territories: Object.fromEntries(Object.entries(v.territories).map(([k, t]) => [k, t.detail === "fogged" ? { detail: "fogged", ...(t.lastSeen ? { lastSeen: t.lastSeen } : {}) } : t])) });
      expect(strip(vb)).toBe(strip(va));
      expect(Object.values(vb.territories).some((t) => t.detail === "fogged" && t.unknown)).toBe(true);
    }
  });

  it("unknown carries nothing: never a name, a terrain, an owner or a troop count, in the view or in the replay's fog news", () => {
    const ctx = embervaleCtx();
    const players = [1, 2, 3, 4].map((i) => ({ id: `p${i}`, name: `P${i}` }));
    let s = createGame(ctx, { gameId: "g", seed: "blackout-wire", players, settings: { fog: "blackout" } });
    const names = ctx.map.territories.map((t) => t.name);
    for (let turn = 0; turn < 8; turn++) {
      const before = s;
      // Everyone pushes out from their capital with what it holds (the fog news has something to say).
      const orders = Object.fromEntries(
        players.map((p) => {
          const cap = before.players.find((x) => x.id === p.id)!.capital;
          const next = ctx.map.borders.find((b) => b.a === cap || b.b === cap)!;
          const to = next.a === cap ? next.b : next.a;
          return [p.id, [mv(cap, to, "all")]];
        }),
      );
      const r = resolveTurn(ctx, before, orders);
      s = r.state;
      for (const p of players) {
        const v = viewFor(ctx, s, p.id);
        for (const [id, t] of Object.entries(v.territories)) {
          if (t.detail !== "fogged" || !t.unknown) continue;
          expect(Object.keys(t).sort()).toEqual(["detail", "unknown"]);
          expect(before.intel[p.id]?.[id]).toBeUndefined();
        }
        const text = JSON.stringify(v);
        for (const n of names) expect(text.includes(`"${n}"`)).toBe(false);
        // Fog news ("a battle in Northreach") only about land this player has seen at some point.
        for (const e of replayFor(ctx, before, r, p.id))
          if (e.type === "surface") expect(ctx.map.territories.some((t) => t.province === e.province && (before.intel[p.id]?.[t.id] || s.intel[p.id]?.[t.id]))).toBe(true);
      }
    }
  });
});
