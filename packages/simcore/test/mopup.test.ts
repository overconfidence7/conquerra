import { readdirSync, readFileSync } from "node:fs";
import { defaultRules, type PersonalityId } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { makeDelegateSeat, makeMarshalBot, planLeaders, type Bot } from "@conquerra/bots";
import { distancesFrom, indexMap, leaderKey, viewFor, type GameContext, type GameState, type Instruction, type PlayerId } from "@conquerra/engine";
import { describe, expect, it } from "vitest";
import { playTable } from "../src";

/**
 * Session 20 (Nate's play test): leaders that finish the job. The mop-up fixtures are 20 positions from real Marshal
 * games (Embervale 4, Wyrmland 6, Rootholm 9) at the moment one seat passed 85% of the map with two or three rivals
 * left (made by apps/sim/scripts/s20-mopup.ts). Before session 20 a Leader on Run the military took a median of 7 turns
 * to finish them (two never did in 15), a Marshal 6; session 20 made it 3; session 20c's mass and sweep (with the
 * security blanket) makes it 2, with 9 in 10 within 3 turns and none past 5.
 */
interface Fixture {
  name: string;
  map: string;
  kinds: string[];
  top: PlayerId;
  rivals: { id: PlayerId; land: number }[];
  state: GameState;
}
const dir = new URL("../../bots/test/fixtures/mopup/", import.meta.url);
const fixtures: Fixture[] = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => JSON.parse(readFileSync(new URL(f, dir), "utf8")) as Fixture);
/** No turn cap while finishing (Rootholm's positions come late in 60-turn games). */
const ctxOf = (f: Fixture): GameContext => ({ map: maps[f.map]!, rules: { ...defaultRules, game: { ...defaultRules.game, maxTurnsHard: 500 } } });
const marshal = (k: string): Bot => makeMarshalBot(k.replace(/^marshal-/, "") as PersonalityId);

/** The leading seat delegates: its Leader on Run the military (80%), its Steward on Run the realm (20%), purses as if it always had. */
function delegating(f: Fixture): GameState {
  const s = structuredClone(f.state);
  const p = s.players.find((x) => x.id === f.top)!;
  for (const l of p.leaders) {
    if (l.of !== p.id) continue;
    if (l.kind === "leader") (l.command = { kind: "military" }), (l.budget = { share: 0.8 }), (l.purse = Math.floor(p.gold * 0.8));
    else (l.command = { kind: "realm" }), (l.budget = { share: 0.2 }), (l.purse = Math.floor(p.gold * 0.2));
  }
  p.gold -= p.leaders.filter((l) => l.of === p.id).reduce((a, l) => a + l.purse, 0);
  return s;
}

/** Turns until every rival is out (99: not within 15). `kept`: territories a rival took from the leading seat and still held as that turn ended. */
function finish(f: Fixture, seat: (seat: number) => Bot, start: GameState, out?: { kept: number }): number {
  const top = Number(f.top.slice(1)) - 1;
  let taken: string[] = [];
  const settle = (s: GameState) => {
    if (out) out.kept += taken.filter((t) => s.territories[t]!.owner !== f.top).length;
    taken = [];
  };
  const r = playTable(ctxOf(f), `${f.name}-test`, f.kinds.map((k, i) => (i === top ? seat(i) : marshal(k))), {
    start,
    maxTurns: start.turn + 14,
    onTurn: settle,
    onEvents: (_s, ev) => {
      for (const e of ev) if (e.type === "battle" && e.captured && e.defender === f.top && e.player !== f.top) taken.push(e.to);
    },
  });
  settle(r.final!);
  return r.final!.winner === f.top ? r.final!.turn - start.turn + 1 : 99;
}
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

describe("finishing a rival off: the mop-up fixtures", () => {
  it("there are 20, on Embervale, Wyrmland and Rootholm, each 85-95% held with two or three rivals left", () => {
    expect(fixtures.length).toBe(20);
    expect(new Set(fixtures.map((f) => f.map))).toEqual(new Set(["embervale", "wyrmland", "rootholm"]));
    for (const f of fixtures) expect(f.rivals.length === 2 || f.rivals.length === 3).toBe(true);
  });

  it("a Leader on Run the military finishes them (session 20c): a median of 2 turns, 9 in 10 within 3, none past 5", () => {
    const kept = { kept: 0 };
    const turns = fixtures.map((f) => finish(f, () => makeDelegateSeat(0.8), delegating(f), kept));
    expect(median(turns)).toBeLessThanOrEqual(2);
    expect(turns.filter((t) => t <= 3).length).toBeGreaterThanOrEqual(18);
    expect(turns.every((t) => t <= 5)).toBe(true);
    // The security blanket: they keep little of what they take (session 20 left them about 6 territories a position).
    expect(kept.kept).toBeLessThanOrEqual(20);
  });

  it("so does a Marshal in the seat (they share the planner)", () => {
    const turns = fixtures.map((f) => finish(f, (i) => marshal(f.kinds[i]!), structuredClone(f.state)));
    expect(median(turns)).toBeLessThanOrEqual(2);
    expect(turns.filter((t) => t <= 3).length).toBeGreaterThanOrEqual(17);
    expect(turns.every((t) => t <= 5)).toBe(true);
  });

  it("and with every military leader on Clean up", () => {
    const turns = fixtures.map((f) => finish(f, () => makeDelegateSeat(0.8, { cleanUp: true }), delegating(f)));
    expect(median(turns)).toBeLessThanOrEqual(2);
    expect(turns.filter((t) => t <= 3).length).toBeGreaterThanOrEqual(17);
    expect(turns.every((t) => t <= 5)).toBe(true);
  });
}, 300000);

describe("the leaders' plans on the mop-up fixtures", () => {
  /** The leading seat's view, with these commands for its leaders (by key) and its own Leader's purse. */
  const plan = (f: Fixture, commands: Record<string, Instruction>, purse = 40) => {
    const s = structuredClone(f.state);
    const p = s.players.find((x) => x.id === f.top)!;
    p.leaders.find((l) => l.kind === "leader" && l.of === p.id)!.purse = purse;
    const view = viewFor(ctxOf(f), s, f.top);
    return { view, plan: planLeaders({ ctx: ctxOf(f), view, commands }) };
  };
  const own = (f: Fixture) => leaderKey({ kind: "leader", of: f.top });

  it("never hoards: a military leader spends its whole purse (to within one troop) unless it names what it's saving for", () => {
    for (const f of fixtures)
      for (const purse of [9, 40, 151]) {
        const { plan: p } = plan(f, { [own(f)]: { kind: "military" } }, purse);
        const spent = p.orders.filter((o) => o.general === f.top).reduce((a, o) => a + (o.kind === "recruit" && typeof o.count === "number" ? o.count * defaultRules.troops.cost : o.kind === "hire" ? defaultRules.specialists[o.specialist].cost : o.kind === "build" ? defaultRules.buildings[o.building].cost : 0), 0);
        if (p.notes[own(f)]?.kind !== "saving") expect(purse - spent, `${f.name} with ${purse}`).toBeLessThan(defaultRules.troops.cost);
      }
  });

  it("finishing, it says so: 'Finishing them off' with the rivals and the land it knows they hold", () => {
    const { plan: p } = plan(fixtures[0]!, { [own(fixtures[0]!)]: { kind: "military" } });
    expect(p.notes[own(fixtures[0]!)]).toMatchObject({ kind: "finishing" });
  });

  it("Push back never touches a third party: it attacks only that rival's land (and the empty land next to it)", () => {
    for (const f of fixtures) {
      const target = f.rivals[0]!.id;
      const { view, plan: p } = plan(f, { [own(f)]: { kind: "pushBack", player: target } });
      const owner = (t: string) => {
        const v = view.territories[t]!;
        return v.detail === "full" ? v.owner : (v.lastSeen?.owner ?? null);
      };
      for (const o of p.orders) if (o.kind === "move") expect([f.top, target, null], `${f.name}: ${o.from} > ${o.to}`).toContain(owner(o.to));
      const note = p.notes[own(f)];
      expect(note).toMatchObject({ kind: "pushBack", rival: target });
    }
  });

  it("Clean up: the leaders on it share the rivals out between them", () => {
    let shared = 0;
    for (const f of fixtures) {
      const p0 = f.state.players.find((x) => x.id === f.top)!;
      const captured = p0.leaders.find((l) => l.kind === "leader" && l.of !== f.top && p0.captured.some((g) => g.of === l.of));
      if (!captured) continue;
      const { plan: p } = plan(f, { [own(f)]: { kind: "cleanup" }, [leaderKey(captured)]: { kind: "cleanup" } });
      const a = p.notes[own(f)], b = p.notes[leaderKey(captured)];
      if (a?.kind !== "finishing" || b?.kind !== "finishing") continue;
      const ra = a.rivals.map((r) => r.rival), rb = b.rivals.map((r) => r.rival);
      // Two or three rivals, two leaders: neither takes them all.
      expect(ra.length + rb.length).toBeGreaterThanOrEqual(2);
      expect(ra.some((r) => !rb.includes(r)) || rb.some((r) => !ra.includes(r))).toBe(true);
      shared++;
    }
    expect(shared).toBeGreaterThan(3);
  });

  // ---------- Session 20c: mass and sweep, with the security blanket ----------
  it("mass and sweep: its Leader goes with the main chain, which strikes their land; its marches only attack if still stronger", () => {
    let rides = 0;
    for (const f of fixtures) {
      const { view, plan: p } = plan(f, { [own(f)]: { kind: "military" } }, 60);
      const owner = (t: string) => {
        const v = view.territories[t]!;
        return v.detail === "full" ? v.owner : (v.lastSeen?.owner ?? null);
      };
      const moves = p.orders.filter((o): o is Extract<typeof o, { kind: "move" }> => o.kind === "move");
      expect(moves.some((o) => owner(o.to) !== f.top), f.name).toBe(true);
      if (moves.some((o) => o.withLeader && owner(o.to) !== f.top && owner(o.to) !== null)) rides++;
      // The marches and the blanket: transfers through our own land that take back what they took on the way, but
      // never throw themselves at a stronger army ("only if still stronger").
      expect(moves.filter((o) => owner(o.to) === f.top && o.preset?.id === "onlyIfStronger").length, f.name).toBeGreaterThan(3);
    }
    expect(rides).toBeGreaterThanOrEqual(12);
  });

  it("mass: spare troops far from the fight (more than 3 steps from any rival's land) march, nearly all of them", () => {
    let far = 0, stayed = 0;
    for (const f of fixtures) {
      const { view, plan: p } = plan(f, { [own(f)]: { kind: "military" } }, 60);
      const idx = indexMap(maps[f.map]!);
      const theirs = idx.ids.filter((t) => {
        const v = view.territories[t]!;
        const o = v.detail === "full" ? v.owner : (v.lastSeen?.owner ?? null);
        return o && o !== f.top;
      });
      const d = new Map<string, number>();
      for (const t of theirs) for (const [x, k] of distancesFrom(idx, t)) d.set(x, Math.min(d.get(x) ?? 99, k));
      const out = new Set(p.orders.flatMap((o) => (o.kind === "move" ? [o.from] : [])));
      for (const t of idx.ids) {
        const v = view.territories[t]!;
        if (v.detail !== "full" || v.owner !== f.top || t === view.me.capital || (d.get(t) ?? 99) <= 3) continue;
        far += v.troops - 1;
        if (!out.has(t)) stayed += v.troops - 1;
      }
    }
    expect(stayed).toBeLessThanOrEqual(far * 0.1);
  });

  it("no cheating: what it can't see (land in the fog, a remnant's hidden army) changes nothing it writes", () => {
    for (const f of fixtures.slice(0, 8)) {
      const base = plan(f, { [own(f)]: { kind: "military" } }, 60).plan.orders;
      const s = structuredClone(f.state);
      const view = viewFor(ctxOf(f), s, f.top);
      const rival = f.rivals[0]!.id;
      const hidden = Object.keys(view.territories).filter((t) => view.territories[t]!.detail !== "full");
      for (const t of hidden.slice(0, 5)) (s.territories[t]!.troops += 50), (s.territories[t]!.owner = rival);
      const p0 = s.players.find((x) => x.id === f.top)!;
      p0.leaders.find((l) => l.kind === "leader" && l.of === p0.id)!.purse = 60;
      const again = planLeaders({ ctx: ctxOf(f), view: viewFor(ctxOf(f), s, f.top), commands: { [own(f)]: { kind: "military" } } }).orders;
      expect(again, f.name).toEqual(base);
    }
  });

  it("deterministic: the same view gives the same orders, finishing too", () => {
    for (const f of fixtures.slice(0, 5)) expect(plan(f, { [own(f)]: { kind: "military" } }, 60).plan.orders).toEqual(plan(f, { [own(f)]: { kind: "military" } }, 60).plan.orders);
  });

  it("Report to: the junior writes nothing itself; its senior moves its army, the junior's portrait on that order", () => {
    let checked = 0;
    for (const f of fixtures) {
      const p0 = f.state.players.find((x) => x.id === f.top)!;
      const g = p0.captured.find((x) => (f.state.territories[x.territory]!.owner === f.top && f.state.territories[x.territory]!.troops > 3));
      if (!g) continue;
      const junior = leaderKey({ kind: "leader", of: g.of });
      const { plan: p } = plan(f, { [own(f)]: { kind: "military" }, [junior]: { kind: "report", to: f.top } });
      expect(p.orders.some((o) => o.general === g.of)).toBe(false);
      const out = p.orders.filter((o) => o.kind === "move" && o.from === g.territory);
      if (!out.length) continue;
      expect(out.every((o) => o.general === f.top)).toBe(true);
      expect(out.some((o) => o.kind === "move" && o.withGeneral === g.of)).toBe(true);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });
}, 300000);
