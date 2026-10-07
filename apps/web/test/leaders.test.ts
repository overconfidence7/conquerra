import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { createGame, viewFor, type GameContext, type ReplayEvent } from "@conquerra/engine";
import { describe, expect, it } from "vitest";
import { chronicleOf } from "../src/logic/chronicleKeep";
import { narrateTurn } from "../src/logic/narrate";
import { budgetLabel, instructionName, namer } from "../src/logic/text";

const ctx: GameContext = { map: maps.embervale!, rules: defaultRules };
const t = (i: number) => ctx.map.territories[i]!.id;
const name = (i: number) => ctx.map.territories[i]!.name;
const army = (troops: number) => ({ troops, specialists: [] });

/** A person's game: your Leader is Aldric (expanding toward territory 5), your Steward Odo (running the realm). */
function game() {
  const s = createGame(ctx, { gameId: "g", seed: "leaders-page", players: [{ id: "you", name: "You", leaderName: "Aldric", stewardName: "Odo", delegate: true }, { id: "b1", name: "Lady Morwen" }, { id: "b2", name: "Baron Krell" }] });
  s.players[0]!.leaders[0]!.command = { kind: "expand", territory: t(5) };
  return viewFor(ctx, s, "you");
}

const win = (step: number, to: number, general = "you"): ReplayEvent => ({
  type: "battle", step, player: "you", orderId: `o${step}`, from: t(0), to: t(to), defender: null, attackers: army(6), withLeader: true, general,
  defenders: army(1), result: { attackStrength: 6, defenseStrength: 1, expectedDefenderLosses: 1, expectedAttackerLosses: 1, defenderLosses: 1, attackerLosses: 1 }, captured: true, specialistsLost: [], defense: { fort: false, culture: 0, leader: false },
});

describe("leaders in the report (session 18)", () => {
  it("a leader's chain of captures reads as one line, with its name and what it's doing", () => {
    const view = game();
    const lines = narrateTurn(ctx, [win(1, 1), win(2, 2), win(3, 3)], namer(ctx, view)).map((l) => l.text);
    expect(lines).toEqual([`Your Leader, Aldric, expanding toward ${name(5)}, took three territories: ${name(1)}, ${name(2)} and ${name(3)} (you lost 3, they lost 3).`]);
    // One capture alone reads as before, with the leader's name.
    expect(narrateTurn(ctx, [win(1, 1)], namer(ctx, view))[0]!.text).toMatch(/^Your Leader, Aldric, expanding toward .+, took /);
  });

  it("the Steward's purchases from its purse say who and what it cost", () => {
    const view = game();
    const ev: ReplayEvent[] = [
      { type: "built", step: 1, player: "you", orderId: "s1", territory: t(4), building: "market", cost: 6, doneAtEndOfTurn: 3, by: { kind: "steward", of: "you" } },
      { type: "built", step: 2, player: "you", orderId: "s2", territory: t(4), building: "fort", cost: 8, doneAtEndOfTurn: 4, by: { kind: "steward", of: "you" } },
      { type: "invested", step: 3, player: "you", orderId: "s3", territory: t(4), culture: 2, cost: 4, by: { kind: "steward", of: "you" } },
      { type: "income", step: 4, player: "you", income: 14, upkeep: 0, goldAfter: 12, deserted: 0, deserters: [] },
      { type: "purses", step: 5, player: "you", upkeep: [], paid: [{ kind: "steward", of: "you", gold: 2 }], goldAfter: 12, purses: [{ kind: "leader", of: "you", purse: 0 }, { kind: "steward", of: "you", purse: 2 }] },
    ];
    expect(narrateTurn(ctx, ev, namer(ctx, view)).map((l) => l.text)).toEqual([
      `Your Steward, Odo, running the realm, finished a market at ${name(4)} (6 gold).`,
      `Your Steward, Odo, running the realm, began a fort at ${name(4)} (8 gold).`,
      `Your Steward, Odo, running the realm, raised culture at ${name(4)} to 2 (4 gold).`,
      "Income +14, upkeep −0: you now have 12 gold.",
      "Into purses: 2 gold to your Steward.",
    ]);
    // The Chronicle keeps what your leaders bought, and not your own purchases.
    expect(chronicleOf({ turn: 3, events: [...ev, { type: "built", step: 6, player: "you", orderId: "x", territory: t(4), building: "market", cost: 6, doneAtEndOfTurn: 3 }] }).events.filter((e) => e.type === "built")).toHaveLength(2);
  });

  it("purses paying upkeep, gold taken back, and a captured Steward, in plain words", () => {
    const view = game();
    const n = namer(ctx, view);
    const lines = narrateTurn(
      ctx,
      [
        { type: "purseTaken", step: 1, player: "you", leader: { kind: "steward", of: "you" }, gold: 9 },
        { type: "stewardCaptured", step: 2, player: "you", steward: "b1" },
        { type: "income", step: 3, player: "you", income: 10, upkeep: 20, goldAfter: 0, deserted: 0, deserters: [], fromPurses: 6 },
      ],
      n,
    ).map((l) => l.text);
    expect(lines[0]).toBe("You took 9 gold back from Odo's purse (your Steward).");
    expect(lines[1]).toMatch(/^.+, Lady Morwen's Steward, joins you too\./);
    expect(lines[2]).toContain("Your leaders' purses paid 6 of it.");
  });

  it("every command and budget has plain words", () => {
    const n = namer(ctx, game());
    expect(instructionName({ kind: "expand", territory: t(5) }, n)).toBe(`Expand toward ${name(5)}`);
    expect(instructionName({ kind: "military" }, n)).toBe("Run the military");
    expect(instructionName({ kind: "realm" }, n)).toBe("Run the realm");
    expect(instructionName({ kind: "fortify" }, n)).toBe("Fortify the frontier");
    expect(instructionName({ kind: "front", provinces: [ctx.map.provinces[0]!.id] }, n)).toBe(`Command the front in ${ctx.map.provinces[0]!.name}`);
    expect([budgetLabel({ share: 0.2 }), budgetLabel({ gold: 8 }), budgetLabel({ share: 0 })]).toEqual(["20% of income", "8 gold a turn", "no budget"]);
  });
});
