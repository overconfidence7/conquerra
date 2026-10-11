/**
 * The sound import (session 24): turns the packs in `sound/incoming/` into the game's sound files plus the registry.
 *   - each variant in data/recipe.json is a mix of layers, each cut from a source file, placed in time, with its own
 *     gain, pitch and fades
 *   - leading and trailing silence trimmed (sound effects; music and ambience keep theirs so they loop cleanly)
 *   - loudness normalised to one target per kind (LOUDNESS below), peaks held under -1 dBTP by a limiter
 *   - written as MP3 (every target browser plays it: Android Chrome, iOS Safari, desktop), named by cue
 *     (sfx-battle-1.mp3, music-planning.mp3) in apps/web/public/sound/, and listed in data/registry.json with its size,
 *     loudness and sources (so every file carries its license)
 * Node only (needs ffmpeg on the PATH). Run it with `pnpm sound:import`.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import type { z } from "zod";
import { type Recipe, type LayerSchema, type VariantSchema } from "./recipe";
import { type Credit, fileName, type RegistryEntry, type SoundKind } from "./registry";

type Layer = z.infer<typeof LayerSchema>;
type Variant = z.infer<typeof VariantSchema>;

/**
 * The loudness targets, in LUFS. Sound effects: their loudest 400 ms (EBU R128 momentary loudness; a short sound is
 * judged by its loudest moment, the way the ear hears it). Music and ambience: the whole file (integrated). Music sits
 * 2 LU under the effects and the in-game volumes put it lower still; ambience is a bed, well under both.
 */
export const LOUDNESS: Record<SoundKind, number> = { sfx: -16, music: -18, ambience: -24 };
/** True peak ceiling, dBTP (the limiter's ceiling is a little under it, for the MP3 encoder's overshoot). */
export const PEAK_CEILING = -1;
/** How each kind is encoded: effects mono (they're placed on the map in code), music stereo; all 44.1 kHz MP3. */
export const ENCODING: Record<SoundKind, string[]> = {
  sfx: ["-ac", "1", "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "64k"],
  music: ["-ac", "2", "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "80k"],
  ambience: ["-ac", "1", "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "48k"],
};
const RATE = 44100;
const AUDIO_TYPES = new Set([".wav", ".ogg", ".mp3", ".flac", ".m4a", ".aiff", ".aif"]);

function ffmpeg(args: string[]): string {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-nostdin", ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw new Error(`ffmpeg didn't run (is it installed and on the PATH?): ${r.error.message}`);
  if (r.status !== 0) throw new Error(`ffmpeg failed:\n${r.stderr.split("\n").slice(-12).join("\n")}`);
  return r.stderr;
}

export function durationOf(path: string): number {
  const r = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path], { encoding: "utf8" });
  const d = Number.parseFloat(r.stdout);
  if (!Number.isFinite(d)) throw new Error(`Couldn't read the length of ${path}`);
  return d;
}

export interface Loudness {
  /** Integrated loudness of the whole file, LUFS (-70 when too short to gate). */
  integrated: number;
  /** The loudest momentary (400 ms) reading, LUFS. */
  maxMomentary: number;
  /** True peak, dBTP. */
  truePeak: number;
}

/** Reads ffmpeg's ebur128 log: every momentary reading ("M: -20.1") and the summary's "I:" and "Peak:". */
export function parseLoudness(log: string): Loudness {
  const ms = [...log.matchAll(/\bM:\s*(-?[\d.]+|-inf)/g)].map((m) => (m[1] === "-inf" ? -Infinity : Number(m[1])));
  const summary = log.slice(log.lastIndexOf("Summary:"));
  const i = /\bI:\s*(-?[\d.]+)\s*LUFS/.exec(summary);
  const p = /\bPeak:\s*(-?[\d.]+|-inf)\s*dBFS/.exec(summary);
  return {
    integrated: i ? Number(i[1]) : -70,
    maxMomentary: ms.length ? Math.max(...ms) : -70,
    truePeak: p ? (p[1] === "-inf" ? -Infinity : Number(p[1])) : 0,
  };
}

/** Measures a file. Short sounds are padded with silence to 0.6 s so the momentary meter has a full window. */
export function measure(path: string): Loudness {
  return parseLoudness(ffmpeg(["-nostats", "-i", path, "-af", "apad=whole_dur=0.6,ebur128=peak=true", "-f", "null", "-"]));
}

/** The loudness the target is judged by, for a kind. */
export const judged = (kind: SoundKind, l: Loudness) => (kind === "sfx" ? l.maxMomentary : l.integrated);

/** How far to turn a file up or down (dB) to meet its target. */
export function gainFor(kind: SoundKind, l: Loudness): number {
  const now = judged(kind, l);
  if (!Number.isFinite(now) || now <= -69) throw new Error("silent file");
  return Math.round((LOUDNESS[kind] - now) * 100) / 100;
}

/** One layer's length in the mix, in seconds (after its pitch change). */
export function layerLength(l: Layer, sourceDuration: number): number {
  const taken = Math.min(l.duration ?? Infinity, sourceDuration - (l.start ?? 0));
  return taken / (l.rate ?? 1);
}

/**
 * The ffmpeg arguments that mix one variant into a float WAV at `out`. `paths[i]` is layer i's source file and
 * `durations[i]` its full length. Pure, so the tests can read it.
 */
export function mixArgs(v: Variant, paths: readonly string[], durations: readonly number[], out: string, trim: boolean): string[] {
  const args: string[] = [];
  const chains: string[] = [];
  let total = 0;
  v.layers.forEach((l, i) => {
    if (l.start) args.push("-ss", String(l.start));
    if (l.duration) args.push("-t", String(l.duration));
    args.push("-i", paths[i]!);
    const len = layerLength(l, durations[i]!);
    total = Math.max(total, (l.at ?? 0) + len);
    const f = [`aresample=${RATE}`, "aformat=sample_fmts=fltp:channel_layouts=stereo"];
    if (l.rate && l.rate !== 1) f.push(`asetrate=${Math.round(RATE * l.rate)}`, `aresample=${RATE}`);
    if (l.lowpass) f.push(`lowpass=f=${l.lowpass}`);
    if (l.gain) f.push(`volume=${l.gain}dB`);
    if (l.fadeIn) f.push(`afade=t=in:st=0:d=${l.fadeIn}`);
    if (l.fadeOut) f.push(`afade=t=out:st=${Math.max(0, len - l.fadeOut).toFixed(3)}:d=${l.fadeOut}`);
    if (l.at) f.push(`adelay=delays=${Math.round(l.at * 1000)}:all=1`);
    chains.push(`[${i}:a]${f.join(",")}[l${i}]`);
  });
  const mix = v.layers.length > 1 ? `${v.layers.map((_, i) => `[l${i}]`).join("")}amix=inputs=${v.layers.length}:normalize=0:duration=longest` : "[l0]anull";
  const after: string[] = [];
  if (v.fadeIn) after.push(`afade=t=in:st=0:d=${v.fadeIn}`);
  if (v.fadeOut) after.push(`afade=t=out:st=${Math.max(0, total - v.fadeOut).toFixed(3)}:d=${v.fadeOut}`);
  // Trim the silence at both ends (the end by trimming the reversed sound's start).
  if (trim) after.push("silenceremove=start_periods=1:start_threshold=-55dB:start_silence=0.005", "areverse", "silenceremove=start_periods=1:start_threshold=-60dB:start_silence=0.03", "areverse");
  chains.push(`${mix}${after.length ? `,${after.join(",")}` : ""}[out]`);
  return [...args, "-filter_complex", chains.join(";"), "-map", "[out]", "-c:a", "pcm_f32le", "-y", out];
}

/**
 * The ffmpeg arguments that turn a mixed WAV into the game's MP3: the gain, mono for effects and ambience, a limiter
 * run at 4x the sample rate (so it catches the peaks between samples too), the encoding, no tags. `ceiling` is the
 * limiter's, in dBFS (under PEAK_CEILING, for the MP3 encoder's overshoot).
 */
export function encodeArgs(kind: SoundKind, input: string, gainDb: number, out: string, ceiling = PEAK_CEILING - 1): string[] {
  const lin = (10 ** (ceiling / 20)).toFixed(4);
  const mono = kind === "music" ? "" : "aformat=channel_layouts=mono,";
  return ["-i", input, "-af", `volume=${gainDb}dB,${mono}aresample=${RATE * 4},alimiter=limit=${lin}:level=0:attack=1:release=60:asc=1,aresample=${RATE}`, ...ENCODING[kind], "-map_metadata", "-1", "-y", out];
}

/**
 * Encodes and checks, up to four times: a sound that came out more than 0.7 LU under its target (a punchy sound the
 * limiter shaved) is turned up again (at most 6 dB more), and one whose true peak went over the ceiling is limited
 * harder. Returns the final measurement and the gain used.
 */
export function encodeToTarget(kind: SoundKind, mixed: string, file: string): { after: Loudness; gain: number } {
  let gain = gainFor(kind, measure(mixed));
  const first = gain;
  let ceiling = PEAK_CEILING - 1;
  let after: Loudness = { integrated: -70, maxMomentary: -70, truePeak: 0 };
  for (let pass = 0; pass < 4; pass++) {
    ffmpeg(encodeArgs(kind, mixed, gain, file, ceiling));
    after = measure(file);
    const short = LOUDNESS[kind] - judged(kind, after);
    const over = after.truePeak - PEAK_CEILING;
    if (short <= 0.7 && over <= 0) break;
    if (over > 0) ceiling -= over + 0.3;
    if (short > 0.7 && gain - first < 6) gain = Math.round((gain + Math.min(short, 6 - (gain - first))) * 100) / 100;
  }
  return { after, gain };
}

/** A replacement Nate dropped in sound/incoming/replace/, named like the output (sfx-battle-1.wav). */
export function findReplacement(replaceDir: string, name: string): string | null {
  if (!existsSync(replaceDir)) return null;
  const f = readdirSync(replaceDir).find((x) => AUDIO_TYPES.has(extname(x).toLowerCase()) && x.slice(0, -extname(x).length).toLowerCase() === name);
  return f ? join(replaceDir, f) : null;
}

export interface ImportOptions {
  recipe: Recipe;
  credits: ReadonlyMap<string, Credit>;
  /** sound/incoming */
  incoming: string;
  /** apps/web/public/sound */
  outDir: string;
  /** Only these cues (the rest keep their registry entries). */
  only?: ReadonlySet<string>;
  previous?: readonly RegistryEntry[];
  log?: (line: string) => void;
}

/** Everything the recipe asks for that isn't on disk or in the credits, before any work is done. */
export function missingInputs(o: Pick<ImportOptions, "recipe" | "credits" | "incoming">): string[] {
  const out: string[] = [];
  for (const c of o.recipe.cues)
    c.variants.forEach((v, n) => {
      const name = fileName(c.kind, c.cue, n, c.variants.length);
      if (v.replace) {
        if (!o.credits.has(v.replace)) out.push(`${name}: its replacement's source "${v.replace}" isn't in credits.json`);
        if (!findReplacement(join(o.incoming, "replace"), name)) out.push(`${name}: no replacement file in sound/incoming/replace/`);
        return;
      }
      for (const l of v.layers) {
        const credit = o.credits.get(l.src);
        if (!credit) out.push(`${name}: source "${l.src}" isn't in credits.json`);
        else if (!existsSync(join(o.incoming, credit.folder, l.file))) out.push(`${name}: missing sound/incoming/${credit.folder}/${l.file}`);
      }
    });
  return out;
}

/** Runs the import. Returns the registry's files (the cues not imported this time keep their previous entries). */
export function importSounds(o: ImportOptions): RegistryEntry[] {
  const log = o.log ?? (() => {});
  mkdirSync(o.outDir, { recursive: true });
  const tmp = join(tmpdir(), `conquerra-sound-${process.pid}`);
  mkdirSync(tmp, { recursive: true });
  const out: RegistryEntry[] = [];
  try {
    for (const c of o.recipe.cues) {
      if (o.only && !o.only.has(c.cue)) {
        out.push(...(o.previous ?? []).filter((e) => e.cue === c.cue));
        continue;
      }
      c.variants.forEach((v, n) => {
        const name = fileName(c.kind, c.cue, n, c.variants.length);
        const mixed = join(tmp, `${name}.wav`);
        const trim = v.trim ?? c.kind === "sfx";
        let sources: string[];
        if (v.replace) {
          const path = findReplacement(join(o.incoming, "replace"), name)!;
          ffmpeg(mixArgs({ layers: [{ src: v.replace, file: path }], fadeIn: v.fadeIn, fadeOut: v.fadeOut }, [path], [durationOf(path)], mixed, trim));
          sources = [v.replace];
        } else {
          const paths = v.layers.map((l) => join(o.incoming, o.credits.get(l.src)!.folder, l.file));
          ffmpeg(mixArgs(v, paths, paths.map(durationOf), mixed, trim));
          sources = [...new Set(v.layers.map((l) => l.src))];
        }
        const file = join(o.outDir, `${name}.mp3`);
        const { after, gain } = encodeToTarget(c.kind, mixed, file);
        const entry: RegistryEntry = {
          name,
          cue: c.cue,
          kind: c.kind,
          file: `sound/${name}.mp3`,
          bytes: statSync(file).size,
          durationMs: Math.round(durationOf(file) * 1000),
          lufs: Math.round(judged(c.kind, after) * 10) / 10,
          peak: Math.round(after.truePeak * 10) / 10,
          sources,
        };
        out.push(entry);
        log(`${name.padEnd(26)} ${(entry.durationMs / 1000).toFixed(2).padStart(6)} s ${(entry.bytes / 1024).toFixed(1).padStart(7)} KB ${entry.lufs.toFixed(1).padStart(6)} LUFS ${entry.peak.toFixed(1).padStart(5)} dBTP  (${gain >= 0 ? "+" : ""}${gain} dB)`);
      });
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  return out;
}

/** Writes the registry the game reads. */
export function writeRegistry(path: string, files: readonly RegistryEntry[]): void {
  writeFileSync(path, `${JSON.stringify({ target: { ...LOUDNESS, peak: PEAK_CEILING }, files }, null, 1)}\n`);
}

const LICENSE_NAME: Record<string, string> = { "CC0-1.0": "CC0 1.0 (public domain dedication)", PD: "Public domain", "CC-BY-3.0": "CC BY 3.0 (credit required)", "CC-BY-4.0": "CC BY 4.0 (credit required)" };

/** docs/sound/credits.md: every source in use, its license, where it's from, and which sounds use it. */
export function creditsMarkdown(credits: readonly Credit[], files: readonly RegistryEntry[]): string {
  const used = credits.filter((c) => files.some((f) => f.sources.includes(c.id)));
  const rows = used.map((c) => {
    const cues = [...new Set(files.filter((f) => f.sources.includes(c.id)).map((f) => f.name.replace(/-\d+$/, "")))];
    return `| ${c.title} | ${c.author} | ${LICENSE_NAME[c.license] ?? c.license} | <${c.url}> | ${c.downloaded} | ${cues.map((x) => `\`${x}\``).join(", ")} |`;
  });
  const byLicense = (l: string) => used.filter((c) => c.license === l).length;
  return `# Sound credits

*Written by \`pnpm sound:import\` from \`packages/sound/data/credits.json\` (session 24); don't edit by hand. Every sound file in the game is made only from the sources below. The tests refuse a file whose source isn't listed here or whose license isn't allowed.*

**Allowed licenses:** CC0 or public domain (best), CC BY with credit. Never "non-commercial", "personal use only", "editorial", or a license we can't find. **In use:** ${used.length} sources, ${byLicense("CC0-1.0")} CC0${used.length > byLicense("CC0-1.0") ? `, ${used.length - byLicense("CC0-1.0")} other` : ""}. ${used.some((c) => c.license.startsWith("CC-BY")) ? "The CC BY ones are credited in Settings → Credits." : "None needs credit, but Settings → Credits lists every pack anyway (it's polite, and it's how a sound gets traced)."}

**License texts:** \`docs/sound/licenses/\` (the CC0 legal code, and the license files the packs ship with). The packs' own pages are linked below; each showed its license on the day it was downloaded.

| Source | Author | License | Page | Downloaded | Used in |
|---|---|---|---|---|---|
${rows.join("\n")}

## How a sound gets replaced
1. Put the new file in \`sound/incoming/replace/\`, named like the file it replaces (\`sfx-battle-1.wav\`; wav, ogg, mp3 or flac).
2. Add its source to \`packages/sound/data/credits.json\` (title, author, page, license, date) and set \`"replace": "<that id>"\` on the variant in \`packages/sound/data/recipe.json\`.
3. Run \`pnpm sound:import <cue>\` (it trims, normalises and converts it like the rest) and \`pnpm test\`.
`;
}
