import { maps } from "@conquerra/content/maps";
import { lines } from "@conquerra/content/lines";
import { viewFor, type Order } from "@conquerra/engine";
import { describe, expect, it } from "vitest";
import { LocalGame } from "../src/host/localGame";
import type { CouncilAsk, LobbySettings, TurnReport } from "../src/host/protocol";
import { COUNCIL_UI, councilTurn } from "../src/logic/council";
import { councilItems } from "../src/ui/chat/councilStore";

/**
 * Session 29, Part 2: your council. A leader asks at most one question a turn (none in the first two), when a situation
 * calls for it; each answer is an existing command or budget; unanswered, it lapses at lock-in and the leader says so
 * next turn; a grudge is asked about once, then needled; nothing in it names what you couldn't know.
 */

const settings: LobbySettings = { mapId: "embervale", bots: 3, botLevel: "marshal", luck: 0.3, fog: true, mode: "classic", turnSeconds: null, leaderPersonality: "conqueror", stewardPersonality: "turtle" };

/** A single-player game with the council on, played by its own leaders (and a turn's answer, if `answer` says so). */
function play(seed: string, turns: number, answer?: (ask: CouncilAsk, g: LocalGame) => Order[] | null) {
  let now = 0;
  const g = new LocalGame(maps.embervale!, settings, seed, () => now, { council: true });
  const reports: TurnReport[] = [];
  let ask: CouncilAsk | null = null;
  for (let t = 1; t <= turns && !g.over && !g.isOut("you"); t++) {
    now += 1000;
    const extra = ask && answer ? (answer(ask, g) ?? []) : [];
    // (Turn 1: the Leader is told to run the military, with no budget: it has things to ask about.)
    const first: Order[] = t === 1 ? [{ id: "instruct-leader-you", kind: "instruct", general: "you", instruction: { kind: "military" } }] : [];
    const u = g.lockIn([...first, ...g.generalOrders(), ...g.suggest(), ...extra]);
    if (u.report) reports.push(u.report);
    ask = u.report?.ask ?? null;
  }
  return { g, reports };
}

const asks = (reports: TurnReport[]) => reports.flatMap((r) => (r.ask ? [{ turn: r.turn, ask: r.ask }] : []));

describe("your council (session 29)", () => {
  const seeds = ["council-a", "council-b", "council-c", "council-d"];
  const games = seeds.map((s) => play(s, 30));

  it("leaders ask now and then: at most one question a turn, none in the first two turns", () => {
    const all = games.flatMap((x) => asks(x.reports));
    expect(all.length).toBeGreaterThan(0);
    for (const { turn } of all) expect(turn).toBeGreaterThanOrEqual(2);
    // (One a turn by construction: a report carries one `ask` at most.) And not every turn.
    for (const x of games) {
      const turns = asks(x.reports).map((a) => a.turn);
      expect(turns.length).toBeLessThan(x.reports.length / 2);
      // At most one every few turns.
      for (let i = 1; i < turns.length; i++) expect(turns[i]! - turns[i - 1]!).toBeGreaterThanOrEqual(lines.limits.councilEvery);
    }
  });

  it("each choice is an existing command or budget, for the leader that asked", () => {
    for (const { ask } of games.flatMap((x) => asks(x.reports))) {
      expect(ask.choices.length).toBeGreaterThanOrEqual(2);
      expect(ask.id).toMatch(/^\d+:(leader|steward):you$/);
      const kinds = ask.choices.map((c) => (c.instruct ? c.instruct.kind : c.budget ? "budget" : "keep"));
      if (ask.situation === "grudge") {
        expect(kinds).toEqual(["pushBack", "raid", "hold"]);
        expect(ask.choices.map((c) => c.label)).toEqual([COUNCIL_UI.takeBack, COUNCIL_UI.raid, COUNCIL_UI.holdNow]);
        const rival = (ask.choices[0]!.instruct as { player: string }).player;
        expect((ask.choices[1]!.instruct as { player: string }).player).toBe(rival);
      }
      if (ask.situation === "capital") expect(kinds).toEqual(["defend", "keep"]);
      if (ask.situation === "steward") expect(kinds[0]).toBe("fortify");
      if (ask.situation === "purse") expect(kinds).toEqual(["budget", "budget", "keep"]);
      // No numbers in what the leader says.
      expect(ask.text).not.toMatch(/\d/);
    }
    // A question covers its leader's own warning that turn (no "Purse is empty." right before "Purse is empty. A share?").
    for (const r of games.flatMap((x) => x.reports))
      if (r.ask?.situation === "purse") expect((r.voices ?? []).some((v) => v.leader === r.ask!.leader && v.situation === "purseEmpty")).toBe(false);
  });

  it("unanswered, a question lapses: the leader says so next turn (and only then); answered, it doesn't", () => {
    for (const x of games)
      for (const { turn, ask } of asks(x.reports)) {
        const next = x.reports.find((r) => r.turn === turn + 1);
        if (!next) continue;
        // These games never answer (and the leaders' own orders never change that leader's command by an order).
        const lapse = (next.voices ?? []).find((v) => v.ask === ask.id);
        if (lapse) expect(lapse.situation).toBe("councilLapse");
      }
    // Answered: the order the choice sends goes in with the next turn's orders, and no lapse line follows.
    const answered = play("council-a", 30, (ask) => {
      const c = ask.choices.find((x) => x.instruct || x.budget)!;
      const [kind, of] = ask.leader.split(":") as ["leader" | "steward", string];
      const role = kind === "steward" ? { role: "steward" as const } : {};
      return [c.instruct !== undefined ? { id: `instruct-${kind}-${of}`, kind: "instruct", general: of, ...role, instruction: c.instruct } : { id: `budget-${kind}-${of}`, kind: "budget", general: of, ...role, budget: c.budget! }] as Order[];
    });
    const qs = asks(answered.reports);
    expect(qs.length).toBeGreaterThan(0);
    for (const { turn, ask } of qs) {
      const next = answered.reports.find((r) => r.turn === turn + 1);
      if (next) expect((next.voices ?? []).some((v) => v.ask === ask.id)).toBe(false);
    }
    const lapsed = games.flatMap((x) => x.reports.flatMap((r) => r.voices ?? [])).filter((v) => v.situation === "councilLapse");
    expect(lapsed.length).toBeGreaterThan(0);
  });

  it("none in the first two turns, even with something to ask (fairness: the fog-on-the-wire test checks every question's places)", () => {
    const g = games[0]!.g;
    const view = viewFor(g.ctx, g.fullState, "you");
    expect(councilTurn({ ctx: g.ctx, before: { ...view, turn: 1 }, after: view, events: [], memory: {}, orders: [], spoken: [] }).ask).toBeNull();
  });

  it("the council's chat: each turn's lines, your Leader first, and a question after them", () => {
    const x = games.find((y) => asks(y.reports).length)!;
    const items = councilItems(x.reports, "g", "you");
    expect(items.length).toBeGreaterThan(0);
    for (let i = 1; i < items.length; i++) expect(items[i]!.id).toBeGreaterThan(items[i - 1]!.id);
    for (const r of x.reports) {
      const mine = items.filter((it) => it.turn === r.turn && !it.ask);
      const firstSteward = mine.findIndex((it) => it.leader === "steward:you");
      const leaderAt = mine.findIndex((it) => it.leader === "leader:you");
      if (firstSteward >= 0 && leaderAt >= 0) expect(leaderAt).toBeLessThan(firstSteward);
    }
    const q = items.find((it) => it.ask)!;
    expect(q.text).toBe(q.ask!.text);
  });

  it("words only: the council changes nothing in the game (the same seed with it off plays the same)", () => {
    let now = 0;
    const off = new LocalGame(maps.embervale!, settings, "council-a", () => now, { council: false });
    let t = 1;
    for (; t <= 30 && !off.over && !off.isOut("you"); t++) {
      now += 1000;
      const first: Order[] = t === 1 ? [{ id: "instruct-leader-you", kind: "instruct", general: "you", instruction: { kind: "military" } }] : [];
      off.lockIn([...first, ...off.generalOrders(), ...off.suggest()]);
    }
    expect(off.fullState).toEqual(games[0]!.g.fullState);
  });
});
