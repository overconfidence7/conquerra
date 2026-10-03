import { useRef, useState, type ReactNode } from "react";
import { Frame } from "./Frame";

export type SheetSize = "closed" | "half" | "full";

/** Heights as a share of the screen, above the action bar. */
const HEIGHT: Record<SheetSize, number> = { closed: 0, half: 0.46, full: 0.86 };

/**
 * The phone's bottom sheet: panels open here, and you drag the handle between half and full height (drag it down
 * to close). Sits just above the action bar.
 */
export function BottomSheet({ size, onSize, bottom, tabs, tab, onTab, children }: { size: SheetSize; onSize(s: SheetSize): void; bottom: number; tabs: { id: string; label: string }[]; tab: string; onTab(id: string): void; children: ReactNode }) {
  const [drag, setDrag] = useState<number | null>(null);
  const start = useRef<{ y: number; h: number } | null>(null);
  if (size === "closed" && drag === null) return null;
  const vh = window.innerHeight;
  const height = drag ?? HEIGHT[size] * vh;

  const down = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    start.current = { y: e.clientY, h: height };
    setDrag(height);
  };
  const move = (e: React.PointerEvent) => {
    if (!start.current) return;
    setDrag(Math.max(40, Math.min(vh * 0.92, start.current.h + (start.current.y - e.clientY))));
  };
  const up = (e: React.PointerEvent) => {
    if (!start.current) return;
    const moved = Math.abs(e.clientY - start.current.y);
    const h = drag ?? height;
    start.current = null;
    setDrag(null);
    // A tap on the handle toggles between half and full.
    if (moved < 6) return onSize(size === "full" ? "half" : "full");
    const share = h / vh;
    onSize(share < 0.25 ? "closed" : share < 0.66 ? "half" : "full");
  };

  return (
    <Frame className={`sheet ${drag !== null ? "dragging" : ""}`} style={{ height, bottom }} role="dialog" label="Panel">
      <div className="sheet-handle" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-label="Drag to resize">
        <i />
      </div>
      <div className="sheet-tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? "on" : ""} onClick={() => onTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="sheet-body">{children}</div>
    </Frame>
  );
}
