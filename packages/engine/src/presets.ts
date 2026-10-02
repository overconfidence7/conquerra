import type { Condition, Order, PresetId } from "./types";

export interface PresetInfo {
  id: PresetId;
  name: string;
  /** Plain-language summary for the order screen. */
  description: string;
}

/** The one-tap contingency presets from design v0.2 §3, in menu order. */
export const PRESETS: readonly PresetInfo[] = [
  { id: "onlyIfStronger", name: "Only if still stronger", description: "Attack only if the odds are still at least \"likely\" when this order comes up." },
  { id: "holdIfThreatened", name: "Hold if threatened", description: "Cancel the move if enemy armies next to the launch point grew this turn." },
  { id: "retreatIfOutnumbered", name: "Retreat if outnumbered", description: "If a bigger enemy army sits next to this one, pull back to the safest territory you hold instead." },
  { id: "followThrough", name: "Follow through", description: "If the attack captures its target, push on to the next one (yours to pick, or the weakest neighbour)." },
  { id: "reinforceIfHit", name: "Reinforce if hit", description: "Send these troops only if the destination was attacked earlier this turn." },
];

/**
 * Turn a preset into plain conditions, fallbacks and follow-ups. Applied by the engine when the turn starts,
 * so clients only need to send the preset's name. Presets on order types they don't fit are ignored.
 * Fallbacks and follow-ups are expanded too.
 */
export function expandPreset(order: Order): Order {
  const o: Order = { ...order };
  if (o.fallback) o.fallback = expandPreset(o.fallback);
  if (o.then) o.then = expandPreset(o.then);
  const p = o.preset;
  if (!p) return o;
  const add = (...c: Condition[]) => (o.conditions = [...(o.conditions ?? []), ...c]);

  if (o.kind === "retreat" && p.id === "retreatIfOutnumbered") {
    add({ kind: "outnumbered", territory: o.from });
    return o;
  }
  if (o.kind !== "move") return o;
  switch (p.id) {
    case "onlyIfStronger":
      add({ kind: "odds", atLeast: "likely" });
      break;
    case "holdIfThreatened":
      add({ kind: "enemyNotGrown", territory: o.from });
      break;
    case "retreatIfOutnumbered":
      add({ kind: "not", condition: { kind: "outnumbered", territory: o.from } });
      o.fallback = { id: `${o.id}:retreat`, kind: "retreat", from: o.from, ...(o.fallback ? { fallback: o.fallback } : {}) };
      break;
    case "followThrough":
      o.then = p.next
        ? { id: `${o.id}:next`, kind: "move", from: o.to, to: p.next, troops: "all", conditions: [{ kind: "odds", atLeast: "likely" }] }
        : { id: `${o.id}:next`, kind: "advance", from: o.to };
      break;
    case "reinforceIfHit":
      add({ kind: "attackedThisTurn", territory: o.to });
      break;
  }
  return o;
}
