import { Application, Container } from "pixi.js";
import { ArtBook } from "../../art/book";
import { centreOn, fitCamera, toMap } from "../../map/camera";
import { hitTester, type HitTester } from "../../map/shapes";
import { detailMix, MID_FROM_PX, scaleForPx, typicalTerritorySize, zoomDetail, type ZoomDetail } from "../../map/zoom";
import { attachInput, CameraController } from "../controls";
import type { MapEvents, MapRenderer, MapScene, RendererOptions } from "../types";
import { TextureBank } from "./bank";
import { InfoLayer } from "./info";
import { MarkerLayer } from "./markers";
import { WorldLayer } from "./world";

/** Can this browser do WebGL at all? If not, the UI uses the plain (SVG) Tactical map instead. */
export function webglAvailable(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

async function fontsReady() {
  try {
    await Promise.race([
      Promise.all(["800 20px Manrope", "700 20px Cinzel", "italic 600 20px Cinzel"].map((f) => document.fonts.load(f))),
      new Promise((r) => setTimeout(r, 2000)),
    ]);
  } catch {
    // Fall back to system fonts.
  }
}

export interface MapStats {
  /** ms from the renderer starting to the first frame with the painted map. */
  firstMapMs: number;
  /** Total ms spent painting the world (Far image and tiles). */
  bakeMs: number;
  tilesBaked: number;
  tileCount: number;
  /** Rough GPU memory for the painted world, MB. */
  textureMB: number;
  /** Frames per second over the last two seconds. */
  fps: number;
  level: ZoomDetail["level"];
  markers: number;
  realArt: string[];
  ppu: number;
}

class PixiMapRenderer implements MapRenderer {
  readonly kind = "illustrated" as const;
  private app = new Application();
  private cam: CameraController;
  private world!: WorldLayer;
  private info!: InfoLayer;
  private markers!: MarkerLayer;
  private bank!: TextureBank;
  private art!: ArtBook;
  private mapLayer = new Container();
  private scene: MapScene | null = null;
  private tactical: boolean;
  private detail: ZoomDetail;
  private hit: HitTester;
  private territorySize: number;
  private dirtyCam = true;
  private laidOutScale = 0;
  private detachInput: (() => void) | null = null;
  private resizeObs: ResizeObserver | null = null;
  private frameTimes: number[] = [];
  private t0 = performance.now();
  private firstMapMs = 0;
  private destroyed = false;
  private hovering: string | null = null;

  constructor(
    private opts: RendererOptions,
    private events: MapEvents,
  ) {
    const g = opts.ctx.map.geometry!;
    this.territorySize = typicalTerritorySize(opts.ctx.map);
    this.cam = new CameraController({ width: g.width, height: g.height }, this.territorySize);
    this.tactical = opts.tactical;
    this.detail = zoomDetail(1, this.territorySize);
    this.hit = hitTester(g);
  }

  async init() {
    const { host, ctx } = this.opts;
    const g = ctx.map.geometry!;
    await this.app.init({
      resizeTo: host,
      background: "#173a5c",
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      preference: "webgl",
      powerPreference: "high-performance",
    });
    if (this.destroyed) return;
    const canvas = this.app.canvas;
    canvas.style.display = "block";
    canvas.style.touchAction = "none";
    host.appendChild(canvas);
    this.app.stage.eventMode = "none";
    this.app.stage.interactiveChildren = false;

    [this.art] = await Promise.all([ArtBook.load(), fontsReady()]);
    if (this.destroyed) return;
    this.bank = new TextureBank(this.art);
    // Painted detail: 2.5 pixels per map unit, less on phones and big maps to keep memory sensible.
    const phone = Math.min(screen.width, screen.height) < 700;
    const budget = phone ? 8e6 : 14e6;
    const ppu = Math.min(2.5, Math.sqrt(budget / (g.width * g.height)));
    this.world = new WorldLayer(this.app.renderer, g, this.art, { ppu });
    this.info = new InfoLayer(ctx.map, this.bank);
    this.markers = new MarkerLayer(ctx.map, this.bank, this.app.renderer.resolution);
    this.mapLayer.addChild(this.world.view, this.info.tactical, this.info.tint, this.info.lines, this.info.glow, this.info.sites, this.info.figures, this.info.names, this.info.arrows);
    this.app.stage.addChild(this.mapLayer, this.markers.root);
    this.world.bakeFar();

    this.cam.onChange(() => (this.dirtyCam = true));
    this.cam.setViewport({ width: host.clientWidth, height: host.clientHeight });
    this.startView();
    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(host);
    this.detachInput = attachInput(canvas, this.cam, {
      tap: (sx, sy) => {
        const [mx, my] = toMap(this.cam.cam, sx, sy);
        this.events.tap(this.hit.at(mx, my));
      },
      doubleTap: (sx, sy) => {
        if (this.cam.nearFit) this.cam.zoomAt(scaleForPx(MID_FROM_PX * 1.6, this.territorySize) / this.cam.cam.scale, sx, sy, 260);
        else this.cam.fit();
      },
      hold: (at) => this.inspect(at, "hold"),
      hover: (at) => this.inspect(at, "hover"),
    });
    this.applyMode();
    if (this.scene) this.setScene(this.scene);
    this.app.ticker.add(() => this.frame());
  }

  /** Start at Mid zoom on your capital when the whole map would be too small (phones); otherwise show it all. */
  private startView() {
    const g = this.opts.ctx.map.geometry!;
    const fit = fitCamera(g, this.cam.vp);
    const focus = this.opts.focus ? g.territories.find((t) => t.id === this.opts.focus) : null;
    if (focus && zoomDetail(fit.scale, this.territorySize).level === "far")
      this.cam.set(centreOn(focus.label.x, focus.label.y, scaleForPx(MID_FROM_PX * 1.25, this.territorySize), this.cam.vp));
    else this.cam.set(fit);
  }

  private inspect(at: { x: number; y: number } | null, how: "hover" | "hold") {
    if (!at) {
      if (this.hovering !== null || how === "hold") this.events.inspect(null, { x: 0, y: 0 }, how);
      this.hovering = null;
      return;
    }
    const [mx, my] = toMap(this.cam.cam, at.x, at.y);
    const id = this.hit.at(mx, my);
    this.app.canvas.style.cursor = id ? "pointer" : "grab";
    if (how === "hover" && id === this.hovering) {
      if (id) this.events.inspect(id, at, how);
      return;
    }
    this.hovering = id;
    this.events.inspect(id, at, how);
  }

  private frame() {
    if (this.destroyed) return;
    const now = performance.now();
    this.frameTimes.push(now);
    while (this.frameTimes.length && this.frameTimes[0]! < now - 2000) this.frameTimes.shift();
    this.cam.tick(now);
    this.world.display.uniforms.uTime = (now - this.t0) / 1000;
    // Paint remaining tiles a couple per frame, nearest the screen first.
    if (this.world.pendingTiles) {
      this.world.bakeTiles(this.cam.animating ? 1 : 2, this.cam.cam, this.cam.vp);
      this.dirtyCam = true;
    }
    if (this.dirtyCam) this.applyCamera();
    if (!this.firstMapMs) this.firstMapMs = now - this.t0;
  }

  private applyCamera() {
    this.dirtyCam = false;
    const c = this.cam.cam;
    this.mapLayer.position.set(c.x, c.y);
    this.mapLayer.scale.set(c.scale);
    const prev = this.detail.level;
    this.detail = zoomDetail(c.scale, this.territorySize);
    const mix = detailMix(this.detail, this.tactical);
    this.world.display.uniforms.uDim = mix.dim;
    this.world.update(c, this.cam.vp, this.app.renderer.resolution);
    this.info.setZoom(c.scale, mix);
    const rebuilt = this.scene ? this.markers.update(this.scene, mix, this.tactical) : false;
    this.markers.setAlphas(mix, this.tactical);
    if (rebuilt || this.laidOutScale === 0 || Math.abs(Math.log(c.scale / this.laidOutScale)) > 0.02) {
      this.laidOutScale = c.scale;
      this.markers.layout(c, this.detail);
    } else this.markers.place(c, this.detail);
    if (prev !== this.detail.level) this.events.zoomChanged?.(this.detail.level);
  }

  private applyMode() {
    this.world.view.visible = !this.tactical;
    this.app.renderer.background.color = this.tactical ? 0x24506e : 0x173a5c;
  }

  setScene(scene: MapScene) {
    this.scene = scene;
    if (!this.world) return;
    const fogged = this.opts.ctx.map.geometry!.territories.filter((t) => scene.view.territories[t.id]?.detail !== "full");
    this.world.setFog(fogged);
    this.info.setScene(scene, this.tactical);
    this.laidOutScale = 0;
    this.dirtyCam = true;
  }

  setTactical(on: boolean) {
    this.tactical = on;
    if (!this.world) return;
    this.applyMode();
    if (this.scene) this.info.setScene(this.scene, on);
    if (this.scene) this.markers.update(this.scene, detailMix(this.detail, on), on, true);
    this.laidOutScale = 0;
    this.dirtyCam = true;
  }

  fit(animate = true) {
    this.cam.fit(animate);
  }

  zoomBy(f: number) {
    this.cam.zoomAt(f, this.cam.vp.width / 2, this.cam.vp.height / 2, 200);
  }

  resize() {
    const { host } = this.opts;
    if (!host.clientWidth || !host.clientHeight) return;
    this.app.renderer.resize(host.clientWidth, host.clientHeight);
    this.cam.setViewport({ width: host.clientWidth, height: host.clientHeight });
  }

  /** Numbers for the performance report (and a quick look in the browser console). */
  stats(): MapStats {
    const s = this.world.stats;
    const span = this.frameTimes.length > 1 ? this.frameTimes[this.frameTimes.length - 1]! - this.frameTimes[0]! : 0;
    return {
      firstMapMs: Math.round(this.firstMapMs),
      bakeMs: Math.round(s.bakeMs),
      tilesBaked: s.tilesBaked,
      tileCount: s.tileCount,
      textureMB: Math.round(s.textureBytes / 1e5) / 10,
      fps: span ? Math.round(((this.frameTimes.length - 1) / span) * 1000 * 10) / 10 : 0,
      level: this.detail.level,
      markers: this.markers.count,
      realArt: this.art.realNames,
      ppu: Math.round(this.world.opts.ppu * 100) / 100,
    };
  }

  /** For the perf script and screenshots: drive the camera directly. */
  get camera() {
    return this.cam;
  }

  markerBoxes() {
    return this.markers.boxes();
  }

  destroy() {
    this.destroyed = true;
    this.detachInput?.();
    this.resizeObs?.disconnect();
    try {
      this.world?.destroy();
      this.info?.destroy();
      this.markers?.destroy();
      this.bank?.destroy();
      this.app.destroy({ removeView: true }, { children: true });
    } catch {
      // Already torn down (React strict mode mounts twice in development).
    }
  }
}

export async function createIllustratedRenderer(opts: RendererOptions): Promise<MapRenderer & { stats(): MapStats }> {
  const r = new PixiMapRenderer(opts, opts.events);
  await r.init();
  return r;
}
