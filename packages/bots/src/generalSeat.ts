import { distancesFrom, type Instruction, type Order, type PlayerId, type TerritoryId } from "@conquerra/engine";
import { CAPTAIN_CHAIN_MARGIN, readBoard, type Board, type CaptainOptions } from "./board";
import { makeCaptainBot } from "./captain";
import { generalAt, launchesFrom, planGeneral } from "./generals";
import type { Bot } from "./recruit";

/**
 * For the simulator: a seat that plays like the Captain, except that its Leader's army runs on a standing
 * instruction of one kind, as a person who handed their Leader that instruction would, once it makes sense (until
 * then the Captain commands that army too). The target (a place or a rival) is picked from the seat's own view, and
 * kept while it still makes sense:
 *  - Hold: while the Leader's territory is threatened (a rival army next door could take it).
 *  - Defend: once we border a rival: the one with the most troops facing us.
 *  - Push: the nearest rival capital we can see, else the nearest land we know a rival holds, else (nobody met yet)
 *    the most valuable land 3 to 5 steps away.
 *  - Raid: once we know where a rival is: the weakest we border, else the nearest we know of.
 * Generals are for a realm too big to run by hand, so it hands out instructions from turn GENERAL_FROM_TURN (before
 * that it's the Captain). The Captain's orders out of the general's territory step aside (the general commands that army); everything else,
 * spending included, is the Captain's.
 */
/** The seat starts commanding through its general from this turn (a person would, once the realm has grown). */
export const GENERAL_FROM_TURN = 6;

/** The session 12 instructions a general seat plays with. */
export type GeneralSeatKind = "hold" | "defend" | "push" | "raid";

export function makeGeneralSeat(kind: GeneralSeatKind, opts: CaptainOptions = { chainMargin: CAPTAIN_CHAIN_MARGIN }): Bot {
  const captain = makeCaptainBot(opts);
  return {
    id: `general-${kind}`,
    name: `Captain with a ${kind} general`,
    plan(ctx, view, lastTurn) {
      const own = captain.plan(ctx, view, lastTurn);
      const b = readBoard(ctx, view, opts, lastTurn);
      const home = generalAt(view, view.me.id);
      if (!b || !home || view.turn < GENERAL_FROM_TURN) return own;
      const command = view.me.leaders.find((l) => l.kind === "leader" && l.of === view.me.id)?.command ?? null;
      const instruction = chooseInstruction(b, kind, home, command);
      const off: Order[] = command ? [{ id: `${view.me.id}-t${view.turn}-instruct`, kind: "instruct", general: view.me.id, instruction: null }] : [];
      if (!instruction) return [...off, ...own];
      const general = planGeneral(ctx, view, view.me.id, instruction, lastTurn, opts);
      // The general commands its army; the Captain's other orders keep their own armies (a pull-in from one of them steps aside).
      // Nor do two armies go for the same land: the Captain's attacks on land the general is taking (and hops on from there) step aside.
      const ours = (t: TerritoryId) => b.owned(t);
      const taking = new Set(general.map((o) => (o.kind === "move" && !ours(o.to) ? o.to : null)).filter(Boolean));
      const rest = own.filter((o) => launchesFrom(o) !== home && !(o.kind === "move" && (taking.has(o.to) || taking.has(o.from))));
      const busy = new Set(rest.map(launchesFrom));
      const timings = new Set(rest.map((o) => o.timing).filter(Boolean));
      const kept = general.filter((o) => launchesFrom(o) === home || !busy.has(launchesFrom(o))).map((o) => (o.timing && timings.has(o.timing) ? { ...o, timing: undefined } : o));
      const same = JSON.stringify(instruction) === JSON.stringify(command);
      const instruct: Order[] = same ? [] : [{ id: `${view.me.id}-t${view.turn}-instruct`, kind: "instruct", general: view.me.id, instruction }];
      return [...instruct, ...kept, ...rest];
    },
  };
}

/** A sensible instruction of this kind for the seat's Leader, from its own view: the current one if it still fits. */
export function chooseInstruction(b: Board, kind: GeneralSeatKind, home: TerritoryId, current: Instruction | null): Instruction | null {
  const { idx, alive, look0, me, facing, knownLand } = b;
  const living = (p: PlayerId) => p !== me.id && alive.some((x) => x.id === p);
  const fromHome = distancesFrom(idx, home);
  /** The nearest land we know `p` holds (or any rival, if `p` is null), and how far it is. */
  const nearest = (p: PlayerId | null) =>
    idx.ids
      .filter((t) => {
        const o = look0(t);
        return o !== null && o !== me.id && (p === null ? living(o) : o === p);
      })
      .sort((x, y) => (fromHome.get(x) ?? 1e9) - (fromHome.get(y) ?? 1e9) || (x < y ? -1 : 1))[0] ?? null;
  const nearestRival = () => {
    const t = nearest(null);
    return t ? look0(t) : null;
  };
  switch (kind) {
    case "hold":
      return b.holdNeed(home) > b.troopsAt(home) ? { kind: "hold" } : null;
    case "defend": {
      if (current?.kind === "defend" && "player" in current && living(current.player) && facing.has(current.player)) return current;
      const r = [...facing].sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1))[0]?.[0];
      return r ? { kind: "defend", player: r } : null;
    }
    case "push": {
      if (current?.kind === "push" && !b.owned(current.territory)) return current;
      const capital = idx.ids
        .filter((t) => {
          const c = b.seen(t)?.capitalOf;
          return !!c && c !== me.id;
        })
        .sort((x, y) => (fromHome.get(x) ?? 1e9) - (fromHome.get(y) ?? 1e9) || (x < y ? -1 : 1))[0];
      // Nobody met yet: the most valuable land a few steps out.
      const out = idx.ids
        .filter((t) => !b.owned(t) && (fromHome.get(t) ?? 0) >= 3 && (fromHome.get(t) ?? 9) <= 5)
        .sort((x, y) => b.valueOf(y) - b.valueOf(x) || (fromHome.get(x) ?? 0) - (fromHome.get(y) ?? 0) || (x < y ? -1 : 1))[0];
      const t = capital ?? nearest(null) ?? out;
      return t ? { kind: "push", territory: t } : null;
    }
    case "raid": {
      if (current?.kind === "raid" && living(current.player) && knownLand.has(current.player)) return current;
      const r = [...facing.keys()].sort((x, y) => (knownLand.get(x) ?? 0) - (knownLand.get(y) ?? 0) || (x < y ? -1 : 1))[0] ?? nearestRival();
      return r ? { kind: "raid", player: r } : null;
    }
  }
}
