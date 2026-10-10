import { ASSETS } from "@conquerra/art";
import { Container, Particle, ParticleContainer, Rectangle, Texture, TextureSource } from "pixi.js";
import type { ArtBook } from "../../art/book";
import { toScreen, type Camera } from "../../map/camera";
import type { ParticleState } from "../../replay/fx/particles";

/**
 * The replay's particles (session 21), drawn in screen space over the painted map and under the troop pills: one
 * ParticleContainer for each blend (normal, screen, add), all sharing one atlas of the effect art and the shapes drawn
 * in code (sparks, glints, embers, dots, rings). The particles themselves come from fx/particles.ts, a formula of the
 * replay's clock: this only puts them on screen. Pooled: particles are reused frame to frame, never made per frame.
 */

/** The longest side each piece of effect art is kept at in the atlas (particles are small on screen). */
const ATLAS_PX = 128;
const BLENDS = ["normal", "screen", "add"] as const;
type Blend = (typeof BLENDS)[number];

/** Shapes drawn in code, white (tinted per particle). */
const SHAPES: Record<string, (c: CanvasRenderingContext2D, s: number) => void> = {
  dot: (c, s) => {
    const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.45, "rgba(255,255,255,0.75)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, s, s);
  },
  ember: (c, s) => {
    const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.3, "rgba(255,240,200,0.9)");
    g.addColorStop(1, "rgba(255,200,120,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, s, s);
  },
  // A thin bright streak, pointing right (sparks fly along it).
  spark: (c, s) => {
    const g = c.createLinearGradient(0, 0, s, 0);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.7, "rgba(255,255,255,0.9)");
    g.addColorStop(1, "rgba(255,255,255,1)");
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(s / 2, s / 2, s / 2, s / 10, 0, 0, Math.PI * 2);
    c.fill();
  },
  // A four-pointed star: steel catching the light.
  glint: (c, s) => {
    c.fillStyle = "#fff";
    c.beginPath();
    const m = s / 2, w = s / 12;
    c.moveTo(m, 0);
    c.lineTo(m + w, m - w);
    c.lineTo(s, m);
    c.lineTo(m + w, m + w);
    c.lineTo(m, s);
    c.lineTo(m - w, m + w);
    c.lineTo(0, m);
    c.lineTo(m - w, m - w);
    c.closePath();
    c.fill();
    SHAPES.dot!(c, s);
  },
  ring: (c, s) => {
    c.strokeStyle = "rgba(255,255,255,0.95)";
    c.lineWidth = s / 14;
    c.beginPath();
    c.arc(s / 2, s / 2, s / 2 - s / 14, 0, Math.PI * 2);
    c.stroke();
  },
  streak: (c, s) => {
    const g = c.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(1, "rgba(255,255,255,0.9)");
    c.fillStyle = g;
    c.fillRect(s / 2 - s / 24, 0, s / 12, s);
  },
  flake: (c, s) => {
    c.fillStyle = "#fff";
    c.beginPath();
    c.ellipse(s / 2, s / 2, s / 2, s / 3.2, 0.5, 0, Math.PI * 2);
    c.fill();
  },
};

export class FxLayer {
  readonly root = new Container();
  private containers = new Map<Blend, ParticleContainer>();
  private pools = new Map<Blend, Particle[]>();
  private frames = new Map<string, Texture>();
  /** Particles on screen in the last frame (for the frame-rate report). */
  count = 0;
  peak = 0;

  private constructor() {
    this.root.label = "fx";
    this.root.eventMode = "none";
  }

  /** Load the effect art (once the map is up) and pack it with the code-drawn shapes into one atlas. */
  static async create(art: ArtBook): Promise<FxLayer> {
    const layer = new FxLayer();
    await art.loadFx();
    const pieces: { name: string; w: number; h: number; draw(c: CanvasRenderingContext2D): void }[] = [];
    for (const [name, paint] of Object.entries(SHAPES)) pieces.push({ name, w: 32, h: 32, draw: (c) => paint(c, 32) });
    for (const a of ASSETS) {
      if (a.kind !== "fx") continue;
      const img = art.get(a.name);
      if (!img?.real) continue;
      const k = Math.min(1, ATLAS_PX / Math.max(img.image.width, img.image.height));
      const w = Math.max(1, Math.round(img.image.width * k)), h = Math.max(1, Math.round(img.image.height * k));
      pieces.push({ name: a.name, w, h, draw: (c) => c.drawImage(img.image, 0, 0, w, h) });
    }
    // Shelf packing, tallest first, 2 px apart.
    pieces.sort((p, q) => q.h - p.h);
    const W = 1024;
    let x = 0, y = 0, row = 0;
    const at = new Map<string, Rectangle>();
    for (const p of pieces) {
      if (x + p.w > W) (x = 0), (y += row + 2), (row = 0);
      at.set(p.name, new Rectangle(x, y, p.w, p.h));
      x += p.w + 2;
      row = Math.max(row, p.h);
    }
    const H = y + row;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = Math.max(1, H);
    const c = canvas.getContext("2d")!;
    for (const p of pieces) {
      const r = at.get(p.name)!;
      c.save();
      c.translate(r.x, r.y);
      p.draw(c);
      c.restore();
    }
    const source = TextureSource.from(canvas);
    for (const [name, frame] of at) layer.frames.set(name, new Texture({ source, frame }));
    for (const b of BLENDS) {
      const pc = new ParticleContainer({ texture: new Texture({ source }), dynamicProperties: { position: true, rotation: true, vertex: true, color: true, uvs: true } });
      pc.blendMode = b;
      layer.containers.set(b, pc);
      layer.pools.set(b, []);
      layer.root.addChild(pc);
    }
    return layer;
  }

  /** Is this piece of art in the atlas? (Recipes can name art that hasn't been made: those particles are skipped.) */
  has(name: string): boolean {
    return this.frames.has(name);
  }

  /** Put this moment's particles on screen. `zoomK`: how much bigger than at Mid zoom things are drawn. */
  draw(particles: readonly ParticleState[], cam: Camera, zoomK: number, shake: [number, number] = [0, 0]) {
    const used = new Map<Blend, number>(BLENDS.map((b) => [b, 0]));
    let n = 0;
    for (const p of particles) {
      const tex = this.frames.get(p.texture);
      if (!tex) continue;
      const pool = this.pools.get(p.blend)!;
      const i = used.get(p.blend)!;
      let q = pool[i];
      if (!q) pool.push((q = new Particle({ texture: tex, anchorX: 0.5, anchorY: 0.5 })));
      const [sx, sy] = toScreen(cam, p.mx, p.my);
      q.texture = tex;
      q.x = sx + p.dx * zoomK + shake[0];
      q.y = sy + p.dy * zoomK + shake[1];
      const k = (p.size * zoomK) / Math.max(tex.frame.width, tex.frame.height);
      q.scaleX = q.scaleY = k;
      q.rotation = p.rotation;
      q.tint = p.tint;
      q.alpha = p.alpha;
      used.set(p.blend, i + 1);
      n++;
    }
    for (const b of BLENDS) {
      const pc = this.containers.get(b)!;
      const k = used.get(b)!;
      const pool = this.pools.get(b)!;
      if (pc.particleChildren.length !== k) {
        pc.particleChildren.length = 0;
        for (let i = 0; i < k; i++) pc.particleChildren.push(pool[i]!);
        pc.update();
      }
    }
    this.count = n;
    this.peak = Math.max(this.peak, n);
  }

  clear() {
    this.draw([], { x: 0, y: 0, scale: 1 }, 1);
  }

  destroy() {
    this.root.destroy({ children: true });
    for (const t of this.frames.values()) t.destroy(false);
  }
}
