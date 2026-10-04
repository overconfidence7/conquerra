import type { MapDef } from "@conquerra/content";
import type { PlayerView } from "@conquerra/engine";
import { Container, Graphics, Text } from "pixi.js";
import { toScreen, type Camera } from "../../map/camera";
import { hexNum, houseOf } from "../../map/houses";
import { quadPoint } from "../../map/shapes";
import { replaySpots } from "../../replay/camera";
import { MARCH_SHARE, RESULT_AT, type ReplayFrame } from "../../replay/timeline";

/**
 * Draws one moment of the animated replay, in screen space over the map: armies marching along their arrows,
 * clashes with their result, recruits and buildings popping in, and soft pulses for fogged events. It only
 * animates what it's given (replay/timeline.ts decides what happens when).
 */

const GOLD = 0xc9a45c, PARCH = 0xede6d6, INK = 0x1b1206;

export class ReplayLayer {
  readonly root = new Container();
  private g = new Graphics();
  private texts: Text[] = [];
  private labelOf: ReadonlyMap<string, { x: number; y: number }>;
  /** Province centres, shared with the replay camera so it aims exactly at each pulse. */
  private provinceAt: ReadonlyMap<string, { x: number; y: number }>;

  constructor(map: MapDef) {
    const spots = replaySpots(map);
    this.labelOf = spots.territory;
    this.provinceAt = spots.province;
    this.root.addChild(this.g);
  }

  private text(i: number, value: string, size: number, color: number): Text {
    let t = this.texts[i];
    if (!t) {
      t = new Text({ text: value, style: { fontFamily: "Manrope, sans-serif", fontWeight: "800", fontSize: size, fill: color, stroke: { color: INK, width: 3 } } });
      t.anchor.set(0.5);
      this.texts.push(t);
      this.root.addChild(t);
    }
    if (t.text !== value) t.text = value;
    t.style.fontSize = size;
    t.style.fill = color;
    t.visible = true;
    t.alpha = 1;
    t.scale.set(1);
    return t;
  }

  draw(frame: ReplayFrame | null, cam: Camera, view: PlayerView) {
    const g = this.g;
    g.clear();
    let ti = 0;
    for (const t of this.texts) t.visible = false;
    if (!frame) return;
    const scr = (id: string) => {
      const l = this.labelOf.get(id)!;
      return toScreen(cam, l.x, l.y);
    };

    for (const m of frame.marches) {
      const [x0, y0] = scr(m.from), [x1, y1] = scr(m.to);
      const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
      const bend = Math.min(len * 0.16, 40);
      const cx = (x0 + x1) / 2 + (-dy / len) * bend, cy = (y0 + y1) / 2 + (dx / len) * bend;
      const col = hexNum(houseOf(view, m.player).color);
      // The trail so far, then the army token.
      for (let k = 0; k < 14; k++) {
        const t = (k / 14) * m.progress;
        const [px, py] = quadPoint(x0, y0, cx, cy, x1, y1, t);
        g.circle(px, py, 2.2).fill({ color: col, alpha: 0.35 + 0.4 * (k / 14) });
      }
      const [x, y] = quadPoint(x0, y0, cx, cy, x1, y1, m.progress);
      g.circle(x, y, 15).fill({ color: col }).stroke({ width: 2.5, color: GOLD });
      g.circle(x, y, 18).stroke({ width: 1.2, color: INK, alpha: 0.6 });
      this.text(ti++, String(m.troops), 13, PARCH).position.set(x, y);
    }

    for (const c of frame.clashes) {
      const [x, y] = scr(c.at);
      const p = c.progress;
      const fighting = p < (RESULT_AT - MARCH_SHARE) / (1 - MARCH_SHARE);
      if (fighting) {
        // A burst of crossed sparks, shaking a little.
        const shake = Math.sin(p * 60) * 3;
        const r = 16 + 10 * Math.sin(p * Math.PI);
        g.circle(x + shake, y, r + 8).fill({ color: 0xffe9b0, alpha: 0.18 });
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2 + p * 6;
          g.moveTo(x + shake + Math.cos(a) * r * 0.4, y + Math.sin(a) * r * 0.4)
            .lineTo(x + shake + Math.cos(a) * (r + 8), y + Math.sin(a) * (r + 8))
            .stroke({ width: 3, color: k % 2 ? 0xffd27a : 0xffffff, alpha: 0.9, cap: "round" });
        }
        // Crossed swords.
        for (const s of [-1, 1])
          g.moveTo(x - 11 * s + shake, y - 11).lineTo(x + 11 * s + shake, y + 11).stroke({ width: 4, color: INK, cap: "round" }).moveTo(x - 11 * s + shake, y - 11).lineTo(x + 11 * s + shake, y + 11).stroke({ width: 2, color: PARCH, cap: "round" });
      } else {
        // The result: who holds the land now, and the losses on each side.
        const win = c.captured ? c.attacker : c.defender;
        const col = win ? hexNum(houseOf(view, win).color) : 0xd8cdb0;
        const fade = Math.min(1, (1 - p) * 4);
        g.roundRect(x - 52, y - 46, 104, 30, 8).fill({ color: 0x0f1620, alpha: 0.92 * fade }).stroke({ width: 1.5, color: GOLD, alpha: fade });
        g.rect(x - 52, y - 46, 6, 30).fill({ color: col, alpha: fade });
        const t = this.text(ti++, c.captured ? "Captured" : "Held", 13, c.captured ? 0xffd27a : PARCH);
        t.position.set(x + 2, y - 37);
        t.alpha = fade;
        const l = this.text(ti++, `−${c.attackerLosses}  ·  −${c.defenderLosses}`, 11, 0xc9c2b2);
        l.position.set(x + 2, y - 23);
        l.alpha = fade;
      }
    }

    for (const p of frame.pops) {
      const [x, y] = scr(p.at);
      const col = hexNum(houseOf(view, p.player).color);
      const ring = 10 + 26 * p.progress;
      g.circle(x, y, ring).stroke({ width: 3, color: col, alpha: 1 - p.progress });
      const t = this.text(ti++, p.label, 14, 0xffe9b0);
      t.position.set(x, y - 20 - 18 * p.progress);
      t.alpha = Math.min(1, (1 - p.progress) * 2.5);
    }

    for (const p of frame.pulses) {
      const at = this.provinceAt.get(p.province);
      if (!at) continue;
      const [x, y] = toScreen(cam, at.x, at.y);
      // Two soft rings: something happened somewhere around here. No names, no numbers.
      for (const k of [0, 0.35]) {
        const q = (p.progress + k) % 1;
        g.circle(x, y, 20 + 70 * q).stroke({ width: 4, color: 0xf3ead2, alpha: 0.55 * (1 - q) });
      }
      g.circle(x, y, 8).fill({ color: p.what === "battle" ? 0xc2553f : 0xe3c77e, alpha: 0.8 * (1 - p.progress * 0.5) });
    }
  }

  destroy() {
    this.root.destroy({ children: true });
  }
}
