import type { Line, MapDef } from "@conquerra/content";
import { ColorMatrixFilter, Container, Graphics, Sprite, Texture } from "pixi.js";
import { canvas } from "../../art/paint";
import { FIGURE_SPRITES } from "@conquerra/art";
import { hexNum, houseOf, NEUTRAL_HOUSE } from "../../map/houses";
import { groupOutlines, quadPoint } from "../../map/shapes";
import { territoryStatus, type TerritoryStatus } from "../../map/status";
import { wallFootprints } from "../../map/walls";
import type { DetailMix } from "../../map/zoom";
import type { MapScene } from "../types";
import type { TextureBank } from "./bank";
import { buildLabels, type MapLabels } from "./labels";
import { RealmLayer } from "./realms";

/**
 * The info layer in map space: House borders (the House tint itself is painted by the world layer's shader), the selection glow, reachable-target highlights, order
 * arrows, building sprites at each site, specialist figures at Near zoom, and the place names. Line widths are in
 * screen pixels, so lines are redrawn when the zoom changes enough.
 */

const GOLD = 0xc9a45c, GOLD_HI = 0xe3c77e, ATTACK = 0xc2553f, MOVE = 0x3a72c4, INK = 0x1b1206;
/** The walls' stone (session 20b). */
const STONE = 0x8d877c, STONE_LIGHT = 0xc4bdae;

/**
 * Where a wall's towers stand along one of its lines (map units): at its corners (a turn of 40 degrees or more), at
 * least 44 screen pixels apart, and along any straight stretch longer than 140 pixels.
 */
export function towerSpots(l: Line, px: number): { x: number; y: number }[] {
  const p = l as number[];
  const n = p.length / 2;
  const out: { x: number; y: number }[] = [];
  const minGap = 44 * px, maxGap = 140 * px;
  const closed = n > 2 && Math.hypot(p[0]! - p[2 * n - 2]!, p[1]! - p[2 * n - 1]!) < 1e-6;
  let since = closed ? maxGap / 2 : minGap;
  for (let i = 1; i < n; i++) {
    const x0 = p[2 * i - 2]!, y0 = p[2 * i - 1]!, x1 = p[2 * i]!, y1 = p[2 * i + 1]!;
    const seg = Math.hypot(x1 - x0, y1 - y0);
    // Along a long stretch: a tower every `maxGap`.
    let at = 0;
    while (seg > 0 && since + (seg - at) >= maxGap) {
      at += maxGap - since;
      out.push({ x: x0 + ((x1 - x0) * at) / seg, y: y0 + ((y1 - y0) * at) / seg });
      since = 0;
    }
    since += seg - at;
    // At a corner (the next segment turns 40 degrees or more).
    const j = i + 1 < n ? i + 1 : closed ? 1 : -1;
    if (j < 0) continue;
    const ax = x1 - x0, ay = y1 - y0, bx = p[2 * j]! - x1, by = p[2 * j + 1]! - y1;
    const turn = Math.abs(Math.atan2(ax * by - ay * bx, ax * bx + ay * by));
    if (turn >= (40 * Math.PI) / 180 && since >= minGap) {
      out.push({ x: x1, y: y1 });
      since = 0;
    }
  }
  return out;
}
/** A building sprite's width (about twice session 8's 26, a touch bigger than a capital's castle), and a figure's, in map units. */
const BUILDING_SIZE = 48, FIGURE_SIZE = 20;
/** Roughly how far an army marker reaches from its territory's label point, in screen px (pill, banner, icons). */
const PILL_REACH_X = 36, PILL_REACH_Y = 16;
/** A building moves at most this far (map units) to clear the army marker. */
const MAX_SITE_SHIFT = 60;

const ring = (g: Graphics, r: Line, close = true) => g.poly(r as number[], close);

/** Short dashes along a line (`dash` long, `gap` apart): a truce's stitching. */
function stitches(g: Graphics, l: Line, dash: number, gap: number, width: number, color: number, alpha: number) {
  const p = l as number[];
  let on = true, left = dash;
  for (let i = 2; i < p.length; i += 2) {
    let x0 = p[i - 2]!, y0 = p[i - 1]!;
    const x1 = p[i]!, y1 = p[i + 1]!;
    let len = Math.hypot(x1 - x0, y1 - y0);
    while (len > 0) {
      const step = Math.min(left, len);
      const k = step / len;
      const xs = x0 + (x1 - x0) * k, ys = y0 + (y1 - y0) * k;
      if (on) g.moveTo(x0, y0).lineTo(xs, ys).stroke({ width, color, alpha, cap: "butt" });
      x0 = xs;
      y0 = ys;
      len -= step;
      left -= step;
      if (left <= 1e-9) {
        on = !on;
        left = on ? dash : gap;
      }
    }
  }
}

/** Small round studs every `gap` along a line (a binding pact's seal marks). */
function studs(g: Graphics, l: Line, gap: number, r: number, color: number) {
  const p = l as number[];
  let carry = gap / 2;
  for (let i = 2; i < p.length; i += 2) {
    const x0 = p[i - 2]!, y0 = p[i - 1]!, x1 = p[i]!, y1 = p[i + 1]!;
    const len = Math.hypot(x1 - x0, y1 - y0);
    let at = carry;
    while (at <= len) {
      const k = at / len;
      g.circle(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k, r).fill({ color, alpha: 0.95 }).stroke({ width: r * 0.5, color: INK, alpha: 0.8 });
      at += gap;
    }
    carry = at - len;
  }
}

export class InfoLayer {
  readonly tactical = new Graphics();
  /** Called when who holds what changes: the world layer paints the House tint from it (in its shader). */
  onRealms: ((realms: { color: string; territories: (readonly Line[])[] }[]) => void) | null = null;
  readonly lines = new Graphics();
  readonly glow = new Graphics();
  readonly realmLayer = new RealmLayer();
  /** Walls (session 20b): a ring round each wall's whole footprint in its House's colour, battlements from Mid in. */
  readonly walls = new Graphics();
  private wallRings: { color: number; outlines: Line[]; remembered: boolean }[] = [];
  private wallKey = "";
  /** Battlements show from Mid zoom in (the share of Mid/Near detail, 0 at Far). */
  private battlements = 0;
  readonly sites = new Container();
  readonly figures = new Container();
  readonly arrows = new Graphics();
  /** The pass gate symbols (info layer). With the painted gatehouse in, they show at Far and fade out by Mid. */
  readonly gates = new Graphics();
  private paintedGates: boolean;
  /** Neighbour link marks for the selected territory. */
  readonly links = new Graphics();
  private labels: MapLabels;
  readonly names = new Container();
  private scene: MapScene | null = null;
  private status = new Map<string, TerritoryStatus>();
  private realms = new Map<string, Line[]>();
  /** Who holds what, as last drawn: House borders are only rebuilt when this changes (not every replay frame). */
  private realmKey = "";
  private rememberedKey: string | null = null;
  private drawnScale = 0;
  private isTactical = false;
  private rings: Map<string, readonly Line[]>;
  /** Building sprites with where they'd like to stand, so each zoom can step them clear of the army marker. */
  private siteViews: { root: Container; site: { x: number; y: number }; label: { x: number; y: number } }[] = [];
  private shadowTex: Texture | null = null;
  private labelOf: Map<string, { x: number; y: number; r: number }>;

  constructor(
    private map: MapDef,
    private bank: TextureBank,
  ) {
    const g = map.geometry!;
    this.rings = new Map(g.territories.map((t) => [t.id, t.rings]));
    this.labelOf = new Map(g.territories.map((t) => [t.id, t.label]));
    this.labels = buildLabels(map);
    this.names.addChild(this.labels.places);
    this.figures.visible = false;
    this.paintedGates = !!bank.get("pass-gate");
  }

  setScene(scene: MapScene, tactical: boolean) {
    this.scene = scene;
    this.isTactical = tactical;
    const { view } = scene;
    this.status = new Map(this.map.territories.map((t) => [t.id, territoryStatus(view, t.id)]));
    const ownerOf = (id: string) => {
      const s = this.status.get(id)!;
      return s.kind === "seen" && s.owner ? s.owner : null;
    };
    // The replay updates the scene many times a second; rebuilding every border (with its wash) each time froze the
    // page once realms grew. Rebuild only when ownership changes.
    const realmKey = this.map.territories.map((t) => `${ownerOf(t.id) ?? ""}:${houseOf(view, ownerOf(t.id)).name}`).join("|");
    if (realmKey !== this.realmKey) {
      this.realmKey = realmKey;
      this.realms = groupOutlines(this.map.geometry!, ownerOf);
      const held = new Map<string, (readonly Line[])[]>();
      for (const [id] of this.status) {
        const o = ownerOf(id);
        if (o) (held.get(o) ?? held.set(o, []).get(o)!).push(this.rings.get(id)!);
      }
      this.realmLayer.setRealms([...this.realms].map(([owner, outlines]) => ({ house: houseOf(view, owner), outlines, territories: held.get(owner) ?? [] })));
      this.onRealms?.([...held].map(([owner, territories]) => ({ color: houseOf(view, owner).land, territories })));
    }
    // Remembered land (the dashed "last seen" outline) only changes when vision does.
    const remembered = [...this.status].filter(([, s]) => s.kind === "remembered" && s.owner);
    const rememberedKey = remembered.map(([id, s]) => `${id}:${houseOf(view, s.owner).name}`).join("|");
    if (rememberedKey !== this.rememberedKey) {
      this.rememberedKey = rememberedKey;
      this.realmLayer.setRemembered(remembered.map(([id, s]) => ({ house: houseOf(view, s.owner), rings: this.rings.get(id)! })));
    }
    this.setWalls(view);
    this.realmLayer.setSelected(scene.selected ? (this.rings.get(scene.selected) ?? null) : null);
    this.realmLayer.visible = !tactical;
    this.drawFills();
    this.drawSites();
    this.drawnScale = 0; // lines and arrows redraw at the next zoom update
  }

  /**
   * The walls you can see (view.walls: anyone who sees part of a wall sees all of it), each outlined as one ring round
   * its footprint; walls you only remember (in the fog), greyed like a remembered building. Rebuilt only when they change.
   */
  private setWalls(view: MapScene["view"]) {
    const walls = wallFootprints(view, this.map.territories.map((t) => t.id));
    const key = walls.map((w) => `${w.key}=${houseOf(view, w.owner).color}:${w.territories.join(",")}`).join("|");
    if (key === this.wallKey) return;
    this.wallKey = key;
    const groupOf = new Map(walls.flatMap((w) => w.territories.map((t) => [t, w.key] as const)));
    const outlines = groupOf.size ? groupOutlines(this.map.geometry!, (id) => groupOf.get(id) ?? null) : new Map<string, Line[]>();
    this.wallRings = walls.map((w) => ({ color: w.remembered ? 0x8a8a8a : hexNum(houseOf(view, w.owner).color), remembered: w.remembered, outlines: outlines.get(w.key) ?? [] }));
  }

  /**
   * The walls, in screen pixels (Nate's picture, session 20b): a glow of the House colour, a grey stone wall standing up
   * off the land (its shadow, its face, a lit top), and from Mid in its battlements, square towers at the corners and
   * along long stretches, each flying a pennant in the House colour. A wall you only remember is grey all through.
   * Drawn in code until a painted wall piece and tower come in an art batch.
   */
  private drawWalls(px: number) {
    const W = this.walls;
    W.clear();
    if (this.isTactical) {
      for (const w of this.wallRings) for (const l of w.outlines) ring(W, l, false).stroke({ width: 4 * px, color: w.remembered ? 0x6a6a6a : INK, alpha: 0.95, join: "miter", cap: "butt" });
      return;
    }
    const up = (l: Line, dy: number): Line => (l as number[]).map((v, i) => (i % 2 ? v - dy : v));
    const towers: { x: number; y: number; col: number; a: number }[] = [];
    for (const w of this.wallRings) {
      const a = w.remembered ? 0.6 : 1;
      const stone = w.remembered ? 0x9a9a9a : STONE, top = w.remembered ? 0xb8b8b8 : STONE_LIGHT;
      for (const l of w.outlines) {
        // The House's glow round it, then the wall: a shadow on the land, its face, and the lit top a little higher.
        ring(W, l, false).stroke({ width: 22 * px, color: w.color, alpha: 0.32 * a, join: "round", cap: "round" });
        ring(W, up(l, -2.5 * px), false).stroke({ width: 13 * px, color: INK, alpha: 0.55 * a, join: "round", cap: "round" });
        ring(W, l, false).stroke({ width: 12 * px, color: INK, alpha: 0.9 * a, join: "round", cap: "round" });
        ring(W, l, false).stroke({ width: 9.5 * px, color: stone, alpha: a, join: "round", cap: "round" });
        ring(W, up(l, 2.5 * px), false).stroke({ width: 4 * px, color: top, alpha: a, join: "round", cap: "round" });
        if (this.battlements > 0.02) {
          // Battlements: stone merlons along the top, each edged in ink.
          const m = up(l, 4.5 * px);
          stitches(W, m, 4 * px, 4 * px, 5.5 * px, INK, 0.9 * a * this.battlements);
          stitches(W, m, 4 * px, 4 * px, 3.5 * px, top, a * this.battlements);
          for (const t of towerSpots(l, px)) towers.push({ ...t, col: w.remembered ? 0x8a8a8a : w.color, a });
        }
      }
    }
    // Towers over the wall (drawn last so the wall never runs across one).
    const T = 8 * px;
    for (const t of towers) {
      const k = t.a * this.battlements;
      W.rect(t.x - T + 1.5 * px, t.y - T + 2 * px, 2 * T, 2 * T).fill({ color: INK, alpha: 0.5 * k });
      W.rect(t.x - T, t.y - T - 4 * px, 2 * T, 2 * T + 4 * px).fill({ color: STONE, alpha: k }).stroke({ width: 1.4 * px, color: INK, alpha: 0.9 * k });
      W.rect(t.x - T, t.y - T - 4 * px, 2 * T, 3 * px).fill({ color: STONE_LIGHT, alpha: k });
      for (const dx of [-T + 1.5 * px, -1.5 * px, T - 4.5 * px]) W.rect(t.x + dx, t.y - T - 7 * px, 3 * px, 3 * px).fill({ color: STONE_LIGHT, alpha: k }).stroke({ width: 1 * px, color: INK, alpha: 0.85 * k });
      // The pennant: a pole and a small flag in the House colour.
      const px0 = t.x + 1 * px, py0 = t.y - T - 7 * px;
      W.moveTo(px0, py0).lineTo(px0, py0 - 10 * px).stroke({ width: 1.3 * px, color: INK, alpha: k });
      W.poly([px0, py0 - 10 * px, px0 + 8 * px, py0 - 8 * px, px0, py0 - 6 * px]).fill({ color: t.col, alpha: k }).stroke({ width: 0.8 * px, color: INK, alpha: 0.8 * k });
    }
  }

  /** The flat Tactical map. (Illustrated, the House tint is painted by the world layer's shader: see onRealms.) */
  private drawFills() {
    const g = this.map.geometry!;
    const { view } = this.scene!;
    const t = this.tactical;
    t.clear();
    if (this.isTactical) {
      t.rect(0, 0, g.width, g.height).fill(0x24506e);
      for (const w of g.water) for (const r of w.rings) ring(t, r).fill(0x24506e);
      for (const m of g.mountains) {
        for (const r of m.rings) ring(t, r).fill(0x5a5650);
        for (const r of m.rings) ring(t, r).stroke({ width: 1.2, color: 0x2d2a26, alpha: 0.8 });
      }
      for (const [id, s] of this.status) {
        const rings = this.rings.get(id)!;
        const color =
          s.kind === "seen" ? (s.owner ? houseOf(view, s.owner).color : "#d4c9aa") : s.kind === "remembered" && s.owner ? mixHex(houseOf(view, s.owner).color, "#7d8087", 0.65) : "#7d8087";
        ring(t, rings[0]!).fill(hexNum(color));
        for (const hole of rings.slice(1)) ring(t, hole).cut();
      }
      for (const r of g.rivers) t.poly(r.path as number[], false).stroke({ width: 2.4, color: 0x4f9bd0, cap: "round", join: "round" });
      for (const l of g.seaLanes) t.poly(l.path as number[], false).stroke({ width: 2, color: 0xf2f2f2, alpha: 0.8 });
      for (const p of g.passes) t.circle(p.x, p.y, 6).fill(0xe8d39a).stroke({ width: 1.5, color: INK });
      t.visible = true;
      return;
    }
    t.visible = false;
  }

  /** The soft ground shadow the castles stand on (world.ts), made once. */
  private groundShadow(): Texture {
    if (this.shadowTex) return this.shadowTex;
    const [c, ctx] = canvas(64, 32);
    const grad = ctx.createRadialGradient(32, 16, 2, 32, 16, 30);
    grad.addColorStop(0, "rgba(0,0,0,0.55)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.scale(1, 0.5);
    ctx.fillRect(0, 0, 64, 64);
    return (this.shadowTex = Texture.from(c));
  }

  /** Building sprites at each site, and the figures shown at Near zoom. */
  private drawSites() {
    for (const c of [...this.sites.removeChildren(), ...this.figures.removeChildren()]) c.destroy({ children: true });
    this.siteViews = [];
    const g = this.map.geometry!;
    const { view } = this.scene!;
    for (const t of g.territories) {
      const s = this.status.get(t.id)!;
      const b = s.building ?? s.construction;
      if (b && !this.isTactical) {
        const tex = this.bank.get(`building-${b}`);
        if (tex) {
          const root = new Container();
          // Standing on the ground like the capital's castle: a soft shadow down and to the right.
          const sh = new Sprite(this.groundShadow());
          sh.anchor.set(0.5);
          sh.width = BUILDING_SIZE * 0.95;
          sh.height = BUILDING_SIZE * 0.34;
          sh.alpha = 0.55;
          sh.position.set(BUILDING_SIZE * 0.14, BUILDING_SIZE * 0.04);
          const sp = new Sprite(tex);
          sp.anchor.set(0.5, 0.88);
          sp.scale.set(BUILDING_SIZE / tex.width);
          root.addChild(sh, sp);
          if (s.kind === "remembered") {
            // Remembered (in the fog): greyed.
            sp.tint = 0x8a8a8a;
            sp.alpha = 0.6;
          } else if (!s.building) {
            // Being built: the building, a little washed out, behind a wooden scaffold (Nate's art once it's in).
            const wash = new ColorMatrixFilter();
            wash.saturate(-0.55);
            sp.filters = [wash];
            const art = this.bank.get("scaffold");
            if (art) {
              const sc = new Sprite(art);
              sc.anchor.set(0.5, 0.9);
              // Sized by height to just over the building's (the art is a tall tower; by width it stood over a capital).
              sc.scale.set((sp.height * 1.05) / art.height);
              root.addChild(sc);
            } else root.addChild(scaffold(BUILDING_SIZE));
          }
          this.sites.addChild(root);
          this.siteViews.push({ root, site: t.site, label: t.label });
        }
      }
      if (s.kind !== "seen" || !s.owner || s.troops <= 0) continue;
      const house = houseOf(view, s.owner);
      // (Batch 4 brought the rangers' and the standard-bearer's figures; the spy's isn't a specialist.)
      const names = ["figure-army", ...s.specialists.map((sp) => (sp === "standardBearer" ? "figure-standard-bearer" : `figure-${sp}`))].filter((n) => n !== "figure-spy" && (FIGURE_SPRITES as readonly string[]).includes(n));
      names.forEach((name, i) => {
        const tex = this.bank.get(name);
        if (!tex) return;
        const fig = new Container();
        const base = new Sprite(tex);
        base.anchor.set(0.5, 0.9);
        fig.addChild(base);
        const mask = this.bank.mask(name);
        if (mask) {
          const m = new Sprite(mask);
          m.anchor.set(0.5, 0.9);
          m.tint = hexNum(house.color);
          fig.addChild(m);
        }
        fig.scale.set((i === 0 ? FIGURE_SIZE : FIGURE_SIZE * 0.85) / tex.width);
        // Beside the army marker: the army to the left, specialists to the right.
        const side = i === 0 ? -1 : 1;
        fig.position.set(t.label.x + side * (18 + (i > 1 ? (i - 1) * 13 : 0)), t.label.y + 14);
        this.figures.addChild(fig);
      });
    }
  }

  /** Redraw lines and arrows when the zoom has changed enough; set fades. */
  setZoom(scale: number, mix: DetailMix) {
    // The gate symbol always shows at Far and in Tactical; with the painted gatehouse it gives way from Mid in.
    // (Illustrated, `icons` is 1 - Far.)
    this.gates.alpha = this.isTactical || !this.paintedGates ? 1 : 1 - mix.icons;
    this.labels.places.alpha = Math.min(1, 0.4 + mix.placeNames);
    this.figures.visible = !this.isTactical && mix.nearDetail > 0.02;
    this.figures.alpha = mix.nearDetail;
    // Walls' battlements show from Mid in (where the icons do).
    const merlons = Math.round(mix.icons * 4) / 4;
    if (merlons !== this.battlements) (this.battlements = merlons), (this.drawnScale = 0);
    if (this.scene && (this.drawnScale === 0 || Math.abs(Math.log(scale / this.drawnScale)) > 0.08)) {
      this.drawnScale = scale;
      this.drawLines(scale);
      this.drawArrows(scale);
      this.placeSites(scale);
    }
  }

  /**
   * Buildings never hide under the army marker: where a sprite would overlap the marker at this zoom, it steps
   * sideways (toward the side its site is on) until it clears it, up to MAX_SITE_SHIFT map units.
   */
  private placeSites(scale: number) {
    const reachX = PILL_REACH_X / scale, reachY = PILL_REACH_Y / scale, S = BUILDING_SIZE;
    for (const v of this.siteViews) {
      let x = v.site.x;
      const top = v.site.y - 0.88 * S, bottom = v.site.y + 0.12 * S;
      if (top < v.label.y + reachY && bottom > v.label.y - reachY) {
        const side = v.site.x >= v.label.x ? 1 : -1;
        const clear = v.label.x + side * (reachX + S * 0.45);
        if ((clear - x) * side > 0) x = v.site.x + side * Math.min(MAX_SITE_SHIFT, (clear - x) * side);
      }
      v.root.position.set(x, v.site.y);
    }
  }

  private drawLines(scale: number) {
    const g = this.map.geometry!;
    const { view, selected, targets, glow } = this.scene!;
    const px = 1 / scale;
    const province = new Map(this.map.territories.map((t) => [t.id, t.province]));
    const L = this.lines, G = this.glow;
    L.clear();
    G.clear();
    // Every territory edge, at every zoom: a crisp ink line with a light halo, so it reads inside one House's land
    // and between neutral lands too (Tactical: a plain dark line). Province borders: a gilded double line (gold,
    // a dark rule, gold), distinct from both territory edges and the House bands.
    for (const b of g.borderLines) {
      const prov = province.get(b.a) !== province.get(b.b);
      for (const l of b.lines) {
        const st = (width: number, color: number, alpha: number) => ring(L, l, false).stroke({ width: width * px, color, alpha, join: "round", cap: "round" });
        if (prov) {
          st(6.4, INK, 0.38);
          st(4.6, GOLD_HI, 0.92);
          st(1.5, INK, 0.85);
        } else if (this.isTactical) st(1.1, INK, 0.5);
        else {
          st(3.2, 0xf6efdc, 0.42);
          st(1.15, INK, 0.78);
        }
      }
    }
    // Truces (session 14): every border a truce covers, where you can see it: a white band stitched with dark dashes
    // (a binding pact adds gold studs). Widths in screen pixels, so it reads at every zoom. Agreed this turn: fainter.
    const truces = this.scene!.truces ?? [];
    if (truces.length) {
      const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
      const lineOf = new Map(g.borderLines.map((b) => [key(b.a, b.b), b.lines]));
      for (const t of truces)
        for (const l of lineOf.get(key(t.a, t.b)) ?? []) {
          const fade = t.pending ? 0.65 : 1;
          ring(G, l, false).stroke({ width: 11 * px, color: INK, alpha: 0.45 * fade, join: "round", cap: "round" });
          ring(G, l, false).stroke({ width: 8 * px, color: 0xffffff, alpha: 0.9 * fade, join: "round", cap: "round" });
          stitches(G, l, 9 * px, 7 * px, 2.4 * px, INK, 0.85 * fade);
          if (t.bond === "binding") studs(G, l, 28 * px, 3.4 * px, GOLD_HI);
        }
    }
    // Passes: a small stone gate across the road, sized to read at Mid zoom.
    this.gates.clear();
    for (const p of g.passes) {
      const a = this.labelOf.get(p.a)!, b = this.labelOf.get(p.b)!;
      drawGate(this.gates, p.x, p.y, Math.atan2(b.y - a.y, b.x - a.x), Math.min(Math.max(16, 24 * px), 32 * px), px);
    }
    // Realms: in Tactical, a dark line round everything each House holds. Illustrated: the House bands (realms.ts).
    if (this.isTactical) for (const outlines of this.realms.values()) for (const l of outlines) ring(G, l, false).stroke({ width: 2.6 * px, color: INK, alpha: 0.9, join: "round" });
    else this.realmLayer.draw(px);
    this.drawWalls(px);
    // Provinces on demand (session 16): the province of the territory you tapped, lit round its whole border with a
    // bright band (a soft light halo, a dark rule, a warm white core), so it reads over every House colour, the
    // gilded province borders and the sea.
    const lit = this.scene!.province;
    if (lit)
      for (const l of this.provinceOutline(lit)) {
        ring(G, l, false).stroke({ width: 17 * px, color: 0xffffff, alpha: 0.22, join: "round", cap: "round" });
        ring(G, l, false).stroke({ width: 10 * px, color: INK, alpha: 0.85, join: "round", cap: "round" });
        ring(G, l, false).stroke({ width: 5 * px, color: 0xfff7d6, alpha: 1, join: "round", cap: "round" });
      }
    // A leader's command (session 18): the provinces it works in, outlined with a gold band (dashed with ink, so it
    // reads apart from the lit province's white one).
    for (const p of this.scene!.area ?? [])
      for (const l of this.provinceOutline(p)) {
        ring(G, l, false).stroke({ width: 12 * px, color: GOLD_HI, alpha: 0.28, join: "round", cap: "round" });
        ring(G, l, false).stroke({ width: 5 * px, color: INK, alpha: 0.8, join: "round", cap: "round" });
        ring(G, l, false).stroke({ width: 3 * px, color: GOLD_HI, alpha: 1, join: "round", cap: "round" });
      }
    // Where the selected army can go.
    for (const id of targets) {
      for (const r of this.rings.get(id) ?? []) {
        ring(G, r).fill({ color: 0xffffff, alpha: 0.1 });
        ring(G, r).stroke({ width: 2.2 * px, color: 0xffffff, alpha: 0.8, join: "round" });
      }
    }
    // Recruit sites while the Recruit panel is open: a gold glow.
    for (const id of glow) {
      for (const r of this.rings.get(id) ?? []) {
        ring(G, r).fill({ color: GOLD_HI, alpha: 0.2 });
        ring(G, r).stroke({ width: 6 * px, color: GOLD_HI, alpha: 0.35, join: "round" });
        ring(G, r).stroke({ width: 2.2 * px, color: 0xfff1c1, alpha: 0.95, join: "round" });
      }
    }
    // What the selected territory is connected to: a chevron across each shared border (red core: you'd attack,
    // blue: you'd move), with the border's kind marked (river ripples, a pass's arch); its sea lanes light up.
    this.links.clear();
    if (selected) this.drawLinks(selected, px);
    // Your spies, over the selection's chevrons.
    this.drawSpies(px);
    // Selection in Tactical: a gold outline (illustrated: the pulsing double rule in realms.ts).
    if (selected && this.isTactical)
      for (const r of this.rings.get(selected) ?? []) {
        ring(G, r).stroke({ width: 7 * px, color: GOLD_HI, alpha: 0.5, join: "round" });
        ring(G, r).stroke({ width: 2.6 * px, color: 0xfff1c1, alpha: 1, join: "round" });
      }
  }

  private provinceOutlines: Map<string, Line[]> | null = null;
  /** The outline of a whole province (its border with other provinces and its coast). */
  private provinceOutline(province: string): Line[] {
    if (!this.provinceOutlines) {
      const of = new Map(this.map.territories.map((t) => [t.id, t.province]));
      this.provinceOutlines = groupOutlines(this.map.geometry!, (id) => of.get(id) ?? null);
    }
    return this.provinceOutlines.get(province) ?? [];
  }

  /** Neighbour link marks for the selected territory (see drawLines). */
  private drawLinks(selected: string, px: number) {
    const K = this.links;
    const g = this.map.geometry!;
    const { view } = this.scene!;
    const me = view.me.id;
    const size = 19 * px;
    const from = this.labelOf.get(selected)!;
    for (const b of this.map.borders) {
      if (b.a !== selected && b.b !== selected) continue;
      const other = b.a === selected ? b.b : b.a;
      const ov = view.territories[other];
      const mine = ov?.detail === "full" && ov.owner === me;
      const core = mine ? MOVE : ATTACK;
      const to = this.labelOf.get(other)!;
      if (b.type === "sea") {
        const lane = g.seaLanes.find((l) => (l.a === b.a && l.b === b.b) || (l.a === b.b && l.b === b.a));
        if (!lane) continue;
        const [x0, y0, x1, y1] = lane.path as [number, number, number, number];
        const len = Math.hypot(x1 - x0, y1 - y0) || 1;
        const bend = Math.min(30, len * 0.18);
        const cx = (x0 + x1) / 2 + ((y1 - y0) / len) * bend, cy = (y0 + y1) / 2 - ((x1 - x0) / len) * bend;
        for (const [w, c, a] of [[9, GOLD_HI, 0.28], [3.2, 0xfff1c1, 0.95]] as const) K.moveTo(x0, y0).quadraticCurveTo(cx, cy, x1, y1).stroke({ width: w * px, color: c, alpha: a, cap: "round" });
        const [mx, my, ang] = quadPoint(x0, y0, cx, cy, x1, y1, 0.5);
        const toward = Math.cos(ang) * (to.x - mx) + Math.sin(ang) * (to.y - my) >= 0 ? ang : ang + Math.PI;
        chevron(K, mx, my, toward, size, core, px);
        continue;
      }
      const line = g.borderLines.find((l) => (l.a === b.a && l.b === b.b) || (l.a === b.b && l.b === b.a));
      if (!line) continue;
      const longest = [...line.lines].sort((p, q) => lineLength(q) - lineLength(p))[0]!;
      const [mx, my, tan] = lineMid(longest);
      // Point across the border, toward the neighbour.
      let ang = tan + Math.PI / 2;
      if (Math.cos(ang) * (to.x - from.x) + Math.sin(ang) * (to.y - from.y) < 0) ang += Math.PI;
      if (b.type === "river") {
        // Blue ripples along the border, either side of the chevron.
        for (const side of [-1, 1]) {
          const ox = Math.cos(tan) * side * size * 1.25, oy = Math.sin(tan) * side * size * 1.25;
          const pts: number[] = [];
          for (let i = 0; i <= 8; i++) {
            const t = (i / 8 - 0.5) * size * 1.1, w = Math.sin((i / 8) * Math.PI * 2) * size * 0.18;
            pts.push(mx + ox + Math.cos(tan) * t - Math.sin(tan) * w, my + oy + Math.sin(tan) * t + Math.cos(tan) * w);
          }
          K.poly(pts, false).stroke({ width: 4 * px, color: INK, alpha: 0.45, cap: "round", join: "round" });
          K.poly(pts, false).stroke({ width: 2.2 * px, color: 0x6cc0f0, alpha: 1, cap: "round", join: "round" });
        }
      }
      if (b.type === "pass") {
        // A stone arch around the chevron.
        const r = size * 1.05, a0 = ang - Math.PI * 0.75, a1 = ang + Math.PI * 0.75;
        for (const [w, c, al] of [[5, INK, 0.5], [3, 0xd9cdb0, 1]] as const) K.moveTo(mx + Math.cos(a0) * r, my + Math.sin(a0) * r).arc(mx, my, r, a0, a1).stroke({ width: w * px, color: c, alpha: al, cap: "round" });
      }
      chevron(K, mx, my, ang, size, core, px);
    }
  }

    // Your spies (session 15): a small dark badge up and to the left of where each stands, gold-rimmed: an eye inside a
    // rival's province, a shield on guard, a hood travelling. A second badge peeks out behind for two or more.
  private drawSpies(px: number) {
    const G = this.links;
    // Passage land (session 15): territories armies may pass through under right of passage, where you can see them:
    // a ring of white stitches on a dark rule just inside the outline (gold where you may pass yourself), over the
    // House bands so it reads on any colour. Screen-pixel widths, so it reads at every zoom. Agreed this turn: fainter.
    for (const pl of this.scene!.passage ?? []) {
      const fade = pl.pending ? 0.6 : 1;
      for (const r of this.rings.get(pl.territory) ?? []) {
        ring(G, r).stroke({ width: 8 * px, color: INK, alpha: 0.55 * fade, join: "round" });
        stitches(G, r, 11 * px, 6 * px, 3.4 * px, pl.open ? GOLD_HI : 0xffffff, 0.95 * fade);
      }
    }
    for (const sp of this.scene!.spies ?? []) {
      const l = this.labelOf.get(sp.territory);
      if (!l) continue;
      const r = 13 * px, x = l.x - 34 * px, y = l.y - 30 * px;
      if (sp.count > 1) G.circle(x - 6 * px, y - 5 * px, r).fill({ color: INK, alpha: 0.85 }).stroke({ width: 1.6 * px, color: GOLD_HI });
      G.circle(x, y, r).fill({ color: INK, alpha: 0.92 }).stroke({ width: 2 * px, color: GOLD_HI });
      if (sp.status === "in") {
        // An eye: two arcs and a pupil.
        G.moveTo(x - 7 * px, y).quadraticCurveTo(x, y - 7 * px, x + 7 * px, y).quadraticCurveTo(x, y + 7 * px, x - 7 * px, y).stroke({ width: 1.8 * px, color: 0xfff1c1 });
        G.circle(x, y, 2.6 * px).fill({ color: 0xfff1c1 });
      } else if (sp.status === "defend") {
        // A shield.
        G.moveTo(x - 6 * px, y - 6 * px).lineTo(x + 6 * px, y - 6 * px).lineTo(x + 6 * px, y + 1 * px).quadraticCurveTo(x, y + 8 * px, x - 6 * px, y + 1 * px).closePath().stroke({ width: 1.8 * px, color: 0xfff1c1 });
      } else {
        // A hood over a face.
        G.moveTo(x - 6 * px, y + 6 * px).quadraticCurveTo(x - 6 * px, y - 8 * px, x, y - 7 * px).quadraticCurveTo(x + 6 * px, y - 8 * px, x + 6 * px, y + 6 * px).stroke({ width: 1.8 * px, color: 0xfff1c1 });
        G.circle(x, y + 1 * px, 2.2 * px).fill({ color: 0xfff1c1 });
      }
    }
  }

  /** Gold-trimmed arrows for queued orders (and the one being drafted). */
  private drawArrows(scale: number) {
    const A = this.arrows;
    A.clear();
    const px = 1 / scale;
    for (const a of this.scene!.arrows) {
      const pts = [a.from, ...(a.via ? [a.via] : []), ...(a.through ?? []), a.to].map((id) => this.labelOf.get(id)!);
      const color = a.attack ? ATTACK : MOVE;
      const alpha = a.draft ? 0.8 : 1;
      for (let i = 1; i < pts.length; i++) {
        const p0 = pts[i - 1]!, p1 = pts[i]!;
        const dx = p1.x - p0.x, dy = p1.y - p0.y, len = Math.hypot(dx, dy) || 1;
        const last = i === pts.length - 1;
        // Start clear of the source marker, stop at the target marker's edge.
        const s0 = (i === 1 ? 16 : 0) * px, s1 = (last ? 20 : 0) * px;
        const x0 = p0.x + (dx / len) * s0, y0 = p0.y + (dy / len) * s0;
        const x1 = p1.x - (dx / len) * s1, y1 = p1.y - (dy / len) * s1;
        const bend = Math.min(len * 0.16, 40 * px);
        const cx = (x0 + x1) / 2 + (-dy / len) * bend, cy = (y0 + y1) / 2 + (dx / len) * bend;
        const headLen = 15 * px;
        const [ex, ey, ang] = quadPoint(x0, y0, cx, cy, x1, y1, 1);
        // Stop the shaft under the head.
        const bx = ex - Math.cos(ang) * headLen * 0.7, by = ey - Math.sin(ang) * headLen * 0.7;
        for (const [w, c] of [[8.5, GOLD], [5, color]] as const)
          A.moveTo(x0, y0).quadraticCurveTo(cx, cy, last ? bx : x1, last ? by : y1).stroke({ width: w * px, color: c, alpha, cap: "round", join: "round" });
        if (last) {
          const hw = 9 * px;
          const tip = [ex, ey, ex - Math.cos(ang) * headLen - Math.sin(ang) * hw, ey - Math.sin(ang) * headLen + Math.cos(ang) * hw, ex - Math.cos(ang) * headLen + Math.sin(ang) * hw, ey - Math.sin(ang) * headLen - Math.cos(ang) * hw];
          A.poly(tip).fill({ color, alpha }).stroke({ width: 1.8 * px, color: GOLD, alpha, join: "round" });
        }
      }
    }
  }

  /** Where an order's number badge goes (the middle of its arrow), in map units. */
  arrowMid(a: MapScene["arrows"][number]): [number, number] {
    const mid = a.via ?? a.through?.[Math.floor((a.through.length - 1) / 2)];
    const p0 = this.labelOf.get(a.from)!, p1 = this.labelOf.get(a.to)!;
    const p = mid ? this.labelOf.get(mid)! : { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
    return [p.x, p.y];
  }

  destroy() {
    this.labels.destroy();
    for (const c of [this.tactical, this.lines, this.gates, this.glow, this.links, this.sites, this.figures, this.arrows, this.names]) c.destroy({ children: true });
    this.shadowTex?.destroy(true);
    this.realmLayer.destroy();
  }
}

const lineLength = (l: Line) => {
  let s = 0;
  for (let i = 2; i < l.length; i += 2) s += Math.hypot(l[i]! - l[i - 2]!, l[i + 1]! - l[i - 1]!);
  return s;
};

/** The point halfway along a line, and the line's direction there. */
function lineMid(l: Line): [number, number, number] {
  const half = lineLength(l) / 2;
  let acc = 0;
  for (let i = 2; i < l.length; i += 2) {
    const x0 = l[i - 2]!, y0 = l[i - 1]!, x1 = l[i]!, y1 = l[i + 1]!;
    const seg = Math.hypot(x1 - x0, y1 - y0);
    if (acc + seg >= half && seg > 0) {
      const t = (half - acc) / seg;
      return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, Math.atan2(y1 - y0, x1 - x0)];
    }
    acc += seg;
  }
  return [l[0]!, l[1]!, 0];
}

/** A gilded chevron pointing along `ang`, with a coloured core. */
function chevron(g: Graphics, x: number, y: number, ang: number, size: number, core: number, px: number) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const at = (u: number, v: number) => [x + c * u - s * v, y + s * u + c * v];
  const pts = [...at(size * 0.62, 0), ...at(-size * 0.45, size * 0.6), ...at(-size * 0.12, 0), ...at(-size * 0.45, -size * 0.6)];
  g.poly(pts).stroke({ width: 4 * px, color: INK, alpha: 0.55, join: "round" });
  g.poly(pts).fill({ color: core, alpha: 0.95 }).stroke({ width: 1.8 * px, color: GOLD_HI, alpha: 1, join: "round" });
}

/**
 * A pass's gate, as a map symbol that reads on any ground and among the mountain sprites: a navy disc with a gold
 * rim and a parchment stone arch, turned to face along the road. `w` is its diameter in map units.
 */
function drawGate(g: Graphics, x: number, y: number, roadAng: number, w: number, px: number) {
  const r = w / 2;
  g.circle(x, y, r + 1.5 * px).fill({ color: INK, alpha: 0.45 });
  g.circle(x, y, r).fill({ color: 0x0f1620, alpha: 0.92 }).stroke({ width: 1.6 * px, color: GOLD, alpha: 1 });
  // The arch faces across the road: its opening points along the road.
  const c = Math.cos(roadAng), s = Math.sin(roadAng);
  const at = (u: number, v: number): [number, number] => [x + c * u - s * v, y + s * u + c * v];
  const a = r * 0.58, leg = r * 0.5, t = Math.max(1.6 * px, r * 0.2);
  // Two pillars and the arch over them (u: along the road, v: across it).
  const pts: number[] = [];
  pts.push(...at(leg, -a), ...at(-leg * 0.15, -a));
  for (let i = 0; i <= 12; i++) {
    const th = Math.PI + (i / 12) * Math.PI;
    pts.push(...at(-leg * 0.15 + Math.sin(th) * a * 0.9, Math.cos(th) * a));
  }
  pts.push(...at(leg, a));
  g.poly(pts, false).stroke({ width: t, color: 0xede6d6, alpha: 1, cap: "butt", join: "round" });
}

/** A wooden scaffold over a building being built (anchored like the sprite: x centred, y at its foot). */
function scaffold(S: number): Graphics {
  const g = new Graphics();
  const poles = [-0.4, 0, 0.4].map((u) => u * S);
  const top = -0.66 * S, foot = 0.06 * S;
  const planks = [-0.18, -0.42].map((v) => v * S);
  const wood = (draw: () => void, w: number) => {
    draw();
    g.stroke({ width: w + 1.4, color: 0x24170b, alpha: 0.85, cap: "round" });
    draw();
    g.stroke({ width: w, color: 0xa8773f, alpha: 1, cap: "round" });
  };
  for (const x of poles) wood(() => g.moveTo(x, foot).lineTo(x, top), 1.5);
  for (const y of planks) wood(() => g.moveTo(-0.46 * S, y).lineTo(0.46 * S, y), 1.3);
  // Cross braces between the poles.
  for (let i = 0; i < poles.length - 1; i++) wood(() => g.moveTo(poles[i]!, planks[0]!).lineTo(poles[i + 1]!, planks[1]!), 0.9);
  return g;
}

function mixHex(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa.map((v, i) => Math.round(v + (pb[i]! - v) * t).toString(16).padStart(2, "0")).join("")}`;
}
