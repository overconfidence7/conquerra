import { useState } from "react";
import { Frame } from "./Frame";
import { BUILD, useDiagnostics } from "./VersionLine";
import { checkForUpdate, useUpdates } from "./UpdatePrompt";
import { useLayout } from "./useLayout";
import { desktopSiteZoom } from "../logic/layout";

export { BUILD, VersionLine, useDiagnostics } from "./VersionLine";

const ago = (t: number | null) => (t === null ? "not yet" : `${Math.max(0, Math.round((Date.now() - t) / 1000))} s ago`);

/** What the phone reports, and which layout that gave. Nate reads these out (or taps Copy) to find layout problems. */
export function Diagnostics() {
  const open = useDiagnostics((s) => s.open);
  const close = useDiagnostics((s) => s.setOpen);
  const { layout, why, facts, choice } = useLayout();
  const { reg, apply, lastCheck } = useUpdates();
  const [copied, setCopied] = useState(false);
  const [, refresh] = useState(0);
  if (!open) return null;
  const sw = !("serviceWorker" in navigator) ? "not supported" : navigator.serviceWorker.controller ? (reg?.waiting || apply ? "running · new version waiting" : "running") : "not running yet";
  const rows: [string, string][] = [
    ["Layout chosen", `${layout === "phone" ? "Phone" : "Desktop"} (because ${why})`],
    ["Layout setting", choice === "auto" ? "Auto" : choice === "phone" ? "Phone" : "Desktop"],
    ["Chrome's Desktop site", desktopSiteZoom(facts) ? `looks on (page ${desktopSiteZoom(facts).toFixed(1)}× wider than the screen)` : "looks off"],
    ["Page (innerWidth × innerHeight)", `${facts.innerWidth} × ${facts.innerHeight}`],
    ["Screen (screen.width × height)", `${facts.screenWidth} × ${facts.screenHeight}`],
    ["devicePixelRatio", String(Math.round(facts.devicePixelRatio * 100) / 100)],
    ["display-mode", facts.standalone ? "standalone (installed app)" : "browser"],
    ["pointer", facts.coarse ? "coarse (finger)" : "fine (mouse)"],
    ["Phone user agent", facts.mobileAgent ? "yes" : "no (Desktop site?)"],
    ["Orientation", facts.innerWidth > facts.innerHeight ? "landscape" : "portrait"],
    ["Version", BUILD],
    ["Offline cache", sw],
    ["Last update check", ago(lastCheck)],
    ["User agent", navigator.userAgent],
  ];
  const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n");
  return (
    <div className="overlay diagnostics" onClick={(e) => e.target === e.currentTarget && close(false)}>
      <Frame className="dialog" role="dialog" label="Layout diagnostics" title="Layout diagnostics" extra={<button className="link" onClick={() => close(false)}>Close</button>}>
        <dl className="diag">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <div className="row">
          <button
            className="primary"
            onClick={() =>
              void navigator.clipboard?.writeText(text).then(
                () => setCopied(true),
                () => setCopied(false),
              )
            }
          >
            {copied ? "Copied" : "Copy all"}
          </button>
          <button onClick={() => void checkForUpdate().then(() => refresh((n) => n + 1))}>Check for update</button>
        </div>
      </Frame>
    </div>
  );
}
