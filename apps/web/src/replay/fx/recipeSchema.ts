import { z } from "zod";

/**
 * The shape of an effect recipe (session 21). Recipes are data (recipes.ts), checked against this schema by a test,
 * so tuning an effect is editing numbers, not code. Sizes and distances are screen pixels at Mid zoom (a territory
 * about 120 px across); the game scales them with the zoom. Times are ms.
 */

const Range = z.tuple([z.number(), z.number()]).refine(([a, b]) => a <= b, "a range runs low to high");
const Fraction = z.number().min(0).max(1);

/** Where a particle's colour comes from: a fixed colour, or the House / the ground of the moment. */
export const Tint = z.union([z.string().regex(/^#[0-9a-f]{6}$/i), z.enum(["house", "attacker", "defender", "ground"])]);

export const Emitter = z
  .object({
    /** Effect art by name (fx-*), or one of the shapes drawn in code: dot, spark, glint, ember, ring, streak, flake. */
    textures: z.array(z.string()).min(1),
    blend: z.enum(["normal", "add", "screen"]),
    /** How many particles, plus this many per troop in the fight or the march, up to the most. */
    count: z.number().int().min(0),
    perTroop: z.number().min(0).default(0),
    max: z.number().int().min(1),
    /** When they're born, as a share of the effect's time. */
    at: z.tuple([Fraction, Fraction]),
    life: Range,
    /** Born this far from the effect's spot (an ellipse: spread across, spreadY down). */
    spread: z.number().min(0),
    spreadY: z.number().min(0).optional(),
    /** Born along the army's way instead of at one spot (dust behind a march, a ship's wake). */
    alongPath: z.boolean().default(false),
    /** Speed (px/s) and direction (degrees: 0 right, -90 up; "toward"/"away" from the other side of a fight). */
    speed: Range,
    angle: Range,
    /** Turn the directions toward (or away from) the effect's aim: a volley's flight, the attackers falling back. */
    aim: z.enum(["none", "toward", "away"]).default("none"),
    gravity: z.number().default(0),
    /** Slowing down: 0 none, 1 about a third slower each second. */
    drag: z.number().min(0).default(0),
    /** Flies from the effect's spot to its target in an arc this high (px): arrows, stones. Speed and angle are ignored. */
    flight: z.object({ height: Range }).optional(),
    size: Range,
    /** Size at the end of life, as a multiple of the size at birth. */
    grow: z.number().positive().default(1),
    spin: Range.default([0, 0]),
    /** Point along the direction of travel (arrows, sparks). */
    faceTravel: z.boolean().default(false),
    alpha: Fraction,
    fadeIn: Fraction.default(0.1),
    fadeOut: Fraction.default(0.4),
    tint: Tint.optional(),
    /** A flash: dropped on Light. */
    flash: z.boolean().default(false),
  })
  .strict();

export const Recipe = z.object({ emitters: z.array(Emitter).min(1), note: z.string() }).strict();
export const Recipes = z.record(Recipe);

export type EmitterSpec = z.infer<typeof Emitter>;
export type EmitterInput = z.input<typeof Emitter>;
export type RecipeSpec = z.infer<typeof Recipe>;
export type RecipeInput = z.input<typeof Recipe>;
