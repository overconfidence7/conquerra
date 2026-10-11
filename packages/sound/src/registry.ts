import { z } from "zod";
import creditsJson from "../data/credits.json";
import registryJson from "../data/registry.json";

/**
 * The game's sounds (session 24): where each one came from (credits.json), how it's made (recipe.json), and what the
 * importer wrote (registry.json: one entry per file, with its size, loudness and sources). The game reads the
 * registry; the tests check every file has a source with an allowed license.
 */

/**
 * Licenses a sound may carry: CC0 / public domain (best), or CC-BY (with credit in Settings). Never "non-commercial",
 * "personal use only", "editorial", or a license we can't name.
 */
export const ALLOWED_LICENSES = ["CC0-1.0", "PD", "CC-BY-3.0", "CC-BY-4.0"] as const;
export type License = (typeof ALLOWED_LICENSES)[number];
/** Does this license need the author's name on screen? */
export const needsCredit = (l: string) => l.startsWith("CC-BY");

export const CreditSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  author: z.string().min(1),
  url: z.string().url(),
  license: z.string().min(1),
  downloaded: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Where its files sit in sound/incoming (not in git). */
  folder: z.string().min(1),
  /** A copy of the license text in docs/sound/licenses (packs that ship their own). */
  licenseFile: z.string().optional(),
});
export type Credit = z.infer<typeof CreditSchema>;

export const KINDS = ["sfx", "music", "ambience"] as const;
export type SoundKind = (typeof KINDS)[number];
export const RegistryEntrySchema = z.object({
  /** sfx-battle-1, music-planning */
  name: z.string(),
  cue: z.string(),
  kind: z.enum(KINDS),
  /** Path under the web app's public folder: sound/sfx-battle-1.mp3 */
  file: z.string(),
  bytes: z.number().int().positive(),
  durationMs: z.number().int().positive(),
  /** Loudness after the import: the loudest 400 ms (sfx) or the whole file (music, ambience), in LUFS. */
  lufs: z.number(),
  /** True peak, dBTP. */
  peak: z.number(),
  /** Credit ids this file was made from. */
  sources: z.array(z.string()).min(1),
});
export type RegistryEntry = z.infer<typeof RegistryEntrySchema>;
export const RegistrySchema = z.object({ target: z.record(z.number()), files: z.array(RegistryEntrySchema) });

export const CREDITS: readonly Credit[] = z.object({ sources: z.array(CreditSchema) }).parse(creditsJson).sources;
export const CREDIT_BY_ID = new Map(CREDITS.map((c) => [c.id, c]));
export const REGISTRY = RegistrySchema.parse(registryJson);

/** The file name a cue's variant gets: sfx-battle-1, music-planning (music and ambience have one file, no number). */
export function fileName(kind: SoundKind, cue: string, variant: number, variants: number): string {
  const prefix = kind === "ambience" ? "amb" : kind;
  return kind === "sfx" || variants > 1 ? `${prefix}-${cue}-${variant + 1}` : `${prefix}-${cue}`;
}

/**
 * What's wrong with a file's sources, if anything: a source with no credits entry, or a license that isn't allowed.
 * (The tests run this over every registered file.)
 */
export function licenseProblems(entry: Pick<RegistryEntry, "name" | "sources">, credits: ReadonlyMap<string, Pick<Credit, "license">> = CREDIT_BY_ID): string[] {
  const out: string[] = [];
  for (const s of entry.sources) {
    const c = credits.get(s);
    if (!c) out.push(`${entry.name}: source "${s}" has no credits entry (no license on record)`);
    else if (!(ALLOWED_LICENSES as readonly string[]).includes(c.license)) out.push(`${entry.name}: source "${s}" has license "${c.license}", which isn't allowed`);
  }
  return out;
}

/** The packs to list under Settings → Credits: every source a registered file uses, CC-BY ones first. */
export function creditsInUse(files: readonly Pick<RegistryEntry, "sources">[] = REGISTRY.files): Credit[] {
  const ids = new Set(files.flatMap((f) => f.sources));
  return CREDITS.filter((c) => ids.has(c.id)).sort((a, b) => Number(needsCredit(b.license)) - Number(needsCredit(a.license)) || a.author.localeCompare(b.author) || a.title.localeCompare(b.title));
}
