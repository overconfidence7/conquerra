import type { GameContext, ReplayEvent } from "@conquerra/engine";
import { narrate, type LogLine, type Namer } from "./text";

/**
 * The turn report, grouped by what matters to you first:
 *   1. yours: your gains and losses (your battles, land taken from you, your Leader, your gold, orders that failed)
 *   2. seen: what you saw others do
 *   3. fog: surface details from the fog ("A battle in Northreach")
 */
export interface GroupedReport {
  yours: LogLine[];
  seen: LogLine[];
  fog: LogLine[];
}

const involvesMe = (e: ReplayEvent, n: Namer): boolean => {
  switch (e.type) {
    case "battle":
      return n.isMe(e.player) || n.isMe(e.defender);
    case "eliminated":
      return n.isMe(e.player) || n.isMe(e.by);
    case "gameOver":
      return true;
    case "surface":
    case "turnStart":
      return false;
    default:
      return "player" in e && n.isMe(e.player);
  }
};

export function groupReport(ctx: GameContext, events: readonly ReplayEvent[], n: Namer): GroupedReport {
  const out: GroupedReport = { yours: [], seen: [], fog: [] };
  const fog = new Map<string, { battles: number; leaders: number }>();
  for (const e of events) {
    if (e.type === "turnStart") continue;
    if (e.type === "surface") {
      const f = fog.get(e.province) ?? { battles: 0, leaders: 0 };
      if (e.what === "battle") f.battles++;
      else f.leaders++;
      fog.set(e.province, f);
      continue;
    }
    const line = narrate(ctx, e, n);
    if (!line) continue;
    (involvesMe(e, n) ? out.yours : out.seen).push(line);
  }
  // Your wins and losses first, then the rest of your news (orders, recruits), with the gold line last.
  const rank = (l: LogLine) => (l.text.startsWith("Income") ? 3 : l.tone === "bad" ? 0 : l.tone === "good" ? 1 : 2);
  out.yours = out.yours.map((l, i) => ({ l, i })).sort((a, b) => rank(a.l) - rank(b.l) || a.i - b.i).map((x) => x.l);
  for (const [prov, f] of fog) {
    const name = ctx.map.provinces.find((p) => p.id === prov)?.name ?? "the fog";
    if (f.battles) out.fog.push({ text: f.battles > 1 ? `Battles in ${name} (${f.battles})` : `A battle in ${name}`, tone: "quiet" });
    if (f.leaders) out.fog.push({ text: `A Leader fell in ${name}`, tone: "quiet" });
  }
  return out;
}
