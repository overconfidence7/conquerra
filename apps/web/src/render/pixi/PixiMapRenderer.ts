import { Application, Container } from "pixi.js";
import { ArtBook } from "../../art/book";
import { centreOn, fitCamera, landFrame, toMap, type Camera, type Insets } from "../../map/camera";
import { hitTester, type HitTester } from "../../map/shapes";
import { detailMix, MID_FROM_PX, NEAR_FROM_PX, scaleForPx, typicalTerritorySize, zoomDetail, type ZoomDetail } from "../../map/zoom";
import { attachInput, CameraController } from "../controls";
import type { MapEvents, MapRenderer, MapScene, RendererOptions } from "../types";
import { TextureBank } from "./bank";
import { InfoLayer } from "./info";
import { MarkerLayer } from "./markers";
import { ReplayLayer } from "./replayLayer";
import type { ReplayFrame } from "../../replay/timeline";
import { sceneryFor } from "./scenery";
import { WorldLayer } from "./world";

/** How long the fog takes to lift off newly seen land (or settle on land you lost sight of). */
export const FOG_FADE_MS = 300;

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
  /** Near detail (session 16): pixels per map unit, Near tiles painted so far and kept now, and ms spent painting them. */
  nearPpu: number;
  nearBaked: number;
  nearKept: number;
  nearMs: number;
  /** Pieces of the bigger Near art that have arrived. */
  hdArt: number;
  steps: Record<string, number>;
}

class PixiMapRenderer implements MapRenderer {
  readonly kind = "illustrated" as const;
  private app = new Application();
  private cam: CameraController;
  private world!: WorldLayer;
  private info!: InfoLayer;
  private markers!: MarkerLayer;
  private replay!: ReplayLayer;
  private replayFrame: ReplayFrame | null = null;
  private bank!: TextureBank;
  private art!: ArtBook;
  private mapLayer = new Container();
  private scene: MapScene | null = null;
  /** Which land the fog mask was last drawn for: it's only redrawn when that changes. */
  private fogKey: string | null = null;
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
  private steps: Record<string, number> = {};

  constructor(
    private opts: RendererOptions,
    private events: MapEvents,
  ) {
    const g = opts.ctx.map.geometry!;
    this.territorySize = typicalTerritorySize(opts.ctx.map);
    this.cam = new CameraController(landFrame(g), this.territorySize);
    this.tactical = opts.tactical;
    this.detail = zoomDetail(1, this.territorySize);
    this.hit = hitTester(g);
  }

  async init() {
    const { host, ctx } = this.opts;
    const g = ctx.map.geometry!;
    let t = performance.now();
    const mark = (name: string) => {
      this.steps[name] = Math.round(performance.now() - t);
      t = performance.now();
    };
    // The art and fonts start downloading straight away; the WebGL set-up and the scenery happen while they arrive.
    const loading = Promise.all([ArtBook.load(), fontsReady()]);
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

    mark("webgl");
    const scenery = sceneryFor(ctx.map);
    mark("scenery");
    [this.art] = await loading;
    if (this.destroyed) return;
    mark("artAndFonts");
    this.bank = new TextureBank(this.art);
    // Painted detail: 2.5 pixels per map unit, less on phones and big maps to keep memory sensible.
    const phone = Math.min(screen.width, screen.height) < 700;
    const budget = phone ? 8e6 : 14e6;
    const ppu = Math.min(2.5, Math.sqrt(budget / (g.width * g.height)));
    // Near detail (session 16): as sharp as the screen shows at the deepest zoom, up to 3x the Mid detail (and 6),
    // painted only where you look; a small cache (each tile about 1 MB), smaller on phones.
    const deepest = scaleForPx(NEAR_FROM_PX * 2.4, this.territorySize) * this.app.renderer.resolution;
    const nearPpu = Math.min(ppu * 3, deepest, 6);
    this.world = new WorldLayer(this.app.renderer, ctx.map, this.art, { ppu, nearPpu: nearPpu > ppu * 1.3 ? nearPpu : 0, nearCap: phone ? 20 : 32 }, scenery);
    mark("world");
    this.info = new InfoLayer(ctx.map, this.bank);
    this.info.onRealms = (realms) => this.world.setOwners(realms);
    mark("labels");
    this.markers = new MarkerLayer(ctx.map, this.bank, this.app.renderer.resolution);
    this.mapLayer.addChild(this.world.view, this.info.tactical, this.info.lines, this.info.realmLayer.root, this.info.gates, this.info.glow, this.info.sites, this.info.figures, this.info.names, this.info.links, this.info.arrows);
    this.replay = new ReplayLayer(ctx.map);
    this.app.stage.addChild(this.mapLayer, this.markers.root, this.replay.root);
    this.world.bakeFar();
    mark("far");

    this.cam.onChange(() => (this.dirtyCam = true));
    this.cam.setViewport({ width: host.clientWidth, height: host.clientHeight, ...(this.opts.insets ? { insets: this.opts.insets } : {}) });
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
    // The bigger art for the Near zoom (session 16) comes once the map is on screen, so it never slows the first paint.
    if (this.world.opts.nearPpu)
      void this.art.loadHd().then((n) => {
        if (!n || this.destroyed) return;
        this.world.hdArrived();
        this.dirtyCam = true;
      });
  }

  /** Start at Mid zoom on your capital when the whole map would be too small (phones); otherwise show it all. */
  private startView() {
    const g = this.opts.ctx.map.geometry!;
    const fit = fitCamera(this.cam.map, this.cam.vp);
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
    this.world.tickFog(now);
    this.info.realmLayer.tick((now - this.t0) / 1000);
    // Paint remaining tiles a couple per frame, nearest the screen first.
    if (this.world.pendingTiles) {
      this.world.bakeTiles(this.cam.animating ? 1 : 2, this.cam.cam, this.cam.vp);
      this.dirtyCam = true;
    }
    // Near tiles where you're looking: one a frame while the camera moves, two when it's still.
    if (this.world.pendingNear) {
      this.world.bakeNear(this.cam.animating ? 1 : 2);
      this.dirtyCam = true;
    }
    if (this.dirtyCam) this.applyCamera();
    if (this.replayFrame && this.scene) this.replay.draw(this.replayFrame, this.cam.cam, this.scene.view);
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
    this.world.setTint(mix.tint);
    this.world.display.uniforms.uFar = this.tactical ? 0 : this.detail.far;
    this.world.setDim(mix.dim);
    this.world.update(c, this.cam.vp, this.app.renderer.resolution);
    this.info.setZoom(c.scale, mix);
    const rebuilt = this.scene ? this.markers.update(this.scene, mix, this.tactical) : false;
    this.markers.setAlphas(mix, this.tactical);
    this.markers.screen = { width: this.cam.vp.width, height: this.cam.vp.height };
    if (rebuilt || this.laidOutScale === 0 || Math.abs(Math.log(c.scale / this.laidOutScale)) > 0.02) {
      this.laidOutScale = c.scale;
      this.markers.layout(c, this.detail);
    } else this.markers.place(c, this.detail);
    if (prev !== this.detail.level) this.events.zoomChanged?.(this.detail.level);
    const [vx, vy] = toMap(c, 0, 0);
    this.events.viewMoved?.({ x: vx, y: vy, width: this.cam.vp.width / c.scale, height: this.cam.vp.height / c.scale });
  }

  private applyMode() {
    this.world.view.visible = !this.tactical;
    this.app.renderer.background.color = this.tactical ? 0x24506e : 0x173a5c;
  }

  setScene(scene: MapScene) {
    this.scene = scene;
    // Captured generals' portraits load the first time one shows on the map, then the markers redraw.
    const portraits = new Set<string>();
    for (const t of Object.values(scene.view.territories))
      if (t.detail === "full")
        for (const g of t.generals ?? []) portraits.add(`leader-${String((Math.max(0, scene.view.players.findIndex((p) => p.id === g)) % 10) + 1).padStart(2, "0")}`);
    if (portraits.size)
      void this.art.ensure([...portraits]).then((added) => {
        if (!added || !this.scene) return;
        this.bank.forget([...portraits]);
        this.markers.update(this.scene, detailMix(this.detail, this.tactical), this.tactical, true);
        this.laidOutScale = 0;
        this.dirtyCam = true;
      });
    if (!this.world) return;
    // The fog mask only changes when vision does (during the replay: as land comes into view or fogs over), and
    // then it eases across in FOG_FADE_MS rather than jumping.
    // (The Fallen's political map isn't fogged: they see who holds what everywhere.)
    const fogged = this.opts.ctx.map.geometry!.territories.filter((t) => {
      const v = scene.view.territories[t.id];
      return v?.detail !== "full" && !(v?.detail === "fogged" && v.lastSeen?.political);
    });
    const fogKey = fogged.map((t) => t.id).join("|");
    if (fogKey !== this.fogKey) {
      this.world.setFog(fogged, this.fogKey === null ? 0 : FOG_FADE_MS);
      this.fogKey = fogKey;
    }
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

  viewState() {
    return { cam: { ...this.cam.cam }, vp: this.cam.vp, userMoves: this.cam.userMoves };
  }

  glideTo(cam: Camera, ms: number) {
    this.cam.set(cam, ms);
  }

  centreOn(x: number, y: number) {
    this.cam.centreOn(x, y, this.cam.cam.scale, 320);
  }

  setReplay(frame: ReplayFrame | null) {
    this.replayFrame = frame;
    if (!frame && this.replay && this.scene) this.replay.draw(null, this.cam.cam, this.scene.view);
  }

  setInsets(insets: Insets) {
    this.opts.insets = insets;
    this.cam.setInsets(insets);
  }

  zoomBy(f: number) {
    this.cam.zoomAt(f, this.cam.vp.width / 2, this.cam.vp.height / 2, 200);
  }

  resize() {
    const { host } = this.opts;
    if (!host.clientWidth || !host.clientHeight) return;
    this.app.renderer.resize(host.clientWidth, host.clientHeight);
    this.cam.setViewport({ width: host.clientWidth, height: host.clientHeight, ...(this.cam.vp.insets ? { insets: this.cam.vp.insets } : {}) });
  }

  /** Near tiles on screen still being painted (for the scripts that wait for a sharp picture). */
  pendingNear(): number {
    return this.world?.pendingNear ?? 0;
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
      nearPpu: Math.round((this.world.opts.nearPpu ?? 0) * 100) / 100,
      nearBaked: s.nearBaked,
      nearKept: s.nearKept,
      nearMs: Math.round(s.nearMs),
      hdArt: this.art.hdCount,
      steps: { ...this.steps, ...s.steps },
    };
  }

  /** Show or hide place and province names (the map lab's toggle). */
  setNamesVisible(on: boolean) {
    if (this.info) this.info.names.visible = on;
  }

  /** A PNG of the map as it looks now (the map lab's "Save image"). */
  snapshot(): string {
    this.app.render();
    return this.app.canvas.toDataURL("image/png");
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
      this.replay?.destroy();
      this.bank?.destroy();
      this.app.destroy({ removeView: true }, { children: true });
    } catch {
      // Already torn down (React strict mode mounts twice in development).
    }
  }
}

export type IllustratedRenderer = MapRenderer & { stats(): MapStats; setNamesVisible(on: boolean): void; snapshot(): string; readonly camera: CameraController };

export async function createIllustratedRenderer(opts: RendererOptions): Promise<IllustratedRenderer> {
  const r = new PixiMapRenderer(opts, opts.events);
  await r.init();
  return r;
}
