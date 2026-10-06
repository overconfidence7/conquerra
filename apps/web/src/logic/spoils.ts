import { indexMap, setsIn, type GameContext, type Order, type PlayerView, type SpoilsSet, type TerritoryId } from "@conquerra/engine";
import { SET_NAME, troopWord, windfallText } from "./cards";
import type { Namer } from "./text";

/**
 * The Spoils hand on screen (session 13): which sets you can turn in, and where each one's windfall would go. Turning
 * a set in takes 2 taps (the card stack, then the set); a Tower or Laurel set goes on the territory you have selected
 * if it can, else the sensible place (a fort on your most threatened land without a building; culture at home).
 */
export interface SetChoice {
  set: SpoilsSet;
  territory?: TerritoryId;
  /** "Three Towers: a fort and 3 troops at Galeholt". */
  label: string;
  /** What it gives, in general ("a finished fort and 3 troops on land you choose"). */
  help: string;
}

const seenMine = (view: PlayerView, t: TerritoryId) => {
  const v = view.territories[t];
  return v?.detail === "full" && v.owner === view.me.id ? v : null;
};

export function setChoices(ctx: GameContext, view: PlayerView, selected: TerritoryId | null, n: Namer): SetChoice[] {
  const idx = indexMap(ctx.map);
  const mine = idx.ids.filter((t) => seenMine(view, t));
  const home = seenMine(view, view.me.capital) ? view.me.capital : [...mine].sort((a, b) => (seenMine(view, b)!.troops - seenMine(view, a)!.troops) || (a < b ? -1 : 1))[0];
  const free = (t: TerritoryId) => {
    const v = seenMine(view, t);
    return !!v && !v.building && !v.construction;
  };
  const threat = (t: TerritoryId) => {
    let big = 0;
    for (const x of idx.neighbors.get(t) ?? []) {
      const v = view.territories[x];
      if (v?.detail === "full" && v.owner && v.owner !== view.me.id) big = Math.max(big, v.troops);
    }
    return big - (seenMine(view, t)?.troops ?? 0);
  };
  const out: SetChoice[] = [];
  for (const set of setsIn(view.me.spoils)) {
    const help = windfallText(ctx, set);
    if (set === "tower") {
      const at = selected && free(selected) ? selected : mine.filter(free).sort((a, b) => threat(b) - threat(a) || (a < b ? -1 : 1))[0];
      if (!at) continue;
      out.push({ set, territory: at, help, label: `${SET_NAME[set]}: a fort and ${troopWord(ctx.rules.spoils.tower.garrison)} at ${n.place(at)}` });
    } else if (set === "laurel") {
      const at = selected && seenMine(view, selected) ? selected : home;
      if (!at) continue;
      const prov = ctx.map.provinces.find((p) => p.id === idx.byId.get(at)?.province)?.name ?? "that province";
      out.push({ set, territory: at, help, label: `${SET_NAME[set]}: culture in ${prov} (from ${n.place(at)})` });
    } else out.push({ set, help, label: `${SET_NAME[set]}: ${help}` });
  }
  return out;
}

/** At the hand limit you must turn a set in this turn. */
export const handFull = (ctx: GameContext, view: PlayerView) => view.settings.spoils && view.me.spoils.length >= ctx.rules.spoils.handLimit;

/** The queue with this set turned in first (it replaces any turn-in already queued). */
export function withTurnIn(queue: readonly Order[], c: { set: SpoilsSet; territory?: TerritoryId }, id: string): Order[] {
  const order = { id, kind: "spoils", set: c.set, ...(c.territory ? { territory: c.territory } : {}) } as Order;
  return [order, ...queue.filter((o) => o.kind !== "spoils")];
}

/**
 * A new turn with a full hand: the sensible set goes in automatically (first in your queue, where you can see it,
 * change it or delete it). If you delete it, the game still turns one in for you as the turn ends.
 */
export function dueTurnIn(ctx: GameContext, view: PlayerView, queue: readonly Order[], n: Namer, id: string): Order[] {
  if (!handFull(ctx, view) || queue.some((o) => o.kind === "spoils")) return [...queue];
  const pick = ["sword", "mixed", "tower", "laurel"].map((s) => setChoices(ctx, view, null, n).find((c) => c.set === s)).find(Boolean);
  return pick ? withTurnIn(queue, pick, id) : [...queue];
}
