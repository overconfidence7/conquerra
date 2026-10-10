import type { GameContext, PlayerView } from "@conquerra/engine";
import { useEffect, useMemo, useRef, useState } from "react";
import type { TurnReport } from "../host/protocol";
import { CAMERA_EASE_MS, planReplayCamera, replaySpots, type CameraMove } from "../replay/camera";
import { buildTimeline, frameAt, replayView, type Beat, type ReplayFrame } from "../replay/timeline";
import type { MapRenderer } from "../render/types";

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
  onBeat: (b: Beat) => void,
  onEnd: () => void,
) {
  const timeline = useMemo(() => (replay ? buildTimeline(replay.report.events) : null), [replay]);
  const spots = useMemo(() => (ctx ? replaySpots(ctx.map) : null), [ctx]);
  const [applied, setApplied] = useState(0);
  const [progress, setProgress] = useState(0);
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
    // The camera plan, from where you're looking now. It stops for good if you pan or zoom during the replay.
    const start = renderer.current?.viewState();
    const moves: CameraMove[] = start && spots ? planReplayCamera(timeline, spots, start.cam, start.vp, replay.before.me.id) : [];
    let nextMove = 0;
    let moved = false;
    const yours = () => !start || renderer.current?.viewState().userMoves !== start.userMoves;
    const comeBack = () => {
      if (moved && start && !yours()) renderer.current?.glideTo(start.cam, CAMERA_EASE_MS);
      moved = false;
    };
    const step = (now: number) => {
      const t = skipRef.current ? timeline.total : now - t0;
      while (!skipRef.current && nextMove < moves.length && moves[nextMove]!.at <= t) {
        const m = moves[nextMove++]!;
        if (yours()) nextMove = moves.length;
        else {
          renderer.current?.glideTo(m.cam, m.ms);
          moved = true;
        }
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
      if (f.beat && f.beat !== lastBeat) cb.current.onBeat((lastBeat = f.beat));
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
  }, [replay, timeline, spots, renderer]);

  const shown: PlayerView | null = useMemo(() => (replay ? replayView(replay.before, replay.report.events, applied) : null), [replay, applied]);
  return { view: shown, progress, skip: () => (skipRef.current = true), total: timeline?.total ?? 0, ctx };
}
