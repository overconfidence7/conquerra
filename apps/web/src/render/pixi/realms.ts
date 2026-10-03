import type { Line } from "@conquerra/content";
import { Container, Graphics } from "pixi.js";
import { hexNum, type House } from "../../map/houses";
import { dashes } from "../../map/shapes";

/**
 * House borders (docs/06-art-direction.md, "Borders and ownership"):
 *  - each House's coloured band sits inside its own land (masked by its own fill), so where two Houses meet you
 *    see both colours side by side with a thin ink line between, and nothing spills onto water;
 *  - instead of a flat tint, a wash of the House colour fades inward from the border (about 15 map units);
 *  - selection is a pulsing gold double rule just outside the band;
 *  - remembered land (in the fog) gets a faint dashed line in the last-seen owner's colour.
 * Built only from territory outlines, so it works unchanged on any map.
 */

const INK = 0x1b1206, GOLD = 0xe3c77e, GOLD_LIGHT = 0xfff1c1;
/** The wash: strokes centred on the border, masked to the inside, so the inner half fades in steps. */
const WASH: readonly [width: number, alpha: number][] = [30, 26, 22, 18, 14, 10, 6, 3].map((w) => [w, 0.055] as [number, number]);

type Rings = readonly Line[];
const ring = (g: Graphics, r: Line, close = true) => g.poly(r as number[], close);

export interface RealmInput {
  house: House;
  /** The realm's outline (borders with land of other owners, water, mountains). */
  outlines: Line[];
  /** Every territory the House holds (for the mask). */
  territories: Rings[];
}

interface Realm extends RealmInput {
  root: Container;
  wash: Graphics;
  band: Graphics;
  mask: Graphics;
}

export class RealmLayer {
  readonly root = new Container();
  private realms: Realm[] = [];
  private ink = new Graphics();
  private remembered = new Graphics();
  private rememberedInput: { house: House; rings: Rings }[] = [];
  private selection = new Container();
  private selRule = new Graphics();
  private selMask = new Graphics();
  private selected: Rings | null = null;

  constructor() {
    this.selection.addChild(this.selRule, this.selMask);
    this.selection.setMask({ mask: this.selMask, inverse: true });
    this.root.addChild(this.ink, this.remembered, this.selection);
  }

  setRealms(input: RealmInput[]) {
    for (const r of this.realms) r.root.destroy({ children: true });
    this.realms = input.map((r) => {
      const root = new Container();
      const wash = new Graphics(), band = new Graphics(), mask = new Graphics();
      for (const t of r.territories) {
        ring(mask, t[0]!).fill(0xffffff);
        for (const hole of t.slice(1)) ring(mask, hole).cut();
      }
      root.addChild(wash, band, mask);
      root.mask = mask;
      // The wash is in map units, so it's drawn once.
      const glow = hexNum(r.house.glow);
      for (const [w, a] of WASH) for (const l of r.outlines) ring(wash, l, false).stroke({ width: w, color: glow, alpha: a, join: "round", cap: "round" });
      return { ...r, root, wash, band, mask };
    });
    this.realms.forEach((r, i) => this.root.addChildAt(r.root, i));
  }

  setRemembered(list: { house: House; rings: Rings }[]) {
    this.rememberedInput = list;
  }

  setSelected(rings: Rings | null) {
    this.selected = rings;
  }

  /** Redraw the parts measured in screen pixels. `px` = one screen pixel in map units. */
  draw(px: number) {
    for (const r of this.realms) {
      const col = hexNum(r.house.color), glow = hexNum(r.house.glow);
      const b = r.band;
      b.clear();
      for (const l of r.outlines) {
        // Centred strokes; the mask keeps the inner half. So: a soft glow 7px in, a solid band 4px in.
        ring(b, l, false).stroke({ width: 14 * px, color: glow, alpha: 0.3, join: "round", cap: "round" });
        ring(b, l, false).stroke({ width: 8 * px, color: col, alpha: 0.95, join: "round", cap: "round" });
        ring(b, l, false).stroke({ width: 3 * px, color: glow, alpha: 0.85, join: "round", cap: "round" });
      }
    }
    // A thin ink line on every realm edge: between two Houses it separates the colours.
    const k = this.ink;
    k.clear();
    for (const r of this.realms) for (const l of r.outlines) ring(k, l, false).stroke({ width: 1.3 * px, color: INK, alpha: 0.8, join: "round", cap: "round" });

    const m = this.remembered;
    m.clear();
    for (const { house, rings } of this.rememberedInput)
      for (const r of rings)
        for (const d of dashes(r as number[], 7 * px, 5 * px, true)) m.poly(d, false).stroke({ width: 1.8 * px, color: hexNum(house.glow), alpha: 0.75, cap: "round" });

    const s = this.selRule, sm = this.selMask;
    s.clear();
    sm.clear();
    if (this.selected) {
      for (const r of this.selected) {
        ring(sm, r).fill(0xffffff);
        // Centred strokes with the inside masked away: gold 0-2px out, a dark gap, gold again 4-6px out.
        ring(s, r).stroke({ width: 12 * px, color: GOLD, alpha: 1, join: "round" });
        ring(s, r).stroke({ width: 8 * px, color: INK, alpha: 0.85, join: "round" });
        ring(s, r).stroke({ width: 4 * px, color: GOLD_LIGHT, alpha: 1, join: "round" });
      }
    }
  }

  /** The selection pulses gently. */
  tick(seconds: number) {
    this.selection.alpha = 0.72 + 0.28 * Math.sin(seconds * 3.4);
  }

  set visible(v: boolean) {
    this.root.visible = v;
  }

  destroy() {
    this.root.destroy({ children: true });
  }
}
