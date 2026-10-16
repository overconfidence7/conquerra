import { defaultRules, marshalData, type MapDef } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { createGame, leaderKey, replayFor, resolveTurn, viewFor, type GameContext, type GameState, type Instruction, type Offer, type OrdersByPlayer, type PlayerId, type PlayerView, type ReplayEvent, type TerritoryId } from "@conquerra/engine";
import {
  captainBot,
  dealPersonalities,
  freshMemory,
  judgeOffer,
  leadersRunHouse,
  makeDelegateSeat,
  makeGeneralSeat,
  makeLeaderPathSeat,
  makeMarshalBot,
  makeStewardSeat,
  PERSONALITY_IDS,
  planFallen,
  planLeaders,
  proposeOffers,
  recruitBot,
  cloudBorders,
  knownMap,
  readBoard,
  type Bot,
} from "@conquerra/bots";
import { randomMap } from "@conquerra/mapgen";
import { describe, expect, it } from "vitest";

/**
 * Session 32, Part 1: bots never cheat under blackout. For a seat under blackout fog, everything about the land it has
 * never seen is thrown away and made up again (new ids, names, terrain, provinces, borders between two unknown lands,
 * where each border out of its known land leads, the order of it all in the map's lists), keeping only what a person in
 * that seat is shown: the known land, its borders into the cloud (their kinds), and the map's size (the lobby's card
 * says it). Every bot kind then plans from the real map and from the made-up one: the orders, the deal answers, the
 * offers and every line must be identical. Random maps and the twelve, several seeds, several turns in.
 */

type Snap = { ctx: GameContext; view: PlayerView; lastTurn: readonly ReplayEvent[] | undefined };

/** Plays a blackout game with Marshals (diplomacy, spies, Fate on) and keeps each living seat's view at these turns. */
function playAndKeep(map: MapDef, seed: string, players: number, at: readonly number[]): Snap[] {
  const ctx: GameContext = { map, rules: defaultRules };
  const ids = Array.from({ length: players }, (_, i) => `p${i + 1}`);
  const deal = dealPersonalities(seed, ids);
  const bots = new Map(ids.map((p) => [p, makeMarshalBot(deal[p]!)]));
  let s: GameState = createGame(ctx, { gameId: `honest-${seed}`, seed, players: ids.map((id) => ({ id, name: id.toUpperCase() })), settings: { fog: "blackout", luck: 0.3 }, startBonus: true });
  let last = new Map<PlayerId, ReplayEvent[]>();
  const out: Snap[] = [];
  const end = Math.max(...at);
  while (!s.winner && s.turn <= end) {
    const views = new Map(s.players.filter((p) => p.eliminatedTurn === null).map((p) => [p.id, viewFor(ctx, s, p.id)]));
    if (at.includes(s.turn)) for (const [p, v] of views) out.push({ ctx, view: v, lastTurn: last.get(p) });
    const orders: OrdersByPlayer = {};
    for (const [p, v] of views) orders[p] = bots.get(p)!.plan(ctx, v, last.get(p));
    const before = s;
    const r = resolveTurn(ctx, s, orders);
    s = r.state;
    last = new Map(s.players.filter((p) => p.eliminatedTurn === null).map((p) => [p.id, replayFor(ctx, before, r, p.id)]));
  }
  return out;
}

/** A small seeded generator for the made-up land (the test's own; the game's isn't involved). */
function rngOf(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return {
    next() {
      h = (h + 0x6d2b79f5) | 0;
      let t = Math.imul(h ^ (h >>> 15), 1 | h);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** The seat's map with everything it has never seen made up afresh; its view and replay with the new ids. */
function scramble(snap: Snap, seed: string): Snap {
  const { ctx, view } = snap;
  const map = ctx.map;
  const rng = rngOf(seed);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rng.next() * xs.length)]!;
  const isUnknown = (t: TerritoryId) => {
    const v = view.territories[t]!;
    return v.detail === "fogged" && !!v.unknown;
  };
  const unknown = map.territories.filter((t) => isUnknown(t.id)).map((t) => t.id);
  const known = map.territories.filter((t) => !isUnknown(t.id));
  const n = unknown.length;
  // New ids, in a shuffled order (so nothing lines up with the real ones).
  const fresh = Array.from({ length: n }, (_, i) => `zz${(i * 7919 + 13) % 100003}`);
  for (let i = fresh.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [fresh[i], fresh[j]] = [fresh[j]!, fresh[i]!];
  }
  // Provinces: the known ones exactly as they are, the rest renamed and rebonused, plus two new ones.
  const knownProv = new Set(known.map((t) => t.province));
  const provinces = [
    ...map.provinces.map((p) => (knownProv.has(p.id) ? p : { ...p, name: `Cloud ${p.id}`, bonus: Math.floor(rng.next() * 7) })),
    { id: "zz-north", name: "Nowhere North", bonus: 5 },
    { id: "zz-south", name: "Nowhere South", bonus: 1 },
  ];
  const terrains = ["plains", "forest", "hills", "mountains", "swamp"] as const;
  const made = fresh.map((id) => ({ id, name: `Made ${id}`, province: pick(provinces).id, terrain: pick(terrains), x: Math.floor(rng.next() * 2000), y: Math.floor(rng.next() * 2000) }));
  // Territories: the known in their own order, the made-up ones dropped in anywhere.
  const territories: MapDef["territories"] = [...known];
  for (const t of made) territories.splice(Math.floor(rng.next() * (territories.length + 1)), 0, t);
  // Borders: known to known as they are; each border from known land into the cloud keeps its kind but leads to a
  // made-up territory (distinct ones for each known territory); then made-up borders among the made-up land.
  const kk = map.borders.filter((b) => !isUnknown(b.a) && !isUnknown(b.b));
  const out: MapDef["borders"] = [...kk];
  const edgesOf = new Map<TerritoryId, MapDef["borders"][number]["type"][]>();
  for (const b of map.borders)
    if (isUnknown(b.a) !== isUnknown(b.b)) {
      const k = isUnknown(b.a) ? b.b : b.a;
      (edgesOf.get(k) ?? edgesOf.set(k, []).get(k)!).push(b.type);
    }
  const insert = (b: MapDef["borders"][number]) => out.splice(Math.floor(rng.next() * (out.length + 1)), 0, b);
  for (const [k, kinds] of edgesOf) {
    const pool = [...fresh];
    for (const type of kinds) {
      const to = pool.splice(Math.floor(rng.next() * pool.length), 1)[0]!;
      insert(rng.next() < 0.5 ? { a: k, b: to, type } : { a: to, b: k, type });
    }
  }
  const kinds = ["normal", "river", "pass", "sea"] as const;
  const pairs = new Set<string>();
  const link = (a: string, b: string) => {
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (a === b || pairs.has(key)) return;
    pairs.add(key);
    insert({ a, b, type: pick(kinds) });
  };
  for (let i = 1; i < fresh.length; i++) link(fresh[i - 1]!, fresh[i]!);
  for (let i = 0; i < fresh.length; i++) link(pick(fresh), pick(fresh));
  const rename = new Map(unknown.map((t, i) => [t, fresh[i]!]));
  const scrambled: MapDef = {
    ...map,
    territories,
    provinces,
    borders: out,
    capitalSlots: map.capitalSlots.map((t) => rename.get(t) ?? t),
    capitalLayouts: undefined,
    geometry: undefined,
  };
  // The view: the same entries for known land, in the new map's order; the made-up land unknown, as before. A few
  // things in a view or a replay can name land at the cloud's edge without showing it (a rival army marching out of
  // the cloud into sight, a Fate closure on a border into the cloud: a person sees an arrow or a mark at the edge);
  // those names change with everything else, so a bot that looked behind them would plan differently here.
  const swap = <T,>(x: T): T => JSON.parse(JSON.stringify(x).replace(/"([^"]+)"/g, (m, id: string) => (rename.has(id) ? `"${rename.get(id)}"` : m))) as T;
  const terr: PlayerView["territories"] = {};
  for (const t of territories) terr[t.id] = fresh.includes(t.id) ? { detail: "fogged", unknown: true } : view.territories[t.id]!;
  const v2: PlayerView = { ...swap({ ...view, territories: {} }), territories: terr };
  return { ctx: { ...ctx, map: scrambled }, view: v2, lastTurn: snap.lastTurn && swap(snap.lastTurn) };
}

/** Everything every bot kind says and does from one seat's view. */
function everything(snap: Snap): unknown {
  const { ctx, view, lastTurn } = snap;
  const me = view.me.id;
  const plan = (b: Bot) => b.plan(ctx, view, lastTurn);
  const out: Record<string, unknown> = {};
  out.recruit = plan(recruitBot);
  out.captain = plan(captainBot);
  for (const p of PERSONALITY_IDS) out[`marshal-${p}`] = plan(makeMarshalBot(p));
  for (const k of ["hold", "defend", "push", "raid"] as const) out[`general-${k}`] = plan(makeGeneralSeat(k));
  out.delegate = plan(makeDelegateSeat());
  out.steward = plan(makeStewardSeat());
  out.leaderPath = plan(makeLeaderPathSeat("leader-path"));
  out.runsHouse = leadersRunHouse(ctx, view, freshMemory(), lastTurn).orders;
  // Your leaders under each kind of command (Expand aims at known land: the first rival or neutral land it sees).
  const target = Object.keys(view.territories).find((t) => {
    const v = view.territories[t]!;
    return v.detail === "full" && v.owner !== me;
  });
  const rival = view.players.find((p) => p.id !== me && p.eliminatedTurn === null)?.id;
  const province = target ? ctx.map.territories.find((t) => t.id === target)!.province : null;
  const commands: [string, Instruction][] = [
    ["military", { kind: "military" }],
    ["cleanup", { kind: "cleanup" }],
    ...(target ? ([["expand", { kind: "expand", territory: target }], ["push", { kind: "push", territory: target }]] as [string, Instruction][]) : []),
    ...(province ? ([["front", { kind: "front", provinces: [province] }]] as [string, Instruction][]) : []),
    ...(rival ? ([["raid", { kind: "raid", player: rival }], ["pushBack", { kind: "pushBack", player: rival }]] as [string, Instruction][]) : []),
  ];
  for (const [name, c] of commands)
    out[`leader-${name}`] = planLeaders({ ctx, view, ...(lastTurn ? { lastTurn } : {}), memory: freshMemory(), commands: { [leaderKey({ kind: "leader", of: me })]: c, [leaderKey({ kind: "steward", of: me })]: { kind: "realm" } } }).orders;
  // Deals: what each level offers, and its answer to a spread of offers from each rival.
  out.offersCaptain = proposeOffers(ctx, view, "captain", lastTurn);
  out.offersRecruit = proposeOffers(ctx, view, "recruit", lastTurn);
  const marshal = makeMarshalBot("schemer");
  out.offersMarshal = marshal.diplomat!.propose(ctx, view, lastTurn);
  const answers: unknown[] = [];
  for (const p of view.players.filter((x) => x.id !== me && x.eliminatedTurn === null)) {
    const third = view.players.find((x) => x.id !== me && x.id !== p.id && x.eliminatedTurn === null)?.id;
    const offers: Offer[] = [
      { id: "o1", from: p.id, to: me, bond: "handshake", terms: { kind: "truce", turns: 3, scope: { kind: "all" } } },
      { id: "o2", from: p.id, to: me, bond: "binding", terms: { kind: "trade", give: { gold: 20 }, get: { gold: 0 } } },
      { id: "o3", from: p.id, to: me, bond: "handshake", terms: { kind: "passage", turns: 3, mutual: true } },
      ...(third ? [{ id: "o4", from: p.id, to: me, bond: "handshake", terms: { kind: "war", turns: 3, target: third } } as Offer] : []),
    ];
    for (const o of offers) answers.push(judgeOffer(ctx, view, o, "captain", lastTurn), judgeOffer(ctx, view, o, "recruit", lastTurn), marshal.diplomat!.judge(ctx, view, o, lastTurn));
  }
  out.answers = answers;
  return out;
}

describe("bots never cheat under blackout (session 32)", () => {
  const cases: { name: string; map: () => MapDef; players: number; seeds: string[]; at: number[] }[] = [
    { name: "a random 40", map: () => randomMap("40-island-quiet-heron", defaultRules).map, players: 4, seeds: ["h1"], at: [1, 4, 8] },
    { name: "a random 80 crescent", map: () => randomMap("80-crescent-gilded-fjord", defaultRules).map, players: 5, seeds: ["h2"], at: [2, 6] },
    ...Object.entries(maps).map(([id, m]) => ({ name: id, map: () => m, players: Math.min(m.maxPlayers, Math.max(m.minPlayers, 4)), seeds: [`h-${id}`], at: [1, 5] })),
  ];
  for (const c of cases)
    it(`${c.name}: every bot gives the same orders, answers and lines when the land it hasn't seen is made up afresh`, () => {
      const map = c.map();
      let checked = 0;
      for (const seed of c.seeds)
        for (const snap of playAndKeep(map, seed, c.players, c.at)) {
          const dark = Object.values(snap.view.territories).filter((v) => v.detail === "fogged" && v.unknown).length;
          if (!dark) continue;
          const real = everything(snap);
          // The known map the bots read is the same either way (ids, terrain, provinces, borders, its cloud edges).
          const k1 = knownMap(snap.ctx.map, snap.view);
          const other = scramble(snap, `${seed}-${snap.view.me.id}-${snap.view.turn}`);
          const k2 = knownMap(other.ctx.map, other.view);
          expect({ t: k2.territories, p: k2.provinces, b: k2.borders }).toEqual({ t: k1.territories, p: k1.provinces, b: k1.borders });
          expect(JSON.stringify(everything(other))).toBe(JSON.stringify(real));
          checked++;
        }
      expect(checked).toBeGreaterThan(0);
    }, 120_000);

  it("a blackout seat's orders, offers and answers never name land it has never seen, or a province it hasn't seen any of", () => {
    let orders = 0;
    for (const [map, players, seed] of [[randomMap("80-island-quiet-heron", defaultRules).map, 5, "n1"], [maps.wyrmland!, 6, "n2"], [maps.embervale!, 4, "n3"]] as const)
      for (const snap of playAndKeep(map, seed, players, [1, 3, 6, 10])) {
        const dark = new Set(Object.entries(snap.view.territories).flatMap(([t, v]) => (v.detail === "fogged" && v.unknown ? [t] : [])));
        if (!dark.size) continue;
        const seenProvinces = new Set(map.territories.filter((t) => !dark.has(t.id)).map((t) => t.province));
        const all = everything(snap) as Record<string, unknown>;
        const walk = (x: unknown, path: string): void => {
          if (typeof x === "string") expect(dark.has(x), `${snap.view.me.id} turn ${snap.view.turn}: ${path} names ${x}, land it has never seen`).toBe(false);
          else if (Array.isArray(x)) x.forEach((y, i) => walk(y, `${path}[${i}]`));
          else if (x && typeof x === "object") {
            const o = x as Record<string, unknown>;
            if (o.kind === "spy" && typeof o.to === "string") expect(seenProvinces.has(o.to), `${path}: a spy sent to a province it has never seen`).toBe(true);
            for (const [k, y] of Object.entries(o)) walk(y, `${path}.${k}`);
          }
        };
        walk(all, "");
        orders += Object.values(all).filter(Array.isArray).reduce((a, xs) => a + (xs as unknown[]).length, 0);
      }
    expect(orders).toBeGreaterThan(500);
  }, 180_000);

  it("the scout's drive: under blackout the Marshals hire Scouts early and take land that opens into the cloud; never with standard fog", () => {
    const hires = (fog: true | "blackout") => {
      const ctx: GameContext = { map: maps.embervale!, rules: defaultRules };
      const ids = ["p1", "p2", "p3", "p4"];
      const deal = dealPersonalities("scout", ids);
      const bots = new Map(ids.map((p) => [p, makeMarshalBot(deal[p]!)]));
      let s = createGame(ctx, { gameId: "scout", seed: "scout", players: ids.map((id) => ({ id, name: id })), settings: { fog, luck: 0.3 }, startBonus: true });
      let scouts = 0;
      while (!s.winner && s.turn <= 5) {
        const orders: OrdersByPlayer = {};
        for (const p of s.players.filter((x) => x.eliminatedTurn === null)) orders[p.id] = bots.get(p.id)!.plan(ctx, viewFor(ctx, s, p.id));
        const r = resolveTurn(ctx, s, orders);
        scouts += r.events.filter((e) => e.type === "hired" && e.specialist === "scouts").length;
        s = r.state;
      }
      return scouts;
    };
    expect(hires("blackout")).toBeGreaterThan(0);
    expect(hires(true)).toBe(0);
  });

  it("the explore term: land opening into the cloud is worth weight x its cloud borders x the cloud's share; nothing with standard fog", () => {
    const ctx: GameContext = { map: maps.wyrmland!, rules: defaultRules };
    const game = (fog: true | "blackout") => createGame(ctx, { gameId: "x", seed: "x", players: ["p1", "p2", "p3", "p4", "p5", "p6"].map((id) => ({ id, name: id })), settings: { fog }, startBonus: true });
    const value = (fog: true | "blackout", weight: number) => {
      const keep = marshalData.explore.weight;
      marshalData.explore.weight = weight;
      try {
        const view = viewFor(ctx, game(fog), "p1");
        const b = readBoard(ctx, view, { chainMargin: 1.25 })!;
        const values = new Map(b.idx.ids.map((t) => [t, b.valueOf(t)]));
        return { b, at: (t: string) => values.get(t)! };
      } finally {
        marshalData.explore.weight = keep;
      }
    };
    const dark = value("blackout", 0), lit = value("blackout", 2);
    const edge = dark.b.idx.ids.filter((t) => !dark.b.owned(t) && cloudBorders(dark.b.ctx.map, t) > 0);
    expect(edge.length).toBeGreaterThan(0);
    expect(dark.b.cloudShare).toBeGreaterThan(0.5);
    for (const t of edge) expect(lit.at(t) - dark.at(t)).toBeCloseTo(2 * cloudBorders(dark.b.ctx.map, t) * dark.b.cloudShare, 9);
    const std0 = value(true, 0), std2 = value(true, 2);
    expect(std0.b.cloudShare).toBe(0);
    for (const t of std0.b.idx.ids) expect(std2.at(t)).toBe(std0.at(t));
  });

  it("with standard fog nothing is unknown, so the known map is the map itself (the very same object)", () => {
    for (const m of Object.values(maps)) {
      const ctx: GameContext = { map: m, rules: defaultRules };
      const s = createGame(ctx, { gameId: "std", seed: "std", players: [{ id: "p1", name: "P1" }, { id: "p2", name: "P2" }], settings: { fog: true } });
      expect(knownMap(m, viewFor(ctx, s, "p1"))).toBe(m);
    }
  });

  it("the Fallen see the political map, so nothing is unknown to them even under blackout (their events land on known land)", () => {
    const ctx: GameContext = { map: maps.embervale!, rules: defaultRules };
    const s = createGame(ctx, { gameId: "f", seed: "f", players: ["p1", "p2", "p3"].map((id) => ({ id, name: id })), settings: { fog: "blackout" } });
    s.players[2]!.eliminatedTurn = 0;
    s.players[2]!.eliminatedBy = "p1";
    const v = viewFor(ctx, s, "p3");
    expect(Object.values(v.territories).some((t) => t.detail === "fogged" && t.unknown)).toBe(false);
    expect(knownMap(ctx.map, v)).toBe(ctx.map);
    expect(() => planFallen(ctx, v)).not.toThrow();
  });
});
