import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { createGame, makeSave, readSave, replaySavedGame, resolveTurn, SAVE_PROBLEMS, STATE_VERSION, stateFingerprint, viewFor, type GameState } from "../src";

const ctx = { map: maps.embervale!, rules: defaultRules };
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
    // It plays on: a turn resolves from it, and everyone's view works.
    const next = resolveTurn(ctx, s, {});
    expect(next.state.turn).toBe(6);
    for (const p of s.players) expect(viewFor(ctx, next.state, p.id).turn).toBe(6);
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
