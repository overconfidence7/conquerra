import type { GameContext, PlayerView } from "@conquerra/engine";
import { useEffect, useMemo, useRef, useState } from "react";
import type { TurnReport } from "../host/protocol";
import { buildTimeline, frameAt, replayView, type Beat, type ReplayFrame } from "../replay/timeline";
import type { MapRenderer } from "../render/types";

/**
 * Drives the animated replay: a clock from the timeline (replay/timeline.ts), each frame handed to the renderer
 * to draw, and React only told when the map view or the beat on screen changes. Ends on its own, or on Skip.
 */
export function useReplay(
  ctx: GameContext | null,
  replay: { before: PlayerView; report: TurnReport; key: number } | null,
  renderer: React.MutableRefObject<MapRenderer | null>,
  onBeat: (b: Beat) => void,
  onEnd: () => void,
) {
  const timeline = useMemo(() => (replay ? buildTimeline(replay.report.events) : null), [replay]);
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
    let raf = 0;
    let lastProgress = 0;
    const step = (now: number) => {
      const t = skipRef.current ? timeline.total : now - t0;
      const f: ReplayFrame = frameAt(timeline, t);
      renderer.current?.setReplay(f.done ? null : f);
      // For the screenshot script: what's on screen now.
      (window as unknown as { __conquerraReplay?: ReplayFrame }).__conquerraReplay = f;
      if (f.applied !== lastApplied) setApplied((lastApplied = f.applied));
      if (f.beat && f.beat !== lastBeat) cb.current.onBeat((lastBeat = f.beat));
      const p = timeline.total ? Math.min(1, t / timeline.total) : 1;
      if (p - lastProgress > 0.02 || p === 1) setProgress((lastProgress = p));
      if (f.done) {
        renderer.current?.setReplay(null);
        cb.current.onEnd();
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      renderer.current?.setReplay(null);
    };
  }, [replay, timeline, renderer]);

  const shown: PlayerView | null = useMemo(() => (replay ? replayView(replay.before, replay.report.events, applied) : null), [replay, applied]);
  return { view: shown, progress, skip: () => (skipRef.current = true), total: timeline?.total ?? 0, ctx };
}
