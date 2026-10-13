import { defaultRules, mapCatalog, suggestedMode } from "@conquerra/content";
import { BOT_NAMES } from "../host/names";
import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { prewarmHost, useGame } from "../store";
import { LEADER_STYLES, STEWARD_STYLES, suggestLeaderName, type LeaderStyle } from "@conquerra/engine";
import { styleLabel, styleNote } from "../logic/text";
import type { BotChoice } from "../host/protocol";
import { MAP_SUITS, mapChoiceLabel } from "../logic/text";
import { TIMER_CHOICES, timerLabel } from "../logic/timer";
import { decodeRuns, THUMB_COLOURS, type MapThumb } from "../logic/mapThumb";
import { houseSummary, LUCK, rulesSummary } from "../logic/lobbyText";
import { useArtUrl } from "./art";
import { Frame } from "./Frame";
import { VersionLine } from "./Diagnostics";
import { savedWhen, slotLine } from "./saveText";
import { DEFAULT_HOUSE, HOUSE_PLAIN, HOUSES } from "../map/houses";
import { unlockedAudio } from "../sound/unlock";

/** Load game: loaded the first time it's opened. */
const SavesDialog = lazy(() => import("./Saves"));

const BOT_LEVELS: { value: BotChoice; label: string; note: string }[] = [
  { value: "marshal", label: "Marshal (hard)", note: "Attacks hard, each with its own personality (you learn which by how it plays), and spots a runaway early." },
  { value: "captain", label: "Captain (medium)", note: "Holds passes, gathers before breaking through, and finishes off the weak." },
  { value: "recruit", label: "Recruit (easy)", note: "Grabs what it can and rarely plans ahead." },
  { value: "mixed", label: "Mixed", note: "Some Marshals, the rest Captains, seated at random." },
];


/**
 * The title music (session 24), after the first tap: phones allow sound only then. It loads only then too (the music
 * player, not the sound effects), and crossfades into the planning music when a game starts.
 */
function useTitleMusic() {
  useEffect(() => {
    const go = () => void import("../sound/music").then((m) => m.music.play("title")).catch(() => {});
    if (unlockedAudio()) return go();
    addEventListener("conquerra-audio", go, { once: true });
    return () => removeEventListener("conquerra-audio", go);
  }, []);
}

/** The map pictures (scripts/map-thumbs.ts): fetched once, after the lobby is on screen. */
let thumbs: Promise<Record<string, MapThumb>> | null = null;
const NONE: Record<string, MapThumb> = {};
const loadThumbs = () =>
  (thumbs ??= fetch(`${import.meta.env.BASE_URL}maps/thumbs.json`)
    .then((r) => (r.ok ? (r.json() as Promise<Record<string, MapThumb>>) : NONE))
    .catch(() => NONE));

/** The chosen map's picture: its land and sea, painted from its ground. Blank until it arrives (it's small). */
function MapPicture({ id }: { id: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let live = true;
    void loadThumbs().then((all) => {
      const t = all[id], c = canvas.current;
      if (!live || !t || !c) return;
      const cells = decodeRuns(t.data);
      c.width = t.cols;
      c.height = t.rows;
      const x = c.getContext("2d");
      if (!x) return;
      for (let i = 0; i < cells.length; i++) {
        x.fillStyle = THUMB_COLOURS[cells[i]!] ?? THUMB_COLOURS.O!;
        x.fillRect(i % t.cols, Math.floor(i / t.cols), 1, 1);
      }
    });
    return () => void (live = false);
  }, [id]);
  return <canvas ref={canvas} className="map-picture" aria-hidden />;
}

/** Which folded blocks are open, remembered on this device (both closed at first). */
const FOLD_KEY = "conquerra.lobby.open";
function useFold(name: "house" | "rules"): [boolean, () => void] {
  const read = () => {
    try {
      return !!(JSON.parse(localStorage.getItem(FOLD_KEY) ?? "{}") as Record<string, boolean>)[name];
    } catch {
      return false;
    }
  };
  const [open, setOpen] = useState(read);
  const toggle = () => {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(FOLD_KEY, JSON.stringify({ ...JSON.parse(localStorage.getItem(FOLD_KEY) ?? "{}"), [name]: next }));
    } catch {
      // A private window: remembered for this visit only.
    }
  };
  return [open, toggle];
}

/** A folded block: its name and its choices in one line, so nothing is hidden; tap to open it. */
function Fold({ name, title, summary, children }: { name: "house" | "rules"; title: string; summary: string; children: ReactNode }) {
  const [open, toggle] = useFold(name);
  return (
    <section className={`fold ${open ? "open" : ""}`}>
      <button className="fold-head" aria-expanded={open} onClick={toggle}>
        <span className="fold-mark" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
        <span className="fold-title">{title}</span>
        <span className="fold-summary">{summary}</span>
      </button>
      {open && <div className="fold-body">{children}</div>}
    </section>
  );
}

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

/**
 * The lobby (redesigned in session 25b, Nate: declutter, dropdowns, smaller text, room for what's coming). In view:
 * the title and version, Continue and Load, the Map (its picture and name; tap it to pick another), Opponents (how
 * many and how hard; a mixed table's Marshal count), and Start (under the folded blocks, stuck to the bottom of the
 * screen while they're open, so it's always in reach). Folded (closed at first, remembered on the device),
 * each showing its choices in one line: Your House (colour, Leader, Steward) and Rules (luck, fog, Fate, diplomacy,
 * victory, timer). A default game is one tap: Start. Session 26 adds the Online block under the local game.
 */
export function Lobby() {
  useTitleMusic();
  const { lobby, setLobby, start, load, busy, error, slots, refreshSlots } = useGame();
  const [loading, setLoading] = useState(false);
  // Load the game engine, the maps and the map painter while the player picks settings; see what's saved.
  useEffect(() => {
    prewarmHost();
    void import("../render/pixi/PixiMapRenderer");
    void refreshSlots();
    void loadThumbs();
  }, [refreshSlots]);
  const auto = slots.find((s) => s.slot === "auto");
  const map = mapCatalog.find((m) => m.id === lobby.mapId) ?? mapCatalog[0]!;
  const players = lobby.bots + 1;
  // A mixed table: how many Marshals (half the bots, rounded up, until you choose).
  const marshals = Math.min(lobby.bots, lobby.marshals ?? Math.ceil(lobby.bots / 2));
  const rec = map.recommendedPlayers;
  const emblem = useArtUrl("emblem");
  // The title screen's key art behind the lobby (batch 4, session 21); its left third is dark and calm for the menu.
  const keyArt = useArtUrl("art-title");
  const cloud1 = useArtUrl(keyArt ? "cloud-1" : null), cloud2 = useArtUrl(keyArt ? "cloud-2" : null), cloud3 = useArtUrl(keyArt ? "cloud-3" : null);
  // Left blank, your Steward gets a name from the game's seed; this is the kind of name it'll be.
  const [stewardSuggestion] = useState(() => suggestLeaderName("steward", String(Date.now())));
  const level = BOT_LEVELS.find((b) => b.value === lobby.botLevel) ?? BOT_LEVELS[0]!;
  const styles = (list: readonly LeaderStyle[]) => [null, ...list].map((p) => ({ value: p, label: styleLabel(p) }));
  return (
    <div className={`lobby ${keyArt ? "with-art" : ""}`} style={keyArt ? ({ "--key-art": `url("${keyArt}")` } as React.CSSProperties) : undefined}>
      {cloud1 && cloud2 && cloud3 && (
        <div className="lobby-clouds" aria-hidden>
          <img src={cloud1} alt="" />
          <img src={cloud2} alt="" />
          <img src={cloud3} alt="" />
        </div>
      )}
      <Frame>
        <div className="logo">
          {emblem && <img src={emblem} alt="" />}
          <h1>Conquerra</h1>
        </div>
        <p className="muted tagline">Set your orders, lock in, and watch everyone's plans collide.</p>
        <VersionLine />
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
          {/* The picture and the name; the map picker sits behind them (a tap opens it). */}
          <label className="map-choice">
            <MapPicture id={map.id} />
            <span className="map-name">
              <b>{map.name}</b>
              <span className="small muted block">
                {map.territories} territories · suits {rec.min} to {rec.max} players
              </span>
              <span className="small change">Change map ▾</span>
            </span>
            <select aria-label="Map" value={lobby.mapId} onChange={(e) => setLobby({ mapId: e.target.value })}>
              {mapCatalog.map((m) => (
                <option key={m.id} value={m.id}>
                  {mapChoiceLabel(m)}
                </option>
              ))}
            </select>
          </label>
          {MAP_SUITS[map.id] && <span className="muted small">{MAP_SUITS[map.id]}</span>}
        </div>

        <div className="field">
          <span className="field-name">Opponents</span>
          <div className="pick-row">
            <select aria-label="How many opponents" value={lobby.bots} onChange={(e) => setLobby({ bots: Number(e.target.value) })}>
              {Array.from({ length: Math.min(map.maxPlayers - 1, BOT_NAMES.length) }, (_, i) => i + 1).map((b) => (
                <option key={b} value={b}>
                  {b} {b === 1 ? "bot" : "bots"}
                </option>
              ))}
            </select>
            <select aria-label="How hard" value={lobby.botLevel} onChange={(e) => setLobby({ botLevel: e.target.value as BotChoice })}>
              {BOT_LEVELS.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
          {lobby.botLevel === "mixed" && (
            <span className="seg mix-count">
              <button aria-label="Fewer Marshals" disabled={marshals <= 0} onClick={() => setLobby({ marshals: marshals - 1 })}>
                −
              </button>
              <span className="mix-line">
                {marshals} Marshal{marshals === 1 ? "" : "s"} and {lobby.bots - marshals} Captain{lobby.bots - marshals === 1 ? "" : "s"}
              </span>
              <button aria-label="More Marshals" disabled={marshals >= lobby.bots} onClick={() => setLobby({ marshals: marshals + 1 })}>
                +
              </button>
            </span>
          )}
          <span className="muted small">
            {players} players{players >= rec.min && players <= rec.max ? ", a good fit for this map" : `, this map suits ${rec.min} to ${rec.max}`}. {level.note}
          </span>
        </div>

        <Fold name="house" title="Your House" summary={houseSummary(lobby, stewardSuggestion)}>
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
        </Fold>

        <Fold name="rules" title="Rules" summary={rulesSummary(lobby)}>
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
        </Fold>

        {error && !loading && <p className="warn">{error}</p>}
        {/* Start: right under the folded blocks, and stuck to the bottom of the screen while they're open. */}
        <div className="start-bar">
          <button className={`${auto ? "" : "primary "}wide big`} onClick={start} disabled={busy}>
            {busy ? "Starting…" : auto ? "Start a new game" : "Start"}
          </button>
        </div>
        {slots.length === 0 && (
          <button className="link" onClick={() => setLoading(true)}>
            Load a saved game
          </button>
        )}
        {/* Session 26: the Online block goes here, under the local game ("New online game", "Your online games"). */}
        {loading && (
          <Suspense fallback={null}>
            <SavesDialog mode="load" inGame={false} onClose={() => setLoading(false)} />
          </Suspense>
        )}
      </Frame>
    </div>
  );
}
