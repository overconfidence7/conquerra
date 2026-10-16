import type { Line, MapDef, MapGeometry } from "@conquerra/content";
import { TERRAIN_TEXTURES, WATER_TEXTURES } from "@conquerra/art";
import { Container, Graphics, Matrix, Mesh, MeshGeometry, RenderTexture, Shader, Sprite, Texture, TilingSprite, UniformGroup, type Renderer } from "pixi.js";
import type { ArtBook } from "../../art/book";
import { canvas } from "../../art/paint";
import type { Camera, Viewport } from "../../map/camera";
import { quadPoint } from "../../map/shapes";
import { auxCanvases, biomeCanvases, type AuxData } from "./bakeData";
import { solid } from "./solid";
import { sceneryFor, type Piece, type Scenery } from "./scenery";
import { DISPLAY_FRAGMENT, GROUND_FRAGMENT, VERTEX } from "./shaders";

/**
 * The illustrated world: painted once per game into tiles (ground, relief, water, rivers, passes, sea lanes and
 * every decoration), plus one smaller "Far" image of the whole map for zoomed-out views. Each frame only shows
 * the tiles (with fog and a water shimmer), so panning stays cheap.
 *
 * Three detail levels (session 16): the Far image, the Mid tiles (the whole map, painted once), and **Near** tiles,
 * painted on demand only where you're looking once you zoom past what the Mid tiles can show sharply, at up to 3x
 * the Mid detail (matched to the screen). Near tiles are kept in a small cache that forgets the least recently seen
 * ones; until one is ready, the Mid tile underneath shows.
 */

const TILE = 1024;
/** Near tiles are smaller (device pixels a side): quicker to paint one a frame, and less memory wasted off screen. */
const NEAR_TILE = 512;
/** Near tiles show once the screen needs this many times the Mid detail. */
const NEAR_FROM = 1.3;
/** Ground textures repeat every this many map units. */
const REPEAT_UNITS = 170;

/** Sprite widths in map units, by decoration kind. */
const DECOR_SIZE: Record<string, number> = { "tree-conifer": 17, "tree-broadleaf": 17, peak: 30, hill: 19, village: 22, town: 30 };
const DECOR_ART: Record<string, string> = { "tree-conifer": "tree-conifer", "tree-broadleaf": "tree-broadleaf", peak: "mountain", hill: "hill", village: "village", town: "town" };
const CASTLE_SIZE = 46;
/** Session 30, blackout fog: how much sea shows around land you've seen (map units, both sides of the coast). */
const BLACKOUT_SHORE = 60;
/** How strong the House wash is at a realm's edge (it fades to nothing about 15 map units in). */
const OWNER_WASH = 0.5;

/**
 * The windmill in two pieces (batch 4): the body as wide as the one-piece windmill's body would be, and its sails on
 * the hub near the top of its front. Shared with the living map (session 21), which turns the sails.
 */
export function windmillParts(l: { x: number; y: number; w: number; v: number }) {
  // The one-piece windmill is 210 x 256 with its sails; the body alone is 122 x 256 at the same height.
  const bodyW = l.w * (122 / 210);
  const bodyH = bodyW * (256 / 122);
  const top = l.y - bodyH * 0.88;
  return { bodyW, hubX: l.x, hubY: top + bodyH * 0.21, sailsW: l.w * 0.92, angle: ((l.v * 37) % 90) * (Math.PI / 180) };
}

export interface WorldOptions {
  /** Painted pixels per map unit (detail at Mid zoom). */
  ppu: number;
  /** Painted pixels per map unit for Near tiles (0: none, the Mid tiles are as sharp as the screen gets). */
  nearPpu?: number;
  /** At most this many Near tiles are kept (each about 1 MB of texture memory). */
  nearCap?: number;
  /** The living map draws the windmills' sails and the ships on sea lanes, so they move (session 21). */
  living?: boolean;
}

interface NearTile {
  x: number;
  y: number;
  w: number;
  h: number;
  rt: RenderTexture;
  mesh: Mesh<MeshGeometry, Shader>;
  /** When it was last on screen (for forgetting the least recently seen). */
  seen: number;
}

interface Tile {
  x: number;
  y: number;
  w: number;
  h: number;
  rt: RenderTexture | null;
  mesh: Mesh<MeshGeometry, Shader> | null;
}

/** A texture with mipmaps (its own, not the shared cached one), so it stays smooth painted much smaller than its art. */
const mipmapped = (image: CanvasImageSource) => Texture.from({ resource: image, autoGenerateMipmaps: true } as unknown as Parameters<typeof Texture.from>[0], true);

const quad = (x: number, y: number, w: number, h: number) =>
  new MeshGeometry({
    positions: new Float32Array([x, y, x + w, y, x + w, y + h, x, y + h]),
    uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
  });

export class WorldLayer {
  /** What's on screen: the Far image or the tiles. */
  readonly view = new Container();
  readonly display: UniformGroup<{
    uMap: { value: Float32Array; type: "vec2<f32>" };
    uTime: { value: number; type: "f32" };
    uDim: { value: number; type: "f32" };
    uMotion: { value: number; type: "f32" };
    uFogMix: { value: number; type: "f32" };
    uTint: { value: number; type: "f32" };
    uWash: { value: number; type: "f32" };
    uFar: { value: number; type: "f32" };
  }>;
  /**
   * Who holds what, for the House tint (drawn by the display shader, so the House's hue survives any ground): each
   * House's land filled in its colour, and a blurred copy that tells the shader how far inside a realm a pixel is.
   */
  private ownerCanvas: HTMLCanvasElement;
  private ownerTex: Texture;
  private ownerBlurCanvas: HTMLCanvasElement;
  private ownerBlurTex: Texture;
  private bakeScene = new Container();
  /** The ground, painted from the Mid atlas (Far and Mid tiles) or the sharper Near atlas (built the first time). */
  private groundMid!: Mesh<MeshGeometry, Shader>;
  private groundNear: Mesh<MeshGeometry, Shader> | null = null;
  private groundMesh!: (slot: number, hd?: boolean) => Mesh<MeshGeometry, Shader>;
  /** Sprites in the painting, with their extent, so a tile only paints the ones it touches. */
  private cullables: { obj: Sprite; x0: number; y0: number; x1: number; y1: number }[] = [];
  /** The bigger art's textures for Near painting (session 16), by name, made the first time each is needed. */
  private hdTex = new Map<string, Texture | null>();
  private tiles: Tile[] = [];
  private near = new Map<string, NearTile>();
  private nearLayer = new Container();
  /** Near tiles on screen that aren't painted yet, nearest the centre first. */
  private nearWanted: { key: string; x: number; y: number; w: number; h: number }[] = [];
  private nearFrame = 0;
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
  readonly stats = { bakeMs: 0, tilesBaked: 0, tileCount: 0, textureBytes: 0, nearBaked: 0, nearKept: 0, nearMs: 0, steps: {} as Record<string, number> };
  private step(name: string, t0: number) {
    this.stats.steps[name] = Math.round(performance.now() - t0);
    return performance.now();
  }

  constructor(
    private renderer: Renderer,
    map: MapDef,
    private art: ArtBook,
    readonly opts: WorldOptions,
    /** Worked out ahead (the renderer does it while the art downloads); otherwise here. */
    scenery?: Scenery,
  ) {
    const t0 = performance.now();
    const g = (this.g = map.geometry!);
    this.scenery = scenery ?? sceneryFor(map);
    let t = this.step("sceneryInWorld", t0);
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
      uTint: { value: 0, type: "f32" },
      uWash: { value: OWNER_WASH, type: "f32" },
      uFar: { value: 0, type: "f32" },
    });
    // Fog mask: half a pixel per map unit is plenty (it's soft anyway).
    [this.fogCanvas] = canvas(Math.ceil(g.width * 0.5), Math.ceil(g.height * 0.5));
    this.fogTex = Texture.from(this.fogCanvas);
    [this.fogPrevCanvas] = canvas(this.fogCanvas.width, this.fogCanvas.height);
    this.fogPrevTex = Texture.from(this.fogPrevCanvas);
    [this.ownerCanvas] = canvas(this.fogCanvas.width, this.fogCanvas.height);
    this.ownerTex = Texture.from(this.ownerCanvas);
    [this.ownerBlurCanvas] = canvas(this.fogCanvas.width, this.fogCanvas.height);
    this.ownerBlurTex = Texture.from(this.ownerBlurCanvas);
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
    this.view.addChild(this.sea, this.seaBreak, this.tilesLayer, this.nearLayer);
    this.stats.bakeMs += performance.now() - t0;
  }

  private displayShader(tex: Texture) {
    return Shader.from({
      gl: { vertex: VERTEX, fragment: DISPLAY_FRAGMENT },
      resources: {
        uTile: tex.source,
        uFog: this.fogTex.source,
        uFogPrev: this.fogPrevTex.source,
        uAux1: this.auxTex.source,
        uOwner: this.ownerTex.source,
        uOwnerBlur: this.ownerBlurTex.source,
        display: this.display,
      },
    });
  }

  /**
   * The ground and water textures in one atlas with `slot` px slots: 5 x 2 when that fits in 4096 px (less memory),
   * else 4 x 3.
   */
  private atlas(slot: number, hd = false): { tex: Texture; cols: number; rows: number } {
    // The Near atlas uses the bigger textures where they've arrived (session 16).
    const images = [...TERRAIN_TEXTURES, ...WATER_TEXTURES].map((n) => (hd ? this.art.hd(n) : null) ?? this.art.get(n)!.image);
    const cols = slot * 5 <= 4096 ? 5 : 4;
    const rows = Math.ceil(images.length / cols);
    const [atlas, actx] = canvas(slot * cols, slot * rows);
    actx.imageSmoothingQuality = "high";
    images.forEach((image, i) => actx.drawImage(image, (i % cols) * slot, Math.floor(i / cols) * slot, slot, slot));
    const tex = Texture.from(atlas);
    this.disposables.push(tex);
    return { tex, cols, rows };
  }

  /** Everything that gets painted into the tiles. */
  private buildBakeScene() {
    const { g, art } = this;
    // ---- Ground textures in one atlas: the Mid one with 512 px slots (as the art was stored before session 16) ----
    const real = [...TERRAIN_TEXTURES, ...WATER_TEXTURES].some((n) => art.get(n)!.real);
    const biomes = biomeCanvases(g).map((c) => Texture.from(c));
    const aux2 = Texture.from(this.aux.aux2);
    this.disposables.push(aux2, ...biomes);
    this.groundMesh = (slot: number, hd = false) => {
      const { tex, cols, rows } = this.atlas(slot, hd);
      if (!this.midAtlas) this.midAtlas = tex;
      return new Mesh({
        geometry: quad(0, 0, g.width, g.height),
        shader: Shader.from({
          gl: { vertex: VERTEX, fragment: GROUND_FRAGMENT },
          resources: {
            uAtlas: tex.source,
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
              uAtlasPx: { value: new Float32Array([slot * cols, slot * rows]), type: "vec2<f32>" },
              uCols: { value: cols, type: "f32" },
            }),
          },
        }),
      });
    };
    this.groundMid = this.groundMesh(real ? 512 : 256);
    this.bakeScene.addChild(this.groundMid);

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
      if (ship && len > 40 && !this.opts.living) {
        const [x, y, ang] = quadPoint(x0, y0, cx, cy, x1, y1, 0.5);
        const s = new Sprite(mipmapped(ship.image));
        s.label = "ship";
        s.anchor.set(0.5, 0.75);
        s.scale.set(18 / ship.image.width);
        if (Math.cos(ang) < 0) s.scale.x *= -1;
        s.position.set(x, y);
        this.bakeScene.addChild(s);
      }
    }
    this.bakeScene.addChildAt(lanes, this.bakeScene.children.indexOf(passes) + 1);

    // ---- Decorations (already sorted top to bottom) and castles at every capital site ----
    const items: { y: number; make: () => Sprite | Container }[] = [];
    const texCache = new Map<string, Texture>();
    const tex = (name: string) => {
      let t = texCache.get(name);
      if (!t) {
        const a = art.get(name);
        // Mipmapped, so art much bigger than it's painted stays smooth instead of shimmering (session 16).
        t = a ? mipmapped(a.image) : Texture.WHITE;
        if (a) this.disposables.push(t);
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
      s.label = name;
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
    for (const l of sc.landmarks) {
      // The windmill in two pieces (batch 4): the body, and its sails on the hub (so they can turn).
      if (l.kind === "windmill" && hasArt("landmark-windmill-body") && hasArt("landmark-windmill-sails")) {
        const w = windmillParts(l);
        piece("landmark-windmill-body", { ...l, w: w.bodyW });
        if (!this.opts.living)
          items.push({
            y: l.y + 0.001,
            make: () => {
              const s = place("landmark-windmill-sails", w.hubX, w.hubY, w.sailsW, false);
              s.anchor.set(0.5);
              s.rotation = w.angle;
              return s;
            },
          });
      } else if (hasArt(`landmark-${l.kind}`)) piece(`landmark-${l.kind}`, l);
    }
    if (hasArt("pass-gate")) for (const p of sc.gates) piece("pass-gate", p, 0.8);
    // Bridges where territories meet across a river: wooden on streams and farmland (stone until that art arrives).
    for (const b of sc.bridges) piece(b.kind === "wood" && hasArt("bridge-wood") ? "bridge-wood" : "bridge", b, 0.55, false);
    g.territories.forEach((t, i) => {
      if (t.castle) {
        // The capital stands up off the land like the walls and the buildings (session 21): painted into the map.
        items.push({
          y: t.castle.y,
          make: () => {
            const name = `capital-${(i % 2) + 1}`;
            const c = solid(tex(name), { width: CASTLE_SIZE, plinth: true, label: name }).root;
            c.position.set(t.castle!.x, t.castle!.y);
            return c;
          },
        });
      }
    });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) this.bakeScene.addChild(it.make());
    // Every sprite's extent (the scene isn't moved or scaled), so painting a tile skips the ones it doesn't touch.
    // (A capital is a group: its shadow, plinth and rims, session 21. Each of its sprites is culled and sharpened alike.)
    const cull = (c: Container) => {
      if (c instanceof Sprite) {
        const b = c.getBounds();
        this.cullables.push({ obj: c, x0: b.minX, y0: b.minY, x1: b.maxX, y1: b.maxY });
      } else if (!(c instanceof Graphics) && c !== this.groundMid) for (const k of c.children) cull(k);
    };
    for (const c of this.bakeScene.children) cull(c);
  }

  /**
   * Paint the part of the map from (x, y), w x h map units, at `ppu`, showing only the sprites that touch it. `hd`:
   * with the bigger art where it has arrived (Near tiles), each piece kept exactly the size it was.
   */
  private paint(rt: RenderTexture, x: number, y: number, w: number, h: number, ppu: number, hd = false) {
    const swapped: { s: Sprite; tex: Texture; sx: number; sy: number }[] = [];
    for (const c of this.cullables) {
      c.obj.visible = c.x1 >= x && c.x0 <= x + w && c.y1 >= y && c.y0 <= y + h;
      if (!hd || !c.obj.visible) continue;
      const big = c.obj.label ? this.hdTexture(c.obj.label) : null;
      if (!big) continue;
      const s = c.obj;
      swapped.push({ s, tex: s.texture, sx: s.scale.x, sy: s.scale.y });
      const k = s.texture.width / big.width;
      s.texture = big;
      s.scale.set(s.scale.x * k, s.scale.y * k);
    }
    this.renderer.render({ container: this.bakeScene, target: rt, clear: true, transform: new Matrix().translate(-x, -y).scale(ppu, ppu) });
    for (const { s, tex, sx, sy } of swapped) {
      s.texture = tex;
      s.scale.set(sx, sy);
    }
    for (const c of this.cullables) c.obj.visible = true;
  }

  private hdTexture(name: string): Texture | null {
    if (!this.hdTex.has(name)) {
      const image = this.art.hd(name);
      const t = image ? mipmapped(image) : null;
      if (t) this.disposables.push(t);
      this.hdTex.set(name, t);
    }
    return this.hdTex.get(name) ?? null;
  }

  /**
   * The bigger art has arrived (session 16): Near tiles painted so far are forgotten and painted again with it
   * (only those on screen, as ever), and the Near ground atlas is made again from the bigger textures.
   */
  hdArrived() {
    this.hdTex.clear();
    for (const t of this.near.values()) {
      this.stats.textureBytes -= t.rt.width * t.rt.height * 4;
      t.mesh.destroy();
      t.rt.destroy(true);
    }
    this.near.clear();
    if (this.groundNear) {
      this.bakeScene.removeChild(this.groundNear);
      this.groundNear.destroy();
      this.groundNear = null;
      this.stats.textureBytes -= this.nearAtlasBytes;
      this.nearAtlasBytes = 0;
    }
    this.stats.nearKept = 0;
  }
  private nearAtlasBytes = 0;

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

  /**
   * Once every Mid tile is painted, the Mid ground atlas isn't needed any more (the Far image and the tiles are done;
   * Near tiles have their own): its memory goes back.
   */
  private freeMidAtlas() {
    if (this.midAtlasFreed) return;
    this.midAtlasFreed = true;
    this.groundMid.visible = false;
    const t = this.midAtlas;
    if (t) {
      this.disposables = this.disposables.filter((d) => d !== t);
      t.destroy(true);
    }
  }
  private midAtlasFreed = false;
  /** The Mid ground atlas (the first one made). */
  private midAtlas: Texture | null = null;

  /** Paint up to `max` more tiles, the ones nearest the screen centre first. Returns how many are left. */
  bakeTiles(max: number, cam: Camera, vp: Viewport): number {
    const t0 = performance.now();
    const cx = (vp.width / 2 - cam.x) / cam.scale, cy = (vp.height / 2 - cam.y) / cam.scale;
    const pending = this.tiles.filter((t) => !t.rt).sort((a, b) => Math.hypot(a.x + a.w / 2 - cx, a.y + a.h / 2 - cy) - Math.hypot(b.x + b.w / 2 - cx, b.y + b.h / 2 - cy));
    const { ppu } = this.opts;
    for (const t of pending.slice(0, max)) {
      const w = Math.ceil(t.w * ppu), h = Math.ceil(t.h * ppu);
      const rt = RenderTexture.create({ width: w, height: h, antialias: false });
      this.paint(rt, t.x, t.y, t.w, t.h, ppu);
      t.rt = rt;
      t.mesh = new Mesh({ geometry: quad(t.x, t.y, t.w, t.h), shader: this.displayShader(rt) });
      this.tilesLayer.addChild(t.mesh);
      this.stats.tilesBaked++;
      this.stats.textureBytes += w * h * 4;
    }
    this.stats.bakeMs += performance.now() - t0;
    const left = pending.length - Math.min(max, pending.length);
    if (!left) this.freeMidAtlas();
    return left;
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
    const nearPpu = this.opts.nearPpu ?? 0;
    // Near tiles only once the screen needs clearly more than the Mid detail, and only while a screenful of them
    // fits comfortably in the cache (a little less sharp just past Mid, rather than painting dozens of tiles).
    const screenTiles = nearPpu ? ((vp.width / cam.scale) * nearPpu / NEAR_TILE + 1) * ((vp.height / cam.scale) * nearPpu / NEAR_TILE + 1) : Infinity;
    const useNear = !useFar && nearPpu > 0 && devicePxPerUnit > this.opts.ppu * NEAR_FROM && screenTiles <= (this.opts.nearCap ?? 24) * 0.6;
    this.nearLayer.visible = useNear;
    this.nearWanted = [];
    if (useFar) return;
    const x0 = -cam.x / cam.scale, y0 = -cam.y / cam.scale, x1 = x0 + vp.width / cam.scale, y1 = y0 + vp.height / cam.scale;
    // Near tiles: show the painted ones on screen, and list the rest to paint (nearest the centre first).
    let allNear = useNear;
    if (useNear) {
      this.nearFrame++;
      const u = NEAR_TILE / nearPpu;
      const shown = new Set<string>();
      for (let j = Math.max(0, Math.floor(y0 / u)); j * u < Math.min(this.g.height, y1); j++)
        for (let i = Math.max(0, Math.floor(x0 / u)); i * u < Math.min(this.g.width, x1); i++) {
          const key = `${i},${j}`;
          shown.add(key);
          const t = this.near.get(key);
          if (t) t.seen = this.nearFrame;
          else {
            allNear = false;
            const x = i * u, y = j * u;
            this.nearWanted.push({ key, x, y, w: Math.min(u, this.g.width - x), h: Math.min(u, this.g.height - y) });
          }
        }
      for (const [key, t] of this.near) t.mesh.visible = shown.has(key);
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      this.nearWanted.sort((a, b) => Math.hypot(a.x + a.w / 2 - cx, a.y + a.h / 2 - cy) - Math.hypot(b.x + b.w / 2 - cx, b.y + b.h / 2 - cy));
    }
    let allOnScreenPainted = true;
    for (const t of this.tiles) {
      const on = t.x < x1 && t.x + t.w > x0 && t.y < y1 && t.y + t.h > y0;
      // Under a screenful of finished Near tiles, the Mid tiles needn't be drawn at all.
      if (t.mesh) t.mesh.visible = on && !allNear;
      else if (on) allOnScreenPainted = false;
    }
    // The Far image only needs drawing underneath while some on-screen tile is still unpainted.
    if (this.far) this.far.mesh.visible = !allOnScreenPainted && !allNear;
  }

  /** Near tiles on screen still to paint (`update` lists them). */
  get pendingNear() {
    return this.nearWanted.length;
  }

  /**
   * Paint up to `max` of the Near tiles on screen, nearest the centre first, then forget the least recently seen
   * ones beyond the cap. The sharper ground atlas is made the first time (the Mid one paints everything else).
   */
  bakeNear(max: number): void {
    const nearPpu = this.opts.nearPpu ?? 0;
    if (!nearPpu || !this.nearWanted.length) return;
    const t0 = performance.now();
    if (!this.groundNear) {
      // As many texture pixels per map unit as the Near tiles paint (rounded up to 128 px slots; 512 to 1024).
      const slot = Math.max(512, Math.min(1024, Math.ceil((nearPpu * REPEAT_UNITS) / 128) * 128));
      this.groundNear = this.groundMesh(slot, true);
      this.bakeScene.addChildAt(this.groundNear, this.bakeScene.getChildIndex(this.groundMid) + 1);
      this.nearAtlasBytes = slot * slot * (slot * 5 <= 4096 ? 10 : 12) * 4;
      this.stats.textureBytes += this.nearAtlasBytes;
    }
    const midShown = this.groundMid.visible;
    this.groundMid.visible = false;
    this.groundNear.visible = true;
    for (const w of this.nearWanted.splice(0, max)) {
      const rt = RenderTexture.create({ width: Math.ceil(w.w * nearPpu), height: Math.ceil(w.h * nearPpu), antialias: false });
      this.paint(rt, w.x, w.y, w.w, w.h, nearPpu, true);
      const mesh = new Mesh({ geometry: quad(w.x, w.y, w.w, w.h), shader: this.displayShader(rt) });
      this.nearLayer.addChild(mesh);
      this.near.set(w.key, { ...w, rt, mesh, seen: this.nearFrame });
      this.stats.nearBaked++;
      this.stats.textureBytes += rt.width * rt.height * 4;
    }
    this.groundNear.visible = false;
    this.groundMid.visible = midShown;
    // Forget the least recently seen beyond the cap (never one on screen now).
    const cap = this.opts.nearCap ?? 24;
    if (this.near.size > cap)
      for (const [key, t] of [...this.near].sort((a, b) => a[1].seen - b[1].seen)) {
        if (this.near.size <= cap || t.seen === this.nearFrame) break;
        this.stats.textureBytes -= t.rt.width * t.rt.height * 4;
        t.mesh.destroy();
        t.rt.destroy(true);
        this.near.delete(key);
      }
    this.stats.nearKept = this.near.size;
    this.stats.nearMs += performance.now() - t0;
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
  setFog(fogged: readonly { rings: readonly (readonly number[])[] }[], fadeMs = 0, blackout: { known: readonly { rings: readonly (readonly number[])[] }[] } | null = null) {
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
    // Session 30, blackout fog (G): thick clouds over everything but the land you've seen and a little sea around it,
    // so an unknown coast doesn't give its shape away.
    if (blackout) {
      const [k] = canvas(c.width, c.height);
      const kx = k.getContext("2d")!;
      kx.fillStyle = "#0f0";
      kx.fillRect(0, 0, k.width, k.height);
      kx.scale(c.width / this.g.width, c.height / this.g.height);
      kx.globalCompositeOperation = "destination-out";
      if ("filter" in kx) kx.filter = "blur(4px)";
      const seen = new Path2D();
      for (const t of blackout.known)
        for (const r of t.rings) {
          seen.moveTo(r[0]!, r[1]!);
          for (let i = 2; i < r.length; i += 2) seen.lineTo(r[i]!, r[i + 1]!);
          seen.closePath();
        }
      kx.fill(seen, "nonzero");
      kx.lineWidth = BLACKOUT_SHORE;
      kx.lineJoin = "round";
      kx.stroke(seen);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "lighter";
      ctx.drawImage(k, 0, 0);
      ctx.globalCompositeOperation = "source-over";
    }
    this.fogTex.source.update();
  }

  /**
   * Paint who holds what (land you can see now), for the House tint: a flat tint at Far, and at Mid and Near a wash
   * along each realm's edge that fades out about 15 map units in. Only called when ownership changes.
   */
  setOwners(realms: readonly { color: string; territories: readonly (readonly Line[])[] }[]) {
    const c = this.ownerCanvas;
    const ctx = c.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.scale(c.width / this.g.width, c.height / this.g.height);
    for (const r of realms) {
      ctx.fillStyle = r.color;
      const p = new Path2D();
      for (const rings of r.territories)
        for (const ring of rings) {
          p.moveTo(ring[0]!, ring[1]!);
          for (let i = 2; i < ring.length; i += 2) p.lineTo(ring[i]!, ring[i + 1]!);
          p.closePath();
        }
      ctx.fill(p, "evenodd");
    }
    this.ownerTex.source.update();
    // The blurred copy (radius about 9 map units): 1 deep inside a realm, falling toward its edge.
    const b = this.ownerBlurCanvas.getContext("2d")!;
    b.clearRect(0, 0, c.width, c.height);
    b.filter = `blur(${Math.max(1, (9 * c.width) / this.g.width).toFixed(1)}px)`;
    b.drawImage(c, 0, 0);
    b.filter = "none";
    this.ownerBlurTex.source.update();
  }

  /** How strong the flat House tint is (Far zoom); the edge wash is always on. */
  setTint(flat: number) {
    this.display.uniforms.uTint = flat;
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
    for (const t of this.near.values()) t.rt.destroy(true);
    this.far?.rt.destroy(true);
    this.fogTex.destroy(true);
    this.fogPrevTex.destroy(true);
    this.ownerTex.destroy(true);
    this.ownerBlurTex.destroy(true);
    this.auxTex.destroy(true);
    for (const d of this.disposables) d.destroy();
    this.bakeScene.destroy({ children: true });
    this.view.destroy({ children: true });
  }
}
