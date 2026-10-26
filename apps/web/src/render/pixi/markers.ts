import type { MapDef } from "@conquerra/content";
import type { PlayerView } from "@conquerra/engine";
import { Container, Graphics, NineSliceSprite, Sprite, Text, type TextStyleOptions } from "pixi.js";
import { toScreen, type Camera } from "../../map/camera";
import { labelCurve, quadPoint } from "../../map/shapes";
import { hexNum, houseOf } from "../../map/houses";
import { CULTURE_PIP_DROP, layoutMarkers, markerMetrics, type MarkerBox, pillHeight, type MarkerContent, type MarkerMetrics } from "../../map/layout";
import { isUnknown, markerContent, provinceSize, markerPriority, territoryStatus, type TerritoryStatus } from "../../map/status";
import type { DetailMix, ZoomDetail } from "../../map/zoom";
import { farPills } from "../../map/farPills";
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

/**
 * Culture pips: one small laurel sprig per level, in a row on a dark tab centred on the pill's lower edge (y), so
 * they read on any ground. Each sprig is two gilded leaves in a V.
 */
function laurels(level: number, y: number): Graphics {
  const g = new Graphics();
  const step = 11, w = level * step + 6, h = 13;
  g.roundRect(-w / 2, y - 2, w, h, 4).fill({ color: NAVY, alpha: 0.92 }).stroke({ width: 1, color: GOLD, alpha: 0.9 });
  const leaf = (cx: number, cy: number, angle: number) => {
    // A lens-shaped leaf 8 long, pointing along `angle` from (cx, cy).
    const pts: [number, number][] = [];
    for (let i = 0; i <= 8; i++) pts.push([(i / 8) * 8, Math.sin((i / 8) * Math.PI) * 2.2]);
    for (let i = 7; i >= 1; i--) pts.push([pts[i]![0], -pts[i]![1]]);
    const c = Math.cos(angle), sn = Math.sin(angle);
    g.poly(pts.flatMap(([a, b]) => [cx + a * c - b * sn, cy + a * sn + b * c])).fill(GOLD_HI);
  };
  for (let i = 0; i < level; i++) {
    const cx = (i - (level - 1) / 2) * step, cy = y + 8.5;
    leaf(cx, cy, -Math.PI / 2 - 0.5);
    leaf(cx, cy, -Math.PI / 2 + 0.5);
  }
  return g;
}

/** A province plaque: the bonus, and how much of the province you hold ("+3 · you hold 3 of 5"), under its name. */
/** A small hourglass badge: a navy disc with gold sand glass. */
function hourglass(x: number, y: number, size: number): Graphics {
  const g = new Graphics();
  const r = size / 2, w = r * 0.55, h = r * 0.62;
  g.circle(x, y, r).fill({ color: NAVY, alpha: 0.95 }).stroke({ width: 1, color: GOLD });
  g.poly([x - w, y - h, x + w, y - h, x, y, x + w, y + h, x - w, y + h, x, y]).fill(GOLD_HI);
  g.moveTo(x - w * 1.2, y - h).lineTo(x + w * 1.2, y - h).moveTo(x - w * 1.2, y + h).lineTo(x + w * 1.2, y + h).stroke({ width: 1, color: PARCH });
  return g;
}

interface PlaqueView {
  id: string;
  root: Container;
  anchor: [number, number];
  w: number;
  h: number;
  offset: [number, number];
  hidden: boolean;
  /**
   * Its name at Far (session 17): small letters with a dark rim, no plaque, on the province itself. Only names that fit
   * without overlapping show (bigger provinces first); the tapped province shows its full plaque instead.
   */
  name: { root: Container; anchor: [number, number]; w: number; h: number; rank: number; shown: boolean };
}

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
  private plaques = new Map<string, PlaqueView>();
  private plaqueLayer = new Container();
  private nameLayer = new Container();
  private scene: MapScene | null = null;
  private key = "";
  /**
   * What each marker was built from (session 21): the replay changes the scene with every event, and rebuilding all
   * 200 markers (each with its own text textures) each time stalled it; now only markers whose content changed are.
   */
  private built = new Map<string, string>();
  private plaqueKey: string | null = null;
  private resolution: number;
  private labelOf: Map<string, { x: number; y: number }>;

  constructor(
    private map: MapDef,
    private bank: TextureBank,
    resolution: number,
  ) {
    this.resolution = Math.max(2, resolution);
    this.labelOf = new Map(map.geometry!.territories.map((t) => [t.id, t.label]));
    this.root.addChild(this.nameLayer, this.plaqueLayer, this.leaders, this.layer, this.badges);
  }

  /** Rebuild when the scene changes, or the zoom crosses a level that changes what markers hold. */
  update(scene: MapScene, mix: DetailMix, tactical: boolean, force = false) {
    const key = `${mix.icons > 0.5}|${mix.nearDetail > 0.5}|${mix.names > 0.5}|${tactical}`;
    if (!force && scene === this.scene && key === this.key) return false;
    const all = force || key !== this.key;
    this.scene = scene;
    this.key = key;
    if (all) {
      for (const m of this.markers.values()) m.root.destroy({ children: true });
      this.markers.clear();
      this.built.clear();
      this.plaqueKey = null;
    }
    const refZoom = { territoryPx: (REF - 15) / 0.05 };
    // Session 35: at Far on a big map (over 200 territories), only capitals, your Leader and the borders keep a pill.
    const keep = mix.icons <= 0.5 && !tactical ? farPills(this.map, scene.view) : null;
    for (const t of this.map.territories) {
      const s = territoryStatus(scene.view, t.id);
      const content = keep && !keep.has(t.id) ? null : markerContent(this.map, scene.view, s);
      const was = this.markers.get(t.id);
      const builtFrom = content ? JSON.stringify([content, s, houseOf(scene.view, s.owner).name]) : "";
      if (was && this.built.get(t.id) === builtFrom) {
        was.priority = markerPriority(scene.view, s);
        continue;
      }
      if (was) {
        was.root.destroy({ children: true });
        this.markers.delete(t.id);
        this.built.delete(t.id);
      }
      if (!content) continue;
      this.built.set(t.id, builtFrom);
      const metrics = markerMetrics(content, refZoom, mix);
      const m = this.build(scene.view, s, content, metrics, mix);
      const lbl = this.labelOf.get(t.id)!;
      const mv: MarkerView = { ...m, id: t.id, metrics, anchor: [lbl.x, lbl.y], priority: markerPriority(scene.view, s), offset: [0, 0], hidden: false };
      this.markers.set(t.id, mv);
      this.layer.addChild(mv.root);
    }
    this.buildBadges(scene);
    this.buildPlaques(scene);
    return true;
  }

  /** One plaque per province, under its painted name: "Pinemark +3 · you hold 3 of 5", or "Pinemark +3" if you hold none of it. */
  private buildPlaques(scene: MapScene) {
    // Only when how much of a province you hold changes.
    const view0 = scene.view;
    const plaqueKey = this.map.territories.map((t) => (isUnknown(view0, t.id) ? 2 : view0.territories[t.id]?.detail === "full" && (view0.territories[t.id] as { owner?: string | null }).owner === view0.me.id ? 1 : 0)).join("");
    if (plaqueKey === this.plaqueKey) return;
    this.plaqueKey = plaqueKey;
    for (const pl of this.plaques.values()) (pl.root.destroy({ children: true }), pl.name.root.destroy({ children: true }));
    this.plaques.clear();
    const view = scene.view;
    for (const label of this.map.geometry!.provinceLabels) {
      const prov = this.map.provinces.find((p) => p.id === label.id);
      if (!prov) continue;
      const members = this.map.territories.filter((t) => t.province === prov.id);
      // (Session 30, blackout fog: a province you've seen none of has no name on the map.)
      if (members.every((t) => isUnknown(view, t.id))) continue;
      const held = members.filter((t) => {
        const v = view.territories[t.id];
        return v?.detail === "full" && v.owner === view.me.id;
      }).length;
      const root = new Container();
      const style = (fill: number): TextStyleOptions => ({ fontFamily: "Manrope, system-ui, sans-serif", fontWeight: "800", fontSize: 11, fill });
      const parts = [
        new Text({ text: `${prov.name} `, style: { fontFamily: "Cinzel, serif", fontWeight: "700", fontSize: 11, fill: PARCH }, resolution: this.resolution }),
        new Text({ text: `+${prov.bonus}`, style: style(GOLD_HI), resolution: this.resolution }),
        ...(held ? [new Text({ text: ` · you hold ${held} of ${provinceSize(this.map, view, prov.id) ?? "?"}`, style: style(PARCH), resolution: this.resolution })] : []),
      ];
      const textW = parts.reduce((a, t) => a + t.width, 0);
      const all = held === members.length;
      const frame = this.bank.get("frame-plaque");
      let w = textW + 14, h = 18;
      if (frame) {
        // Nate's nameplate, stretched in the middle so its scrolled end caps keep their shape.
        h = 24;
        const k = h / frame.height, cap = frame.width * 0.14;
        w = textW + 2 * cap * k + 6;
        const ns = new NineSliceSprite({ texture: frame, leftWidth: cap, rightWidth: cap, topHeight: frame.height * 0.3, bottomHeight: frame.height * 0.3 });
        ns.scale.set(k);
        ns.width = w / k;
        ns.height = frame.height;
        ns.position.set(-w / 2, -h / 2);
        // Held in full: a gold glow round it, as the drawn plaque's brighter rim does.
        if (all) root.addChild(new Graphics().roundRect(-w / 2 - 1, -h / 2 + 2, w + 2, h - 4, (h - 4) / 2).stroke({ width: 3, color: GOLD_HI, alpha: 0.7 }));
        root.addChild(ns);
      } else root.addChild(new Graphics().roundRect(-w / 2, -h / 2, w, h, h / 2).fill({ color: NAVY, alpha: 0.88 }).stroke({ width: 1.2, color: all ? GOLD_HI : GOLD }));
      let x = -textW / 2;
      for (const t of parts) {
        t.anchor.set(0, 0.5);
        t.position.set(x, 0);
        x += t.width;
        root.addChild(t);
      }
      // Just under the painted name: the middle of its curve, one letter-height down (labels.ts sizes the letters).
      const [x0, y0, cx, cy, x1, y1] = labelCurve(label.path);
      let [mx, my] = quadPoint(x0, y0, cx, cy, x1, y1, 0.5);
      // (Session 33, blackout fog: a plaque whose spot is over land you haven't seen moves onto the land you have, the
      // middle of its known territories, so it never marks where the cloud's land lies.)
      const at = new Map(this.map.geometry!.territories.map((t) => [t.id, t.label]));
      const nearest = members.reduce((best, t) => (Math.hypot(at.get(t.id)!.x - mx, at.get(t.id)!.y - my) < Math.hypot(at.get(best.id)!.x - mx, at.get(best.id)!.y - my) ? t : best));
      if (isUnknown(view, nearest.id)) {
        const known = members.filter((t) => !isUnknown(view, t.id)).map((t) => at.get(t.id)!);
        [mx, my] = [known.reduce((a, p) => a + p.x, 0) / known.length, known.reduce((a, p) => a + p.y, 0) / known.length];
      }
      const size = Math.max(13, Math.min(30, (Math.hypot(x1 - x0, y1 - y0) / Math.max(6, prov.name.length)) * 1.05));
      // The name at Far: smaller, no plaque (it would cover the land), on the middle of the province's name line.
      const name = new Container();
      const rim = { color: 0x0b0f16, width: 3, join: "round" as const };
      const nameParts = [
        new Text({ text: `${prov.name} `, style: { fontFamily: "Cinzel, serif", fontWeight: "700", fontSize: 10, fill: PARCH, stroke: rim }, resolution: this.resolution }),
        new Text({ text: `+${prov.bonus}`, style: { fontFamily: "Manrope, system-ui, sans-serif", fontWeight: "800", fontSize: 10, fill: GOLD_HI, stroke: rim }, resolution: this.resolution }),
      ];
      const nameW = nameParts.reduce((a, t) => a + t.width, 0);
      let nx = -nameW / 2;
      for (const t of nameParts) {
        t.anchor.set(0, 0.5);
        t.position.set(nx, 0);
        nx += t.width;
        name.addChild(t);
      }
      name.visible = false;
      this.nameLayer.addChild(name);
      this.plaques.set(prov.id, {
        id: `plaque:${prov.id}`, root, anchor: [mx, my + size * 0.95], w, h, offset: [0, 0], hidden: false,
        // A little room round each name (the box is bigger than the letters), so names never sit shoulder to shoulder.
        name: { root: name, anchor: [mx, my], w: nameW + 18, h: 20, rank: members.length, shown: false },
      });
      this.plaqueLayer.addChild(root);
    }
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
      // A captured general here: its Leader's portrait on a gold ring, above the pill's right end.
      s.generals.slice(0, 2).forEach((g, i) => {
        const seat = Math.max(0, view.players.findIndex((p) => p.id === g));
        const tex = this.bank.get(`leader-${String((seat % 10) + 1).padStart(2, "0")}`);
        const r = pillH * 0.62;
        const cx = -x0 - r * 0.4 - i * r * 1.5, cy = -pillH / 2 - r * 0.75;
        const ring = new Graphics().circle(cx, cy, r + 1.5).fill({ color: 0x0b0f16 }).stroke({ width: 1.6, color: GOLD_HI });
        icons.addChild(ring);
        if (tex) {
          const face = new Sprite(tex);
          face.anchor.set(0.5);
          face.scale.set((2 * r) / Math.min(tex.width, tex.height));
          face.position.set(cx, cy);
          const mask = new Graphics().circle(cx, cy, r).fill({ color: 0xffffff });
          face.mask = mask;
          icons.addChild(mask, face);
        }
      });
      const b = s.building ?? s.construction;
      if (b) {
        const bi = new Sprite(this.bank.get(`icon-${b}`)!);
        bi.anchor.set(0, 0.5);
        bi.scale.set(icon / bi.texture.height);
        bi.position.set(-x0 + 2, 0);
        icons.addChild(bi);
        // Under construction: the icon stays solid, with a small hourglass ("ready next turn").
        if (!s.building) icons.addChild(hourglass(-x0 + 2 + icon * 0.95, -icon * 0.32, icon * 0.5));
      }
    }
    // ---- Culture: small gold laurels on a dark tab along the pill's lower edge (Mid and Near) ----
    if (!far && s.culture > 0 && s.kind === "seen") icons.addChild(laurels(s.culture, pillH / 2));
    root.addChild(icons);
    // ---- Specialists, culture dots and gold value (Near, or always in Tactical) ----
    if (mix.nearDetail > 0.5 && s.kind === "seen") {
      let y = pillH / 2 + 3 + (s.culture ? CULTURE_PIP_DROP : 0);
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
      const bottom = pillH / 2 + (s.culture ? CULTURE_PIP_DROP : 0) + (mix.nearDetail > 0.5 && s.specialists.length ? icon + 3 : 0) + 3;
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

  /**
   * Order numbers on the arrows (a chain's arrows show their hop numbers on gold), the faint "arriving" marker where
   * an attack should land an army, and the odds badge on the drafted attack's target ("≈" when it's an estimate).
   */
  private buildBadges(scene: MapScene) {
    for (const c of this.badges.removeChildren()) c.destroy({ children: true });
    const text = (s: string, size: number, fill: number) => {
      const t = new Text({ text: s, style: { fontFamily: "Manrope, sans-serif", fontWeight: "800", fontSize: size, fill }, resolution: this.resolution });
      t.anchor.set(0.5);
      return t;
    };
    for (const r of scene.arriving) {
      const b = new Container();
      b.label = `arrive:${r.territory}`;
      const label = text(`≈${r.troops}`, 12, NAVY);
      const w = Math.max(30, label.width + 14);
      b.addChild(new Graphics().roundRect(-w / 2, -9, w, 18, 9).fill({ color: GOLD_HI, alpha: 0.55 }).stroke({ width: 1.5, color: PARCH, alpha: 0.8 }), label);
      b.alpha = 0.9;
      this.badges.addChild(b);
    }
    for (const a of scene.arrows) {
      if (a.draft) continue;
      const b = new Container();
      b.label = `arrow:${a.key}`;
      if (a.hop !== null) b.addChild(new Graphics().circle(0, 0, 9.5).fill(GOLD_HI).stroke({ width: 1.5, color: NAVY }), text(String(a.hop), 11, NAVY));
      else b.addChild(new Graphics().circle(0, 0, 9).fill(NAVY).stroke({ width: 1.5, color: GOLD }), text(String(a.n), 11, GOLD_HI));
      this.badges.addChild(b);
    }
    if (scene.odds) {
      const b = new Container();
      b.label = `odds:${scene.odds.target}`;
      const pips = ODDS_PIPS[scene.odds.odds], col = ODDS_COLOR[scene.odds.odds];
      const est = scene.odds.estimate;
      const x0 = est ? -37 : -27;
      b.addChild(new Graphics().roundRect(x0, -9, -x0 * 2, 18, 9).fill({ color: NAVY, alpha: 0.95 }).stroke({ width: 1.5, color: GOLD }));
      const g = new Graphics();
      for (let i = 0; i < 4; i++) {
        g.circle((est ? -8 : -16.5) + i * 11, 0, 3.6);
        if (i < pips) g.fill(col);
        else g.stroke({ width: 1.2, color: 0x5d6673 });
      }
      b.addChild(g);
      // An estimate: the army depends on how an earlier battle goes.
      if (est) b.addChild(text("≈", 14, PARCH)).position.set(-26, -1);
      if (scene.odds.odds === "unknown") {
        const q = new Text({ text: "?", style: { fontFamily: "Manrope, sans-serif", fontWeight: "800", fontSize: 13, fill: PARCH }, resolution: this.resolution });
        q.anchor.set(0.5);
        b.addChild(q);
      }
      this.badges.addChild(b);
    }
  }

  /** Re-run collisions (after zooming or a rebuild). */
  layout(cam: Camera, z: ZoomDetail) {
    const k = pillHeight(z) / REF;
    const boxes: (MarkerBox & { dy: number })[] = [...this.markers.values()].map((m) => {
      const [x, y] = toScreen(cam, m.anchor[0], m.anchor[1]);
      return { id: m.id, x, y, w: m.metrics.w * k, h: m.metrics.h * k, dy: m.metrics.dy * k, priority: m.priority };
    });
    // Province plaques (session 16): only the province of the territory you tapped (provinces on demand), at every
    // zoom. At Far (session 17), every other province shows just its name, small and without a plaque, where it fits:
    // bigger provinces first, never moved off its province, never over an army or another name (a crowded map shows
    // fewer names rather than a pile of them). Both come after the armies and are dropped with no room.
    const lit = this.scene?.province ? `plaque:${this.scene.province}` : null;
    const names = z.far >= 0.05;
    for (const pl of this.plaques.values()) {
      if (pl.id === lit) {
        const [x, y] = toScreen(cam, pl.anchor[0], pl.anchor[1]);
        boxes.push({ id: pl.id, x, y, w: pl.w, h: pl.h, dy: 0, priority: -1, optional: true });
      } else if (names) {
        const [x, y] = toScreen(cam, pl.name.anchor[0], pl.name.anchor[1]);
        // A name that would hang off the screen's edge isn't shown (it would read as a cut-off word).
        const sw = this.screen.width, sh = this.screen.height;
        if (sw && (x - pl.name.w / 2 < 0 || x + pl.name.w / 2 > sw || y - pl.name.h / 2 < 0 || y + pl.name.h / 2 > sh)) continue;
        boxes.push({ id: `name:${pl.id}`, x, y, w: pl.name.w, h: pl.name.h, dy: 0, priority: -2 + pl.name.rank / 1000, optional: true, fixed: true });
      }
    }
    const placed = layoutMarkers(boxes);
    for (const pl of this.plaques.values()) {
      const at = pl.id === lit ? placed.get(pl.id) : undefined;
      const [x, y] = toScreen(cam, pl.anchor[0], pl.anchor[1]);
      pl.offset = at ? [at.x - x, at.y - y] : [0, 0];
      pl.hidden = !at || !!at.dropped;
      pl.root.visible = !pl.hidden;
      const nm = placed.get(`name:${pl.id}`);
      pl.name.shown = !!nm && !nm.dropped;
      pl.name.root.visible = pl.name.shown;
    }
    for (const b of boxes) {
      const m = this.markers.get(b.id);
      if (!m) continue;
      const p = placed.get(b.id)!;
      m.offset = [p.x - b.x, p.y - b.y];
      m.hidden = p.mergedInto !== null;
      m.root.visible = !m.hidden;
      m.root.scale.set(k);
      m.merged.visible = p.merged.length > 0;
      if (p.merged.length) m.mergedText.text = `+${p.merged.length}`;
    }
    this.place(cam, z);
  }

  /** The screen size (px), so plaques near the map's edge stay on screen (the renderer keeps it current). */
  screen = { width: 0, height: 0 };

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
    // A plaque by the map's edge slides in to stay whole on screen (a province on the far left of the map would
    // otherwise hang off the screen when the whole map is in view).
    const sw = this.screen.width, sh = this.screen.height;
    for (const pl of this.plaques.values()) {
      const [x, y] = toScreen(cam, pl.anchor[0], pl.anchor[1]);
      let px = x + pl.offset[0], py = y + pl.offset[1];
      if (sw > pl.w + 8) px = Math.max(pl.w / 2 + 4, Math.min(sw - pl.w / 2 - 4, px));
      if (sh > pl.h + 8) py = Math.max(pl.h / 2 + 4, Math.min(sh - pl.h / 2 - 4, py));
      pl.root.position.set(Math.round(px), Math.round(py));
      if (pl.name.shown) {
        const [nx, ny] = toScreen(cam, pl.name.anchor[0], pl.name.anchor[1]);
        pl.name.root.position.set(Math.round(nx), Math.round(ny));
      }
    }
    if (!this.scene) return;
    for (const b of this.badges.children) {
      const [kind, id] = b.label.split(":") as [string, string];
      if (kind === "arrow") {
        const a = this.scene.arrows.find((x) => x.key === id);
        if (!a) continue;
        const mid = a.via ?? a.through?.[Math.floor((a.through.length - 1) / 2)];
        const p0 = this.labelOf.get(mid ?? a.from)!, p1 = this.labelOf.get(a.to)!;
        const [x, y] = toScreen(cam, mid ? p0.x : (this.labelOf.get(a.from)!.x + p1.x) / 2, mid ? p0.y : (this.labelOf.get(a.from)!.y + p1.y) / 2);
        b.position.set(x, y);
      } else if (kind === "arrive") {
        const m = this.markers.get(id);
        const p = this.labelOf.get(id)!;
        const [x, y] = toScreen(cam, p.x, p.y);
        const off = m ? m.offset : [0, 0];
        // Just under the army marker that's there now.
        b.position.set(x + off[0]!, y + off[1]! + (m ? (m.metrics.h / 2 + m.metrics.dy) * k + 12 : 14));
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
    for (const pl of this.plaques.values()) pl.name.root.alpha = mix.provinceNames;
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
