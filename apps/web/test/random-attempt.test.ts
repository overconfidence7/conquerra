import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { mapFingerprint, randomMap } from "@conquerra/mapgen";
import { describe, expect, it } from "vitest";
import { cleanNewGame } from "../server/online";
import { roomMapsWith } from "../src/host/roomMaps";
import { memoryRoomStore } from "./roomHelpers";

/**
 * Session 33b: a big random map whose sixth try passes took the room 22.6 s to make (every try again, close to its
 * 30 s). The host's page knows which try passed (the lobby's picture), sends it when it makes a table, and the room
 * makes that one try, keeps it in its copy, and tells each page. The server keeps a sane try (2 to 6) and keeps a
 * table's bots at or above the map's smallest table (a random 400 starts at 6 players).
 */
const base = { bots: 9, botLevel: "marshal", luck: 0.3, fog: true, mode: "classic", turnSeconds: 300, leadersRun: true };

describe("the try that passed, told to the room (session 33b)", () => {
  it("the server keeps it from 2 to 6, on a random map only; and the bots fit the map's smallest table", () => {
    const made = (s: Record<string, unknown>) => cleanNewGame({ settings: { ...base, ...s }, leadersRun: true });
    const attemptOf = (s: Record<string, unknown>) => {
      const r = made(s);
      return "settings" in r ? r.settings.mapAttempt : "refused";
    };
    expect(attemptOf({ mapId: "random:40-island-quiet-heron", bots: 3, mapAttempt: 2 })).toBe(2);
    for (const bad of [1, 7, "x", -3, null]) expect(attemptOf({ mapId: "random:40-island-quiet-heron", bots: 3, mapAttempt: bad })).toBeUndefined();
    expect(attemptOf({ mapId: "embervale", bots: 3, mapAttempt: 3 })).toBeUndefined();
    expect(made({ mapId: "random:400-island-quiet-heron", bots: 3 })).toEqual({ error: "Random, 400 territories takes 5 to 15 bots." });
    expect(made({ mapId: "random:400-island-quiet-heron", bots: 5 })).toMatchObject({ settings: { bots: 5 } });
  });

  it("the room makes its copy from that try: the same map as making every try", async () => {
    const all = randomMap("40-island-quiet-heron", defaultRules);
    expect(all.attempt).toBe(2);
    const store = memoryRoomStore();
    const room = roomMapsWith(store, async (id) => maps[id]!);
    const kept = await room("random:40-island-quiet-heron", null, 2);
    const { geometry: _g, ...slim } = all.map;
    expect(kept).toEqual(slim);
    expect(kept.generator?.attempt).toBe(2);
    expect(mapFingerprint(all.map)).toBe(mapFingerprint(randomMap("40-island-quiet-heron", defaultRules, { attempt: 2 }).map));
  }, 60_000);
});
