import type { GameContext, ReplayEvent, SeenTerritory, VisionEvent } from "@conquerra/engine";
import { BUILDING_NAME, narrate, type LogLine, type Namer } from "./text";

/**
 * The turn report, grouped by what matters to you first:
 *   1. yours: your gains and losses (your battles, land taken from you, your Leader, your gold, orders that failed)
 *   2. seen: what you saw others do
 *   3. fog: what came out of the fog: land first seen during the turn (as your armies advanced), then surface
 *      details of fighting you couldn't see ("A battle in Northreach")
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
    case "vision":
      return false;
    default:
      return "player" in e && n.isMe(e.player);
  }
};

export function groupReport(ctx: GameContext, events: readonly ReplayEvent[], n: Namer): GroupedReport {
  const out: GroupedReport = { yours: [], seen: [], fog: [] };
  const fog = new Map<string, { battles: number; leaders: number }>();
  out.fog.push(...revealedLines(ctx, events.filter((e): e is VisionEvent => e.type === "vision"), n));
  for (const e of events) {
    if (e.type === "turnStart" || e.type === "vision") continue;
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

/** Most land named in one line before it's summed up ("and 3 more"). */
const MAX_NAMED = 4;

const listNames = (names: string[]) => {
  const shown = names.slice(0, MAX_NAMED);
  const more = names.length - shown.length;
  const head = shown.length > 1 ? `${shown.slice(0, -1).join(", ")} and ${shown.at(-1)}` : (shown[0] ?? "");
  return more > 0 ? `${shown.join(", ")} and ${more} more` : head;
};

/**
 * Land that came into view during the turn, as it was when you first saw it: rival armies (grouped by House), their
 * capitals and Leaders, and how much neutral land opened up. Being knocked out lifts the fog off everything; that
 * gets one line instead of a list.
 */
function revealedLines(ctx: GameContext, visions: VisionEvent[], n: Namer): LogLine[] {
  const first = new Map<string, SeenTerritory>();
  for (const v of visions) for (const [id, seen] of Object.entries(v.revealed)) if (!first.has(id)) first.set(id, seen);
  if (!first.size) return [];
  if (first.size >= ctx.map.territories.length / 2 && visions[0]?.step === 0) return [{ text: "The fog has lifted: you can see the whole map.", tone: "info" }];
  const lines: LogLine[] = [];
  const byOwner = new Map<string, string[]>();
  let neutral = 0;
  for (const [id, t] of first) {
    if (!t.owner) {
      neutral++;
      continue;
    }
    if (n.isMe(t.owner)) continue;
    const extras = [`${t.troops}`, ...(t.building ? [BUILDING_NAME[t.building].toLowerCase()] : [])];
    (byOwner.get(t.owner) ?? byOwner.set(t.owner, []).get(t.owner)!).push(`${n.place(id)} (${extras.join(", ")})`);
  }
  for (const [owner, places] of byOwner) lines.push({ text: `Spotted ${n.who(owner)} at ${listNames(places)}.`, tone: "info" });
  for (const [id, t] of first) {
    if (t.capitalOf && !n.isMe(t.capitalOf)) lines.push({ text: `Found ${n.who(t.capitalOf)}'s capital: ${n.place(id)}.`, tone: "good" });
    for (const p of t.leaders) if (!n.isMe(p)) lines.push({ text: `${n.who(p)}'s Leader is at ${n.place(id)}.`, tone: "info" });
  }
  if (neutral) lines.push({ text: neutral === 1 ? "1 neutral territory came into view." : `${neutral} neutral territories came into view.`, tone: "quiet" });
  return lines;
}
