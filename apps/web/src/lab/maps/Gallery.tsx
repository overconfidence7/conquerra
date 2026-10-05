import { BIOME_CODES, type MapDef } from "@conquerra/content";
import { useEffect, useRef } from "react";
import type { LabMade } from "./core";

/** Flat colours per ground type (thumbnails only; the preview uses the real painting). */
const COLORS: Record<string, string> = {
  [BIOME_CODES.grass]: "#8ab25c",
  [BIOME_CODES.farmland]: "#c4be6e",
  [BIOME_CODES.forest]: "#3e703a",
  [BIOME_CODES.hills]: "#969660",
  [BIOME_CODES.rock]: "#827a70",
  [BIOME_CODES.snow]: "#eceef2",
  [BIOME_CODES.swamp]: "#5e7858",
  [BIOME_CODES.sand]: "#e2ce96",
  [BIOME_CODES.shallow]: "#5a8fb0",
  [BIOME_CODES.deep]: "#2c5a88",
};

/** Draw a small picture of a map: ground colours, province borders, capital slots. */
export function drawThumbnail(c: HTMLCanvasElement, map: MapDef) {
  const g = map.geometry!;
  const scale = c.width / g.width;
  c.height = Math.round(g.height * scale);
  const ctx = c.getContext("2d")!;
  const { cols, rows, cellSize, data } = g.biome;
  for (let r = 0; r < rows; r++)
    for (let k = 0; k < cols; k++) {
      ctx.fillStyle = COLORS[data[r * cols + k]!] ?? "#f0f";
      ctx.fillRect(Math.floor(k * cellSize * scale), Math.floor(r * cellSize * scale), Math.ceil(cellSize * scale) + 1, Math.ceil(cellSize * scale) + 1);
    }
  const province = new Map(map.territories.map((t) => [t.id, t.province]));
  ctx.lineJoin = "round";
  for (const b of g.borderLines) {
    const prov = province.get(b.a) !== province.get(b.b);
    ctx.strokeStyle = prov ? "rgba(30,20,10,0.85)" : "rgba(40,30,20,0.35)";
    ctx.lineWidth = prov ? 1.4 : 0.6;
    for (const l of b.lines) {
      ctx.beginPath();
      for (let i = 0; i < l.length; i += 2) (i ? ctx.lineTo : ctx.moveTo).call(ctx, l[i]! * scale, l[i + 1]! * scale);
      ctx.stroke();
    }
  }
  ctx.strokeStyle = "rgba(255,248,230,0.9)";
  ctx.setLineDash([3, 2]);
  ctx.lineWidth = 1;
  for (const l of g.seaLanes) {
    ctx.beginPath();
    ctx.moveTo(l.path[0]! * scale, l.path[1]! * scale);
    ctx.lineTo(l.path[2]! * scale, l.path[3]! * scale);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function Thumb({ map }: { map: MapDef }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) drawThumbnail(ref.current, map);
  }, [map]);
  return <canvas ref={ref} width={300} />;
}

export interface GalleryItem {
  seed: string;
  made: LabMade | null;
}

/** 12 seeds side by side, each with a pass / fail badge. Takes finished results, so the builder can reuse it. */
export function SeedGallery({ items, onPick }: { items: GalleryItem[]; onPick(seed: string): void }) {
  return (
    <div className="lab-gallery" data-panel="gallery">
      {items.map(({ seed, made }) => (
        <button key={seed} className="lab-thumb" onClick={() => onPick(seed)} disabled={!made} title="Open this seed in the preview">
          {made?.map ? <Thumb map={made.map} /> : <div className="lab-thumb-empty">{made ? "No map" : "Making…"}</div>}
          <span className="lab-thumb-seed">{seed}</span>
          {made && (
            <span className={`lab-badge ${!made.map ? "fail" : made.attempt === 1 ? "pass" : "retry"}`}>
              {!made.map ? "✗ fails" : made.attempt === 1 ? "✓ passes" : `✓ on try ${made.attempt}`}
              <small>
                {(made.ms / 1000).toFixed(1)} s{made.map ? ` · ${made.map.provinces.length} provinces` : ""}
              </small>
            </span>
          )}
          {made && !made.map && <small className="bad">{made.rejected[0]?.split(": ").slice(1).join(": ")}</small>}
          {made && made.map && made.attempt > 1 && <small className="muted">try 1: {made.rejected[0]?.split(": ").slice(1).join(": ")}</small>}
        </button>
      ))}
    </div>
  );
}
