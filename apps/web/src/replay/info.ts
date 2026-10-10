import type { SpecialistType } from "@conquerra/content";
import type { FxContext } from "./fx/plan";
import { routePoint, type Pt } from "./route";
import { MARCH_SHARE, RESULT_AT, type ClashAnim, type ReplayFrame } from "./timeline";

/**
 * What the replay's info layer shows at a moment (session 21): each army on the move with its troop number, each
 * battle and its result (who holds the land, the losses on each side), what popped up, and the soft pulse for
 * anything in the fog. It's the whole truth of the replay, and it's the same whatever the Effects setting: the
 * figures, banners, dust and smoke (the show) are drawn around it, never instead of it. Map units throughout.
 */

export type ReplayInfo =
  | {
      kind: "army";
      x: number;
      y: number;
      /** Heading on the map (radians), for the figure to face. */
      heading: number;
      player: string;
      troops: number;
      retreat: boolean;
      /** On a sea lane: a ship. */
      sea: boolean;
      cavalry: boolean;
      /** Right of passage: the way through a partner's land. */
      through: boolean;
      progress: number;
      /** The whole way, from the start to where it's going (for the inked campaign line). */
      stops: Pt[];
    }
  | { kind: "fight"; x: number; y: number; attacker: string; defender: string | null; progress: number; from: Pt; target: Pt; troops: number }
  | { kind: "result"; at: string; x: number; y: number; meet: Pt; from: Pt; captured: boolean; attacker: string; defender: string | null; attackerLosses: number; defenderLosses: number; progress: number }
  | { kind: "pop"; x: number; y: number; player: string; label: string; progress: number }
  | { kind: "pulse"; x: number; y: number; progress: number };

/** The clash's share of a battle beat that's fighting (the rest of the clash shows the result). */
export const FIGHT_SHARE = (RESULT_AT - MARCH_SHARE) / (1 - MARCH_SHARE);

export function replayInfo(frame: ReplayFrame, ctx: FxContext, province: (id: string) => Pt | undefined): ReplayInfo[] {
  const out: ReplayInfo[] = [];
  for (const m of frame.marches) {
    const a = ctx.spot(m.from), b = ctx.spot(m.to);
    if (!a || !b) continue;
    const through = (m.through ?? []).map((id) => ctx.spot(id)).filter((p): p is Pt => !!p);
    const last = m.through?.length ? m.through[m.through.length - 1]! : m.from;
    // A battle's march goes as far as the border, where the fight is.
    const end = m.meet ? (ctx.borderPoint(last, m.to) ?? { x: a.x + (b.x - a.x) * 0.6, y: a.y + (b.y - a.y) * 0.6 }) : b;
    const stops = [a, ...through, end];
    const [x, y, heading] = routePoint(stops, m.progress, ctx.bendCap);
    out.push({ kind: "army", x, y, heading, player: m.player, troops: m.troops, retreat: m.retreat, sea: ctx.border(last, m.to) === "sea", cavalry: (m.specialists ?? []).includes("cavalry" as SpecialistType), through: !!m.through?.length, progress: m.progress, stops });
  }
  for (const c of frame.clashes) {
    const item = clashInfo(c, ctx);
    if (item) out.push(item);
  }
  for (const p of frame.pops) {
    const at = ctx.spot(p.at);
    if (at) out.push({ kind: "pop", x: at.x, y: at.y, player: p.player, label: p.label, progress: p.progress });
  }
  for (const p of frame.pulses) {
    const at = province(p.province);
    // Every fogged event looks the same: no colour, no shape, nothing about what it was.
    if (at) out.push({ kind: "pulse", x: at.x, y: at.y, progress: p.progress });
  }
  return out;
}

function clashInfo(c: ClashAnim, ctx: FxContext): ReplayInfo | null {
  const fromId = c.through?.length ? c.through[c.through.length - 1]! : c.from;
  const from = ctx.spot(fromId), target = ctx.spot(c.at);
  if (!from || !target) return null;
  const meet = ctx.borderPoint(fromId, c.at) ?? { x: from.x + (target.x - from.x) * 0.6, y: from.y + (target.y - from.y) * 0.6 };
  if (c.progress < FIGHT_SHARE) return { kind: "fight", x: meet.x, y: meet.y, attacker: c.attacker, defender: c.defender, progress: c.progress / FIGHT_SHARE, from, target, troops: c.troops ?? 0 };
  return { kind: "result", at: c.at, x: target.x, y: target.y, meet, from, captured: c.captured, attacker: c.attacker, defender: c.defender, attackerLosses: c.attackerLosses, defenderLosses: c.defenderLosses, progress: (c.progress - FIGHT_SHARE) / (1 - FIGHT_SHARE) };
}
