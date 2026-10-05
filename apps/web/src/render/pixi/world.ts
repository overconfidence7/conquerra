import type { MapDef, MapGeometry } from "@conquerra/content";
import { TERRAIN_TEXTURES, WATER_TEXTURES } from "@conquerra/art";
import { Container, Graphics, Matrix, Mesh, MeshGeometry, RenderTexture, Shader, Sprite, Texture, TilingSprite, UniformGroup, type Renderer } from "pixi.js";
import type { ArtBook } from "../../art/book";
import { canvas } from "../../art/paint";
import type { Camera, Viewport } from "../../map/camera";
import { quadPoint } from "../../map/shapes";
import { auxCanvases, biomeCanvases, type AuxData } from "./bakeData";
import { sceneryFor, type Piece, type Scenery } from "./scenery";
import { DISPLAY_FRAGMENT, GROUND_FRAGMENT, VERTEX } from "./shaders";

/**
 * The illustrated world: painted once per game into tiles (ground, relief, water, rivers, passes, sea lanes and
 * every decoration), plus one smaller "Far" image of the whole map for zoomed-out views. Each frame only shows
 * the tiles (with fog and a water shimmer), so panning stays cheap.
 */

const TILE = 1024;
/** Ground textures repeat every this many map units. */
const REPEAT_UNITS = 170;

/** Sprite widths in map units, by decoration kind. */
const DECOR_SIZE: Record<string, number> = { "tree-conifer": 17, "tree-broadleaf": 17, peak: 30, hill: 19, village: 22, town: 30 };
const DECOR_ART: Record<string, string> = { "tree-conifer": "tree-conifer", "tree-broadleaf": "tree-broadleaf", peak: "mountain", hill: "hill", village: "village", town: "town" };
const CASTLE_SIZE = 46;

export interface WorldOptions {
  /** Painted pixels per map unit (detail at Mid and Near zoom). */
  ppu: number;
}

interface Tile {
  x: number;
  y: number;
  w: number;
  h: number;
  rt: RenderTexture | null;
  mesh: Mesh<MeshGeometry, Shader> | null;
}

const quad = (x: number, y: number, w: number, h: number) =>
  new MeshGeometry({
    positions: new Float32Array([x, y, x + w, y, x + w, y + h, x, y + h]),
    uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
  });

export class WorldLayer {
  /** What's on screen: the Far image or the tiles. */
  readonly view = new Container();
  readonly display: UniformGroup<{ uMap: { value: Float32Array; type: "vec2<f32>" }; uTime: { value: number; type: "f32" }; uDim: { value: number; type: "f32" }; uMotion: { value: number; type: "f32" }; uFogMix: { value: number; type: "f32" } }>;
  private bakeScene = new Container();
  private tiles: Tile[] = [];
  private far: { rt: RenderTexture; mesh: Mesh<MeshGeometry, Shader>; ppu: number } | null = null;
  private fogCanvas: HTMLCanvasElement;
  private fogTex: Texture;
  /** The fog as it was before the last change: the display blends from it to the new fog (uFogMix 0 -> 1). */
  private fogPrevCanvas: HTMLCanvasElement;
  private fogPrevTex: Texture;
  private fogFade: { from: number; ms: number } | null = null;
  private fogDrawn = false;
  private aux: AuxData;
  /** Ridges, cliffs, bridges, gates, landmarks and forest glades, placed from the map data (scenery.ts). */
  readonly scenery: Scenery;
  private g: MapGeometry;
  private auxTex: Texture;
  private disposables: { destroy(): void }[] = [];
  private tilesLayer = new Container();
  /** Open sea beyond the map's edges, so zooming out or panning never shows a flat background. */
  private sea: TilingSprite;
  /** A second, larger and turned copy over the open sea at half strength, so its repeats never line up. */
  private seaBreak: TilingSprite;
  readonly stats = { bakeMs: 0, tilesBaked: 0, tileCount: 0, textureBytes: 0, steps: {} as Record<string, number> };
  private step(name: string, t0: number) {
    this.stats.steps[name] = Math.round(performance.now() - t0);
    return performance.now();
  }

  constructor(
    private renderer: Renderer,
    map: MapDef,
    private art: ArtBook,
    readonly opts: WorldOptions,
  ) {
    const t0 = performance.now();
    const g = (this.g = map.geometry!);
    this.scenery = sceneryFor(map);
    let t = this.step("scenery", t0);
    // The masks are soft anyway: about a million pixels is plenty, so big maps use a little less than 1 per unit.
    this.aux = auxCanvases(g, Math.min(1, Math.sqrt(1.1e6 / (g.width * g.height))), this.scenery.clearings);
    t = this.step("masks", t);
    this.auxTex = Texture.from(this.aux.aux1);
    this.display = new UniformGroup({
      uMap: { value: new Float32Array([g.width, g.height]), type: "vec2<f32>" },
      uTime: { value: 0, type: "f32" },
      uDim: { value: 0, type: "f32" },
      uMotion: { value: 1, type: "f32" },
      uFogMix: { value: 1, type: "f32" },
    });
    // Fog mask: half a pixel per map unit is plenty (it's soft anyway).
    [this.fogCanvas] = canvas(Math.ceil(g.width * 0.5), Math.ceil(g.height * 0.5));
    this.fogTex = Texture.from(this.fogCanvas);
    [this.fogPrevCanvas] = canvas(this.fogCanvas.width, this.fogCanvas.height);
    this.fogPrevTex = Texture.from(this.fogPrevCanvas);
    t = this.step("textures", t);
    this.buildBakeScene();
    this.step("scene", t);
    // Tiles cover the map; each is painted later, the ones on screen first.
    const tileUnits = TILE / opts.ppu;
    for (let y = 0; y < g.height; y += tileUnits)
      for (let x = 0; x < g.width; x += tileUnits)
        this.tiles.push({ x, y, w: Math.min(tileUnits, g.width - x), h: Math.min(tileUnits, g.height - y), rt: null, mesh: null });
    this.stats.tileCount = this.tiles.length;
    const deep = art.get("water-deep")!;
    const seaTex = Texture.from(deep.image);
    this.disposables.push(seaTex);
    const M = 3; // map sizes of sea on every side
    this.sea = new TilingSprite({ texture: seaTex, width: g.width * (2 * M + 1), height: g.height * (2 * M + 1) });
    this.sea.position.set(-g.width * M, -g.height * M);
    this.sea.tileScale.set(REPEAT_UNITS / deep.image.width);
    // Line the repeats up with the painted deep water at the map's edge.
    this.sea.tilePosition.set((g.width * M) % REPEAT_UNITS, (g.height * M) % REPEAT_UNITS);
    this.seaBreak = new TilingSprite({ texture: seaTex, width: this.sea.width, height: this.sea.height, alpha: 0.5 });
    this.seaBreak.position.copyFrom(this.sea.position);
    this.seaBreak.tileScale.set((REPEAT_UNITS * 2.37) / deep.image.width);
    this.seaBreak.tileRotation = 0.61;
    this.view.addChild(this.sea, this.seaBreak, this.tilesLayer);
    this.stats.bakeMs += performance.now() - t0;
  }

  private displayShader(tex: Texture) {
    return Shader.from({
      gl: { vertex: VERTEX, fragment: DISPLAY_FRAGMENT },
      resources: { uTile: tex.source, uFog: this.fogTex.source, uFogPrev: this.fogPrevTex.source, uAux1: this.auxTex.source, display: this.display },
    });
  }

  /** Everything that gets painted into the tiles. */
  private buildBakeScene() {
    const { g, art } = this;
    // ---- Ground textures in one atlas (4 x 3 slots) ----
    const names = [...TERRAIN_TEXTURES, ...WATER_TEXTURES];
    const arts = names.map((n) => art.get(n)!);
    const slot = arts.some((a) => a.real) ? 512 : 256;
    const [atlas, actx] = canvas(slot * 4, slot * 3);
    arts.forEach((a, i) => actx.drawImage(a.image, (i % 4) * slot, Math.floor(i / 4) * slot, slot, slot));
    const atlasTex = Texture.from(atlas);
    const biomes = biomeCanvases(g).map((c) => Texture.from(c));
    const aux2 = Texture.from(this.aux.aux2);
    const ground = new Mesh({
      geometry: quad(0, 0, g.width, g.height),
      shader: Shader.from({
        gl: { vertex: VERTEX, fragment: GROUND_FRAGMENT },
        resources: {
          uAtlas: atlasTex.source,
          uB0: biomes[0]!.source,
          uB1: biomes[1]!.source,
          uB2: biomes[2]!.source,
          uAux1: this.auxTex.source,
          uAux2: aux2.source,
          ground: new UniformGroup({
            uMap: { value: new Float32Array([g.width, g.height]), type: "vec2<f32>" },
            uGrid: { value: new Float32Array([g.biome.cols * g.biome.cellSize, g.biome.rows * g.biome.cellSize]), type: "vec2<f32>" },
            uCell: { value: g.biome.cellSize, type: "f32" },
            uSea: { value: g.heightMap.seaLevel / 255, type: "f32" },
            uRepeat: { value: REPEAT_UNITS, type: "f32" },
            uSlot: { value: slot, type: "f32" },
            uAtlasPx: { value: new Float32Array([slot * 4, slot * 3]), type: "vec2<f32>" },
          }),
        },
      }),
    });
    this.bakeScene.addChild(ground);
    this.disposables.push(atlasTex, aux2, ...biomes);

    // ---- Rivers: a darker bank, then water, wider toward the mouth ----
    const rivers = new Graphics();
    for (const r of g.rivers) {
      const n = r.path.length / 2;
      for (const [width, color, alpha] of [[2.4, 0x2b4a3a, 0.35], [1, 0x3f86b8, 1], [0.45, 0x8cc6e0, 0.8]] as const)
        for (let i = 1; i < n; i++) {
          const t = i / (n - 1);
          rivers
            .moveTo(r.path[(i - 1) * 2]!, r.path[(i - 1) * 2 + 1]!)
            .lineTo(r.path[i * 2]!, r.path[i * 2 + 1]!)
            .stroke({ width: (1.3 + 3.4 * t) * width, color, alpha, cap: "round", join: "round" });
        }
    }
    this.bakeScene.addChild(rivers);

    // ---- Passes: a road through the gap, with stones either side ----
    const passes = new Graphics();
    const label = new Map(g.territories.map((t) => [t.id, t.label]));
    for (const p of g.passes) {
      const a = label.get(p.a)!, b = label.get(p.b)!;
      const pts: [number, number][] = [];
      for (const end of [a, b]) {
        const dx = end.x - p.x, dy = end.y - p.y, len = Math.hypot(dx, dy) || 1;
        pts.push([p.x + (dx / len) * 34, p.y + (dy / len) * 34]);
      }
      const [s, e] = pts as [[number, number], [number, number]];
      passes.moveTo(s[0], s[1]).quadraticCurveTo(p.x, p.y, e[0], e[1]).stroke({ width: 6, color: 0x3b2a1a, alpha: 0.45, cap: "round" });
      passes.moveTo(s[0], s[1]).quadraticCurveTo(p.x, p.y, e[0], e[1]).stroke({ width: 3.6, color: 0xd9bf8a, alpha: 1, cap: "round" });
      passes.circle(p.x, p.y, 9).fill({ color: 0xc8b48c, alpha: 0.35 });
    }
    this.bakeScene.addChild(passes);

    // ---- Sea lanes: gently curved dotted routes with a ship ----
    const lanes = new Graphics();
    const ship = art.get("ship");
    for (const l of g.seaLanes) {
      const [x0, y0, x1, y1] = l.path as [number, number, number, number];
      const len = Math.hypot(x1 - x0, y1 - y0);
      const bend = Math.min(30, len * 0.18);
      const cx = (x0 + x1) / 2 + ((y1 - y0) / (len || 1)) * bend, cy = (y0 + y1) / 2 - ((x1 - x0) / (len || 1)) * bend;
      const dots = Math.max(3, Math.round(len / 7));
      for (let i = 0; i <= dots; i++) {
        const [x, y] = quadPoint(x0, y0, cx, cy, x1, y1, i / dots);
        lanes.circle(x, y, 1.6).fill({ color: 0xf6f1e4, alpha: 0.95 });
        lanes.circle(x, y, 2.4).stroke({ width: 0.6, color: 0x3b2a1a, alpha: 0.4 });
      }
      if (ship && len > 40) {
        const [x, y, ang] = quadPoint(x0, y0, cx, cy, x1, y1, 0.5);
        const s = new Sprite(Texture.from(ship.image));
        s.anchor.set(0.5, 0.75);
        s.scale.set(18 / ship.image.width);
        if (Math.cos(ang) < 0) s.scale.x *= -1;
        s.position.set(x, y);
        this.bakeScene.addChild(s);
      }
    }
    this.bakeScene.addChildAt(lanes, this.bakeScene.children.indexOf(passes) + 1);

    // ---- Decorations (already sorted top to bottom) and castles at every capital site ----
    const items: { y: number; make: () => Sprite }[] = [];
    const texCache = new Map<string, Texture>();
    const tex = (name: string) => {
      let t = texCache.get(name);
      if (!t) {
        const a = art.get(name);
        t = a ? Texture.from(a.image) : Texture.WHITE;
        texCache.set(name, t);
      }
      return t;
    };
    // A soft contact shadow under every sprite, down and to the right (the light comes from the upper left).
    const [shadowCanvas, sctx] = canvas(64, 32);
    const grad = sctx.createRadialGradient(32, 16, 2, 32, 16, 30);
    grad.addColorStop(0, "rgba(0,0,0,0.55)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    sctx.fillStyle = grad;
    sctx.scale(1, 0.5);
    sctx.fillRect(0, 0, 64, 64);
    const shadowTex = Texture.from(shadowCanvas);
    this.disposables.push(shadowTex);
    const shadow = (x: number, y: number, size: number) => {
      const s = new Sprite(shadowTex);
      s.anchor.set(0.5);
      s.width = size * 0.95;
      s.height = size * 0.34;
      s.alpha = 0.55;
      s.position.set(x + size * 0.14, y + size * 0.04);
      return s;
    };
    const place = (name: string, x: number, y: number, size: number, flip: boolean) => {
      const t = tex(name);
      const s = new Sprite(t);
      s.anchor.set(0.5, 0.88);
      s.scale.set(size / t.width);
      if (flip) s.scale.x *= -1;
      s.position.set(x, y);
      return s;
    };
    const sc = this.scenery;
    g.decorations.forEach((d, i) => {
      if (sc.hidden.has(i)) return;
      const kind = DECOR_ART[sc.treeKind.get(i) ?? d.kind]!;
      const flip = ((d.x * 7 + d.y * 13) | 0) % 3 === 0 && d.kind !== "peak";
      const jitter = 0.88 + (((d.x * 31 + d.y * 17) | 0) % 25) / 100;
      const size = DECOR_SIZE[d.kind]! * jitter;
      // Shadows sort just before their own sprite.
      items.push({ y: d.y - 0.001, make: () => shadow(d.x, d.y, size) });
      items.push({ y: d.y, make: () => place(`${kind}-${d.v}`, d.x, d.y, size, flip) });
    });
    /** A scenery piece: real art turned and mirrored as placed, standing on a soft shadow. */
    const piece = (name: string, p: Piece, anchorY = 0.88, withShadow = true) => {
      if (withShadow) items.push({ y: p.y - 0.001, make: () => shadow(p.x, p.y, p.w) });
      items.push({
        y: p.y,
        make: () => {
          const s = place(name, p.x, p.y, p.w, p.flip);
          s.anchor.set(0.5, anchorY);
          s.rotation = p.rot;
          return s;
        },
      });
    };
    const hasArt = (name: string) => !!art.get(name);
    // Mountain ranges as chains: ridge art where it runs across the screen (until it arrives: three peaks in a
    // row, tallest in the middle), single peaks where it's steep, at its ends and as fill.
    for (const r of sc.ranges) {
      if (r.kind === "peak") piece(`mountain-${r.v}`, r);
      else if (hasArt(`ridge-${r.v}`)) piece(`ridge-${r.v}`, r);
      else {
        const c = Math.cos(r.rot), sn = Math.sin(r.rot), sx = r.flip ? -1 : 1;
        const parts: [number, number, number][] = [[-0.3, 0.05, 0.5], [0.3, 0.07, 0.46], [0, 0, 0.66]];
        parts.forEach(([u, dv, k], j) =>
          piece(`mountain-${1 + ((r.v + j) % 4)}`, { x: r.x + u * r.w * c * sx, y: r.y + u * r.w * sn * sx + dv * r.w, w: r.w * k, rot: 0, flip: (j + r.v) % 2 === 0, v: 1 }),
        );
      }
    }
    // Sea cliffs, landmarks and the pass gatehouses: only once their art has arrived.
    if (hasArt("cliff-1")) for (const c of sc.cliffs) piece(`cliff-${c.v}`, c, 0.9, false);
    for (const l of sc.landmarks) if (hasArt(`landmark-${l.kind}`)) piece(`landmark-${l.kind}`, l);
    if (hasArt("pass-gate")) for (const p of sc.gates) piece("pass-gate", p, 0.8);
    // Bridges where territories meet across a river: wooden on streams and farmland (stone until that art arrives).
    for (const b of sc.bridges) piece(b.kind === "wood" && hasArt("bridge-wood") ? "bridge-wood" : "bridge", b, 0.55, false);
    g.territories.forEach((t, i) => {
      if (t.castle) {
        items.push({ y: t.castle.y - 0.001, make: () => shadow(t.castle!.x, t.castle!.y, CASTLE_SIZE) });
        items.push({ y: t.castle.y, make: () => place(`capital-${(i % 2) + 1}`, t.castle!.x, t.castle!.y, CASTLE_SIZE, false) });
      }
    });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) this.bakeScene.addChild(it.make());
  }

  /** Paint the whole map into the Far image. Fast; this is what shows first. */
  bakeFar() {
    const t0 = performance.now();
    const ppu = Math.min(1.6, 2048 / Math.max(this.g.width, this.g.height));
    const w = Math.ceil(this.g.width * ppu), h = Math.ceil(this.g.height * ppu);
    const rt = RenderTexture.create({ width: w, height: h, antialias: false, autoGenerateMipmaps: true });
    this.renderer.render({ container: this.bakeScene, target: rt, clear: true, transform: new Matrix().scale(ppu, ppu) });
    rt.source.updateMipmaps();
    (this.renderer as unknown as { gl?: WebGLRenderingContext }).gl?.finish();
    this.step("farPaint", t0);
    const mesh = new Mesh({ geometry: quad(0, 0, this.g.width, this.g.height), shader: this.displayShader(rt) });
    this.far = { rt, mesh, ppu };
    this.view.addChildAt(mesh, this.view.getChildIndex(this.tilesLayer));
    this.stats.textureBytes += w * h * 4 * 1.33;
    this.stats.bakeMs += performance.now() - t0;
  }

  /** Paint up to `max` more tiles, the ones nearest the screen centre first. Returns how many are left. */
  bakeTiles(max: number, cam: Camera, vp: Viewport): number {
    const t0 = performance.now();
    const cx = (vp.width / 2 - cam.x) / cam.scale, cy = (vp.height / 2 - cam.y) / cam.scale;
    const pending = this.tiles.filter((t) => !t.rt).sort((a, b) => Math.hypot(a.x + a.w / 2 - cx, a.y + a.h / 2 - cy) - Math.hypot(b.x + b.w / 2 - cx, b.y + b.h / 2 - cy));
    const { ppu } = this.opts;
    for (const t of pending.slice(0, max)) {
      const w = Math.ceil(t.w * ppu), h = Math.ceil(t.h * ppu);
      const rt = RenderTexture.create({ width: w, height: h, antialias: false });
      this.renderer.render({ container: this.bakeScene, target: rt, clear: true, transform: new Matrix().translate(-t.x, -t.y).scale(ppu, ppu) });
      t.rt = rt;
      t.mesh = new Mesh({ geometry: quad(t.x, t.y, t.w, t.h), shader: this.displayShader(rt) });
      this.tilesLayer.addChild(t.mesh);
      this.stats.tilesBaked++;
      this.stats.textureBytes += w * h * 4;
    }
    this.stats.bakeMs += performance.now() - t0;
    return pending.length - Math.min(max, pending.length);
  }

  /**
   * Show the Far image when zoomed out (it's sharp enough there and far cheaper), tiles when closer. Tiles not
   * painted yet are covered by the Far image underneath.
   */
  update(cam: Camera, vp: Viewport, resolution: number) {
    const devicePxPerUnit = cam.scale * resolution;
    const useFar = !!this.far && devicePxPerUnit <= this.far.ppu * 1.35;
    this.tilesLayer.visible = !useFar;
    if (this.far) this.far.mesh.visible = true;
    if (useFar) return;
    const x0 = -cam.x / cam.scale, y0 = -cam.y / cam.scale, x1 = x0 + vp.width / cam.scale, y1 = y0 + vp.height / cam.scale;
    let allOnScreenPainted = true;
    for (const t of this.tiles) {
      const on = t.x < x1 && t.x + t.w > x0 && t.y < y1 && t.y + t.h > y0;
      if (t.mesh) t.mesh.visible = on;
      else if (on) allOnScreenPainted = false;
    }
    // The Far image only needs drawing underneath while some on-screen tile is still unpainted.
    if (this.far) this.far.mesh.visible = !allOnScreenPainted;
  }

  /** Far-zoom dimming for the sea beyond the edges (the painted map dims in its shader). */
  setDim(dim: number) {
    const v = Math.round(255 * (1 - dim));
    this.sea.tint = this.seaBreak.tint = (v << 16) | (v << 8) | v;
  }

  get pendingTiles() {
    return this.tiles.filter((t) => !t.rt).length;
  }

  /**
   * Mark which land is in the fog (1) and which isn't (0). With `fadeMs`, the fog eases from how it was to the new
   * mask (the fog lifting off land your army just took, during the replay); the first fog is drawn straight away.
   */
  setFog(fogged: readonly { rings: readonly (readonly number[])[] }[], fadeMs = 0) {
    const c = this.fogCanvas;
    const ctx = c.getContext("2d")!;
    if (fadeMs > 0 && this.fogDrawn) {
      // What's on screen now (part-way through a fade, too) becomes the starting point.
      const pctx = this.fogPrevCanvas.getContext("2d")!;
      const mix = this.display.uniforms.uFogMix;
      if (mix < 1) {
        pctx.globalAlpha = mix;
        pctx.drawImage(c, 0, 0);
        pctx.globalAlpha = 1;
      } else {
        pctx.clearRect(0, 0, c.width, c.height);
        pctx.drawImage(c, 0, 0);
      }
      this.fogPrevTex.source.update();
      this.fogFade = { from: performance.now(), ms: fadeMs };
      this.display.uniforms.uFogMix = 0;
    } else {
      this.fogFade = null;
      this.display.uniforms.uFogMix = 1;
    }
    this.fogDrawn = true;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.scale(c.width / this.g.width, c.height / this.g.height);
    ctx.fillStyle = "#f00";
    // A soft edge, so fog fades in at the border instead of stopping hard.
    if ("filter" in ctx) ctx.filter = "blur(1.5px)";
    const p = new Path2D();
    for (const t of fogged)
      for (const r of t.rings) {
        p.moveTo(r[0]!, r[1]!);
        for (let i = 2; i < r.length; i += 2) p.lineTo(r[i]!, r[i + 1]!);
        p.closePath();
      }
    ctx.fill(p, "evenodd");
    ctx.filter = "none";
    this.fogTex.source.update();
  }

  /** Move a fog fade along; true while it's still going. */
  tickFog(now: number): boolean {
    if (!this.fogFade) return false;
    const x = Math.min(1, (now - this.fogFade.from) / this.fogFade.ms);
    this.display.uniforms.uFogMix = x * x * (3 - 2 * x);
    if (x >= 1) this.fogFade = null;
    return this.fogFade !== null;
  }

  destroy() {
    for (const t of this.tiles) t.rt?.destroy(true);
    this.far?.rt.destroy(true);
    this.fogTex.destroy(true);
    this.fogPrevTex.destroy(true);
    this.auxTex.destroy(true);
    for (const d of this.disposables) d.destroy();
    this.bakeScene.destroy({ children: true });
    this.view.destroy({ children: true });
  }
}
