import { readSave } from "@conquerra/engine";
import { describe, expect, it } from "vitest";
import { RANDOM_TEXT } from "@conquerra/mapgen";
import { HostCore } from "../src/host/hostCore";
import { loadGameMap } from "../src/host/gameMaps";
import type { LobbySettings } from "../src/host/protocol";
import { memorySaveStore } from "../src/host/saves";
import { listingOf, mapNameOf, randomLine } from "../src/logic/mapListing";

/**
 * Session 30, Part 2: random maps in single player. The game stores the map's id and the map maker's version; Continue
 * (or a file) rebuilds the map from them, and a save from another version says so plainly.
 */

const ID = "random:40-island-quiet-heron";
const settings: LobbySettings = { mapId: ID, bots: 3, botLevel: "captain", luck: 0.3, fog: true, mode: "classic", turnSeconds: null };

describe("random maps in single player (session 30)", () => {
  it("the lobby reads a random map from its id alone: its size, its players, its line", () => {
    const l = listingOf(ID)!;
    expect(l).toMatchObject({ name: "Random map", territories: 40, minPlayers: 2, maxPlayers: 6, random: { size: 40, shape: "island", seed: "quiet-heron" } });
    expect(randomLine(l.random!)).toBe("40 territories, one island, seed quiet-heron");
    expect(mapNameOf(ID)).toBe("Random, 40 territories (quiet-heron)");
    expect(mapNameOf("embervale")).toBe("Embervale");
    expect(listingOf("random:40-dragon-quiet-heron")).toBeNull();
  });

  it("a game on a random map saves its id and version, and Continue rebuilds the same map", async () => {
    const store = memorySaveStore();
    const core = new HostCore(store, loadGameMap);
    const start = await core.start(settings, "random-save");
    expect(start.map.id).toBe(ID);
    expect(start.map.territories).toHaveLength(40);
    await core.flush();
    const auto = readSave(await store.get("auto"));
    expect(auto.ok && auto.save.mapId).toBe(ID);
    expect(auto.ok && auto.save.mapVersion).toBe(start.map.generator!.version);
    // The save holds no geometry: only the id.
    expect(JSON.stringify(await store.get("auto"))).not.toContain("borderLines");
    const again = new HostCore(store, loadGameMap);
    const back = await again.load({ slot: "auto" });
    expect(back.view).toEqual(start.view);
    expect(JSON.stringify(back.map)).toBe(JSON.stringify(start.map));
  }, 60_000);

  it("a save made by another map maker version says so, in plain words", async () => {
    const store = memorySaveStore();
    const core = new HostCore(store, loadGameMap);
    await core.start(settings, "random-old");
    const file = JSON.parse(JSON.stringify(core.exportSave()));
    file.mapVersion = 1;
    await expect(new HostCore(memorySaveStore(), loadGameMap).load({ file: JSON.stringify(file) })).rejects.toThrow(RANDOM_TEXT.oldVersion(1));
  }, 60_000);
});
