import type { Line, MapDef } from "@conquerra/content";
import { Container, Graphics, Sprite } from "pixi.js";
import { FIGURE_SPRITES } from "@conquerra/art";
import { hexNum, houseOf, NEUTRAL_HOUSE } from "../../map/houses";
import { groupOutlines, quadPoint } from "../../map/shapes";
import { territoryStatus, type TerritoryStatus } from "../../map/status";
import type { DetailMix } from "../../map/zoom";
import type { MapScene } from "../types";
import type { TextureBank } from "./bank";
import { buildLabels, type MapLabels } from "./labels";

/**
 * The info layer in map space: House tint and borders, the selection glow, reachable-target highlights, order
 * arrows, building sprites at each site, specialist figures at Near zoom, and the place names. Line widths are in
 * screen pixels, so lines are redrawn when the zoom changes enough.
 */

const GOLD = 0xc9a45c, GOLD_HI = 0xe3c77e, ATTACK = 0xc2553f, MOVE = 0x3a72c4, INK = 0x1b1206;
/** A building sprite's width, and a figure's, in map units. */
const BUILDING_SIZE = 26, FIGURE_SIZE = 20;

const ring = (g: Graphics, r: Line, close = true) => g.poly(r as number[], close);

export class InfoLayer {
  readonly tactical = new Graphics();
  readonly tint = new Graphics();
  readonly lines = new Graphics();
  readonly glow = new Graphics();
  readonly sites = new Container();
  readonly figures = new Container();
  readonly arrows = new Graphics();
  private labels: { illustrated: MapLabels; tactical: MapLabels };
  readonly names = new Container();
  private scene: MapScene | null = null;
  private status = new Map<string, TerritoryStatus>();
  private realms = new Map<string, Line[]>();
  private drawnScale = 0;
  private isTactical = false;
  private rings: Map<string, readonly Line[]>;
  private labelOf: Map<string, { x: number; y: number; r: number }>;

  constructor(
    private map: MapDef,
    private bank: TextureBank,
  ) {
    const g = map.geometry!;
    this.rings = new Map(g.territories.map((t) => [t.id, t.rings]));
    this.labelOf = new Map(g.territories.map((t) => [t.id, t.label]));
    this.labels = { illustrated: buildLabels(map, true), tactical: buildLabels(map, false) };
    this.names.addChild(this.labels.illustrated.provinces, this.labels.illustrated.places, this.labels.tactical.provinces, this.labels.tactical.places);
    this.figures.visible = false;
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
    this.realms = groupOutlines(this.map.geometry!, ownerOf);
    this.drawFills();
    this.drawSites();
    this.labels.illustrated.provinces.visible = this.labels.illustrated.places.visible = !tactical;
    this.labels.tactical.provinces.visible = this.labels.tactical.places.visible = tactical;
    this.drawnScale = 0; // lines and arrows redraw at the next zoom update
  }

  /** Fills: the flat Tactical map, or the House tint over the painting. */
  private drawFills() {
    const g = this.map.geometry!;
    const { view } = this.scene!;
    const t = this.tactical, tint = this.tint;
    t.clear();
    tint.clear();
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
    for (const [id, s] of this.status) {
      if (s.kind !== "seen" || !s.owner) continue;
      const rings = this.rings.get(id)!;
      ring(tint, rings[0]!).fill(hexNum(houseOf(view, s.owner).color));
      for (const hole of rings.slice(1)) ring(tint, hole).cut();
    }
  }

  /** Building sprites at each site, and the figures shown at Near zoom. */
  private drawSites() {
    for (const c of [...this.sites.removeChildren(), ...this.figures.removeChildren()]) c.destroy();
    const g = this.map.geometry!;
    const { view } = this.scene!;
    for (const t of g.territories) {
      const s = this.status.get(t.id)!;
      const b = s.building ?? s.construction;
      if (b && !this.isTactical) {
        const tex = this.bank.get(`building-${b}`);
        if (tex) {
          const sp = new Sprite(tex);
          sp.anchor.set(0.5, 0.88);
          sp.scale.set(BUILDING_SIZE / tex.width);
          sp.position.set(t.site.x, t.site.y);
          // Being built: a faint outline of it. Remembered (in the fog): greyed.
          if (!s.building) sp.alpha = 0.45;
          if (s.kind === "remembered") (sp.tint = 0x8a8a8a), (sp.alpha = 0.6);
          this.sites.addChild(sp);
        }
      }
      if (s.kind !== "seen" || !s.owner || s.troops <= 0) continue;
      const house = houseOf(view, s.owner);
      const names = ["figure-army", ...s.specialists.map((sp) => `figure-${sp}`)].filter((n) => (FIGURE_SPRITES as readonly string[]).includes(n));
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
    this.tint.alpha = this.isTactical ? 1 : mix.tint;
    this.names.alpha = mix.provinceNames;
    this.labels.illustrated.places.alpha = this.labels.tactical.places.alpha = Math.min(1, 0.4 + mix.provinceNames);
    this.figures.visible = !this.isTactical && mix.nearDetail > 0.02;
    this.figures.alpha = mix.nearDetail;
    if (this.scene && (this.drawnScale === 0 || Math.abs(Math.log(scale / this.drawnScale)) > 0.08)) {
      this.drawnScale = scale;
      this.drawLines(scale);
      this.drawArrows(scale);
    }
  }

  private drawLines(scale: number) {
    const g = this.map.geometry!;
    const { view, selected, targets } = this.scene!;
    const px = 1 / scale;
    const province = new Map(this.map.territories.map((t) => [t.id, t.province]));
    const L = this.lines, G = this.glow;
    L.clear();
    G.clear();
    // Every border: a thin pale line (dark in Tactical). Province borders: heavier.
    for (const b of g.borderLines) {
      const prov = province.get(b.a) !== province.get(b.b);
      for (const l of b.lines) {
        if (this.isTactical) ring(L, l, false).stroke({ width: (prov ? 2.6 : 1) * px, color: INK, alpha: prov ? 0.85 : 0.45, join: "round" });
        else if (prov) {
          ring(L, l, false).stroke({ width: 3.4 * px, color: 0x2e2112, alpha: 0.5, join: "round", cap: "round" });
          ring(L, l, false).stroke({ width: 1.2 * px, color: 0xf3ead2, alpha: 0.55, join: "round", cap: "round" });
        } else ring(L, l, false).stroke({ width: 1.1 * px, color: 0xf3ead2, alpha: 0.42, join: "round", cap: "round" });
      }
    }
    // Realms: a thick glowing House border round everything each House holds (that you can see).
    for (const [owner, outlines] of this.realms) {
      const h = houseOf(view, owner);
      const glow = hexNum(h.glow), col = hexNum(h.color);
      for (const l of outlines) {
        if (this.isTactical) {
          ring(G, l, false).stroke({ width: 2.6 * px, color: INK, alpha: 0.9, join: "round" });
          continue;
        }
        ring(G, l, false).stroke({ width: 13 * px, color: glow, alpha: 0.16, join: "round", cap: "round" });
        ring(G, l, false).stroke({ width: 7 * px, color: glow, alpha: 0.32, join: "round", cap: "round" });
        ring(G, l, false).stroke({ width: 3.2 * px, color: col, alpha: 1, join: "round", cap: "round" });
        ring(G, l, false).stroke({ width: 1 * px, color: 0xffffff, alpha: h === NEUTRAL_HOUSE ? 0 : 0.45, join: "round", cap: "round" });
      }
    }
    // Where the selected army can go.
    for (const id of targets) {
      for (const r of this.rings.get(id) ?? []) {
        ring(G, r).fill({ color: 0xffffff, alpha: 0.1 });
        ring(G, r).stroke({ width: 2.2 * px, color: 0xffffff, alpha: 0.8, join: "round" });
      }
    }
    // Selection: a gold glow.
    if (selected)
      for (const r of this.rings.get(selected) ?? []) {
        ring(G, r).stroke({ width: 14 * px, color: GOLD_HI, alpha: 0.25, join: "round" });
        ring(G, r).stroke({ width: 7 * px, color: GOLD_HI, alpha: 0.5, join: "round" });
        ring(G, r).stroke({ width: 2.6 * px, color: 0xfff1c1, alpha: 1, join: "round" });
      }
  }

  /** Gold-trimmed arrows for queued orders (and the one being drafted). */
  private drawArrows(scale: number) {
    const A = this.arrows;
    A.clear();
    const px = 1 / scale;
    for (const a of this.scene!.arrows) {
      const pts = [a.from, ...(a.via ? [a.via] : []), a.to].map((id) => this.labelOf.get(id)!);
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
    const p0 = this.labelOf.get(a.via ?? a.from)!, p1 = this.labelOf.get(a.to)!;
    const p = a.via ? this.labelOf.get(a.via)! : { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
    return [p.x, p.y];
  }

  destroy() {
    this.labels.illustrated.destroy();
    this.labels.tactical.destroy();
    for (const c of [this.tactical, this.tint, this.lines, this.glow, this.sites, this.figures, this.arrows, this.names]) c.destroy({ children: true });
  }
}

function mixHex(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa.map((v, i) => Math.round(v + (pb[i]! - v) * t).toString(16).padStart(2, "0")).join("")}`;
}
