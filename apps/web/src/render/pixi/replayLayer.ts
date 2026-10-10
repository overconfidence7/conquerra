import type { MapDef } from "@conquerra/content";
import type { PlayerView, ReplayEvent } from "@conquerra/engine";
import { Container, Graphics, Sprite, Text, type Texture } from "pixi.js";
import { toScreen, type Camera } from "../../map/camera";
import { hexNum, houseOf } from "../../map/houses";
import { dashes } from "../../map/shapes";
import { replaySpots } from "../../replay/camera";
import { fxAt, fxContext, lastLandOf, type FxContext } from "../../replay/fx/plan";
import { BUDGET, particlesAt, type FxLevel } from "../../replay/fx/particles";
import { replayInfo, type ReplayInfo } from "../../replay/info";
import { routePoint, type Pt } from "../../replay/route";
import type { ReplayFrame, Timeline } from "../../replay/timeline";
import type { TextureBank } from "./bank";
import type { FxLayer } from "./fxLayer";

/**
 * Draws one moment of the animated replay, in screen space over the map (session 21: the polish pass).
 *  - The info (always, whatever the Effects setting): each army's troop number, the crossed swords where a fight
 *    is, the result plaque and the losses on each side, what popped up, and the soft pulse for anything in the fog.
 *    It's drawn over the troop pills, as it always was, and it's the whole truth of the replay (replay/info.ts).
 *  - The show (Full and Light; nothing on Off): the House's soldiers marching with their banner, bobbing, the inked
 *    campaign line unrolling ahead of them, ships on sea lanes, the armies pressing at the border, the old banner
 *    toppling and the new one raised with a ripple of colour, the defender's shield, a knocked-out House's banner
 *    burning away, and the particles (dust, smoke, sparks, arrows, embers: fx/). It sits under the troop pills.
 * Everything is a formula of the replay's clock, seeded from the game, the turn and the event: pause, Skip and
 * "Watch again" look the same.
 */

const GOLD = 0xc9a45c, GOLD_HI = 0xe3c77e, PARCH = 0xede6d6, INK = 0x1b1206, NAVY = 0x0f1620;
/** A figure's height on screen at Mid zoom (px). */
const FIGURE_PX = 40;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const easeOut = (x: number) => 1 - (1 - x) ** 3;

/** A House-tinted figure (the art and its tint mask) or banner, reused frame to frame. */
interface Puppet {
  root: Container;
  base: Sprite;
  mask: Sprite;
}

export class ReplayLayer {
  /** Figures, banners and particles: under the troop pills. */
  readonly show = new Container();
  /** Numbers, plaques and pulses: over everything. */
  readonly root = new Container();
  private showG = new Graphics();
  private g = new Graphics();
  private texts: Text[] = [];
  private puppets: Puppet[] = [];
  private provinceAt: ReadonlyMap<string, { x: number; y: number }>;
  private rings: Map<string, readonly (readonly number[])[]>;
  private ctx: FxContext | null = null;
  private tl: Timeline | null = null;
  private level: FxLevel = "full";
  private budget: number;
  /** The camera shake for this frame (screen px), for the renderer. */
  shake: [number, number] = [0, 0];
  private fxLayer: FxLayer | null = null;

  constructor(
    private map: MapDef,
    private bank: TextureBank,
    phone: boolean,
  ) {
    this.provinceAt = replaySpots(map).province;
    this.rings = new Map(map.geometry!.territories.map((t) => [t.id, t.rings]));
    this.budget = phone ? BUDGET.phone : BUDGET.desktop;
    this.show.addChild(this.showG);
    this.root.addChild(this.g);
  }

  /** A new replay: what the effects need to know about it (the turn, who's who, the capitals and forts you know of). */
  start(tl: Timeline, events: readonly ReplayEvent[], before: PlayerView) {
    this.tl = tl;
    const capitals = new Set<string>([before.me.capital]);
    const forts = new Set<string>();
    for (const [id, t] of Object.entries(before.territories)) {
      if (t.detail !== "full") continue;
      if (t.capitalOf) capitals.add(id);
      if (t.building === "fort") forts.add(id);
    }
    for (const w of before.walls ?? []) for (const id of w.territories) forts.add(id);
    this.ctx = fxContext(this.map, before.gameId, before.turn, events, (p) => hexNum(houseOf(before, p).color), (id) => capitals.has(id), (id) => forts.has(id));
  }

  /** The particles, once their art has loaded: between the campaign lines and the figures. */
  set fx(layer: FxLayer | null) {
    this.fxLayer = layer;
    if (layer) this.show.addChildAt(layer.root, 1);
  }
  get fx() {
    return this.fxLayer;
  }

  setLevel(level: FxLevel) {
    this.level = level;
    this.show.visible = level !== "off";
  }

  private text(i: number, value: string, size: number, color: number): Text {
    let t = this.texts[i];
    if (!t) {
      t = new Text({ text: value, style: { fontFamily: "Manrope, sans-serif", fontWeight: "800", fontSize: size, fill: color, stroke: { color: INK, width: 3 } }, resolution: 2 });
      t.anchor.set(0.5);
      this.texts.push(t);
      this.root.addChild(t);
    }
    if (t.text !== value) t.text = value;
    if (t.style.fontSize !== size) t.style.fontSize = size;
    if (t.style.fill !== color) t.style.fill = color;
    t.visible = true;
    t.alpha = 1;
    t.scale.set(1);
    t.rotation = 0;
    return t;
  }

  private puppet(i: number, base: Texture | null, mask: Texture | null, tint: number): Puppet | null {
    if (!base) return null;
    let p = this.puppets[i];
    if (!p) {
      const root = new Container(), b = new Sprite(), m = new Sprite();
      b.anchor.set(0.5, 0.9);
      m.anchor.set(0.5, 0.9);
      root.addChild(b, m);
      this.show.addChild(root);
      p = this.puppets[i] = { root, base: b, mask: m };
    }
    p.base.texture = base;
    p.mask.visible = !!mask;
    if (mask) {
      p.mask.texture = mask;
      p.mask.tint = tint;
    }
    p.base.tint = 0xffffff;
    p.root.visible = true;
    p.root.alpha = 1;
    p.root.rotation = 0;
    p.root.scale.set(1);
    return p;
  }

  draw(frame: ReplayFrame | null, cam: Camera, view: PlayerView, territoryPx: number) {
    const g = this.g, s = this.showG;
    g.clear();
    s.clear();
    for (const t of this.texts) t.visible = false;
    for (const p of this.puppets) p.root.visible = false;
    this.shake = [0, 0];
    if (!frame || !this.ctx || !this.tl) {
      this.fx?.clear();
      return;
    }
    // Things are drawn bigger as you zoom in (and smaller zoomed out), within reason.
    const zk = Math.max(0.8, Math.min(1.9, territoryPx / 95));
    const scr = (p: Pt) => toScreen(cam, p.x, p.y);
    const colour = (player: string | null) => hexNum(houseOf(view, player).color);
    const show = this.level !== "off";
    let ti = 0, pi = 0;

    // ---- The particles ----
    if (show && this.fx) {
      const plan = fxAt(this.tl, frame.t, this.ctx);
      const { particles } = particlesAt(plan.instances, this.level, this.budget, cam.scale / zk);
      if (this.level === "full" && plan.shake > 0) this.shake = [Math.sin(frame.t * 0.09) * plan.shake * zk, Math.cos(frame.t * 0.071) * plan.shake * 0.6 * zk];
      this.fx.draw(particles, cam, zk);
    } else this.fx?.clear();

    const info: ReplayInfo[] = replayInfo(frame, this.ctx, (id) => this.provinceAt.get(id));
    for (const it of info) {
      if (it.kind === "army") {
        const [x, y] = scr(it);
        const col = colour(it.player);
        if (show) {
          // The inked campaign line: it unrolls ahead of the army, gold-trimmed, and fades behind it.
          const stopsPx = it.stops.map((p) => ({ x: scr(p)[0], y: scr(p)[1] }));
          const unrolled = Math.min(1, 0.25 + it.progress * 2.2);
          const line = (from: number, to: number) => {
            const pts: number[] = [];
            const steps = Math.max(4, Math.ceil((to - from) * 24));
            for (let k = 0; k <= steps; k++) {
              const [px, py] = routePoint(stopsPx, from + ((to - from) * k) / steps, 40);
              pts.push(px, py);
            }
            return pts;
          };
          if (unrolled > it.progress + 0.01) {
            const ahead = line(it.progress, unrolled);
            s.poly(ahead, false).stroke({ width: 5.5 * zk, color: GOLD, alpha: 0.75, cap: "round", join: "round" });
            s.poly(ahead, false).stroke({ width: 2.4 * zk, color: INK, alpha: 0.9, cap: "round", join: "round" });
            if (unrolled >= 1 && !it.retreat) {
              const [ex, ey, ea] = routePoint(stopsPx, 1, 40);
              const h = 9 * zk, w = 6 * zk;
              s.poly([ex, ey, ex - Math.cos(ea) * h - Math.sin(ea) * w, ey - Math.sin(ea) * h + Math.cos(ea) * w, ex - Math.cos(ea) * h + Math.sin(ea) * w, ey - Math.sin(ea) * h - Math.cos(ea) * w]).fill({ color: INK, alpha: 0.9 }).stroke({ width: 1.5 * zk, color: GOLD });
            }
          }
          if (it.progress > 0.02) s.poly(line(0, it.progress), false).stroke({ width: 2.2 * zk, color: INK, alpha: 0.28, cap: "round", join: "round" });
          // Right of passage: the way through a partner's land in white stitches.
          if (it.through) for (const d of dashes(line(0, 1), 6 * zk, 5 * zk)) s.poly(d, false).stroke({ width: 2.6 * zk, color: 0xffffff, alpha: 0.9, cap: "round" });
          // The soldiers (or a ship on a sea lane), bobbing as they walk; cavalry trots faster.
          const name = it.sea ? "ship" : it.cavalry ? "figure-cavalry" : "figure-army";
          const tex = this.bank.get(name);
          const p = this.puppet(pi++, tex, it.sea ? null : this.bank.mask(name), col);
          if (p && tex) {
            const steps = it.sea ? 3 : it.cavalry ? 11 : 7;
            const bob = it.sea ? Math.sin(it.progress * Math.PI * 2 * steps) * 1.6 : -Math.abs(Math.sin(it.progress * Math.PI * steps)) * 2.6;
            p.root.position.set(x, y + bob * zk);
            const k = ((it.sea ? 34 : FIGURE_PX) * zk) / tex.height;
            p.root.scale.set(Math.cos(it.heading) < 0 ? -k : k, k);
            if (it.sea) p.root.rotation = Math.sin(it.progress * Math.PI * 4) * 0.06;
            // Its banner, flying over the soldiers.
            const flag = this.puppet(pi++, this.bank.house("banner-flag", houseOf(view, it.player)), null, 0xffffff);
            if (flag) {
              const fk = (16 * zk) / flag.base.texture.height;
              flag.root.position.set(x - 8 * zk, y - (it.sea ? 30 : 26) * zk + bob * zk);
              flag.root.scale.set(fk);
              flag.root.rotation = Math.sin(it.progress * Math.PI * 6) * 0.08;
            }
          }
        }
        // The info: the House's mark and its troop number (on Off, this is all there is).
        g.circle(x, y, 5 * zk).fill({ color: col }).stroke({ width: 1.5, color: GOLD });
        const label = String(it.troops);
        const w = Math.max(22, 9 + label.length * 8) * zk, h = 17 * zk, px = x + 16 * zk, py = y - 14 * zk;
        g.roundRect(px - w / 2, py - h / 2, w, h, h / 2).fill({ color: NAVY, alpha: 0.92 }).stroke({ width: 1.6, color: col });
        this.text(ti++, label, 12 * Math.min(1.2, zk), PARCH).position.set(px, py);
      } else if (it.kind === "fight") {
        const [x, y] = scr(it);
        const [fx, fy] = scr(it.from), [tx, ty] = scr(it.target);
        if (show) {
          // The two armies pressing at the border.
          const dx = tx - fx, dy = ty - fy, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
          const jostle = Math.sin(it.progress * Math.PI * 9) * 2.2 * zk;
          for (const [side, player] of [[-1, it.attacker], [1, it.defender]] as const) {
            const tex = this.bank.get("figure-army");
            const p = this.puppet(pi++, tex, this.bank.mask("figure-army"), player ? colour(player) : 0xd8cdb0);
            if (!p || !tex) continue;
            const k = (FIGURE_PX * zk) / tex.height;
            p.root.position.set(x + side * ux * (11 * zk + jostle * -side), y + side * uy * 11 * zk + 8 * zk);
            p.root.scale.set(side * (ux >= 0 ? 1 : -1) < 0 ? k : -k, k);
          }
        }
        // The info: crossed swords where the fight is.
        const r = 11 * zk;
        g.circle(x, y - 36 * zk, r + 4 * zk).fill({ color: NAVY, alpha: 0.75 }).stroke({ width: 1.5, color: GOLD });
        for (const sgn of [-1, 1])
          g.moveTo(x - r * 0.7 * sgn, y - 36 * zk - r * 0.7).lineTo(x + r * 0.7 * sgn, y - 36 * zk + r * 0.7).stroke({ width: 3.2 * zk, color: INK, cap: "round" }).moveTo(x - r * 0.7 * sgn, y - 36 * zk - r * 0.7).lineTo(x + r * 0.7 * sgn, y - 36 * zk + r * 0.7).stroke({ width: 1.8 * zk, color: PARCH, cap: "round" });
      } else if (it.kind === "result") {
        const [x, y] = scr(it);
        const [mx, my] = scr(it.meet);
        const u = it.progress;
        const win = it.captured ? it.attacker : it.defender;
        if (show) {
          if (it.captured) {
            // The old banner topples, the new House's banner is raised, and its colour ripples round the land.
            if (it.defender) {
              const old = this.puppet(pi++, this.bank.house("banner-flag", houseOf(view, it.defender)), null, 0xffffff);
              if (old) {
                const k = (22 * zk) / old.base.texture.height;
                old.root.position.set(x - 4 * zk, y - 6 * zk);
                old.root.scale.set(k);
                old.root.rotation = easeOut(clamp01(u / 0.35)) * 1.5;
                old.root.alpha = 1 - clamp01((u - 0.2) / 0.25);
              }
            }
            const raised = easeOut(clamp01((u - 0.15) / 0.35));
            const flag = this.puppet(pi++, this.bank.house("banner-flag", houseOf(view, it.attacker)), null, 0xffffff);
            if (flag && raised > 0) {
              const k = (24 * zk) / flag.base.texture.height;
              flag.root.position.set(x + 4 * zk, y - 4 * zk);
              flag.root.scale.set(k, k * (raised * (1 + 0.12 * Math.sin(raised * Math.PI))));
              flag.root.rotation = Math.sin(u * Math.PI * 5) * 0.05;
            }
            const rings = this.rings.get(it.at) ?? [];
            const ripple = clamp01((u - 0.2) / 0.6);
            if (ripple > 0 && ripple < 1)
              for (const ring of rings) {
                const pts: number[] = [];
                for (let k = 0; k < ring.length; k += 2) {
                  const [sx, sy] = toScreen(cam, ring[k]!, ring[k + 1]!);
                  pts.push(sx, sy);
                }
                s.poly(pts, true).stroke({ width: (3 + 9 * ripple) * zk, color: colour(it.attacker), alpha: 0.65 * (1 - ripple), join: "round" });
              }
          } else if (it.defender) {
            // Held: the defender's shield flashes.
            const sh = this.puppet(pi++, this.bank.house("shield-base", houseOf(view, it.defender)), null, 0xffffff);
            if (sh) {
              const pop = u < 0.25 ? 0.6 + 0.6 * easeOut(u / 0.25) : 1.2 - 0.2 * clamp01((u - 0.25) / 0.25);
              const k = ((22 * pop) * zk) / sh.base.texture.height;
              sh.root.position.set(x, y - 2 * zk);
              sh.root.scale.set(k);
              sh.root.alpha = 1 - clamp01((u - 0.6) / 0.4);
            }
          }
        }
        // The info: who holds the land now, and the losses on each side, floating up as ink-and-gold numbers.
        const col = win ? colour(win) : 0xd8cdb0;
        const fade = Math.min(1, (1 - u) * 4);
        g.roundRect(x - 44 * zk, y - 50 * zk, 88 * zk, 22 * zk, 7 * zk).fill({ color: NAVY, alpha: 0.92 * fade }).stroke({ width: 1.5, color: GOLD, alpha: fade });
        g.rect(x - 44 * zk, y - 50 * zk, 5 * zk, 22 * zk).fill({ color: col, alpha: fade });
        const word = this.text(ti++, it.captured ? "Captured" : "Held", 13 * Math.min(1.2, zk), it.captured ? 0xffd27a : PARCH);
        word.position.set(x + 2 * zk, y - 39 * zk);
        word.alpha = fade;
        const rise = easeOut(clamp01(u / 0.8)) * 18 * zk;
        const al = 1 - clamp01((u - 0.55) / 0.45);
        const a = this.text(ti++, `−${it.attackerLosses}`, 12 * Math.min(1.2, zk), GOLD_HI);
        a.position.set(mx - 14 * zk, my - 8 * zk - rise);
        a.alpha = al;
        const d = this.text(ti++, `−${it.defenderLosses}`, 12 * Math.min(1.2, zk), GOLD_HI);
        d.position.set(mx + 14 * zk, my - 8 * zk - rise);
        d.alpha = al;
      } else if (it.kind === "pop") {
        const [x, y] = scr(it);
        const col = colour(it.player);
        const ring = (10 + 26 * it.progress) * zk;
        g.circle(x, y, ring).stroke({ width: 3, color: col, alpha: 1 - it.progress });
        const t = this.text(ti++, it.label, 14 * Math.min(1.2, zk), 0xffe9b0);
        t.position.set(x, y - (20 + 18 * it.progress) * zk);
        t.alpha = Math.min(1, (1 - it.progress) * 2.5);
      } else {
        // Something stirs in the fog: two soft rings and a pale dot, the same for every fogged event.
        const [x, y] = scr(it);
        for (const k of [0, 0.35]) {
          const q = (it.progress + k) % 1;
          g.circle(x, y, (20 + 70 * q) * zk).stroke({ width: 4, color: 0xf3ead2, alpha: 0.55 * (1 - q) });
        }
        g.circle(x, y, 8 * zk).fill({ color: 0xf3ead2, alpha: 0.8 * (1 - it.progress * 0.5) });
      }
    }

    // A House knocked out: its last banner burns away (when you saw its last land fall).
    if (show && frame.beat?.kind === "eliminated") {
      const u = clamp01((frame.t - frame.beat.start) / frame.beat.duration);
      for (const e of frame.beat.events) {
        if (e.type !== "eliminated") continue;
        const at = lastLandOf(this.tl, e.player, frame.beat);
        const spot = at ? this.ctx.spot(at) : null;
        if (!spot) continue;
        const [x, y] = scr(spot);
        const flag = this.puppet(pi++, this.bank.house("banner-flag", houseOf(view, e.player)), null, 0xffffff);
        if (!flag) continue;
        const k = (26 * zk) / flag.base.texture.height;
        flag.root.position.set(x, y - 6 * zk);
        flag.root.scale.set(k, k * (1 - 0.35 * clamp01((u - 0.3) / 0.7)));
        flag.base.tint = blend(0xffffff, 0x2a1a10, clamp01(u / 0.7));
        flag.root.alpha = 1 - clamp01((u - 0.45) / 0.5);
      }
    }
  }

  destroy() {
    this.root.destroy({ children: true });
    this.show.destroy({ children: true });
  }
}

function blend(a: number, b: number, t: number): number {
  const c = (sh: number) => Math.round(((a >> sh) & 255) * (1 - t) + ((b >> sh) & 255) * t);
  return (c(16) << 16) | (c(8) << 8) | c(0);
}
