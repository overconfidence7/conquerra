import { create } from "zustand";
import type { ChatAct, ChatLine, ChatSync, ChatView } from "../../host/protocol";

/**
 * Chat on the page (session 28): the chats you're in, their messages, what you've read, and the small pop-up. The
 * room sends only your own chats; this keeps them for the game that's open. Loaded with the online code and the game
 * screen, never in the start-up bundle.
 */

/** What the chat says itself (the voice guide applies; players' messages are their own). */
export const CHAT_UI = {
  table: "The table",
  empty: "Nothing said yet. Someone has to go first.",
  left: "You've left the game.",
  newGroup: "New group",
  groupHelp: "Pick who's in it. Only they will see it, or know it exists.",
  noChats: "No chats yet.",
  /** Session 29: single player's table chat. */
  local: "Only bots sit at this table, and they don't read free text. Online, you can talk to them by picking a line.",
  /** Session 30: under an offer's note, once the offer has ended with no answer. */
  ended: { lapsed: "(lapsed at lock-in)", withdrawn: "(withdrawn)" },
  /** Session 31: a withdrawn offer says who withdrew it (only its sender can). */
  withdrawnBy: (who: string, you: boolean) => (you ? "(you withdrew it)" : `(withdrawn by ${who})`),
} as const;

interface ChatState {
  /** The game these chats belong to. */
  gameId: string | null;
  chats: ChatView[];
  lines: ChatLine[];
  canWrite: boolean;
  /** The last message you've read in each chat (kept on this device). */
  read: Record<string, number>;
  /** The chat panel is open (desktop), and which chat is showing (null: the list, on a phone). */
  open: boolean;
  selected: string | null;
  /** Making a group (the tick boxes). */
  grouping: boolean;
  /** The pop-up: the latest message that came in while the panel was closed. */
  popup: ChatLine | null;
  /** Something to do in chat (the online host's). */
  act: ((a: ChatAct) => Promise<ChatSync>) | null;
  /** Session 29: the replay is playing: a bot's line about a turn waits until you've watched it (no spoilers). */
  hold: boolean;
  held: ChatLine[];
}

export const useChat = create<ChatState>(() => ({ gameId: null, chats: [], lines: [], canWrite: true, read: {}, open: false, selected: null, grouping: false, popup: null, act: null, hold: false, held: [] }));

const readKey = (gameId: string) => `conquerra.chatRead.${gameId}`;

/** A new game's chats (empty until the room sends them), and how to act in them. */
export function resetChat(gameId: string | null, act: ChatState["act"]) {
  let read: Record<string, number> = {};
  try {
    if (gameId) read = JSON.parse(localStorage.getItem(readKey(gameId)) ?? "{}") as Record<string, number>;
  } catch {
    read = {};
  }
  useChat.setState({ gameId, chats: [], lines: [], canWrite: true, read, open: false, selected: null, grouping: false, popup: null, act, hold: false, held: [] });
}

/**
 * Session 29: while the replay plays, a bot's line about a turn waits (it would give the turn away); when the replay
 * is over, what waited comes in as if it had just arrived.
 */
export function holdBotLines(hold: boolean) {
  const s = useChat.getState();
  if (s.hold === hold) return;
  if (hold) return useChat.setState({ hold: true });
  const held = s.held;
  useChat.setState({ hold: false, held: [] });
  if (held.length) applyChat({ chats: [], lines: held, canWrite: s.canWrite });
}

/** The game is known now (the link's or the lobby's): what you'd read in it before comes back from this device. */
export function chatGame(gameId: string | null) {
  if (!gameId || useChat.getState().gameId === gameId) return;
  let read: Record<string, number> = {};
  try {
    read = JSON.parse(localStorage.getItem(readKey(gameId)) ?? "{}") as Record<string, number>;
  } catch {
    read = {};
  }
  useChat.setState({ gameId, read });
}

/** Is this chat on screen right now (so its new messages are read as they come)? */
const showing = (s: ChatState, chat: string) => s.open && s.selected === chat;

/** What the room sent: chats replaced by id, messages added in order; a message for a chat not on screen pops up. */
export function applyChat(sync: ChatSync) {
  // (A bot's line about a turn waits while the replay plays.)
  const now = useChat.getState();
  if (now.hold && sync.lines.some((l) => l.from.bot && l.turn !== undefined)) {
    useChat.setState({ held: [...now.held, ...sync.lines.filter((l) => l.from.bot && l.turn !== undefined)] });
    sync = { ...sync, lines: sync.lines.filter((l) => !(l.from.bot && l.turn !== undefined)) };
  }
  const s = useChat.getState();
  const chats = [...s.chats];
  for (const c of sync.chats) {
    const i = chats.findIndex((x) => x.id === c.id);
    if (i >= 0) chats[i] = c;
    else chats.push(c);
  }
  const have = new Set(s.lines.map((l) => l.id));
  const fresh = sync.lines.filter((l) => !have.has(l.id));
  let lines = fresh.length ? [...s.lines, ...fresh].sort((a, b) => a.id - b.id) : s.lines;
  // (Session 30: an offer that ended with no answer: its note says so.)
  const ended = sync.ended;
  const mark = (l: ChatLine): ChatLine => (ended && l.offer && ended[l.offer] && !l.ended ? { ...l, ended: ended[l.offer] } : l);
  if (ended) {
    lines = lines.map(mark);
    if (s.held.length) useChat.setState({ held: s.held.map(mark) });
  }
  // (The first sync of a game is history, not news: no pop-up for it.)
  const news = s.lines.length || s.chats.length ? fresh.filter((l) => !l.from.you && !showing(s, l.chat)).at(-1) : undefined;
  useChat.setState({ chats, lines, canWrite: sync.canWrite, ...(news ? { popup: news } : {}) });
  const sel = useChat.getState().selected;
  if (sel && showing(useChat.getState(), sel)) markRead(sel);
}

/** Session 29: you've read your council up to this line (its ids are its own: turn and line). */
export function markCouncilRead(last: number) {
  const s = useChat.getState();
  if ((s.read.council ?? 0) >= last) return;
  const read = { ...s.read, council: last };
  useChat.setState({ read });
  try {
    if (s.gameId) localStorage.setItem(readKey(s.gameId), JSON.stringify(read));
  } catch {
    // Full or private: unread counts reset on the next visit.
  }
}

/** You've read a chat up to its last message. */
export function markRead(chat: string) {
  const s = useChat.getState();
  const last = s.lines.filter((l) => l.chat === chat).at(-1)?.id ?? 0;
  if ((s.read[chat] ?? 0) >= last) return;
  const read = { ...s.read, [chat]: last };
  useChat.setState({ read });
  try {
    if (s.gameId) localStorage.setItem(readKey(s.gameId), JSON.stringify(read));
  } catch {
    // Full or private: unread counts reset on the next visit.
  }
}

/** Messages you haven't read in this chat (your own never count). */
export const unreadIn = (s: Pick<ChatState, "lines" | "read">, chat: string) => s.lines.filter((l) => l.chat === chat && !l.from.you && l.id > (s.read[chat] ?? 0)).length;
export const unreadAll = (s: Pick<ChatState, "lines" | "read" | "chats">) => s.chats.reduce((n, c) => n + unreadIn(s, c.id), 0);

/** A chat's name: the table, a group's own name or its members' names, the other person in a one-to-one. */
export function chatName(c: ChatView): string {
  if (c.kind === "table") return CHAT_UI.table;
  if (c.name) return c.name;
  const members = c.members ?? [];
  if (c.kind === "pair") return members.find((p) => !p.you)?.name ?? "A chat";
  return members.map((p) => p.name).join(", ");
}

/** The sidebar's order: the table first, then groups, then one-to-one. */
export const ordered = (chats: readonly ChatView[]) => {
  const rank = { table: 0, group: 1, pair: 2 } as const;
  return [...chats].sort((a, b) => rank[a.kind] - rank[b.kind]);
};

/** Open the chat panel on a chat (or the list), marking it read. */
export function openChat(chat: string | null) {
  useChat.setState({ open: true, selected: chat, grouping: false, popup: null });
  if (chat) markRead(chat);
}

export const closeChat = () => useChat.setState({ open: false, grouping: false });

/** Session 29: the bots in a chat (a one-to-one with a bot, or a group a member added bots to). */
export const botsIn = (c: ChatView | undefined) => (c?.members ?? []).filter((p) => p.bot);

/** Do something in chat; a sentence if it couldn't be done. */
export async function chatDo(a: ChatAct): Promise<string | null> {
  const act = useChat.getState().act;
  if (!act) return "Chat isn't open.";
  try {
    applyChat(await act(a));
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

/** Open (or make) the one-to-one with someone at the table, and show it. */
export async function chatWith(seat: string): Promise<string | null> {
  const act = useChat.getState().act;
  if (!act) return "Chat isn't open.";
  try {
    const sync = await act({ do: "pair", with: seat });
    applyChat(sync);
    const c = sync.chats[0];
    if (c) openChat(c.id);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}
