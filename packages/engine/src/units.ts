import { UNIT_TYPES, type UnitType } from "@conquerra/content";
import type { Units } from "./types";

export const emptyUnits = (): Units => ({ infantry: 0, cavalry: 0, siege: 0 });
export const total = (u: Units): number => u.infantry + u.cavalry + u.siege;
export const addUnits = (a: Units, b: Units): Units => ({
  infantry: a.infantry + b.infantry,
  cavalry: a.cavalry + b.cavalry,
  siege: a.siege + b.siege,
});
export const subUnits = (a: Units, b: Units): Units => ({
  infantry: a.infantry - b.infantry,
  cavalry: a.cavalry - b.cavalry,
  siege: a.siege - b.siege,
});
export const fromPartial = (p: Partial<Units>): Units => ({
  infantry: Math.max(0, Math.floor(p.infantry ?? 0)),
  cavalry: Math.max(0, Math.floor(p.cavalry ?? 0)),
  siege: Math.max(0, Math.floor(p.siege ?? 0)),
});

/** Remove `count` units following the casualty order (cheapest first). Returns the units removed. */
export function removeCasualties(units: Units, count: number, order: readonly UnitType[]): Units {
  const removed = emptyUnits();
  let left = count;
  for (const t of order) {
    if (left <= 0) break;
    const n = Math.min(units[t], left);
    removed[t] = n;
    left -= n;
  }
  return removed;
}

export { UNIT_TYPES };
