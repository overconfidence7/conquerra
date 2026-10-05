import { defaultRules, MapDef, type BorderType, type Terrain } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { createGame, indexMap, isRecruitSiteIn, resolveTurn, viewFor, type GameContext, type GameState, type Order } from "@conquerra/engine";
import { describe, expect, it } from "vitest";
import { captainBot, recruitBot, type Bot } from "../src";

const ember: GameContext = { map: maps.embervale!, rules: defaultRules };

/**
 * A small test map: territories in a line (a-b-c-...), with chosen border types and extra borders.
 * `layout` sets owner and troops (unlisted land is neutral with 1 troop); p1's capital is `caps[0]`.
 */
function scenario(opts: {
  line: string;
  /** More territories, joined only by `extra` borders. */
  islands?: string;
  /** What p1 remembers of land it can't see. */
  memory?: Record<string, [string | null, number]>;
  borders?: Record<string, BorderType>;
  extra?: [string, string, BorderType?][];
  terrain?: Record<string, Terrain>;
  layout: Record<string, [string | null, number]>;
  caps: string[];
  players?: number;
  gold?: number;
  buildings?: Record<string, "fort" | "barracks" | "watchtower" | "market">;
}) {
  const chain = opts.line.split("");
  const ids = [...chain, ...(opts.islands ?? "").split("").filter(Boolean)];
  const edges: { a: string; b: string; type: BorderType }[] = chain.slice(1).map((b, i) => ({ a: chain[i]!, b, type: opts.borders?.[`${chain[i]}${b}`] ?? "normal" }));
  for (const [a, b, type] of opts.extra ?? []) edges.push({ a, b, type: type ?? "normal" });
  const players = opts.players ?? opts.caps.length;
  const map = MapDef.parse({
    id: "scenario",
    name: "Scenario",
    minPlayers: 2,
    maxPlayers: Math.max(2, players),
    recommendedPlayers: { min: 2, max: Math.max(2, players) },
    territories: ids.map((id, i) => ({ id, name: id.toUpperCase(), province: `p${Math.floor(i / 3)}`, terrain: opts.terrain?.[id] ?? "plains", x: i * 100, y: 0 })),
    provinces: Array.from({ length: Math.ceil(ids.length / 3) }, (_, i) => ({ id: `p${i}`, name: `P${i}`, bonus: 2 })),
    borders: edges,
    capitalSlots: [...opts.caps, ...ids.filter((x) => !opts.caps.includes(x))].slice(0, Math.max(2, players)),
  });
  const ctx: GameContext = { map, rules: defaultRules };
  const s = createGame(ctx, { gameId: "cap", seed: "cap", players: Array.from({ length: players }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}` })), settings: { luck: 0 } });
  for (const t of ids) s.territories[t] = { owner: null, troops: 1, specialists: [], building: opts.buildings?.[t] ?? null, construction: null, culture: 0 };
  for (const [t, [owner, troops]] of Object.entries(opts.layout)) s.territories[t]!.owner = owner, s.territories[t]!.troops = troops;
  s.players.forEach((p, i) => {
    p.capital = opts.caps[i]!;
    p.leader = { alive: true, territory: opts.caps[i]! };
    p.gold = opts.gold ?? 0;
  });
  s.intel = Object.fromEntries(s.players.map((p) => [p.id, {}]));
  for (const [t, [owner, troops]] of Object.entries(opts.memory ?? {})) s.intel.p1![t] = { owner, troops, building: null, turn: 1 };
  return { ctx, s, plan: (bot: Bot = captainBot, pid = "p1") => bot.plan(ctx, viewFor(ctx, s, pid)) };
}

const moves = (orders: Order[]) => orders.filter((o): o is Extract<Order, { kind: "move" }> => o.kind === "move");
const sentFrom = (orders: Order[], from: string) => moves(orders).filter((o) => o.from === from).reduce((a, o) => a + (typeof o.troops === "number" ? o.troops : 0), 0);

describe("Captain bot: the six priorities", () => {
  it("1. holds a pass it borders with a small garrison, and builds a fort there", () => {
    // p1 holds a-b-c; c faces p2's army at d through a mountain pass.
    const { plan } = scenario({ line: "abcdef", borders: { cd: "pass" }, layout: { a: ["p1", 4], b: ["p1", 1], c: ["p1", 20], d: ["p2", 12], e: ["p2", 5], f: ["p2", 3] }, caps: ["a", "f"], gold: 30 });
    const orders = plan();
    // 11 attackers through a pass (x0.85) need 10 defenders to be held off: c keeps at least that many.
    expect(20 - sentFrom(orders, "c")).toBeGreaterThanOrEqual(10);
    expect(orders).toContainEqual(expect.objectContaining({ kind: "build", territory: "c", building: "fort" }));
    // It doesn't pile up there either: the spare troops beyond what the pass needs are free for other work.
    const recruit = scenario({ line: "abcdef", borders: { cd: "pass" }, layout: { a: ["p1", 4], b: ["p1", 1], c: ["p1", 20], d: ["p2", 12], e: ["p2", 5], f: ["p2", 3] }, caps: ["a", "f"], gold: 30 }).plan(recruitBot);
    expect(recruit.some((o) => o.kind === "build" && o.building === "fort")).toBe(false);
  });

  it("2. breaks through a pass only with a real army, then chains on", () => {
    const base = { line: "abcdefg", borders: { cd: "pass" } as Record<string, BorderType>, caps: ["a", "g"] };
    // Not enough yet: 19 spare troops can probably take d (12) through the pass, but that's no real army. It waits.
    const thin = scenario({ ...base, layout: { a: ["p1", 4], b: ["p1", 1], c: ["p1", 29], d: ["p2", 12], e: ["p2", 2], f: ["p2", 2], g: ["p2", 3] } }).plan();
    expect(moves(thin).some((o) => o.from === "c" && o.to === "d")).toBe(false);
    // With half as much again as it needs, it goes through with everything it can spare and pushes on.
    const strong = scenario({ ...base, layout: { a: ["p1", 4], b: ["p1", 1], c: ["p1", 45], d: ["p2", 12], e: ["p2", 2], f: ["p2", 2], g: ["p2", 3] } }).plan();
    const through = moves(strong).find((o) => o.from === "c" && o.to === "d")!;
    expect(through).toBeTruthy();
    expect(through.troops as number).toBeGreaterThanOrEqual(Math.ceil(18 * 1.5));
    expect(moves(strong).some((o) => o.from === "d" && o.to === "e")).toBe(true);
  });

  it("3. lands from the sea where the far side is weak", () => {
    // From a, two sea lanes: to x (p2, 2 troops) and to y (p2, 14 troops). The land route b is a strong neutral.
    const { plan } = scenario({
      line: "ab",
      islands: "xycd",
      extra: [["a", "x", "sea"], ["a", "y", "sea"], ["x", "c"], ["y", "d"], ["c", "d"]],
      layout: { a: ["p1", 20], b: [null, 30], c: ["p2", 4], d: ["p2", 6], x: ["p2", 2], y: ["p2", 14] },
      caps: ["a", "d"],
    });
    const orders = plan();
    const landing = moves(orders).find((o) => o.from === "a");
    expect(landing).toMatchObject({ to: "x" });
    // A landing goes in with a real army (the crossing costs a quarter of its strength).
    expect(landing!.troops as number).toBeGreaterThanOrEqual(6);
  });

  it("4. finishes what it starts: with three left, it goes for the weakest rival and its capital", () => {
    // p2 (west) holds 4 territories; p3 (east) holds 2, including its capital f. p1 sits between them at c-d.
    const { plan } = scenario({
      line: "abcdefgh",
      layout: { a: ["p2", 6], b: ["p2", 3], g: ["p2", 3], h: ["p2", 3], c: ["p1", 3], d: ["p1", 30], e: ["p3", 3], f: ["p3", 4] },
      extra: [["g", "a"]],
      caps: ["c", "a", "f"],
    });
    const orders = plan();
    const attacks = moves(orders).filter((o) => o.from === "d" || o.from === "e");
    expect(attacks[0]).toMatchObject({ from: "d", to: "e" });
    expect(attacks.some((o) => o.from === "e" && o.to === "f")).toBe(true);
  });

  it("5. defends its capital when a big army stands next to it", () => {
    // p1's capital b has 6 troops; p2 has 25 next door at c. p1's other army (20) is at a.
    const { plan } = scenario({ line: "abcde", layout: { a: ["p1", 20], b: ["p1", 6], c: ["p2", 25], d: ["p2", 4], e: ["p2", 4] }, caps: ["b", "e"], gold: 30 });
    const orders = plan();
    expect(orders).toContainEqual(expect.objectContaining({ kind: "recruit", territory: "b" }));
    expect(orders).toContainEqual(expect.objectContaining({ kind: "build", territory: "b", building: "fort" }));
    expect(moves(orders).some((o) => o.from === "a" && o.to === "b")).toBe(true);
    expect(sentFrom(orders, "b")).toBe(0);
  });

  it("6. chains like a person: hops on when the next hop is comfortably likely to win, into the fog too", () => {
    // A long line of lightly held neutral land; p1 can see only b at the start.
    const { plan } = scenario({ line: "abcdefgh", layout: { a: ["p1", 30], h: ["p2", 5] }, caps: ["a", "h"] });
    const orders = plan();
    const hops = moves(orders).map((o) => `${o.from}${o.to}`);
    expect(hops.slice(0, 3)).toEqual(["ab", "bc", "cd"]);
    // But not into land it remembers as strongly held.
    const wall = scenario({ line: "abcdefgh", layout: { a: ["p1", 12], c: [null, 9], h: ["p2", 5] }, memory: { c: [null, 9] }, caps: ["a", "h"] }).plan();
    expect(moves(wall).map((o) => `${o.from}${o.to}`)).not.toContain("bc");
  });

  it("7. loyal land: raises culture at its capital when a rival army stands next door and a real garrison holds it", () => {
    const at = (troops: number, rival: number) => {
      const sc = scenario({ line: "abcdef", layout: { a: ["p1", 2], b: ["p1", troops], c: ["p2", rival], d: ["p2", 4], e: ["p2", 4], f: ["p2", 4] }, caps: ["b", "f"], gold: 40 });
      sc.s.turn = 5;
      return sc.plan().filter((o) => o.kind === "invest");
    };
    expect(at(30, 12)).toEqual([expect.objectContaining({ territory: "b" })]);
    // Not worth it with only a few troops there (the bonus is a share of the defenders), nor with no rival army near.
    expect(at(3, 12)).toEqual([]);
    expect(at(30, 1)).toEqual([]);
  });
});

describe("Captain bot: fair play", () => {
  function playFull(seed: string, players: number, bots: Bot[]) {
    let s = createGame(ember, { gameId: seed, seed, players: Array.from({ length: players }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}` })) });
    const transcript: string[] = [];
    const illegal: string[] = [];
    while (!s.winner) {
      const st = s;
      const orders = Object.fromEntries(st.players.filter((p) => p.eliminatedTurn === null).map((p) => [p.id, bots[st.players.indexOf(p) % bots.length]!.plan(ember, viewFor(ember, st, p.id))]));
      const r = resolveTurn(ember, st, orders);
      for (const e of r.events) if (e.type === "fizzled" && /^(invalid|notConnected|badCount)$/.test(e.reason)) illegal.push(e.reason);
      transcript.push(JSON.stringify(r.events));
      s = r.state;
    }
    return { s, transcript: transcript.join("\n"), illegal };
  }

  it("plays whole games to the end, and only ever gives orders that make sense from its own view", () => {
    const idx = indexMap(ember.map);
    for (const seed of ["cap-legal-1", "cap-legal-2"]) {
      let s = createGame(ember, { gameId: seed, seed, players: [1, 2, 3, 4].map((i) => ({ id: `p${i}`, name: `P${i}` })) });
      let turns = 0;
      while (!s.winner && turns < 60) {
        const st = s;
        const orders: Record<string, Order[]> = {};
        for (const p of st.players.filter((x) => x.eliminatedTurn === null)) {
          const view = viewFor(ember, st, p.id);
          const list = captainBot.plan(ember, view);
          orders[p.id] = list;
          // Every move starts from land it holds, or from land an earlier order of its own is heading into.
          const heading = new Set<string>();
          for (const o of list) {
            if (o.kind === "move") {
              const from = view.territories[o.from]!;
              expect(heading.has(o.from) || (from.detail === "full" && from.owner === p.id), `${p.id} moves from ${o.from}`).toBe(true);
              expect(idx.neighbors.get(o.from)).toContain(o.to);
              heading.add(o.to);
            }
            // Recruits at a recruit site (capital, barracks, or a province it holds completely); hires at the capital or a barracks.
            if (o.kind === "recruit") expect(isRecruitSiteIn(ember, view, o.territory), `${p.id} recruits at ${o.territory}`).toBe(true);
            if (o.kind === "hire") {
              const t = view.territories[o.territory]!;
              expect(t.detail === "full" && t.owner === p.id && (o.territory === view.me.capital || t.building === "barracks")).toBe(true);
            }
            if (o.kind === "build" || o.kind === "invest") expect(view.territories[o.territory]).toMatchObject({ detail: "full", owner: p.id });
          }
        }
        s = resolveTurn(ember, st, orders).state;
        turns++;
      }
      expect(s.winner).not.toBeNull();
    }
    expect(playFull("cap-legal-3", 6, [captainBot]).illegal).toEqual([]);
  });

  it("never reads beyond its view: a hidden change in the fog changes nothing it does", () => {
    const s = createGame(ember, { gameId: "fair", seed: "fair", players: [1, 2, 3, 4].map((i) => ({ id: `p${i}`, name: `P${i}` })) });
    for (const p of s.players) p.gold = 40;
    const view = viewFor(ember, s, "p1");
    const hidden = Object.keys(view.territories).filter((t) => view.territories[t]!.detail === "fogged");
    // Change everything p1 can't see: other players' armies, gold and Leaders.
    const twisted: GameState = JSON.parse(JSON.stringify(s));
    for (const t of hidden) twisted.territories[t]!.troops += 17;
    for (const p of twisted.players) if (p.id !== "p1") p.gold = 999;
    expect(viewFor(ember, twisted, "p1")).toEqual(view);
    expect(captainBot.plan(ember, viewFor(ember, twisted, "p1"))).toEqual(captainBot.plan(ember, view));
  });

  it("is deterministic: the same seed gives the same game, move for move", () => {
    expect(playFull("cap-det", 4, [captainBot]).transcript).toBe(playFull("cap-det", 4, [captainBot]).transcript);
  });

  it("beats Recruit bots more often than its fair share (a quick check; the simulator does the real count)", () => {
    let wins = 0;
    const games = 24;
    for (let g = 0; g < games; g++) {
      // Rotate the Captain's seat.
      const bots: Bot[] = [recruitBot, recruitBot, recruitBot, recruitBot];
      bots[g % 4] = captainBot;
      const { s } = playFull(`cap-vs-${g}`, 4, bots);
      if (s.winner === `p${(g % 4) + 1}`) wins++;
    }
    expect(wins / games).toBeGreaterThan(0.25);
  }, 30000);
});
