import { describe, expect, it } from "vitest";
import { maps } from "@conquerra/content/maps";
import { defaultRules } from "@conquerra/content";
import { createGame, resolveTurn, viewFor, type GameContext, type GameState, type OrdersByPlayer } from "@conquerra/engine";
import { captainBot, recruitBot } from "../src";
import { scenario } from "./scenario";

describe("bots and the Spoils deck", () => {
  it("the Captain turns three Towers into a fort on the front it most needs to hold", () => {
    // p1: a b c d (capital a); p2 next to d with a big army.
    const sc = scenario({ line: "abcdef", layout: { a: ["p1", 8], b: ["p1", 3], c: ["p1", 3], d: ["p1", 5], e: ["p2", 14], f: ["p2", 6] }, caps: ["a", "f"] });
    sc.s.players[0]!.spoils = ["tower", "tower", "tower"];
    const orders = sc.plan();
    expect(orders[0]).toMatchObject({ kind: "spoils", set: "tower", territory: "d" });
  });

  it("three Laurels go where it means to hold (its capital); three Swords to troops; one of each when that's all", () => {
    const sc = scenario({ line: "abcdef", layout: { a: ["p1", 8], b: ["p1", 3], e: ["p2", 4], f: ["p2", 6] }, caps: ["a", "f"] });
    sc.s.players[0]!.spoils = ["laurel", "laurel", "laurel", "sword"];
    expect(sc.plan()[0]).toMatchObject({ kind: "spoils", set: "laurel", territory: "a" });
    sc.s.players[0]!.spoils = ["sword", "sword", "sword", "laurel"];
    expect(sc.plan()[0]).toMatchObject({ kind: "spoils", set: "sword" });
    sc.s.players[0]!.spoils = ["sword", "tower", "laurel"];
    expect(sc.plan()[0]).toMatchObject({ kind: "spoils", set: "mixed" });
    sc.s.players[0]!.spoils = ["sword", "tower"];
    expect(sc.plan().some((o) => o.kind === "spoils")).toBe(false);
  });

  it("with the deck off, no bot ever asks to turn a set in", () => {
    const sc = scenario({ line: "abcdef", layout: { a: ["p1", 8], e: ["p2", 4], f: ["p2", 6] }, caps: ["a", "f"] });
    sc.s.settings.spoils = false;
    sc.s.players[0]!.spoils = ["sword", "sword", "sword"];
    expect(sc.plan(captainBot).some((o) => o.kind === "spoils")).toBe(false);
    expect(sc.plan(recruitBot).some((o) => o.kind === "spoils")).toBe(false);
  });

  it("in whole games, bots turn their own sets in: the game rarely has to do it for them", () => {
    const ctx: GameContext = { map: maps.embervale!, rules: defaultRules };
    let own = 0, auto = 0, earned = 0;
    for (const seed of ["c1", "c2", "c3"]) {
      let s: GameState = createGame(ctx, { gameId: seed, seed, players: ["a", "b", "c", "d"].map((id) => ({ id, name: id })), settings: { fate: false } });
      for (let t = 0; t < 40 && !s.winner; t++) {
        const orders: OrdersByPlayer = {};
        for (const p of s.players) if (p.eliminatedTurn === null) orders[p.id] = (t % 2 ? recruitBot : captainBot).plan(ctx, viewFor(ctx, s, p.id));
        const r = resolveTurn(ctx, s, orders);
        for (const e of r.events) {
          if (e.type === "spoilsEarned") earned++;
          if (e.type === "spoilsTurnedIn") e.orderId === null ? auto++ : own++;
        }
        s = r.state;
      }
    }
    expect(earned).toBeGreaterThan(20);
    expect(own).toBeGreaterThan(5);
    expect(auto).toBe(0);
  });
});
