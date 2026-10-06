import type { MapDef } from "@conquerra/content";
import type { ReplayEvent } from "@conquerra/engine";
import { toScreen, usable, type Camera, type Viewport } from "../map/camera";
import type { Beat, Timeline } from "./timeline";

/**
 * The replay camera (session 6): when the next thing in the replay happens off screen, the camera eases there,
 * and at the end it eases back to where you were. Worked out here, from the timeline only, so it's tested
 * without a screen; the renderer just glides to each camera at its time.
 *
 * Gentle by design: it only pans (never zooms); it only follows the big moments (battles, fogged pulses, a fallen
 * Leader), not recruits or marches; it only moves when the spot is outside the free part of the screen; and after
 * each glide it holds still for a while. Skip and your own panning stop it (useReplay).
 *
 * Fog-safe by construction: it reads the same `replayFor` events as the replay, and a fogged event (a "surface"
 * event: a kind and a province, nothing else) is aimed at the province's centre, which is exactly where its pulse
 * is drawn, at the zoom you already had. So following a pulse shows nothing more than the pulse itself.
 */

export interface Spot {
  x: number;
  y: number;
}

/** Where things happen on the map: each territory's label point, and each province's centre (for fogged pulses). */
export interface ReplaySpots {
  territory: ReadonlyMap<string, Spot>;
  province: ReadonlyMap<string, Spot>;
}

export function replaySpots(map: MapDef): ReplaySpots {
  const territory = new Map(map.geometry!.territories.map((t) => [t.id, { x: t.label.x, y: t.label.y }]));
  const sums = new Map<string, { x: number; y: number; n: number }>();
  for (const t of map.territories) {
    const l = territory.get(t.id)!;
    const s = sums.get(t.province) ?? { x: 0, y: 0, n: 0 };
    sums.set(t.province, { x: s.x + l.x, y: s.y + l.y, n: s.n + 1 });
  }
  const province = new Map([...sums].map(([p, s]) => [p, { x: s.x / s.n, y: s.y / s.n }]));
  return { territory, province };
}

/** The spot a beat is about, or null for beats with no place (the intro, eliminations, the end of the game). */
export function focusOf(beat: Beat, spots: ReplaySpots): Spot | null {
  const e: ReplayEvent | undefined = beat.events[0];
  if (!e) return null;
  switch (e.type) {
    case "moved":
    case "battle":
      return spots.territory.get(e.to) ?? null;
    case "recruited":
    case "hired":
    case "built":
    case "completed":
    case "invested":
    case "leaderReturned":
    case "leaderKilled":
    case "generalCaptured":
    case "generalLost":
      return spots.territory.get(e.territory) ?? null;
    case "worldEvent":
      return spots.territory.get(e.target) ?? null;
    case "spoilsTurnedIn":
    case "fate":
      return spots.territory.get(e.at) ?? null;
    case "missionDone":
      return e.at ? (spots.territory.get(e.at) ?? null) : null;
    case "surface":
      return spots.province.get(e.province) ?? null;
    default:
      return null;
  }
}

export interface CameraMove {
  /** ms from the start of the replay. */
  at: number;
  cam: Camera;
  /** How long the glide takes (ms). */
  ms: number;
}

/** A glide's length: unhurried, but well inside the shortest beat. */
export const CAMERA_EASE_MS = 450;
/** After a glide the camera holds at least this long (ms), so it never ping-pongs between beats. */
export const CAMERA_HOLD_MS = 2200;
/** The beats worth moving the camera for. */
const FOLLOWED: ReadonlySet<Beat["kind"]> = new Set(["battle", "pulse", "leaderFell"]);
/** A spot this close (px) to the edge of the free screen counts as off screen. */
const EDGE_PX = 48;

/** Is a map spot inside the free part of the screen (not under the menus), with a margin? */
export function inView(cam: Camera, vp: Viewport, s: Spot, margin = EDGE_PX): boolean {
  const u = usable(vp);
  const [x, y] = toScreen(cam, s.x, s.y);
  return x >= u.left + margin && x <= u.left + u.width - margin && y >= u.top + margin && y <= u.top + u.height - margin;
}

/** The camera with a spot in the middle of the free screen, at the same zoom. */
export function centredOn(cam: Camera, vp: Viewport, s: Spot): Camera {
  const u = usable(vp);
  return { scale: cam.scale, x: u.left + u.width / 2 - s.x * cam.scale, y: u.top + u.height / 2 - s.y * cam.scale };
}

/**
 * The camera moves for one replay, starting from (and ending at) `home`. For each followed beat: if its spot is
 * already on screen, or the camera moved less than CAMERA_HOLD_MS ago, stay; if home can see it, go home;
 * otherwise centre on it. Back home at the end.
 *
 * Chains: a battle that pushes on from the land the last followed battle took (the next hop of a chain, often into
 * land that only just came out of the fog) is followed even inside the hold, so a chain running off screen stays in
 * view. It only ever moves on in the chain's direction, so it can't ping-pong.
 *
 * Your own battles (and battles against you) come first: one may cut short a hold that started for something less
 * important (a fogged pulse, or someone else's battle), so the camera is never off watching the fog while your army
 * takes land. Give `me` to turn this on.
 */
export function planReplayCamera(timeline: Timeline, spots: ReplaySpots, home: Camera, vp: Viewport, me: string | null = null): CameraMove[] {
  const moves: CameraMove[] = [];
  let cur = home;
  let lastAt = -Infinity;
  /** Where the last followed battle was fought, and by whom (to recognise the next hop of a chain). */
  let lastTaken: { player: string; at: string } | null = null;
  /** Was the last glide for one of your own battles? */
  let lastMine = false;
  for (const beat of timeline.beats) {
    // Fate or the Fallen on your own land (session 16): always worth the camera, as much as your own battles.
    const loud = !!me && beat.events.some((x) => (x.type === "fate" && x.holder === me) || (x.type === "worldEvent" && x.against === me));
    if (!FOLLOWED.has(beat.kind) && !loud) continue;
    const e = loud ? beat.events.find((x) => (x.type === "fate" && x.holder === me) || (x.type === "worldEvent" && x.against === me)) : beat.events[0];
    const hop = !!lastTaken && e?.type === "battle" && e.player === lastTaken.player && e.from === lastTaken.at;
    const mine = loud || (!!me && e?.type === "battle" && (e.player === me || e.defender === me));
    if (beat.start - lastAt < CAMERA_HOLD_MS && !hop && !(mine && !lastMine)) continue;
    const s = focusOf(loud && e ? { ...beat, events: [e] } : beat, spots);
    if (!s || inView(cur, vp, s)) {
      if (hop && e?.type === "battle") lastTaken = { player: e.player, at: e.to };
      continue;
    }
    lastAt = beat.start;
    lastMine = mine;
    lastTaken = e?.type === "battle" ? { player: e.player, at: e.to } : null;
    cur = inView(home, vp, s) ? home : centredOn(cur, vp, s);
    moves.push({ at: beat.start, cam: cur, ms: CAMERA_EASE_MS });
  }
  if (cur !== home) moves.push({ at: timeline.total, cam: home, ms: CAMERA_EASE_MS });
  return moves;
}
