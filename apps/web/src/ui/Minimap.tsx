import type { GameContext, PlayerView } from "@conquerra/engine";
import { useEffect, useRef } from "react";
import { houseOf } from "../map/houses";
import { territoryStatus } from "../map/status";

export interface ViewRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A small Tactical-style overview: flat House colours (fog rules apply: fogged land is grey, last-seen land a faded
 * colour), with a rectangle for the part of the map on screen. Tap it to jump there.
 */
export function Minimap({ ctx, view, rect, onJump }: { ctx: GameContext; view: PlayerView; rect: ViewRect | null; onJump(x: number, y: number): void }) {
  const base = useRef<HTMLCanvasElement>(null);
  const over = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const g = ctx.map.geometry!;

  // Fit the map into the box, keeping its shape.
  const fit = () => {
    const el = box.current!;
    const w = el.clientWidth, h = el.clientHeight;
    const s = Math.min(w / g.width, h / g.height);
    return { s, ox: (w - g.width * s) / 2, oy: (h - g.height * s) / 2, w, h };
  };

  useEffect(() => {
    const c = base.current;
    if (!c || !box.current) return;
    const { s, ox, oy, w, h } = fit();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = w * dpr;
    c.height = h * dpr;
    const x = c.getContext("2d")!;
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.fillStyle = "#24506e";
    x.fillRect(0, 0, w, h);
    x.translate(ox, oy);
    x.scale(s, s);
    const path = (rings: readonly (readonly number[])[]) => {
      const p = new Path2D();
      for (const r of rings) {
        p.moveTo(r[0]!, r[1]!);
        for (let i = 2; i < r.length; i += 2) p.lineTo(r[i]!, r[i + 1]!);
        p.closePath();
      }
      return p;
    };
    for (const m of g.mountains) {
      x.fillStyle = "#5a5650";
      x.fill(path(m.rings), "evenodd");
    }
    for (const t of g.territories) {
      const st = territoryStatus(view, t.id);
      x.fillStyle = st.kind === "seen" ? (st.owner ? houseOf(view, st.owner).color : "#d4c9aa") : st.kind === "remembered" && st.owner ? `${houseOf(view, st.owner).color}88` : "#7d8087";
      x.fill(path(t.rings), "evenodd");
    }
    x.strokeStyle = "rgba(27,18,6,0.6)";
    x.lineWidth = 1 / s;
    for (const t of g.territories) x.stroke(path(t.rings));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, ctx.map]);

  useEffect(() => {
    const c = over.current;
    if (!c || !box.current) return;
    const { s, ox, oy, w, h } = fit();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = w * dpr;
    c.height = h * dpr;
    const x = c.getContext("2d")!;
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!rect) return;
    x.strokeStyle = "#e3c77e";
    x.lineWidth = 2;
    // Clamp to the map, so at full zoom-out the box hugs the map instead of vanishing off the edges.
    const x0 = Math.max(0, rect.x), y0 = Math.max(0, rect.y), x1 = Math.min(g.width, rect.x + rect.width), y1 = Math.min(g.height, rect.y + rect.height);
    if (x1 > x0 && y1 > y0) x.strokeRect(ox + x0 * s + 1, oy + y0 * s + 1, (x1 - x0) * s - 2, (y1 - y0) * s - 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rect]);

  const jump = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    const { s, ox, oy } = fit();
    onJump((e.clientX - r.left - ox) / s, (e.clientY - r.top - oy) / s);
  };

  return (
    <div className="minimap" ref={box} onPointerDown={jump} role="button" aria-label="Minimap: tap to jump there">
      <canvas ref={base} />
      <canvas ref={over} />
    </div>
  );
}
