import type { GameContext, ReplayEvent, SeenTerritory, VisionEvent } from "@conquerra/engine";
import { headStartsLine } from "./turnWords";
import { BUILDING_NAME, startBonusLine, type LogLine, type Namer } from "./text";
import { mergePurchases, turnNarrator } from "./narrate";

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

/** A Fate or Fallen event that struck your own land (session 16: loud: the top of the report, a banner in the replay). */
export const onYourLand = (e: ReplayEvent, n: Pick<Namer, "isMe">): boolean => (e.type === "fate" && n.isMe(e.holder)) || (e.type === "worldEvent" && n.isMe(e.against));

const involvesMe = (e: ReplayEvent, n: Namer): boolean => {
  switch (e.type) {
    case "battle":
      return n.isMe(e.player) || n.isMe(e.defender);
    case "eliminated":
      return n.isMe(e.player) || n.isMe(e.by);
    case "gameOver":
      return true;
    // A world event on your land, or one you (one of the Fallen) put Influence toward.
    case "worldEvent":
      return n.isMe(e.against) || e.by.some((p) => n.isMe(p));
    case "generalLost":
      return n.isMe(e.player) || n.isMe(e.by);
    // A Fate event on your land, or one you drew.
    case "fate":
      return n.isMe(e.holder) || n.isMe(e.drawer);
    // Your own Fate card, fallen in the fog.
    case "surface":
      return !!e.yours;
    case "turnStart":
    case "vision":
      return false;
    default:
      return "player" in e && n.isMe(e.player);
  }
};

export function groupReport(ctx: GameContext, events: readonly ReplayEvent[], n: Namer): GroupedReport {
  const out: GroupedReport = { yours: [], seen: [], fog: [] };
  const top: LogLine[] = [];
  // The first turn's report: your capital's head start, if it had one (session 23).
  const first = events.some((e) => e.type === "turnStart" && e.turn === 1);
  const bonus = n.view && first ? startBonusLine(n.view, n.place) : null;
  // (Session 33: and everyone else's, since a random map gives most spots one.)
  const others = n.view && first ? headStartsLine(n.view) : null;
  const fog = new Map<string, { battles: number; leaders: number; stirs: number }>();
  out.fog.push(...revealedLines(ctx, events.filter((e): e is VisionEvent => e.type === "vision"), n));
  // (Your purses' payments go on your income line, as in the replay's log.)
  const say = turnNarrator(ctx, events, n);
  for (const e of mergePurchases(events)) {
    if (e.type === "turnStart" || e.type === "vision") continue;
    if (e.type === "surface" && !e.yours) {
      const f = fog.get(e.province) ?? { battles: 0, leaders: 0, stirs: 0 };
      if (e.what === "battle") f.battles++;
      else if (e.what === "fate") f.stirs++;
      else f.leaders++;
      fog.set(e.province, f);
      continue;
    }
    const line = say(e);
    if (!line) continue;
    if (onYourLand(e, n)) top.push(line);
    else (involvesMe(e, n) ? out.yours : out.seen).push(line);
  }
  // Fate and the Fallen on your land first (they're easy to miss), then your wins and losses, then the rest of your
  // news (orders, recruits), with the gold line last.
  const rank = (l: LogLine) => (l.text.startsWith("Income") ? 3 : l.tone === "bad" ? 0 : l.tone === "good" ? 1 : 2);
  // (The head start, session 23, after any Fate or Fallen news on your land.)
  out.yours = [...top, ...(bonus ? [{ text: bonus, tone: "info" as const }] : []), ...(others ? [{ text: others, tone: "info" as const }] : []), ...out.yours.map((l, i) => ({ l, i })).sort((a, b) => rank(a.l) - rank(b.l) || a.i - b.i).map((x) => x.l)];
  for (const [prov, f] of fog) {
    const name = ctx.map.provinces.find((p) => p.id === prov)?.name ?? "the fog";
    if (f.battles) out.fog.push({ text: f.battles > 1 ? `Battles in ${name} (${f.battles})` : `A battle in ${name}`, tone: "quiet" });
    if (f.leaders) out.fog.push({ text: `A Leader fell in ${name}`, tone: "quiet" });
    if (f.stirs) out.fog.push({ text: `Something stirs in ${name}`, tone: "quiet" });
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
