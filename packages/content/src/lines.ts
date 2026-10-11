import { z } from "zod";
import linesJson from "../data/lines.json";

/**
 * The line library (session 22, the language pass): what the bots and leaders say, as data, in Nate's voice
 * (docs/voice-guide.md). Each situation has several versions so a long game doesn't repeat itself, and each line's
 * `{placeholders}` are checked against what its situation provides.
 *
 * Which version is said is picked by a seed made of the game's public id, the turn, the speaker and the situation
 * (never the dice seed, never Math.random()), so "Watch again" and a reload say the same thing.
 *
 * Imported as `@conquerra/content/lines`, not from the package's index: the library loads with the game screen and
 * the bots' worker, never with the lobby.
 */

/** The bots' personalities that have a voice of their own. The Captain and the Recruit speak plainly ("plain"). */
export const VOICES = ["conqueror", "blitzer", "turtle", "schemer", "opportunist", "merchant"] as const;
export type VoiceId = (typeof VOICES)[number];

/**
 * A bot's own lines, for each personality: the yes and no for each kind of deal (said when its style is what
 * decides), its offers, and breaking a deal for a prize. `yesTail` and `noTail`: a short turn of phrase it may add
 * after a shared reason (the reason itself stays as it is).
 */
export const BOT_SITUATIONS = {
  truceYes: [],
  truceNo: [],
  warYes: [],
  warNo: [],
  tradeYes: [],
  tradeNo: [],
  passageYes: [],
  passageNo: [],
  offerTruce: [],
  offerWar: ["target"],
  breaks: ["place"],
  yesTail: [],
  noTail: [],
} as const satisfies Record<string, readonly string[]>;
export type BotSituation = keyof typeof BOT_SITUATIONS;

/**
 * The reasons every bot gives, in one plain voice (the Captain's and the Recruit's): what it weighed, with the names
 * and numbers in it. A personality can have its own versions of a reason (`voiced`), which keep the same facts.
 */
export const REASONS = {
  notForMe: [],
  badTerms: [],
  alreadyHave: ["deal"],
  nothingLeft: [],
  cantSpare: ["n"],
  runawayGrow: [],
  runawayPass: [],
  strongestGrow: [],
  strongestPass: [],
  atWarWithPartner: ["rival"],
  brokeOur: ["deal"],
  brokeOurAt: ["deal", "place"],
  warFellThrough: [],
  oathbreakerTo: ["rival"],
  oathbreaker: [],
  noTrustYet: [],
  noTrust: [],
  makeBinding: ["why"],
  noHelp: [],
  bindingCosts: ["n"],
  noBorderPeace: [],
  noBorderBinding: [],
  handsFree: [],
  targetNotStopping: [],
  needArmyRunaway: ["rival"],
  needArmyIn: ["where"],
  theirArmyBigger: [],
  holdingFine: [],
  capitalDoor: [],
  strongerFight: [],
  shieldsRunaway: ["rival"],
  peaceUntil: ["rival"],
  truceTooLong: ["n"],
  counterTruce: ["n", "m"],
  gladlyRunaway: ["target"],
  gladlyStrongest: ["target"],
  counterWar: ["n"],
  targetNoWar: [],
  shieldsTarget: ["target", "rival"],
  truceWithTarget: ["target"],
  cantReach: ["target"],
  bothWant: ["target"],
  targetWeak: ["target"],
  targetStrong: ["target"],
  warTooLong: [],
  targetNoPassage: [],
  noArmiesInLand: [],
  mayPass: [],
  beatFoe: ["rival"],
  mutualFair: [],
  passageTooLong: ["n"],
  counterPassage: ["n"],
  cantPay: [],
  noCapital: [],
  guardsCapital: ["place"],
  giftGladly: ["gain"],
  fairPrice: ["gain", "cost"],
  fairPricePlain: [],
  notEnough: ["gain", "cost"],
  needGold: [],
  useGold: [],
  counterGold: ["n"],
  recruitWeaker: [],
  recruitStronger: [],
  recruitGladly: [],
  recruitJoin: [],
  recruitTooStrong: [],
  recruitNoPassage: [],
  recruitNoLand: [],
  recruitFair: [],
  recruitNo: [],
  offerRunawayWar: ["target"],
  offerPassage: ["target"],
  offerPassageRunaway: ["target"],
  offerPassageBeaten: ["target"],
  offerTruceNeeded: ["where"],
  offerTrucePlain: [],
  offerRecruitTruce: [],
  offerBuyLand: ["place", "province", "n"],
  offerSellLand: ["place"],
  breakWin: ["deal"],
  breakCapital: ["place", "deal"],
  breakRunaway: ["deal"],
} as const satisfies Record<string, readonly string[]>;
export type ReasonKey = keyof typeof REASONS;

/** Your leaders' voices: the six personalities, and "neutral" for a leader without one (dry and brief). */
export const LEADER_VOICES = [...VOICES, "neutral"] as const;
export type LeaderVoice = (typeof LEADER_VOICES)[number];

/**
 * What your leaders say in the turn report, the Chronicle and the Leaders panel (session 22), in their personality's
 * voice. `{places}`: land it took; `{rival}` in "took": whose it was ("Morwen's lot", or "the locals" for empty land),
 * elsewhere a rival's name. Every number is the turn's own.
 */
export const LEADER_SITUATIONS = {
  /** Your Leader's first word of a game (`{leader}`: its name). */
  opening: ["leader", "capital"],
  took: ["places", "rival"],
  /** Its own attack driven back: `{n}` lost. */
  pushedBack: ["place", "n"],
  /** It took a rival's capital. */
  capitalTaken: ["capital", "rival"],
  /** Your capital fell (the dry comment the title card doesn't make): `{n}` troops came for it. */
  capitalLost: ["capital", "rival", "n"],
  /** It finished a rival off. */
  finished: ["rival"],
  /** A rival army of `{n}` within two steps of your capital's province: what it's doing about it (it runs your army). */
  threatened: ["rival", "n", "capital"],
  /** The same, when you run the army yourself. */
  threatenedYours: ["rival", "n", "capital"],
  purseEmpty: [],
  /** The Steward finished a wall. */
  wallBuilt: ["place", "capital"],
  /**
   * Your Leader judges one of your own orders that went badly (Nate's running bit): your `{n}` against `{place}`'s
   * `{m}`, and the `{k}` at `{other}` that really were next to it.
   */
  judgeAttack: ["n", "place", "m", "k", "other"],
  /** The same with no army of yours next to it. */
  judgeAttackAlone: ["n", "place", "m"],
  /** `{place}` left with `{n}` next to `{rival}`'s `{m}`, and it fell. */
  judgeThin: ["place", "n", "rival", "m"],
  /** You broke a truce with `{rival}`, and `{n}` more Houses joined a war on you. */
  judgeTruce: ["rival", "n"],
  /** `{n}` gold left unspent while `{place}` fell. */
  judgeGold: ["n", "place"],
  /** Your capital left with `{n}` next to `{rival}`'s `{m}`, and it was attacked. */
  judgeCapital: ["capital", "n", "rival", "m"],
  /** A grudging compliment for a good move of yours. */
  compliment: ["place"],
  /** A grudge (a running gag with receipts): the rival, the place and the turn it happened. */
  grudgeFort: ["rival", "place", "turn"],
  grudgeHome: ["rival", "place", "turn"],
  grudgeArmy: ["rival", "place", "turn"],
  grudgeRevenge: ["rival", "place", "turn"],
  grudgeRespect: ["rival", "place"],
  /** The Steward hands back gold it couldn't spend (session 23 calls it): `{n}` gold. */
  handout: ["n"],
} as const satisfies Record<string, readonly string[]>;
export type LeaderSituation = keyof typeof LEADER_SITUATIONS;

/**
 * A leader you captured (Nate's running bit): unyielding, suspicious loyalty, or outrageous flattery, in every line,
 * with the facts. `{house}`: its old House ("House Azure"); `{ruler}`: its old ruler; `{leader}`: who it reports to.
 */
export const CAPTURED_SITUATIONS = {
  /** `{turn}`: the turn it was captured (Nate's pick, Oct 10: "I've always admired your House. Since turn {turn}."). */
  firstReport: ["name", "house", "leader", "turn"],
  took: ["places", "place", "house"],
  pushedBack: ["place", "n"],
  capitalTaken: ["capital", "rival", "house"],
  finished: ["rival", "turn", "house"],
  /** Now and then, when you fight its old House. */
  needle: ["ruler", "house"],
  purseEmpty: ["house"],
  wallBuilt: ["place", "house"],
} as const satisfies Record<string, readonly string[]>;
export type CapturedSituation = keyof typeof CAPTURED_SITUATIONS;

/**
 * The screens' lines (session 22): a title card's sarcastic subline on a rival's misfortune (`{house}`: "House
 * Azure"), the game over line (`{n}` turns, `{winner}`), each award's royal audit remark, and the waiting text.
 */
export const SCREEN_SITUATIONS = {
  titleHouseOut: ["house"],
  titleCapitalFalls: ["house"],
  titleDealBroken: [],
  /** Your own House's comeback (session 23): back from a quarter of its most land to over half of it. */
  titleComeback: [],
  overWon: ["n"],
  overLost: ["n", "winner"],
  overDraw: ["n"],
  awardMilitary: [],
  awardCulture: [],
  awardBuilder: [],
  awardSpymaster: [],
  awardDiplomat: [],
  awardWall: [],
  awardKingslayer: [],
  awardFortune: [],
  awardQuartermaster: [],
  awardOathbreaker: [],
  awardSurvivor: [],
  waitingBots: [],
  waitingOthers: [],
} as const satisfies Record<string, readonly string[]>;
export type ScreenSituation = keyof typeof SCREEN_SITUATIONS;

export type Vars = Record<string, string | number>;

const Versions = z.array(z.string().min(2)).min(1);

/** Placeholders a line uses: `{place}` and the like. */
export const placeholders = (line: string): string[] => [...line.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!);

/** Every line in a group of situations may use only its situation's placeholders. */
function checked<K extends string>(allowed: Record<K, readonly string[]>, required: boolean) {
  const shape = Object.fromEntries(Object.keys(allowed).map((k) => [k, required ? Versions : Versions.optional()])) as Record<K, typeof Versions>;
  return z.object(shape).strict().superRefine((group, ctx) => {
    for (const [k, versions] of Object.entries(group) as [K, string[] | undefined][])
      for (const line of versions ?? [])
        for (const p of placeholders(line)) if (!allowed[k].includes(p)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [k], message: `"{${p}}" isn't one of ${k}'s placeholders (${allowed[k].join(", ") || "none"}): ${line}` });
  });
}

const Count = z.number().int().min(0);
export const Lines = z.object({
  /** How much your leaders say (session 22): not every turn, and the big moments first. */
  limits: z
    .object({
      /** At most this many lines from one leader in a turn, and from all your leaders in one report. */
      perLeaderPerTurn: Count,
      perReport: Count,
      /** Your Leader judges one of your moves at most once in this many turns, and not while you hold this few territories or fewer. */
      judgeEvery: Count,
      judgeQuietAt: Count,
      /** A grudging compliment at most once in this many turns. */
      complimentEvery: Count,
      /** A leader grumbles about its empty purse at most once in this many turns. */
      purseEvery: Count,
      /** A warning about your capital at most once in this many turns, for a rival army of at least `threatMin` within `threatSteps` of its province. */
      threatEvery: Count,
      threatSteps: Count,
      threatMin: Count,
      /** Gold left unspent (at least this much) while your land was taken: your Leader says so. */
      goldIdle: Count,
      /** A grudge comes up at least this many turns after it started, and again at most once in `grudgeEvery`. */
      grudgeAfter: Count,
      grudgeEvery: Count,
      /** A captured leader needles its old House at most once in this many turns. */
      needleEvery: Count,
    })
    .strict(),
  /**
   * Situations Nate picked his versions for (Oct 10, `docs/voice/nate-picks-oct10.md`), as paths like
   * "leaders.conqueror.capitalLost": the library's three-version minimum doesn't apply to them.
   */
  picked: z.array(z.string()).default([]),
  /** Each personality's own lines. */
  bots: z.object(Object.fromEntries(VOICES.map((v) => [v, checked(BOT_SITUATIONS, true)])) as Record<VoiceId, ReturnType<typeof checked<BotSituation>>>).strict(),
  /** The shared reasons: `plain` for everyone, and a personality's own versions of some of them. */
  reasons: z
    .object({
      plain: checked(REASONS, true),
      voiced: z.object(Object.fromEntries(VOICES.map((v) => [v, checked(REASONS, false)])) as Record<VoiceId, ReturnType<typeof checked<ReasonKey>>>).strict(),
    })
    .strict(),
  /** Your leaders' lines, by voice (a voice can leave a situation out: that leader says nothing then). */
  leaders: z.object(Object.fromEntries(LEADER_VOICES.map((v) => [v, checked(LEADER_SITUATIONS, false).optional()])) as unknown as Record<LeaderVoice, z.ZodOptional<ReturnType<typeof checked<LeaderSituation>>>>).strict(),
  /** A captured leader's lines (whatever its personality: the loyalty is the voice). */
  captured: checked(CAPTURED_SITUATIONS, true),
  screens: checked(SCREEN_SITUATIONS, true),
});
export type Lines = z.infer<typeof Lines>;

export const lines: Lines = Lines.parse(linesJson);

// ---------- Picking and filling ----------

/** A 32-bit hash of a string (FNV-1a). */
export function hashLine(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // A finaliser, so neighbouring turns don't pick neighbouring versions.
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return h >>> 0;
}

/**
 * Who's speaking, and when: the seed for which version is said. `game` is the game's public id (never the dice
 * seed), `who` the speaker (a player, or a leader's key), `voice` its personality (null: the plain voice).
 */
export interface Speaker {
  game: string;
  turn: number;
  who: string;
  voice: VoiceId | null;
}

/** One of `versions`, picked by the seed: the same seed always picks the same one. */
export function pickVersion(versions: readonly string[], seed: string): string {
  return versions[hashLine(seed) % versions.length]!;
}

/** The line with its placeholders filled in. A placeholder with no value is left as it is (the tests look for them). */
export function fill(line: string, vars: Vars = {}): string {
  return line.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

const seedOf = (s: { game: string; turn: number; who: string }, situation: string, extra: string) => `${s.game}|${s.turn}|${s.who}|${situation}|${extra}`;

/** A personality's own line for a situation. `extra` tells apart two lines of the same situation in one turn. */
export function botLine(s: Speaker & { voice: VoiceId }, situation: BotSituation, vars: Vars = {}, extra = ""): string {
  return fill(pickVersion(lines.bots[s.voice][situation], seedOf(s, situation, extra)), vars);
}

/**
 * A shared reason, in the speaker's voice: a personality's own version if it has one, otherwise the plain line, and
 * now and then (half the time, by the seed) its turn of phrase after it. The plain voice is always the plain line.
 */
export function reasonLine(s: Speaker, key: ReasonKey, vars: Vars = {}, extra = ""): string {
  const seed = seedOf(s, key, extra);
  if (!s.voice) return fill(pickVersion(lines.reasons.plain[key], seed), vars);
  const own = lines.reasons.voiced[s.voice][key];
  if (own) return fill(pickVersion(own, seed), vars);
  const plain = fill(pickVersion(lines.reasons.plain[key], seed), vars);
  const kind = key in TAIL_OF ? TAIL_OF[key] : "noTail";
  if (!kind || hashLine(`${seed}|tail`) % 2) return plain;
  return `${plain} ${pickVersion(lines.bots[s.voice][kind], `${seed}|tail`)}`;
}

/** A leader's line for a situation, in its voice, or null if that voice has nothing for it. */
export function leaderLine(s: { game: string; turn: number; who: string; voice: LeaderVoice }, situation: LeaderSituation, vars: Vars = {}, extra = ""): string | null {
  const versions = lines.leaders[s.voice]?.[situation];
  return versions ? fill(pickVersion(versions, seedOf(s, situation, extra)), vars) : null;
}

/** A screen's line (a title card's subline, game over, an award's remark), picked by `seed` (the game's public id and what it's about). */
export function screenLine(situation: ScreenSituation, seed: string, vars: Vars = {}): string {
  return fill(pickVersion(lines.screens[situation], `${seed}|${situation}`), vars);
}

/** A captured leader's line. */
export function capturedLine(s: { game: string; turn: number; who: string }, situation: CapturedSituation, vars: Vars = {}, extra = ""): string {
  return fill(pickVersion(lines.captured[situation], seedOf(s, situation, extra)), vars);
}

/**
 * Which turn of phrase a personality may add after a reason: a yes, or nothing (offers, counteroffers, breaking a
 * deal and the rules' own refusals say their piece without one). Anything not listed reads as a no.
 */
const TAIL_OF: Partial<Record<ReasonKey, "yesTail" | null>> = {
  noBorderPeace: "yesTail",
  needArmyRunaway: "yesTail",
  needArmyIn: "yesTail",
  theirArmyBigger: "yesTail",
  capitalDoor: "yesTail",
  shieldsRunaway: "yesTail",
  peaceUntil: "yesTail",
  gladlyRunaway: "yesTail",
  gladlyStrongest: "yesTail",
  bothWant: "yesTail",
  targetWeak: "yesTail",
  mayPass: "yesTail",
  beatFoe: "yesTail",
  mutualFair: "yesTail",
  giftGladly: "yesTail",
  fairPrice: "yesTail",
  fairPricePlain: "yesTail",
  useGold: "yesTail",
  notForMe: null,
  badTerms: null,
  alreadyHave: null,
  makeBinding: null,
  counterTruce: null,
  counterWar: null,
  counterPassage: null,
  counterGold: null,
  offerRunawayWar: null,
  offerPassage: null,
  offerPassageRunaway: null,
  offerPassageBeaten: null,
  offerTruceNeeded: null,
  offerTrucePlain: null,
  offerRecruitTruce: null,
  offerBuyLand: null,
  offerSellLand: null,
  breakWin: null,
  breakCapital: null,
  breakRunaway: null,
};
