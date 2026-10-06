import type { GameContext, PlayerView, TerritoryId } from "@conquerra/engine";
import { useMemo, useState } from "react";
import { chronicleLines, type ChronicleKind } from "../logic/chronicle";
import { namer } from "../logic/text";
import { useGame } from "../store";
import { Frame } from "./Frame";

const KIND_ICON: Record<ChronicleKind, string> = { battle: "⚔", fate: "✦", fallen: "☠", deal: "🤝", spy: "🕵", leader: "👑", other: "•" };
const KIND_NAME: Record<ChronicleKind, string> = { battle: "Battle", fate: "Fate", fallen: "The Fallen", deal: "Deal", spy: "Spy", leader: "Your leaders", other: "News" };

/**
 * The Chronicle (session 16): every turn so far, newest first, so nothing that touched you can be missed. Only what
 * you were allowed to see (it's built from your own turn reports). Tap a line to see the place on the map. Loaded the
 * first time it's opened.
 */
export default function ChronicleSheet({ ctx, view, onClose, onShow }: { ctx: GameContext; view: PlayerView; onClose(): void; onShow(at: TerritoryId): void }) {
  const reports = useGame((s) => s.chronicle);
  const [onlyYours, setOnlyYours] = useState(false);
  const turns = useMemo(() => chronicleLines(ctx, reports, namer(ctx, view)), [ctx, reports, view]);
  const shown = onlyYours ? turns.map((t) => ({ ...t, lines: t.lines.filter((l) => l.mine) })).filter((t) => t.lines.length) : turns;
  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <Frame className="dialog chronicle" role="dialog" label="Chronicle" title="Chronicle" extra={<button className="link" onClick={onClose}>Close</button>}>
        <div className="chips" role="radiogroup" aria-label="What to show">
          <button role="radio" aria-checked={!onlyYours} className={`chip ${!onlyYours ? "on" : ""}`} onClick={() => setOnlyYours(false)}>
            Everything you saw
          </button>
          <button role="radio" aria-checked={onlyYours} className={`chip ${onlyYours ? "on" : ""}`} onClick={() => setOnlyYours(true)}>
            What touched you
          </button>
        </div>
        <div className="scroll">
          {shown.length === 0 && <p className="muted">Nothing yet. After each turn, the battles you saw, Fate and the Fallen, deals, your spies' news and your leaders' work are written here.</p>}
          {shown.map((t) => (
            <section key={t.turn}>
              <h3>Turn {t.turn}</h3>
              <ul className="chronicle-lines">
                {t.lines.map((l, i) => (
                  <li key={i} className={`${l.tone} ${l.mine ? "mine" : ""}`}>
                    <button className="chronicle-line" disabled={!l.at} onClick={() => l.at && onShow(l.at)} title={l.at ? "Show it on the map" : undefined}>
                      <span className="kind" aria-label={KIND_NAME[l.kind]} title={KIND_NAME[l.kind]}>
                        {KIND_ICON[l.kind]}
                      </span>
                      <span>{l.text}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </Frame>
    </div>
  );
}
