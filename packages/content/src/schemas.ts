import { z } from "zod";

export const UnitType = z.enum(["infantry", "cavalry", "siege"]);
export type UnitType = z.infer<typeof UnitType>;
export const UNIT_TYPES: readonly UnitType[] = ["infantry", "cavalry", "siege"] as const;

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
    if (m.capitalSlots.length < m.maxPlayers)
      ctx.addIssue({ code: "custom", message: "not enough capital slots for maxPlayers" });
  });
export type MapDef = z.infer<typeof MapDef>;

const UnitStats = z.object({
  cost: z.number().int().min(1),
  attack: z.number().min(0),
  defense: z.number().min(0),
  /** Multiplier applied to this unit's attack when attacking into these terrains. */
  attackTerrain: z.record(Terrain, z.number()).default({}) as z.ZodType<Partial<Record<Terrain, number>>>,
  /** How much each unit of this type reduces an enemy fort's multiplier. */
  fortBreak: z.number().min(0).default(0),
  /** Max territories moved per order (cavalry = 2). */
  move: z.number().int().min(1).default(1),
});

const perUnit = <T extends z.ZodTypeAny>(v: T) => z.object({ infantry: v, cavalry: v, siege: v });
const perBuilding = <T extends z.ZodTypeAny>(v: T) => z.object({ fort: v, market: v, barracks: v, watchtower: v });
const perTerrain = <T extends z.ZodTypeAny>(v: T) =>
  z.object({ plains: v, forest: v, hills: v, mountains: v, swamp: v });
const perBorder = <T extends z.ZodTypeAny>(v: T) => z.object({ normal: v, river: v, pass: v });

export const Rules = z.object({
  version: z.string(),
  units: perUnit(UnitStats),
  buildings: perBuilding(
    z.object({
      cost: z.number().int().min(0),
      defenseMult: z.number().default(1),
      income: z.number().default(0),
      vision: z.number().int().default(0),
      allowsRecruit: z.boolean().default(false),
    }),
  ),
  terrain: perTerrain(z.object({ defenseMult: z.number(), income: z.number().int() })),
  borders: perBorder(z.object({ attackMult: z.number() })),
  combat: z.object({
    /** Share of the result that is random (0 = fully deterministic). Default 0.3. */
    luck: z.number().min(0).max(1),
    /** Each point of attack strength kills this many defenders on average. */
    attackKillRate: z.number(),
    /** Each point of defense strength kills this many attackers on average. */
    defenseKillRate: z.number(),
    /** Order units are lost in, cheapest first. */
    casualtyOrder: z.array(UnitType),
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
    startUnits: perUnit(z.number().int().min(0)),
    neutralUnits: z.number().int(),
    minGarrison: z.number().int().min(0),
  }),
  leader: z.object({
    strengthBonus: z.number(),
    raiseCost: z.number().int(),
    seizeInitiativeCooldown: z.number().int().min(1),
    lieInWaitCooldown: z.number().int().min(1),
  }),
  vision: z.object({ base: z.number().int().min(0) }),
  limits: z.object({ maxTurnsHard: z.number().int() }),
});
export type Rules = z.infer<typeof Rules>;
