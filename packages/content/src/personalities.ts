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
  /**
   * Session 20c: a leader of yours with this personality, in the report when it took land: `{places}` (the land it
   * took) and `{rival}` (whose it was: "Morwen's lot", or "the locals" for empty land). None: it says nothing.
   */
  took: z.string().optional(),
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
    /** Session 20c: false, it never stops a chain short for safer ground (the shared judgement's `pause`): the Blitzer. */
    pauses: z.boolean().optional(),
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
    /**
     * Session 20: building like the Steward. This many times your Steward's default share of the treasury (20% with
     * room, 10% on a crowded table) goes each turn to what "Run the realm" would buy (forts where an army masses,
     * markets and culture where they pay back, a barracks where there's nowhere to recruit), in place of its own
     * markets and culture; the rest to its armies. 0: as before.
     */
    realm: z.number().min(0).optional(),
    /**
     * Session 20b: walls. When building like the Steward, it finishes a wall (culture to the top and a fort) on land worth
     * holding where at most this much gold is left to pay (the Turtle from scratch, the Blitzer never). Missing: the
     * Steward's own (`leaders.steward.walls.near`).
     */
    walls: z.number().min(0).optional(),
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
   * Session 20c (Nate): defensible pauses. A chain that would stop where a rival army next to it would likely throw it
   * straight back out stops instead at its last hop that wouldn't be (at most `back` hops back), so no rival army gets
   * behind its lines.
   */
  pause: z.object({ back: z.number().int().min(0) }).optional(),
  /**
   * Session 20c (Nate): a sweep of our own land before the attack. When a rival army it can see could reach land of
   * ours behind the front this turn, transfers from land it can't reach bring `troops` into each such territory
   * (attacking only if still stronger, so anything that stepped in is taken back), queued `first` (before the
   * attacks) or after them.
   */
  homeSweep: z.object({ troops: z.number().int().min(1), first: z.boolean() }).optional(),
  /** Session 20c: the leaders it has captured go with its armies (on the biggest move out of where each stands). */
  carryCaptured: z.boolean().optional(),
  /**
   * Reading the border (Nate): land in a province it holds whole keeps enough troops to hold against the army next to
   * it (`guard`); its capital and that land draw reinforcements when a rival army two steps away could strike next
   * turn (`reach`); and it builds a fort there when it can afford one (`fort`).
   */
  anticipate: z.object({ guard: z.boolean(), reach: z.boolean(), fort: z.boolean(), /** Session 20: on a crowded table too (else roomy tables only). */ crowded: z.boolean().optional() }).optional(),
  /**
   * Session 20: on a crowded table (at most `rules.leaders.crowdedTerritories` territories a player) it builds nothing
   * for the long run (markets, culture, its own forts, spies): they don't pay back before the game's decided there.
   */
  crowdedLean: z.boolean().optional(),
  /** Session 19: its own Leader goes with the main attack out of where it stands, and on through that attack's chain (+20%), as your leaders' does. */
  leaderGoes: z.boolean().optional(),
  /**
   * Session 20c (Nate: the bots' Leaders are used): from this turn its Leader also marches to where its biggest attack
   * sets out and takes the Initiative there. (From turn 1 it made the strongest opener snowball on a crowded table:
   * half of Embervale by turn 10 in half the games of four Marshals, against a third.)
   */
  leaderGoesFrom: z.number().int().min(0).optional(),
  /**
   * Session 19: the order of its queue. Each player's orders run one a round, so every purchase queued before the
   * attacks lets the rivals move first. "armies" queues troops (the Spoils, recruits) first, then the armies' moves,
   * then everything else it buys (buildings, specialists, culture, spies), as your leaders' orders come out.
   */
  queue: z.enum(["spending", "armies"]).optional(),
  /**
   * Session 19: how much more the Marshal values land of the runaway leader (`leader`, on top of the Captain's own
   * priority) and of a joint war's target it's in (`war`). Defaults: 1.4 and 1.6 (session 17's).
   */
  pull: z.object({ leader: z.number().min(1), war: z.number().min(1) }).optional(),
  /**
   * Session 19: a guard at the capital. Embervale's capitals are 3 steps apart, and an all-out opening that leaves one
   * troop at home lets a rival's chain walk in on turn 1. The capital keeps `reach` times the biggest rival army it knows
   * of within `steps` steps (what it sees, or last saw), and for the first `turns` turns, while it can't see that far,
   * `opening` times its own stack: on every table, or (with `crowded`) only where there are at most that many
   * territories a player. On every table, players knocked out by turn 6 fell from 16-24% to 1-2% and the halfway leader
   * won less, for about 4 more turns a game (fine, Nate: his own games run shorter than the bots').
   */
  capitalGuard: z.object({ steps: z.number().int().min(1), reach: z.number().min(0), turns: z.number().int().min(0), opening: z.number().min(0).max(1), crowded: z.number().min(0).optional() }).optional(),
  /**
   * Session 20 (Nate): finishing a rival that's down to a handful of territories (`rules.leaders.finish`). It recruits at
   * the `sites` recruit sites nearest them, marches troops through its own land (up to `hops` hops, one order a hop) to
   * every territory of ours next to theirs, and strikes each of theirs with `margin` times what it takes, their armies
   * first, chaining on through the rest and taking the empty land they could run to.
   */
  finish: z.object({ margin: z.number().min(1), hops: z.number().int().min(1), sites: z.number().int().min(1) }).optional(),
  /**
   * Session 20c (Nate's second note): finishing the game once it cleans up is mass and sweep. Every spare troop marches
   * to one staging territory next to the remnant's biggest army (with the Leader), one chain sweeps their land and the
   * empty land their armies could reach (as far as their armies could chain, `reach` hops at most), and a security blanket of transfers brings
   * `blanket` troops into each territory of ours they could reach, queued last, to take back anything they take. A
   * remnant of at most `ringUpTo` territories that it can strike everywhere at once gets session 20's ring instead.
   */
  sweep: z.object({ reach: z.number().int().min(1), blanket: z.number().int().min(0), ringUpTo: z.number().int().min(0) }).optional(),
  /** Session 20: every Marshal builds like the Steward (each personality's `build.realm` share). Off: as before. */
  realm: z.boolean().optional(),
  /** ...on a crowded table too (at most `rules.leaders.crowdedTerritories` a player), where buildings pay back slowly. */
  realmCrowded: z.boolean().optional(),
  /**
   * Session 20 (Nate's playbook, a one-change test): once it holds `from` of the map, it picks the best region within
   * reach (a province and the provinces around it: their bonuses and land, less the rival armies in it), drives
   * everyone else out of it (its land worth `pull` times more), asks for forts on its border, and outside it takes only
   * land it can hold.
   */
  region: z.object({ from: z.number().min(0).max(1), pull: z.number().min(1) }).optional(),
  /** Session 20: reinforcements march up to this many hops through its own land in one turn (one order a hop; 1: a step a turn, as before). */
  march: z.number().int().min(1).optional(),
  /**
   * Session 20 (Nate): anticipate and counter. For each rival army of at least `minArmy` troops it can see next to its
   * land, it guesses the army's next move (the territory of ours it would most likely take: worth the most for the
   * fewest troops) and counters it: strikes the army first where it can (worth `strike` times more), else sends
   * troops there (a reinforcement goal of `block`), and asks for a fort there.
   */
  counter: z.object({ minArmy: z.number().int().min(1), strike: z.number().min(0), block: z.number().min(0) }).optional(),
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
    /**
     * Run the realm buys culture for its income (not only where it protects) when a level pays back at least this much
     * gold a turn for each gold (a market pays 2 for 6: 0.33). Session 19: under the old rules culture paid 0.17, so it
     * never did; with more income a level, it does.
     */
    culturePays: z.number().min(0).default(0.3),
    /**
     * Session 20b: walls. "Run the realm" and "Build up this province" finish a wall where a territory worth holding (the
     * capital, a choke point, a province held whole, or next to a wall of ours) has at most `near` gold left to pay
     * (culture to the top and a fort), at most `each` territories a turn, ahead of markets.
     */
    walls: z.object({ near: z.number().min(0), each: z.number().int().min(0) }).default({ near: 18, each: 1 }),
    /**
     * Session 20c: a Steward's personality on "Run the realm". The Turtle: a fort wherever a rival army of at least
     * `fortThreat` stands next door (not only urgent ones), and up to `culture` levels a turn where they protect, before
     * markets. The Merchant: a threatened capital's fort, then markets (where they pay), then the other urgent forts, then culture for its income. A
     * Marshal's Steward of another personality runs the realm as Neutral does.
     */
    styles: z
      .object({
        turtle: z.object({ fortThreat: z.number().int().min(1), culture: z.number().int().min(0), /** Session 20b: walls from scratch (any land worth holding). */ walls: z.number().min(0).default(39) }),
        merchant: z.object({ culturePays: z.number().min(0), /** Session 20b: walls, after its markets. */ walls: z.number().min(0).default(18), /** Session 20b: at most this many markets a turn (missing: as many as it can). */ markets: z.number().int().min(0).optional() }),
      })
      .default({ turtle: { fortThreat: 3, culture: 2, walls: 39 }, merchant: { culturePays: 0.3, walls: 18 } }),
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
