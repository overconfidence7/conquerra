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
  | "vista"
  /**
   * A replay effect or a living-map piece (session 21): smoke, dust, flames, coins, arrows, birds. Loaded with the game
   * screen once the map is up, never with the lobby.
   */
  | "fx"
  /** A full illustration for the title and game-over screens (session 21): wide, kept as painted. */
  | "keyart";

/**
 * How an effect is drawn over the map (session 21). Black-background pieces lose their background as transparency;
 * flames and lightning then add light ("add"), splashes and cracks lighten what's under them ("screen"), and smoke,
 * dust and mist sit on the land as soft see-through matter ("normal").
 */
export type FxBlend = "normal" | "add" | "screen";

export interface AssetSpec {
  /** File name without extension, exactly as in the prompt pack. */
  name: string;
  kind: AssetKind;
  /** 1 the map, 2 the info layer and menus, 3 the polish pass (effects and key art, session 21). */
  tier: 1 | 2 | 3;
  /** Made in white/grey; the game tints the light grey parts to each House's colour. */
  tint?: boolean;
  /** Longest side after import (px). Textures are this size square. */
  size: number;
  /** Smallest sensible source (longest side, px). Smaller files are imported but flagged as blurry. */
  minSource: number;
  /**
   * Map art painted into the world (session 16): also stored this big (longest side, px), loaded after the game is on
   * screen and used only for the Near zoom, so close up it stays sharp while the first paint stays as quick as before.
   */
  hd?: number;
  /**
   * Painted on pure black (session 21: smoke, flames, mist...): the importer turns brightness into transparency and
   * keeps the colour, so the edges are soft with no fringe. Otherwise a sprite's background is magenta.
   */
  background?: "black";
  /** Effects only: how the game blends it over the map. */
  blend?: FxBlend;
}

const tex = (name: string): AssetSpec => ({ name, kind: "texture", tier: 1, size: 512, minSource: 512, hd: 1024 });
const sprite = (name: string, size = 256, tint = false): AssetSpec => ({ name, kind: "sprite", tier: 1, size, minSource: 128, ...(tint ? { tint } : {}) });
/** Map art painted into the world: twice as big again for the Near zoom (session 16). */
const painted = (name: string, size: number): AssetSpec => ({ ...sprite(name, size), hd: size * 2 });
const icon = (name: string, tint = false): AssetSpec => ({ name, kind: "icon", tier: 2, size: 128, minSource: 64, ...(tint ? { tint } : {}) });
/** A replay effect painted on black (brightness becomes transparency). */
const fxBlack = (name: string, blend: FxBlend, size = 256): AssetSpec => ({ name, kind: "fx", tier: 3, size, minSource: 128, background: "black", blend });
/** A replay effect painted on magenta (cut out like a sprite). */
const fxSolid = (name: string, size = 192): AssetSpec => ({ name, kind: "fx", tier: 3, size, minSource: 128, blend: "normal" });
const keyArt = (name: string): AssetSpec => ({ name, kind: "keyart", tier: 3, size: 1280, minSource: 1024 });
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
export const FIGURE_SPRITES = ["figure-army", "figure-cavalry", "figure-siege", "figure-scouts", "figure-engineers", "figure-healers", "figure-rangers", "figure-standard-bearer", "figure-spy"] as const;

/** Batch 4's effects (session 21), painted on black: brightness becomes transparency. */
export const FX_BLACK: readonly AssetSpec[] = [
  ...range("fx-smoke", 3).map((n) => fxBlack(n, "normal")),
  ...range("fx-dust", 2).map((n) => fxBlack(n, "normal")),
  ...range("fx-flame", 3).map((n) => fxBlack(n, "add", 192)),
  fxBlack("fx-impact", "normal"),
  fxBlack("fx-splash", "screen"),
  ...range("fx-wisp", 2).map((n) => fxBlack(n, "normal")),
  ...range("fx-lightning", 2).map((n) => fxBlack(n, "add")),
  fxBlack("fx-crack", "screen"),
];
/** Batch 4's solid effects (session 21), painted on magenta. */
export const FX_SOLID: readonly AssetSpec[] = [
  fxSolid("fx-arrow", 128),
  fxSolid("fx-stone", 96),
  ...range("fx-rock", 2).map((n) => fxSolid(n, 128)),
  fxSolid("fx-coin", 96),
  fxSolid("fx-leaf", 96),
  fxSolid("fx-wheat", 128),
  fxSolid("fx-scroll", 384),
  fxSolid("fx-storm-cloud", 384),
  fxSolid("fx-birds", 192),
];

export const ASSETS: AssetSpec[] = [
  // ---- Tier 1: the map ----
  ...TERRAIN_TEXTURES.map(tex),
  ...WATER_TEXTURES.map(tex),
  ...range("tree-conifer", 3).map((n) => painted(n, 192)),
  ...range("tree-broadleaf", 3).map((n) => painted(n, 192)),
  ...range("mountain", 4).map((n) => painted(n, 256)),
  ...range("hill", 3).map((n) => painted(n, 192)),
  ...range("village", 3).map((n) => painted(n, 256)),
  ...range("town", 2).map((n) => painted(n, 256)),
  ...range("capital", 2).map((n) => painted(n, 384)),
  ...BUILDING_SPRITES.map((n) => sprite(n, 256)),
  // Every figure is made in white/grey, so the game can tint it to its House.
  ...FIGURE_SPRITES.map((n) => sprite(n, 256, true)),
  sprite("banner-flag", 256, true),
  painted("ship", 256),
  painted("bridge", 192),
  ...range("cloud", 3).map((n) => sprite(n, 512)),
  // Batch 3 (session 11). Ridges and cliffs are wide (the size is the longest side).
  ...range("ridge", 3).map((n) => painted(n, 384)),
  ...range("cliff", 3).map((n) => painted(n, 384)),
  painted("pass-gate", 256),
  sprite("scaffold", 256),
  painted("bridge-wood", 192),
  ...LANDMARK_SPRITES.map((n) => painted(n, 256)),
  // Batch 4 (session 21): the windmill in two pieces, so its sails can turn.
  painted("landmark-windmill-body", 256),
  sprite("landmark-windmill-sails", 192),
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
  icon("icon-rangers"),
  icon("icon-standard-bearer"),
  icon("icon-spy"),
  { ...icon("emblem"), size: 256 },
  { ...icon("seal"), size: 256 },
  { ...icon("frame-corner"), size: 256 },
  // A wide nameplate (about 4:1) the province plaques sit on.
  { ...icon("frame-plaque"), size: 512 },
  ...Array.from({ length: 10 }, (_, i): AssetSpec => ({ name: `leader-${String(i + 1).padStart(2, "0")}`, kind: "portrait", tier: 2, size: 512, minSource: 256 })),
  ...["city", "valley", "forest", "mountain", "harbor"].map((v): AssetSpec => ({ name: `vista-${v}`, kind: "vista", tier: 2, size: 1200, minSource: 600 })),
  // ---- Tier 3: the polish pass (batch 4, session 21) ----
  ...FX_BLACK,
  ...FX_SOLID,
  keyArt("art-title"),
  keyArt("art-victory"),
  keyArt("art-defeat"),
];

export const ASSET_BY_NAME: ReadonlyMap<string, AssetSpec> = new Map(ASSETS.map((a) => [a.name, a]));

/** One imported file, as listed in `apps/web/public/art/manifest.json`. Paths are relative to the manifest. */
export interface ManifestEntry {
  file: string;
  width: number;
  height: number;
  /** For tinted art: the light grey parts on their own, to colour with the House tincture over `file`. */
  tintMask?: string;
  /** The bigger copy for the Near zoom (session 16), for art with an `hd` size. */
  hd?: { file: string; width: number; height: number };
}

export interface ArtManifest {
  version: 1;
  /** Asset name -> imported file. Names not listed use the game's placeholder. */
  assets: Record<string, ManifestEntry>;
}

export const EMPTY_MANIFEST: ArtManifest = { version: 1, assets: {} };
