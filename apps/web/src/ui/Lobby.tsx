import { defaultRules, mapCatalog, suggestedMode } from "@conquerra/content";
import { BOT_NAMES } from "../host/names";
import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { prewarmHost, rememberedRandom, useGame } from "../store";
import { LEADER_STYLES, STEWARD_STYLES, suggestLeaderName, type LeaderStyle } from "@conquerra/engine";
import { styleLabel, styleNote } from "../logic/text";
import type { BotChoice } from "../host/protocol";
import { MAP_SUITS, mapChoiceLabel } from "../logic/text";
import { TIMER_CHOICES, timerLabel } from "../logic/timer";
import { decodeRuns, THUMB_COLOURS, type MapThumb } from "../logic/mapThumb";
import { listingOf, randomLine, type Listing } from "../logic/mapListing";
import type { RandomShape, RandomSize } from "@conquerra/mapgen/randomId";

/** Session 30: the map picker's last choice, a random map. */
const RANDOM_CHOICE = "random";
/** Session 31: the remembered random map comes back once a page load (not every time the lobby shows). */
let cameBackToRandom = false;
import { houseSummary, LUCK, rulesSummary } from "../logic/lobbyText";
import { useArtUrl } from "./art";
import { Frame } from "./Frame";
import { VersionLine } from "./VersionLine";
import { savedWhen, slotLine } from "./saveText";
import { DEFAULT_HOUSE, HOUSE_PLAIN, HOUSES } from "../map/houses";
import { unlockedAudio } from "../sound/unlock";

/** Load game: loaded the first time it's opened. */
const SavesDialog = lazy(() => import("./Saves"));
/** The folded blocks' insides (session 25b): fetched after the lobby is on screen, so the start-up stays small. */
const folds = () => import("./LobbyFolds");
const HouseBlock = lazy(() => folds().then((m) => ({ default: m.HouseBlock })));
const RulesBlock = lazy(() => folds().then((m) => ({ default: m.RulesBlock })));
/** The Online block's insides (session 26), with the online host: fetched after the lobby is on screen. */
const online = () => import("./OnlineBlock");
// Session 30: the random map's choices, loaded once a random map is picked.
const randomPanel = () => import("./RandomMap");
const RandomMapPanel = lazy(randomPanel);
const OnlineBlock = lazy(online);

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
    const go = () => void import("../sound/music").then((m) => m.music.play("game")).catch(() => {});
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
  // (Session 30: a random map's picture comes from the game's worker, once it has built the map.)
  const randomThumb = useGame((s) => (s.randomPreview?.mapId === id ? s.randomPreview.preview?.thumb : undefined));
  useEffect(() => {
    let live = true;
    const c0 = canvas.current;
    if (id.startsWith("random:")) c0?.getContext("2d")?.clearRect(0, 0, c0.width, c0.height);
    void (id.startsWith("random:") ? Promise.resolve(randomThumb ? { [id]: randomThumb } : NONE) : loadThumbs()).then((all) => {
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
  }, [id, randomThumb]);
  return <canvas ref={canvas} className="map-picture" aria-hidden />;
}

/** The Online block's line: your online games, and how many are waiting on you. */
function onlineSummary(all: { waitingOn: string[]; status: string; left?: string }[] | null, problem: string | null): string {
  if (problem) return problem.includes("isn't switched on") ? "not switched on yet" : "can't reach the server right now";
  if (!all) return "play with friends on the server: send a link, come back any time";
  // (Finished games, and ones you left, are under Finished.)
  const games = all.filter((g) => g.status !== "over" && !g.left);
  if (!games.length) return "no games going: make a game link";
  const yours = games.filter((g) => g.status === "playing" && g.waitingOn.includes("you")).length;
  return `${games.length} game${games.length === 1 ? "" : "s"}${yours ? `, ${yours} waiting on you` : ""}`;
}

/** Which folded blocks are open, remembered on this device (all closed at first). */
const FOLD_KEY = "conquerra.lobby.open";
function useFold(name: "house" | "rules" | "online"): [boolean, () => void] {
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
function Fold({ name, title, summary, children }: { name: "house" | "rules" | "online"; title: string; summary: string; children: ReactNode }) {
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
  const { lobby, setLobby, start, load, busy, error, slots, refreshSlots, onlineGames, onlineProblem } = useGame();
  // Session 28: only this button's own start says "Starting…" (making a game link is busy too, and says so itself).
  const [starting, setStarting] = useState(false);
  useEffect(() => {
    if (!busy) setStarting(false);
  }, [busy]);
  const [loading, setLoading] = useState(false);
  // Load the game engine, the maps and the map painter while the player picks settings; see what's saved.
  useEffect(() => {
    prewarmHost();
    void import("../render/pixi/PixiMapRenderer");
    void refreshSlots();
    void loadThumbs();
    void folds();
    // Your online games, for the Online block's line (its code arrives after the lobby is on screen).
    void import("../host/onlineActions").then((m) => m.refreshOnline());
    void online();
  }, [refreshSlots]);
  // Session 31: last time it was a random map, so it's a random map again (the same size and shape, a fresh seed).
  useEffect(() => {
    const r = rememberedRandom();
    if (!r || cameBackToRandom || useGame.getState().lobby.mapId.startsWith("random:")) return;
    cameBackToRandom = true;
    void randomPanel().then((m) => {
      const id = m.freshRandomId(r.size as RandomSize, r.shape as RandomShape);
      if (listingOf(id)) setLobby({ mapId: id });
    });
  }, [setLobby]);
  const auto = slots.find((s) => s.slot === "auto");
  const map: Listing = listingOf(lobby.mapId) ?? mapCatalog[0]!;
  const random = map.random;
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
              <span className="small muted block">{random ? randomLine(random) : `${map.territories} territories · suits ${rec.min} to ${rec.max} players`}</span>
              <span className="small change">Change map ▾</span>
            </span>
            <select
              aria-label="Map"
              value={lobby.mapId}
              onChange={(e) => {
                const id = e.target.value;
                // Session 30: "Random map" gets a fresh seed (the dice load with the random map's choices).
                if (id === RANDOM_CHOICE) void randomPanel().then((m) => setLobby({ mapId: m.freshRandomId() }));
                else setLobby({ mapId: id });
              }}
            >
              {mapCatalog.map((m) => (
                <option key={m.id} value={m.id}>
                  {mapChoiceLabel(m)}
                </option>
              ))}
              {random && <option value={lobby.mapId}>Random map · {randomLine(random)}</option>}
              <option value={RANDOM_CHOICE}>Random map</option>
            </select>
          </label>
          {MAP_SUITS[map.id] && <span className="muted small">{MAP_SUITS[map.id]}</span>}
          {random && (
            <Suspense fallback={null}>
              <RandomMapPanel />
            </Suspense>
          )}
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
          <Suspense fallback={null}>
            <HouseBlock stewardSuggestion={stewardSuggestion} />
          </Suspense>
        </Fold>

        <Fold name="rules" title="Rules" summary={rulesSummary(lobby)}>
          <Suspense fallback={null}>
            <RulesBlock />
          </Suspense>
        </Fold>

        {error && !loading && <p className="warn">{error}</p>}
        {/* Start: right under the folded blocks, and stuck to the bottom of the screen while they're open. */}
        <div className="start-bar">
          <button className={`${auto ? "" : "primary "}wide big`} onClick={() => (setStarting(true), void start())} disabled={busy}>
            {busy && starting ? "Starting…" : auto ? "Start a new game" : "Start"}
          </button>
        </div>
        {slots.length === 0 && (
          <button className="link" onClick={() => setLoading(true)}>
            Load a saved game
          </button>
        )}
        {/* Online (session 26): a game on the server, and your online games. */}
        <Fold name="online" title="Online" summary={onlineSummary(onlineGames, onlineProblem)}>
          <Suspense fallback={null}>
            <OnlineBlock />
          </Suspense>
        </Fold>
        {loading && (
          <Suspense fallback={null}>
            <SavesDialog mode="load" inGame={false} onClose={() => setLoading(false)} />
          </Suspense>
        )}
      </Frame>
    </div>
  );
}
