import type { MapDef } from "@conquerra/content";

/**
 * Zoom levels (docs/06-art-direction.md):
 *   Far  - illustration dimmed, House tint stronger, pills show numbers only, province names large
 *   Mid  - full illustration, borders, troop pills and building icons (the default)
 *   Near - plus specialist figures and icons, culture dots, gold value and territory names
 * The level depends on how big a typical territory looks on screen, so it means the same on a phone and a
 * laptop, and on a small or big map.
 */
export type ZoomLevel = "far" | "mid" | "near";

/** A typical territory's width on screen (px) where Mid starts and where Near starts. */
export const MID_FROM_PX = 72;
export const NEAR_FROM_PX = 190;
/** Fades between levels span this share either side of the threshold (in zoom terms), so nothing pops. */
const FADE = 0.18;

export interface ZoomDetail {
  level: ZoomLevel;
  /** A typical territory's width on screen, in px. */
  territoryPx: number;
  /** 1 = fully Far, 0 = Mid or closer, in between while fading. */
  far: number;
  /** 1 = fully Near, 0 = Mid or further out. */
  near: number;
}

/** A typical territory's width in map units: the side of a square with the average territory's area. */
export function typicalTerritorySize(map: MapDef): number {
  const g = map.geometry;
  if (!g) return 100;
  // Shoelace area of each territory's rings.
  let area = 0;
  for (const t of g.territories) {
    let a = 0;
    t.rings.forEach((r, i) => {
      let s = 0;
      for (let k = 0; k < r.length; k += 2) {
        const j = (k + 2) % r.length;
        s += r[k]! * r[j + 1]! - r[j]! * r[k + 1]!;
      }
      // The first ring is the outline; later rings are holes (lakes).
      a += i === 0 ? Math.abs(s) / 2 : -Math.abs(s) / 2;
    });
    area += Math.max(0, a);
  }
  return Math.sqrt(area / g.territories.length);
}

const smooth = (t: number) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};

/** Which level we're at, and how far into each fade. */
export function zoomDetail(scale: number, territorySize: number): ZoomDetail {
  const px = scale * territorySize;
  const level: ZoomLevel = px < MID_FROM_PX ? "far" : px < NEAR_FROM_PX ? "mid" : "near";
  // Fade in log space around each threshold.
  const lf = Math.log(px / MID_FROM_PX) / FADE, ln = Math.log(px / NEAR_FROM_PX) / FADE;
  return { level, territoryPx: px, far: smooth(0.5 - lf / 2), near: smooth(0.5 + ln / 2) };
}

/** The scale where a typical territory is `px` wide. */
export const scaleForPx = (px: number, territorySize: number) => px / territorySize;

/** What each layer of the map shows at this zoom (0 = hidden, 1 = full), in illustrated or Tactical view. */
export interface DetailMix {
  /** How much to darken the illustration (Far dims it). */
  dim: number;
  /** Flat House tint over owned land (Far zoom; the border wash covers Mid and Near). */
  tint: number;
  /** Province names painted on the land: Far only (session 16: at Mid and Near, tap a territory to see its province). */
  provinceNames: number;
  /** Sea, lake and mountain range names. */
  placeNames: number;
  /** Banners, crowns and building icons next to the pills. */
  icons: number;
  /** Specialist figures and icons, culture dots and gold value. */
  nearDetail: number;
  /** Territory names on the markers. */
  names: number;
}

export function detailMix(z: Pick<ZoomDetail, "far" | "near">, tactical: boolean): DetailMix {
  if (tactical)
    // Tactical view shows every detail at every zoom; names once there's room for them.
    return { dim: 0, tint: 1, provinceNames: z.far, placeNames: 1 - 0.6 * z.near, icons: 1, nearDetail: 1, names: 1 - z.far };
  return {
    dim: 0.38 * z.far,
    // Mid and Near: the House wash along the border only. Far: a stronger flat tint over the whole land.
    tint: 0.55 * z.far,
    provinceNames: z.far,
    placeNames: Math.max(0, 0.4 + 0.6 * z.far - 0.4 * z.near),
    icons: 1 - z.far,
    nearDetail: z.near,
    names: z.near,
  };
}
