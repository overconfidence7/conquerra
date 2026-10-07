import type { GameContext, ReplayEvent, TerritoryId } from "@conquerra/engine";
export { chronicleOf, keepForChronicle } from "./chronicleKeep";
import type { TurnReport } from "../host/protocol";
import { keepForChronicle } from "./chronicleKeep";
import { narrate } from "./narrate";
import { onYourLand } from "./report";
import type { Namer, Tone } from "./text";

/**
 * The Chronicle (session 16, Nate #13): a log of every turn, so nothing that touched you can be missed. It's built
 * from your own turn reports, the same events as your replay, so it only ever holds what you were allowed to see:
 * battles you saw, Fate events (yours, those on your land, those you saw, and "something stirs" in the fog), the
 * Fallen's events, deals made, broken and ended, your spies' news, and your leaders' work. Each line has a place to
 * show on the map.
 */

export type ChronicleKind = "battle" | "fate" | "fallen" | "deal" | "spy" | "leader" | "other";

export interface ChronicleLine {
  text: string;
  tone: Tone;
  kind: ChronicleKind;
  /** Where to show it on the map (a province's first territory for something in the fog), or null. */
  at: TerritoryId | null;
  /** It happened on your land, or to you (shown first and marked). */
  mine: boolean;
}

export interface ChronicleTurn {
  turn: number;
  lines: ChronicleLine[];
}

function kindOf(e: ReplayEvent): ChronicleKind {
  switch (e.type) {
    case "battle":
      return e.general ? "leader" : "battle";
    case "fate":
    case "missionDone":
    case "missionFailed":
      return "fate";
    case "worldEvent":
      return "fallen";
    case "dealStarted":
    case "dealBroken":
    case "dealEnded":
      return "deal";
    case "spy":
    case "spyCaught":
      return "spy";
    case "governed":
    case "generalCaptured":
    case "stewardCaptured":
    case "generalLost":
    case "moved":
    case "recruited":
    case "hired":
    case "built":
    case "invested":
      return "leader";
    case "surface":
      return e.what === "fate" ? "fate" : e.what === "battle" ? "battle" : "other";
    default:
      return "other";
  }
}

function placeOf(ctx: GameContext, e: ReplayEvent): TerritoryId | null {
  switch (e.type) {
    case "battle":
    case "moved":
      return e.to;
    case "fate":
    case "spoilsTurnedIn":
      return e.at;
    case "worldEvent":
      return e.target;
    case "spy":
    case "leaderKilled":
    case "generalCaptured":
    case "generalLost":
    case "recruited":
    case "hired":
    case "built":
    case "invested":
      return e.territory;
    case "dealBroken":
      return e.at ?? null;
    case "missionDone":
      return e.at;
    case "governed":
      return e.land[0]?.territory ?? null;
    case "spyCaught":
    case "surface":
      return ctx.map.territories.find((t) => t.province === e.province)?.id ?? null;
    default:
      return null;
  }
}

/** The Chronicle's lines, newest turn first (in each turn: what touched you first, then the rest as it happened). */
export function chronicleLines(ctx: GameContext, reports: readonly TurnReport[], n: Namer): ChronicleTurn[] {
  const province = (id: string) => ctx.map.provinces.find((p) => p.id === id)?.name ?? "the fog";
  const out: ChronicleTurn[] = [];
  for (const r of [...reports].sort((a, b) => b.turn - a.turn)) {
    const lines: ChronicleLine[] = [];
    // Fighting in the fog: one line per province and kind, with how many ("Battles in Mistreach ×3 (in the fog)").
    const fogged = new Map<string, { line: ChronicleLine; n: number; what: string; province: string }>();
    for (const e of r.events) {
      if (!keepForChronicle(e)) continue;
      let text: string | null = null;
      let tone: Tone = "quiet";
      if (e.type === "surface" && !e.yours) {
        const key = `${e.what}|${e.province}`;
        const f = fogged.get(key);
        if (f) f.n++;
        else {
          const line: ChronicleLine = { text: "", tone: "quiet", kind: kindOf(e), at: placeOf(ctx, e), mine: false };
          fogged.set(key, { line, n: 1, what: e.what, province: province(e.province) });
          lines.push(line);
        }
        continue;
      }
      if (e.type === "surface") {
        text = `Your Fate card: ${e.what === "fate" ? "something stirs" : "a battle"} in ${province(e.province)}`;
        tone = "info";
      } else {
        const line = narrate(ctx, e, n);
        if (line) ({ text, tone } = line);
      }
      if (!text) continue;
      const mine = onYourLand(e, n) || (e.type === "battle" ? n.isMe(e.player) || n.isMe(e.defender) : "player" in e && n.isMe(e.player as string));
      lines.push({ text, tone, kind: kindOf(e), at: placeOf(ctx, e), mine });
    }
    for (const f of fogged.values())
      f.line.text =
        f.what === "battle" ? (f.n > 1 ? `Battles in ${f.province} ×${f.n} (in the fog)` : `A battle in ${f.province} (in the fog)`)
        : f.what === "fate" ? `Something stirs in ${f.province}${f.n > 1 ? ` ×${f.n}` : ""}`
        : `${f.n > 1 ? `${f.n} Leaders fell` : "A Leader fell"} in ${f.province} (in the fog)`;
    // What touched you first: Fate and the Fallen on your land at the very top.
    const rank = (l: ChronicleLine, i: number) => (l.mine && (l.kind === "fate" || l.kind === "fallen") ? 0 : l.mine ? 1 : 2) * 10000 + i;
    out.push({ turn: r.turn, lines: lines.map((l, i) => ({ l, k: rank(l, i) })).sort((a, b) => a.k - b.k).map((x) => x.l) });
  }
  return out.filter((t) => t.lines.length);
}
