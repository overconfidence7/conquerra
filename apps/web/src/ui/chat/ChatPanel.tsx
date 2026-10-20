import { useEffect, useRef, useState } from "react";
import type { ChatLine, ChatPropose, ChatView } from "../../host/protocol";
import { HOUSES } from "../../map/houses";
import { useGame } from "../../store";
import { Incoming } from "../Deals";
import { Frame } from "../Frame";
import { applyChat, botsIn, CHAT_UI, chatDo, chatName, closeChat, markRead, openChat, ordered, unreadIn, useChat } from "./chatStore";
import { COUNCIL_CHAT, CouncilChat } from "./Council";
import { useCouncilUnread } from "./ChatBits";
import { COUNCIL_ID } from "./councilStore";
import { formsOpen, LineActions } from "./Safety";
import "./chat.css";

/** Session 29: what the chat with bots says itself (the voice guide applies). */
export const BOT_UI = {
  say: "Say something",
  propose: "Propose a deal",
  send: "Send this deal",
  nothingMore: (bot: string) => `${bot} has nothing more to say this turn.`,
  quiet: (bot: string) => `${bot} doesn't chat. Deals only.`,
  joinUs: "Join us against…",
  peace: "Peace among us?",
  pickRival: "Against whom?",
  groupNothingMore: "The bots here have nothing more to say this turn.",
  offer: (bot: string) => `${bot}'s offer`,
  out: (bot: string) => `${bot} is out of the game.`,
} as const;

/** A bot's line comes with a deal ready to send: open the Deals panel on it (the asker only). */
function openDeal(p: ChatPropose) {
  const g = useGame.getState();
  g.openPropose(p.to, p.kind);
  const d = useGame.getState().deal;
  if (p.kind === "war" && p.target && d?.mode === "propose" && d.offer.terms.kind === "war") g.editDeal({ ...d.offer, terms: { ...d.offer.terms, target: p.target } });
  closeChat();
}

/**
 * Chat (session 28, design §13): a sidebar of your chats (bold when unread: the table first, then groups, then
 * one-to-one) and the selected chat filling the rest; on a phone, two screens in the bottom sheet (the list, then the
 * chat, with a back arrow). At the table screen, just the table chat. Players' messages are shown exactly as written,
 * as plain text (nothing is made a link).
 */

const MAX = 300;
/** One message every 2 s a person (the room drops faster ones). */
const GAP_MS = 2000;
const colour = (house: number) => HOUSES[house]?.color ?? "#d8cdb0";
const time = (at: number) => new Date(at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

function Lines({ chat }: { chat: string }) {
  const lines = useChat((s) => s.lines);
  const me = useGame((s) => s.view?.me.id);
  const mine = lines.filter((l) => l.chat === chat);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // (Session 34: not while a report or block form is open: it would move away under the reader's finger.)
    if (!formsOpen.n) end.current?.scrollIntoView({ block: "end" });
  }, [mine.length]);
  if (!mine.length) return <p className="muted small chat-empty">{CHAT_UI.empty}</p>;
  return (
    <div className="chat-lines" role="log" aria-live="polite">
      {mine.map((l: ChatLine, i) => {
        const same = i > 0 && mine[i - 1]!.from.name === l.from.name && l.at - mine[i - 1]!.at < 120_000;
        return (
          <div key={l.id} className={`chat-line ${l.from.you ? "you" : ""}`}>
            {!same && (
              <div className="chat-who">
                <b style={{ color: colour(l.from.house) }}>{l.from.you ? "You" : l.from.name}</b> <span className="muted">{time(l.at)}</span>
              </div>
            )}
            {/* Session 34: a person's line has Report and Block (hover on a desktop, a long press on a phone). */}
            <LineActions line={l}>
              <div className="chat-text">{l.text}</div>
            </LineActions>
            {l.ended && <div className="muted small chat-ended">{l.ended === "withdrawn" ? CHAT_UI.withdrawnBy(l.from.name, !!l.from.you) : CHAT_UI.ended[l.ended]}</div>}
            {l.propose && l.propose.for === me && (
              <button className="link small chat-deal" onClick={() => openDeal(l.propose!)}>
                {BOT_UI.send}
              </button>
            )}
          </div>
        );
      })}
      <div ref={end} />
    </div>
  );
}

function Composer({ chat }: { chat: string }) {
  const canWrite = useChat((s) => s.canWrite);
  const local = useChat((s) => !s.act);
  const [text, setText] = useState("");
  const [wait, setWait] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // (Session 29: single player's table is only bots, and they never read free text.)
  if (local) return <p className="muted small chat-left">{CHAT_UI.local}</p>;
  if (!canWrite) return <p className="muted small chat-left">{CHAT_UI.left}</p>;
  const send = async () => {
    const t = text.trim();
    if (!t || wait) return;
    setWait(true);
    setTimeout(() => setWait(false), GAP_MS);
    const why = await chatDo({ do: "send", chat, text: t });
    if (why) setProblem(why);
    else (setText(""), setProblem(null));
  };
  return (
    <div className="chat-compose">
      {problem && <p className="warn small">{problem}</p>}
      <div className="chat-compose-row">
        <textarea
          rows={2}
          maxLength={MAX}
          value={text}
          aria-label="Your message"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button className="primary" onClick={() => void send()} disabled={!text.trim() || wait}>
          Send
        </button>
      </div>
    </div>
  );
}

/**
 * Session 29: a one-to-one with a bot is multiple choice. Its offers to you (the same card as the Deals panel, one
 * answer in either place), "Say something" (three lines of yours; it answers two a turn), and Propose a deal.
 */
function BotChoices({ chat }: { chat: ChatView }) {
  const { ctx, view, offers, openPropose } = useGame();
  const [saying, setSaying] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const bot = botsIn(chat)[0];
  if (!bot?.seat || !ctx || !view) return null;
  // (A bot knocked out keeps its chat, to read: it says nothing more.)
  if (view.players.find((p) => p.id === bot.seat)?.eliminatedTurn != null) return <p className="muted small">{BOT_UI.out(bot.name)}</p>;
  const theirs = offers.filter((o) => o.from === bot.seat);
  const say = async (pick: number) => {
    setSaying(false);
    setProblem(await chatDo({ do: "say", chat: chat.id, pick }));
  };
  return (
    <div className="chat-bot">
      {theirs.map((o) => (
        <div key={o.id} className="chat-offer frame slim">
          <b className="small">{BOT_UI.offer(bot.name)}</b>
          <Incoming compact ctx={ctx} view={view} offer={o} onAnswered={(accept) => void chatDo({ do: "answered", chat: chat.id, offer: o.id, accept })} />
        </div>
      ))}
      {problem && <p className="warn small">{problem}</p>}
      {chat.quiet ? (
        <p className="muted small">{BOT_UI.quiet(bot.name)}</p>
      ) : chat.free === 0 ? (
        <p className="muted small">{BOT_UI.nothingMore(bot.name)}</p>
      ) : saying ? (
        <div className="chat-choices" role="group" aria-label={BOT_UI.say}>
          {(chat.say ?? []).map((line, i) => (
            <button key={i} className="chat-choice" onClick={() => void say(i)}>
              {line}
            </button>
          ))}
        </div>
      ) : null}
      <div className="chat-choice-row">
        {!chat.quiet && chat.free !== 0 && !saying && <button onClick={() => setSaying(true)}>{BOT_UI.say}</button>}
        <button
          onClick={() => {
            openPropose(bot.seat!);
            closeChat();
          }}
        >
          {BOT_UI.propose}
        </button>
      </div>
    </div>
  );
}

/** Session 29: a group with bots in it: two prompts the bots answer (people read and write as before). */
function GroupAsk({ chat }: { chat: ChatView }) {
  const view = useGame((s) => s.view);
  const [picking, setPicking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  if (!view) return null;
  const inChat = new Set((chat.members ?? []).flatMap((p) => (p.seat ? [p.seat] : [])));
  const rivals = view.players.filter((p) => p.eliminatedTurn === null && p.id !== view.me.id && !inChat.has(p.id));
  const ask = async (a: { ask: "war" | "peace"; target?: string }) => {
    setPicking(false);
    setProblem(await chatDo({ do: "ask", chat: chat.id, ...a }));
  };
  if (chat.free === 0) return <p className="muted small">{BOT_UI.groupNothingMore}</p>;
  return (
    <div className="chat-bot">
      {problem && <p className="warn small">{problem}</p>}
      {picking ? (
        <div className="chat-choices" role="group" aria-label={BOT_UI.pickRival}>
          {rivals.map((p) => (
            <button key={p.id} className="chat-choice" onClick={() => void ask({ ask: "war", target: p.id })}>
              <span style={{ color: colour(p.house) }}>{p.name}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="chat-choice-row">
          {rivals.length > 0 && <button onClick={() => setPicking(true)}>{BOT_UI.joinUs}</button>}
          <button onClick={() => void ask({ ask: "peace" })}>{BOT_UI.peace}</button>
        </div>
      )}
    </div>
  );
}

/** Pick people (and, session 29, bots) at the table (tick boxes): a new group, or more for one. */
function PickPeople({ exclude, done, label }: { exclude: readonly string[]; done(seats: string[], name?: string): Promise<string | null>; label: string }) {
  const { view, people, leftSeats } = useGame();
  const [picked, setPicked] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  if (!view) return null;
  // (Bots too, session 29: they answer a group's prompts in their own voices.)
  const bots = view.players.filter((p) => p.eliminatedTurn === null && !people?.includes(p.id) && p.id !== view.me.id).map((p) => p.id);
  const others = [...(people ?? []), ...bots].filter((id) => id !== view.me.id && !exclude.includes(id) && !leftSeats?.[id]);
  const nameOf = (id: string) => view.players.find((p) => p.id === id)?.name ?? id;
  return (
    <div className="chat-pick">
      <p className="muted small">{CHAT_UI.groupHelp}</p>
      {others.length === 0 && <p className="small">Nobody else at the table can join it.</p>}
      {others.map((id) => (
        <label key={id} className="chat-tick">
          <input type="checkbox" checked={picked.includes(id)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, id] : p.filter((x) => x !== id)))} />
          <span style={{ color: colour(view.players.find((p) => p.id === id)?.house ?? 0) }}>{nameOf(id)}</span>
        </label>
      ))}
      {label === CHAT_UI.newGroup && (
        <label className="chat-name-field">
          <span className="muted small">A name (optional)</span>
          <input type="text" maxLength={24} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
      )}
      {problem && <p className="warn small">{problem}</p>}
      <button className="primary" disabled={!picked.length} onClick={() => void done(picked, name.trim() || undefined).then(setProblem)}>
        {label}
      </button>
    </div>
  );
}

/** A group's own controls: rename it, add people. */
function GroupTools({ chat }: { chat: ChatView }) {
  const [mode, setMode] = useState<"rename" | "add" | null>(null);
  const [name, setName] = useState(chat.name ?? "");
  const members = (chat.members ?? []).flatMap((p) => (p.seat ? [p.seat] : []));
  return (
    <div className="chat-tools">
      <p className="small muted">{(chat.members ?? []).map((p) => (p.you ? "You" : p.name)).join(", ")}</p>
      <div className="chat-tool-btns">
        <button className="link small" onClick={() => setMode(mode === "rename" ? null : "rename")}>
          Rename
        </button>
        <button className="link small" onClick={() => setMode(mode === "add" ? null : "add")}>
          Add people
        </button>
      </div>
      {mode === "rename" && (
        <div className="chat-compose-row">
          <input type="text" maxLength={24} value={name} aria-label="The group's name" onChange={(e) => setName(e.target.value)} />
          <button onClick={() => void chatDo({ do: "rename", chat: chat.id, name }).then(() => setMode(null))}>Save</button>
        </div>
      )}
      {mode === "add" && (
        <PickPeople
          exclude={members}
          label="Add them"
          done={async (seats) => {
            const why = await chatDo({ do: "add", chat: chat.id, with: seats });
            if (!why) setMode(null);
            return why;
          }}
        />
      )}
    </div>
  );
}

function ChatList({ onPick }: { onPick(id: string): void }) {
  const { chats, lines, read, selected } = useChat();
  const online = useGame((s) => !!s.online && !!s.view);
  const council = useCouncilUnread();
  return (
    <nav className="chat-list" aria-label="Your chats">
      {/* Session 29: your council first (only you have it). */}
      <button className={`chat-item ${council ? "unread" : ""} ${selected === COUNCIL_ID ? "on" : ""}`} onClick={() => onPick(COUNCIL_ID)} aria-label={council ? `${COUNCIL_CHAT.name}, ${council} unread` : COUNCIL_CHAT.name}>
        <span className="chat-item-name">{COUNCIL_CHAT.name}</span>
        {council > 0 && <span className="chat-badge">{council}</span>}
      </button>
      {ordered(chats).map((c) => {
        const n = unreadIn({ lines, read }, c.id);
        return (
          <button key={c.id} className={`chat-item ${n ? "unread" : ""} ${selected === c.id ? "on" : ""}`} onClick={() => onPick(c.id)} aria-label={n ? `${chatName(c)}, ${n} unread` : chatName(c)}>
            <span className="chat-item-name">{chatName(c)}</span>
            {n > 0 && <span className="chat-badge">{n}</span>}
          </button>
        );
      })}
      {chats.length === 0 && <p className="muted small">{CHAT_UI.noChats}</p>}
      {online && (
        <button className="link small chat-new" onClick={() => useChat.setState({ grouping: true, selected: null })}>
          {CHAT_UI.newGroup}…
        </button>
      )}
    </nav>
  );
}

function Selected({ id, onBack }: { id: string; onBack?: () => void }) {
  const chat = useChat((s) => s.chats.find((c) => c.id === id));
  useEffect(() => {
    markRead(id);
  });
  if (id === COUNCIL_ID)
    return (
      <section className="chat-main">
        <header className="chat-head">
          {onBack && (
            <button className="link chat-back" onClick={onBack} aria-label="Back to your chats">
              ‹
            </button>
          )}
          <b>{COUNCIL_CHAT.name}</b>
        </header>
        <CouncilChat />
      </section>
    );
  if (!chat) return null;
  return (
    <section className="chat-main">
      <header className="chat-head">
        {onBack && (
          <button className="link chat-back" onClick={onBack} aria-label="Back to your chats">
            ‹
          </button>
        )}
        <b>{chatName(chat)}</b>
      </header>
      {chat.kind === "group" && <GroupTools chat={chat} />}
      <Lines chat={id} />
      {chat.kind === "pair" && botsIn(chat).length ? <BotChoices chat={chat} /> : <Composer chat={id} />}
      {chat.kind === "group" && botsIn(chat).length > 0 && <GroupAsk chat={chat} />}
    </section>
  );
}

function Grouping() {
  return (
    <section className="chat-main">
      <header className="chat-head">
        <button className="link chat-back" onClick={() => useChat.setState({ grouping: false })} aria-label="Back to your chats">
          ‹
        </button>
        <b>{CHAT_UI.newGroup}</b>
      </header>
      <PickPeople
        exclude={[]}
        label={CHAT_UI.newGroup}
        done={async (seats, name) => {
          const act = useChat.getState().act;
          if (!act) return "Chat isn't open.";
          try {
            const sync = await act({ do: "group", with: seats, ...(name ? { name } : {}) });
            applyChat(sync);
            if (sync.chats[0]) openChat(sync.chats[0].id);
            return null;
          } catch (e) {
            return e instanceof Error ? e.message : String(e);
          }
        }}
      />
    </section>
  );
}

/** The chat panel: desktop (a popover), a phone's sheet (two screens), or the table screen's table chat. */
export default function ChatPanel({ mode }: { mode: "desktop" | "phone" | "table" }) {
  const { selected, grouping } = useChat();
  const count = useChat((s) => s.lines.length);
  // At the table screen the table chat is on screen: what comes in is read there (no pop-up waits for the game).
  useEffect(() => {
    if (mode !== "table") return;
    markRead("table");
    if (useChat.getState().popup) useChat.setState({ popup: null });
  }, [mode, count]);
  if (mode === "table")
    return (
      <div className="chat-panel chat-table">
        <Lines chat="table" />
        <Composer chat="table" />
      </div>
    );
  const pick = (id: string) => openChat(id);
  if (mode === "phone")
    return <div className="chat-panel chat-phone">{grouping ? <Grouping /> : selected ? <Selected id={selected} onBack={() => useChat.setState({ selected: null })} /> : <ChatList onPick={pick} />}</div>;
  return (
    <Frame className="popover chat-panel chat-desktop" title="Chat" extra={<button className="link" onClick={closeChat}>Close</button>}>
      <div className="chat-grid">
        <ChatList onPick={pick} />
        {grouping ? <Grouping /> : selected ? <Selected id={selected} /> : <p className="muted small chat-empty">Pick a chat on the left.</p>}
      </div>
    </Frame>
  );
}
