import { centreOn, clampCamera, fitCamera, lerpCamera, scaleLimits, toMap, zoomAt, type Camera, type MapSize, type Viewport } from "../map/camera";
import { NEAR_FROM_PX, scaleForPx } from "../map/zoom";

/**
 * Owns the camera: fit, zoom, pan, smooth moves, and the limits. Both renderers use it.
 */
export class CameraController {
  cam: Camera = { x: 0, y: 0, scale: 1 };
  vp: Viewport = { width: 1, height: 1 };
  private anim: { from: Camera; to: Camera; t0: number; ms: number } | null = null;
  private listeners: ((c: Camera) => void)[] = [];

  constructor(
    readonly map: MapSize,
    /** A typical territory's width in map units (for zoom limits). */
    readonly territorySize: number,
  ) {}

  onChange(f: (c: Camera) => void) {
    this.listeners.push(f);
  }

  get limits() {
    // Zoom in until a typical territory is about 2.4x the Near threshold wide.
    return scaleLimits(this.map, this.vp, scaleForPx(NEAR_FROM_PX * 2.4, this.territorySize));
  }

  setViewport(vp: Viewport) {
    const [mx, my] = toMap(this.cam, this.vp.width / 2, this.vp.height / 2);
    const first = this.vp.width <= 1;
    this.vp = vp;
    if (first) this.cam = fitCamera(this.map, vp);
    else this.cam = centreOn(mx, my, this.cam.scale, vp);
    this.set(this.cam);
  }

  set(c: Camera, animateMs = 0) {
    const lim = this.limits;
    const target = clampCamera({ ...c, scale: Math.max(lim.min, Math.min(lim.max, c.scale)) }, this.map, this.vp);
    if (animateMs > 0) {
      this.anim = { from: { ...this.cam }, to: target, t0: performance.now(), ms: animateMs };
      return;
    }
    this.anim = null;
    this.cam = target;
    for (const f of this.listeners) f(this.cam);
  }

  /** Advance a smooth move; call every frame. */
  tick(now: number) {
    if (!this.anim) return;
    const t = Math.min(1, (now - this.anim.t0) / this.anim.ms);
    this.cam = t >= 1 ? this.anim.to : lerpCamera(this.anim.from, this.anim.to, t, this.vp);
    if (t >= 1) this.anim = null;
    for (const f of this.listeners) f(this.cam);
  }

  get animating() {
    return this.anim !== null;
  }

  fit(animate = true) {
    this.set(fitCamera(this.map, this.vp), animate ? 280 : 0);
  }

  zoomAt(factor: number, sx: number, sy: number, animateMs = 0) {
    this.set(zoomAt(this.cam, factor, sx, sy, this.limits), animateMs);
  }

  centreOn(mx: number, my: number, scale = this.cam.scale, animateMs = 0) {
    this.set(centreOn(mx, my, scale, this.vp), animateMs);
  }

  pan(dx: number, dy: number) {
    this.set({ ...this.cam, x: this.cam.x + dx, y: this.cam.y + dy });
  }

  /** Is the camera at (about) the whole-map fit? */
  get nearFit() {
    return this.cam.scale < fitCamera(this.map, this.vp).scale * 1.15;
  }
}

export interface InputHandlers {
  tap(sx: number, sy: number): void;
  /** Tap-and-hold (touch) or hover (mouse) at a screen point; null when it ends. */
  hold(at: { x: number; y: number } | null): void;
  hover(at: { x: number; y: number } | null): void;
  doubleTap(sx: number, sy: number): void;
}

const HOLD_MS = 450;
const TAP_SLOP = 8;

/**
 * Mouse wheel and drag on desktop; pinch and drag on phones; double tap; tap-and-hold. Returns a function that
 * removes the listeners.
 */
export function attachInput(el: HTMLElement, cam: CameraController, h: InputHandlers): () => void {
  const pointers = new Map<number, { x: number; y: number; type: string }>();
  let start: { x: number; y: number; t: number; moved: boolean } | null = null;
  let pinch: { dist: number; cx: number; cy: number } | null = null;
  let holdTimer: ReturnType<typeof setTimeout> | null = null;
  let held = false;
  let lastTap = { t: 0, x: 0, y: 0 };
  const local = (e: PointerEvent | WheelEvent) => {
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const clearHold = () => {
    if (holdTimer) clearTimeout(holdTimer);
    holdTimer = null;
  };

  const down = (e: PointerEvent) => {
    el.setPointerCapture(e.pointerId);
    const p = local(e);
    pointers.set(e.pointerId, { ...p, type: e.pointerType });
    if (pointers.size === 1) {
      start = { ...p, t: performance.now(), moved: false };
      held = false;
      clearHold();
      if (e.pointerType !== "mouse")
        holdTimer = setTimeout(() => {
          if (start && !start.moved) {
            held = true;
            h.hold({ x: start.x, y: start.y });
          }
        }, HOLD_MS);
    } else if (pointers.size === 2) {
      clearHold();
      if (start) start.moved = true;
      const [a, b] = [...pointers.values()];
      pinch = { dist: Math.hypot(a!.x - b!.x, a!.y - b!.y), cx: (a!.x + b!.x) / 2, cy: (a!.y + b!.y) / 2 };
    }
  };

  const move = (e: PointerEvent) => {
    const p = local(e);
    const prev = pointers.get(e.pointerId);
    if (!prev) {
      if (e.pointerType === "mouse") h.hover(p);
      return;
    }
    pointers.set(e.pointerId, { ...p, type: prev.type });
    if (pointers.size === 1 && start) {
      if (!start.moved && Math.hypot(p.x - start.x, p.y - start.y) > TAP_SLOP) {
        start.moved = true;
        clearHold();
        if (held) h.hold(null);
      }
      if (start.moved) cam.pan(p.x - prev.x, p.y - prev.y);
      if (e.pointerType === "mouse") h.hover(null);
    } else if (pointers.size === 2 && pinch) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      const cx = (a!.x + b!.x) / 2, cy = (a!.y + b!.y) / 2;
      cam.pan(cx - pinch.cx, cy - pinch.cy);
      if (pinch.dist > 0) cam.zoomAt(dist / pinch.dist, cx, cy);
      pinch = { dist, cx, cy };
    }
  };

  const up = (e: PointerEvent) => {
    const had = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!had) return;
    if (pointers.size === 0 && start) {
      clearHold();
      const p = local(e);
      const quick = !start.moved && !held;
      if (held) h.hold(null);
      if (quick && e.type === "pointerup") {
        const now = performance.now();
        if (now - lastTap.t < 320 && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 24) {
          lastTap = { t: 0, x: 0, y: 0 };
          h.doubleTap(p.x, p.y);
        } else {
          lastTap = { t: now, ...p };
          h.tap(p.x, p.y);
        }
      }
      start = null;
    }
  };

  const wheel = (e: WheelEvent) => {
    e.preventDefault();
    const p = local(e);
    // Trackpad pinch arrives as ctrl+wheel with small deltas; a mouse wheel notch is about 100.
    const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
    cam.zoomAt(Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0018)), p.x, p.y);
  };
  const leave = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && !pointers.size) h.hover(null);
  };

  el.addEventListener("pointerdown", down);
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
  el.addEventListener("pointerleave", leave);
  el.addEventListener("wheel", wheel, { passive: false });
  const noMenu = (e: Event) => e.preventDefault();
  el.addEventListener("contextmenu", noMenu);
  return () => {
    clearHold();
    el.removeEventListener("pointerdown", down);
    el.removeEventListener("pointermove", move);
    el.removeEventListener("pointerup", up);
    el.removeEventListener("pointercancel", up);
    el.removeEventListener("pointerleave", leave);
    el.removeEventListener("wheel", wheel);
    el.removeEventListener("contextmenu", noMenu);
  };
}
