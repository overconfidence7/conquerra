/**
 * A map's picture for the lobby (session 25b): its ground grid shrunk to about THUMB_COLS cells across, each cell the
 * ground most of it is, run-length coded. Made by scripts/map-thumbs.ts; painted by the lobby (no map has to load).
 */

export const THUMB_COLS = 72;

export interface MapThumb {
  cols: number;
  rows: number;
  /** Run-length coded ground: a biome code, then how many cells of it ("O14g3f2"). */
  data: string;
}

/** Shrinks a ground grid (one character a cell) to about `cols` across, each cell its most common ground. */
export function shrinkGround(g: { cols: number; rows: number; data: string }, cols = THUMB_COLS): MapThumb {
  const k = Math.max(1, g.cols / cols);
  const w = Math.max(1, Math.round(g.cols / k)), h = Math.max(1, Math.round(g.rows / k));
  let out = "";
  for (let r = 0; r < h; r++)
    for (let c = 0; c < w; c++) {
      const count = new Map<string, number>();
      for (let y = Math.floor(r * k); y < Math.min(g.rows, Math.floor((r + 1) * k)); y++)
        for (let x = Math.floor(c * k); x < Math.min(g.cols, Math.floor((c + 1) * k)); x++) {
          const ch = g.data[y * g.cols + x]!;
          count.set(ch, (count.get(ch) ?? 0) + 1);
        }
      out += [...count].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0] ?? "O";
    }
  return { cols: w, rows: h, data: encodeRuns(out) };
}

export function encodeRuns(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; ) {
    let j = i;
    while (j < s.length && s[j] === s[i]) j++;
    out += `${s[i]}${j - i}`;
    i = j;
  }
  return out;
}

export function decodeRuns(s: string): string {
  let out = "";
  for (const m of s.matchAll(/([A-Za-z])(\d+)/g)) out += m[1]!.repeat(Number(m[2]));
  return out;
}

/** Every official map's picture, by id (Node: reads the maps). */
export async function mapThumbs(): Promise<Record<string, MapThumb>> {
  const { mapCatalog } = await import("@conquerra/content");
  const { maps } = await import("@conquerra/content/maps");
  return Object.fromEntries(mapCatalog.map((m) => [m.id, shrinkGround(maps[m.id]!.geometry!.biome)]));
}

/** The painted colours, by ground code: sea, shallows, then the land. */
export const THUMB_COLOURS: Record<string, string> = {
  O: "#1b3a52",
  o: "#2b5a78",
  g: "#7d9656",
  a: "#a39f63",
  f: "#4c6b3c",
  h: "#958560",
  r: "#857f74",
  s: "#dfe1e6",
  w: "#5c6a4c",
  d: "#cdb983",
};
