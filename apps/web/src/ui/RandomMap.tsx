import { useEffect, useState } from "react";
import { cleanSeed, newSeedWords, randomMapId, RANDOM_SHAPE_IDS, RANDOM_SHAPE_NAMES, RANDOM_TEXT } from "@conquerra/mapgen/seed";
import { parseRandomId, RANDOM_PREFIX, RANDOM_SIZES, type RandomShape, type RandomSize } from "@conquerra/mapgen/randomId";
import { previewRandomMap, useGame } from "../store";
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
  building: "Drawing the map…",
  slow: "Big maps take a while to draw, longer on a phone.",
  suits: "A new map from its seed: the same seed always makes the same map, so you can share it with a friend.",
} as const;

/** A random map's id with a fresh seed (the page's dice; the map maker never draws one). */
export function freshRandomId(size: RandomSize = 80, shape: RandomShape = "island"): string {
  return `${RANDOM_PREFIX}${randomMapId(size, shape, newSeedWords(Math.random))}`;
}

export default function RandomMapPanel() {
  const mapId = useGame((s) => s.lobby.mapId);
  const setLobby = useGame((s) => s.setLobby);
  const preview = useGame((s) => (s.randomPreview?.mapId === mapId ? s.randomPreview : null));
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
        if (useGame.getState().lobby.mapId === mapId) useGame.setState({ randomPreview: { mapId, preview: null, problem: e instanceof Error ? e.message : RANDOM_TEXT.failed } });
      },
    );
  }, [mapId]);
  if (!r) return null;
  const go = (size: RandomSize, shape: RandomShape, seed: string) => setLobby({ mapId: `${RANDOM_PREFIX}${randomMapId(size, shape, seed)}` });
  const useTyped = () => {
    const s = cleanSeed(typed);
    setTypo(!s);
    if (s) (go(r.size, r.shape, s), setTyped(""));
  };
  return (
    <div className="random-map">
      <span className="muted small">{RANDOM_UI.suits}</span>
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
        <button className="small" onClick={() => go(r.size, r.shape, newSeedWords(Math.random))}>
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
        <p className="muted small">
          {RANDOM_UI.building}
          {r.size >= 120 ? ` ${RANDOM_UI.slow}` : ""}
        </p>
      ) : null}
    </div>
  );
}
