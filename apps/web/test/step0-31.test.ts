import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { RANDOM_TEXT, RANDOM_TRIES } from "@conquerra/mapgen/seed";
import { loadGameMap } from "../src/host/gameMaps";
import { CHAT_UI } from "../src/ui/chat/chatStore";

/**
 * Session 31, Step 0: random maps at version 3 in the app (a game's pinned version 2 still builds), the "Making the
 * map…" progress line, the remembered random map, "Update ready" once the newest build runs, who withdrew an offer,
 * the blackout label, and the art book out of the start-up bundle.
 */
const here = dirname(fileURLToPath(import.meta.url));
const src = (p: string) => readFileSync(join(here, "../src", p), "utf8");

describe("random maps at version 3 in the app (session 31)", () => {
  it("a new random map is version 3 with its start bonus; a game pinned at version 2 builds session 30's map; version 1 can't", async () => {
    const v3 = await loadGameMap("random:40-island-quiet-heron");
    expect(v3.generator?.version).toBe(3);
    const v2 = await loadGameMap("random:40-island-quiet-heron", 2);
    expect(v2.generator?.version).toBe(2);
    expect(v2).not.toBe(v3);
    await expect(loadGameMap("random:40-island-quiet-heron", 1)).rejects.toThrow(RANDOM_TEXT.oldVersion(1));
  }, 60_000);

  it("progress: a share of each try, and the line says which try once one was rejected", async () => {
    const seen: number[] = [];
    await loadGameMap("random:40-inland-jolly-lake", 3, (d) => seen.push(d));
    expect(seen.length).toBeGreaterThan(5);
    expect(seen.every((d, i) => i === 0 || d >= seen[i - 1]!)).toBe(true);
    const { progressLine } = await import("../src/ui/RandomMap");
    expect(progressLine(0.4)).toBe("40%");
    expect(progressLine(1.5)).toBe(`50%, try 2 of ${RANDOM_TRIES}`);
    expect(src("ui/RandomMap.tsx")).toContain('building: "Making the map…"');
  }, 60_000);
});

describe("the lobby remembers a random map (session 31)", () => {
  beforeAll(() => {
    const box = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => box.get(k) ?? null, setItem: (k: string, v: string) => void box.set(k, v) });
  });
  afterAll(() => vi.unstubAllGlobals());

  it("its size and shape, not its seed (a fresh one comes back); an official map by its id", async () => {
    const { useGame, rememberedRandom } = await import("../src/store");
    useGame.getState().setLobby({ mapId: "random:120-crescent-quiet-heron" });
    expect(localStorage.getItem("conquerra.lobbyMap")).toBe("random:120-crescent");
    expect(rememberedRandom()).toEqual({ size: 120, shape: "crescent" });
    const { freshRandomId } = await import("../src/ui/RandomMap");
    const again = freshRandomId(120, "crescent");
    expect(again).toMatch(/^random:120-crescent-[a-z]+-[a-z]+$/);
    useGame.getState().setLobby({ mapId: "wyrmland" });
    expect(localStorage.getItem("conquerra.lobbyMap")).toBe("wyrmland");
    expect(rememberedRandom()).toBeNull();
    // The lobby picks the remembered random map up once a page load.
    expect(src("ui/Lobby.tsx")).toContain("rememberedRandom()");
  });
});

describe("small fixes (session 31)", () => {
  it("'Update ready' hides once the server says the running build is the newest", async () => {
    const { useUpdates } = await import("../src/ui/UpdatePrompt");
    const apply = async () => {};
    useUpdates.getState().set({ apply });
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ build: typeof __BUILD__ === "string" ? __BUILD__ : "dev" }), { status: 200, headers: { "content-type": "application/json" } }));
    const { checkFreshness } = await import("../src/ui/updateCheck");
    await checkFreshness();
    expect(useUpdates.getState().apply).toBeNull();
    vi.unstubAllGlobals();
  });

  it("a withdrawn offer's note says who withdrew it", () => {
    expect(CHAT_UI.withdrawnBy("Kit", false)).toBe("(withdrawn by Kit)");
    expect(CHAT_UI.withdrawnBy("Nate", true)).toBe("(you withdrew it)");
    expect(src("ui/chat/ChatPanel.tsx")).toContain("CHAT_UI.withdrawnBy(");
  });

  it("the Rules fold's blackout line says the bots still know the lay of the land; Tactical paints cloud over rivers", () => {
    expect(src("ui/LobbyFolds.tsx")).toContain("Blackout: the map is hidden until you explore it (the bots still know the lay of the land).");
    expect(src("render/pixi/info.ts")).toMatch(/no river runs through cloud/);
  });

  it("the art book (painted placeholders) loads after the lobby's first paint, not with it", () => {
    const art = src("ui/art.ts");
    expect(art).not.toMatch(/^import \{ ArtBook \}/m);
    expect(art).toContain('import("../art/book")');
    expect(readFileSync(join(here, "../scripts/bundle-size.mjs"), "utf8")).toMatch(/ALLOWANCE_KB = \d+\.\d/);
  });
});
