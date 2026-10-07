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
  id: z.enum(["conqueror", "blitzer", "turtle", "schemer", "opportunist", "merchant"]),
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
  /** A joint war against the runaway: every Marshal accepts and proposes one, and fronts with the runaway come first. */
  leaderWar: z.boolean(),
});
export type MarshalJudgement = z.infer<typeof MarshalJudgement>;

export const MarshalData = z
  .object({ judgement: MarshalJudgement, personalities: z.array(Personality).min(1) })
  .superRefine((d, ctx) => {
    if (new Set(d.personalities.map((p) => p.id)).size !== d.personalities.length) ctx.addIssue({ code: "custom", message: "personality ids must be unique" });
  });
export type MarshalData = z.infer<typeof MarshalData>;
