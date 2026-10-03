import type { MapDef } from "@conquerra/content";
import type { PlayerView } from "@conquerra/engine";
import { Container, Graphics, Sprite, Text, type TextStyleOptions } from "pixi.js";
import { toScreen, type Camera } from "../../map/camera";
import { hexNum, houseOf } from "../../map/houses";
import { layoutMarkers, markerMetrics, pillHeight, type MarkerContent, type MarkerMetrics } from "../../map/layout";
import { markerContent, markerPriority, territoryStatus, type TerritoryStatus } from "../../map/status";
import type { DetailMix, ZoomDetail } from "../../map/zoom";
import type { MapScene } from "../types";
import type { TextureBank } from "./bank";

/**
 * Army markers, drawn in screen space so they stay readable at every zoom: the troop pill (big bold number), a
 * House banner, a Leader crown, the building icon, specialist icons, culture dots, the territory name (Near) and
 * the two-line capital plaque. Last-seen intel shows faded with "?". Markers never overlap: they shift aside, or
 * merge into a neighbour ("+1"). Built at a reference size, then scaled to the zoom.
 */

const REF = 24; // reference pill height the marker is built at
const NAVY = 0x0f1620, GOLD = 0xc9a45c, GOLD_HI = 0xe3c77e, PARCH = 0xede6d6;
const ODDS_PIPS = { guaranteed: 4, likely: 3, possible: 2, impossible: 1, unknown: 0 } as const;
const ODDS_COLOR = { guaranteed: 0x7fc46a, likely: 0xe3c77e, possible: 0xe39a4e, impossible: 0xc2553f, unknown: 0x9aa3ae } as const;

const numberStyle = (size: number, fill: number): TextStyleOptions => ({ fontFamily: "Manrope, system-ui, sans-serif", fontWeight: "800", fontSize: size, fill, stroke: { color: 0x0b0f16, width: size * 0.12, join: "round" } });
const nameStyle = (size: number): TextStyleOptions => ({ fontFamily: "Cinzel, serif", fontWeight: "700", fontSize: size, fill: 0xf3ead2, stroke: { color: 0x1b1206, width: size * 0.28, join: "round" } });

interface MarkerView {
  id: string;
  root: Container;
  /** Fading parts. */
  icons: Container;
  near: Container;
  names: Container;
  merged: Container;
  mergedText: Text;
  metrics: MarkerMetrics; // at REF size
  anchor: [number, number];
  priority: number;
  /** Where it was put by the last layout, relative to its anchor (screen px). */
  offset: [number, number];
  hidden: boolean;
}

export class MarkerLayer {
  readonly root = new Container();
  private leaders = new Graphics();
  private layer = new Container();
  private badges = new Container();
  private markers = new Map<string, MarkerView>();
  private scene: MapScene | null = null;
  private key = "";
  private resolution: number;
  private labelOf: Map<string, { x: number; y: number }>;

  constructor(
    private map: MapDef,
    private bank: TextureBank,
    resolution: number,
  ) {
    this.resolution = Math.max(2, resolution);
    this.labelOf = new Map(map.geometry!.territories.map((t) => [t.id, t.label]));
    this.root.addChild(this.leaders, this.layer, this.badges);
  }

  /** Rebuild when the scene changes, or the zoom crosses a level that changes what markers hold. */
  update(scene: MapScene, mix: DetailMix, tactical: boolean, force = false) {
    const key = `${mix.icons > 0.5}|${mix.nearDetail > 0.5}|${mix.names > 0.5}|${tactical}`;
    if (!force && scene === this.scene && key === this.key) return false;
    this.scene = scene;
    this.key = key;
    for (const m of this.markers.values()) m.root.destroy({ children: true });
    this.markers.clear();
    const refZoom = { territoryPx: (REF - 15) / 0.05 };
    for (const t of this.map.territories) {
      const s = territoryStatus(scene.view, t.id);
      const content = markerContent(this.map, scene.view, s);
      if (!content) continue;
      const metrics = markerMetrics(content, refZoom, mix);
      const m = this.build(scene.view, s, content, metrics, mix);
      const lbl = this.labelOf.get(t.id)!;
      const mv: MarkerView = { ...m, id: t.id, metrics, anchor: [lbl.x, lbl.y], priority: markerPriority(scene.view, s), offset: [0, 0], hidden: false };
      this.markers.set(t.id, mv);
      this.layer.addChild(mv.root);
    }
    this.buildBadges(scene);
    return true;
  }

  private build(view: PlayerView, s: TerritoryStatus, c: MarkerContent, m: MarkerMetrics, mix: DetailMix) {
    const root = new Container();
    const icons = new Container(), near = new Container(), names = new Container(), merged = new Container();
    const house = houseOf(view, s.owner);
    const far = mix.icons <= 0.5;
    const remembered = s.kind === "remembered";
    const { pillH, pillW, font, icon } = m;
    // ---- The pill ----
    const pill = new Graphics();
    const shieldW = !far && c.owned ? pillH * 0.62 : 0;
    const x0 = -pillW / 2;
    if (far) {
      pill.roundRect(x0, -pillH / 2, pillW, pillH, pillH / 2).fill({ color: hexNum(house.color) }).stroke({ width: 1.6, color: 0x0b0f16, alpha: 0.85 });
    } else {
      pill.roundRect(x0, -pillH / 2, pillW, pillH, pillH / 2).fill({ color: NAVY, alpha: 0.92 }).stroke({ width: 2, color: c.owned ? hexNum(house.glow) : 0xd8cdb0 });
    }
    root.addChild(pill);
    if (shieldW) {
      const sh = new Sprite(this.bank.house("shield-base", house));
      sh.anchor.set(0.5);
      sh.scale.set((pillH * 0.74) / sh.texture.height);
      sh.position.set(x0 + pillH * 0.5, 0);
      root.addChild(sh);
    }
    const num = new Text({ text: c.label, style: numberStyle(font, far ? hexNum(house.ink) : 0xffffff), resolution: this.resolution });
    num.anchor.set(0.5, 0.52);
    num.position.set(shieldW / 2 + (shieldW ? pillH * 0.08 : 0), 0);
    if (far) num.style.stroke = { color: 0x000000, width: 0 };
    root.addChild(num);
    // ---- Banner, crown, building (Mid and closer) ----
    if (!far) {
      if (c.owned) {
        const flag = new Sprite(this.bank.house("banner-flag", house));
        flag.anchor.set(0.22, 0.95);
        flag.scale.set((pillH * 1.7) / flag.texture.height);
        flag.position.set(x0 - pillH * 0.35, pillH / 2);
        icons.addChild(flag);
      }
      if (c.crown) {
        const cr = new Sprite(this.bank.get("icon-crown")!);
        cr.anchor.set(0.5, 1);
        cr.scale.set((icon * 0.95) / cr.texture.height);
        cr.position.set(x0 + pillH * 0.35, -pillH / 2 + 3);
        icons.addChild(cr);
      }
      const b = s.building ?? s.construction;
      if (b) {
        const bi = new Sprite(this.bank.get(`icon-${b}`)!);
        bi.anchor.set(0, 0.5);
        bi.scale.set(icon / bi.texture.height);
        bi.position.set(-x0 + 2, 0);
        // Under construction: a ghostly outline of the icon.
        if (!s.building) bi.alpha = 0.45;
        icons.addChild(bi);
      }
    }
    root.addChild(icons);
    // ---- Specialists, culture dots and gold value (Near, or always in Tactical) ----
    if (mix.nearDetail > 0.5 && s.kind === "seen") {
      let y = pillH / 2 + 3;
      if (s.specialists.length) {
        const n = s.specialists.length, step = icon + 2;
        s.specialists.forEach((sp, i) => {
          const si = new Sprite(this.bank.get(`icon-${sp}`)!);
          si.anchor.set(0.5, 0);
          si.scale.set(icon / si.texture.height);
          si.position.set((i - (n - 1) / 2) * step, y);
          near.addChild(si);
        });
        y += icon + 3;
      }
      if (s.culture) {
        const dots = new Graphics();
        for (let i = 0; i < s.culture; i++) dots.circle((i - (s.culture - 1) / 2) * 7, y + 2.5, 2.4).fill(GOLD_HI).stroke({ width: 1, color: 0x1b1206 });
        near.addChild(dots);
      }
    }
    root.addChild(near);
    // ---- Name (Near) and capital plaque ----
    if (mix.names > 0.5 && c.name && !(c.capital && !far)) {
      const nm = new Text({ text: c.name, style: nameStyle(font * 0.82), resolution: this.resolution });
      nm.anchor.set(0.5, 1);
      nm.position.set(0, -pillH / 2 - (c.crown && !far ? icon * 0.6 : 1));
      names.addChild(nm);
    }
    root.addChild(names);
    if (c.capital && !far) {
      const bottom = pillH / 2 + (mix.nearDetail > 0.5 ? (s.specialists.length ? icon + 3 : 0) + (s.culture ? 7 : 0) : 0) + 3;
      const l1 = new Text({ text: c.name, style: { ...nameStyle(font * 0.8), stroke: { color: 0, width: 0 } }, resolution: this.resolution });
      const l2 = new Text({ text: "Capital", style: { fontFamily: "Cinzel, serif", fontWeight: "700", fontSize: font * 0.62, fill: GOLD_HI }, resolution: this.resolution });
      const w = Math.max(l1.width, l2.width) + 12, h = l1.height + l2.height + 4;
      const plaque = new Graphics().roundRect(-w / 2, bottom, w, h, 4).fill({ color: NAVY, alpha: 0.86 }).stroke({ width: 1, color: GOLD });
      l1.anchor.set(0.5, 0);
      l2.anchor.set(0.5, 0);
      l1.position.set(0, bottom + 2);
      l2.position.set(0, bottom + 2 + l1.height);
      icons.addChild(plaque, l1, l2);
    }
    // ---- "+N" when other markers were folded into this one ----
    const chip = new Graphics().circle(0, 0, 8).fill(GOLD_HI).stroke({ width: 1.2, color: 0x1b1206 });
    const mergedText = new Text({ text: "", style: { fontFamily: "Manrope, sans-serif", fontWeight: "800", fontSize: 10, fill: 0x1b1206 }, resolution: this.resolution });
    mergedText.anchor.set(0.5);
    merged.addChild(chip, mergedText);
    merged.position.set(-x0, -pillH / 2);
    merged.visible = false;
    root.addChild(merged);
    if (remembered) root.alpha = 0.62;
    return { root, icons, near, names, merged, mergedText };
  }

  /** Order numbers on the arrows, and the odds badge on the drafted attack's target. */
  private buildBadges(scene: MapScene) {
    for (const c of this.badges.removeChildren()) c.destroy({ children: true });
    for (const a of scene.arrows) {
      if (a.draft) continue;
      const b = new Container();
      b.label = `arrow:${a.key}`;
      b.addChild(new Graphics().circle(0, 0, 9).fill(NAVY).stroke({ width: 1.5, color: GOLD }));
      const t = new Text({ text: String(a.n), style: { fontFamily: "Manrope, sans-serif", fontWeight: "800", fontSize: 11, fill: GOLD_HI }, resolution: this.resolution });
      t.anchor.set(0.5);
      b.addChild(t);
      this.badges.addChild(b);
    }
    if (scene.odds) {
      const b = new Container();
      b.label = `odds:${scene.odds.target}`;
      const pips = ODDS_PIPS[scene.odds.odds], col = ODDS_COLOR[scene.odds.odds];
      b.addChild(new Graphics().roundRect(-27, -9, 54, 18, 9).fill({ color: NAVY, alpha: 0.95 }).stroke({ width: 1.5, color: GOLD }));
      const g = new Graphics();
      for (let i = 0; i < 4; i++) {
        g.circle(-16.5 + i * 11, 0, 3.6);
        if (i < pips) g.fill(col);
        else g.stroke({ width: 1.2, color: 0x5d6673 });
      }
      b.addChild(g);
      if (scene.odds.odds === "unknown") {
        const q = new Text({ text: "?", style: { fontFamily: "Manrope, sans-serif", fontWeight: "800", fontSize: 13, fill: PARCH }, resolution: this.resolution });
        q.anchor.set(0.5);
        b.addChild(q);
      }
      this.badges.addChild(b);
    }
  }

  /** Where markers sit after the last layout, relative to the camera origin (so panning doesn't change them). */
  screenBoxes: { x: number; y: number; w: number; h: number; dy: number }[] = [];

  /** Re-run collisions (after zooming or a rebuild). */
  layout(cam: Camera, z: ZoomDetail) {
    const k = pillHeight(z) / REF;
    const boxes = [...this.markers.values()].map((m) => {
      const [x, y] = toScreen(cam, m.anchor[0], m.anchor[1]);
      return { id: m.id, x, y, w: m.metrics.w * k, h: m.metrics.h * k, dy: m.metrics.dy * k, priority: m.priority };
    });
    const placed = layoutMarkers(boxes);
    this.screenBoxes = [];
    for (const b of boxes) {
      const m = this.markers.get(b.id)!;
      const p = placed.get(b.id)!;
      m.offset = [p.x - b.x, p.y - b.y];
      m.hidden = p.mergedInto !== null;
      m.root.visible = !m.hidden;
      m.root.scale.set(k);
      m.merged.visible = p.merged.length > 0;
      if (p.merged.length) m.mergedText.text = `+${p.merged.length}`;
      if (!m.hidden) this.screenBoxes.push({ x: p.x - cam.x, y: p.y - cam.y, w: b.w, h: b.h, dy: b.dy });
    }
    this.place(cam, z);
  }

  /** Move markers with the camera (no re-layout; for panning). */
  place(cam: Camera, z: ZoomDetail) {
    this.leaders.clear();
    const k = pillHeight(z) / REF;
    for (const m of this.markers.values()) {
      const [x, y] = toScreen(cam, m.anchor[0], m.anchor[1]);
      m.root.position.set(Math.round(x + m.offset[0]), Math.round(y + m.offset[1]));
      // A thin line back to the territory when a marker had to move aside.
      if (!m.hidden && Math.hypot(m.offset[0], m.offset[1]) > 10 * k) {
        this.leaders.moveTo(x, y).lineTo(x + m.offset[0], y + m.offset[1]).stroke({ width: 1.2, color: 0xf3ead2, alpha: 0.7 });
        this.leaders.circle(x, y, 2.2).fill({ color: 0xf3ead2, alpha: 0.9 });
      }
    }
    if (!this.scene) return;
    for (const b of this.badges.children) {
      const [kind, id] = b.label.split(":") as [string, string];
      if (kind === "arrow") {
        const a = this.scene.arrows.find((x) => x.key === id);
        if (!a) continue;
        const p0 = this.labelOf.get(a.via ?? a.from)!, p1 = this.labelOf.get(a.to)!;
        const [x, y] = toScreen(cam, a.via ? p0.x : (this.labelOf.get(a.from)!.x + p1.x) / 2, a.via ? p0.y : (this.labelOf.get(a.from)!.y + p1.y) / 2);
        b.position.set(x, y);
      } else {
        const m = this.markers.get(id);
        const p = this.labelOf.get(id)!;
        const [x, y] = toScreen(cam, p.x, p.y);
        const off = m ? m.offset : [0, 0];
        b.position.set(x + off[0]!, y + off[1]! - (m ? (m.metrics.h / 2 - m.metrics.dy) * k + 12 : 18));
      }
    }
  }

  setAlphas(mix: DetailMix, tactical: boolean) {
    for (const m of this.markers.values()) {
      m.icons.alpha = tactical ? 1 : Math.min(1, mix.icons * 1.6);
      m.near.alpha = tactical ? 1 : Math.min(1, mix.nearDetail * 1.6);
      m.names.alpha = Math.min(1, mix.names * 1.6);
    }
  }

  get count() {
    return this.markers.size;
  }

  /** For tests in the browser and the perf script: where markers ended up on screen. */
  boxes() {
    return [...this.markers.values()].filter((m) => !m.hidden).map((m) => ({ id: m.id, ...m.root.getBounds().rectangle }));
  }

  destroy() {
    this.root.destroy({ children: true });
  }
}
