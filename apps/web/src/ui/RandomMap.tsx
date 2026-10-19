import { useEffect, useState } from "react";
import { cleanSeed, newSeedWords, randomMapId, randomVersionDef, RANDOM_SHAPE_IDS, RANDOM_SHAPE_NAMES, RANDOM_TEXT, RANDOM_TRIES, RANDOM_VERSION } from "@conquerra/mapgen/seed";
import { parseRandomId, RANDOM_PREFIX, RANDOM_SIZES, type RandomShape, type RandomSize } from "@conquerra/mapgen/randomId";
import { previewRandomMap, useGame } from "../store";
import type { RandomStart } from "@conquerra/content";
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
        if (useGame.getState().lobby.mapId === mapId) useGame.setState({ randomPreview: { mapId, preview: p, problem: null } });
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
