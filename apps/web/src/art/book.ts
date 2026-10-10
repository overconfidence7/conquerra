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

/** Placeholders are the same every game, so they're painted once per page load. */
const placeholderCache = new Map<string, Art | null>();

export class ArtBook {
  private cache = placeholderCache;
  /** The bigger copies of the map art (session 16), once `loadHd` has brought them in. */
  private hdLoaded = new Map<string, Art["image"]>();
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
        // Menus load portraits and vistas; the key art is shown by URL; effects load with the replay (`loadFx`).
        if (!spec || spec.kind === "portrait" || spec.kind === "vista" || spec.kind === "keyart" || spec.kind === "fx") return;
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

  /**
   * Load more real art now (portraits and vistas aren't loaded with the map): for a captured general's portrait on
   * its army marker. True if anything new arrived.
   */
  async ensure(names: readonly string[], base: string = import.meta.env.BASE_URL): Promise<boolean> {
    let added = false;
    await Promise.all(
      names.map(async (name) => {
        const e = this.manifest.assets[name];
        if (!e || this.loaded.has(name)) return;
        try {
          this.loaded.set(name, { image: await loadImage(`${base}art/${e.file}`), real: true });
          added = true;
        } catch (err) {
          console.warn(`Art "${name}" failed to load`, err);
        }
      }),
    );
    return added;
  }

  /**
   * Load the bigger copies of the map art (session 16), used only to paint the Near zoom. Called once the game is on
   * screen, so the first paint isn't kept waiting. Returns how many arrived.
   */
  async loadHd(base: string = import.meta.env.BASE_URL): Promise<number> {
    let n = 0;
    await Promise.all(
      Object.entries(this.manifest.assets).map(async ([name, e]) => {
        if (!e.hd || this.hdLoaded.has(name) || !this.loaded.has(name)) return;
        try {
          this.hdLoaded.set(name, await loadImage(`${base}art/${e.hd.file}`));
          n++;
        } catch (err) {
          console.warn(`Art "${name}" (Near size) failed to load; the usual size paints it`, err);
        }
      }),
    );
    return n;
  }

  /**
   * Load the replay's effects and the living map's pieces (session 21): smoke, flames, coins, birds. Called by the
   * map once it's on screen, never by the lobby. Returns how many arrived (also kept by `get`).
   */
  async loadFx(base: string = import.meta.env.BASE_URL): Promise<number> {
    let n = 0;
    await Promise.all(
      Object.entries(this.manifest.assets).map(async ([name, e]) => {
        if (ASSET_BY_NAME.get(name)?.kind !== "fx" || this.loaded.has(name)) return;
        try {
          this.loaded.set(name, { image: await loadImage(`${base}art/${e.file}`), real: true });
          n++;
        } catch (err) {
          console.warn(`Effect "${name}" failed to load; the replay draws without it`, err);
        }
      }),
    );
    return n;
  }

  /** How many bigger copies have arrived. */
  get hdCount() {
    return this.hdLoaded.size;
  }

  /** The bigger copy of a piece of map art, if it has arrived. */
  hd(name: string): Art["image"] | null {
    return this.hdLoaded.get(name) ?? null;
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

  /** Where an imported file is (for menus that show art as plain images: portraits and vistas), or null. */
  urlOf(name: string, base: string = import.meta.env.BASE_URL): string | null {
    const e = this.manifest.assets[name];
    return e ? `${base}art/${e.file}` : null;
  }

  /** Names of the real art in use (for the debug overlay and the perf report). */
  get realNames(): string[] {
    return [...this.loaded.keys()].sort();
  }

  get manifestVersion() {
    return this.manifest.version;
  }
}
