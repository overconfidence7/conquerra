import { describe, expect, it } from "vitest";
import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { cleanStyle, createGame, findLeader, makeSave, readSave, resolveTurn, STATE_VERSION, stateFingerprint, viewFor, type GameState } from "../src";

/** Session 20c (Nate): leaders with personalities, for life. */
const ctx = { map: maps.embervale!, rules: defaultRules };
const game = () =>
  createGame(ctx, {
    gameId: "g",
    seed: "styles",
    players: [
      { id: "a", name: "Ann", delegate: true, leaderName: "Aldric", leaderPersonality: "conqueror", stewardPersonality: "turtle" },
      { id: "b", name: "Bo", leaderPersonality: "opportunist", stewardPersonality: "opportunist" },
      { id: "c", name: "Cy" },
    ],
  });

describe("leaders with personalities (session 20c)", () => {
  it("the lobby's choice reaches the game: your Leader and Steward carry it, and your view shows it", () => {
    const s = game();
    expect(findLeader(s.players[0]!, { kind: "leader", of: "a" })).toMatchObject({ name: "Aldric", personality: "conqueror" });
    expect(findLeader(s.players[0]!, { kind: "steward", of: "a" })!.personality).toBe("turtle");
    // A Marshal's leaders carry its own; left out, Neutral.
    expect(findLeader(s.players[1]!, { kind: "leader", of: "b" })!.personality).toBe("opportunist");
    expect(s.players[2]!.leaders.map((l) => l.personality)).toEqual([null, null]);
    expect(viewFor(ctx, s, "a").me.leaders.map((l) => l.personality)).toEqual(["conqueror", "turtle"]);
  });

  it("anything else is Neutral", () => {
    expect([cleanStyle("conqueror"), cleanStyle("merchant"), cleanStyle("delegate"), cleanStyle(""), cleanStyle(7), cleanStyle(undefined)]).toEqual(["conqueror", "merchant", null, null, null, null]);
  });

  it("for life: a captured leader keeps its personality, working for whoever knocked its House out", () => {
    const s = game();
    // Bo holds only one territory, next to a big army of Ann's.
    const bo = Object.keys(s.territories).find((t) => s.territories[t]!.owner === "b")!;
    for (const t of Object.keys(s.territories)) if (s.territories[t]!.owner === "b" && t !== bo) s.territories[t]!.owner = "a";
    const next = ctx.map.borders.find((x) => x.a === bo || x.b === bo)!;
    const from = next.a === bo ? next.b : next.a;
    s.territories[from] = { ...s.territories[from]!, owner: "a", troops: 80 };
    s.territories[bo]!.troops = 1;
    const r = resolveTurn(ctx, s, { a: [{ id: "x", kind: "move", from, to: bo, troops: 70 }] });
    const ann = r.state.players[0]!;
    expect(r.state.players[1]!.eliminatedTurn).not.toBeNull();
    expect(findLeader(ann, { kind: "leader", of: "b" })!.personality).toBe("opportunist");
    expect(findLeader(ann, { kind: "steward", of: "b" })!.personality).toBe("opportunist");
  });

  it("an older save comes up to date with every leader Neutral (state version 10 -> 11), and plays on", () => {
    const s = createGame(ctx, { gameId: "g", seed: "old", players: [{ id: "a", name: "Ann", delegate: true }, { id: "b", name: "Bo" }] });
    const old = JSON.parse(JSON.stringify(s)) as { version: number; players: { leaders: Record<string, unknown>[] }[] };
    old.version = 10;
    for (const p of old.players) for (const l of p.leaders) delete l.personality;
    const read = readSave(JSON.parse(JSON.stringify({ ...makeSave(ctx, s, "a", 0), state: old })));
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.migrated).toBe(true);
    const st = read.save.state as GameState;
    expect(st.version).toBe(STATE_VERSION);
    expect(st.players.flatMap((p) => p.leaders.map((l) => l.personality))).toEqual([null, null, null, null]);
    // Exactly today's game (the field in the same place a new game has it).
    expect(stateFingerprint(st)).toBe(stateFingerprint(s));
    expect(() => resolveTurn(ctx, st, {})).not.toThrow();
  });
});
