import { describe, expect, it } from "vitest";
import { RANDOM_TEXT } from "@conquerra/mapgen";
import type { RoomStart } from "../src/host/protocol";
import { hostSeat, KIT, memoryRoomStore, NATE, settings, testRoom } from "./roomHelpers";

/**
 * Session 30, Part 3: a table on a random map. The room makes the map from its id when the table is made (a seed with
 * no fair map says so then), keeps its slim copy in the room's own storage, and plays from that copy ever after, so a
 * deploy (even of a newer map maker) never changes a running game. Pages get the id and the version, never the map.
 */

const ID = "random:40-island-quiet-heron";

async function table(store = memoryRoomStore()) {
  const t = testRoom(store);
  await t.room.createTable({ gameId: "rand", code: "r4nd0mm4ps", settings: { ...settings, mapId: ID, bots: 3 }, seed: "random-online", host: hostSeat(NATE, 0) });
  await t.act(KIT, { do: "sit", house: 3, leadersRun: true });
  await t.act(NATE, { do: "start" });
  return t;
}

describe("a table on a random map (session 30)", () => {
  it("the room makes the map when the table is made and keeps only its slim copy; the start names it by id and version", async () => {
    const store = memoryRoomStore();
    const t = await table(store);
    const kept = JSON.parse(store.data.get("randomMap")!) as { id: string; map: { territories: unknown[]; geometry?: unknown; generator: { version: number } } };
    expect(kept.id).toBe(ID);
    expect(kept.map.territories).toHaveLength(40);
    expect(kept.map.geometry).toBeUndefined();
    const start = (await t.hello("p1")) as RoomStart;
    expect([start.mapId, start.mapVersion]).toEqual([ID, kept.map.generator.version]);
    expect(JSON.stringify(start)).not.toContain("borderLines");
  }, 60_000);

  it("a seed that makes no fair map says so when the table is made, before anyone sits", async () => {
    const t = testRoom();
    await expect(t.room.createTable({ gameId: "bad", code: "b4dr4nd0m1", settings: { ...settings, mapId: "random:40-archipelago-cold-kestrel", bots: 3 }, seed: "x", host: hostSeat(NATE, 0) })).rejects.toThrow(RANDOM_TEXT.failed);
  }, 60_000);

  it("a deploy mid-game: the room wakes on its kept copy (never rebuilding it), and the game goes on", async () => {
    const store = memoryRoomStore();
    const t = await table(store);
    for (const s of ["p1", "p2"]) await t.ask(s, { type: "lockIn", orders: [], turn: 1 });
    expect(t.room.table!.turn).toBe(2);
    await t.room.flush();
    // Mark the kept copy: if the woken room rebuilt the map instead of reading its copy, the mark would be gone.
    const kept = JSON.parse(store.data.get("randomMap")!) as { id: string; map: { name: string } };
    kept.map.name = "The kept copy";
    store.data.set("randomMap", JSON.stringify(kept));
    // A fresh room on the same storage (the Durable Object after a deploy).
    const woke = testRoom(store);
    const back = (await woke.hello("p1")) as RoomStart;
    expect(back.view.turn).toBe(2);
    expect(woke.room.table!.ctx.map.name).toBe("The kept copy");
    for (const s of ["p1", "p2"]) await woke.ask(s, { type: "lockIn", orders: [], turn: 2 });
    expect(woke.room.table!.turn).toBe(3);
  }, 60_000);

  it("with no kept copy, a game from another map maker version can't be rebuilt, and says so", async () => {
    const store = memoryRoomStore();
    const t = await table(store);
    await t.room.flush();
    store.data.delete("randomMap");
    // The game as saved by a map maker version this deploy doesn't have.
    store.data.set("game", store.data.get("game")!.replace(/"mapVersion":\d+/, '"mapVersion":1'));
    const woke = testRoom(store);
    const m = await woke.ask("p1", { type: "hello" });
    expect(m && !m.ok && m.error).toBe(RANDOM_TEXT.oldVersion(1));
  }, 60_000);
});
