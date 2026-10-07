import { z } from "zod";

/**
 * The Marshal (session 17, design additions §11): the hard bot level, with personalities. A personality is play style
 * only, never extra power: every one plays by the same rules and gold. Each is one block of weights and switches in
 * `data/personalities.json`, so they're tuned without code changes. `judgement` is what every Marshal shares, whatever
 * its personality (the behaviours the sims found win, and how it reads a runaway leader).
 */

const Odds = z.number().min(0);

/** What one personality says in its own voice when its style decides an answer (one plain line). */
const Voice = z.object({
  truceYes: z.string(),
  truceNo: z.string(),
  warYes: z.string(),
  warNo: z.string(),
  tradeYes: z.string(),
  tradeNo: z.string(),
  passageYes: z.string(),
  passageNo: z.string(),
  /** Breaking a handshake deal: `{place}` is the prize. */
  breaks: z.string(),
  /** Its own offers' notes: a truce, a joint war (`{target}`), a trade. */
  offerTruce: z.string(),
  offerWar: z.string(),
});

export const Personality = z.object({
  /** The six bots' personalities; "delegate" is the style your leaders plan with (session 18), never dealt to a bot. */
  id: z.enum(["conqueror", "blitzer", "turtle", "schemer", "opportunist", "merchant", "delegate"]),
  /** "the Turtle": what the game-over screen says after a bot's name. */
  title: z.string(),
  /** One line for the rules reference and the lobby. */
  summary: z.string(),
  attack: z.object({
    /** Chain on when the army that should arrive is at least this many times what the next hop needs (the Captain: 1.25). */
    chainMargin: Odds,
    /** At most this many hops in one chain (the Captain: 4). */
    maxHops: z.number().int().min(1),
    /** Spare troops at the end of a chain that add Follow through (the Captain: 6). */
    followThroughSpare: z.number().int().min(0),
    /** Of a stack's troops beyond what an attack needs, the share thrown in too (the Captain: 0.5). */
    sendShare: z.number().min(0).max(1),
    /** Before `strikeTurn`, attacks on rivals' land need this many times what they need (calm play); neutral land is never held back. */
    calmMargin: Odds,
    /** The turn its calm play ends and it strikes (0: never calm). */
    strikeTurn: z.number().int().min(0),
    /** Masses on one front (its main target), sending every spare troop there, and holds its other borders with just enough. */
    oneFront: z.boolean(),
    /** How much more a rival that just fought (lost troops or land last turn, as it watched) is worth hitting (0: no more). */
    vulture: z.number().min(0),
  }),
  defend: z.object({
    /** Share of what it takes to hold a frontier territory that stays there (0: the 1-troop garrison; the Captain: 0, except choke points and a threatened capital). */
    frontGarrison: z.number().min(0).max(2),
    /** Pull back a frontier stack facing this many times its troops (the Captain: 2.5; 0: never). */
    retreatAt: z.number().min(0),
  }),
  build: z.object({
    /** A fort on a front where a rival army of at least this many troops stands (the Captain: 4 at choke points only); 0: no forts beyond the Captain's own. */
    fortAt: z.number().int().min(0),
    /** At most this many forts going up or standing on its frontier at once, beyond choke points. */
    forts: z.number().int().min(0),
    /** Markets on safe land (no rival army next to it), from this turn, at most this many, keeping gold for this many troops. */
    marketsFrom: z.number().int().min(0),
    markets: z.number().int().min(0),
    marketReserve: z.number().int().min(0),
    /** Culture: from this turn, keeping gold for this many troops; `everywhere`: also on safe interior land, not only where it means to hold. */
    cultureFrom: z.number().int().min(0),
    cultureReserve: z.number().int().min(0),
    cultureEverywhere: z.boolean(),
    /** Spies: at most this many, from this turn, keeping gold for this many troops (the Captain: 1 from turn 6, 12 troops). */
    spies: z.number().int().min(0),
    spiesFrom: z.number().int().min(1),
    spyReserve: z.number().int().min(0),
  }),
  deals: z.object({
    /** Added to how much it likes each kind of deal when it judges an offer (negative: it likes them less). */
    truce: z.number(),
    war: z.number(),
    trade: z.number(),
    passage: z.number(),
    /** It breaks a handshake deal when the gain is at least this many times the penalty (the Captain: 2). */
    breakGain: z.number().min(1),
    /** It offers truces to neighbours it isn't fighting (the Schemer: truces it means to break; the Merchant: peace to grow rich). */
    offersTruces: z.boolean(),
    /** It offers joint wars against its own target, not only against a runaway. */
    offersWars: z.boolean(),
  }),
  voice: Voice,
});
export type Personality = z.infer<typeof Personality>;
export type PersonalityId = Personality["id"];

/** What every Marshal shares, whatever its personality. */
export const MarshalJudgement = z.object({
  /**
   * A runaway leader, judged on the Marshal's estimate of everyone's land (what it sees and remembers, plus land it
   * can't see given to whoever holds the nearest land it knows of): `share` of the map, or `minShare` and `lead` times
   * anyone else. From `bigTable` players up, `bigShare` / `bigMinShare` / `bigLead` instead (a big map hides more).
   */
  runaway: z.object({
    share: z.number().min(0).max(1),
    minShare: z.number().min(0).max(1),
    lead: z.number().min(1),
    bigTable: z.number().int().min(2),
    bigShare: z.number().min(0).max(1),
    bigMinShare: z.number().min(0).max(1),
    bigLead: z.number().min(1),
    /** Pace: a rival that gained the most land over the last `paceTurns` turns, at least `paceLead` times the next fastest, and holding `paceMinShare` already. */
    paceTurns: z.number().int().min(1),
    paceLead: z.number().min(1),
    paceMinShare: z.number().min(0).max(1),
    /** Once it names a runaway it keeps naming it for this many turns unless it clearly falls back (it sticks). */
    stickTurns: z.number().int().min(0),
  }),
  /** Land it last saw as neutral counts as neutral for this many turns; after that it's land it doesn't know. */
  neutralFreshTurns: z.number().int().min(0),
  /** How much land it can't see counts toward the nearest rival it knows of (1: as estimated; 0: only what it sees and remembers). */
  unseenWeight: z.number().min(0).max(1).optional(),
  /** Of that land, the share spread evenly among the living rivals rather than given to the nearest (0 to 1). */
  unseenSpread: z.number().min(0).max(1).optional(),
  /** A joint war against the runaway: every Marshal accepts and proposes one, and fronts with the runaway come first. */
  leaderWar: z.boolean(),
  /**
   * The opening (Part 2, what wins): for the first `turns` turns every Marshal expands at least this hard, whatever its
   * personality: chaining on at `chainMargin` or less, throwing in `sendShare` of its spare troops or more, up to
   * `maxHops` hops, Follow through with `followThroughSpare` spare. A calm personality still doesn't attack rivals early.
   */
  opening: z.object({ turns: z.number().int().min(0), chainMargin: z.number().min(0), sendShare: z.number().min(0).max(1), maxHops: z.number().int().min(1), followThroughSpare: z.number().int().min(0) }).optional(),
  /** Building for the long run (markets, culture on safe land, a personality's extra forts) waits until this turn (troops first). */
  buildFrom: z.number().int().min(0).optional(),
  /**
   * What wins (Part 2): every Marshal attacks at least this hard all game, whatever its personality: chaining on at
   * `chainMargin` or less, up to `maxHops` hops or more, throwing in `sendShare` of its spare troops or more.
   */
  attackFloor: z.object({ chainMargin: z.number().min(0), sendShare: z.number().min(0).max(1), maxHops: z.number().int().min(1), followThroughSpare: z.number().int().min(0) }).optional(),
  /** What wins (Part 2): a personality's honest garrisons on its fronts are scaled by this (troops held back lose games). */
  garrisonScale: z.number().min(0).max(1).optional(),
  /**
   * Whole provinces (Nate, during session 17): land that brings a province within reach of being held whole is worth
   * `drive` times the province's bonus more (in full for the last territory, two thirds for the one before, a third
   * for the one before that).
   */
  provinceDrive: z.number().min(0).optional(),
  /** Ending on defensible ground (Nate): a chain prefers to stop where few open borders face it (this much more value with none, half with one). */
  endSafe: z.number().min(0).optional(),
  /**
   * Reading the border (Nate): land in a province it holds whole keeps enough troops to hold against the army next to
   * it (`guard`); its capital and that land draw reinforcements when a rival army two steps away could strike next
   * turn (`reach`); and it builds a fort there when it can afford one (`fort`).
   */
  anticipate: z.object({ guard: z.boolean(), reach: z.boolean(), fort: z.boolean() }).optional(),
  /** Session 19: its own Leader goes with the main attack out of where it stands, and on through that attack's chain (+20%), as your leaders' does. */
  leaderGoes: z.boolean().optional(),
  /**
   * Session 19: the order of its queue. Each player's orders run one a round, so every purchase queued before the
   * attacks lets the rivals move first. "armies" queues troops (the Spoils, recruits) first, then the armies' moves,
   * then everything else it buys (buildings, specialists, culture, spies), as your leaders' orders come out.
   */
  queue: z.enum(["spending", "armies"]).optional(),
  /**
   * Session 19: a guard at the capital. Embervale's capitals are 3 steps apart, and an all-out opening that leaves one
   * troop at home lets a rival's chain walk in on turn 1. The capital keeps `reach` times the biggest rival army it knows
   * of within `steps` steps (what it sees, or last saw), and for the first `turns` turns, while it can't see that far,
   * `opening` times its own stack, on a crowded table (at most `crowded` territories a player: capitals start about 3
   * steps apart there; on roomier tables the opening guard only slowed games down).
   */
  capitalGuard: z.object({ steps: z.number().int().min(1), reach: z.number().min(0), turns: z.number().int().min(0), opening: z.number().min(0).max(1), crowded: z.number().min(0) }).optional(),
  /** TEMPORARY (session 19 tests): parts of the realm plan switched off. */
  off: z.array(z.string()).optional(),
});
export type MarshalJudgement = z.infer<typeof MarshalJudgement>;

/**
 * Your leaders (session 18): they plan with the Marshal's brain (the shared judgement, in this style), steered by
 * their command. `expand`: how "Expand our empire in this direction" values land; `steward`: what a Steward buys.
 */
export const LeaderPlanning = z.object({
  style: Personality,
  expand: z.object({
    /** Land closer to the target than our nearest land is worth this many times more (the leading edge). */
    ahead: z.number().min(0),
    /** Land as close as our nearest (widening the head of the advance): this many times. */
    level: z.number().min(0),
    /** Land in a province on the way that the advance is taking whole: this many times (behind the head too). */
    province: z.number().min(0),
    /** How many steps off the shortest way a province may lie and still be "on the way". */
    width: z.number().int().min(0),
  }),
  steward: z.object({
    /** A fort where a rival army of at least this many troops stands next door (and the fort would matter). */
    fortThreat: z.number().int().min(1),
    /** Markets stop this many turns before the turn cap (they'd never pay back). */
    marketsStopBefore: z.number().int().min(0),
    /** Culture "where it means to hold" pays when the troops there, this many fights over, beat its price in troops (the Marshal's rule). */
    cultureFights: z.number().min(0),
    /** A frontier land facing a rival is worth this share of a quiet one when judging what pays (it may be lost). */
    exposedWorth: z.number().min(0).max(1),
  }),
});
export type LeaderPlanning = z.infer<typeof LeaderPlanning>;

export const MarshalData = z
  .object({ judgement: MarshalJudgement, personalities: z.array(Personality).min(1), leaders: LeaderPlanning })
  .superRefine((d, ctx) => {
    if (new Set(d.personalities.map((p) => p.id)).size !== d.personalities.length) ctx.addIssue({ code: "custom", message: "personality ids must be unique" });
    if (d.personalities.some((p) => p.id === "delegate")) ctx.addIssue({ code: "custom", message: "the delegate style is your leaders', never a bot's" });
    if (d.leaders.style.id !== "delegate") ctx.addIssue({ code: "custom", message: "leaders plan in the delegate style" });
  });
export type MarshalData = z.infer<typeof MarshalData>;
