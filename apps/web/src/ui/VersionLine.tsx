import { useRef } from "react";
import { create } from "zustand";

export const BUILD = typeof __BUILD__ === "string" ? __BUILD__ : "dev";

/** The hidden diagnostics view: open with ?debug=layout, or by tapping the version line 5 times. */
export const useDiagnostics = create<{ open: boolean; setOpen(open: boolean): void }>((set) => ({
  open: new URLSearchParams(location.search).get("debug") === "layout",
  setOpen: (open) => set({ open }),
}));

/** "Version 0.1.0 · 4 Oct · 8b6d540". Five quick taps open the diagnostics view (session 28: it loads only then). */
export function VersionLine() {
  const taps = useRef<number[]>([]);
  const open = useDiagnostics((s) => s.setOpen);
  return (
    <button
      className="link small muted version-line"
      onClick={() => {
        const now = Date.now();
        taps.current = [...taps.current.filter((t) => now - t < 3000), now];
        if (taps.current.length >= 5) {
          taps.current = [];
          open(true);
        }
      }}
    >
      Version {BUILD}
    </button>
  );
}
