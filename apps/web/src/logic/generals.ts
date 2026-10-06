import type { GameContext, Instruction, InstructionKind, Order, PlayerId, PlayerView, TerritoryId } from "@conquerra/engine";

/**
 * Generals on the page (session 12). Small and pure, so the tap count and "taking control back" are tested without a
 * screen. The orders themselves are written by the host (the bots' general planner), never here.
 */

/** Where one of your generals stands: your Leader (while alive), or a captured general (by whose Leader it was). */
export function generalAt(view: PlayerView, general: PlayerId): TerritoryId | null {
  if (general === view.me.id) return view.me.leader.alive ? view.me.leader.territory : null;
  return view.me.captured.find((g) => g.of === general)?.territory ?? null;
}

/** Your generals: your Leader first, then captured ones. */
export const myGenerals = (view: PlayerView): PlayerId[] => [view.me.id, ...view.me.captured.map((g) => g.of)];

/** The general of yours standing in `t` (your Leader first), or null. */
export const generalIn = (view: PlayerView, t: TerritoryId | null): PlayerId | null => (t ? (myGenerals(view).find((g) => generalAt(view, g) === t) ?? null) : null);

/** A general's standing instruction as the game has it (before any change this turn). */
export function standing(view: PlayerView, general: PlayerId): Instruction | null {
  if (general === view.me.id) return view.me.command;
  return view.me.captured.find((g) => g.of === general)?.instruction ?? null;
}

/** The territory an order sends troops out of (moves, retreats, advances). */
export const launchesFrom = (o: Order): TerritoryId | null => (o.kind === "move" || o.kind === "retreat" || o.kind === "advance" ? o.from : null);

/** Instructions you changed this turn, as orders (they're applied as the turn starts and take no slot). */
export function instructOrders(view: PlayerView, instructions: Record<PlayerId, Instruction | null>): Order[] {
  return Object.entries(instructions)
    .filter(([g, i]) => JSON.stringify(i) !== JSON.stringify(standing(view, g)))
    .map(([g, i]) => ({ id: `instruct-${g}`, kind: "instruct", general: g, instruction: i }) as Order);
}

/**
 * You added an order of your own. If it goes out of a general's territory, you take that army back for the turn:
 * the general's orders all go (and it's marked paused). If it goes out of a territory a general meant to pull troops
 * from, just that order goes.
 */
export function takeControl(view: PlayerView, queue: readonly Order[], added: Order, paused: readonly PlayerId[]): { queue: Order[]; paused: PlayerId[] } {
  const from = launchesFrom(added);
  if (!from) return { queue: [...queue], paused: [...paused] };
  const g = generalIn(view, from);
  const nowPaused = g && !paused.includes(g) ? [...paused, g] : [...paused];
  return {
    queue: queue.filter((o) => !o.general || (o.general !== g && launchesFrom(o) !== from)),
    paused: nowPaused,
  };
}

/**
 * Your queue as it would be if you gave an order out of `from` yourself: a general standing there steps aside (so
 * its troops show as free to move while you draft the order), and so does any order a general meant to send from there.
 */
export function asIfYouOrderFrom(view: PlayerView, queue: readonly Order[], from: TerritoryId | null): Order[] {
  if (!from) return [...queue];
  return takeControl(view, queue, { id: "draft", kind: "retreat", from }, []).queue;
}

/**
 * The host's fresh orders for your generals go in front of your own (they lead the main armies), leaving out paused
 * generals and any order out of a territory you've given an order of your own.
 */
export function withGeneralOrders(queue: readonly Order[], fresh: readonly Order[], paused: readonly PlayerId[]): Order[] {
  const own = queue.filter((o) => !o.general);
  const ownFrom = new Set(own.map(launchesFrom).filter(Boolean));
  const timings = new Set(own.map((o) => o.timing).filter(Boolean));
  const kept = fresh
    .filter((o) => !paused.includes(o.general!) && !(launchesFrom(o) && ownFrom.has(launchesFrom(o))))
    .map((o) => (o.timing && timings.has(o.timing) ? ({ ...o, timing: undefined } as Order) : o));
  return [...kept, ...own];
}

/** The four instructions in plain words, for the Command panel. */
export const INSTRUCTIONS: { kind: InstructionKind; name: string; help: string; needs: "nothing" | "place" | "rival" | "rivalOrPlace" }[] = [
  { kind: "hold", name: "Hold here", help: "Keep this territory, and pull in troops from next door if it's threatened.", needs: "nothing" },
  { kind: "defend", name: "Defend this border", help: "Guard the border with a rival (or toward a place): hold it and hit back.", needs: "rivalOrPlace" },
  { kind: "push", name: "Push toward a place", help: "March toward a place you pick, taking land along the way.", needs: "place" },
  { kind: "raid", name: "Raid a rival", help: "Take a rival's weakly held land and keep clear of its big armies.", needs: "rival" },
  {
    kind: "govern",
    name: "Govern this province",
    help: "Hold the province, and spend a quarter of its income on it: a fort where it's threatened, else culture, else troops.",
    needs: "nothing",
  },
];

/** Can this general govern where it stands: a province where you hold most of the land (from your view)? */
export function canGovernHere(ctx: GameContext, view: PlayerView, at: TerritoryId | null): boolean {
  if (!at) return false;
  const province = ctx.map.territories.find((t) => t.id === at)?.province;
  const members = ctx.map.territories.filter((t) => t.province === province);
  const mine = members.filter((t) => {
    const v = view.territories[t.id];
    return v?.detail === "full" && v.owner === view.me.id;
  });
  return members.length > 0 && mine.length * 2 > members.length;
}
