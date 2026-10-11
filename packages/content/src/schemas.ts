import { z } from "zod";

/** Specialists: one-off attachments an army can carry (max 2 per army). */
export const SpecialistType = z.enum(["cavalry", "siege", "scouts", "engineers", "healers", "rangers", "standardBearer"]);
export type SpecialistType = z.infer<typeof SpecialistType>;
export const SPECIALIST_TYPES: readonly SpecialistType[] = ["cavalry", "siege", "scouts", "engineers", "healers", "rangers", "standardBearer"] as const;

export const BuildingType = z.enum(["fort", "market", "barracks", "watchtower"]);
export type BuildingType = z.infer<typeof BuildingType>;

export const Terrain = z.enum(["plains", "forest", "hills", "mountains", "swamp"]);
export type Terrain = z.infer<typeof Terrain>;

/** normal; river (drawn along the border); pass (through a mountain range); sea (a sea lane drawn over water). */
export const BorderType = z.enum(["normal", "river", "pass", "sea"]);
export type BorderType = z.infer<typeof BorderType>;

export const TerritoryDef = z.object({
  id: z.string(),
  name: z.string(),
  province: z.string(),
  terrain: Terrain,
  /** The territory's map point (its label point on generated maps). */
  x: z.number(),
  y: z.number(),
});
export type TerritoryDef = z.infer<typeof TerritoryDef>;

// ---------- Drawing data (the painted map and the info layer use it; the engine never does) ----------

/** A closed outline or an open line as a flat list of numbers: x0, y0, x1, y1, ... (map units, 0.1 precision). */
export const Line = z.array(z.number());
export type Line = z.infer<typeof Line>;
const Point = z.object({ x: z.number(), y: z.number() });

/** Ground types for painting. The info layer never reads these. */
export const Biome = z.enum(["grass", "farmland", "forest", "hills", "rock", "snow", "swamp", "sand", "shallow", "deep"]);
export type Biome = z.infer<typeof Biome>;
/** One character per biome in the biome grid. */
export const BIOME_CODES: Record<Biome, string> = {
  grass: "g",
  farmland: "a",
  forest: "f",
  hills: "h",
  rock: "r",
  snow: "s",
  swamp: "w",
  sand: "d",
  shallow: "o",
  deep: "O",
};

export const DecorationKind = z.enum(["tree-conifer", "tree-broadleaf", "peak", "hill", "village", "town"]);
export type DecorationKind = z.infer<typeof DecorationKind>;

export const MapGeometry = z.object({
  width: z.number(),
  height: z.number(),
  /**
   * Fine-grained ground for the painted map: a grid of `cols` x `rows` squares, each `cellSize` map units wide,
   * stored row by row as one character per square (see BIOME_CODES). Square (c, r) covers x from c*cellSize, y from r*cellSize.
   */
  biome: z.object({ cellSize: z.number(), cols: z.number().int(), rows: z.number().int(), data: z.string() }),
  /**
   * Height map for relief lighting (hill shading, mountain shadows, coastal depth), on the same grid as `biome`.
   * `data` is base64 of one byte (0–255) per square, row by row. Squares at or below `seaLevel` are water;
   * lower means deeper. Rivers are carved in, so they run downhill.
   */
  heightMap: z.object({ cellSize: z.number(), cols: z.number().int(), rows: z.number().int(), seaLevel: z.number().int(), data: z.string() }),
  /** Where each province's name goes: a gentle line through the province's long axis, to curve the name along. */
  provinceLabels: z.array(z.object({ id: z.string(), path: Line })),
  territories: z.array(
    z.object({
      id: z.string(),
      /** Outline rings. Draw with the even-odd rule (a ring inside another is a hole, such as a lake). */
      rings: z.array(Line),
      /** Where the banner goes, and how much clear room it has around it (radius, map units). */
      label: z.object({ x: z.number(), y: z.number(), r: z.number() }),
      /** Where a building sprite sits. */
      site: Point,
      /** Where the castle sits, on territories that can be a capital. */
      castle: Point.optional(),
    }),
  ),
  /** Seas and lakes. Water is never a territory. */
  water: z.array(z.object({ id: z.string(), name: z.string(), kind: z.enum(["sea", "lake"]), rings: z.array(Line), label: Point })),
  /** Impassable mountain ranges. Each is crossed by one or more passes. */
  mountains: z.array(z.object({ id: z.string(), name: z.string(), rings: z.array(Line), label: Point })),
  /** Where each pass crosses its range (the gap where the two territories touch). */
  passes: z.array(z.object({ a: z.string(), b: z.string(), range: z.string(), x: z.number(), y: z.number() })),
  /** Rivers run along territory borders, from high ground down to a sea or lake. */
  rivers: z.array(z.object({ id: z.string(), name: z.string(), path: Line })),
  /** Drawn crossings over water (the `sea` borders). */
  seaLanes: z.array(z.object({ a: z.string(), b: z.string(), path: Line })),
  /** The shared border line(s) between two territories that touch, for border glows and province edges. */
  borderLines: z.array(z.object({ a: z.string(), b: z.string(), lines: z.array(Line) })),
  /** Sprites for the painting: kind, position and which variant (1..n). Sorted top to bottom. */
  decorations: z.array(z.object({ kind: DecorationKind, x: z.number(), y: z.number(), v: z.number().int().min(1) })),
});
export type MapGeometry = z.infer<typeof MapGeometry>;

export const MapDef = z
  .object({
    id: z.string(),
    name: z.string(),
    minPlayers: z.number().int().min(2),
    maxPlayers: z.number().int(),
    /** The player counts this map plays best at (about 6–7 territories each at the top end). The lobby suggests these. */
    recommendedPlayers: z.object({ min: z.number().int(), max: z.number().int() }),
    territories: z.array(TerritoryDef).min(2),
    provinces: z.array(z.object({ id: z.string(), name: z.string(), bonus: z.number().int().min(0) })),
    borders: z.array(z.object({ a: z.string(), b: z.string(), type: BorderType.default("normal") })),
    capitalSlots: z.array(z.string()),
    /**
     * Fair capital layouts, one per player count. When there's a layout for the table size the game uses it;
     * otherwise it spreads capitals out over capitalSlots.
     */
    /**
     * Fair capital spots for each table size (sessions 19 and 20b), and the start bonus (session 23): extra troops at
     * the capital for a spot that wins under half its fair share among equal bots (by slot; at most 6).
     */
    capitalLayouts: z.array(z.object({ players: z.number().int().min(2), slots: z.array(z.string()), bonus: z.record(z.string(), z.number().int().min(1).max(6)).optional() })).optional(),
    /** How the map maker made this map, so it can be made again. */
    generator: z.object({ version: z.number().int(), seed: z.string(), attempt: z.number().int() }).optional(),
    /** Drawing data. Optional: tiny test maps have none. */
    geometry: MapGeometry.optional(),
  })
  .superRefine((m, ctx) => {
    const ids = new Set(m.territories.map((t) => t.id));
    if (ids.size !== m.territories.length) ctx.addIssue({ code: "custom", message: "duplicate territory id" });
    const provs = new Set(m.provinces.map((p) => p.id));
    for (const t of m.territories)
      if (!provs.has(t.province)) ctx.addIssue({ code: "custom", message: `unknown province ${t.province} on ${t.id}` });
    for (const b of m.borders)
      if (!ids.has(b.a) || !ids.has(b.b) || b.a === b.b)
        ctx.addIssue({ code: "custom", message: `bad border ${b.a}-${b.b}` });
    for (const c of m.capitalSlots)
      if (!ids.has(c)) ctx.addIssue({ code: "custom", message: `bad capital slot ${c}` });
    const r = m.recommendedPlayers;
    if (r.min > r.max || r.min < m.minPlayers || r.max > m.maxPlayers)
      ctx.addIssue({ code: "custom", message: "recommendedPlayers must sit inside minPlayers..maxPlayers" });
    if (m.capitalSlots.length < m.maxPlayers)
      ctx.addIssue({ code: "custom", message: "not enough capital slots for maxPlayers" });
    for (const l of m.capitalLayouts ?? [])
      if (l.slots.length !== l.players || new Set(l.slots).size !== l.players || l.slots.some((s) => !ids.has(s)) || Object.keys(l.bonus ?? {}).some((s) => !l.slots.includes(s)))
        ctx.addIssue({ code: "custom", message: `bad capital layout for ${l.players} players` });
  });
export type MapDef = z.infer<typeof MapDef>;

const perTerrain = <T extends z.ZodTypeAny>(v: T) =>
  z.object({ plains: v, forest: v, hills: v, mountains: v, swamp: v });
const perBorder = <T extends z.ZodTypeAny>(v: T) => z.object({ normal: v, river: v, pass: v, sea: v });

/** Fields every specialist has. */
const specialistBase = {
  /** Gold to hire one at your capital or a barracks. */
  cost: z.number().int().min(0),
  /** Gold per turn to keep it. */
  upkeep: z.number().int().min(0),
  /** Culture needed in the hiring province (sum over your territories there). 0 = always available. */
  cultureRequired: z.number().int().min(0),
};

/** The three Spoils marks (session 13). */
export const SpoilsMark = z.enum(["sword", "tower", "laurel"]);
export type SpoilsMark = z.infer<typeof SpoilsMark>;

/** What a Fate mission asks (each checked from the game at the end of every turn). */
export const MissionKind = z.enum(["takeIn", "takeFrom", "spree", "cross", "hold", "noLoss", "whole", "fort", "culture"]);
export type MissionKind = z.infer<typeof MissionKind>;

const fateEventBase = {
  /** Unique id; the game's text names it. */
  id: z.string(),
  /** How often it's drawn, relative to the others. */
  weight: z.number().min(0),
  tone: z.enum(["good", "bad"]),
  /** One of the few strong cards (the rest are mild). */
  strong: z.boolean().default(false),
};
/**
 * A Fate event (session 13): one effect on one territory, built only from things the game already has. Bad effects
 * are softened by culture's protection there (all-or-nothing ones are shrugged off with that chance). They never land
 * on a capital, never take a player's last territory, and at most one lands on each territory a turn.
 */
export const FateEvent = z.discriminatedUnion("effect", [
  /** The holder gains (or loses) gold. */
  z.object({ ...fateEventBase, effect: z.literal("gold"), amount: z.number().int() }),
  /** Troops join whoever holds the land (neutral land too, if `neutral`). */
  z.object({ ...fateEventBase, effect: z.literal("troops"), amount: z.number().int().min(1), neutral: z.boolean().default(false) }),
  /** Culture rises there. */
  z.object({ ...fateEventBase, effect: z.literal("culture"), amount: z.number().int().min(1) }),
  /** A building under construction there is finished at once. */
  z.object({ ...fateEventBase, effect: z.literal("finishBuilding") }),
  /** A building under construction there burns down (the gold is gone). */
  z.object({ ...fateEventBase, effect: z.literal("burnBuilding") }),
  /** A share of the troops there die (never the garrison). Only where at least `minTroops` stand. */
  z.object({ ...fateEventBase, effect: z.literal("sickness"), share: z.number().min(0).max(1), minTroops: z.number().int().min(1) }),
  /** A crossing of this kind there is closed for the whole of the next turn (everyone sees it coming). */
  z.object({ ...fateEventBase, effect: z.literal("closeBorder"), border: z.enum(["river", "pass", "sea"]) }),
  /** The Fallen's plague, at this share of the holder's troops in the province. */
  z.object({ ...fateEventBase, effect: z.literal("plague"), share: z.number().min(0).max(1) }),
  /** The Fallen's uprising (its rebels against land held by its few troops). */
  z.object({ ...fateEventBase, effect: z.literal("uprising") }),
]);
export type FateEvent = z.infer<typeof FateEvent>;

export const FateMission = z.object({
  /** Unique id; the game's text names it. */
  id: z.string(),
  kind: MissionKind,
  weight: z.number().min(0),
  /** Turns you have (the deadline is this many turns after the one you're planning when it's drawn). */
  turns: z.number().int().min(1),
  /** "spree": how many territories to take. */
  need: z.number().int().min(1).optional(),
  /** "cross": the kind of crossing to win a battle across. */
  border: z.enum(["river", "pass", "sea"]).optional(),
  reward: z.object({
    gold: z.number().int().min(0).optional(),
    troops: z.number().int().min(0).optional(),
    culture: z.number().int().min(0).optional(),
    specialist: SpecialistType.optional(),
  }),
});
export type FateMission = z.infer<typeof FateMission>;

export const Rules = z.object({
  version: z.string(),
  troops: z.object({
    cost: z.number().int().min(1),
    /** Strength of each troop when attacking / defending. */
    attack: z.number().min(0),
    defense: z.number().min(0),
  }),
  specialists: z.object({
    /** Most specialists one army (one territory's stack) can carry. */
    maxPerArmy: z.number().int().min(0),
    cavalry: z.object({ ...specialistBase, /** Territories the army can move per order. */ move: z.number().int().min(1) }),
    siege: z.object({ ...specialistBase, /** How much of a fort's bonus each siege cancels (1 = all of it). */ fortBreak: z.number().min(0) }),
    scouts: z.object({ ...specialistBase, /** Extra vision radius around the army. */ vision: z.number().int().min(0) }),
    engineers: z.object({ ...specialistBase }),
    healers: z.object({ ...specialistBase, /** Share of the army's losses prevented (each healer; capped by maxLossReduction). */ lossReduction: z.number().min(0).max(1), maxLossReduction: z.number().min(0).max(1) }),
    /** The culture ladder (session 15). Rangers: when this army attacks, these terrains defend like plains (Siege's counterpart for terrain). */
    rangers: z.object({ ...specialistBase, terrains: z.array(z.enum(["plains", "forest", "hills", "mountains", "swamp"])) }),
    /** The Standard-bearer: this army attacks this much stronger. Two in one army don't stack. */
    standardBearer: z.object({ ...specialistBase, attackBonus: z.number().min(0) }),
  }),
  buildings: z.object({
    fort: z.object({ cost: z.number().int(), buildTurns: z.number().int().min(0), defenseMult: z.number() }),
    market: z.object({ cost: z.number().int(), buildTurns: z.number().int().min(0), income: z.number() }),
    barracks: z.object({ cost: z.number().int(), buildTurns: z.number().int().min(0) }),
    watchtower: z.object({ cost: z.number().int(), buildTurns: z.number().int().min(0), vision: z.number().int() }),
  }),
  terrain: perTerrain(z.object({ defenseMult: z.number(), income: z.number().int() })),
  borders: perBorder(z.object({ attackMult: z.number() })),
  combat: z.object({
    /** Share of the result that is random (0 = fully deterministic). Default 0.3. */
    luck: z.number().min(0).max(1),
    /** Each point of attack strength kills this many defenders on average. */
    attackKillRate: z.number(),
    /** Each point of defense strength kills this many attackers on average. */
    defenseKillRate: z.number(),
  }),
  culture: z.object({
    /** Highest culture a territory can reach. */
    max: z.number().int().min(0),
    /** Gold to raise culture from level i to i+1 (index i). Length must be >= max. */
    investCost: z.array(z.number().int().min(0)),
    /** Extra gold per turn per culture level on a territory you hold. */
    incomePerLevel: z.number().min(0),
    /** Extra province bonus per point of average culture across a fully held province. */
    provinceBonusPerLevel: z.number().min(0),
    /** Share of a bad effect blocked per culture level (unrest now; events and uprisings later). */
    protectionPerLevel: z.number().min(0).max(1),
    maxProtection: z.number().min(0).max(1),
    /** "Loyal land": defense bonus per culture level on that territory (0.05 = +5% a level). Multiplies with terrain and forts. */
    defensePerLevel: z.number().min(0),
    /**
     * Share of a territory's culture that survives when the land changes hands, by conquest or a trade (rounded down;
     * session 16, Nate: 0, all of it is lost). Buildings always stay. Land rebels take always loses it.
     */
    keptOnCapture: z.number().min(0).max(1),
  }),
  /**
   * Walls (session 20b, Nate's idea; design additions §16): the reward at the end of the culture and building path.
   * A territory with culture `culture` (and a fort, if `needsFort`) is walled from the end of the turn its last piece
   * is finished. Walled territories of one House that touch (not across water) form one wall. When one is attacked,
   * every other territory of its wall within `reach` steps along the wall (null: the whole wall) lends its spare troops
   * (all but the garrison; half of them unless `lendAll`) to the defence, each to one battle a turn if
   * `oneBattleATurn`. Defence only. Missing (an older game's rules) or `on: false`: no walls.
   */
  walls: z
    .object({
      on: z.boolean(),
      culture: z.number().int().min(0),
      needsFort: z.boolean(),
      reach: z.number().int().min(1).nullable(),
      lendAll: z.boolean(),
      oneBattleATurn: z.boolean(),
    })
    .optional(),
  economy: z.object({
    startGold: z.number().int(),
    capitalIncome: z.number().int(),
    /** Upkeep = round(rate * max(0, territories - free) ^ exponent) */
    upkeepFreeTerritories: z.number().int(),
    upkeepRate: z.number(),
    upkeepExponent: z.number(),
  }),
  setup: z.object({
    startTroops: z.number().int().min(1),
    neutralTroops: z.number().int().min(0),
    minGarrison: z.number().int().min(0),
  }),
  leader: z.object({
    strengthBonus: z.number(),
    seizeInitiativeCooldown: z.number().int().min(1),
    lieInWaitCooldown: z.number().int().min(1),
  }),
  /**
   * Leaders (session 18, replacing session 12's generals and session 15's Govern): your Leader (military) and your
   * Steward (culture, buildings, the economy) from the start, and the ones you capture, up to `maxOfKind` of each kind
   * (your own included; one more while you choose who goes). Each has a purse it's paid into every turn as income
   * comes in: a share of your income or an exact amount (at most `maxGoldBudget`). Your Steward starts on "Run the
   * realm" with `stewardShare` of your income. `shareChips`: the shares the budget control offers.
   */
  leaders: z.object({
    maxOfKind: z.number().int().min(1),
    stewardShare: z.number().min(0).max(1),
    /**
     * Session 19: on a crowded table (at most `crowdedTerritories` territories a player: Embervale at 4, Greatmarch at
     * 8–10) your Steward starts on this share instead: buildings pay back too slowly there for 20% (the sims).
     */
    stewardShareCrowded: z.number().min(0).max(1).default(0.1),
    crowdedTerritories: z.number().min(0).default(12),
    shareChips: z.array(z.number().min(0).max(1)).min(1),
    maxGoldBudget: z.number().int().min(0),
    nameMaxLength: z.number().int().min(1),
    /**
     * Session 20 (Nate): a rival is down to a handful of territories, and a leader with a military command (and every
     * Marshal) goes and ends them, when it holds at most `territories` territories, or at most `share` of ours (as far as
     * we know), and we hold at least three times its land.
     */
    finish: z.object({ territories: z.number().int().min(0), share: z.number().min(0).max(1) }).default({ territories: 6, share: 0.1 }),
    /** Session 20 (Nate): "Clean up" is offered once you hold this share of the map; Run the military cleans up unasked from there. */
    cleanUpShare: z.number().min(0).max(1).default(0.75),
  }),
  /**
   * The Fallen (session 12): knocked-out players earn Influence each turn (base, plus a little more for each other
   * Fallen player) and spend it, alone or pooled, on capped world events aimed at a living player's land. Spending
   * more than the cost makes the event stronger, up to `maxStrength` times. Each event kind then rests for its
   * cooldown (turns, for everyone).
   */
  fallen: z.object({
    /** Influence a player has the moment they're knocked out (session 19, Nate: the Fallen act from their first turn out). */
    startInfluence: z.number().min(0).default(0),
    influenceBase: z.number().min(0),
    influencePerOtherFallen: z.number().min(0),
    maxStrength: z.number().min(1),
    events: z.object({
      /** A share of the troops in the target's land in one province die (never below the garrison; capitals spared). */
      plague: z.object({ cost: z.number().int().min(1), cooldown: z.number().int().min(0), share: z.number().min(0).max(1) }),
      /** One border is closed for the turn: no moves or attacks across it either way. */
      storm: z.object({ cost: z.number().int().min(1), cooldown: z.number().int().min(0) }),
      /** A weakly held territory (at most `maxTroops`) rises: `rebels` against its troops; if they're more, it turns neutral, held by the rebels. */
      uprising: z.object({ cost: z.number().int().min(1), cooldown: z.number().int().min(0), maxTroops: z.number().int().min(1), rebels: z.number().int().min(1) }),
      /** A neutral army of `troops` appears in neutral land next to the target. */
      mercenaries: z.object({ cost: z.number().int().min(1), cooldown: z.number().int().min(0), troops: z.number().int().min(1) }),
      /** The target player's income is cut by `share` this turn. */
      famine: z.object({ cost: z.number().int().min(1), cooldown: z.number().int().min(0), share: z.number().min(0).max(1) }),
    }),
  }),
  /**
   * The Spoils deck (session 13): one card at the end of a turn you took land (at most one a turn), each with a mark.
   * Three alike, or one of each, turn in for a windfall that never grows. At `handLimit` cards you must turn one in.
   */
  spoils: z.object({
    handLimit: z.number().int().min(3),
    /** How likely each mark is (relative). */
    marks: z.object({ sword: z.number().min(0), tower: z.number().min(0), laurel: z.number().min(0) }),
    /** Three Swords (session 16): troops spread over your most threatened territories, and gold. */
    sword: z.object({ troops: z.number().int().min(0), gold: z.number().int().min(0) }),
    /** Three Towers: a finished fort on land you choose, a small garrison there, and gold. */
    tower: z.object({ garrison: z.number().int().min(0), gold: z.number().int().min(0) }),
    /** Three Laurels: culture on up to `territories` of your territories in the province you choose, and gold. */
    laurel: z.object({ culture: z.number().int().min(1), territories: z.number().int().min(1), gold: z.number().int().min(0) }),
    /** One of each (the best set, session 16): troops spread over your front, a finished building of your choice on land you choose, and gold. */
    mixed: z.object({ troops: z.number().int().min(0), gold: z.number().int().min(0) }),
  }),
  /**
   * The Fate deck (session 13): everyone draws one card a turn, as planning starts. An event (somewhere on the map)
   * or, `missionShare` of the time, a mission for the drawer (at most `maxMissions` open; another becomes an event).
   */
  fate: z.object({
    /** The first draw comes at the end of this turn (3: the opening turns stay quiet; Nate, Oct 6). Missions and events both wait. */
    firstDrawTurn: z.number().int().min(1),
    missionShare: z.number().min(0).max(1),
    maxMissions: z.number().int().min(0),
    events: z.array(FateEvent).min(1),
    missions: z.array(FateMission).min(1),
  }),
  /**
   * Diplomacy (session 14, design additions §2): preset deals between two players. Both sides confirm in the same
   * planning phase and the deal starts as the turn resolves. Every deal expires. A handshake deal is free and can be
   * broken (Oathbreaker: a public mark, a fine and unrest, scaled by the deal's size); a binding pact costs gold up
   * front and the game blocks attacks across it. Missing here (an old save's rules): no deals.
   */
  diplomacy: z.object({
    /** Every deal ends after at most this many turns. */
    maxTurns: z.number().int().min(1),
    truce: z.object({ minTurns: z.number().int().min(1), maxTurns: z.number().int().min(1), defaultTurns: z.number().int().min(1) }),
    /** Gold each turn for at most `maxPerTurnTurns` turns; at most `maxLand` territories in one deal. */
    trade: z.object({ maxPerTurnTurns: z.number().int().min(1), maxLand: z.number().int().min(0) }),
    war: z.object({ minTurns: z.number().int().min(1), maxTurns: z.number().int().min(1), defaultTurns: z.number().int().min(1) }),
    /** Right of passage: how long, and how many of the partner's territories one move may pass through (session 15). */
    passage: z.object({ minTurns: z.number().int().min(1), maxTurns: z.number().int().min(1), defaultTurns: z.number().int().min(1), maxThrough: z.number().int().min(1) }),
    /**
     * A deal's size (how much it covers), which scales the Oathbreaker penalty and a binding pact's price: each
     * territory a truce covers, each turn it runs, each gold traded, each territory of land traded, plus a joint war's
     * or passage's own weight, and "until X is knocked out" counts as big.
     */
    size: z.object({
      perTerritory: z.number().min(0),
      perTurn: z.number().min(0),
      perGold: z.number().min(0),
      perLand: z.number().min(0),
      war: z.number().min(0),
      passage: z.number().min(0),
      untilKnockedOut: z.number().min(0),
    }),
    /** Breaking a handshake deal: the public mark's length, and the fine and unrest (troops) per point of size. */
    oathbreaker: z.object({ markTurns: z.number().int().min(1), fineBase: z.number().min(0), finePerSize: z.number().min(0), unrestPerSize: z.number().min(0) }),
    /** A binding pact's price for each side: base + perSize x size. */
    binding: z.object({ costBase: z.number().min(0), costPerSize: z.number().min(0) }),
    /**
     * The bots' judgement (packages/bots, diplomacy.ts). Trust starts at `trustStart` (0 to 100) and moves with
     * what a player did; a bot proposes at most `offersPerTurn` deals a turn, and the human gets at most
     * `offersToYouPerTurn` offers a turn from all the bots together.
     */
    bots: z.object({
      offersPerTurn: z.number().int().min(0),
      offersToYouPerTurn: z.number().int().min(0),
      trustStart: z.number().min(0).max(100),
      trustBroken: z.number().min(0),
      trustWarIdle: z.number().min(0),
      trustKept: z.number().min(0),
      trustOathbreaker: z.number().min(0),
      /** Below this trust a bot won't take a handshake deal (a binding pact still works: the game enforces it). */
      trustMin: z.number().min(0).max(100),
      /** How much better than neutral a deal must look before a bot takes it, and how close counts as "close" for a counter. */
      acceptMargin: z.number(),
      counterMargin: z.number().min(0),
      /** The Captain breaks a handshake deal only when the gain is at least this many times the penalty. */
      breakGain: z.number().min(1),
    }),
  }),
  vision: z.object({ base: z.number().int().min(0) }),
  /**
   * Spies (session 15, design additions §8). A spy is its own piece (not part of an army), hired at your capital or a
   * barracks. It travels `travel` territories a turn; in a province no single player holds whole it lifts the fog
   * `sight` territories around it; entering a province one player holds whole is an attempt to infiltrate it. At most
   * `maxPerProvince` spies a side count in one province. Spy against spy: each attacking spy beyond the first cancels
   * one defender; what's left decides (0 infiltrates, 1 blocked, 2 killed, 3 fooled).
   */
  spies: z.object({
    cost: z.number().int().min(0),
    /** Gold a turn while a spy is travelling or inside land its owner does not hold (session 16). */
    upkeep: z.number().int().min(0),
    /** Gold a turn while it stays in its owner's own land: at home, or guarding a province (session 16: free). */
    upkeepAtHome: z.number().int().min(0),
    /** How many spies one player may have at once. */
    max: z.number().int().min(0),
    travel: z.number().int().min(1),
    sight: z.number().int().min(0),
    maxPerProvince: z.number().int().min(1),
    /** A fooled spy's false picture: each army's troops off by up to this share (after moving them around), and the chance each territory's culture is off by one. */
    fooled: z.object({ troopJitter: z.number().min(0).max(1), cultureChance: z.number().min(0).max(1) }),
    /** The Captain: at most this many spies, not before this turn, and only with this much gold left over for troops. */
    bots: z.object({ max: z.number().int().min(0), fromTurn: z.number().int().min(1), reserve: z.number().int().min(0) }),
  }),
  /**
   * Orders along a path (session 16; session 20, Nate): the full sweep clears a band about `sweepWidth` territories
   * wide between the two points (every territory within a step or so of a shortest way there), and branches out
   * further where that completes a province.
   */
  path: z.object({ sweepWidth: z.number().int().min(1) }).default({ sweepWidth: 3 }),
  game: z.object({
    /** Order-phase timer. The engine only stores it; the server runs the clock. */
    turnTimerSecondsDefault: z.number().int().min(1),
    turnTimerSecondsMin: z.number().int().min(1),
    turnTimerSecondsMax: z.number().int().min(1),
    /** Classic games stop here no matter what (highest score wins). */
    maxTurnsHard: z.number().int(),
    /** Turn limit used by conquest mode when the host doesn't pick one. */
    conquestTurnLimitDefault: z.number().int().min(1),
    /** The lobby suggests conquest mode (a turn limit) from this many players up; classic below. */
    conquestSuggestedFromPlayers: z.number().int().min(2),
  }),
}).superRefine((r, ctx) => {
  if (r.culture.investCost.length < r.culture.max)
    ctx.addIssue({ code: "custom", message: "culture.investCost needs one entry per level up to culture.max" });
  if (r.game.turnTimerSecondsDefault < r.game.turnTimerSecondsMin || r.game.turnTimerSecondsDefault > r.game.turnTimerSecondsMax)
    ctx.addIssue({ code: "custom", message: "turn timer default must sit between min and max" });
  for (const list of [r.fate.events, r.fate.missions])
    if (new Set(list.map((x) => x.id)).size !== list.length) ctx.addIssue({ code: "custom", message: "Fate card ids must be unique" });
  for (const m of r.fate.missions) {
    if (m.kind === "spree" && !m.need) ctx.addIssue({ code: "custom", message: `mission ${m.id} needs "need"` });
    if (m.kind === "cross" && !m.border) ctx.addIssue({ code: "custom", message: `mission ${m.id} needs "border"` });
  }
});
export type Rules = z.infer<typeof Rules>;

/** Names for leaders (session 18): one list for military Leaders, one for Stewards. */
export const LeaderNames = z.object({
  leaders: z.array(z.string().min(1)).min(10),
  stewards: z.array(z.string().min(1)).min(10),
});
export type LeaderNames = z.infer<typeof LeaderNames>;
