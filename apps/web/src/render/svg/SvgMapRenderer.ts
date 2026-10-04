import type { Line } from "@conquerra/content";
import { landFrame, toMap, type Camera, type Insets } from "../../map/camera";
import { houseOf } from "../../map/houses";
import { hitTester } from "../../map/shapes";
import { territoryStatus } from "../../map/status";
import { typicalTerritorySize } from "../../map/zoom";
import { attachInput, CameraController } from "../controls";
import type { MapEvents, MapRenderer, MapScene, RendererOptions } from "../types";

/**
 * The fallback map for browsers without WebGL: flat House colours (the Tactical look) in plain SVG, with the same
 * pan, zoom, taps and cards. Simpler than the illustrated map, but every game fact is there.
 */

const NS = "http://www.w3.org/2000/svg";
const el = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, parent?: Element) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  parent?.appendChild(e);
  return e;
};
const path = (rings: readonly Line[], close = true) =>
  rings.map((r) => r.reduce<string>((d, v, i) => (i % 2 ? `${d},${v}` : `${d}${i ? "L" : "M"}${v}`), "") + (close ? "Z" : "")).join("");

class SvgMapRenderer implements MapRenderer {
  readonly kind = "svg" as const;
  private svg: SVGSVGElement;
  private root: SVGGElement;
  private dynamic: SVGGElement;
  private cam: CameraController;
  private detach: () => void;
  private scene: MapScene | null = null;
  private obs: ResizeObserver;

  constructor(
    private opts: RendererOptions,
    events: MapEvents,
  ) {
    const g = opts.ctx.map.geometry!;
    this.svg = el("svg", { class: "map-svg", role: "img", "aria-label": "Game map" });
    this.svg.style.cssText = "display:block;width:100%;height:100%;touch-action:none;background:#24506e";
    this.root = el("g", {}, this.svg);
    // Static geography.
    for (const w of g.water) el("path", { d: path(w.rings), fill: "#24506e", "fill-rule": "evenodd" }, this.root);
    this.dynamic = el("g", {}, this.root);
    const geo = el("g", { "pointer-events": "none" }, this.root);
    for (const m of g.mountains) el("path", { d: path(m.rings), fill: "#5a5650", stroke: "#2d2a26", "stroke-width": 1.2, "fill-rule": "evenodd" }, geo);
    for (const r of g.rivers) el("path", { d: path([r.path], false), fill: "none", stroke: "#4f9bd0", "stroke-width": 2.4, "stroke-linecap": "round" }, geo);
    for (const l of g.seaLanes) el("path", { d: path([l.path], false), fill: "none", stroke: "#f2f2f2", "stroke-width": 2, "stroke-dasharray": "6 5" }, geo);
    for (const p of g.passes) el("circle", { cx: p.x, cy: p.y, r: 6, fill: "#e8d39a", stroke: "#1b1206", "stroke-width": 1.5 }, geo);
    opts.host.appendChild(this.svg);
    this.cam = new CameraController(landFrame(g), typicalTerritorySize(opts.ctx.map));
    let drawnScale = 0, pending = false;
    this.cam.onChange((c) => {
      this.root.setAttribute("transform", `translate(${c.x},${c.y}) scale(${c.scale})`);
      // Redraw (so pills and lines keep their size on screen) once the zoom has changed noticeably.
      if (this.scene && !pending && Math.abs(Math.log(c.scale / (drawnScale || c.scale * 2))) > 0.12) {
        pending = true;
        requestAnimationFrame(() => {
          pending = false;
          drawnScale = this.cam.cam.scale;
          if (this.scene) this.setScene(this.scene);
        });
      }
    });
    this.resize();
    const hit = hitTester(g);
    this.detach = attachInput(this.svg as unknown as HTMLElement, this.cam, {
      tap: (sx, sy) => events.tap(hit.at(...toMap(this.cam.cam, sx, sy))),
      doubleTap: () => this.cam.fit(),
      hold: (at) => events.inspect(at ? hit.at(...toMap(this.cam.cam, at.x, at.y)) : null, at ?? { x: 0, y: 0 }, "hold"),
      hover: (at) => events.inspect(at ? hit.at(...toMap(this.cam.cam, at.x, at.y)) : null, at ?? { x: 0, y: 0 }, "hover"),
    });
    this.obs = new ResizeObserver(() => this.resize());
    this.obs.observe(opts.host);
    const tick = () => {
      if (!this.svg.isConnected) return;
      this.cam.tick(performance.now());
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  setScene(scene: MapScene) {
    this.scene = scene;
    const { view, selected, targets, arrows } = scene;
    const g = this.opts.ctx.map.geometry!;
    this.dynamic.replaceChildren();
    const k = 1 / Math.max(0.3, this.cam.cam.scale);
    for (const t of g.territories) {
      const s = territoryStatus(view, t.id);
      const fill = s.kind === "seen" ? (s.owner ? houseOf(view, s.owner).color : "#d4c9aa") : "#7d8087";
      el("path", { d: path(t.rings), fill, "fill-rule": "evenodd", stroke: "#1b1206", "stroke-opacity": 0.45, "stroke-width": 1, opacity: s.kind === "seen" ? 1 : 0.9 }, this.dynamic);
    }
    for (const id of targets) el("path", { d: path(g.territories.find((t) => t.id === id)!.rings), fill: "rgba(255,255,255,0.15)", stroke: "#fff", "stroke-width": 2.5 * k, "stroke-dasharray": "6 4" }, this.dynamic);
    if (selected) el("path", { d: path(g.territories.find((t) => t.id === selected)!.rings), fill: "none", stroke: "#e3c77e", "stroke-width": 5 * k }, this.dynamic);
    const label = new Map(g.territories.map((t) => [t.id, t.label]));
    for (const a of arrows) {
      const pts = [a.from, ...(a.via ? [a.via] : []), a.to].map((id) => label.get(id)!);
      el("polyline", { points: pts.map((p) => `${p.x},${p.y}`).join(" "), fill: "none", stroke: a.attack ? "#c2553f" : "#3a72c4", "stroke-width": 5 * k, "stroke-linecap": "round", opacity: a.draft ? 0.75 : 1 }, this.dynamic);
    }
    for (const t of g.territories) {
      const s = territoryStatus(view, t.id);
      if (s.kind === "unknown") continue;
      const grp = el("g", { transform: `translate(${t.label.x},${t.label.y}) scale(${k})`, opacity: s.kind === "remembered" ? 0.65 : 1, "pointer-events": "none" }, this.dynamic);
      el("rect", { x: -17, y: -11, width: 34, height: 22, rx: 11, fill: "#0f1620", stroke: s.owner ? houseOf(view, s.owner).glow : "#d8cdb0", "stroke-width": 2 }, grp);
      const txt = el("text", { x: 0, y: 5, "text-anchor": "middle", fill: "#fff", "font-weight": 800, "font-size": 14, "font-family": "Manrope, system-ui, sans-serif" }, grp);
      txt.textContent = s.kind === "remembered" ? `${s.troops}?` : String(s.troops);
    }
  }

  setTactical() {
    // This map is always the Tactical look.
  }

  viewState() {
    return { cam: { ...this.cam.cam }, vp: this.cam.vp, userMoves: this.cam.userMoves };
  }

  glideTo(cam: Camera, ms: number) {
    this.cam.set(cam, ms);
  }

  centreOn(x: number, y: number) {
    this.cam.centreOn(x, y, this.cam.cam.scale, 320);
  }

  /** The plain map shows the replay through the changing view only (no marching armies). */
  setReplay() {}

  setInsets(insets: Insets) {
    this.cam.setInsets(insets);
  }

  fit(animate = true) {
    this.cam.fit(animate);
  }

  zoomBy(f: number) {
    this.cam.zoomAt(f, this.cam.vp.width / 2, this.cam.vp.height / 2, 200);
  }

  resize() {
    const { host } = this.opts;
    this.cam.setViewport({ width: host.clientWidth || 1, height: host.clientHeight || 1, ...(this.cam.vp.insets ? { insets: this.cam.vp.insets } : {}) });
  }

  destroy() {
    this.detach();
    this.obs.disconnect();
    this.svg.remove();
  }
}

export function createSvgRenderer(opts: RendererOptions): MapRenderer {
  return new SvgMapRenderer(opts, opts.events);
}
