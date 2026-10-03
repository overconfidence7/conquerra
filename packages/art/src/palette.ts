/**
 * Colour targets that make art from different AI batches sit together (used by `pnpm art:import`).
 * Edit freely: colours are the average colour the art is nudged toward, contrast is how much light and dark
 * variation it keeps (the spread of brightness, 0-255 scale), and strength is how far to nudge (0 = off, 1 = all
 * the way). `flatten` (ground textures only) evens out big light and dark patches baked into a texture, so its
 * built-in shading doesn't repeat across the map or fight the map's own hill lighting; small detail is kept.
 */
export interface ColourTarget {
  colour: string;
  contrast: number;
  strength: number;
  /** 0 = off, 1 = remove big light and dark patches completely. */
  flatten?: number;
}

/** Ground and water textures, by asset name. */
export const GROUND_TARGETS: Record<string, ColourTarget> = {
  "terrain-grass": { colour: "#6e7a3c", contrast: 14, strength: 0.6, flatten: 0.5 },
  "terrain-farmland": { colour: "#7f7549", contrast: 22, strength: 0.6, flatten: 0.5 },
  "terrain-forest": { colour: "#34462c", contrast: 25, strength: 0.6, flatten: 0.4 },
  "terrain-hills": { colour: "#76713f", contrast: 17, strength: 0.7, flatten: 0.8 },
  "terrain-rock": { colour: "#8a8478", contrast: 18, strength: 0.7, flatten: 0.85 },
  "terrain-snow": { colour: "#e2e7ee", contrast: 10, strength: 0.7, flatten: 0.85 },
  "terrain-swamp": { colour: "#505b39", contrast: 16, strength: 0.6, flatten: 0.5 },
  "terrain-sand": { colour: "#d6bf8a", contrast: 12, strength: 0.6, flatten: 0.6 },
  "water-shallow": { colour: "#4f9fb0", contrast: 10, strength: 0.5, flatten: 0.6 },
  "water-deep": { colour: "#245479", contrast: 9, strength: 0.5, flatten: 0.6 },
};

/** Sprite families: every member is nudged toward the same look. Matched by name prefix. */
export const SPRITE_FAMILIES: { family: string; prefixes: string[]; target: ColourTarget }[] = [
  { family: "trees", prefixes: ["tree-"], target: { colour: "#3e5a2e", contrast: 40, strength: 0.45 } },
  { family: "mountains", prefixes: ["mountain-"], target: { colour: "#8b8681", contrast: 46, strength: 0.4 } },
  { family: "hills", prefixes: ["hill-"], target: { colour: "#7b7a46", contrast: 30, strength: 0.4 } },
  { family: "settlements", prefixes: ["village-", "town-", "capital-"], target: { colour: "#8c7a63", contrast: 48, strength: 0.3 } },
];

export function colourTargetFor(name: string, kind: "texture" | "sprite" | string): ColourTarget | null {
  if (kind === "texture") return GROUND_TARGETS[name] ?? null;
  if (kind === "sprite") return SPRITE_FAMILIES.find((f) => f.prefixes.some((p) => name.startsWith(p)))?.target ?? null;
  return null;
}
