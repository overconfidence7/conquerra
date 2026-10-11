import { fill, lines } from "@conquerra/content/lines";
import { maps } from "@conquerra/content/maps";
import { viewFor, type GameState, type Order, type PlayerView, type ReplayEvent } from "@conquerra/engine";
import { describe, expect, it } from "vitest";
import { problems } from "../../../packages/content/test/voiceScan";
import { scenario } from "../../../packages/bots/test/scenario";
import { HUMAN_ID, LocalGame } from "../src/host/localGame";
import { leaderVoices } from "../src/logic/voices";

/**
 * Your leaders' voices (session 22): who speaks, what they say, and never more than they should. The judge (Nate's
 * running bit) only ever comments on your own orders, with the turn's real numbers.
 */

// a b c d e f g h i j (in a line, and a-c too): you hold a, b and h to j; p2 holds c and d.
function board(opts: { land?: string[]; leaderStyle?: "conqueror" | null } = {}) {
  const mine = opts.land ?? ["a", "b", "h", "i", "j"];
  const sc = scenario({
    line: "abcdefghij",
    extra: [["a", "c"]],
    layout: { ...Object.fromEntries(mine.map((t) => [t, ["p1", t === "a" ? 13 : 8] as [string, number]])), c: ["p2", 14], d: ["p2", 4] },
    caps: ["a", "d"],
    players: 2,
    gold: 10,
  });
  const me = sc.s.players[0]!;
  me.leaders = me.leaders.map((l) => (l.kind === "leader" ? { ...l, name: "Aldric", personality: opts.leaderStyle === undefined ? "conqueror" : opts.leaderStyle } : l));
  return sc;
}
const army = (troops: number) => ({ troops, specialists: [] });
const attack = (from: string, to: string, n: number, m: number, extra: Partial<Extract<ReplayEvent, { type: "battle" }>> = {}): ReplayEvent => ({
  type: "battle",
  step: 1,
  player: "p1",
  orderId: "o1",
  from,
  to,
  defender: "p2",
  attackers: army(n),
  withLeader: false,
  defenders: army(m),
  result: { attackStrength: n, defenseStrength: m, expectedDefenderLosses: 3, expectedAttackerLosses: 6, defenderLosses: 3, attackerLosses: 6 },
  captured: false,
  specialistsLost: [],
  defense: { fort: false, culture: 0, leader: false },
  ...extra,
});

describe("your Leader judges your moves", () => {
  it("a failed attack of yours at poor odds: the real numbers, and the army that really was next to it", () => {
    const { ctx, s } = board();
    const v = viewFor(ctx, s, "p1");
    const said = leaderVoices(ctx, v, v, [attack("b", "c", 6, 14)]).lines;
    const judged = said.find((l) => l.situation === "judgeAttack")!;
    expect(judged.leader).toBe("leader:p1");
    expect(lines.leaders.conqueror!.judgeAttack!.map((x) => fill(x, { n: 6, place: "C", m: 14, k: 12, other: "A" }))).toContain(judged.text);
  });

  it("never on an order one of your leaders wrote", () => {
    const { ctx, s } = board();
    const v = viewFor(ctx, s, "p1");
    const said = leaderVoices(ctx, v, v, [attack("b", "c", 6, 14, { general: "p1" })]).lines;
    expect(said.some((l) => l.situation.startsWith("judge"))).toBe(false);
    expect(said.map((l) => l.situation)).toContain("pushedBack");
  });

  it("not every turn, not the same mistake twice in a row, and not while you're down to your last few territories", () => {
    const { ctx, s } = board();
    const v = viewFor(ctx, s, "p1");
    const first = leaderVoices(ctx, v, v, [attack("b", "c", 6, 14)]);
    expect(first.memory.judged).toEqual({ turn: v.turn, kind: "attack" });
    // Two turns on: still quiet.
    const soon = { ...v, turn: v.turn + 2 };
    expect(leaderVoices(ctx, soon, soon, [attack("b", "c", 6, 14)], first.memory).lines.some((l) => l.situation.startsWith("judge"))).toBe(false);
    // Four turns on, but the same kind of mistake as last time: still quiet.
    const later = { ...v, turn: v.turn + 4 };
    expect(leaderVoices(ctx, later, later, [attack("b", "c", 6, 14)], first.memory).lines.some((l) => l.situation.startsWith("judge"))).toBe(false);
    // Down to three territories: no roasting.
    const few = board({ land: ["a", "b", "j"] });
    const fv = viewFor(few.ctx, few.s, "p1");
    expect(leaderVoices(few.ctx, fv, fv, [attack("b", "c", 6, 14)]).lines.some((l) => l.situation.startsWith("judge"))).toBe(false);
  });

  it("a risky attack of yours that worked earns a grudging compliment", () => {
    const { ctx, s } = board();
    const v = viewFor(ctx, s, "p1");
    const said = leaderVoices(ctx, v, v, [attack("b", "c", 6, 14, { captured: true })]).lines;
    expect(said.map((l) => l.situation)).toContain("compliment");
  });
});

describe("what your leaders say, and how much", () => {
  it("one line per leader, at most three a report, the big moments first", () => {
    const { ctx, s } = board();
    const me = s.players[0]!;
    me.leaders.push(
      { kind: "leader", of: "p3", name: "Brannoc", personality: "schemer", command: { kind: "military" }, budget: { share: 0 }, purse: 0 },
      { kind: "leader", of: "p4", name: "Vesna", personality: null, command: { kind: "military" }, budget: { share: 0 }, purse: 0 },
    );
    const v = viewFor(ctx, s, "p1");
    const ev: ReplayEvent[] = [attack("b", "c", 6, 14), attack("b", "c", 20, 3, { general: "p3", captured: true }), attack("a", "c", 9, 3, { general: "p4", captured: true })];
    const said = leaderVoices(ctx, v, v, ev).lines;
    expect(said.length).toBeLessThanOrEqual(lines.limits.perReport);
    expect(new Set(said.map((l) => l.leader)).size).toBe(said.length);
    expect(said[0]!.situation).toBe("judgeAttack");
  });

  it("a captured leader's first report, in its loyal (suspiciously loyal) voice", () => {
    const { ctx, s } = board();
    s.players[0]!.leaders.push({ kind: "leader", of: "p2", name: "Brannoc", personality: "schemer", command: null, budget: { share: 0 }, purse: 0 });
    const v = viewFor(ctx, s, "p1");
    const said = leaderVoices(ctx, v, v, [{ type: "generalCaptured", step: 2, player: "p1", general: "p2", territory: "c" }]);
    const first = said.lines.find((l) => l.situation === "firstReport")!;
    expect(first.leader).toBe("leader:p2");
    expect(first.text).toContain("Brannoc");
    // Its old House by name, or (Nate's pick) the turn it joined: "I've always admired your House. Since turn 3."
    expect(first.text).toMatch(new RegExp(`House [A-Z]|Since turn ${v.turn}\.`));
    expect(said.memory.captured).toEqual({ "leader:p2": v.turn });
  });

  it("a Neutral leader is dry and brief", () => {
    const { ctx, s } = board({ leaderStyle: null });
    const v = viewFor(ctx, s, "p1");
    const took = leaderVoices(ctx, v, v, [attack("b", "c", 20, 3, { general: "p1", captured: true })]).lines[0]!;
    expect(lines.leaders.neutral!.took!.map((x) => fill(x, { places: "C", rival: "P2's lot" }))).toContain(took.text);
  });

  it("the same turn always says the same thing", () => {
    const { ctx, s } = board();
    const v = viewFor(ctx, s, "p1");
    const ev = [attack("b", "c", 6, 14)];
    expect(leaderVoices(ctx, v, v, ev)).toEqual(leaderVoices(ctx, v, v, ev));
  });

  it("a grudge with receipts: it starts when a rival burns a fort of yours, comes up later, and is settled when you take the place back", () => {
    const { ctx, s } = board();
    const v = viewFor(ctx, s, "p1");
    const burned = { ...attack("c", "b", 14, 8, { captured: true, defense: { fort: true, culture: 0, leader: false } }), player: "p2", defender: "p1" } as ReplayEvent;
    const start = leaderVoices(ctx, v, v, [burned]).memory;
    expect(start.grudge).toMatchObject({ rival: "p2", place: "b", turn: v.turn, kind: "fort", state: "open" });
    const later = { ...v, turn: v.turn + 4 };
    const told = leaderVoices(ctx, later, later, [attack("a", "c", 5, 9)], { ...start, judged: { turn: later.turn, kind: "x" } });
    const line = told.lines.find((l) => l.situation === "grudgeFort")!;
    expect(line.text).toContain("B");
    expect(line.text).toContain(String(v.turn));
    const back = { ...v, turn: v.turn + 6 };
    const settled = leaderVoices(ctx, back, back, [attack("a", "b", 9, 2, { captured: true })], told.memory);
    expect(settled.lines.map((l) => l.situation)).toContain("grudgeRevenge");
    expect(settled.memory.grudge!.state).toBe("settled");
  });
});

describe("in a real game under fog", () => {
  it("every line keeps the voice guide's rules, is filled in, and never names land you couldn't see", () => {
    let t = Date.UTC(2026, 9, 10, 12);
    const g = new LocalGame(maps.embervale!, { mapId: "embervale", bots: 3, botLevel: "marshal", luck: 0.3, fog: true, mode: "classic", turnSeconds: null, leaderName: "Aldric", leaderPersonality: "conqueror", stewardPersonality: "turtle" }, "voices-fog", () => t);
    let u = g.update();
    const said: string[] = [];
    for (let i = 0; i < 24 && !u.view.winner && u.view.players.find((p) => p.id === HUMAN_ID)!.eliminatedTurn === null; i++) {
      const before: PlayerView = u.view;
      const setup: Order[] = i === 0 ? [{ id: "cmd", kind: "instruct", general: HUMAN_ID, instruction: { kind: "military" } }, { id: "bl", kind: "budget", general: HUMAN_ID, budget: { share: 0.6 } }] : [];
      t += 1000;
      const own: Order[] = before.me.gold >= 2 ? [{ id: `r${i}`, kind: "recruit", territory: before.me.capital, count: "all" }] : [];
      u = g.lockIn([...setup, ...own, ...(u.generalOrders ?? [])]);
      const seen = new Set<string>();
      for (const view of [before, u.view])
        for (const [id, x] of Object.entries(view.territories)) if (x.detail === "full" || x.lastSeen) seen.add(g.ctx.map.territories.find((m) => m.id === id)!.name);
      for (const e of (u.report?.events ?? []) as unknown as Record<string, unknown>[]) for (const k of ["to", "from", "territory", "at", "target"]) if (typeof e[k] === "string") seen.add(g.ctx.map.territories.find((m) => m.id === e[k])?.name ?? "");
      for (const v of u.report?.voices ?? []) {
        said.push(v.text);
        expect(v.text, v.text).not.toMatch(/[{}]|undefined|NaN/);
        expect(problems({ file: "voices", text: v.text, speaker: true }), v.text).toEqual([]);
        for (const m of g.ctx.map.territories) if (new RegExp(`\\b${m.name}\\b`).test(v.text)) expect(seen.has(m.name), `${m.name} in "${v.text}"`).toBe(true);
      }
      expect((u.report?.voices ?? []).length).toBeLessThanOrEqual(lines.limits.perReport);
    }
    expect(said.length).toBeGreaterThan(3);
    // The state the host keeps for them goes into the save.
    expect((g.snapshot().host as { voiceMemory?: unknown }).voiceMemory).toBeTruthy();
    void (g as unknown as { state: GameState }).state;
  });
});
