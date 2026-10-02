import { maps, suggestedMode } from "@conquerra/content";
import { useGame } from "../store";

const LUCK = [
  { value: 0, label: "None" },
  { value: 0.15, label: "Low" },
  { value: 0.3, label: "Normal" },
  { value: 0.5, label: "High" },
];

export function Lobby() {
  const { lobby, setLobby, start, busy, error } = useGame();
  const map = maps[lobby.mapId]!;
  const players = lobby.bots + 1;
  const rec = map.recommendedPlayers;
  return (
    <div className="lobby">
      <h1>Conquerra</h1>
      <p className="muted">Set your orders, lock in, and watch every plan play out at once.</p>

      <div className="field">
        <span className="field-name">Map</span>
        <select value={lobby.mapId} onChange={(e) => setLobby({ mapId: e.target.value })}>
          <option value="embervale">{maps.embervale!.name.replace(" (test map)", "")} · {maps.embervale!.territories.length} territories</option>
        </select>
      </div>

      <div className="field">
        <span className="field-name">Opponents (Recruit bots)</span>
        <span className="seg">
          {Array.from({ length: map.maxPlayers - 1 }, (_, i) => i + 1).map((b) => (
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

      {error && <p className="warn">{error}</p>}
      <button className="primary wide big" onClick={start} disabled={busy}>
        {busy ? "Starting…" : "Start"}
      </button>
    </div>
  );
}
