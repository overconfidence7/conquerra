import { findLeader, leaderAt, leaderKey, type Instruction, type InstructionKind, type LeaderKind, type LeaderRef, type Order, type PlayerId, type PlayerView, type TerritoryId } from "@conquerra/engine";

/**
 * Leaders on the page (session 12's generals, grown in session 18). Small and pure, so the tap count and "your orders
 * come first" are tested without a screen. The leaders' orders themselves are written by the host (the bots' leader
 * planner), never here.
 */

/** "leader:you" -> { kind: "leader", of: "you" }. */
export function refFromKey(key: string): LeaderRef {
  const i = key.indexOf(":");
  return { kind: key.slice(0, i) as LeaderKind, of: key.slice(i + 1) };
}

/** Where one of your military leaders stands: your Leader (while alive), or a captured one (by whose Leader it was). */
export function generalAt(view: PlayerView, general: PlayerId): TerritoryId | null {
  return leaderAt(view.me, { kind: "leader", of: general });
}

/** Your military leaders: your Leader first, then captured ones. */
export const myGenerals = (view: PlayerView): PlayerId[] => [view.me.id, ...view.me.captured.map((g) => g.of)];

/** The military leader of yours standing in `t` (your Leader first), or null. */
export const generalIn = (view: PlayerView, t: TerritoryId | null): PlayerId | null => (t ? (myGenerals(view).find((g) => generalAt(view, g) === t) ?? null) : null);

/** A leader's command as the game has it (before any change this turn). `key`: a leader key, or a military leader's id. */
export function standing(view: PlayerView, key: string): Instruction | null {
  const ref = key.includes(":") ? refFromKey(key) : { kind: "leader" as const, of: key };
  return findLeader(view.me, ref)?.command ?? null;
}

/** The territory an order sends troops out of (moves, retreats, advances). */
export const launchesFrom = (o: Order): TerritoryId | null => (o.kind === "move" || o.kind === "retreat" || o.kind === "advance" ? o.from : null);

/** Was this order written by one of your leaders (its purse pays), not by you? */
export const byLeader = (o: Order): boolean => !!o.general || !!o.steward;
/** The key of the leader that wrote an order ("leader:you"), or null for yours. */
export const authorKey = (o: Order): string | null => (o.steward ? `steward:${o.steward}` : o.general ? `leader:${o.general}` : null);

/** Commands you changed this turn, as orders (they're applied as the turn starts and take no slot). */
export function instructOrders(view: PlayerView, instructions: Record<string, Instruction | null>): Order[] {
  return Object.entries(instructions)
    .filter(([k, i]) => JSON.stringify(i) !== JSON.stringify(standing(view, k)))
    .map(([k, i]) => {
      const r = k.includes(":") ? refFromKey(k) : { kind: "leader" as const, of: k };
      return { id: `instruct-${r.kind}-${r.of}`, kind: "instruct", general: r.of, ...(r.kind === "steward" ? { role: "steward" } : {}), instruction: i } as Order;
    });
}

/** A command that leads one army (the leader's own): yours to take back by ordering that army. */
const leadsOneArmy = (i: Instruction | null) => i?.kind === "hold" || i?.kind === "defend" || i?.kind === "push" || i?.kind === "raid";

/**
 * You added an order of your own: your orders come first. An order out of a territory takes that army back from its
 * leader for the turn: a leader leading that one army (Hold, Defend, Push, Raid) steps aside altogether (it's marked
 * paused); a leader with a wider command loses just its orders out of that territory. A build or culture of yours on a
 * place takes it back from a Steward.
 */
export function takeControl(view: PlayerView, queue: readonly Order[], added: Order, paused: readonly string[], instructions: Record<string, Instruction | null> = {}): { queue: Order[]; paused: string[] } {
  const from = launchesFrom(added);
  const place = added.kind === "build" || added.kind === "invest" ? added.territory : null;
  if (!from && !place) return { queue: [...queue], paused: [...paused] };
  const g = from ? generalIn(view, from) : null;
  const key = g ? leaderKey({ kind: "leader", of: g }) : null;
  const command = key ? (key in instructions ? instructions[key]! : standing(view, key)) : null;
  const pause = key && leadsOneArmy(command) ? key : null;
  return {
    queue: queue.filter((o) => {
      if (!byLeader(o)) return true;
      if (pause && authorKey(o) === pause) return false;
      if (from && launchesFrom(o) === from) return false;
      if (place && o.steward && (o.kind === "build" || o.kind === "invest") && o.territory === place) return false;
      return true;
    }),
    paused: pause && !paused.includes(pause) ? [...paused, pause] : [...paused],
  };
}

/**
 * Your queue as it would be if you gave an order out of `from` yourself: a leader's orders from there step aside (so
 * its troops show as free to move while you draft the order).
 */
export function asIfYouOrderFrom(view: PlayerView, queue: readonly Order[], from: TerritoryId | null): Order[] {
  if (!from) return [...queue];
  return takeControl(view, queue, { id: "draft", kind: "retreat", from }, []).queue;
}

/** Where your leaders' orders go in your queue (Nate's setting): mixed in with yours, or after yours. */
export type LeaderPlacement = "mixed" | "after";

/**
 * Your queue in the order it plays: your own orders as you set them, with your leaders' orders mixed in (one of yours,
 * then one of theirs) or after yours.
 */
export function arrangeQueue(queue: readonly Order[], placement: LeaderPlacement): Order[] {
  const own = queue.filter((o) => !byLeader(o));
  const theirs = queue.filter(byLeader);
  if (placement === "after") return [...own, ...theirs];
  const out: Order[] = [];
  for (let i = 0; i < Math.max(own.length, theirs.length); i++) {
    if (own[i]) out.push(own[i]!);
    if (theirs[i]) out.push(theirs[i]!);
  }
  return out;
}

/**
 * The host's fresh orders for your leaders replace their old ones in your queue, leaving out paused leaders, any order
 * out of a territory you've given an order of your own, and a Steward's purchase on a place you've built or raised
 * culture on yourself. Seize the Initiative and Lie in Wait stay yours.
 */
export function withGeneralOrders(queue: readonly Order[], fresh: readonly Order[], paused: readonly string[]): Order[] {
  const own = queue.filter((o) => !byLeader(o));
  const ownFrom = new Set(own.map(launchesFrom).filter(Boolean));
  const places = new Set(own.flatMap((o) => (o.kind === "build" || o.kind === "invest" ? [o.territory] : [])));
  const timings = new Set(own.map((o) => o.timing).filter(Boolean));
  const kept = fresh
    .filter((o) => !paused.includes(authorKey(o) ?? "") && !(launchesFrom(o) && ownFrom.has(launchesFrom(o))) && !(o.steward && (o.kind === "build" || o.kind === "invest") && places.has(o.territory)))
    .map((o) => (o.timing && timings.has(o.timing) ? ({ ...o, timing: undefined } as Order) : o));
  return [...kept, ...own];
}

/** The four session 12 instructions in plain words (the Command menu's first row; session 18's menus add the rest). */
export const INSTRUCTIONS: { kind: InstructionKind; name: string; help: string; needs: "nothing" | "place" | "rival" | "rivalOrPlace" }[] = [
  { kind: "hold", name: "Hold here", help: "Keep this territory, and pull in troops from next door if it's threatened.", needs: "nothing" },
  { kind: "defend", name: "Defend this border", help: "Guard the border with a rival (or toward a place): hold it and hit back.", needs: "rivalOrPlace" },
  { kind: "push", name: "Push toward a place", help: "March toward a place you pick, taking land along the way.", needs: "place" },
  { kind: "raid", name: "Raid a rival", help: "Take a rival's weakly held land and keep clear of its big armies.", needs: "rival" },
];
