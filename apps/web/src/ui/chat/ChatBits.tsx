import { useEffect, useState } from "react";
import { HOUSES } from "../../map/houses";
import { closeChat, openChat, unreadAll, useChat } from "./chatStore";
import "./chat.css";

/**
 * Chat's small pieces on the game screen (session 28): the top bar's button with its unread count, and the pop-up for
 * a message that comes in while the panel is closed. No new taps for a turn with chat ignored: nothing opens by
 * itself except the pop-up, which goes on its own.
 */

/** How long the pop-up stays (ms). */
export const POPUP_MS = 6000;

/** Which chat the button opens: on a phone the list; on a desktop the chat with the newest unread message (or the last one). */
function firstChat(phone: boolean): string | null {
  if (phone) return null;
  const s = useChat.getState();
  const unread = s.lines.filter((l) => !l.from.you && l.id > (s.read[l.chat] ?? 0)).at(-1);
  return unread?.chat ?? s.selected ?? "table";
}

export function ChatButton({ phone }: { phone: boolean }) {
  const unread = useChat(unreadAll);
  const open = useChat((s) => s.open);
  return (
    <button className={`chat-btn ${open ? "on" : ""}`} onClick={() => (open ? closeChat() : openChat(firstChat(phone)))} aria-label={unread ? `Chat, ${unread} unread` : "Chat"} aria-pressed={open} title="Chat with the table">
      <span aria-hidden>💬</span>
      {unread > 0 && <span className="chat-badge">{unread > 99 ? "99+" : unread}</span>}
    </button>
  );
}

/** Who and the first words; tap to open that chat; gone by itself in 6 s; never during the replay (it waits). */
export function ChatPopup({ replaying, top }: { replaying: boolean; top: number }) {
  const popup = useChat((s) => s.popup);
  const open = useChat((s) => s.open);
  const [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    if (!popup || replaying || open) return;
    setShown(popup.id);
    const t = setTimeout(() => useChat.getState().popup?.id === popup.id && useChat.setState({ popup: null }), POPUP_MS);
    return () => clearTimeout(t);
  }, [popup, replaying, open]);
  if (!popup || replaying || open || shown !== popup.id) return null;
  const words = popup.text.length > 60 ? `${popup.text.slice(0, 60).trimEnd()}…` : popup.text;
  return (
    <div className="chat-popup" style={{ top }}>
      <button className="frame slim toast quiet" style={{ borderLeftColor: HOUSES[popup.from.house]?.color }} onClick={() => openChat(popup.chat)}>
        <b>{popup.from.name}:</b> {words}
      </button>
    </div>
  );
}
