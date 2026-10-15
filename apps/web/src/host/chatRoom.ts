import type { PlayerId } from "@conquerra/engine";
import type { ChatAct, ChatLine, ChatPerson, ChatPropose, ChatSync, ChatView } from "./protocol";
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
  notPerson: "Chats are with the players at the table.",
  /** Session 29. */
  botsDontRead: "Bots don't read free text. Pick one of the lines instead.",
} as const;

/** One chat, as the room keeps it. */
interface ChatRecord {
  /** "table", or "c1", "c2"… (never anything that names an account). */
  id: string;
  kind: "table" | "pair" | "group";
  /** Accounts in it (a pair or group; the table is everyone sitting there). */
  members: string[];
  /** Session 29: bots in it (a one-to-one with a bot, or a group a member added a bot to). */
  bots?: PlayerId[];
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
  /** Session 29: written for these accounts only (a bot's table line is written for each reader). */
  to?: string[];
  /** Session 29: a deal to send, ready made (a bot's "make it a deal" in a group, for the member who asked). */
  propose?: ChatPropose;
  /** Session 29: the turn a bot's line is about (the page holds it until that turn's replay has played). */
  turn?: number;
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
  /** Session 29: when each bot last spoke to each reader in the table chat ("account|bot": the turn). */
  botLast?: Record<string, number>;
  /** Session 29: the messages each bot has answered for each person this turn ("account|bot"). */
  free?: { turn: number; used: Record<string, number> };
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

/** Session 29: a bot at the table, as chat knows it (its seat, name and House colour). */
export interface ChatBotSeat {
  seat: PlayerId;
  name: string;
  house: number;
  /** Knocked out: its chats keep its name, but it can't be added to one. */
  out?: boolean;
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
    /** Session 29: the bots at the table (still in the game). */
    private readonly bots: () => ChatBotSeat[] = () => [],
    /** Session 29: what a chat with bots in it adds for one person (their lines to pick from, messages left). */
    private readonly extra: (c: { id: string; kind: string; bots: PlayerId[] }, user: string) => Partial<ChatView> = () => ({}),
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

  private botPerson(seat: PlayerId): ChatPerson | null {
    const b = this.bots().find((x) => x.seat === seat);
    return b ? { name: b.name, house: b.house, seat: b.seat, bot: true } : null;
  }

  private person(user: string, viewer: string): ChatPerson | null {
    const s = this.seatOf(user);
    if (!s) return null;
    return { name: s.name, house: s.house, ...(s.seat ? { seat: s.seat } : {}), ...(user === viewer ? { you: true as const } : {}) };
  }

  /** A chat as one of its members sees it: who's in it (names and colours), nothing more. */
  private view(c: ChatRecord, viewer: string): ChatView {
    if (c.kind === "table") return { id: c.id, kind: "table" };
    const bots = c.bots ?? [];
    return {
      id: c.id,
      kind: c.kind,
      ...(c.name ? { name: c.name } : {}),
      members: [...c.members.flatMap((u) => this.person(u, viewer) ?? []), ...bots.flatMap((b) => this.botPerson(b) ?? [])],
      ...(bots.length ? this.extra({ id: c.id, kind: c.kind, bots }, viewer) : {}),
    };
  }

  private line(l: StoredLine, viewer: string): ChatLine {
    return {
      id: l.id,
      chat: l.chat,
      from: { ...l.from, ...(l.by === viewer ? { you: true as const } : {}) },
      text: l.text,
      at: l.at,
      ...(l.propose ? { propose: l.propose } : {}),
      ...(l.turn !== undefined ? { turn: l.turn } : {}),
    };
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
      lines: this.allLines().filter((l) => l.id > after && ids.has(l.chat) && this.mayRead(l, user)).map((l) => this.line(l, user)),
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
    // (Session 29: a bot's seat may be picked too: it goes in the chat's bots, never its accounts.)
    const botsPicked: PlayerId[] = [];
    const people = (list: unknown): string[] | null => {
      if (!Array.isArray(list)) return null;
      const out: string[] = [];
      botsPicked.length = 0;
      for (const seat of list) {
        const s = this.seats().find((x) => x.seat === seat && x.seat !== undefined);
        if (!s) {
          const b = this.bots().find((x) => x.seat === seat && !x.out);
          if (!b) return null;
          if (!botsPicked.includes(b.seat)) botsPicked.push(b.seat);
          continue;
        }
        if (s.user !== user && !out.includes(s.user)) out.push(s.user);
      }
      return out;
    };
    switch (a.do) {
      case "send": {
        const c = byChat(a.chat);
        if (!c) return { error: CHAT_TEXT.notMember };
        // (A one-to-one with a bot is multiple choice: the bot never reads free text.)
        if (c.kind === "pair" && c.bots?.length) return { error: CHAT_TEXT.botsDontRead };
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
        const bot = botsPicked[0];
        if (!other && !bot) return { error: CHAT_TEXT.notPerson };
        let c = other
          ? this.m.chats.find((x) => x.kind === "pair" && !x.bots?.length && x.members.includes(user) && x.members.includes(other))
          : this.m.chats.find((x) => x.kind === "pair" && x.members.length === 1 && x.members[0] === user && x.bots?.[0] === bot);
        if (!c) {
          c = other ? { id: newChatId(), kind: "pair", members: [user, other] } : { id: newChatId(), kind: "pair", members: [user], bots: [bot!] };
          this.m.chats.push(c);
          this.saveMeta();
        }
        const made = c;
        return { tell: this.tellMembers(made, (u) => ({ chats: [this.view(made, u)], lines: [], canWrite: true })) };
      }
      case "group": {
        const others = people(a.with);
        if (!others) return { error: CHAT_TEXT.notPerson };
        if (!others.length && !botsPicked.length) return { error: CHAT_TEXT.noOne };
        const name = typeof a.name === "string" && a.name.trim() ? a.name.trim().slice(0, CHAT_NAME_MAX) : undefined;
        const c: ChatRecord = { id: newChatId(), kind: "group", members: [user, ...others], ...(botsPicked.length ? { bots: [...botsPicked] } : {}), ...(name ? { name } : {}) };
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
        const freshBots = botsPicked.filter((b) => !(c.bots ?? []).includes(b));
        if (!fresh.length && !freshBots.length) return { error: CHAT_TEXT.noOne };
        c.members.push(...fresh);
        if (freshBots.length) c.bots = [...(c.bots ?? []), ...freshBots];
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
    return { chats: [this.view(c, user)], lines: this.allLines().filter((l) => l.chat === c.id && this.mayRead(l, user)).map((l) => this.line(l, user)), canWrite: true };
  }

  /** May this account read this line? (A line written for some readers only reaches them.) */
  private mayRead(l: StoredLine, user: string): boolean {
    return !l.to || l.to.includes(user);
  }

  // ---------- Session 29: the bots in the chat ----------

  /** A chat this account is in (else undefined): the room's own checks before a bot answers in it. */
  find(user: string, chat: unknown): { id: string; kind: "table" | "pair" | "group"; bots: PlayerId[] } | undefined {
    const c = this.m.chats.find((x) => x.id === chat && this.isMember(x, user));
    return c ? { id: c.id, kind: c.kind, bots: [...(c.bots ?? [])] } : undefined;
  }

  /** A bot at the table, as chat knows it (still in the game). */
  bot(seat: PlayerId): ChatBotSeat | undefined {
    return this.bots().find((b) => b.seat === seat);
  }

  /**
   * A line in a chat from a bot, or (`user`) a person's own multiple-choice line. `to`: only these accounts read it (a
   * bot's table line, written for one reader). Returns who to tell, each their own copy.
   */
  write(chat: string, from: { bot: ChatBotSeat } | { user: string }, text: string, opts: { to?: string[]; propose?: ChatPropose; turn?: number } = {}): Map<string, ChatSync> {
    const c = this.m.chats.find((x) => x.id === chat);
    if (!c) return new Map();
    const t = this.now();
    this.m.last = Math.max(this.m.last + 1, t);
    let by: string;
    let who: Omit<ChatPerson, "you">;
    if ("bot" in from) {
      by = `bot:${from.bot.seat}`;
      who = { name: from.bot.name, house: from.bot.house, seat: from.bot.seat, bot: true };
    } else {
      const me = this.seatOf(from.user)!;
      by = from.user;
      who = { name: me.name, house: me.house, ...(me.seat ? { seat: me.seat } : {}) };
    }
    const l: StoredLine = { id: this.m.last, chat, by, from: who, text: text.slice(0, CHAT_TEXT_MAX), at: t, ...(opts.to ? { to: opts.to } : {}), ...(opts.propose ? { propose: opts.propose } : {}), ...(opts.turn !== undefined ? { turn: opts.turn } : {}) };
    this.append(l);
    const users = (c.kind === "table" ? this.seats().map((s) => s.user) : c.members).filter((u) => this.mayRead(l, u));
    return new Map(users.map((u) => [u, { chats: [], lines: [this.line(l, u)], canWrite: !!this.seatOf(u) && !this.seatOf(u)!.left }]));
  }

  /** The chats with bots in them, as this account sees them now (their lines to pick from change each turn). */
  botChats(user: string): ChatView[] {
    return this.chatsOf(user)
      .filter((c) => c.bots?.length)
      .map((c) => this.view(c, user));
  }

  /** When each bot last spoke to this reader in the table chat (by bot, the turn). */
  botLast(user: string): Record<PlayerId, number> {
    const out: Record<PlayerId, number> = {};
    for (const [k, turn] of Object.entries(this.m.botLast ?? {})) {
      const [u, bot] = k.split("|") as [string, string];
      if (u === user) out[bot] = turn;
    }
    return out;
  }

  spoke(user: string, bot: PlayerId, turn: number) {
    (this.m.botLast ??= {})[`${user}|${bot}`] = turn;
    this.saveMeta();
  }

  /** How many more of this person's messages this bot answers this turn. */
  freeLeft(user: string, bot: PlayerId, turn: number, max: number): number {
    const f = this.m.free;
    return Math.max(0, max - (f && f.turn === turn ? (f.used[`${user}|${bot}`] ?? 0) : 0));
  }

  useFree(user: string, bot: PlayerId, turn: number) {
    if (!this.m.free || this.m.free.turn !== turn) this.m.free = { turn, used: {} };
    const k = `${user}|${bot}`;
    this.m.free.used[k] = (this.m.free.used[k] ?? 0) + 1;
    this.saveMeta();
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
