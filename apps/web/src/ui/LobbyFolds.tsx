import { defaultRules, suggestedMode } from "@conquerra/content";
import { LEADER_STYLES, STEWARD_STYLES, type LeaderStyle } from "@conquerra/engine";
import { useGame } from "../store";
import { LUCK } from "../logic/lobbyText";
import { styleLabel, styleNote } from "../logic/text";
import { TIMER_CHOICES, timerLabel } from "../logic/timer";
import { DEFAULT_HOUSE, HOUSE_PLAIN, HOUSES } from "../map/houses";
import "./lobby-folds.css";

/**
 * The lobby's folded blocks, inside (session 25b): Your House (colour, Leader, Steward) and Rules (luck, fog, Fate,
 * diplomacy, victory, timer, and Show personalities). Loaded after the lobby is on screen (they start folded).
 */

/** A labelled dropdown on one row. */
function Pick<T extends string | number | null>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange(v: T): void }) {
  const i = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <label className="pick">
      <span className="field-name">{label}</span>
      <select value={i} onChange={(e) => onChange(options[Number(e.target.value)]!.value)}>
        {options.map((o, k) => (
          <option key={k} value={k}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const ON_OFF = [
  { value: 1, label: "On" },
  { value: 0, label: "Off" },
];

const styles = (list: readonly LeaderStyle[]) => [null, ...list].map((p) => ({ value: p, label: styleLabel(p) }));

export function HouseBlock({ stewardSuggestion }: { stewardSuggestion: string }) {
  const { lobby, setLobby } = useGame();
  return (
    <>
      <div className="field">
        <span className="houses" role="radiogroup" aria-label="Your House colour">
          {HOUSES.map((h, i) => (
            <button
              key={h.name}
              role="radio"
              aria-checked={(lobby.house ?? DEFAULT_HOUSE) === i}
              aria-label={`${h.name} (${HOUSE_PLAIN[i]})`}
              title={`${h.name} (${HOUSE_PLAIN[i]})`}
              className={`house-swatch ${(lobby.house ?? DEFAULT_HOUSE) === i ? "on" : ""}`}
              style={{ background: h.color }}
              onClick={() => setLobby({ house: i })}
            />
          ))}
        </span>
        <span className="muted small">
          {HOUSES[lobby.house ?? DEFAULT_HOUSE]!.name} ({HOUSE_PLAIN[lobby.house ?? DEFAULT_HOUSE]}). The bots take the other colours.
        </span>
      </div>
      <div className="field">
        <span className="field-name">Your Leader</span>
        <div className="pick-row">
          <input
            className="name-input"
            aria-label="Your Leader's name"
            value={lobby.leaderName ?? ""}
            maxLength={defaultRules.leaders.nameMaxLength}
            placeholder="Name your Leader"
            onChange={(e) => setLobby({ leaderName: e.target.value })}
          />
          <select aria-label="Your Leader's personality" value={lobby.leaderPersonality ?? ""} onChange={(e) => setLobby({ leaderPersonality: (e.target.value || null) as LeaderStyle | null })}>
            {styles(LEADER_STYLES).map((o) => (
              <option key={o.label} value={o.value ?? ""}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <span className="muted small">Leads your army (+20% in battle). {styleNote(lobby.leaderPersonality ?? null, "leader")}</span>
      </div>
      <div className="field">
        <span className="field-name">Your Steward</span>
        <div className="pick-row">
          <input
            className="name-input"
            aria-label="Your Steward's name (optional)"
            value={lobby.stewardName ?? ""}
            maxLength={defaultRules.leaders.nameMaxLength}
            placeholder={`Optional (otherwise ${stewardSuggestion})`}
            onChange={(e) => setLobby({ stewardName: e.target.value })}
          />
          <select aria-label="Your Steward's personality" value={lobby.stewardPersonality ?? ""} onChange={(e) => setLobby({ stewardPersonality: (e.target.value || null) as LeaderStyle | null })}>
            {styles(STEWARD_STYLES).map((o) => (
              <option key={o.label} value={o.value ?? ""}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <span className="muted small">Builds and raises culture for you. {styleNote(lobby.stewardPersonality ?? null, "steward")}</span>
      </div>
    </>
  );
}

export function RulesBlock() {
  const { lobby, setLobby } = useGame();
  const players = lobby.bots + 1;
  return (
    <>
      <div className="picks">
        <Pick label="Luck in battle" value={lobby.luck} options={LUCK.map((l) => ({ value: l.value, label: l.label }))} onChange={(v) => setLobby({ luck: v })} />
        <Pick label="Fog of war" value={lobby.fog ? 1 : 0} options={ON_OFF} onChange={(v) => setLobby({ fog: v === 1 })} />
        <Pick label="Fate deck" value={lobby.fate === false ? 0 : 1} options={ON_OFF} onChange={(v) => setLobby({ fate: v === 1 })} />
        <Pick label="Diplomacy" value={lobby.diplomacy === false ? 0 : 1} options={ON_OFF} onChange={(v) => setLobby({ diplomacy: v === 1 })} />
        <Pick
          label="Victory"
          value={lobby.mode}
          options={(["classic", "conquest"] as const).map((m) => ({ value: m, label: `${m === "classic" ? "Classic" : "Conquest"}${suggestedMode(players) === m ? " (suggested)" : ""}` }))}
          onChange={(v) => setLobby({ mode: v })}
        />
        <Pick label="Turn timer" value={lobby.turnSeconds} options={TIMER_CHOICES.map((t) => ({ value: t, label: timerLabel(t) }))} onChange={(v) => setLobby({ turnSeconds: v })} />
      </div>
      {(lobby.botLevel === "marshal" || lobby.botLevel === "mixed") && (
        <label className="check small">
          <input type="checkbox" checked={!!lobby.showPersonalities} onChange={(e) => setLobby({ showPersonalities: e.target.checked })} />
          Show the Marshals' personalities (otherwise you find out by how they play, and at the end)
        </label>
      )}
      <p className="muted small">
        {lobby.mode === "classic" ? "Classic: the last kingdom standing wins." : "Conquest: 20 turns, then the highest score wins."}{" "}
        {lobby.fate === false ? "No Fate cards: less luck." : "Fate: each turn everyone draws a card, an event somewhere or a mission for you."}{" "}
        {lobby.diplomacy === false ? "No deals: every House fights alone." : "Diplomacy: truces, trades, joint wars and right of passage."}{" "}
        {lobby.turnSeconds === null ? "Take as long as you like." : "When time runs out, your orders lock in as they are."}
      </p>
    </>
  );
}
