/**
 * Keys (session 20, Nate): with an attack, move or path box open, **Enter** confirms it exactly as shown and **Esc**
 * cancels it; the buttons stay for changing anything first. Never while you're typing (a name, an exact amount), never
 * with a modifier held (Ctrl+Enter and the like are the browser's), and never inside a command menu (there Enter picks
 * the highlighted command). Pure: the page's listener asks this, then does what the buttons do.
 */
export interface KeyLike {
  key: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  isComposing?: boolean;
  repeat?: boolean;
  /** Where focus is (the event's target): a text field keeps its Enter. */
  target?: { tagName?: string; isContentEditable?: boolean; closest?: (selector: string) => unknown } | null;
}

export type KeyIntent = "confirm" | "cancel";

/** Fields that keep Enter and Esc for themselves. */
const TYPING = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export function keyIntent(e: KeyLike): KeyIntent | null {
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.isComposing || e.repeat) return null;
  const t = e.target;
  if (t && ((t.tagName && TYPING.has(t.tagName.toUpperCase())) || t.isContentEditable)) return null;
  if (t?.closest?.('[role="menu"]')) return null;
  if (e.key === "Enter") return "confirm";
  if (e.key === "Escape" || e.key === "Esc") return "cancel";
  return null;
}
