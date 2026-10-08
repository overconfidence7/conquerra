import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { makeCaptainBot, makeMarshalBot, type Bot } from "@conquerra/bots";
import type { GameContext } from "@conquerra/engine";
import { describe, expect, it } from "vitest";
import { playTable, type SeatStats } from "../src";

/** Embervale with its 4-player capitals as before session 19 moved them (the signatures below replay fixed games). */
const ember: GameContext = { map: { ...maps.embervale!, capitalLayouts: maps.embervale!.capitalLayouts!.map((l) => (l.players === 4 ? { players: 4, slots: ["t02", "t05", "t19", "t37"] } : l)) }, rules: defaultRules };

/**
 * Each personality's signature shows up in play (session 17). Four personalities at a table, rotated through the seats
 * over 24 fixed games (the games are deterministic, so this can't fail by luck). (Session 20c: 8 games left the
 * Conqueror's fronts a turn at the Blitzer's edge once every Marshal pauses and marches far; over 100 games the gap
 * is as before: 1.21 against 1.27.)
 */
describe("the Marshal's personalities play differently", () => {
  const kinds = ["turtle", "blitzer", "merchant", "conqueror"] as const;
  const seats: Record<string, SeatStats[]> = {};
  for (let g = 0; g < 24; g++) {
    const order = kinds.map((_, i) => kinds[(i + g) % kinds.length]!);
    const r = playTable(ember, `sig-${g}`, order.map((k) => makeMarshalBot(k)), { maxTurns: 16 });
    r.seats.forEach((s, i) => (seats[order[i]!] ??= []).push(s));
  }
  const avg = (k: string, f: (s: SeatStats) => number) => seats[k]!.reduce((a, s) => a + f(s), 0) / seats[k]!.length;

  it("the Turtle builds more forts and culture by turn 10", () => {
    const turtle = avg("turtle", (s) => s.forts10 + s.culture10);
    for (const k of ["blitzer", "conqueror"]) expect(turtle).toBeGreaterThan(avg(k, (s) => s.forts10 + s.culture10) + 1);
  });

  // (Session 19: every Marshal keeps a guard at its capital in the first turns on a crowded map, so what each holds by
  // turn 8 evens out; the Blitzer's style shows in how much it takes, and loses.)
  it("the Blitzer takes more land by turn 8, and loses more of it", () => {
    for (const k of ["turtle", "merchant", "conqueror"]) {
      expect(avg("blitzer", (s) => s.took8)).toBeGreaterThan(avg(k, (s) => s.took8));
      expect(avg("blitzer", (s) => s.lost8)).toBeGreaterThan(avg(k, (s) => s.lost8));
    }
  });

  it("the Merchant builds markets early, and the Blitzer none", () => {
    // (Session 19: its markets go up after its armies move, so now and then a rival takes the plot first.)
    expect(avg("merchant", (s) => s.markets10)).toBeGreaterThan(1.5);
    expect(avg("merchant", (s) => s.firstMarket ?? 60)).toBeLessThan(3);
    expect(avg("blitzer", (s) => s.markets10)).toBe(0);
  });

  it("the Conqueror fights fewer rivals at once than the Blitzer", () => {
    expect(avg("conqueror", (s) => s.frontsPerTurn)).toBeLessThan(avg("blitzer", (s) => s.frontsPerTurn));
  });
}, 60000);

describe("the Schemer", () => {
  it("spends more on spies by turn 10 than a Captain does (on average)", () => {
    let schemerSpies = 0, captainSpies = 0;
    for (let g = 0; g < 4; g++) {
      const bots: Bot[] = [makeMarshalBot("schemer"), makeCaptainBot(), makeMarshalBot("opportunist"), makeCaptainBot()];
      const r = playTable(ember, `sch-${g}`, bots, { maxTurns: 14 });
      schemerSpies += r.seats[0]!.gold10.spies;
      captainSpies += r.seats[1]!.gold10.spies + r.seats[3]!.gold10.spies;
    }
    expect(schemerSpies).toBeGreaterThan(captainSpies / 2);
  });
}, 60000);
