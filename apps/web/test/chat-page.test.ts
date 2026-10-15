import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatLine, ChatSync } from "../src/host/protocol";
import { applyChat, chatName, closeChat, markRead, openChat, ordered, resetChat, unreadAll, unreadIn, useChat } from "../src/ui/chat/chatStore";

/** Session 28: chat on the page: unread counts, the pop-up, names and the sidebar's order. */

const nate = { name: "Nate", house: 0, seat: "p1" };
const kit = { name: "Kit", house: 3, seat: "p2" };
const line = (id: number, chat: string, from: ChatLine["from"], text = `m${id}`): ChatLine => ({ id, chat, from, text, at: id });
const sync = (s: Partial<ChatSync>): ChatSync => ({ chats: [], lines: [], canWrite: true, ...s });

describe("chat on the page (session 28)", () => {
  beforeAll(() => {
    const box = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => box.get(k) ?? null, setItem: (k: string, v: string) => void box.set(k, v) });
  });
  afterAll(() => vi.unstubAllGlobals());
  beforeEach(() => resetChat("g1", null));

  it("the first sync is history (no pop-up); later messages count as unread and pop up, your own never do", () => {
    applyChat(sync({ chats: [{ id: "table", kind: "table" }], lines: [line(1, "table", kit)] }));
    expect(useChat.getState().popup).toBeNull();
    expect(unreadAll(useChat.getState())).toBe(1);
    applyChat(sync({ lines: [line(2, "table", { ...nate, you: true })] }));
    expect(useChat.getState().popup).toBeNull();
    applyChat(sync({ lines: [line(3, "table", kit, "Truce?")] }));
    expect(useChat.getState().popup?.text).toBe("Truce?");
    expect(unreadIn(useChat.getState(), "table")).toBe(2);
    // Opening the chat reads it, and a message to the chat on screen doesn't pop up.
    openChat("table");
    expect(unreadAll(useChat.getState())).toBe(0);
    applyChat(sync({ lines: [line(4, "table", kit)] }));
    expect(useChat.getState().popup).toBeNull();
    expect(unreadAll(useChat.getState())).toBe(0);
    closeChat();
    // The same message twice is kept once.
    applyChat(sync({ lines: [line(4, "table", kit)] }));
    expect(useChat.getState().lines).toHaveLength(4);
  });

  it("names and order: the table first, then groups (named, or by their members), then one-to-one by the other person", () => {
    const pair = { id: "cx", kind: "pair" as const, members: [{ ...nate, you: true as const }, kit] };
    const group = { id: "cy", kind: "group" as const, members: [{ ...nate, you: true as const }, kit] };
    expect(chatName(pair)).toBe("Kit");
    expect(chatName(group)).toBe("Nate, Kit");
    expect(chatName({ ...group, name: "The East" })).toBe("The East");
    expect(chatName({ id: "table", kind: "table" })).toBe("The table");
    expect(ordered([pair, group, { id: "table", kind: "table" }]).map((c) => c.id)).toEqual(["table", "cy", "cx"]);
  });

  it("what you've read is kept per game on this device", () => {
    applyChat(sync({ chats: [{ id: "table", kind: "table" }], lines: [line(10, "table", kit)] }));
    markRead("table");
    resetChat("g1", null);
    expect(useChat.getState().read).toEqual({ table: 10 });
    resetChat("g2", null);
    expect(useChat.getState().read).toEqual({});
  });
});
