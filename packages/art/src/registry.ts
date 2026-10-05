/**
 * Every piece of art the game knows about, by the exact file name Nate saves it under in `art/incoming/`
 * (see docs/art/asset-list-and-prompts.md). The import script and the game both read this list, so a new
 * file is picked up by name with no code change. Anything missing is drawn by a placeholder in the game.
 *
 * Browser-safe: no Node imports here.
 */

export type AssetKind =
  /** Seamless ground or water texture: made square, tileable, 512 px. */
  | "texture"
  /** A map sprite on a transparent background (trees, peaks, towns, buildings, figures, ships, clouds). */
  | "sprite"
  /** A small UI / info-layer icon. */
  | "icon"
  /** Leader portrait (session 5). */
  | "portrait"
  /** Territory card vista (session 5). */
  | "vista";

export interface AssetSpec {
  /** File name without extension, exactly as in the prompt pack. */
  name: string;
  kind: AssetKind;
  tier: 1 | 2;
  /** Made in white/grey; the game tints the light grey parts to each House's colour. */
  tint?: boolean;
  /** Longest side after import (px). Textures are this size square. */
  size: number;
  /** Smallest sensible source (longest side, px). Smaller files are imported but flagged as blurry. */
  minSource: number;
}

const tex = (name: string): AssetSpec => ({ name, kind: "texture", tier: 1, size: 512, minSource: 512 });
const sprite = (name: string, size = 256, tint = false): AssetSpec => ({ name, kind: "sprite", tier: 1, size, minSource: 128, ...(tint ? { tint } : {}) });
const icon = (name: string, tint = false): AssetSpec => ({ name, kind: "icon", tier: 2, size: 128, minSource: 64, ...(tint ? { tint } : {}) });
const range = (stem: string, n: number) => Array.from({ length: n }, (_, i) => `${stem}-${i + 1}`);

export const TERRAIN_TEXTURES = [
  "terrain-grass",
  "terrain-farmland",
  "terrain-forest",
  "terrain-hills",
  "terrain-rock",
  "terrain-snow",
  "terrain-swamp",
  "terrain-sand",
] as const;
export const WATER_TEXTURES = ["water-shallow", "water-deep"] as const;

export const BUILDING_SPRITES = ["building-fort", "building-market", "building-barracks", "building-watchtower"] as const;
/** Decoration only: a few per map, placed by the renderer from the map data (session 11). */
export const LANDMARK_SPRITES = ["landmark-ruins", "landmark-stones", "landmark-lighthouse", "landmark-windmill"] as const;
export const FIGURE_SPRITES = ["figure-army", "figure-cavalry", "figure-siege", "figure-scouts", "figure-engineers", "figure-healers"] as const;

export const ASSETS: AssetSpec[] = [
  // ---- Tier 1: the map ----
  ...TERRAIN_TEXTURES.map(tex),
  ...WATER_TEXTURES.map(tex),
  ...range("tree-conifer", 3).map((n) => sprite(n, 192)),
  ...range("tree-broadleaf", 3).map((n) => sprite(n, 192)),
  ...range("mountain", 4).map((n) => sprite(n, 256)),
  ...range("hill", 3).map((n) => sprite(n, 192)),
  ...range("village", 3).map((n) => sprite(n, 256)),
  ...range("town", 2).map((n) => sprite(n, 256)),
  ...range("capital", 2).map((n) => sprite(n, 384)),
  ...BUILDING_SPRITES.map((n) => sprite(n, 256)),
  // Every figure is made in white/grey, so the game can tint it to its House.
  ...FIGURE_SPRITES.map((n) => sprite(n, 256, true)),
  sprite("banner-flag", 256, true),
  sprite("ship", 256),
  sprite("bridge", 192),
  ...range("cloud", 3).map((n) => sprite(n, 512)),
  // Batch 3 (session 11). Ridges and cliffs are wide (the size is the longest side).
  ...range("ridge", 3).map((n) => sprite(n, 384)),
  ...range("cliff", 3).map((n) => sprite(n, 384)),
  sprite("pass-gate", 256),
  sprite("scaffold", 256),
  sprite("bridge-wood", 192),
  ...LANDMARK_SPRITES.map((n) => sprite(n, 256)),
  // ---- Tier 2: info layer and menus ----
  icon("shield-base", true),
  icon("banner-base", true),
  icon("icon-crown"),
  icon("icon-gold"),
  icon("icon-culture"),
  icon("icon-troops"),
  icon("icon-fort"),
  icon("icon-market"),
  icon("icon-barracks"),
  icon("icon-watchtower"),
  icon("icon-cavalry"),
  icon("icon-siege"),
  icon("icon-scouts"),
  icon("icon-engineers"),
  icon("icon-healers"),
  { ...icon("emblem"), size: 256 },
  { ...icon("seal"), size: 256 },
  { ...icon("frame-corner"), size: 256 },
  // A wide nameplate (about 4:1) the province plaques sit on.
  { ...icon("frame-plaque"), size: 512 },
  ...Array.from({ length: 10 }, (_, i): AssetSpec => ({ name: `leader-${String(i + 1).padStart(2, "0")}`, kind: "portrait", tier: 2, size: 512, minSource: 256 })),
  ...["city", "valley", "forest", "mountain", "harbor"].map((v): AssetSpec => ({ name: `vista-${v}`, kind: "vista", tier: 2, size: 1200, minSource: 600 })),
];

export const ASSET_BY_NAME: ReadonlyMap<string, AssetSpec> = new Map(ASSETS.map((a) => [a.name, a]));

/** One imported file, as listed in `apps/web/public/art/manifest.json`. Paths are relative to the manifest. */
export interface ManifestEntry {
  file: string;
  width: number;
  height: number;
  /** For tinted art: the light grey parts on their own, to colour with the House tincture over `file`. */
  tintMask?: string;
}

export interface ArtManifest {
  version: 1;
  /** Asset name -> imported file. Names not listed use the game's placeholder. */
  assets: Record<string, ManifestEntry>;
}

export const EMPTY_MANIFEST: ArtManifest = { version: 1, assets: {} };
