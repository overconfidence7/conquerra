import type { GameContext, PlayerView } from "@conquerra/engine";
import { useEffect, useMemo, useRef, useState } from "react";
import type { TurnReport } from "../host/protocol";
import { bigMoment, CAMERA_EASE_MS, planReplayCamera, replaySpots, type CameraMove } from "../replay/camera";
import { buildTimeline, frameAt, replayView, type Beat, type ReplayFrame } from "../replay/timeline";
import type { MapRenderer } from "../render/types";
import { cardAt, titleCards, type TitleCard } from "../replay/titles";
import { mixer } from "../sound/mixer";
import { soundPlan, soundsBetween } from "../sound/plan";

/**
 * Drives the animated replay: a clock from the timeline (replay/timeline.ts), each frame handed to the renderer
 * to draw, and React only told when the map view or the beat on screen changes. Ends on its own, or on Skip.
 * The camera follows off-screen events and comes back (replay/camera.ts), unless you pan or zoom yourself.
 */
/** The replay's map catches up with the events at most this often (ms). */
export const APPLY_EVERY_MS = 200;

export function useReplay(
  ctx: GameContext | null,
  replay: { before: PlayerView; report: TurnReport; key: number } | null,
  renderer: React.MutableRefObject<MapRenderer | null>,
  /** `carded`: the events that have a title card (their small banner stays quiet: one headline per event). */
  onBeat: (b: Beat, carded: ReadonlySet<unknown>) => void,
  onEnd: () => void,
) {
  const timeline = useMemo(() => (replay ? buildTimeline(replay.report.events) : null), [replay]);
  const spots = useMemo(() => (ctx ? replaySpots(ctx.map) : null), [ctx]);
  const [applied, setApplied] = useState(0);
  const [progress, setProgress] = useState(0);
  // Title cards for the moments that matter (session 21): a capital falling, a House knocked out.
  const cards = useMemo(() => (replay && timeline && ctx ? titleCards(timeline, replay.before, ctx.map, !!replay.report.comeback) : []), [replay, timeline, ctx]);
  const carded = useMemo(() => new Set<unknown>(cards.map((c) => c.event)), [cards]);
  const [card, setCard] = useState<TitleCard | null>(null);
  const skipRef = useRef(false);
  const cb = useRef({ onBeat, onEnd });
  cb.current = { onBeat, onEnd };

  useEffect(() => {
    if (!replay || !timeline) return;
    skipRef.current = false;
    setApplied(0);
    const t0 = performance.now();
    let lastBeat: Beat | null = null;
    let lastApplied = 0;
    let lastApplyAt = -Infinity;
    let raf = 0;
    let lastProgress = 0;
    let lastCard: TitleCard | null = null;
    setCard(null);
    // The camera plan, from where you're looking now. It stops for good if you pan or zoom during the replay.
    const start = renderer.current?.viewState();
    // Capitals this view knows of: the camera pushes in when one falls.
    const capitals = new Set([replay.before.me.capital, ...Object.entries(replay.before.territories).flatMap(([id, t]) => (t.detail === "full" && t.capitalOf ? [id] : []))]);
    const moves: CameraMove[] = start && spots ? planReplayCamera(timeline, spots, start.cam, start.vp, replay.before.me.id, { pushIn: (b) => bigMoment(b, capitals) }) : [];
    // The replay's sounds (session 24), worked out from the timeline like the effects, and played as the clock passes
    // them: "Watch again" sounds the same; Skip stops them.
    const forts = new Set<string>();
    for (const [id, t] of Object.entries(replay.before.territories)) if (t.detail === "full" && t.building === "fort") forts.add(id);
    for (const w of replay.before.walls ?? []) for (const id of w.territories) forts.add(id);
    const sounds = soundPlan(timeline, { gameId: replay.before.gameId, turn: replay.before.turn, me: replay.before.me.id, isCapital: (id) => capitals.has(id), fortified: (id) => forts.has(id) }, replay.report.events);
    let heard = -1;
    let skipped = false;
    // The effects need to know about the replay (and the map can be rebuilt as it starts: tell whichever is current).
    let toldRenderer: MapRenderer | null = null;
    let nextMove = 0;
    let moved = false;
    const yours = () => !start || renderer.current?.viewState().userMoves !== start.userMoves;
    const comeBack = () => {
      if (moved && start && !yours()) renderer.current?.glideTo(start.cam, CAMERA_EASE_MS);
      moved = false;
    };
    const step = (now: number) => {
      // (Screenshot scripts can hold the replay at a moment: window.__conquerraReplayAt = ms.)
      const held = (window as unknown as { __conquerraReplayAt?: number }).__conquerraReplayAt;
      const t = skipRef.current ? timeline.total : typeof held === "number" ? held : now - t0;
      (window as unknown as { __conquerraTimeline?: typeof timeline }).__conquerraTimeline = timeline;
      while (!skipRef.current && nextMove < moves.length && moves[nextMove]!.at <= t) {
        const m = moves[nextMove++]!;
        if (yours()) nextMove = moves.length;
        else {
          renderer.current?.glideTo(m.cam, m.ms);
          moved = true;
        }
      }
      if (renderer.current && renderer.current !== toldRenderer) {
        toldRenderer = renderer.current;
        toldRenderer.startReplay?.(timeline, replay.report.events, replay.before);
      }
      if (skipRef.current) {
        if (!skipped) mixer.stopEffects();
        skipped = true;
      } else {
        // (A screenshot script holding the replay at a moment can move the clock back: nothing plays then.)
        if (t >= heard) for (const s of soundsBetween(sounds, heard, t)) mixer.play(s.cue, s.seed, s.gain);
        heard = t;
      }
      const f: ReplayFrame = frameAt(timeline, t);
      renderer.current?.setReplay(f.done ? null : f);
      // For the screenshot script: what's on screen now.
      (window as unknown as { __conquerraReplay?: ReplayFrame }).__conquerraReplay = f;
      // The map catches up at most every APPLY_EVERY_MS (session 21): each catch-up redraws the map and the panels, and
      // on a big table one per event (90 a turn) made the replay stutter on phones.
      if (f.applied !== lastApplied && (now - lastApplyAt >= APPLY_EVERY_MS || f.done)) {
        lastApplyAt = now;
        setApplied((lastApplied = f.applied));
      }
      if (f.beat && f.beat !== lastBeat) cb.current.onBeat((lastBeat = f.beat), carded);
      const c = f.done ? null : cardAt(cards, t);
      if (c !== lastCard) setCard((lastCard = c));
      const p = timeline.total ? Math.min(1, t / timeline.total) : 1;
      if (p - lastProgress > 0.02 || p === 1) setProgress((lastProgress = p));
      if (f.done) {
        comeBack();
        renderer.current?.setReplay(null);
        cb.current.onEnd();
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      comeBack();
      renderer.current?.setReplay(null);
    };
  }, [replay, timeline, spots, renderer, cards, carded]);

  const shown: PlayerView | null = useMemo(() => (replay ? replayView(replay.before, replay.report.events, applied) : null), [replay, applied]);
  return { view: shown, progress, card, skip: () => (skipRef.current = true), total: timeline?.total ?? 0, ctx };
}
