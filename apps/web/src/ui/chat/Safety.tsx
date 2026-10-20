import { useEffect, useRef, useState } from "react";
import { api } from "../../host/remoteHost";
import type { PlayerId } from "@conquerra/engine";
import { REPORT_REASONS, type ChatLine, type ReportReason } from "../../host/protocol";
import { SAFETY_LIMITS, SAFETY_TEXT } from "../../host/safetyText";
import { showNotice } from "../../store";
import { chatDo } from "./chatStore";

/**
 * Session 34, abuse limits on the page (loaded with the game or the table, never the lobby): a person's chat line has
 * Report and Block (a small button on hover on a desktop, a long press on a phone), the Houses panel has Block on each
 * person, and Settings online lists the people you blocked. The room does the work: it reports the line as it has it,
 * and filters a blocked person's lines out before anything reaches this page.
 */

/** How many report or block forms are open (the chat holds its scroll while any is). */
export const formsOpen = { n: 0 };

/** A line someone else (a person, not a bot) wrote: the only kind with Report and Block. */
export const reportable = (l: ChatLine) => !l.from.you && !l.from.bot;

/** Block a person, by their seat or one of their lines (asks first, in the voice); `onDone` gets the line to show after. */
export function BlockButton({ seat, line, name, onDone, ask = false }: { seat?: PlayerId; line?: number; name: string; onDone?: (said: string) => void; ask?: boolean }) {
  const [asking, setAsking] = useState(ask);
  const [said, setSaid] = useState<string | null>(null);
  if (said) return <p className="small muted">{said}</p>;
  if (!asking)
    return (
      <button className="link small" onClick={() => setAsking(true)}>
        {SAFETY_TEXT.block}
      </button>
    );
  return (
    <div className="safety-ask">
      <p className="small">{SAFETY_TEXT.blockAsk(name)}</p>
      <div className="safety-buttons">
        <button
          className="small"
          onClick={async () => {
            const why = await chatDo({ do: "block", ...(line !== undefined ? { line } : { seat }) });
            const after = why ?? SAFETY_TEXT.blocked(name);
            setSaid(after);
            onDone?.(after);
            // (Blocked from a line, the line itself leaves the page: the game's quiet notice says it.)
            if (!why) showNotice(after, true);
          }}
        >
          {SAFETY_TEXT.block}
        </button>
        <button className="link small" onClick={() => setAsking(false)}>
          {SAFETY_TEXT.cancel}
        </button>
      </div>
    </div>
  );
}

/** Report a line: one reason, a line of your own words if you like, then "Reported. Nate reads these." */
export function ReportForm({ line, onClose }: { line: ChatLine; onClose: (said?: string) => void }) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [words, setWords] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const send = async () => {
    if (!reason) return setProblem(SAFETY_TEXT.pickReason);
    setBusy(true);
    const why = await chatDo({ do: "report", line: line.id, reason, ...(words.trim() ? { words: words.trim() } : {}) });
    setBusy(false);
    if (why) setProblem(why);
    else onClose(SAFETY_TEXT.reported);
  };
  return (
    <div className="safety-form" role="group" aria-label={SAFETY_TEXT.reportTitle}>
      <b className="small">{SAFETY_TEXT.reportTitle}</b>
      <span className="small muted">{SAFETY_TEXT.reportWhy}</span>
      <div className="safety-reasons" role="radiogroup">
        {REPORT_REASONS.map((r) => (
          <label key={r} className="check small">
            <input type="radio" name={`why-${line.id}`} checked={reason === r} onChange={() => (setReason(r), setProblem(null))} />
            {SAFETY_TEXT.reasons[r]}
          </label>
        ))}
      </div>
      <input className="name-input" maxLength={SAFETY_LIMITS.reportWords} placeholder={SAFETY_TEXT.reportWords} aria-label={SAFETY_TEXT.reportWords} value={words} onChange={(e) => setWords(e.target.value)} />
      {problem && <p className="warn small">{problem}</p>}
      <div className="safety-buttons">
        <button className="small primary" disabled={busy} onClick={() => void send()}>
          {SAFETY_TEXT.send}
        </button>
        <button className="link small" onClick={() => onClose()}>
          {SAFETY_TEXT.cancel}
        </button>
      </div>
    </div>
  );
}

/**
 * A person's line, with its Report and Block: the "⋯" button shows on hover (a desktop), and a long press opens the
 * same menu (a phone). What it says after (reported, blocked) stays under the line.
 */
export function LineActions({ line, children }: { line: ChatLine; children: React.ReactNode }) {
  const [menu, setMenu] = useState<"menu" | "report" | "block" | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const press = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (press.current && clearTimeout(press.current)), []);
  // While a menu or a form is open, new lines don't scroll the chat out from under it.
  useEffect(() => {
    if (!menu) return;
    formsOpen.n++;
    return () => void formsOpen.n--;
  }, [menu]);
  if (!reportable(line)) return <>{children}</>;
  const hold = () => (press.current = setTimeout(() => setMenu("menu"), 500));
  const let_go = () => press.current && (clearTimeout(press.current), (press.current = null));
  return (
    <div className="chat-line-acts" onPointerDown={(e) => e.pointerType === "touch" && hold()} onPointerUp={let_go} onPointerLeave={let_go} onPointerCancel={let_go} onContextMenu={(e) => menu === "menu" && e.preventDefault()}>
      {children}
      <button className="chat-more" aria-label={`Report or block ${line.from.name}`} title={`${SAFETY_TEXT.report} or ${SAFETY_TEXT.block.toLowerCase()}`} onClick={() => setMenu(menu ? null : "menu")}>
        ⋯
      </button>
      {menu === "menu" && (
        <div className="chat-menu">
          <button className="link small" onClick={() => setMenu("report")}>
            {SAFETY_TEXT.report}
          </button>
          <button className="link small" onClick={() => setMenu("block")}>
            {SAFETY_TEXT.block} {line.from.name}
          </button>
          <button className="link small muted" onClick={() => setMenu(null)}>
            {SAFETY_TEXT.cancel}
          </button>
        </div>
      )}
      {menu === "report" && <ReportForm line={line} onClose={(s) => (setMenu(null), s && setSaid(s))} />}
      {menu === "block" && <BlockButton line={line.id} name={line.from.name} ask />}
      {said && <p className="small muted">{said}</p>}
    </div>
  );
}

/** Settings online: the people you blocked (by the name they had), each with Unblock. */
export function BlockedPlayers() {
  const [list, setList] = useState<{ id: number; name: string }[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const load = () =>
    api<{ blocks: { id: number; name: string }[] }>("/api/blocks").then(
      (r) => setList(r.blocks),
      (e: unknown) => setProblem(e instanceof Error ? e.message : String(e)),
    );
  useEffect(() => void load(), []);
  return (
    <div className="blocked-players">
      <span className="field-name">{SAFETY_TEXT.blockedTitle}</span>
      {problem && <p className="warn small">{problem}</p>}
      {list && !list.length && <p className="small muted">{SAFETY_TEXT.noneBlocked}</p>}
      {list?.map((b) => (
        <div key={b.id} className="blocked-row">
          <span>{b.name}</span>
          <button className="link small" onClick={() => void api(`/api/blocks/${b.id}`, { method: "DELETE" }).then(load, (e: unknown) => setProblem(e instanceof Error ? e.message : String(e)))}>
            {SAFETY_TEXT.unblock}
          </button>
        </div>
      ))}
    </div>
  );
}

