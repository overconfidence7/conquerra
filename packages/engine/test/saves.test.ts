import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { createGame, makeSave, readSave, replaySavedGame, resolveTurn, SAVE_PROBLEMS, STATE_VERSION, stateFingerprint, viewFor, type GameState } from "../src";

const ctx = { map: maps.embervale!, rules: defaultRules };
/** A migrated state with `like`'s leaders (an old save's are named from the game's id, as the seed isn't kept). */
export const sameLeaders = (st: GameState, like: GameState): GameState => ({ ...st, players: st.players.map((p, i) => ({ ...p, leaders: like.players[i]!.leaders })) });
const fixture = () => JSON.parse(readFileSync(new URL("./fixtures/save-v2-session13.json", import.meta.url), "utf8")) as unknown;

describe("saved games: the snapshot format", () => {
  it("a save is the game as it stands, and reads back exactly", () => {
    const s = createGame(ctx, { gameId: "g", seed: "saves", players: [{ id: "a", name: "Ann" }, { id: "b", name: "Bo" }] });
    const save = makeSave(ctx, s, "a", 1_700_000_000_000);
    expect(save).toMatchObject({ format: "conquerra-save", version: 2, mapId: "embervale", you: "a", summary: { mapName: "Embervale", players: ["Ann", "Bo"], you: "Ann", turn: 1, fallen: false } });
    const read = readSave(JSON.parse(JSON.stringify(save)));
    expect(read.ok).toBe(true);
    if (read.ok) expect(stateFingerprint(read.save.state)).toBe(stateFingerprint(s));
  });

  it("the save made at the start of session 13 still loads, comes up to date, and plays on", () => {
    const read = readSave(fixture());
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const s = read.save.state as GameState;
    expect(s.version).toBe(STATE_VERSION);
    expect(read.save.summary).toMatchObject({ mapName: "Embervale", turn: 5 });
    // Saved before diplomacy (session 14): it carries on with no deals and nobody marked.
    expect([s.deals, s.record, s.settings.diplomacy]).toEqual([[], [], true]);
    expect(s.players.every((p) => p.oathbreaker === 0)).toBe(true);
    // It plays on: a turn resolves from it, and everyone's view works.
    const next = resolveTurn(ctx, s, {});
    expect(next.state.turn).toBe(6);
    for (const p of s.players) expect(viewFor(ctx, next.state, p.id).turn).toBe(6);
  });

  it("the save made at the end of session 14 (state version 5, with deals in its record) loads, comes up to date, and plays on", () => {
    const raw = JSON.parse(readFileSync(new URL("./fixtures/save-v2-session14.json", import.meta.url), "utf8")) as { state: { version: number } };
    expect(raw.state.version).toBe(5);
    const read = readSave(raw);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const s = read.save.state as GameState;
    expect(s.version).toBe(STATE_VERSION);
    expect(read.save.summary).toMatchObject({ mapName: "Embervale", turn: 9 });
    // Its diplomacy carries on; saved before spies (session 15), it has none, and can hire them from now on.
    expect(s.record.length).toBeGreaterThan(0);
    expect([s.spies, s.nextSpy, s.spyIntel, s.settings.spies]).toEqual([[], 1, {}, true]);
    const next = resolveTurn(ctx, s, { [s.players[0]!.id]: [{ id: "y", kind: "hireSpy", territory: s.players[0]!.capital }] });
    expect(next.state.turn).toBe(10);
    expect(next.state.spies.length).toBe(next.events.some((e) => e.type === "spyHired") ? 1 : 0);
    for (const p of s.players) expect(viewFor(ctx, next.state, p.id).turn).toBe(10);
  });

  it("a save carries its history for pnpm sim --replay (which only matches while the engine plays those turns the same way)", () => {
    const read = readSave(fixture());
    if (!read.ok || !read.save.history) throw new Error("fixture has no history");
    expect(read.save.history.turns).toHaveLength(4);
    expect(read.save.history.setup.seed).toBe("fixture-session-13");
  });

  it("a fresh game's history plays back to exactly its snapshot", () => {
    const setup = { gameId: "g", seed: "replay-me", players: [{ id: "a", name: "Ann" }, { id: "b", name: "Bo" }, { id: "c", name: "Cy" }] };
    let s = createGame(ctx, setup);
    const turns = [];
    for (let i = 0; i < 3; i++) {
      turns.push({});
      s = resolveTurn(ctx, s, {}).state;
    }
    const save = makeSave(ctx, s, "a", 0, { history: { setup, rules: defaultRules, turns } });
    expect(replaySavedGame(ctx, save.history!, stateFingerprint(save.state)).matches).toBe(true);
    expect(replaySavedGame(ctx, { ...save.history!, turns: turns.slice(0, 2) }, stateFingerprint(save.state)).matches).toBe(false);
  });

  it("an old 'Save this game' file, a newer save, junk and a damaged save each say why, in plain words", () => {
    const v1 = { format: "conquerra-save", version: 1, mapId: "embervale", mapVersion: 2, rules: defaultRules, setup: {}, turns: [], fingerprint: "x" };
    expect(readSave(v1)).toEqual({ ok: false, why: SAVE_PROBLEMS.older });
    expect(readSave({ ...(fixture() as object), version: 3 })).toEqual({ ok: false, why: SAVE_PROBLEMS.newer });
    const future = fixture() as { state: { version: number } };
    future.state.version = STATE_VERSION + 1;
    expect(readSave(future)).toEqual({ ok: false, why: SAVE_PROBLEMS.newer });
    expect(readSave({ hello: "world" })).toEqual({ ok: false, why: SAVE_PROBLEMS.notASave });
    expect(readSave(null)).toEqual({ ok: false, why: SAVE_PROBLEMS.notASave });
    expect(readSave("conquerra")).toEqual({ ok: false, why: SAVE_PROBLEMS.notASave });
    const broken = fixture() as { state: Record<string, unknown> };
    delete broken.state.territories;
    expect(readSave(broken)).toEqual({ ok: false, why: SAVE_PROBLEMS.damaged });
  });

  it("a state older than any migration we have says it's from an older version", () => {
    const old = fixture() as { state: { version: number } };
    old.state.version = 1;
    expect(readSave(old)).toEqual({ ok: false, why: SAVE_PROBLEMS.older });
  });
});

describe("Houses chosen in the lobby (session 16)", () => {
  const two = (a?: number, b?: number) => [
    { id: "a", name: "Ann", ...(a !== undefined ? { house: a } : {}) },
    { id: "b", name: "Bo", ...(b !== undefined ? { house: b } : {}) },
  ];
  it("each player gets the House they chose; the rest take the first ones free, in order", () => {
    expect(createGame(ctx, { gameId: "g", seed: "h", players: two() }).players.map((p) => p.house)).toEqual([0, 1]);
    expect(createGame(ctx, { gameId: "g", seed: "h", players: two(1) }).players.map((p) => p.house)).toEqual([1, 0]);
    expect(createGame(ctx, { gameId: "g", seed: "h", players: two(undefined, 0) }).players.map((p) => p.house)).toEqual([1, 0]);
    expect(() => createGame(ctx, { gameId: "g", seed: "h", players: two(3, 3) })).toThrow(/different House/);
  });
  it("is public in every view, and never changes how the game plays", () => {
    const red = createGame(ctx, { gameId: "g", seed: "h", players: two(1, 4) });
    const plain = createGame(ctx, { gameId: "g", seed: "h", players: two() });
    expect(viewFor(ctx, red, "a").players.map((p) => p.house)).toEqual([1, 4]);
    const strip = (s: GameState) => ({ ...s, players: s.players.map((p) => ({ ...p, house: 0 })) });
    expect(stateFingerprint(strip(resolveTurn(ctx, red, {}).state))).toBe(stateFingerprint(strip(resolveTurn(ctx, plain, {}).state)));
  });
  it("a game saved before it keeps the colours it had: one per seat, in order (state version 7 -> 8)", () => {
    const s = createGame(ctx, { gameId: "g", seed: "h", players: two() });
    const old = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    old.version = 7;
    for (const p of old.players as Record<string, unknown>[]) (delete p.house, delete p.leaders, (p.command = null), (p.purse = []));
    const read = readSave(JSON.parse(JSON.stringify({ ...makeSave(ctx, s, "a", 0), state: old })));
    expect(read.ok).toBe(true);
    // (Session 18's leaders are named from the game's id when an old save comes up to date: the seed isn't kept.)
    if (read.ok) expect(stateFingerprint(sameLeaders(read.save.state, s))).toBe(stateFingerprint(s));
  });
});
