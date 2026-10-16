import { useEffect, useState } from "react";
import type { ArtBook } from "../art/book";
import type { House } from "../map/houses";

/**
 * Art for the menus as image URLs: Nate's imported file when there is one, otherwise the painted placeholder.
 * The art book loads once per page.
 */
let book: Promise<ArtBook> | null = null;
const urls = new Map<string, Promise<string | null>>();
// Session 31: the art book and its painted placeholders load after the lobby's first paint (not in the start-up bundle).
export const artBook = () => (book ??= import("../art/book").then(({ ArtBook }) => ArtBook.load().catch(() => ArtBook.placeholdersOnly())));

export function artUrl(name: string): Promise<string | null> {
  let p = urls.get(name);
  if (!p) {
    p = artBook().then((b) => {
      const real = b.urlOf(name);
      if (real) return real;
      const a = b.get(name);
      if (!a) return null;
      const img = a.image as HTMLCanvasElement | ImageBitmap;
      if ("toDataURL" in img) return img.toDataURL();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      c.getContext("2d")!.drawImage(img, 0, 0);
      return c.toDataURL();
    });
    urls.set(name, p);
  }
  return p;
}

export function useArtUrl(name: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    if (name) void artUrl(name).then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [name]);
  return url;
}

/** A House's shield (colour plus pattern), as an image URL. */
export function useShield(house: House): string | null {
  const key = `shield:${house.name}`;
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    let p = urls.get(key);
    if (!p) {
      p = Promise.all([artBook(), import("../art/heraldry")]).then(([b, { tinted }]) => tinted(b.get("shield-base")!, house, true, { w: 64, h: 64 }).toDataURL());
      urls.set(key, p);
    }
    void p.then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [key, house]);
  return url;
}
