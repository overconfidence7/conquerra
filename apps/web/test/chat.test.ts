import { maps } from "@conquerra/content/maps";
import { describe, expect, it } from "vitest";
import { CHAT_GAP_MS, CHAT_MAX, CHAT_NAME_MAX, CHAT_TEXT, CHAT_TEXT_MAX, cleanText } from "../src/host/chatRoom";
import type { ChatSync, RoomMessage } from "../src/host/protocol";
import { RoomCore } from "../src/host/roomCore";
import { hostSeat, KIT, memoryRoomStore, NATE, ROOK, settings, testRoom, WREN } from "./roomHelpers";

/**
 * Session 28, Part 2: chat for people. The table chat (from the table screen into the game), one-to-one, and groups
 * a player makes; a group is private to its members. The room keeps up to 2,000 messages, one every 2 s a person, and
 * sends each page only the chats it's in.
 */

const chatsOf = (msgs: RoomMessage[]): ChatSync[] => msgs.flatMap((m) => ("chat" in m ? [m.chat] : "start" in m && m.start.chat ? [m.start.chat] : []));
const linesOf = (msgs: RoomMessage[]) => chatsOf(msgs).flatMap((c) => c.lines);
const answerOf = (m: RoomMessage | null): ChatSync => {
  if (!m || !("chat" in m)) throw new Error(`no chat: ${JSON.stringify(m)}`);
  return m.chat;
};

async function table(store = memoryRoomStore()) {
  const t = testRoom(store);
  await t.room.createTable({ gameId: "chat", code: "ch4tt4ble1", settings: { ...settings, bots: 3 }, seed: "chat-at-the-table", host: hostSeat(NATE, 0) });
  await t.table(NATE);
  await t.table(ROOK);
  await t.act(KIT, { do: "sit", house: 3, leadersRun: true });
  await t.act(WREN, { do: "sit", house: 5, leadersRun: true });
  const say = async (who: typeof NATE, chat: string, text: string) => {
    t.advance(CHAT_GAP_MS);
    return t.askAs(who, { type: "chat", act: { do: "send", chat, text } });
  };
  return { ...t, say };
}

describe("chat for people (session 28)", () => {
  it("the table chat opens at the table screen (seated people only) and carries into the game", async () => {
    const t = await table();
    t.clear();
    const m = await t.say(KIT, "table", "Who's ready?");
    expect(answerOf(m).lines.map((l) => [l.text, l.from.name, l.from.you])).toEqual([["Who's ready?", "Kit", true]]);
    // Nate and Wren hear it at once; Rook (the link, never sat) doesn't.
    expect(linesOf(t.inbox(NATE.user)).map((l) => l.text)).toEqual(["Who's ready?"]);
    expect(linesOf(t.inbox(WREN.user)).map((l) => l.from)).toEqual([{ name: "Kit", house: 3 }]);
    expect(chatsOf(t.inbox(ROOK.user))).toEqual([]);
    // Rook can't write either, and sitting down later brings the chat so far.
    expect(await t.askAs(ROOK, { type: "chat", act: { do: "send", chat: "table", text: "hello?" } })).toMatchObject({ ok: false, error: CHAT_TEXT.notMember });
    await t.act(NATE, { do: "start" });
    // In the game: Nate's "where are we" has the table chat and its messages, with seats now.
    const start = await t.hello("p1");
    expect(start.chat!.chats).toEqual([{ id: "table", kind: "table" }]);
    expect(start.chat!.lines.map((l) => l.text)).toEqual(["Who's ready?"]);
    await t.say(NATE, "table", "Good luck, all.");
    expect(linesOf(t.inbox(KIT.user)).at(-1)).toMatchObject({ text: "Good luck, all.", from: { name: "Nate", seat: "p1" } });
    // The hello says the last message it has: only the rest come.
    const id = start.chat!.lines[0]!.id;
    const again = await t.ask("p1", { type: "hello", chatHave: id });
    expect("start" in again! && again.start.chat!.lines.map((l) => l.text)).toEqual(["Good luck, all."]);
  });

  it("one-to-one and groups: only their members ever hear of them; members can add people and rename it", async () => {
    const t = await table();
    await t.act(NATE, { do: "start" });
    t.clear();
    const pair = answerOf(await t.askAs(NATE, { type: "chat", act: { do: "pair", with: "p2" } })).chats[0]!;
    expect(pair).toMatchObject({ kind: "pair", members: [{ name: "Nate", seat: "p1", you: true }, { name: "Kit", seat: "p2" }] });
    await t.say(NATE, pair.id, "Truce in the east?");
    // Opening it again finds the same chat.
    expect(answerOf(await t.askAs(KIT, { type: "chat", act: { do: "pair", with: "p1" } })).chats[0]!.id).toBe(pair.id);
    const group = answerOf(await t.askAs(NATE, { type: "chat", act: { do: "group", with: ["p2"] } })).chats[0]!;
    expect(group).toMatchObject({ kind: "group", members: [{ name: "Nate" }, { name: "Kit" }] });
    expect(group.name).toBeUndefined();
    await t.say(KIT, group.id, "Wren is weak in the north.");
    // Wren was told nothing of either: no chat, no id, no message.
    const wren = JSON.stringify(t.inbox(WREN.user));
    expect(chatsOf(t.inbox(WREN.user))).toEqual([]);
    expect(wren).not.toContain(group.id);
    expect(wren).not.toContain(pair.id);
    expect(wren).not.toContain("weak in the north");
    expect((await t.hello("p3")).chat!.chats.map((c) => c.id)).toEqual(["table"]);
    // A non-member can't write in it, add to it or rename it.
    expect(await t.askAs(WREN, { type: "chat", act: { do: "send", chat: group.id, text: "hi" } })).toMatchObject({ ok: false, error: CHAT_TEXT.notMember });
    expect(await t.askAs(WREN, { type: "chat", act: { do: "rename", chat: group.id, name: "Mine" } })).toMatchObject({ ok: false });
    // Rename (24 characters at most): both members are told.
    t.clear();
    await t.askAs(KIT, { type: "chat", act: { do: "rename", chat: group.id, name: "The Northern Question, at length" } });
    expect(chatsOf(t.inbox(NATE.user)).at(-1)!.chats[0]!.name).toBe("The Northern Question, at length".slice(0, CHAT_NAME_MAX));
    expect(chatsOf(t.inbox(WREN.user))).toEqual([]);
    // A member adds Wren: she gets the group and what it said before her.
    await t.askAs(NATE, { type: "chat", act: { do: "add", chat: group.id, with: ["p3"] } });
    expect(linesOf(t.inbox(WREN.user)).map((l) => l.text)).toEqual(["Wren is weak in the north."]);
    expect(chatsOf(t.inbox(KIT.user)).at(-1)!.chats[0]!.members!.map((p) => p.name)).toEqual(["Nate", "Kit", "Wren"]);
    // Still not the pair.
    expect(JSON.stringify(t.inbox(WREN.user))).not.toContain(pair.id);
    // A group needs someone else in it, and only people.
    expect(await t.askAs(NATE, { type: "chat", act: { do: "group", with: [] } })).toMatchObject({ ok: false, error: CHAT_TEXT.noOne });
    expect(await t.askAs(NATE, { type: "chat", act: { do: "group", with: ["p9"] } })).toMatchObject({ ok: false, error: CHAT_TEXT.notPerson });
  });

  it("plain text, 300 characters; one message every 2 s a person (faster ones dropped quietly)", async () => {
    const t = await table();
    expect(cleanText("  hi\u0007 there\r\n\r\n\r\n\r\nyou  ")).toBe("hi there\n\nyou");
    expect(cleanText("   ")).toBeNull();
    expect(cleanText(`<b>${"x".repeat(400)}</b>`)).toHaveLength(CHAT_TEXT_MAX);
    t.clear();
    await t.say(NATE, "table", "one");
    const fast = await t.askAs(NATE, { type: "chat", act: { do: "send", chat: "table", text: "two" } });
    expect(fast).toMatchObject({ ok: true, chat: { lines: [] } });
    expect(linesOf(t.inbox(KIT.user)).map((l) => l.text)).toEqual(["one"]);
    // Kit isn't held up by Nate's pace.
    await t.askAs(KIT, { type: "chat", act: { do: "send", chat: "table", text: "three" } });
    await t.say(NATE, "table", "four");
    expect(linesOf(t.inbox(WREN.user)).map((l) => l.text)).toEqual(["one", "three", "four"]);
  });

  it("at most 2,000 messages a game: the oldest go; the ids stay in order", async () => {
    const t = await table();
    for (let i = 0; i < CHAT_MAX + 150; i++) await t.say(i % 2 ? KIT : NATE, "table", `m${i}`);
    expect(t.room.chat.count).toBeLessThanOrEqual(CHAT_MAX);
    expect(t.room.chat.count).toBeGreaterThan(CHAT_MAX - 100);
    const all = t.room.chat.sync(NATE.user).lines;
    expect(all.at(-1)!.text).toBe(`m${CHAT_MAX + 149}`);
    expect(all.every((l, i) => i === 0 || l.id > all[i - 1]!.id)).toBe(true);
    // The room wakes (a deploy): the same messages, from storage.
    const woke = new RoomCore(t.store, async (id) => maps[id]!, { send: () => true, sendUser: () => true, users: () => [], tableChanged: () => {}, wakeAt: () => {}, listed: () => {}, log: () => {} }, () => t.now());
    await woke.receive(NATE, { id: 1, type: "hello" });
    expect(woke.chat.sync(NATE.user).lines.map((l) => l.text)).toEqual(all.map((l) => l.text));
  }, 60_000);

  it("someone who resigned keeps reading their chats but can't write", async () => {
    const t = await table();
    await t.act(NATE, { do: "start" });
    const group = answerOf(await t.askAs(NATE, { type: "chat", act: { do: "group", with: ["p2"] } })).chats[0]!;
    await t.ask("p2", { type: "resign" });
    expect(await t.say(KIT, group.id, "still here")).toMatchObject({ ok: false, error: CHAT_TEXT.left });
    await t.say(NATE, group.id, "Sorry to see you go.");
    const back = await t.hello("p2");
    expect(back.chat!.canWrite).toBe(false);
    expect(back.chat!.lines.map((l) => l.text)).toEqual(["Sorry to see you go."]);
    expect(back.chat!.chats.map((c) => c.id).sort()).toEqual([group.id, "table"].sort());
  });
});
