import type { ReplayEvent } from "@conquerra/engine";
import { CREDIT_BY_ID, REGISTRY, type RegistryEntry } from "@conquerra/sound";
import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { buildTimeline } from "../../replay/timeline";
import { CUE_NAMES, CUE_SPECS, type CueName } from "../../sound/cues";
import { mixer, pick, url } from "../../sound/mixer";
import { planStats, REPLAY_SOUND, soundPlan, type PlannedSound, type ReplaySoundRules } from "../../sound/plan";
import { busGains, useSound } from "../../sound/settings";
import recorded from "./recorded-turn.json";
import "../maps/lab.css";
import "./sound.css";

/**
 * The sound bench (`?lab=sound`, private preview only; session 24). Every cue with a play button, its variants, each
 * file's length, size, loudness and license; "Play a turn" plays a real replay's sounds in order (bots on Embervale,
 * the fog on, its busiest turn). Nate marks what he'd change; "Copy my notes" puts the marks on the clipboard.
 */

export const GROUPS: { title: string; cues: CueName[] }[] = [
  { title: "The replay", cues: ["march-large", "battle", "arrows", "siege", "capture", "capture-rival", "held", "capital-falls", "knocked-out", "leader-falls", "recruits", "wall", "built", "culture", "fog"] },
  { title: "Fate, the Fallen, deals, spies", cues: ["fate", "fallen", "deal-sealed", "deal-broken", "spy", "spy-caught"] },
  { title: "Planning and menus", cues: ["seal", "coins-spend", "coins-income", "timer-tick", "panel", "spoils", "turn-sweep", "notice", "card"] },
  { title: "Music", cues: ["game", "victory", "defeat"] },
  { title: "Ambience", cues: ["wind", "sea"] },
];
const FILE = new Map(REGISTRY.files.map((f) => [f.name, f]));
const NOTES_KEY = "conquerra.soundBench.notes";

const readNotes = (): Record<string, { mark: boolean; note: string }> => {
  try {
    return JSON.parse(localStorage.getItem(NOTES_KEY) ?? "{}");
  } catch {
    return {};
  }
};

/** A music or ambience file plays through an audio element (it streams), at the Music volume. */
let longPlayer: HTMLAudioElement | null = null;
function playLong(name: string, bus: "music" | "ambience", volume: number): () => void {
  longPlayer?.pause();
  const a = new Audio(url(name));
  a.volume = Math.min(1, volume * busGains(useSound.getState())[bus]);
  void a.play().catch(() => {});
  longPlayer = a;
  return () => a.pause();
}

/** A real replay, recorded by scripts/make-s24-turn.ts: bots on Embervale, the fog on, their busiest turn. */
const TURN = recorded as unknown as { gameId: string; turn: number; me: string; capitals: string[]; forts: string[]; events: ReplayEvent[] };

function FileRow({ f, cue }: { f: RegistryEntry; cue: CueName }) {
  const c = CUE_SPECS[cue];
  const credits = f.sources.map((s) => CREDIT_BY_ID.get(s)).filter((x) => !!x);
  const play = () => {
    if (c.bus === "sfx") {
      // (Played directly, at the cue's volume, past the stacking rule.)
      void mixer.load([f.name]).then(() => mixer.playFile(f.name, c.volume));
    } else playLong(f.name, c.bus, c.volume);
  };
  return (
    <tr>
      <td>
        <button onClick={play} aria-label={`Play ${f.name}`}>
          ▶ {f.name}
        </button>
      </td>
      <td className="num">{(f.durationMs / 1000).toFixed(2)} s</td>
      <td className="num">{(f.bytes / 1024).toFixed(1)} KB</td>
      <td className="num">{f.lufs.toFixed(1)} LUFS</td>
      <td className="num">{f.peak.toFixed(1)} dBTP</td>
      <td className="small">
        {credits.map((cr) => (
          <span key={cr.id} className="credit">
            <a href={cr.url} target="_blank" rel="noreferrer">
              {cr.title}
            </a>{" "}
            <span className="muted">
              {cr.author} · {cr.license}
            </span>
          </span>
        ))}
      </td>
    </tr>
  );
}

function CueCard({ cue, notes, setNote }: { cue: CueName; notes: ReturnType<typeof readNotes>; setNote(cue: string, v: { mark: boolean; note: string }): void }) {
  const c = CUE_SPECS[cue];
  const files = c.files.map((n) => FILE.get(n)).filter((x): x is RegistryEntry => !!x);
  const [seed, setSeed] = useState(1);
  const n = notes[cue] ?? { mark: false, note: "" };
  const playCue = () => {
    const s = seed;
    setSeed(s + 1);
    if (c.bus === "sfx") void mixer.load(c.files).then(() => mixer.play(cue, s * 7919));
    else playLong(c.files[0]!, c.bus, c.volume);
  };
  const p = c.bus === "sfx" ? pick(cue, seed * 7919) : null;
  return (
    <section className={`cue ${n.mark ? "marked" : ""}`} id={`cue-${cue}`}>
      <header className="row">
        <button className="on" onClick={playCue}>
          ▶ {cue}
        </button>
        <span className="muted small">
          {c.note} Volume {c.volume}
          {c.pitch[0] !== c.pitch[1] ? `, pitch ${c.pitch[0]} to ${c.pitch[1]}` : ""}
          {c.troops ? `, louder with troops (${c.troops.from} to ${c.troops.to})` : ""}
          {c.duck ? `, the music dips ${c.duck / 1000} s` : ""}. Follows: {c.beat}.
          {p ? ` Next: ${p.file} at ${p.speed.toFixed(2)}.` : ""}
        </span>
      </header>
      <table>
        <tbody>
          {files.map((f) => (
            <FileRow key={f.name} f={f} cue={cue} />
          ))}
        </tbody>
      </table>
      <div className="row mark">
        <label className="check">
          <input type="checkbox" checked={n.mark} onChange={(e) => setNote(cue, { ...n, mark: e.target.checked })} /> I'd change this
        </label>
        <input className="note" placeholder="What's wrong with it? (too loud, wrong feel, too long...)" value={n.note} onChange={(e) => setNote(cue, { ...n, note: e.target.value })} />
      </div>
    </section>
  );
}

/** The bench's own try at the replay's rules (session 25b): remembered here only, and in "Copy my notes". */
const RULES_KEY = "conquerra.soundBench.rules";
const readRules = (): ReplaySoundRules => {
  try {
    return { ...REPLAY_SOUND, ...JSON.parse(localStorage.getItem(RULES_KEY) ?? "{}") };
  } catch {
    return { ...REPLAY_SOUND };
  }
};
export const rulesNote = (r: ReplaySoundRules) =>
  r.maxAtOnce === REPLAY_SOUND.maxAtOnce && r.marchFrom === REPLAY_SOUND.marchFrom ? "" : `replay rules: at most ${r.maxAtOnce} at once, marches from ${r.marchFrom} troops`;

function PlayTurn({ rules, setRules }: { rules: ReplaySoundRules; setRules(r: ReplaySoundRules): void }) {
  const turn = TURN;
  const plan = useMemo<PlannedSound[]>(() => {
    const capitals = new Set(turn.capitals), forts = new Set(turn.forts);
    return soundPlan(buildTimeline(turn.events), { gameId: turn.gameId, turn: turn.turn, me: turn.me, isCapital: (id) => capitals.has(id), fortified: (id) => forts.has(id) }, turn.events, rules);
  }, [turn, rules]);
  const stats = planStats(plan);
  const [now, setNow] = useState<number | null>(null);
  const timers = useRef<number[]>([]);
  const stop = () => {
    for (const t of timers.current) clearTimeout(t);
    timers.current = [];
    mixer.stopEffects();
    setNow(null);
  };
  useEffect(() => stop, []);
  const play = async () => {
    stop();
    await mixer.load(mixer.allEffects());
    const t0 = performance.now();
    setNow(0);
    for (const s of plan) timers.current.push(window.setTimeout(() => (mixer.play(s.cue, s.seed, s.gain, rules.maxAtOnce), setNow(performance.now() - t0)), s.at));
    const end = (plan.at(-1)?.at ?? 0) + 1500;
    timers.current.push(window.setTimeout(() => setNow(null), end));
  };
  const total = buildTimeline(turn.events).total;
  const num = (label: string, key: "maxAtOnce" | "marchFrom", min: number, max: number) => (
    <label className="check">
      {label} <input type="number" min={min} max={max} value={rules[key]} onChange={(e) => setRules({ ...rules, [key]: Math.max(min, Math.min(max, Number(e.target.value) || min)) })} />
    </label>
  );
  return (
    <section className="cue">
      <header className="row">
        <button className="on" onClick={() => void play()}>
          ▶ Play a turn
        </button>
        <button onClick={stop}>Stop</button>
        <span className="muted small">
          A real replay's sounds in order: bots on Embervale with the fog on, their busiest turn ({turn.events.filter((e) => e.type === "battle").length} battles, {turn.events.filter((e) => e.type === "surface").length} things in the fog, {(total / 1000).toFixed(1)} s). <b>{stats.sounds} sounds</b>, at most {stats.mostAtOnce} at once, {stats.seconds.toFixed(1)} s with any sound (session 24: 61 sounds, up to 9 at once, 22.9 s).
        </span>
      </header>
      <div className="row">
        {num("At most at once", "maxAtOnce", 1, 12)}
        {num("Marches from (troops)", "marchFrom", 1, 200)}
        <button onClick={() => setRules({ ...REPLAY_SOUND })}>Back to the game's</button>
      </div>
      <ol className="turn">
        {plan.map((s, i) => (
          <li key={i} className={now !== null && s.at <= now ? "heard" : ""}>
            <span className="num">{(s.at / 1000).toFixed(2)} s</span> {s.cue}
            {s.gain !== 1 ? <span className="muted"> ×{s.gain.toFixed(2)}</span> : null}
            {s.until !== undefined ? <span className="muted"> (cut at {(s.until / 1000).toFixed(2)} s)</span> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

function Volumes() {
  const s = useSound();
  const slider = (label: string, key: "master" | "music" | "effects") => (
    <label className="check">
      {label} <input type="range" min={0} max={100} step={5} value={Math.round(s[key] * 100)} onChange={(e) => s.set({ [key]: Number(e.target.value) / 100 })} />
    </label>
  );
  return (
    <div className="row">
      {slider("Master", "master")}
      {slider("Music", "music")}
      {slider("Sound effects", "effects")}
      <label className="check">
        <input type="checkbox" checked={s.muted} onChange={(e) => s.set({ muted: e.target.checked })} /> Mute
      </label>
    </div>
  );
}

function SoundBench() {
  const [notes, setNotes] = useState(readNotes);
  const [rules, setRulesState] = useState(readRules);
  const setRules = (r: ReplaySoundRules) => {
    setRulesState(r);
    try {
      localStorage.setItem(RULES_KEY, JSON.stringify({ maxAtOnce: r.maxAtOnce, marchFrom: r.marchFrom }));
    } catch {
      // Remembered for this visit only.
    }
  };
  const setNote = (cue: string, v: { mark: boolean; note: string }) =>
    setNotes((old) => {
      const next = { ...old, [cue]: v };
      try {
        localStorage.setItem(NOTES_KEY, JSON.stringify(next));
      } catch {
        // Remembered for this visit only.
      }
      return next;
    });
  const marked = CUE_NAMES.filter((c) => notes[c]?.mark || notes[c]?.note);
  const copy = () => void navigator.clipboard?.writeText([...marked.map((c) => `${c}: ${notes[c]!.note || "(marked)"}`), rulesNote(rules)].filter(Boolean).join("\n")).catch(() => {});
  const total = REGISTRY.files.reduce((a, f) => a + f.bytes, 0);
  return (
    <div className="lab sound-bench">
      <header className="row top">
        <h1>Sound bench</h1>
        <span className="muted small">
          {CUE_NAMES.length} cues, {REGISTRY.files.length} files, {(total / 1024 / 1024).toFixed(2)} MB in all. Loudness: effects {REGISTRY.target.sfx} LUFS at their loudest moment, music {REGISTRY.target.music}, ambience {REGISTRY.target.ambience}, peaks under {REGISTRY.target.peak} dBTP. Every source is CC0 (credits in Settings).
        </span>
      </header>
      <Volumes />
      <div className="row">
        <span>
          {marked.length ? `${marked.length} marked: ${marked.join(", ")}` : "Nothing marked yet. Tick “I'd change this” on any sound, with a word on why."}
        </span>
        {marked.length || rulesNote(rules) ? <button onClick={copy}>Copy my notes</button> : null}
      </div>
      <PlayTurn rules={rules} setRules={setRules} />
      {GROUPS.map((g) => (
        <div key={g.title}>
          <h2>{g.title}</h2>
          {g.cues.map((c) => (
            <CueCard key={c} cue={c} notes={notes} setNote={setNote} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function runSoundBench(root: HTMLElement) {
  document.title = "Sound bench · Conquerra";
  createRoot(root).render(
    <StrictMode>
      <SoundBench />
    </StrictMode>,
  );
}
