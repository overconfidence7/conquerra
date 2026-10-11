import { z } from "zod";
import recipeJson from "../data/recipe.json";
import { KINDS } from "./registry";

/** How each game sound is made from its sources (session 24): read by the importer and the tests, never by the game. */
export const LayerSchema = z.object({
  src: z.string(),
  file: z.string(),
  /** Seconds into the source to start from, and how much to take (all of it when left out). */
  start: z.number().min(0).optional(),
  duration: z.number().positive().optional(),
  /** Seconds into the mix where this layer starts. */
  at: z.number().min(0).optional(),
  /** dB. */
  gain: z.number().min(-40).max(20).optional(),
  /** Pitch and speed together (0.8 is lower and slower). */
  rate: z.number().min(0.5).max(2).optional(),
  fadeIn: z.number().min(0).optional(),
  fadeOut: z.number().min(0).optional(),
  /** Hz: a muffled, distant version. */
  lowpass: z.number().min(100).optional(),
});
export const VariantSchema = z.object({
  layers: z.array(LayerSchema).min(1),
  fadeIn: z.number().min(0).optional(),
  fadeOut: z.number().min(0).optional(),
  /** Trim leading and trailing silence (default true; music and ambience keep theirs so they loop). */
  trim: z.boolean().optional(),
  /** A replacement file in sound/incoming/replace/, named like the output (sfx-battle-1.wav), from this credit. */
  replace: z.string().optional(),
});
export const RecipeSchema = z.object({
  cues: z.array(z.object({ cue: z.string().regex(/^[a-z0-9-]+$/), kind: z.enum(KINDS), variants: z.array(VariantSchema).min(1) })),
});
export type Recipe = z.infer<typeof RecipeSchema>;

export const RECIPE: Recipe = RecipeSchema.parse(recipeJson);
