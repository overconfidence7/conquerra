import { MapDef, SPECIALIST_TYPES } from "@conquerra/content";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  createGame,
  indexMap,
  replayFor,
  resolveTurn,
  Rng,
  seedRng,
  trueDetail,
  TurnVision,
  visionFor,
  WORLD_EVENT_KINDS,
  type GameState,
  type Order,
  type OrdersByPlayer,
  type ReplayEvent,
  type StepEvent,
  type VisionEvent,
} from "../src";
import { ctxWith, embervaleCtx, mv } from "./helpers";

/** A nine-territory line: a - b - c - d - e - f - g - h - i. Capitals at a (p1) and i (p2). */
const longLine: MapDef = MapDef.parse({
  id: "longline",
  name: "Long line",
  minPlayers: 2,
  maxPlayers: 2,
  recommendedPlayers: { min: 2, max: 2 },
  territories: "abcdefghi".split("").map((id, i) => ({ id, name: id.toUpperCase(), province: i < 3 ? "west" : i < 6 ? "mid" : "east", terrain: "plains", x: i * 100, y: 0 })),
  provinces: [
    { id: "west", name: "West", bonus: 2 },
    { id: "mid", name: "Mid", bonus: 2 },
    { id: "east", name: "East", bonus: 2 },
  ],
  borders: "abcdefgh".split("").map((a, i) => ({ a, b: "abcdefghi"[i + 1]! })),
  capitalSlots: ["a", "i"],
});

/** The long line with an exact layout: territory -> [owner, troops]. Unlisted land is neutral with 1 troop. */
function line(layout: Record<string, [string | null, number]>, settings: Partial<GameState["settings"]> = {}) {
  const ctx = ctxWith(undefined, longLine);
  const s = createGame(ctx, { gameId: "fogline", seed: "fogline", players: [{ id: "p1", name: "One" }, { id: "p2", name: "Two" }], settings: { luck: 0, ...settings } });
  for (const t of Object.keys(s.territories)) s.territories[t] = { owner: null, troops: 1, specialists: [], building: null, construction: null, culture: 0 };
  for (const [t, [owner, troops]] of Object.entries(layout)) s.territories[t] = { owner, troops, specialists: [], building: null, construction: null, culture: 0 };
  const p1 = s.players[0]!, p2 = s.players[1]!;
  p1.capital = "a";
  p2.capital = "i";
  p1.leader = { alive: true, territory: "a" };
  p2.leader = { alive: true, territory: "i" };
  p1.gold = p2.gold = 0;
  s.intel = { p1: {}, p2: {} };
  return { ctx, s };
}

/** Orders that do nothing useful but take up a round-robin slot (so later orders land in a known round). */
const wait = (n: number): Order[] => Array.from({ length: n }, (_, i) => ({ id: `w${i}`, kind: "invest", territory: "zz" }) as unknown as Order);

const visions = (r: ReplayEvent[]) => r.filter((e): e is VisionEvent => e.type === "vision");

describe("the fog lifts during the replay", () => {
  it("a 3-hop chain into the fog reveals the land step by step, in order", () => {
    const { ctx, s } = line({ a: ["p1", 5], b: ["p1", 40], i: ["p2", 5] });
    // At the start p1 sees a, b and c (the border).
    expect([...visionFor(ctx, s, "p1").keys()].sort()).toEqual(["a", "b", "c"]);
    const result = resolveTurn(ctx, s, { p1: [mv("b", "c", "all"), mv("c", "d", "all"), mv("d", "e", "all")] });
    const replay = replayFor(ctx, s, result, "p1");
    const v = visions(replay);
    expect(v.map((e) => Object.keys(e.revealed))).toEqual([["d"], ["e"], ["f"]]);
    expect(v.every((e) => Object.keys(e.fogged).length === 0)).toBe(true);
    // Each reveal comes right after the capture that caused it, and before the next hop.
    const order = replay.filter((e) => e.type === "battle" || e.type === "vision").map((e) => (e.type === "battle" ? `take ${e.to}` : `see ${Object.keys(e.revealed).join("")}`));
    expect(order).toEqual(["take c", "see d", "take d", "see e", "take e", "see f"]);
    // The snapshot is the land as it was at that moment, with the same detail viewFor gives.
    expect(v[0]!.revealed.d).toEqual({ detail: "full", seenBy: ["border"], owner: null, troops: 1, specialists: [], building: null, construction: null, culture: 0, leaders: [], generals: [], capitalOf: null });
  });

  it("a rival's battle on land you only saw part-way through the turn shows in full", () => {
    // p1 pushes b -> c -> d, which brings e into view in round 2. p2 attacks e from f in round 3.
    const { ctx, s } = line({ a: ["p1", 5], b: ["p1", 40], f: ["p2", 20], i: ["p2", 5] });
    const result = resolveTurn(ctx, s, { p1: [mv("b", "c", "all"), mv("c", "d", "all")], p2: [...wait(2), mv("f", "e", 10)] });
    const replay = replayFor(ctx, s, result, "p1");
    const rival = replay.find((e) => e.type === "battle" && e.player === "p2");
    expect(rival).toMatchObject({ type: "battle", from: "f", to: "e", captured: true });
    expect(replay.some((e) => e.type === "surface")).toBe(false);
  });

  it("a rival's action on land that only came into view later in the turn does not show in full", () => {
    // p2 takes e in round 1, while it's still in the fog; p1 only sees e after taking d in round 2.
    const { ctx, s } = line({ a: ["p1", 5], b: ["p1", 40], f: ["p2", 20], g: ["p2", 6], i: ["p2", 5] });
    const result = resolveTurn(ctx, s, { p1: [mv("b", "c", "all"), mv("c", "d", "all")], p2: [mv("f", "e", 10), mv("g", "f", 3)] });
    const replay = replayFor(ctx, s, result, "p1");
    // The battle stays a surface detail, and p2's quiet move behind it doesn't show at all...
    expect(replay.some((e) => e.type === "battle" && e.player === "p2")).toBe(false);
    expect(replay.find((e) => e.type === "surface")).toMatchObject({ what: "battle", province: "mid" });
    expect(replay.some((e) => e.type === "moved")).toBe(false);
    // ...but once e comes into view, p1 sees it as it is then: p2 holds it.
    const seenE = visions(replay).find((e) => e.revealed.e)!;
    expect(seenE.revealed.e).toMatchObject({ owner: "p2", troops: result.state.territories.e!.troops });
  });

  it("losing land fogs its surroundings from that step on", () => {
    // p1 holds a-d and sees e. p2 takes d in round 1, so e fogs; p2's move into e in round 2 then stays hidden.
    const { ctx, s } = line({ a: ["p1", 5], b: ["p1", 1], c: ["p1", 1], d: ["p1", 1], e: ["p2", 30], f: ["p2", 4], i: ["p2", 5] });
    expect(visionFor(ctx, s, "p1").has("e")).toBe(true);
    const result = resolveTurn(ctx, s, { p2: [mv("e", "d", 20), mv("f", "e", 3)] });
    const replay = replayFor(ctx, s, result, "p1");
    const v = visions(replay);
    expect(v).toHaveLength(1);
    expect(Object.keys(v[0]!.fogged)).toEqual(["e"]);
    // What p1 last saw of e: just after the attack left it.
    expect(v[0]!.fogged.e).toEqual({ owner: "p2", troops: 10, building: null, turn: 1 });
    expect(replay.findIndex((e) => e.type === "vision")).toBe(replay.findIndex((e) => e.type === "battle") + 1);
    // The later move into e happened in the fog (the old rule showed it, because p1 could see e when the turn began).
    expect(replay.some((e) => e.type === "moved")).toBe(false);
    expect(result.state.intel.p1!.e).toEqual({ owner: "p2", troops: 10, building: null, turn: 1 });
  });

  it("remembers what you saw part-way through the turn, including land you took and lost again", () => {
    // p1 takes c then d (seeing e). p2 strikes back: e -> d, then d -> c. p1 ends up holding a and b.
    const { ctx, s } = line({ a: ["p1", 5], b: ["p1", 40], e: ["p2", 80], i: ["p2", 5] });
    const result = resolveTurn(ctx, s, { p1: [mv("b", "c", "all"), mv("c", "d", "all")], p2: [...wait(2), mv("e", "d", "all"), mv("d", "c", "all")] });
    const st = result.state;
    expect(st.territories.c!.owner).toBe("p2");
    expect(st.territories.d!.owner).toBe("p2");
    const v = visions(replayFor(ctx, s, result, "p1"));
    expect(v.map((e) => [Object.keys(e.revealed), Object.keys(e.fogged)])).toEqual([
      [["d"], []],
      [["e"], []],
      [[], ["e"]],
      [[], ["d"]],
    ]);
    // d: taken, lost, and then lost from sight when c fell: remembered as p2's, with the 1 troop left behind.
    expect(st.intel.p1!.d).toEqual({ owner: "p2", troops: 1, building: null, turn: 1 });
    // e: only ever seen mid-turn, and remembered as it was when it fogged over (p2 had marched out of it).
    expect(st.intel.p1!.e).toEqual({ owner: "p2", troops: 1, building: null, turn: 1 });
    // f was never in sight, so it isn't remembered.
    expect(st.intel.p1!.f).toBeUndefined();
  });

  it("a player knocked out this turn watches the whole turn, as a spectator would", () => {
    const { ctx, s } = line({ a: ["p1", 40], b: ["p2", 1], i: ["p2", 5], h: ["p2", 3] });
    s.players[1]!.capital = "b";
    s.territories.i = { owner: null, troops: 1, specialists: [], building: null, construction: null, culture: 0 };
    s.territories.h = { owner: null, troops: 1, specialists: [], building: null, construction: null, culture: 0 };
    s.players[1]!.leader = { alive: true, territory: "b" };
    const result = resolveTurn(ctx, s, { p1: [mv("a", "b", "all")] });
    expect(result.state.players[1]!.eliminatedTurn).toBe(1);
    const replay = replayFor(ctx, s, result, "p2");
    // The fog lifts off everything at the very start of the turn.
    const v = visions(replay);
    expect(v[0]!.step).toBe(0);
    expect(Object.keys(v[0]!.revealed).sort()).toEqual(["d", "e", "f", "g", "h", "i"]);
    expect(replay.some((e) => e.type === "surface")).toBe(false);
  });

  it("with fog off nothing changes: no vision events, and every battle shows", () => {
    const { ctx, s } = line({ a: ["p1", 5], b: ["p1", 40], f: ["p2", 20], i: ["p2", 5] }, { fog: false });
    const result = resolveTurn(ctx, s, { p1: [mv("b", "c", "all"), mv("c", "d", "all")], p2: [mv("f", "e", 10)] });
    const replay = replayFor(ctx, s, result, "p1");
    expect(visions(replay)).toHaveLength(0);
    expect(replay.filter((e) => e.type === "battle")).toHaveLength(3);
    expect(result.state.intel).toEqual({ p1: {}, p2: {} });
  });
});

// ---------- Property tests: the replay never shows anything the player couldn't see at that moment ----------

const ectx = embervaleCtx();
const idx = indexMap(ectx.map);

/** Random but plausible orders, with chains, scouts and watchtowers (the things that move vision around). */
function randomOrders(s: GameState, pid: string, rng: Rng): Order[] {
  const mine = idx.ids.filter((id) => s.territories[id]!.owner === pid);
  if (!mine.length) return [];
  const orders: Order[] = [];
  const n = 2 + rng.int(6);
  let at: string | null = null;
  for (let i = 0; i < n; i++) {
    const id = `${pid}-${i}`;
    const roll = rng.int(10);
    const from: string = at && roll < 4 ? at : mine[rng.int(mine.length)]!;
    if (roll === 8) orders.push({ id, kind: "hire", territory: s.players.find((p) => p.id === pid)!.capital, specialist: rng.int(2) ? "scouts" : SPECIALIST_TYPES[rng.int(SPECIALIST_TYPES.length)]! });
    else if (roll === 9) orders.push({ id, kind: "build", territory: from, building: "watchtower" });
    else {
      const ns = idx.neighbors.get(from)!;
      const to = ns[rng.int(ns.length)]!;
      orders.push({ id, kind: "move", from, to, troops: rng.int(3) ? "all" : { share: 0.5 }, withLeader: rng.int(4) === 0 });
      at = to;
    }
  }
  if (rng.int(3) === 0) orders.unshift({ id: `${pid}-r`, kind: "recruit", territory: s.players.find((p) => p.id === pid)!.capital, count: 5 });
  // Spies (session 15): hire one now and then, and send them about (or home).
  if (rng.int(3) === 0) orders.push({ id: `${pid}-y`, kind: "hireSpy", territory: s.players.find((p) => p.id === pid)!.capital });
  const provinces = ectx.map.provinces.map((p) => p.id);
  for (const spy of s.spies.filter((x) => x.owner === pid)) {
    const roll = rng.int(6);
    if (roll < 3) orders.push({ id: `${pid}-s-${spy.id}`, kind: "spy", spy: spy.id, to: provinces[rng.int(provinces.length)]! });
    else if (roll === 3) orders.push({ id: `${pid}-s-${spy.id}`, kind: "spy", spy: spy.id, to: null });
  }
  return orders;
}

/** Play some turns, recording the real board after every step of every turn. */
function playTurns(seed: string, players: number, turns: number, fog = true) {
  let s = createGame(ectx, { gameId: "leaks", seed, players: Array.from({ length: players }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}` })), settings: { fog } });
  for (const p of s.players) p.gold = 80;
  // With three or more, the last player starts out already knocked out: one of the Fallen, playing world events.
  if (players >= 3) {
    const out = s.players[players - 1]!;
    s.territories[out.capital] = { ...s.territories[out.capital]!, owner: null, troops: 1 };
    out.eliminatedTurn = 0;
    out.leader = { alive: false, territory: null };
  }
  const rng = new Rng(seedRng(`${seed}-orders`));
  const played: { before: GameState; events: StepEvent[]; steps: GameState[]; result: ReturnType<typeof resolveTurn> }[] = [];
  for (let t = 0; t < turns && !s.winner; t++) {
    const orders: OrdersByPlayer = {};
    for (const p of s.players) if (p.eliminatedTurn === null) orders[p.id] = randomOrders(s, p.id, rng);
    // The Fallen play random world events too (with plenty of Influence), so the replay covers them.
    const ids = Object.keys(s.territories);
    for (const p of s.players)
      if (p.eliminatedTurn !== null) {
        p.influence = Math.max(p.influence, 40);
        const target = ids[rng.int(ids.length)]!;
        const event = WORLD_EVENT_KINDS[rng.int(WORLD_EVENT_KINDS.length)]!;
        const across = indexMap(ectx.map).neighbors.get(target)![0];
        orders[p.id] = [{ id: `w${t}`, kind: "worldEvent", event, target, ...(across ? { across } : {}), influence: 5 + rng.int(20) }];
      }
    const steps: GameState[] = [];
    const result = resolveTurn(ectx, s, orders, (_e, live) => steps.push(JSON.parse(JSON.stringify(live)) as GameState));
    played.push({ before: s, events: result.events, steps, result });
    s = result.state;
  }
  return played;
}

/** The board just after step k (k = -1: before the turn). */
const after = (turn: { before: GameState; steps: GameState[] }, k: number) => (k < 0 ? turn.before : turn.steps[k]!);

describe("the step-by-step replay never leaks", () => {
  it("rebuilds the real board at every step from the start of the turn and the event log", () => {
    fc.assert(
      fc.property(fc.string(), fc.integer({ min: 2, max: 5 }), (seed, players) => {
        for (const turn of playTurns(seed, players, 10)) {
          const pids = turn.before.players.map((p) => p.id);
          const tv = new TurnVision(ectx, turn.before, turn.events, pids);
          const spectators = new Set(pids.filter((p) => turn.result.state.players.find((x) => x.id === p)!.eliminatedTurn !== null || turn.result.state.winner));
          turn.events.forEach((e, k) => {
            tv.step(e);
            const real = turn.steps[k]!;
            expect(tv.board.territories).toEqual(real.territories);
            expect(tv.board.players.map((p) => [p.leader, p.eliminatedTurn])).toEqual(real.players.map((p) => [p.leader, p.eliminatedTurn]));
            expect(tv.board.nextId).toBe(real.nextId);
            // And vision, worked out incrementally, is exactly what visionFor says about the real board.
            for (const p of pids) if (!spectators.has(p)) expect(tv.visible(p)).toEqual(new Set(visionFor(ectx, real, p).keys()));
          });
        }
      }),
      { numRuns: 40 },
    );
  }, 30000);

  it("every replay event and every vision snapshot matches the real game at that step, and only where the player could see", () => {
    let checkedVision = 0, checkedRival = 0, hiddenLater = 0, worldEvents = 0, fateShown = 0, fateHidden = 0, spyReported = 0;
    fc.assert(
      fc.property(fc.string(), fc.integer({ min: 2, max: 5 }), (seed, players) => {
        for (const turn of playTurns(seed, players, 10)) {
          for (const p of turn.before.players) {
            if (p.eliminatedTurn !== null) continue;
            const out = turn.result.state.players.find((x) => x.id === p.id)!.eliminatedTurn !== null || turn.result.state.winner !== null;
            const replay = replayFor(ectx, turn.before, turn.result, p.id);
            const sees = (k: number, t: string) => visionFor(ectx, after(turn, k), p.id).has(t);
            // What the player's map shows as visible, rebuilt from the start of the turn plus the vision events.
            const shown = new Set(visionFor(ectx, turn.before, p.id).keys());
            let k = 0;
            for (const e of replay) {
              // Before moving on past a step, the map's vision must match the real game exactly.
              while (k < e.step) {
                if (!out) expect(shown).toEqual(new Set(visionFor(ectx, after(turn, k), p.id).keys()));
                k++;
              }
              if (e.type === "vision") {
                // The spies' report as the turn ends (session 15): what they report, never land seen directly.
                const report = Object.values(e.revealed).every((x) => x.seenBy[0] === "spy") && Object.keys(e.fogged).every((t) => !sees(e.step - 1, t));
                if (report && !out) {
                  const intel = turn.result.state.spyIntel[p.id] ?? {};
                  const end = visionFor(ectx, turn.result.state, p.id);
                  for (const [t, seen] of Object.entries(e.revealed)) {
                    const { detail: _d, seenBy, ...rest } = seen;
                    expect(seenBy).toEqual(["spy"]);
                    expect(end.has(t)).toBe(false);
                    expect(rest).toEqual(intel[t]);
                    spyReported++;
                  }
                  for (const [t, last] of Object.entries(e.fogged)) {
                    expect(intel[t]).toBeUndefined();
                    expect(end.has(t)).toBe(false);
                    expect(last).toEqual(turn.result.state.intel[p.id]![t]);
                  }
                  continue;
                }
                for (const [t, seen] of Object.entries(e.revealed)) {
                  const real = after(turn, e.step);
                  expect(sees(e.step, t) || out).toBe(true);
                  const { detail: _d, seenBy, ...rest } = seen;
                  expect(rest).toEqual(trueDetail(real, t));
                  if (!out) expect(seenBy).toEqual(visionFor(ectx, real, p.id).get(t));
                  shown.add(t);
                  checkedVision++;
                }
                for (const [t, last] of Object.entries(e.fogged)) {
                  // Knocked out with the Fallen on: the replay ends on the political map (true owners, no troops).
                  if (last.political) {
                    expect(out).toBe(true);
                    expect({ ...last, capitalOf: undefined }).toEqual({ owner: after(turn, e.step).territories[t]!.owner, troops: 0, building: null, turn: turn.before.turn, political: true, capitalOf: undefined });
                    continue;
                  }
                  expect(sees(e.step - 1, t)).toBe(true);
                  expect(sees(e.step, t)).toBe(false);
                  const real = after(turn, e.step).territories[t]!;
                  expect(last).toEqual({ owner: real.owner, troops: real.troops, building: real.building, turn: turn.before.turn });
                  shown.delete(t);
                  checkedVision++;
                }
                continue;
              }
              if (e.type === "surface") {
                const src = turn.events[e.step]!;
                expect(["battle", "leaderKilled", "fate"]).toContain(src.type);
                if (src.type === "fate") {
                  // A Fate event in the fog: only the province, and never one on your own land.
                  expect(src.holder).not.toBe(p.id);
                  expect(Object.keys(e).sort()).toEqual(["province", "step", "type", "what", ...("yours" in e ? ["yours"] : [])].sort());
                  fateHidden++;
                }
                continue;
              }
              // Nothing is invented or changed: a full event is the engine's event, word for word.
              expect(e).toEqual(turn.events[e.step]);
              if (out || e.type === "turnStart" || e.type === "eliminated" || e.type === "gameOver") continue;
              if ("player" in e && e.player === p.id) continue;
              if (e.type === "battle" && e.defender === p.id) continue;
              // A world event (or a Fate event) on your own land always shows.
              if (e.type === "worldEvent" && e.against === p.id) {
                worldEvents++;
                continue;
              }
              if (e.type === "fate" && e.holder === p.id) {
                fateShown++;
                continue;
              }
              // Anyone else's event: the player could see one of its places just before or just after it.
              const places =
                e.type === "battle" || e.type === "moved"
                  ? [e.from, e.to]
                  : e.type === "worldEvent"
                    ? [e.target, ...(e.border ?? []), ...(e.at ? [e.at] : [])]
                    : e.type === "spoilsTurnedIn"
                      ? [e.at, ...e.land.map((l) => l.territory)]
                      : e.type === "fate"
                        ? [e.at, ...(e.border ?? []), ...e.land.map((l) => l.territory)]
                        : e.type === "missionDone"
                          ? e.land.map((l) => l.territory)
                          : "territory" in e
                            ? [e.territory]
                            : [];
              if (e.type === "fate") fateShown++;
              if (e.type === "worldEvent") worldEvents++;
              expect(places.some((t) => sees(e.step - 1, t) || sees(e.step, t)), `${p.id} saw ${JSON.stringify(e)}`).toBe(true);
              checkedRival++;
            }
            // And events the player missed stayed hidden even if their land came into view later.
            for (const src of turn.events) {
              if (src.type !== "moved" || src.player === p.id || out) continue;
              const later = [src.from, src.to].some((t) => sees(turn.steps.length - 1, t));
              const then = [src.from, src.to].some((t) => sees(src.step - 1, t) || sees(src.step, t));
              if (later && !then) {
                expect(replay.some((e) => e.step === src.step)).toBe(false);
                hiddenLater++;
              }
            }
            if (!out) expect(shown).toEqual(new Set(visionFor(ectx, turn.result.state, p.id).keys()));
          }
        }
      }),
      { numRuns: 40 },
    );
    expect(checkedVision).toBeGreaterThan(200);
    expect(checkedRival).toBeGreaterThan(50);
    expect(hiddenLater).toBeGreaterThan(0);
    // The Fallen's world events were played and shown under the fog rules too.
    expect(worldEvents).toBeGreaterThan(5);
    // Fate events: shown to the land's holder and those who see it, a surface detail otherwise.
    expect(fateShown).toBeGreaterThan(5);
    expect(fateHidden).toBeGreaterThan(5);
    // Spies reported, and only ever on land the player didn't see directly.
    expect(spyReported).toBeGreaterThan(20);
  }, 30000);

  it("works out vision from the event log without being told anything else (same result twice)", () => {
    const [turn] = playTurns("twice", 4, 1);
    const a = JSON.stringify(replayFor(ectx, turn!.before, turn!.result, "p1"));
    const b = JSON.stringify(replayFor(ectx, turn!.before, { state: turn!.result.state, events: JSON.parse(JSON.stringify(turn!.events)) }, "p1"));
    expect(a).toBe(b);
  });
});

