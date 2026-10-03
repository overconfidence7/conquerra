import { mapCatalog, suggestedMode } from "@conquerra/content";
import { BOT_NAMES } from "../host/names";
import { useEffect } from "react";
import { prewarmHost, useGame } from "../store";
import { TIMER_CHOICES, timerLabel } from "../logic/timer";
import { useArtUrl } from "./art";
import { Frame } from "./Frame";

const LUCK = [
  { value: 0, label: "None" },
  { value: 0.15, label: "Low" },
  { value: 0.3, label: "Normal" },
  { value: 0.5, label: "High" },
];

export function Lobby() {
  const { lobby, setLobby, start, busy, error } = useGame();
  // Load the game engine, the maps and the map painter while the player picks settings.
  useEffect(() => {
    prewarmHost();
    void import("../render/pixi/PixiMapRenderer");
  }, []);
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
      <hr className="rule" />

      <div className="field">
        <span className="field-name">Map</span>
        <select value={lobby.mapId} onChange={(e) => setLobby({ mapId: e.target.value })}>
          {mapCatalog.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} · {m.territories} territories · suits {m.recommendedPlayers.min}–{m.recommendedPlayers.max} players
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <span className="field-name">Opponents (Recruit bots)</span>
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

      {error && <p className="warn">{error}</p>}
      <button className="primary wide big" onClick={start} disabled={busy}>
        {busy ? "Starting…" : "Start"}
      </button>
      </Frame>
    </div>
  );
}
