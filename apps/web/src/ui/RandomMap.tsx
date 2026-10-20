import { useEffect, useState } from "react";
import { cleanSeed, newSeedWords, randomMapId, randomVersionDef, RANDOM_SHAPE_IDS, RANDOM_SHAPE_NAMES, RANDOM_TEXT, RANDOM_TRIES, RANDOM_VERSION } from "@conquerra/mapgen/seed";
import { parseRandomId, RANDOM_PREFIX, RANDOM_SIZES, type RandomShape, type RandomSize } from "@conquerra/mapgen/randomId";
import { previewRandomMap, useGame } from "../store";
import type { RandomStart } from "@conquerra/content";
import type { RandomPreview } from "../host/protocol";
import "./random-map.css";

/**
 * The lobby's random map (session 30), under the map's card once "Random map" is picked: a size, a shape and the
 * seed (two words anyone can read out and type), Reroll, and a box to type one. The map is built in the game's own
 * worker (so Start doesn't build it again), and its picture shows on the card. Loaded only when a random map is picked.
 */

export const RANDOM_UI = {
  size: "Size",
  shape: "Shape",
  seed: "Seed",
  reroll: "Reroll",
  typeSeed: "Type a seed",
  use: "Use",
  building: "Making the map…",
  slow: "Big maps take a while to draw, longer on a phone.",
  /** Session 33b: the two big sizes (300 and 400), from the sim's game lengths. */
  long: "A long game in Classic: plan on 50 turns or more.",
  suits: "A new map from its seed: the same seed always makes the same map, so you can share it with a friend.",
  /**
   * Session 33 (random map version 4): what the exposed spots get, in one line. Session 33b (version 5): and the
   * market ("Exposed spots start with extra troops (up to 6), the most exposed with a market.").
   */
  headStart: (cap: number, start?: RandomStart) => {
    const extra = start?.market ? `a market${start.culture ? " and a level of culture" : ""}` : start?.culture ? "a level of culture" : "";
    const troops = `Exposed spots start with extra troops (up to ${cap})`;
    if (!extra) return `${troops}.`;
    return start!.spots === "all" ? `${troops}${start!.market && start!.culture ? ", " : " and "}${extra}.` : `${troops}, the most exposed with ${extra}.`;
  },
} as const;

/** The current version's graded head start, at most this many troops, and its income head start (`data/random-maps.json`). */
const HEAD_START_CAP = randomVersionDef(RANDOM_VERSION).grade?.cap ?? 0;
const HEAD_START = randomVersionDef(RANDOM_VERSION).start;
/** Session 33b: from this size the card says a Classic game runs long (the sim, all Marshals: median 46 turns at 300 with 8 players, 52 with 10, 58 at 400 with 10; Conquest, suggested from 8 players, ends at its turn limit). */
export const LONG_FROM = 300;

/** Session 31: "40%", or "40%, try 2 of 6" once a try has been rejected. */
export function progressLine(done: number): string {
  const attempt = Math.floor(done) + 1;
  const pct = Math.round(100 * (done - Math.floor(done)));
  return attempt > 1 ? `${pct}%, try ${attempt} of ${RANDOM_TRIES}` : `${pct}%`;
}

/** Session 32: a rolled seed that doesn't make a fair map rolls again by itself, up to this many seeds in all. */
export const ROLL_SEEDS = 12;
/** Ids the page rolled (Reroll, the lobby's fresh seed), with the seeds still to try after each. A typed seed isn't here. */
const rolled = new Map<string, number>();

/** A random map's id with a fresh seed (the page's dice; the map maker never draws one). It rolls on if it fails. */
export function freshRandomId(size: RandomSize = 80, shape: RandomShape = "island", left = ROLL_SEEDS - 1): string {
  const id = `${RANDOM_PREFIX}${randomMapId(size, shape, newSeedWords(Math.random))}`;
  rolled.set(id, left);
  if (rolled.size > 64) rolled.delete(rolled.keys().next().value!);
  return id;
}

/**
 * A map that failed: if the page rolled its seed and has seeds left, the next roll's id (the player never sees "That
 * seed didn't make a fair map" from a roll, and the words shown are the ones that worked); else null (a typed seed
 * had its six tries, or twelve rolled seeds all failed: the plain line shows).
 */
export function rollOn(mapId: string): string | null {
  const left = rolled.get(mapId);
  const r = parseRandomId(mapId);
  if (!r || !left || left < 1) return null;
  return freshRandomId(r.size, r.shape, left - 1);
}

/**
 * Session 34 (Nate's call, Oct 19): the lobby keeps the last random map. Its seed, picture and the try that passed are
 * kept on this device once it's built, so opening the lobby again shows the same map and builds nothing (a 400 cost a
 * phone 10 to 20 s of work on every visit). A new seed comes only from Reroll, or once a game was started with the
 * kept one (`randomStarted` in the store marks it used); a typed seed stays typed, game or no game.
 */
export const KEPT_RANDOM_KEY = "conquerra.lobbyRandom";
interface KeptRandom {
  id: string;
  version: number;
  attempt: number;
  thumb: RandomPreview["thumb"];
  typed: boolean;
  used?: boolean;
}
export function keepRandom(id: string, p: RandomPreview) {
  try {
    localStorage.setItem(KEPT_RANDOM_KEY, JSON.stringify({ id, version: RANDOM_VERSION, attempt: p.attempt, thumb: p.thumb, typed: !rolled.has(id) } satisfies KeptRandom));
  } catch {
    // A private window (or a full store): a fresh seed next visit, as before.
  }
}
/**
 * The map the lobby should come back to, at this size and shape: the kept map (its picture with it, so nothing is
 * built), or a fresh seed when nothing is kept or the kept one was played.
 */
export function keptOrFresh(size: RandomSize, shape: RandomShape): { mapId: string; preview: RandomPreview | null } {
  let kept: KeptRandom | null = null;
  try {
    kept = JSON.parse(localStorage.getItem(KEPT_RANDOM_KEY) ?? "null") as KeptRandom | null;
  } catch {
    kept = null;
  }
  const r = kept ? parseRandomId(kept.id) : null;
  if (!kept || !r || r.size !== size || r.shape !== shape || kept.version !== RANDOM_VERSION || (kept.used && !kept.typed) || !kept.thumb) return { mapId: freshRandomId(size, shape), preview: null };
  // A rolled seed that comes back still rolls on at another size or shape, as it did when it was rolled.
  if (!kept.typed) rolled.set(kept.id, ROLL_SEEDS - 1);
  return { mapId: kept.id, preview: { thumb: kept.thumb, attempt: kept.attempt } };
}
/** The lobby is shown again after a game on its random map: a fresh seed if that one was played (a typed one stays). */
export function playedRandom(mapId: string): boolean {
  try {
    const kept = JSON.parse(localStorage.getItem(KEPT_RANDOM_KEY) ?? "null") as KeptRandom | null;
    return !!kept && kept.id === mapId && !!kept.used && !kept.typed;
  } catch {
    return false;
  }
}

export default function RandomMapPanel() {
  const mapId = useGame((s) => s.lobby.mapId);
  const setLobby = useGame((s) => s.setLobby);
  const preview = useGame((s) => (s.randomPreview?.mapId === mapId ? s.randomPreview : null));
  const progress = useGame((s) => s.mapProgress);
  const [typed, setTyped] = useState("");
  const [typo, setTypo] = useState(false);
  const r = parseRandomId(mapId);
  // Build it (in the game's worker) whenever the id changes; the card shows its picture.
  useEffect(() => {
    if (!parseRandomId(mapId)) return;
    if (useGame.getState().randomPreview?.mapId === mapId) return;
    useGame.setState({ randomPreview: { mapId, preview: null, problem: null } });
    previewRandomMap(mapId).then(
      (p) => {
        if (useGame.getState().lobby.mapId !== mapId) return;
        useGame.setState({ randomPreview: { mapId, preview: p, problem: null } });
        keepRandom(mapId, p);
      },
      (e: unknown) => {
        if (useGame.getState().lobby.mapId !== mapId) return;
        const next = rollOn(mapId);
        if (next) return useGame.getState().setLobby({ mapId: next });
        useGame.setState({ randomPreview: { mapId, preview: null, problem: e instanceof Error ? e.message : RANDOM_TEXT.failed } });
      },
    );
  }, [mapId]);
  if (!r) return null;
  const go = (size: RandomSize, shape: RandomShape, seed: string, typedSeed = false) => {
    const id = `${RANDOM_PREFIX}${randomMapId(size, shape, seed)}`;
    // A rolled seed at another size or shape still rolls on if it fails; a typed one is the player's own.
    if (!typedSeed && rolled.has(mapId)) rolled.set(id, ROLL_SEEDS - 1);
    setLobby({ mapId: id });
  };
  const useTyped = () => {
    const s = cleanSeed(typed);
    setTypo(!s);
    if (s) (go(r.size, r.shape, s, true), setTyped(""));
  };
  return (
    <div className="random-map">
      <span className="muted small">
        {RANDOM_UI.suits}
        {HEAD_START_CAP ? ` ${RANDOM_UI.headStart(HEAD_START_CAP, HEAD_START)}` : ""}
        {r.size >= LONG_FROM ? ` ${RANDOM_UI.long}` : ""}
      </span>
      <div className="pick-row">
        <label className="pick">
          <span className="field-name">{RANDOM_UI.size}</span>
          <select aria-label="Random map size" value={r.size} onChange={(e) => go(Number(e.target.value) as RandomSize, r.shape, r.seed)}>
            {RANDOM_SIZES.map((n) => (
              <option key={n} value={n}>
                {n} territories
              </option>
            ))}
          </select>
        </label>
        <label className="pick">
          <span className="field-name">{RANDOM_UI.shape}</span>
          <select aria-label="Random map shape" value={r.shape} onChange={(e) => go(r.size, e.target.value as RandomShape, r.seed)}>
            {RANDOM_SHAPE_IDS.map((s) => (
              <option key={s} value={s}>
                {RANDOM_SHAPE_NAMES[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="random-seed">
        <span className="field-name">{RANDOM_UI.seed}</span> <b className="seed-words">{r.seed}</b>{" "}
        <button className="small" onClick={() => setLobby({ mapId: freshRandomId(r.size, r.shape) })}>
          {RANDOM_UI.reroll}
        </button>
      </div>
      <div className="pick-row random-type">
        <input
          className="name-input"
          aria-label={RANDOM_UI.typeSeed}
          placeholder={RANDOM_UI.typeSeed}
          value={typed}
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          maxLength={30}
          onChange={(e) => (setTyped(e.target.value), setTypo(false))}
          onKeyDown={(e) => e.key === "Enter" && useTyped()}
        />
        <button className="small" disabled={!typed.trim()} onClick={useTyped}>
          {RANDOM_UI.use}
        </button>
      </div>
      {typo && <p className="warn small">{RANDOM_TEXT.badId}</p>}
      {preview?.problem ? (
        <p className="warn small">{preview.problem}</p>
      ) : !preview?.preview ? (
        <p className="muted small" role="status">
          {RANDOM_UI.building}
          {progress !== null ? ` ${progressLine(progress)}` : ""}
          {r.size >= 120 ? ` ${RANDOM_UI.slow}` : ""}
        </p>
      ) : null}
    </div>
  );
}
