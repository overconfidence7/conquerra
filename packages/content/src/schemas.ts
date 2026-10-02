import { z } from "zod";

/** Specialists: one-off attachments an army can carry (max 2 per army). */
export const SpecialistType = z.enum(["cavalry", "siege", "scouts", "engineers", "healers"]);
export type SpecialistType = z.infer<typeof SpecialistType>;
export const SPECIALIST_TYPES: readonly SpecialistType[] = ["cavalry", "siege", "scouts", "engineers", "healers"] as const;

export const BuildingType = z.enum(["fort", "market", "barracks", "watchtower"]);
export type BuildingType = z.infer<typeof BuildingType>;

export const Terrain = z.enum(["plains", "forest", "hills", "mountains", "swamp"]);
export type Terrain = z.infer<typeof Terrain>;

export const BorderType = z.enum(["normal", "river", "pass"]);
export type BorderType = z.infer<typeof BorderType>;

export const TerritoryDef = z.object({
  id: z.string(),
  name: z.string(),
  province: z.string(),
  terrain: Terrain,
  x: z.number(),
  y: z.number(),
});
export type TerritoryDef = z.infer<typeof TerritoryDef>;

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
  });
export type MapDef = z.infer<typeof MapDef>;

const perTerrain = <T extends z.ZodTypeAny>(v: T) =>
  z.object({ plains: v, forest: v, hills: v, mountains: v, swamp: v });
const perBorder = <T extends z.ZodTypeAny>(v: T) => z.object({ normal: v, river: v, pass: v });

/** Fields every specialist has. */
const specialistBase = {
  /** Gold to hire one at your capital or a barracks. */
  cost: z.number().int().min(0),
  /** Gold per turn to keep it. */
  upkeep: z.number().int().min(0),
  /** Culture needed in the hiring province (sum over your territories there). 0 = always available. */
  cultureRequired: z.number().int().min(0),
};

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
  }),
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
  vision: z.object({ base: z.number().int().min(0) }),
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
});
export type Rules = z.infer<typeof Rules>;
