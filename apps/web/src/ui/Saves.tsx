import { useEffect, useRef, useState } from "react";
import { SLOTS, type SlotId } from "../host/saves";
import { emptyAutosaveLine, lastFinished, savedWhen, slotLine } from "./saveText";
import { useGame } from "../store";
import { BUILD } from "./Diagnostics";
import { Frame } from "./Frame";

const slotName = (slot: SlotId) => (slot === "auto" ? "Autosave" : `Slot ${SLOTS.indexOf(slot) + 1}`);

/** "Save to a file": the save, downloaded (it also plays back with `pnpm sim --replay` for a bug report). */
async function downloadSave() {
  const { host, view } = useGame.getState();
  if (!host || !view) return;
  const save = await host.exportSave({ app: BUILD });
  const url = URL.createObjectURL(new Blob([JSON.stringify(save)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `conquerra-${save.mapId}-turn${save.state.turn}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Save game / Load game: the autosave (Continue) and three slots on this device, each with its map, players, turn and
 * date, plus Save to a file / Load a file. Loaded only when first opened.
 */
export default function SavesDialog({ mode, inGame, onClose }: { mode: "save" | "load"; inGame: boolean; onClose(): void }) {
  const { slots, slotProblem, refreshSlots, saveToSlot, load, busy, error } = useGame();
  const [done, setDone] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    void refreshSlots();
    useGame.setState({ error: null });
  }, [refreshSlots]);
  const bySlot = new Map(slots.map((s) => [s.slot, s]));
  const shown: SlotId[] = mode === "load" ? ["auto", ...SLOTS] : [...SLOTS];
  const afterLoad = (ok: boolean) => ok && onClose();

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <Frame className="dialog saves" role="dialog" label={mode === "save" ? "Save game" : "Load game"} title={mode === "save" ? "Save game" : "Load game"} extra={<button className="link" onClick={onClose}>Close</button>}>
        {slotProblem ? <p className="warn">{slotProblem}</p> : null}
        <ul className="slots">
          {shown.map((slot) => {
            const info = bySlot.get(slot);
            return (
              <li key={slot} className={`slot ${info ? "" : "empty"}`}>
                <div className="slot-text">
                  <b>{slotName(slot)}</b>
                  <span className="small">{info ? slotLine(info) : slot === "auto" ? emptyAutosaveLine(lastFinished()) : "Empty"}</span>
                  {info && <span className="small muted">{savedWhen(info.savedAt)}</span>}
                </div>
                {mode === "save" ? (
                  <button
                    className={info ? "" : "primary"}
                    disabled={busy || !!slotProblem}
                    onClick={async () => {
                      if (await saveToSlot(slot)) setDone(`Saved in ${slotName(slot)}.`);
                    }}
                  >
                    {info ? "Replace" : "Save here"}
                  </button>
                ) : (
                  <button className="primary" disabled={busy || !info} onClick={async () => afterLoad(await load({ slot }))}>
                    Load
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        {done && <p className="good small" role="status">{done}</p>}
        {error && <p className="warn">{error}</p>}
        <hr className="rule" />
        {mode === "save" ? (
          <button className="menu-item stacked" onClick={() => void downloadSave()}>
            Save to a file <span className="muted">to keep it, move it, or send it with a bug report</span>
          </button>
        ) : (
          <>
            <button className="menu-item stacked" onClick={() => file.current?.click()} disabled={busy}>
              Load a file <span className="muted">a game you saved to a file</span>
            </button>
            <input
              ref={file}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) afterLoad(await load({ file: await f.text() }));
              }}
            />
            {inGame && <p className="muted small">Loading leaves this game. Save it to a slot first if you want to come back to it.</p>}
          </>
        )}
        <p className="muted small">Saved games stay on this device. They're never sent anywhere.</p>
      </Frame>
    </div>
  );
}
