/**
 * Phones only allow sound after a tap (session 24). On the first tap or key press anywhere (the lobby's buttons
 * count), an audio context is made inside that tap and woken with a silent sound, so the game's sound (loaded later,
 * with the game screen) can play. In the start-up bundle, so it's tiny; never shows an error.
 */
let ctx: AudioContext | null = null;
const EVENTS = ["pointerdown", "touchend", "mousedown", "keydown"] as const;

/** The audio context the first tap woke, if there's been one (null before it, or with no Web Audio at all). */
export const unlockedAudio = (): AudioContext | null => ctx;
/**
 * Audio elements readied in the first tap, for the music (it streams through them): a phone lets an element play
 * later only if it was touched in a tap (Howler.js does the same). Nothing is downloaded until the music asks.
 */
export const audioPool: HTMLAudioElement[] = [];

function unlock() {
  try {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return stop();
    ctx ??= new C();
    while (audioPool.length < 3) {
      const a = new Audio();
      a.preload = "none";
      a.load();
      audioPool.push(a);
    }
    const s = ctx.createBufferSource();
    s.buffer = ctx.createBuffer(1, 1, 22050);
    s.connect(ctx.destination);
    s.start(0);
    void ctx.resume?.().catch(() => {});
    if (ctx.state === "running") stop();
  } catch {
    stop();
  }
}
function stop() {
  for (const e of EVENTS) removeEventListener(e, unlock, true);
  dispatchEvent(new Event("conquerra-audio"));
}

if (typeof window !== "undefined") for (const e of EVENTS) addEventListener(e, unlock, true);
