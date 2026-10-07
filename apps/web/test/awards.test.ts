import { emptyStats, type PlayerView } from "@conquerra/engine";
import { describe, expect, it } from "vitest";
import { awardsFor, powerSeries } from "../src/logic/awards";

const players = ["you", "a", "b"].map((id, i) => ({ id, name: id.toUpperCase(), eliminatedTurn: i === 2 ? 9 : null, eliminatedBy: null, spoils: 0, oathbreaker: 0, house: i }));
const view = (stats: Record<string, Partial<ReturnType<typeof emptyStats>>>, winner: string | "draw" | null = "you") =>
  ({
    players,
    winner,
    turn: 20,
    stats: Object.fromEntries(players.map((p) => [p.id, { ...emptyStats(), ...(stats[p.id] ?? {}) }])),
    history: [
      { turn: 0, land: { you: 1, a: 1, b: 1 } },
      { turn: 1, land: { you: 4, a: 2, b: 1 } },
    ],
  }) as unknown as PlayerView;

describe("the end of the game (session 16)", () => {
  it("each award goes to the House that did the most (ties shared); nobody earns one that nobody did", () => {
    const awards = awardsFor(view({ you: { battlesWon: 12, culture: 2 }, a: { battlesWon: 7, culture: 5, infiltrations: 3 }, b: { culture: 5 } }));
    const by = Object.fromEntries(awards.map((a) => [a.id, a]));
    expect(by.military).toMatchObject({ title: "Best Military", winners: ["you"], value: "12 battles won" });
    expect(by.culture).toMatchObject({ winners: ["a", "b"], value: "5 levels of culture" });
    expect(by.spymaster).toMatchObject({ winners: ["a"], value: "3 infiltrations" });
    expect(by.builder).toBeUndefined();
    expect(by.diplomat).toBeUndefined();
  });

  it("Survivor: of everyone but the winner, who held out longest (still standing at the end beats a knock-out)", () => {
    expect(awardsFor(view({})).find((a) => a.id === "survivor")).toMatchObject({ winners: ["a"], value: "still standing at the end" });
    expect(awardsFor(view({}, "draw")).find((a) => a.id === "survivor")).toBeUndefined();
  });

  it("the graph: each House's share of the map after every turn", () => {
    expect(powerSeries(view({}), 10)).toEqual([
      { player: "you", points: [{ turn: 0, share: 0.1 }, { turn: 1, share: 0.4 }] },
      { player: "a", points: [{ turn: 0, share: 0.1 }, { turn: 1, share: 0.2 }] },
      { player: "b", points: [{ turn: 0, share: 0.1 }, { turn: 1, share: 0.1 }] },
    ]);
  });
});
