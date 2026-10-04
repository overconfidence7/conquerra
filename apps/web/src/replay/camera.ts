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
      return spots.territory.get(e.territory) ?? null;
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
 */
export function planReplayCamera(timeline: Timeline, spots: ReplaySpots, home: Camera, vp: Viewport): CameraMove[] {
  const moves: CameraMove[] = [];
  let cur = home;
  let lastAt = -Infinity;
  for (const beat of timeline.beats) {
    if (!FOLLOWED.has(beat.kind) || beat.start - lastAt < CAMERA_HOLD_MS) continue;
    const s = focusOf(beat, spots);
    if (!s || inView(cur, vp, s)) continue;
    lastAt = beat.start;
    cur = inView(home, vp, s) ? home : centredOn(cur, vp, s);
    moves.push({ at: beat.start, cam: cur, ms: CAMERA_EASE_MS });
  }
  if (cur !== home) moves.push({ at: timeline.total, cam: home, ms: CAMERA_EASE_MS });
  return moves;
}
