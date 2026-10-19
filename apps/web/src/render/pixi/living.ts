import type { MapDef } from "@conquerra/content";
import type { PlayerView } from "@conquerra/engine";
import { Container, Sprite, Texture } from "pixi.js";
import type { Camera, Viewport } from "../../map/camera";
import { houseOf } from "../../map/houses";
import { rand } from "../../replay/fx/random";
import type { FxLevel, ParticleState } from "../../replay/fx/particles";
import type { TextureBank } from "./bank";
import type { FxLayer } from "./fxLayer";
import { livingSites, shownOver } from "./livingLand";
import type { Scenery } from "./scenery";
import { windmillParts } from "./world";

/**
 * The living map (session 21, docs/09 §7), always on and quiet: clouds drifting at Far and Mid with their shadows on
 * the land, chimney smoke curling up from villages, towns and capitals, windmills turning, flags fluttering on the
 * capitals, the lighthouse beam sweeping at Mid, boats bobbing on the sea lanes and now and then a flock of birds.
 * (The water's shimmer and the fog's drifting mist are in the map's shader.) Drawn in map units over the painting and
 * under every border, pill and plaque: none of it carries game state. It pauses with the tab (the browser stops the
 * frames), and on Light (or with Reduce motion) there's half the smoke and no birds.
 */

/** Chimney smoke: at most this many chimneys on screen at once (Light: half). */
const MAX_CHIMNEYS = 20;
const CLOUDS_PER_MAP = 6;

interface Chimney {
  x: number;
  y: number;
  seed: number;
  /** Session 33b: the land it stands on, and whether it shows (not under blackout's cloud). */
  lands: string[];
  shown: boolean;
}

export class LivingLayer {
  /** Clouds' shadows and the boats, sails and flags: over the painting. */
  readonly root = new Container();
  private clouds: { sprite: Sprite; shadow: Sprite; x: number; y: number; w: number; speed: number }[] = [];
  private sails: { sprite: Sprite; speed: number; lands: string[] }[] = [];
  private boats: { sprite: Sprite; x: number; y: number; phase: number; lands: string[] }[] = [];
  private flags: { sprite: Sprite; territory: string; phase: number; lands: string[] }[] = [];
  private beams: { sprite: Sprite; phase: number; lands: string[] }[] = [];
  private birds: Sprite | null = null;
  private chimneys: Chimney[] = [];
  private smoke: FxLayer | null = null;
  private level: FxLevel = "full";
  private w: number;
  private h: number;

  constructor(
    private map: MapDef,
    private bank: TextureBank,
    scenery: Scenery,
  ) {
    const g = map.geometry!;
    this.w = g.width;
    this.h = g.height;
    this.root.label = "living";
    this.root.eventMode = "none";
    const seed = map.id.length * 7919 + g.width;
    // Session 33b: each sprite knows the land it stands for, so blackout's cloud hides it (`setView`).
    const sites = livingSites(map, scenery.landmarks);
    // Boats on the sea lanes (the painted map leaves them out when the living map is on).
    const ship = bank.get("ship");
    if (ship)
      for (const b of sites.boats) {
        const s = new Sprite(ship);
        s.anchor.set(0.5, 0.75);
        s.scale.set(18 / ship.width);
        if (Math.cos(b.angle) < 0) s.scale.x *= -1;
        this.boats.push({ sprite: s, x: b.x, y: b.y, phase: rand(seed, 1, this.boats.length) * 6.28, lands: b.lands });
        this.root.addChild(s);
      }
    // Windmills' sails, on the hub of the body painted into the map.
    const sails = bank.get("landmark-windmill-sails");
    if (sails && bank.get("landmark-windmill-body"))
      for (const { landmark: l, lands } of sites.windmills) {
        const p = windmillParts(l);
        const s = new Sprite(sails);
        s.anchor.set(0.5);
        s.scale.set(p.sailsW / sails.width);
        s.position.set(p.hubX, p.hubY);
        s.rotation = p.angle;
        this.sails.push({ sprite: s, speed: 0.5 + rand(seed, 2, this.sails.length) * 0.4, lands });
        this.root.addChild(s);
      }
    // The lighthouse beam: a soft cone of light turning (seen at Mid).
    const beam = beamTexture();
    for (const { landmark: l, lands } of sites.lighthouses) {
      const s = new Sprite(beam);
      s.anchor.set(0, 0.5);
      s.blendMode = "add";
      s.scale.set(70 / 256, 22 / 64);
      s.position.set(l.x, l.y - l.w * 0.95);
      this.beams.push({ sprite: s, phase: rand(seed, 3, this.beams.length) * 6.28, lands });
      this.root.addChild(s);
    }
    // Flags on the capitals' castles (the owner's colour when you can see it).
    for (const f of sites.flags) {
      const s = new Sprite(Texture.WHITE);
      s.anchor.set(0, 1);
      s.position.set(f.x, f.y);
      s.scale.set(7 / 16, 5 / 16);
      this.flags.push({ sprite: s, territory: f.territory, phase: rand(seed, 4, this.flags.length) * 6.28, lands: f.lands });
      this.root.addChild(s);
    }
    // Chimneys: villages, towns and capitals.
    this.chimneys = sites.chimneys.map((c) => ({ ...c, shown: true }));
    // Clouds, high over everything painted, and their shadows on the land below them.
    for (let i = 0; i < CLOUDS_PER_MAP; i++) {
      const tex = bank.get(`cloud-${(i % 3) + 1}`);
      if (!tex) continue;
      const w = 140 + rand(seed, 5, i) * 120;
      const shadow = new Sprite(tex);
      shadow.anchor.set(0.5);
      shadow.tint = 0x000000;
      shadow.alpha = 0.1;
      shadow.scale.set(w / tex.width);
      const sprite = new Sprite(tex);
      sprite.anchor.set(0.5);
      sprite.scale.set(w / tex.width);
      this.clouds.push({ sprite, shadow, x: rand(seed, 6, i) * this.w, y: rand(seed, 7, i) * this.h, w, speed: 3 + rand(seed, 8, i) * 4 });
      this.root.addChild(shadow);
    }
    const cloudTop = new Container();
    for (const c of this.clouds) cloudTop.addChild(c.sprite);
    this.cloudsTop = cloudTop;
    const birds = bank.get("fx-birds");
    if (birds) {
      this.birds = new Sprite(birds);
      this.birds.anchor.set(0.5);
      this.birds.scale.set(46 / birds.width);
      this.birds.visible = false;
    }
  }

  /** The clouds themselves (over the borders' halo but faint): added by the renderer above the painting. */
  readonly cloudsTop: Container;

  /** The chimney smoke's particles (sharing the replay's atlas), once it has loaded. */
  setSmoke(fx: FxLayer) {
    this.smoke = fx;
    this.root.addChildAt(fx.root, 0);
    if (this.birds) this.cloudsTop.addChild(this.birds);
  }

  setLevel(level: FxLevel) {
    this.level = level;
  }

  /**
   * Flags in the owners' colours, where you can see them. Session 33b: under blackout a sprite shows only over land
   * you know (a boat: both ends of its lane), so nothing on the cloud gives away a lane or a settlement.
   */
  setView(view: PlayerView) {
    for (const f of this.flags) {
      const t = view.territories[f.territory];
      const owner = t?.detail === "full" ? t.owner : null;
      f.sprite.tint = parseInt(houseOf(view, owner).color.slice(1), 16);
    }
    for (const x of [...this.boats, ...this.sails, ...this.beams, ...this.flags]) x.sprite.visible = shownOver(view, x.lands);
    for (const c of this.chimneys) c.shown = shownOver(view, c.lands);
  }

  /**
   * One frame. `seconds`: the page's clock; `far`, `near`: how much Far and Near detail is showing (0..1).
   */
  tick(seconds: number, cam: Camera, vp: Viewport, far: number, near: number, tactical: boolean) {
    this.root.visible = this.cloudsTop.visible = !tactical;
    if (tactical) return;
    const t = seconds;
    this.sails.forEach((s, i) => (s.sprite.rotation = t * s.speed + i));
    for (const b of this.boats) {
      b.sprite.position.set(b.x, b.y + Math.sin(t * 1.4 + b.phase) * 0.9);
      b.sprite.rotation = Math.sin(t * 1.1 + b.phase) * 0.05;
    }
    for (const f of this.flags) {
      // A pennant fluttering: its width and a little skew breathing.
      f.sprite.skew.set(0, Math.sin(t * 4 + f.phase) * 0.25);
      f.sprite.scale.x = (7 / 16) * (0.85 + 0.15 * Math.sin(t * 5.3 + f.phase));
      f.sprite.alpha = 1 - far * 0.8;
    }
    // The beam shows at Mid (not at Far, where the map is an atlas, nor close in where it would cover the land).
    const mid = Math.max(0, 1 - far) * (1 - near);
    for (const b of this.beams) {
      b.sprite.rotation = t * 0.9 + b.phase;
      b.sprite.alpha = 0.55 * mid;
    }
    // Clouds drift across, wrapping round the map, at Far and Mid only; their shadows fall down and to the right.
    const cloudAlpha = 0.5 * Math.max(0, 1 - near * 1.2);
    for (const c of this.clouds) {
      const x = ((c.x + t * c.speed) % (this.w + c.w * 2)) - c.w;
      c.sprite.position.set(x, c.y);
      c.shadow.position.set(x + 26, c.y + 34);
      c.sprite.alpha = cloudAlpha * (0.45 + 0.55 * far);
      c.shadow.alpha = 0.12 * cloudAlpha * 2;
    }
    // Birds: a flock crosses now and then (every 40 s), not on Light.
    if (this.birds) {
      const period = 40, k = (t % period) / 14;
      const n = Math.floor(t / period);
      this.birds.visible = this.level === "full" && k < 1 && near < 0.6;
      if (this.birds.visible) {
        const y0 = rand(11, n) * this.h, y1 = rand(12, n) * this.h;
        this.birds.position.set(-60 + (this.w + 120) * k, y0 + (y1 - y0) * k);
        this.birds.rotation = Math.atan2(y1 - y0, this.w + 120);
      }
    }
    // Chimney smoke: small slow puffs from the chimneys on screen (a formula of the clock, like the replay's).
    if (!this.smoke) return;
    if (far > 0.85) {
      this.smoke.draw([], { x: 0, y: 0, scale: 1 }, 1);
      return;
    }
    const x0 = -cam.x / cam.scale, y0 = -cam.y / cam.scale, x1 = x0 + vp.width / cam.scale, y1 = y0 + vp.height / cam.scale;
    const max = this.level === "full" ? MAX_CHIMNEYS : MAX_CHIMNEYS / 2;
    const particles: ParticleState[] = [];
    let n = 0;
    for (const c of this.chimneys) {
      if (!c.shown || c.x < x0 || c.x > x1 || c.y < y0 || c.y > y1) continue;
      if (++n > max) break;
      for (let k = 0; k < 3; k++) {
        const life = 3.2, phase = rand(c.seed, k) * life;
        const u = ((t + phase + k * (life / 3)) % life) / life;
        particles.push({
          texture: "fx-smoke-1",
          blend: "normal",
          mx: c.x,
          my: c.y,
          dx: Math.sin(u * 3 + c.seed) * 2 + u * 5,
          dy: -u * 16,
          size: 3 + u * 7,
          rotation: u * 1.5 + k,
          alpha: 0.4 * Math.min(1, u * 5) * (1 - u) * (1 - far),
          tint: 0xe9e4da,
        });
      }
    }
    // In map units: the smoke layer sits inside the map, so the camera's scale applies to it already.
    this.smoke.draw(particles, { x: 0, y: 0, scale: 1 }, 1);
  }

  destroy() {
    this.root.destroy({ children: true });
    this.cloudsTop.destroy({ children: true });
  }
}

/** A soft cone of light, pointing right, for the lighthouse beam. */
function beamTexture(): Texture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0, "rgba(255,244,200,0.9)");
  grad.addColorStop(1, "rgba(255,244,200,0)");
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(0, 32);
  g.lineTo(256, 0);
  g.lineTo(256, 64);
  g.closePath();
  g.fill();
  return Texture.from(c);
}
