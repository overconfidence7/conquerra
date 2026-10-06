import { Texture } from "pixi.js";
import type { ArtBook } from "../../art/book";
import { tinted } from "../../art/heraldry";
import type { House } from "../../map/houses";

/** Textures made once and shared: art by name, and each House's banner and shield. */
export class TextureBank {
  private byName = new Map<string, Texture | null>();
  private masks = new Map<string, Texture | null>();
  private heraldry = new Map<string, Texture>();

  constructor(readonly art: ArtBook) {}

  get(name: string): Texture | null {
    if (!this.byName.has(name)) {
      const a = this.art.get(name);
      this.byName.set(name, a ? Texture.from(a.image) : null);
    }
    return this.byName.get(name)!;
  }

  /** Drop cached textures (art that has just loaded replaces its placeholder). */
  forget(names: readonly string[]) {
    for (const n of names) this.byName.delete(n);
  }

  /** The tintable part of a picture (white/grey), to colour with Sprite.tint. */
  mask(name: string): Texture | null {
    if (!this.masks.has(name)) {
      const a = this.art.get(name);
      this.masks.set(name, a?.tintMask ? Texture.from(a.tintMask) : null);
    }
    return this.masks.get(name)!;
  }

  /** A House's banner (flag) or shield, tinted and patterned. */
  house(kind: "banner-base" | "shield-base" | "banner-flag", house: House): Texture {
    const key = `${kind}:${house.name}`;
    let t = this.heraldry.get(key);
    if (!t) {
      const a = this.art.get(kind)!;
      t = Texture.from(tinted(a, house, true));
      this.heraldry.set(key, t);
    }
    return t;
  }

  destroy() {
    for (const t of [...this.byName.values(), ...this.masks.values(), ...this.heraldry.values()]) t?.destroy(true);
  }
}
