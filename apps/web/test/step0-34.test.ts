import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Session 34, Step 0 (Nate's call, Oct 19): the lobby keeps the last random map. Opening the lobby again shows the same
 * seed and its picture and builds nothing; a new seed comes from Reroll, or once a game was started on the kept map;
 * a typed seed stays typed.
 */
const here = dirname(fileURLToPath(import.meta.url));
const src = (p: string) => readFileSync(join(here, "../src", p), "utf8");
const thumb = { cols: 2, rows: 1, data: "g2" };

describe("the lobby keeps the last random map (session 34)", () => {
  const box = new Map<string, string>();
  beforeAll(() => vi.stubGlobal("localStorage", { getItem: (k: string) => box.get(k) ?? null, setItem: (k: string, v: string) => void box.set(k, v) }));
  afterAll(() => vi.unstubAllGlobals());

  it("reopened: the same seed, its picture and its try, so nothing is built", async () => {
    const m = await import("../src/ui/RandomMap");
    const id = m.freshRandomId(400, "island");
    m.keepRandom(id, { thumb, attempt: 3 });
    const back = m.keptOrFresh(400, "island");
    expect(back).toEqual({ mapId: id, preview: { thumb, attempt: 3 } });
    // The panel builds only when the store has no picture for the lobby's map; the lobby hands it the kept one first.
    expect(src("ui/RandomMap.tsx")).toContain("if (useGame.getState().randomPreview?.mapId === mapId) return;");
    expect(src("ui/Lobby.tsx")).toMatch(/keptOrFresh\([\s\S]*?if \(preview\) useGame\.setState\(\{ randomPreview: \{ mapId, preview, problem: null \} \}\);\s*setLobby\(\{ mapId \}\)/);
    // Another size or shape: a fresh seed.
    expect(m.keptOrFresh(300, "island").mapId).not.toBe(id);
  }, 60_000);

  it("a game started on it (alone or a table made): a fresh seed next visit; the game builds one try", async () => {
    const m = await import("../src/ui/RandomMap");
    const { useGame } = await import("../src/store");
    const { randomStarted, randomAttempt } = m;
    const id = m.freshRandomId(200, "crescent");
    m.keepRandom(id, { thumb, attempt: 2 });
    useGame.setState({ randomPreview: { mapId: id, preview: { thumb, attempt: 2 }, problem: null } });
    useGame.getState().setLobby({ mapId: id });
    expect(randomAttempt()).toEqual({ mapAttempt: 2 });
    randomStarted(id);
    expect(m.playedRandom(id)).toBe(true);
    const next = m.keptOrFresh(200, "crescent");
    expect(next.mapId).not.toBe(id);
    expect(next.preview).toBeNull();
    expect(src("store.ts")).toMatch(/m\.randomStarted\(lobby\.mapId\);\s*\}\s*await enterGame/);
    expect(src("host/onlineActions.ts")).toContain("m.randomStarted(lobby.mapId);");
    expect(src("host/hostCore.ts")).toContain("this.loadMap(settings.mapId, null, settings.mapAttempt)");
  }, 60_000);

  it("a typed seed stays typed, game or no game", async () => {
    const m = await import("../src/ui/RandomMap");
    const { randomStarted } = m;
    const id = "random:120-inland-amber-ford";
    m.keepRandom(id, { thumb, attempt: 1 });
    randomStarted(id);
    expect(m.playedRandom(id)).toBe(false);
    expect(m.keptOrFresh(120, "inland")).toEqual({ mapId: id, preview: { thumb, attempt: 1 } });
  }, 60_000);
});
