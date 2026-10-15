import type { PlayerId } from "@conquerra/engine";
import type { ChatAct, ChatLine, ChatPerson, ChatSync, ChatView } from "./protocol";
import type { RoomStore } from "./roomCore";

/**
 * Chat for people (session 28), kept with the game in its room. Three kinds: the table (everyone sitting there),
 * one-to-one (any two people), and groups any player makes by picking people at the table. A group is private to its
 * members: nobody else is sent it, or told it exists. No Cloudflare in here: the room passes its storage and clock.
 *
 * Inside the room people are their accounts; on the wire they are only a name, a House colour and (once the game has
 * started) a seat. Messages are plain text, kept as written (the game never rewrites a player's words).
 */

/** At most this many messages a game: the oldest go first. */
export const CHAT_MAX = 2000;
/** A message's length, and a group's name. */
export const CHAT_TEXT_MAX = 300;
export const CHAT_NAME_MAX = 24;
/** At most one message every this many ms a person (faster ones are dropped quietly). */
export const CHAT_GAP_MS = 2000;
/** Messages are stored in blocks of this many (a message rewrites only its own block). */
const BLOCK = 100;

/** The sentences chat answers with (the voice guide applies). */
export const CHAT_TEXT = {
  left: "You've left the game.",
  notMember: "That chat isn't one of yours.",
  noOne: "Pick at least one other person at the table.",
  notPerson: "Chats are with people at the table (bots join chat in a later version).",
} as const;

/** One chat, as the room keeps it. */
interface ChatRecord {
  /** "table", or "c1", "c2"… (never anything that names an account). */
  id: string;
  kind: "table" | "pair" | "group";
  /** Accounts in it (a pair or group; the table is everyone sitting there). */
  members: string[];
  /** A group's name, if a member gave it one. */
  name?: string;
}

interface StoredLine {
  id: number;
  chat: string;
  /** The account that wrote it, and who it was then (name, House, seat). */
  by: string;
  from: Omit<ChatPerson, "you">;
  text: string;
  at: number;
}

interface ChatMeta {
  /**
   * The last message's id. Ids are the time a message was written (ms), one more than the last when two come in the
   * same moment: in order, and with no gaps that would tell anyone how much is said in chats they aren't in.
   */
  last: number;
  /** Messages written so far (the block a message goes in). */
  total: number;
  chats: ChatRecord[];
  /** The first block still kept. */
  first: number;
}

/** A chat's id: random letters, so the ids of your own chats say nothing about anyone else's. */
const newChatId = () => `c${Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => (b % 36).toString(36)).join("")}`;

/** Who someone at the table is, as the room knows them now. */
export interface ChatSeat {
  user: string;
  name: string;
  house: number;
  seat?: PlayerId;
  /** They resigned or a Marshal took their seat: they read, but can't write. */
  left?: boolean;
}

/** Plain text, one line breaks allowed, no control characters, at most 300 characters. */
export function cleanText(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = raw
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, CHAT_TEXT_MAX);
  return text ? text : null;
}

export class ChatRoom {
  private meta: ChatMeta | null = null;
  private blocks = new Map<number, StoredLine[]>();
  private lastSent = new Map<string, number>();
  private writing: Promise<void> = Promise.resolve();

  constructor(
    private readonly store: RoomStore,
    /** Everyone who sits at the table (people only), in seat order. */
    private readonly seats: () => ChatSeat[],
    private readonly now: () => number,
  ) {}

  /** Load what's stored (the first time the room needs chat after waking). */
  async load(): Promise<void> {
    if (this.meta) return;
    const meta = ((await this.store.get("chat")) as ChatMeta | null) ?? { last: 0, total: 0, chats: [], first: 0 };
    if (!meta.chats.some((c) => c.id === "table")) meta.chats.unshift({ id: "table", kind: "table", members: [] });
    const lastBlock = Math.floor(Math.max(0, meta.total - 1) / BLOCK);
    for (let b = meta.first; b <= lastBlock; b++) this.blocks.set(b, ((await this.store.get(`chat:${b}`)) as StoredLine[] | null) ?? []);
    this.meta = meta;
  }

  flush(): Promise<void> {
    return this.writing;
  }

  private get m(): ChatMeta {
    if (!this.meta) throw new Error("Chat isn't loaded");
    return this.meta;
  }

  private seatOf(user: string): ChatSeat | undefined {
    return this.seats().find((s) => s.user === user);
  }

  /** Is this account in this chat? The table: everyone sitting there. */
  private isMember(c: ChatRecord, user: string): boolean {
    return c.kind === "table" ? !!this.seatOf(user) : c.members.includes(user);
  }

  /** The chats this account is in (never anyone else's). */
  private chatsOf(user: string): ChatRecord[] {
    return this.m.chats.filter((c) => this.isMember(c, user));
  }

  private person(user: string, viewer: string): ChatPerson | null {
    const s = this.seatOf(user);
    if (!s) return null;
    return { name: s.name, house: s.house, ...(s.seat ? { seat: s.seat } : {}), ...(user === viewer ? { you: true as const } : {}) };
  }

  /** A chat as one of its members sees it: who's in it (names and colours), nothing more. */
  private view(c: ChatRecord, viewer: string): ChatView {
    if (c.kind === "table") return { id: c.id, kind: "table" };
    return { id: c.id, kind: c.kind, ...(c.name ? { name: c.name } : {}), members: c.members.flatMap((u) => this.person(u, viewer) ?? []) };
  }

  private line(l: StoredLine, viewer: string): ChatLine {
    return { id: l.id, chat: l.chat, from: { ...l.from, ...(l.by === viewer ? { you: true as const } : {}) }, text: l.text, at: l.at };
  }

  private allLines(): StoredLine[] {
    return [...this.blocks.keys()].sort((a, b) => a - b).flatMap((b) => this.blocks.get(b) ?? []);
  }

  /** Everything this account may read after message \`have\` (0: all of it): its chats, and their messages. */
  sync(user: string, have = 0): ChatSync {
    const mine = this.chatsOf(user);
    const ids = new Set(mine.map((c) => c.id));
    const after = Number.isInteger(have) && have > 0 ? have : 0;
    return {
      chats: mine.map((c) => this.view(c, user)),
      lines: this.allLines().filter((l) => l.id > after && ids.has(l.chat)).map((l) => this.line(l, user)),
      canWrite: !!this.seatOf(user) && !this.seatOf(user)!.left,
      ...(after ? { after } : {}),
    };
  }

  /**
   * One thing done in chat. Returns who to tell (each account, its own copy: only chats it's in), or the sentence
   * saying why not, or null for a message dropped quietly (too soon after the last one).
   */
  act(user: string, a: ChatAct): { tell: Map<string, ChatSync> } | { error: string } | null {
    const me = this.seatOf(user);
    if (!a || typeof a !== "object") return { error: CHAT_TEXT.notMember };
    if (!me) return { error: CHAT_TEXT.notMember };
    if (me.left) return { error: CHAT_TEXT.left };
    const byChat = (id: unknown) => this.m.chats.find((c) => c.id === id && this.isMember(c, user));
    const people = (list: unknown): string[] | null => {
      if (!Array.isArray(list)) return null;
      const out: string[] = [];
      for (const seat of list) {
        const s = this.seats().find((x) => x.seat === seat && x.seat !== undefined);
        if (!s) return null;
        if (s.user !== user && !out.includes(s.user)) out.push(s.user);
      }
      return out;
    };
    switch (a.do) {
      case "send": {
        const c = byChat(a.chat);
        if (!c) return { error: CHAT_TEXT.notMember };
        const text = cleanText(a.text);
        if (!text) return { error: "A message needs some words." };
        const t = this.now();
        if (t - (this.lastSent.get(user) ?? -Infinity) < CHAT_GAP_MS) return null;
        this.lastSent.set(user, t);
        this.m.last = Math.max(this.m.last + 1, t);
        const l: StoredLine = { id: this.m.last, chat: c.id, by: user, from: { name: me.name, house: me.house, ...(me.seat ? { seat: me.seat } : {}) }, text, at: t };
        this.append(l);
        return { tell: this.tellMembers(c, (u) => ({ chats: [], lines: [this.line(l, u)], canWrite: true })) };
      }
      case "pair": {
        const [other] = people([a.with]) ?? [];
        if (!other) return { error: CHAT_TEXT.notPerson };
        let c = this.m.chats.find((x) => x.kind === "pair" && x.members.includes(user) && x.members.includes(other));
        if (!c) {
          c = { id: newChatId(), kind: "pair", members: [user, other] };
          this.m.chats.push(c);
          this.saveMeta();
        }
        const made = c;
        return { tell: this.tellMembers(made, (u) => ({ chats: [this.view(made, u)], lines: [], canWrite: true })) };
      }
      case "group": {
        const others = people(a.with);
        if (!others) return { error: CHAT_TEXT.notPerson };
        if (!others.length) return { error: CHAT_TEXT.noOne };
        const name = typeof a.name === "string" && a.name.trim() ? a.name.trim().slice(0, CHAT_NAME_MAX) : undefined;
        const c: ChatRecord = { id: newChatId(), kind: "group", members: [user, ...others], ...(name ? { name } : {}) };
        this.m.chats.push(c);
        this.saveMeta();
        return { tell: this.tellMembers(c, (u) => ({ chats: [this.view(c, u)], lines: [], canWrite: true })) };
      }
      case "add": {
        const c = byChat(a.chat);
        if (!c || c.kind !== "group") return { error: CHAT_TEXT.notMember };
        const others = people(a.with);
        if (!others) return { error: CHAT_TEXT.notPerson };
        const fresh = others.filter((u) => !c.members.includes(u));
        if (!fresh.length) return { error: CHAT_TEXT.noOne };
        c.members.push(...fresh);
        this.saveMeta();
        // Someone added reads what the group wrote before them too (it's one conversation).
        return { tell: this.tellMembers(c, (u) => (fresh.includes(u) ? this.syncChat(c, u) : { chats: [this.view(c, u)], lines: [], canWrite: true })) };
      }
      case "rename": {
        const c = byChat(a.chat);
        if (!c || c.kind !== "group") return { error: CHAT_TEXT.notMember };
        const name = typeof a.name === "string" ? a.name.trim().slice(0, CHAT_NAME_MAX) : "";
        if (name) c.name = name;
        else delete c.name;
        this.saveMeta();
        return { tell: this.tellMembers(c, (u) => ({ chats: [this.view(c, u)], lines: [], canWrite: true })) };
      }
      default:
        return { error: "That can't be done in chat." };
    }
  }

  /** One chat's whole history, for someone just added to it. */
  private syncChat(c: ChatRecord, user: string): ChatSync {
    return { chats: [this.view(c, user)], lines: this.allLines().filter((l) => l.chat === c.id).map((l) => this.line(l, user)), canWrite: true };
  }

  private tellMembers(c: ChatRecord, copy: (user: string) => ChatSync): Map<string, ChatSync> {
    const users = c.kind === "table" ? this.seats().map((s) => s.user) : c.members;
    return new Map(users.map((u) => [u, { ...copy(u), canWrite: !!this.seatOf(u) && !this.seatOf(u)!.left }]));
  }

  private append(l: StoredLine) {
    const b = Math.floor(this.m.total / BLOCK);
    this.m.total++;
    const block = this.blocks.get(b) ?? [];
    block.push(l);
    this.blocks.set(b, block);
    const writes: [string, unknown][] = [[`chat:${b}`, block]];
    // At most CHAT_MAX messages: the oldest block goes (then 1,901 to 2,000 are kept).
    if (this.count > CHAT_MAX && this.m.first < b) {
      const oldest = this.m.first;
      this.blocks.delete(oldest);
      this.m.first = oldest + 1;
      writes.push([`chat:${oldest}`, []]);
    }
    writes.push(["chat", this.m]);
    for (const [k, v] of writes) this.writing = this.writing.then(() => this.store.put(k, v)).catch(() => undefined);
  }

  private saveMeta() {
    const meta = this.m;
    this.writing = this.writing.then(() => this.store.put("chat", meta)).catch(() => undefined);
  }

  /** How many messages are kept (tests). */
  get count(): number {
    let n = 0;
    for (const b of this.blocks.values()) n += b.length;
    return n;
  }
}
