import { useState } from "react";
import { desktopSiteZoom } from "../logic/layout";
import { useScreenFacts } from "./useLayout";

const KEY = "conquerra.desktopSiteTip";

const dismissed = () => {
  try {
    return localStorage.getItem(KEY) === "dismissed";
  } catch {
    return false;
  }
};

/**
 * A one-line tip when Chrome's "Desktop site" setting is on (a phone drawing a page much wider than its screen, so
 * everything looks small). Shown in the lobby and the game; dismissing it is remembered on this device. The game
 * doesn't try to rescale itself, but the tip's own text is drawn big enough to read at that shrunken size.
 */
export function DesktopSiteTip() {
  const facts = useScreenFacts();
  const [gone, setGone] = useState(dismissed);
  const zoom = desktopSiteZoom(facts);
  if (!zoom || gone) return null;
  const close = () => {
    try {
      localStorage.setItem(KEY, "dismissed");
    } catch {
      // Private browsing: it just comes back next time.
    }
    setGone(true);
  };
  return (
    <div className="desktop-site-tip" role="status" style={{ fontSize: `${Math.round(14 * zoom)}px` }}>
      <span>Chrome's Desktop site is on, so everything looks small. To fix it, tap ⋮ and untick Desktop site.</span>
      <button onClick={close} aria-label="Dismiss this tip">
        ×
      </button>
    </div>
  );
}
