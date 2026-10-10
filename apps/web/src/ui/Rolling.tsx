import { useEffect, useRef, useState } from "react";
import { reducedMotion } from "../replay/fx/settings";

/** How long a number takes to roll to its new value (ms). */
const ROLL_MS = 650;

/**
 * A number that rolls up (or down) to its new value instead of jumping (session 21, docs/09 §8): gold, troops. Short
 * and never in the way: it shows the new value straight away to screen readers, and jumps when motion is reduced.
 */
export function Rolling({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (value === from.current) return;
    if (reducedMotion()) {
      from.current = value;
      setShown(value);
      return;
    }
    const start = performance.now(), a = from.current, b = value;
    let raf = 0;
    const step = (now: number) => {
      const u = Math.min(1, (now - start) / ROLL_MS);
      const e = 1 - (1 - u) ** 3;
      setShown(Math.round(a + (b - a) * e));
      if (u < 1) raf = requestAnimationFrame(step);
      else from.current = b;
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      from.current = b;
    };
  }, [value]);
  return (
    <span className="rolling" aria-label={String(value)}>
      <span aria-hidden>{shown}</span>
    </span>
  );
}
