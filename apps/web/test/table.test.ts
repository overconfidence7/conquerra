import { describe, expect, it } from "vitest";
import { TABLE_TEXT } from "../src/host/roomCore";
import type { RoomMessage, RoomStart, TableView } from "../src/host/protocol";
import { hostSeat, KIT, memoryRoomStore, nate, NATE, ROOK, settings, testRoom, WREN } from "./roomHelpers";

/**
 * Friends at the table (session 27): an online game is made as a table waiting for its players. The host has the
 * link; friends open it, pick a free House colour and sit down; the host starts the game (empty seats become bots) and
 * everyone seated goes straight into turn 1. The room is the authority for all of it (the database has a copy).
 */

const tables = (msgs: RoomMessage[]) => msgs.flatMap((m) => ("table" in m ? [m.table] : []));
const starts = (msgs: RoomMessage[]) => msgs.flatMap((m) => ("start" in m ? [m.start] : []));
const lastTable = (msgs: RoomMessage[]): TableView => tables(msgs).at(-1)!;

async function newTable(size = 4) {
  const t = testRoom();
  const view = await t.room.createTable({ gameId: "tbl1", code: "k3f9q2m8w1", settings: { ...settings, bots: size - 1 }, seed: "table-seed", host: hostSeat(NATE, 0) });
  return { t, view };
}

describe("the table (session 27): made, joined, started", () => {
  it("a new table: the host in the first seat, the rest empty, no game yet", async () => {
    const { t, view } = await newTable();
    expect(view).toMatchObject({ gameId: "tbl1", code: "k3f9q2m8w1", status: "waiting", mapId: "embervale", turnSeconds: 300, you: { seat: 0, host: true } });
    expect(view.seats).toEqual([{ name: "Nate", house: 0, host: true, you: true }, null, null, null]);
    // No game yet: the room has its table, and the database copy says it's waiting for players.
    expect(t.room.table).toBeNull();
    expect(t.mirrors.at(-1)).toEqual({ gameId: "tbl1", status: "waiting", size: 4, seats: [{ seat: "p1", user: "u-nate", bot: null, colour: 0, name: "Nate", leadersRun: true }] });
    expect(t.alarm()).toBeNull();
  });

  it("friends sit down with a free colour; everyone at the table sees it live; two people never share a colour", async () => {
    const { t } = await newTable();
    await t.table(NATE);
    // Kit opens the link: the table, with Kit not seated.
    const seen = await t.table(KIT);
    expect(seen.you).toEqual({ seat: null, host: false });
    expect(seen.seats[0]).toEqual({ name: "Nate", house: 0, host: true, you: false });
    // Kit sits in Sable (3), with a name of their own choosing.
    const sat = t.tableOf(await t.act(KIT, { do: "sit", house: 3, leadersRun: true, name: "  Kit   the Bold ", leaderName: "Lady Sorrel" }));
    expect(sat.you.seat).toBe(1);
    expect(sat.seats[1]).toEqual({ name: "Kit the Bold", house: 3, host: false, you: true });
    // Nate's page heard about it.
    expect(lastTable(t.inbox("u-nate")).seats[1]).toEqual({ name: "Kit the Bold", house: 3, host: false, you: false });
    // Wren wants Kit's colour: no. Then the host's: no. Then a free one.
    expect(await t.act(WREN, { do: "sit", house: 3, leadersRun: true })).toMatchObject({ ok: false, error: TABLE_TEXT.colourTaken });
    expect(await t.act(WREN, { do: "sit", house: 0, leadersRun: true })).toMatchObject({ ok: false, error: TABLE_TEXT.colourTaken });
    expect(t.tableOf(await t.act(WREN, { do: "sit", house: 5, leadersRun: false })).you.seat).toBe(2);
    // Kit changes colour to a free one; not to Wren's.
    expect(await t.act(KIT, { do: "colour", house: 5 })).toMatchObject({ ok: false, error: TABLE_TEXT.colourTaken });
    expect(t.tableOf(await t.act(KIT, { do: "colour", house: 7 })).seats[1]!.house).toBe(7);
    // The database copy follows (the colour each person picked becomes their usual one).
    expect(t.mirrors.at(-1)!.seats.map((s) => [s.seat, s.user, s.colour])).toEqual([
      ["p1", "u-nate", 0],
      ["p2", "u-kit", 7],
      ["p3", "u-wren", 5],
    ]);
    const houses = t.mirrors.at(-1)!.seats.map((s) => s.colour);
    expect(new Set(houses).size).toBe(houses.length);
  });

  it("a friend can leave before the start; the host can take a seat away (and that person can't sit again); the host can't leave", async () => {
    const { t } = await newTable();
    await t.act(KIT, { do: "sit", house: 3, leadersRun: true });
    await t.act(ROOK, { do: "sit", house: 4, leadersRun: true });
    expect(t.tableOf(await t.act(KIT, { do: "leave" })).you.seat).toBeNull();
    expect(lastTable(t.inbox("u-rook")).seats.filter(Boolean).map((s) => s!.name)).toEqual(["Nate", "Rook"]);
    // Kit sits again (leaving isn't being removed).
    expect(t.tableOf(await t.act(KIT, { do: "sit", house: 3, leadersRun: true })).you.seat).toBe(2);
    // Only the host removes; Rook is taken off and can't come back.
    expect(await t.act(KIT, { do: "remove", seat: 1 })).toMatchObject({ ok: false, error: TABLE_TEXT.notHost });
    const after = t.tableOf(await t.act(NATE, { do: "remove", seat: 1 }));
    expect(after.seats.filter(Boolean).map((s) => s!.name)).toEqual(["Nate", "Kit"]);
    expect(lastTable(t.inbox("u-rook")).you).toEqual({ seat: null, host: false, removed: true });
    expect(await t.act(ROOK, { do: "sit", house: 4, leadersRun: true })).toMatchObject({ ok: false, error: TABLE_TEXT.removed });
    // The host can't remove themselves or leave (they cancel instead); nobody else can start or cancel.
    expect(t.tableOf(await t.act(NATE, { do: "remove", seat: 0 })).seats[0]!.name).toBe("Nate");
    expect(await t.act(NATE, { do: "leave" })).toMatchObject({ ok: false, error: TABLE_TEXT.hostLeaves });
    expect(await t.act(KIT, { do: "start" })).toMatchObject({ ok: false, error: TABLE_TEXT.notHost });
    expect(await t.act(KIT, { do: "cancel" })).toMatchObject({ ok: false, error: TABLE_TEXT.notHost });
    // A full table says so.
    const small = await newTable(2);
    await small.t.act(KIT, { do: "sit", house: 3, leadersRun: true });
    expect(await small.t.act(WREN, { do: "sit", house: 5, leadersRun: true })).toMatchObject({ ok: false, error: TABLE_TEXT.full });
  });

  it("Start: empty seats become bots, the capitals dealt with the seat rule, everyone seated goes straight into turn 1", async () => {
    const { t } = await newTable(5);
    await t.table(NATE);
    // Alone, the host can only start with bots.
    expect(await t.act(NATE, { do: "start" })).toMatchObject({ ok: false, error: TABLE_TEXT.noFriend });
    await t.act(KIT, { do: "sit", house: 3, leadersRun: true, leaderName: "Lady Sorrel" });
    // Rook opened the link and never sat down: his seat becomes a bot.
    await t.table(ROOK);
    t.clear();
    const started = t.tableOf(await t.act(NATE, { do: "start" }));
    expect(started.status).toBe("started");
    // Nate and Kit are in turn 1, each in their own seat, with their own names and colours.
    const [nateStart] = starts(t.inbox("u-nate"));
    const [kitStart] = starts(t.inbox("u-kit"));
    expect(nateStart!.playerId).toBe("p1");
    expect(kitStart!.playerId).toBe("p2");
    expect(kitStart!.view.turn).toBe(1);
    const players = kitStart!.view.players.map((p) => [p.id, p.name, p.house]);
    expect(players.slice(0, 2)).toEqual([
      ["p1", "Nate", 0],
      ["p2", "Kit", 3],
    ]);
    expect(players).toHaveLength(5);
    expect(kitStart!.people).toEqual(["p1", "p2"]);
    expect(kitStart!.view.me.leaders.find((l) => l.kind === "leader")!.name).toContain("Sorrel");
    // Every seat has its own colour; the bots took from the rest.
    expect(new Set(players.map((p) => p[2])).size).toBe(5);
    // The seat rule: harder spots go to bots first (the game's setup records it).
    expect(t.room.table!.snapshot().history!.setup.seatRule).toBe("botsFirst");
    // Rook gets "started", not a seat, and can't join now.
    expect(lastTable(t.inbox("u-rook"))).toMatchObject({ status: "started", you: { seat: null } });
    expect(await t.askAs(ROOK, { type: "hello" })).toMatchObject({ ok: false, error: TABLE_TEXT.started });
    expect(await t.act(ROOK, { do: "sit", house: 6, leadersRun: true })).toMatchObject({ ok: false, error: TABLE_TEXT.started });
    // The database copy: playing, the people and then the bots, the clock running.
    const m = t.mirrors.at(-1)!;
    expect(m.status).toBe("playing");
    expect(m.seats.map((s) => [s.seat, s.user ? "person" : s.bot])).toEqual([
      ["p1", "person"],
      ["p2", "person"],
      ["bot1", "marshal"],
      ["bot2", "marshal"],
      ["bot3", "marshal"],
    ]);
    expect(t.listed()).toMatchObject({ turn: 1, status: "playing", waitingOn: ["p1", "p2"] });
    expect(t.alarm()).toBe(t.now() + 300_000);
    // From here it's a game: Kit locks in through the same connection.
    const lock = await t.askAs(KIT, { type: "lockIn", orders: kitStart!.generalOrders, turn: 1 });
    expect(lock).toBeNull();
    expect(t.listed()!.waitingOn).toEqual(["p1"]);
  });

  it("start with bots: the host alone, for testing", async () => {
    const { t } = await newTable(3);
    const started = t.tableOf(await t.act(NATE, { do: "start", withBots: true }));
    expect(started.status).toBe("started");
    const [s] = starts(t.inbox("u-nate"));
    expect(s!.view.players).toHaveLength(3);
    expect(s!.people).toEqual(["p1"]);
  });

  it("cancel: everyone at the table is told, and nothing more can happen there", async () => {
    const { t } = await newTable();
    await t.act(KIT, { do: "sit", house: 3, leadersRun: true });
    await t.act(NATE, { do: "cancel" });
    expect(lastTable(t.inbox("u-kit")).status).toBe("cancelled");
    expect(await t.act(KIT, { do: "colour", house: 4 })).toMatchObject({ ok: false, error: TABLE_TEXT.cancelled });
    expect(await t.act(NATE, { do: "start", withBots: true })).toMatchObject({ ok: false, error: TABLE_TEXT.cancelled });
    expect(t.mirrors.at(-1)!.status).toBe("cancelled");
    expect(t.room.table).toBeNull();
  });

  it("the room sleeps between visitors: a table waiting for players wakes as it was; one that started wakes as a game", async () => {
    const store = memoryRoomStore();
    const t = testRoom(store);
    await t.room.createTable({ gameId: "tbl2", code: "a2b3c4d5e6", settings, seed: "s", host: hostSeat(NATE, 1) });
    await t.act(KIT, { do: "sit", house: 2, leadersRun: true });
    const woke = testRoom(store);
    expect((await woke.table(WREN)).seats.filter(Boolean).map((s) => s!.name)).toEqual(["Nate", "Kit"]);
    await woke.act(NATE, { do: "start" });
    const again = testRoom(store, woke.now() + 1000);
    const m = await again.askAs(KIT, { type: "hello" });
    expect(m && "start" in m && (m.start as RoomStart).playerId).toBe("p2");
  });

  it("a game from session 26 (no table, the seat from the database) still opens", async () => {
    const t = testRoom();
    await t.room.create({ gameId: "old26", settings, people: [nate], seed: "s26" });
    const m = await t.askAs({ ...NATE, seat: "p1" }, { type: "hello" });
    // (Its page has no account on the connection's messages: they go to the seat.)
    expect(m === null ? starts(t.inbox("p1"))[0]!.playerId : null).toBe("p1");
  });
});
