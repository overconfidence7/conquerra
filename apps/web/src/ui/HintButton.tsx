import { useEffect, useRef, useState, type ReactNode } from "react";

/** How long a finger must rest on the button before its explanation shows (ms). */
const HOLD_MS = 450;

/**
 * A plain button with a fuller explanation: shown on hover on a desktop (the browser's tooltip), and on a long press
 * on a phone (a small note under the button, until the next tap anywhere). A long press never counts as a tap.
 */
export function HintButton({ hint, className, onClick, children, ...rest }: { hint: string; className?: string; onClick: () => void; children: ReactNode; "aria-pressed"?: boolean; disabled?: boolean }) {
  const [shown, setShown] = useState(false);
  const timer = useRef<number | null>(null);
  const held = useRef(false);
  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => {
    if (!shown) return;
    const hide = () => setShown(false);
    // The next tap anywhere hides it (after this press has finished).
    const t = window.setTimeout(() => document.addEventListener("pointerdown", hide, { once: true }), 0);
    return () => (window.clearTimeout(t), document.removeEventListener("pointerdown", hide));
  }, [shown]);
  useEffect(() => clear, []);
  return (
    <span className="hint-wrap">
      <button
        {...rest}
        className={className}
        title={hint}
        onPointerDown={(e) => {
          held.current = false;
          if (e.pointerType === "mouse") return;
          clear();
          timer.current = window.setTimeout(() => ((held.current = true), setShown(true)), HOLD_MS);
        }}
        onPointerUp={clear}
        onPointerLeave={clear}
        onPointerCancel={clear}
        onContextMenu={(e) => e.preventDefault()}
        onClick={() => {
          if (held.current) return void (held.current = false);
          onClick();
        }}
      >
        {children}
      </button>
      {shown && (
        <span className="hint-note" role="tooltip">
          {hint}
        </span>
      )}
    </span>
  );
}
