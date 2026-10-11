import { describe, expect, it } from "vitest";
import { defaultRules, type MapDef } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { createGame, dealSeats, makeSave, readSave, replaySavedGame, resolveTurn, stateFingerprint, type GameContext, type NewGameOptions } from "../src";

/**
 * The seat rule (session 25, Nate's call): a harder capital spot (one with a start bonus) goes to a bot before a person.
 * Embervale at 4 with two of its spots marked harder, so the rule has something to do.
 */
const base = maps.embervale!;
const layout = base.capitalLayouts!.find((l) => l.players === 4)!;
const [s0, s1, s2, s3] = layout.slots as [string, string, string, string];
const withBonus = (bonus: Record<string, number>): GameContext => ({ map: { ...base, capitalLayouts: base.capitalLayouts!.map((l) => (l.players === 4 ? { ...l, bonus } : l)) } as MapDef, rules: defaultRules });
const two = withBonus({ [s1]: 4, [s3]: 6 });
const weak = new Set([s1, s3]);

const seats = (bots: boolean[]) => bots.map((bot, i) => ({ id: `p${i + 1}`, name: `P${i + 1}`, ...(bot ? { bot: true } : {}) }));
const start = (c: GameContext, players: NewGameOptions["players"], seed: string, seatRule?: NewGameOptions["seatRule"]) =>
  createGame(c, { gameId: "g", seed, players, startBonus: true, ...(seatRule ? { seatRule } : {}) });
const capitalOf = (s: ReturnType<typeof createGame>, id: string) => s.players.find((p) => p.id === id)!.capital;
const SEEDS = Array.from({ length: 40 }, (_, i) => `seat-${i}`);

describe("the seat rule: harder spots go to bots first (session 25)", () => {
  it("dealSeats: a person on a harder spot swaps with the first bot on an ordinary one; the rest keep the shuffle's order", () => {
    const caps = [s0, s1, s2, s3];
    type Seat = { id: string; bot?: boolean };
    const P: Seat = { id: "you" }, A: Seat = { id: "a", bot: true }, B: Seat = { id: "b", bot: true }, C: Seat = { id: "c", bot: true };
    // You were dealt s1 (harder): you swap with A (the first bot on an ordinary spot, s0).
    expect(dealSeats([A, P, B, C], caps, weak).map((p) => p.id)).toEqual(["you", "a", "b", "c"]);
    // Already on an ordinary spot: nothing moves.
    expect(dealSeats([P, A, B, C], caps, weak).map((p) => p.id)).toEqual(["you", "a", "b", "c"]);
    // Two people, both on harder spots: each swaps with a bot on an ordinary spot.
    const Q: Seat = { id: "two" };
    expect(dealSeats([A, P, B, Q], caps, weak).map((p) => p.id)).toEqual(["you", "a", "two", "b"]);
  });

  it("a person never starts at a harder spot while a bot holds an ordinary one", () => {
    for (const seed of SEEDS)
      for (const who of [0, 1, 2, 3]) {
        const s = start(two, seats([0, 1, 2, 3].map((i) => i !== who)), seed, "botsFirst");
        expect(weak.has(capitalOf(s, `p${who + 1}`))).toBe(false);
      }
    // Over 40 seeds the person still gets every ordinary spot (the shuffle still decides which).
    const spots = new Set(SEEDS.map((seed) => capitalOf(start(two, seats([false, true, true, true]), seed, "botsFirst"), "p1")));
    expect([...spots].sort()).toEqual([s0, s2].sort());
  });

  it("a table of bots only is dealt exactly as before (the same seed, the same capitals, the same game)", () => {
    for (const seed of SEEDS) {
      const before = start(two, seats([true, true, true, true]), seed);
      const after = start(two, seats([true, true, true, true]), seed, "botsFirst");
      expect(stateFingerprint(after)).toBe(stateFingerprint(before));
    }
    // And with no bot flags at all (an older setup), "botsFirst" or not, nothing changes either.
    for (const seed of SEEDS.slice(0, 10)) expect(stateFingerprint(start(two, seats([false, false, false, false]), seed, "botsFirst"))).toBe(stateFingerprint(start(two, seats([false, false, false, false]), seed)));
  });

  it("more harder spots than bots: the people left over get them, with their head start, as before", () => {
    const three = withBonus({ [s0]: 2, [s1]: 4, [s3]: 6 });
    for (const seed of SEEDS) {
      // One bot, three people, three harder spots: the bot takes one, two people get the other two.
      const s = start(three, seats([true, false, false, false]), seed, "botsFirst");
      expect(weak.has(capitalOf(s, "p1")) || capitalOf(s, "p1") === s0).toBe(true);
      const people = ["p2", "p3", "p4"].map((id) => s.players.find((p) => p.id === id)!);
      expect(people.filter((p) => p.capital === s2)).toHaveLength(1);
      for (const p of people.filter((x) => x.capital !== s2)) expect(p.startBonus).toBeGreaterThan(0);
    }
  });

  it("a layout with no harder spots, or a table with no pinned layout (no weak marking there): dealt exactly as before", () => {
    const none = withBonus({});
    const unpinned: GameContext = { map: { ...base, capitalLayouts: base.capitalLayouts!.filter((l) => l.players !== 4) } as MapDef, rules: defaultRules };
    for (const c of [none, unpinned])
      for (const seed of SEEDS.slice(0, 10)) {
        const players = seats([false, true, true, true]);
        expect(stateFingerprint(start(c, players, seed, "botsFirst"))).toBe(stateFingerprint(start(c, players, seed)));
      }
  });

  it("the game's own dice are the same either way (only who sits where changes)", () => {
    const players = seats([true, false, true, true]);
    for (const seed of SEEDS) {
      const a = start(two, players, seed), b = start(two, players, seed, "botsFirst");
      expect(b.rng).toEqual(a.rng);
      expect(b.decks).toEqual(a.decks);
      expect(new Set(b.players.map((p) => p.capital))).toEqual(new Set(a.players.map((p) => p.capital)));
    }
  });

  it("the setup carries the choice, so a save's history replays as it was played", () => {
    const setup: NewGameOptions = { gameId: "g", seed: "replay", players: seats([false, true, true, true]), startBonus: true, seatRule: "botsFirst" };
    let s = createGame(two, setup);
    const turns = [{}, {}, {}];
    for (const t of turns) s = resolveTurn(two, s, t).state;
    const save = makeSave(two, s, "p1", 0);
    const file = { ...save, history: { setup, rules: defaultRules, turns } };
    const back = readSave(JSON.parse(JSON.stringify(file)));
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.save.history?.setup.seatRule).toBe("botsFirst");
    expect(replaySavedGame(two, back.save.history!, stateFingerprint(s)).matches).toBe(true);
    // Replayed without the rule, the person may sit elsewhere: the choice is what makes it replay exactly.
    expect(capitalOf(createGame(two, back.save.history!.setup), "p1")).toBe(capitalOf(s, "p1"));
  });
});
