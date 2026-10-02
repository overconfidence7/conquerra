import { ASSET_BY_NAME, EMPTY_MANIFEST, type ArtManifest } from "@conquerra/art";
import { placeholder, type Painted } from "./placeholders";

/**
 * Where every picture comes from. Real art listed in `/art/manifest.json` (written by `pnpm art:import`) wins;
 * anything else uses its placeholder. Nothing else in the game names an image file.
 */
export interface Art {
  image: CanvasImageSource & { width: number; height: number };
  tintMask?: CanvasImageSource & { width: number; height: number };
  /** True for Nate's art, false for a placeholder. */
  real: boolean;
}

async function loadImage(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return createImageBitmap(await res.blob());
}

export class ArtBook {
  private cache = new Map<string, Art | null>();
  private constructor(
    private manifest: ArtManifest,
    private loaded: Map<string, Art>,
  ) {}

  /** Read the manifest and load the real art the map uses (not portraits or vistas, which menus load later). */
  static async load(base: string = import.meta.env.BASE_URL): Promise<ArtBook> {
    let manifest = EMPTY_MANIFEST;
    try {
      const res = await fetch(`${base}art/manifest.json`, { cache: "no-cache" });
      if (res.ok) manifest = (await res.json()) as ArtManifest;
    } catch {
      // No manifest (or offline): placeholders everywhere.
    }
    const loaded = new Map<string, Art>();
    await Promise.all(
      Object.entries(manifest.assets).map(async ([name, e]) => {
        const spec = ASSET_BY_NAME.get(name);
        if (!spec || spec.kind === "portrait" || spec.kind === "vista") return;
        try {
          const image = await loadImage(`${base}art/${e.file}`);
          const tintMask = e.tintMask ? await loadImage(`${base}art/${e.tintMask}`) : undefined;
          loaded.set(name, { image, ...(tintMask ? { tintMask } : {}), real: true });
        } catch (err) {
          console.warn(`Art "${name}" failed to load, using the placeholder`, err);
        }
      }),
    );
    return new ArtBook(manifest, loaded);
  }

  /** For tests and the no-art fallback. */
  static placeholdersOnly(): ArtBook {
    return new ArtBook(EMPTY_MANIFEST, new Map());
  }

  get(name: string): Art | null {
    const real = this.loaded.get(name);
    if (real) return real;
    if (!this.cache.has(name)) {
      const p: Painted | null = placeholder(name);
      this.cache.set(name, p ? { image: p.image, ...(p.tintMask ? { tintMask: p.tintMask } : {}), real: false } : null);
    }
    return this.cache.get(name) ?? null;
  }

  /** Names of the real art in use (for the debug overlay and the perf report). */
  get realNames(): string[] {
    return [...this.loaded.keys()].sort();
  }

  get manifestVersion() {
    return this.manifest.version;
  }
}
