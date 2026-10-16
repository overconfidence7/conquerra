import { z } from "zod";
import takeTheField from "../data/tutorials/01-take-the-field.json";
import raiseAnArmy from "../data/tutorials/02-raise-an-army.json";
import buildAndGrow from "../data/tutorials/03-build-and-grow.json";
import holdTheWall from "../data/tutorials/04-hold-the-wall.json";
import fateAndSpoils from "../data/tutorials/05-fate-and-spoils.json";
import makeADeal from "../data/tutorials/06-make-a-deal.json";
import yourLeaders from "../data/tutorials/07-your-leaders.json";
import siegeOfHighmouth from "../data/tutorials/08-siege-of-highmouth.json";

/**
 * Tutorials (session 31): each one is a short saved game that teaches one thing, as data. A file in
 * `data/tutorials/` holds the recipe that makes its saved game (a free map, the seed, the opponents, where things
 * stand, and any scripted turns that bring the game to the lesson's start), the goal (conditions from a small fixed
 * set), the hints (one a turn), the lesson's words, and the solution (your orders, turn by turn, that reach the goal).
 * A test plays every solution against the current engine, so a rule change that breaks a lesson fails the build.
 * The saved game is always rebuilt from the recipe, never kept as hand-edited state.
 *
 * Imported as `@conquerra/content/tutorials`: it loads only when Learn is opened (never with the lobby).
 */

/** The three maps that stay free after the launch date (`docs/11-launch-plan.md` §1): tutorials use only these. */
export const FREE_MAPS = ["embervale", "shattered-isles", "wyrmland"] as const;

/** Who holds a place in a recipe: you, a bot seat by its id ("bot1"), or nobody (neutral). */
const Owner = z.union([z.literal("you"), z.string().regex(/^bot\d+$/), z.null()]);
const Building = z.enum(["fort", "market", "barracks", "watchtower"]);

/** Where things stand at the lesson's start, laid over a new game (only what the lesson needs). */
const Place = z.object({
  territories: z
    .record(
      z.string(),
      z.object({
        owner: Owner.optional(),
        troops: z.number().int().min(1).optional(),
        culture: z.number().int().min(0).max(5).optional(),
        building: Building.nullable().optional(),
      }),
    )
    .optional(),
  /** Your treasury, Spoils hand (card marks), open Fate missions (as the engine keeps them), and your leaders' budgets. */
  you: z
    .object({
      gold: z.number().int().min(0).optional(),
      spoils: z.array(z.enum(["sword", "tower", "laurel"])).max(4).optional(),
      missions: z.array(z.object({ id: z.string(), card: z.string(), kind: z.string(), deadline: z.number().int() }).passthrough()).max(2).optional(),
      budgets: z.object({ leader: z.number().min(0).max(1).optional(), steward: z.number().min(0).max(1).optional() }).optional(),
    })
    .optional(),
});

/** An order as written in a file: the engine's own order, without its id (the builder numbers them). */
const OrderSpec = z.object({ kind: z.string() }).passthrough();

/**
 * The goal's conditions, all of which must hold at the start of a turn's planning (after a turn has played). The set
 * is small and fixed; each is read from your own view of the game only.
 */
export const GoalCondition = z.discriminatedUnion("kind", [
  /** These territories are yours. */
  z.object({ kind: z.literal("hold"), territories: z.array(z.string()).min(1) }),
  /** Every territory of this province is yours. */
  z.object({ kind: z.literal("province"), province: z.string() }),
  /** At least this many troops stand here (yours). */
  z.object({ kind: z.literal("troops"), territory: z.string(), atLeast: z.number().int().min(1) }),
  /** Culture at least this high: on this territory, or on any of yours in this province. */
  z.object({ kind: z.literal("culture"), territory: z.string().optional(), province: z.string().optional(), atLeast: z.number().int().min(1).max(5) }),
  /** A finished building of this kind: on this territory, or on any of yours in this province. */
  z.object({ kind: z.literal("building"), building: Building, territory: z.string().optional(), province: z.string().optional() }),
  /** At least this much gold in your treasury. */
  z.object({ kind: z.literal("gold"), atLeast: z.number().int().min(0) }),
  /** These territories are yours and walled (culture 5 and a fort). */
  z.object({ kind: z.literal("walled"), territories: z.array(z.string()).min(1) }),
  /** At least this many Spoils cards in your hand. */
  z.object({ kind: z.literal("spoils"), atLeast: z.number().int().min(1).max(5) }),
  /** A mission the recipe placed is no longer open (its deadline is after the goal's, so it can only have been done). */
  z.object({ kind: z.literal("missionDone"), mission: z.string() }),
  /**
   * A deal of this kind with this player: in force for at least `kept` turns (0: just made), or one that ran its
   * course (a trade paid at once is done the turn it's made).
   */
  z.object({ kind: z.literal("deal"), with: z.string(), deal: z.enum(["truce", "trade", "war", "passage"]), kept: z.number().int().min(0).max(8).default(0) }),
  /** Your Leader (or Steward) has a command, and (`budget`) a share of income or gold each turn. */
  z.object({ kind: z.literal("leader"), leader: z.enum(["leader", "steward"]), command: z.boolean().default(false), budget: z.boolean().default(false) }),
]);
export type GoalCondition = z.infer<typeof GoalCondition>;

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export const TutorialDef = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    /** A tutorial teaches with hints; a scenario (Part 4) is the same format without them. */
    kind: z.enum(["tutorial", "scenario"]),
    /** Its place in the list under Learn. */
    order: z.number().int().min(1),
    minutes: z.number().int().min(1).max(30),
    words: z.object({
      name: z.string().min(1),
      /** One sentence for its line under Learn. */
      blurb: z.string().min(1),
      /** The lesson's opening, one paragraph (warmth allowed). */
      opening: z.string().min(1),
      /** The goal in one line (under 40 words). */
      goal: z.string().refine((s) => words(s) < 40, "a goal is under 40 words"),
      /** The goal met, said as a fact ("Highmouth, Ashfell and Pinemark are yours"): the report's "Goal: ... Done." */
      met: z.string().min(1),
      /** One a turn, at most four, each under 25 words. */
      hints: z.array(z.string().refine((s) => words(s) < 25, "a hint is under 25 words")).max(4),
      /** The lesson's last line, on the Done card (warmth allowed). */
      closing: z.string().min(1),
    }),
    recipe: z.object({
      map: z.enum(FREE_MAPS),
      seed: z.string().min(1),
      bots: z.number().int().min(1).max(5),
      botLevel: z.enum(["recruit", "captain"]),
      rules: z.object({ fog: z.boolean().optional(), fate: z.boolean().optional(), diplomacy: z.boolean().optional() }).default({}),
      place: Place.optional(),
      /** Your orders for turns played before the lesson starts (the bots play their own), turn by turn. */
      turns: z.array(z.array(OrderSpec)).optional(),
    }),
    goal: z.object({
      /** How many turns you get: the goal is checked after each, up to the start of turn (start + turns). */
      turns: z.number().int().min(1).max(10),
      /** Hold to the end: met only if the conditions hold at the start of turn (start + turns), not before. */
      hold: z.boolean().default(false),
      all: z.array(GoalCondition).min(1),
    }),
    /** Your orders, turn by turn, that reach the goal (the test plays them). */
    solution: z.array(z.array(OrderSpec)).min(1),
  })
  .refine((t) => (t.kind === "scenario" ? t.words.hints.length === 0 : t.words.hints.length >= 1), "a tutorial has at least one hint, a scenario none")
  .refine((t) => t.solution.length <= t.goal.turns, "the solution fits in the goal's turns");
export type TutorialDef = z.infer<typeof TutorialDef>;
export type OrderSpec = z.infer<typeof OrderSpec>;

/** Every tutorial and scenario, in the order Learn lists them. */
export const TUTORIALS: TutorialDef[] = [takeTheField, raiseAnArmy, buildAndGrow, holdTheWall, fateAndSpoils, makeADeal, yourLeaders, siegeOfHighmouth].map((t) => TutorialDef.parse(t)).sort((a, b) => a.order - b.order);

export const tutorialById = (id: string): TutorialDef | undefined => TUTORIALS.find((t) => t.id === id);

/** The lesson after this one (tutorials only), or null at the end. */
export function nextTutorial(id: string): TutorialDef | null {
  const list = TUTORIALS.filter((t) => t.kind === "tutorial");
  const i = list.findIndex((t) => t.id === id);
  return i >= 0 ? (list[i + 1] ?? null) : null;
}
