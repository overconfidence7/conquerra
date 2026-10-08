import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { createGame, resolveTurn, viewFor, type GameContext, type GameState, type Instruction, type Order } from "@conquerra/engine";
import { describe, expect, it } from "vitest";
import { captainBot, mergeGeneralOrders, planGeneral } from "../src";
import { scenario } from "./scenario";

/** p1 holds a captured Leader of `of`, standing at `at`. */
function capture(s: GameState, of: string, at: string) {
  s.players[0]!.captured.push({ of, territory: at });
  s.players[0]!.leaders.push({ kind: "leader", of, name: of, personality: null, command: null, budget: { share: 0 }, purse: 0 });
}

type Move = Extract<Order, { kind: "move" }>;
const moves = (orders: Order[]) => orders.filter((o): o is Move => o.kind === "move");

/** p1's Leader as a general with `instruction`, planned from p1's own view. */
function general(sc: ReturnType<typeof scenario>, instruction: Instruction, at?: string) {
  if (at) sc.s.players[0]!.leader.territory = at;
  return planGeneral(sc.ctx, viewFor(sc.ctx, sc.s, "p1"), "p1", instruction);
}

describe("generals: each instruction writes sensible orders", () => {
  it("Hold here: a threatened general pulls spare troops in from quiet land next door, and never attacks", () => {
    // a (capital, 10) - b (Leader, 3) - c (rival, 20) - d
    const sc = scenario({ line: "abcd", layout: { a: ["p1", 10], b: ["p1", 3], c: ["p2", 20], d: ["p2", 2] }, caps: ["a", "d"] });
    const orders = general(sc, { kind: "hold" }, "b");
    expect(orders).toEqual([expect.objectContaining({ kind: "move", from: "a", to: "b", troops: 9, general: "p1" })]);
  });

  it("Hold here: safe already, it does nothing", () => {
    const sc = scenario({ line: "abcd", layout: { a: ["p1", 10], b: ["p1", 30], c: ["p2", 2], d: ["p2", 2] }, caps: ["a", "d"] });
    expect(general(sc, { kind: "hold" }, "b")).toEqual([]);
  });

  it("Defend this border: a general away from the border marches there with its army, through your own land", () => {
    // a (Leader, 15) - b - c (border) - d (rival)
    const sc = scenario({ line: "abcde", layout: { a: ["p1", 15], b: ["p1", 2], c: ["p1", 2], d: ["p2", 6], e: ["p2", 6] }, caps: ["a", "e"] });
    const orders = general(sc, { kind: "defend", player: "p2" });
    expect(orders).toEqual([expect.objectContaining({ kind: "move", from: "a", to: "b", troops: 14, withLeader: true, general: "p1" })]);
  });

  it("Defend this border: at its post it keeps what it needs and hits back with the rest, staying put itself", () => {
    const sc = scenario({ line: "abcde", layout: { a: ["p1", 2], b: ["p1", 2], c: ["p1", 30], d: ["p2", 3], e: ["p2", 4] }, caps: ["a", "e"] });
    const orders = moves(general(sc, { kind: "defend", player: "p2" }, "c"));
    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({ from: "c", to: "d", preset: { id: "onlyIfStronger" } });
    expect(orders[0]!.withLeader).toBeUndefined();
    expect(orders[0]!.troops).toBeLessThan(30 - 1);
  });

  it("Push toward a place: its army (by number: recruits stay home) attacks along the way with the Leader, and every hop gets closer", () => {
    // a (Leader, 30) - b - c - d - e - f, all neutral with 1 troop; push toward e. A dead end hangs off b.
    const sc = scenario({ line: "abcdef", islands: "x", extra: [["b", "x"]], layout: { a: ["p1", 30], f: ["p2", 2] }, caps: ["a", "f"] });
    const orders = moves(general(sc, { kind: "push", territory: "e" }));
    expect(orders[0]).toMatchObject({ from: "a", to: "b", troops: 29, withLeader: true, general: "p1" });
    const path = orders.map((o) => o.to);
    expect(path.slice(0, 3)).toEqual(["b", "c", "d"]);
    expect(path).not.toContain("x");
    expect(orders.every((o) => o.withLeader && o.general === "p1")).toBe(true);
  });

  it("Push toward a place: blocked, it waits and gathers spare troops from quiet land behind it", () => {
    // x (8) - a (Leader, 6) - b (neutral, 40) - c
    const sc = scenario({ line: "abc", islands: "x", extra: [["a", "x"]], layout: { a: ["p1", 6], x: ["p1", 8], b: [null, 40], c: ["p2", 2] }, caps: ["a", "c"] });
    const orders = general(sc, { kind: "push", territory: "c" });
    expect(orders).toEqual([expect.objectContaining({ kind: "move", from: "x", to: "a", troops: 7 })]);
  });

  it("Push toward a place: there already, it holds", () => {
    const sc = scenario({ line: "abc", layout: { a: ["p1", 6], b: ["p1", 9], c: ["p2", 2] }, caps: ["a", "c"] });
    expect(general(sc, { kind: "push", territory: "b" }, "b")).toEqual([]);
  });

  it("Raid a rival: it takes weakly held land and keeps clear of land next to a big army", () => {
    // y (rival, 2, alone) - a (Leader, 20) - b (rival, 2) - c (rival, 40)
    const sc = scenario({ line: "abc", islands: "y", extra: [["a", "y"]], layout: { a: ["p1", 20], b: ["p2", 2], c: ["p2", 40], y: ["p2", 2] }, caps: ["a", "c"] });
    const orders = moves(general(sc, { kind: "raid", player: "p2" }));
    expect(orders[0]).toMatchObject({ from: "a", to: "y", withLeader: true });
    expect(orders.map((o) => o.to)).not.toContain("b");
  });

  it("Raid a rival: not touching it, it marches toward its land, taking neutral land but never a third player's", () => {
    // a (Leader, 20) - b (p3, 1) - c (p2) ; a - x (neutral) - c. p1 remembers seeing p2 at c.
    const opts = { line: "abc", islands: "x", extra: [["a", "x"], ["x", "c"]] as [string, string][], layout: { a: ["p1", 20], b: ["p3", 1], c: ["p2", 3] } as Record<string, [string | null, number]>, caps: ["a", "c", "b"] };
    const orders = moves(general(scenario({ ...opts, memory: { c: ["p2", 3] } }), { kind: "raid", player: "p2" }));
    expect(orders[0]).toMatchObject({ from: "a", to: "x" });
    expect(orders.map((o) => o.to)).not.toContain("b");
    // Never seen that rival's land: it can't know where to go, so it holds.
    expect(general(scenario(opts), { kind: "raid", player: "p2" })).toEqual([]);
  });

  it("uses Seize the Initiative on its first attack on a rival, when it's ready", () => {
    const sc = scenario({ line: "abc", islands: "y", extra: [["a", "y"]], layout: { a: ["p1", 20], b: ["p2", 2], c: ["p2", 40], y: ["p2", 2] }, caps: ["a", "c"] });
    expect(moves(general(sc, { kind: "raid", player: "p2" }))[0]!.timing).toBe("first");
    sc.s.players[0]!.cooldowns.seize = 2;
    expect(moves(general(sc, { kind: "raid", player: "p2" }))[0]!.timing).toBeUndefined();
  });

  it("never leaves a threatened capital bare", () => {
    const sc = scenario({ line: "abcd", layout: { a: ["p1", 20], b: [null, 1], c: ["p2", 2] }, caps: ["a", "c"], extra: [["a", "c"]] });
    sc.s.territories.c!.troops = 18;
    const orders = moves(general(sc, { kind: "push", territory: "d" }));
    const sent = orders.filter((o) => o.from === "a").reduce((n, o) => n + (typeof o.troops === "number" ? o.troops : 99), 0);
    expect(sent).toBeLessThanOrEqual(20 - 10);
  });
});

describe("generals: fair play", () => {
  const ember: GameContext = { map: maps.embervale!, rules: defaultRules };
  /** A few turns into a real game, so there's fog, memory and armies about. */
  const midGame = () => {
    let s = createGame(ember, { gameId: "gen", seed: "gen", players: ["p1", "p2", "p3", "p4"].map((id) => ({ id, name: id })) });
    for (let t = 0; t < 5; t++) s = resolveTurn(ember, s, Object.fromEntries(s.players.map((p) => [p.id, captainBot.plan(ember, viewFor(ember, s, p.id))]))).state;
    return s;
  };
  const instructions = (s: ReturnType<typeof midGame>): Instruction[] => [
    { kind: "hold" },
    { kind: "defend", player: "p2" },
    { kind: "defend", territory: s.players[1]!.capital },
    { kind: "push", territory: s.players[2]!.capital },
    { kind: "raid", player: "p3" },
  ];

  it("can't use what its owner can't see: changing land in the fog changes nothing", () => {
    const s = midGame();
    const view = viewFor(ember, s, "p1");
    const hidden = Object.keys(view.territories).filter((t) => view.territories[t]!.detail === "fogged");
    expect(hidden.length).toBeGreaterThan(5);
    const t = JSON.parse(JSON.stringify(s)) as typeof s;
    for (const h of hidden) t.territories[h]!.troops += 25;
    for (const i of instructions(s)) expect(planGeneral(ember, viewFor(ember, t, "p1"), "p1", i)).toEqual(planGeneral(ember, view, "p1", i));
  });

  it("is deterministic: the same view and instruction give the same orders", () => {
    const s = midGame();
    for (const i of instructions(s)) {
      const a = planGeneral(ember, viewFor(ember, s, "p1"), "p1", i);
      const b = planGeneral(ember, JSON.parse(JSON.stringify(viewFor(ember, s, "p1"))), "p1", i);
      expect(b).toEqual(a);
    }
  });

  it("never spends gold: only moves, whatever the instruction", () => {
    const s = midGame();
    for (const pid of ["p1", "p2", "p3", "p4"])
      for (const i of instructions(s)) for (const o of planGeneral(ember, viewFor(ember, s, pid), pid, i)) expect(o.kind).toBe("move");
  });
});

describe("generals: taking control back", () => {
  const sc = () => scenario({ line: "abcd", islands: "x", extra: [["b", "x"]], layout: { a: ["p1", 10], b: ["p1", 3], x: ["p1", 6], c: ["p2", 20], d: ["p2", 2] }, caps: ["a", "d"] });
  const mine = (o: Partial<Order> & Pick<Order, "kind">) => ({ id: "own", ...o }) as Order;

  it("an order of your own out of the general's territory drops all of its orders for the turn", () => {
    const s = sc();
    s.s.players[0]!.leader.territory = "b";
    const view = viewFor(s.ctx, s.s, "p1");
    const g = planGeneral(s.ctx, view, "p1", { kind: "hold" });
    expect(g.length).toBe(2);
    expect(mergeGeneralOrders(view, [mine({ kind: "move", from: "b", to: "c", troops: "all" } as Order)], g)).toEqual([expect.objectContaining({ id: "own" })]);
  });

  it("an order of your own out of a place it meant to pull troops from drops only that order", () => {
    const s = sc();
    s.s.players[0]!.leader.territory = "b";
    const view = viewFor(s.ctx, s.s, "p1");
    const g = planGeneral(s.ctx, view, "p1", { kind: "hold" });
    const merged = mergeGeneralOrders(view, [mine({ kind: "recruit", territory: "a", count: "all" } as Order), mine({ kind: "move", from: "x", to: "b", troops: 2 } as Order)], g);
    expect(merged.filter((o) => o.general).map((o) => (o as Move).from)).toEqual(["a"]);
  });

  it("Seize the Initiative goes on your own order when you use it too", () => {
    const s = scenario({ line: "abc", islands: "y", extra: [["a", "y"]], layout: { a: ["p1", 20], b: ["p2", 2], c: ["p2", 40], y: ["p2", 2] }, caps: ["a", "c"] });
    const view = viewFor(s.ctx, s.s, "p1");
    const g = planGeneral(s.ctx, view, "p1", { kind: "raid", player: "p2" });
    const merged = mergeGeneralOrders(view, [mine({ kind: "recruit", territory: "a", count: "all", timing: "first" } as Order)], g);
    expect(merged.filter((o) => o.timing === "first")).toHaveLength(1);
    expect(merged.find((o) => o.timing === "first")!.id).toBe("own");
  });
});

describe("captured generals", () => {
  it("command like your Leader, but the general goes along without the Leader's bonus or timing tricks", () => {
    const sc = scenario({ line: "abc", islands: "y", extra: [["a", "y"]], layout: { a: ["p1", 4], b: ["p2", 2], c: ["p2", 40], y: ["p2", 2] }, caps: ["a", "c"] });
    sc.s.territories.y = { owner: "p1", troops: 20, specialists: [], building: null, construction: null, culture: 0 };
    sc.s.territories.a!.troops = 4;
    capture(sc.s, "p9", "y");
    // y (captured general, 20) - a (Leader, 4) - b (rival, 2) - c (rival, 40); y is next to a only.
    sc.s.territories.b!.troops = 2;
    const view = viewFor(sc.ctx, sc.s, "p1");
    const orders = moves(planGeneral(sc.ctx, view, "p9", { kind: "push", territory: "b" }));
    expect(orders[0]).toMatchObject({ from: "y", to: "a", withGeneral: "p9", general: "p9" });
    expect(orders.every((o) => !o.withLeader && !o.timing)).toBe(true);
  });

  it("a captured general with no army (only the garrison) has nothing to write", () => {
    const sc = scenario({ line: "abc", layout: { a: ["p1", 1], b: [null, 1], c: ["p2", 5] }, caps: ["a", "c"] });
    capture(sc.s, "p9", "a");
    expect(planGeneral(sc.ctx, viewFor(sc.ctx, sc.s, "p1"), "p9", { kind: "push", territory: "c" })).toEqual([]);
  });
});
