import { useEffect, useRef, useState } from "react";
import type { ChatLine, ChatView } from "../../host/protocol";
import { HOUSES } from "../../map/houses";
import { useGame } from "../../store";
import { Frame } from "../Frame";
import { applyChat, CHAT_UI, chatDo, chatName, closeChat, markRead, openChat, ordered, unreadIn, useChat } from "./chatStore";
import "./chat.css";

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
  const mine = lines.filter((l) => l.chat === chat);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
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
            <div className="chat-text">{l.text}</div>
          </div>
        );
      })}
      <div ref={end} />
    </div>
  );
}

function Composer({ chat }: { chat: string }) {
  const canWrite = useChat((s) => s.canWrite);
  const [text, setText] = useState("");
  const [wait, setWait] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
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

/** Pick people at the table (tick boxes): a new group, or more people for one. */
function PickPeople({ exclude, done, label }: { exclude: readonly string[]; done(seats: string[], name?: string): Promise<string | null>; label: string }) {
  const { view, people, leftSeats } = useGame();
  const [picked, setPicked] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  if (!view) return null;
  const others = (people ?? []).filter((id) => id !== view.me.id && !exclude.includes(id) && !leftSeats?.[id]);
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
  return (
    <nav className="chat-list" aria-label="Your chats">
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
      <Composer chat={id} />
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
