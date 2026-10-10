import { Container, Graphics, Sprite, type Texture } from "pixi.js";

/**
 * Buildings that stand up off the land (session 21, Nate: "make the buildings more 3D so they pop like the wall").
 * Drawn in code around the painted sprite, with the map's one light from the upper left, like the walls and the
 * scenery's shadows:
 *  - a cast shadow made from the building's own outline, laid flat on the ground and falling down and to the right;
 *  - a low stone plinth it stands on: a lit top, a shaded front, an ink edge;
 *  - a lit rim on its upper-left edges and a shaded rim on its lower-right ones, so it reads as a solid object.
 * The painted sprites stay as they are (art batch 5 can paint 3D versions later). Everything is in map units, so it
 * holds at every zoom, and it sits under the troop pills like the building always did.
 */

const INK = 0x1b1206, STONE_TOP = 0x9a8f78, STONE_SIDE = 0x564e42, LIGHT = 0xfff3d8;

export interface SolidOptions {
  /** The building's width (map units). */
  width: number;
  /** Where its foot is on the sprite (0..1 down from the top). */
  anchorY?: number;
  /** Draw a plinth (buildings, the capital); scaffolds stand on the bare ground. */
  plinth?: boolean;
  /** Greyed (remembered in the fog). */
  remembered?: boolean;
  /** The art's name on each of its sprites (the painted map swaps in the bigger art by name at Near). */
  label?: string;
}

/** A building standing on the land: its shadow, its plinth, its lit and shaded rims and the sprite. Foot at (0, 0). */
export function solid(tex: Texture, o: SolidOptions): { root: Container; sprite: Sprite } {
  const root = new Container();
  const ay = o.anchorY ?? 0.88;
  const k = o.width / tex.width;

  const ghost = (tint: number, alpha: number) => {
    const s = new Sprite(tex);
    s.anchor.set(0.5, ay);
    s.scale.set(k);
    s.tint = tint;
    s.alpha = alpha;
    if (o.label) s.label = o.label;
    return s;
  };
  // The cast shadow: its own outline, flipped flat onto the ground and leaning away from the light.
  const cast = ghost(0x000000, o.remembered ? 0.18 : 0.36);
  cast.scale.set(k, -k * 0.38);
  cast.skew.set(-0.95, 0);
  cast.position.set(o.width * 0.05, o.width * 0.03);
  root.addChild(cast);
  if (o.plinth) {
    const w = o.width * 0.43, d = o.width * 0.1, t = Math.max(1, o.width * 0.05);
    const p = new Graphics();
    // The front face (shaded), then the lit top.
    p.ellipse(0, d * 0.25 + t, w, d).fill({ color: STONE_SIDE, alpha: o.remembered ? 0.5 : 0.95 }).stroke({ width: Math.max(0.5, o.width * 0.012), color: INK, alpha: 0.6 });
    p.rect(-w, d * 0.25, w * 2, t).fill({ color: STONE_SIDE, alpha: o.remembered ? 0.5 : 0.95 });
    p.ellipse(0, d * 0.25, w, d).fill({ color: o.remembered ? 0x9a9a9a : STONE_TOP, alpha: o.remembered ? 0.5 : 1 }).stroke({ width: Math.max(0.5, o.width * 0.012), color: INK, alpha: 0.55 });
    // A soft lighter edge where the light catches the top's far rim.
    p.ellipse(-w * 0.12, d * 0.1, w * 0.78, d * 0.62).fill({ color: LIGHT, alpha: 0.1 });
    root.addChild(p);
  }
  // Rims: shaded down-right, lit up-left, both just peeking out from under the sprite.
  const px = Math.max(0.35, o.width * 0.022);
  const dark = ghost(INK, o.remembered ? 0.25 : 0.55);
  dark.position.set(px * 1.1, px * 1.2);
  const lit = ghost(LIGHT, o.remembered ? 0.2 : 0.5);
  lit.position.set(-px * 0.9, -px);
  const sprite = ghost(0xffffff, 1);
  root.addChild(dark, lit, sprite);

  return { root, sprite };
}
