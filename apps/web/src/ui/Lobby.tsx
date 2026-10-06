import { mapCatalog, suggestedMode } from "@conquerra/content";
import { BOT_NAMES } from "../host/names";
import { lazy, Suspense, useEffect, useState } from "react";
import { prewarmHost, useGame } from "../store";
import type { BotLevel } from "../host/protocol";
import { mapChoiceLabel } from "../logic/text";
import { TIMER_CHOICES, timerLabel } from "../logic/timer";
import { useArtUrl } from "./art";
import { Frame } from "./Frame";
import { VersionLine } from "./Diagnostics";
import { savedWhen, slotLine } from "./saveText";

/** Load game: loaded the first time it's opened. */
const SavesDialog = lazy(() => import("./Saves"));

const BOT_LEVELS: { value: BotLevel; label: string; note: string }[] = [
  { value: "recruit", label: "Recruit (easy)", note: "Straightforward: grabs what it can and rarely plans ahead." },
  { value: "captain", label: "Captain", note: "Holds passes, gathers before breaking through, and finishes off the weak." },
];

const LUCK = [
  { value: 0, label: "None" },
  { value: 0.15, label: "Low" },
  { value: 0.3, label: "Normal" },
  { value: 0.5, label: "High" },
];

export function Lobby() {
  const { lobby, setLobby, start, load, busy, error, slots, refreshSlots } = useGame();
  const [loading, setLoading] = useState(false);
  // Load the game engine, the maps and the map painter while the player picks settings; see what's saved.
  useEffect(() => {
    prewarmHost();
    void import("../render/pixi/PixiMapRenderer");
    void refreshSlots();
  }, [refreshSlots]);
  const auto = slots.find((s) => s.slot === "auto");
  const map = mapCatalog.find((m) => m.id === lobby.mapId) ?? mapCatalog[0]!;
  const players = lobby.bots + 1;
  const rec = map.recommendedPlayers;
  const emblem = useArtUrl("emblem");
  return (
    <div className="lobby">
      <Frame>
      <div className="logo">
        {emblem && <img src={emblem} alt="" />}
        <h1>Conquerra</h1>
      </div>
      <p className="muted">Set your orders, lock in, and watch every plan play out at once.</p>
      {auto && (
        <button className="primary wide big continue" onClick={() => void load({ slot: "auto" })} disabled={busy}>
          Continue
          <span className="small block">
            {slotLine(auto)} · saved {savedWhen(auto.savedAt).replace(/^[A-Z]/, (c) => c.toLowerCase())}
          </span>
        </button>
      )}
      {slots.length > 0 && (
        <button className="link" onClick={() => setLoading(true)}>
          Load a saved game
        </button>
      )}
      <hr className="rule" />

      <div className="field">
        <span className="field-name">Map</span>
        <select value={lobby.mapId} onChange={(e) => setLobby({ mapId: e.target.value })}>
          {mapCatalog.map((m) => (
            <option key={m.id} value={m.id}>
              {mapChoiceLabel(m)}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <span className="field-name">Opponents</span>
        <span className="seg">
          {Array.from({ length: Math.min(map.maxPlayers - 1, BOT_NAMES.length) }, (_, i) => i + 1).map((b) => (
            <button key={b} className={lobby.bots === b ? "on" : ""} onClick={() => setLobby({ bots: b })}>
              {b}
            </button>
          ))}
        </span>
        <span className="muted small">
          {players} players{players >= rec.min && players <= rec.max ? " · a good fit for this map" : ` · this map suits ${rec.min}–${rec.max}`}
        </span>
      </div>

      <div className="field">
        <span className="field-name">Bots</span>
        <span className="seg">
          {BOT_LEVELS.map((b) => (
            <button key={b.value} className={lobby.botLevel === b.value ? "on" : ""} onClick={() => setLobby({ botLevel: b.value })}>
              {b.label}
            </button>
          ))}
        </span>
        <span className="muted small">{BOT_LEVELS.find((b) => b.value === lobby.botLevel)?.note}</span>
      </div>

      <div className="field">
        <span className="field-name">Luck in battle</span>
        <span className="seg">
          {LUCK.map((l) => (
            <button key={l.value} className={lobby.luck === l.value ? "on" : ""} onClick={() => setLobby({ luck: l.value })}>
              {l.label}
            </button>
          ))}
        </span>
      </div>

      <div className="field">
        <span className="field-name">Fog of war</span>
        <span className="seg">
          <button className={lobby.fog ? "on" : ""} onClick={() => setLobby({ fog: true })}>
            On
          </button>
          <button className={!lobby.fog ? "on" : ""} onClick={() => setLobby({ fog: false })}>
            Off
          </button>
        </span>
      </div>

      <div className="field">
        <span className="field-name">Fate deck</span>
        <span className="seg">
          <button className={lobby.fate !== false ? "on" : ""} onClick={() => setLobby({ fate: true })}>
            On
          </button>
          <button className={lobby.fate === false ? "on" : ""} onClick={() => setLobby({ fate: false })}>
            Off
          </button>
        </span>
        <span className="muted small">{lobby.fate === false ? "No Fate cards: less luck." : "Each turn everyone draws a Fate card: an event somewhere on the map, or a mission for you."}</span>
      </div>

      <div className="field">
        <span className="field-name">Victory</span>
        <span className="seg">
          <button className={lobby.mode === "classic" ? "on" : ""} onClick={() => setLobby({ mode: "classic" })}>
            Classic
          </button>
          <button className={lobby.mode === "conquest" ? "on" : ""} onClick={() => setLobby({ mode: "conquest" })}>
            Conquest
          </button>
        </span>
        <span className="muted small">
          {lobby.mode === "classic" ? "Last kingdom standing wins." : "20 turns, then the highest score wins."}
          {suggestedMode(players) === lobby.mode ? " (suggested)" : ""}
        </span>
      </div>

      <div className="field">
        <span className="field-name">Turn timer</span>
        <span className="seg">
          {TIMER_CHOICES.map((t) => (
            <button key={String(t)} className={lobby.turnSeconds === t ? "on" : ""} onClick={() => setLobby({ turnSeconds: t })}>
              {timerLabel(t)}
            </button>
          ))}
        </span>
        <span className="muted small">
          {lobby.turnSeconds === null ? "Take as long as you like." : "When time runs out, your orders lock in as they are."}
        </span>
      </div>

      {error && !loading && <p className="warn">{error}</p>}
      <button className={`${auto ? "" : "primary "}wide big`} onClick={start} disabled={busy}>
        {busy ? "Starting…" : auto ? "Start a new game" : "Start"}
      </button>
      {slots.length === 0 && (
        <button className="link" onClick={() => setLoading(true)}>
          Load a saved game
        </button>
      )}
      {loading && (
        <Suspense fallback={null}>
          <SavesDialog mode="load" inGame={false} onClose={() => setLoading(false)} />
        </Suspense>
      )}
      <VersionLine />
      </Frame>
    </div>
  );
}
