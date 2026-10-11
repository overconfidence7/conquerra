import { z } from "zod";

/**
 * The game's sound cues as data (session 24), like the effect recipes: which files, how loud, the pitch range, how
 * they grow with the troops in a fight or a march, and which moment of the replay they follow. Checked against the
 * schema and the sound registry by a test, so tuning a sound is editing numbers here, and swapping one is replacing a
 * file (docs/sound/credits.md, "How a sound gets replaced").
 */

const Range = z.tuple([z.number(), z.number()]).refine(([a, b]) => a <= b, "a range runs low to high");
const Fraction = z.number().min(0).max(1);

export const Cue = z
  .object({
    /** Files from the sound registry (packages/sound/data/registry.json): one is picked, seeded by the game and the event. */
    files: z.array(z.string()).min(1),
    bus: z.enum(["sfx", "music", "ambience"]),
    /** How loud, before the volumes in Settings. */
    volume: Fraction,
    /** Playback rate, picked in this range (pitch and speed together: 0.9 is a little lower and slower). */
    pitch: Range.default([1, 1]),
    /** Louder with more troops: the volume times `scale[0]` at `from` troops or fewer, up to `scale[1]` at `to` or more. */
    troops: z.object({ from: z.number().int().min(0), to: z.number().int().min(1), scale: Range }).optional(),
    /** Which moment it follows: a beat's start, the fight, the result, a pop on the map, the turn's end, a tap, or music. */
    beat: z.enum(["start", "fight", "result", "pop", "end", "ui", "music"]),
    /** When too many sounds would play at once, the higher one stays (3: a capital falling; 0: a tick). */
    priority: z.number().int().min(0).max(3),
    /** Not again within this long (ms): a busy turn's twentieth capture doesn't get its own fanfare. */
    cooldown: z.number().min(0).default(0),
    /** The music dips under it for this long (ms). */
    duck: z.number().min(0).default(0),
    note: z.string(),
  })
  .strict();
export const Cues = z.record(Cue);
export type CueSpec = z.infer<typeof Cue>;
export type CueInput = z.input<typeof Cue>;

const sfx = (cue: string, n: number) => Array.from({ length: n }, (_, i) => `sfx-${cue}-${i + 1}`);

export const CUES = {
  // --- The replay ---
  "march-small": { files: sfx("march-small", 2), bus: "sfx", volume: 0.45, pitch: [0.95, 1.08], cooldown: 500, beat: "start", priority: 0, note: "An army of 1 to 5 marches: boots." },
  "march-medium": { files: sfx("march-medium", 2), bus: "sfx", volume: 0.42, pitch: [0.97, 1.03], cooldown: 700, beat: "start", priority: 1, note: "An army of 6 to 19 marches: one bar of drums." },
  "march-large": { files: sfx("march-large", 2), bus: "sfx", volume: 0.5, pitch: [0.97, 1.02], troops: { from: 20, to: 60, scale: [0.85, 1] }, cooldown: 1500, beat: "start", priority: 1, note: "20 or more: two bars of drums, louder the bigger it is." },
  battle: { files: sfx("battle", 3), bus: "sfx", volume: 0.7, pitch: [0.92, 1.08], troops: { from: 2, to: 30, scale: [0.6, 1] }, beat: "fight", priority: 2, note: "Steel on steel as the armies meet." },
  "battle-big": { files: sfx("battle-big", 3), bus: "sfx", volume: 0.55, pitch: [0.96, 1.04], troops: { from: 15, to: 60, scale: [0.7, 1] }, cooldown: 1200, beat: "fight", priority: 1, note: "15 or more troops in the fight: shouts under the steel." },
  arrows: { files: sfx("arrows", 2), bus: "sfx", volume: 0.45, pitch: [0.94, 1.06], cooldown: 900, beat: "fight", priority: 1, note: "Defenders shoot from a fort or a wall." },
  siege: { files: sfx("siege", 2), bus: "sfx", volume: 0.75, pitch: [0.95, 1.03], beat: "fight", priority: 2, note: "A Siege engine's stone lands (as the stone does, 0.6 s into the fight)." },
  capture: { files: sfx("capture", 1), bus: "sfx", volume: 0.6, cooldown: 2500, beat: "result", priority: 2, note: "You take land: a bar of the victory theme." },
  "capture-rival": { files: sfx("capture-rival", 1), bus: "sfx", volume: 0.42, pitch: [0.97, 1.03], cooldown: 3500, beat: "result", priority: 1, note: "A rival takes land: a low horn." },
  held: { files: sfx("held", 2), bus: "sfx", volume: 0.55, pitch: [0.94, 1.06], cooldown: 800, beat: "result", priority: 1, note: "The attack is beaten back: a blow on a shield." },
  "capital-falls": { files: sfx("capital-falls", 1), bus: "sfx", volume: 1, beat: "result", priority: 3, duck: 3500, note: "A capital falls: the big hit and the bell. The music dips under it." },
  "knocked-out": { files: sfx("knocked-out", 1), bus: "sfx", volume: 0.8, beat: "start", priority: 3, duck: 4000, note: "A House is knocked out: a fading drum." },
  "leader-falls": { files: sfx("leader-falls", 1), bus: "sfx", volume: 0.6, beat: "start", priority: 2, duck: 2000, note: "A Leader falls: a slow, low horn." },
  recruits: { files: sfx("recruits", 2), bus: "sfx", volume: 0.4, pitch: [0.95, 1.05], cooldown: 500, beat: "pop", priority: 0, note: "Recruits march out." },
  wall: { files: sfx("wall", 1), bus: "sfx", volume: 0.6, beat: "pop", priority: 2, note: "A wall goes up." },
  built: { files: sfx("built", 2), bus: "sfx", volume: 0.45, pitch: [0.96, 1.04], cooldown: 600, beat: "pop", priority: 1, note: "A building is finished (half as loud when one is begun)." },
  culture: { files: sfx("culture", 1), bus: "sfx", volume: 0.3, pitch: [0.98, 1.06], cooldown: 600, beat: "pop", priority: 0, note: "Culture rises." },
  fog: { files: sfx("fog", 2), bus: "sfx", volume: 0.32, pitch: [0.96, 1.02], cooldown: 1500, beat: "pop", priority: 0, note: "Anything in the fog: the same distant rumble whatever it was." },
  // --- Fate, the Fallen, deals, spies ---
  fate: { files: sfx("fate", 1), bus: "sfx", volume: 0.55, cooldown: 600, beat: "pop", priority: 2, note: "A Fate card plays." },
  fallen: { files: sfx("fallen", 1), bus: "sfx", volume: 0.6, beat: "pop", priority: 2, duck: 2500, note: "The Fallen strike." },
  "deal-sealed": { files: sfx("deal-sealed", 1), bus: "sfx", volume: 0.55, beat: "pop", priority: 2, note: "A deal is sealed: parchment and the wax stamp." },
  "deal-broken": { files: sfx("deal-broken", 1), bus: "sfx", volume: 0.6, beat: "pop", priority: 2, note: "A deal is broken: a crack." },
  spy: { files: sfx("spy", 1), bus: "sfx", volume: 0.35, beat: "end", priority: 1, note: "Your spy's news." },
  "spy-caught": { files: sfx("spy-caught", 1), bus: "sfx", volume: 0.5, beat: "end", priority: 2, note: "A spy is caught." },
  // --- Planning and menus (soft and short, never on every tap) ---
  seal: { files: sfx("seal", 1), bus: "sfx", volume: 0.55, beat: "ui", priority: 2, note: "You lock in: the seal's press." },
  "coins-spend": { files: sfx("coins-spend", 2), bus: "sfx", volume: 0.25, pitch: [0.96, 1.06], beat: "ui", priority: 0, note: "An order that costs gold." },
  "coins-income": { files: sfx("coins-income", 1), bus: "sfx", volume: 0.35, beat: "end", priority: 1, note: "Gold comes in as the replay ends." },
  "timer-tick": { files: sfx("timer-tick", 2), bus: "sfx", volume: 0.3, beat: "ui", priority: 0, note: "Each of the timer's last 10 seconds." },
  panel: { files: sfx("panel", 1), bus: "sfx", volume: 0.12, pitch: [0.98, 1.04], beat: "ui", priority: 0, note: "A panel opens: very soft." },
  spoils: { files: sfx("spoils", 1), bus: "sfx", volume: 0.5, cooldown: 800, beat: "pop", priority: 1, note: "A Spoils set is turned in." },
  "turn-sweep": { files: sfx("turn-sweep", 1), bus: "sfx", volume: 0.35, beat: "ui", priority: 1, note: "\"Turn N\" sweeps across." },
  notice: { files: sfx("notice", 1), bus: "sfx", volume: 0.25, beat: "ui", priority: 1, note: "A notice." },
  card: { files: sfx("card", 1), bus: "sfx", volume: 0.35, beat: "ui", priority: 0, note: "A Spoils card is earned." },
  // --- Music ---
  planning: { files: ["music-planning"], bus: "music", volume: 0.8, beat: "music", priority: 0, note: "Under planning (loops)." },
  replay: { files: ["music-replay"], bus: "music", volume: 0.75, beat: "music", priority: 0, note: "Under the replay (loops)." },
  title: { files: ["music-title"], bus: "music", volume: 0.8, beat: "music", priority: 0, note: "The lobby, after the first tap (loops)." },
  victory: { files: ["music-victory"], bus: "music", volume: 0.9, beat: "music", priority: 0, note: "Game over, you won (once)." },
  defeat: { files: ["music-defeat"], bus: "music", volume: 0.9, beat: "music", priority: 0, note: "Game over, you lost (once)." },
  // --- Ambience (under Music's volume) ---
  wind: { files: ["amb-wind"], bus: "ambience", volume: 0.5, beat: "music", priority: 0, note: "Under the map while you plan." },
  sea: { files: ["amb-sea"], bus: "ambience", volume: 0.5, beat: "music", priority: 0, note: "Where the camera shows coast." },
  birds: { files: ["amb-birds"], bus: "ambience", volume: 0.35, beat: "music", priority: 0, note: "Now and then." },
} satisfies Record<string, CueInput>;

export type CueName = keyof typeof CUES;
export const CUE_NAMES = Object.keys(CUES) as CueName[];
/** The cues, checked and with their defaults filled in. */
export const CUE_SPECS: Record<CueName, CueSpec> = Cues.parse(CUES) as Record<CueName, CueSpec>;
