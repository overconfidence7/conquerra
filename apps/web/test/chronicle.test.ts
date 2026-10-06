import { maps } from "@conquerra/content/maps";
import type { ReplayEvent } from "@conquerra/engine";
import { recruitBot } from "@conquerra/bots";
import { describe, expect, it } from "vitest";
import { LocalGame } from "../src/host/localGame";
import type { LobbySettings } from "../src/host/protocol";
import { chronicleLines, chronicleOf, keepForChronicle } from "../src/logic/chronicle";
import { groupReport } from "../src/logic/report";
import { namer } from "../src/logic/text";
import { toastFor } from "../src/replay/toasts";

const settings: LobbySettings = { mapId: "embervale", bots: 3, botLevel: "captain", luck: 0.3, fog: true, mode: "classic", turnSeconds: null };

function played(turns: number) {
  const g = new LocalGame(maps.embervale!, settings, "chronicle");
  let u = g.update();
  const reports = [];
  for (let i = 0; i < turns && !u.view.winner && u.view.me.eliminatedTurn === null; i++) {
    u = g.lockIn(recruitBot.plan(g.ctx, u.view));
    if (u.report) reports.push(u.report);
  }
  return { g, u, reports };
}

describe("the Chronicle (session 16)", () => {
  it("keeps every turn's report, only what the Chronicle shows, and saves it with the game", () => {
    const { g, reports } = played(8);
    const saved = g.snapshot();
    const kept = (saved.host as { chronicle: { turn: number; events: ReplayEvent[] }[] }).chronicle;
    expect(kept.map((r) => r.turn)).toEqual(reports.map((r) => r.turn));
    // Trimmed: no vision snapshots, incomes or recruits; and only events from your own report (never more).
    for (const [i, r] of kept.entries()) {
      expect(r.events.every(keepForChronicle)).toBe(true);
      expect(r.events).toEqual(reports[i]!.events.filter(keepForChronicle));
    }
    // A loaded game brings it back.
    const again = new LocalGame(maps.embervale!, settings, "x", undefined, { restore: saved });
    expect(again.start().chronicle).toEqual(kept);
  });

  it("each turn's lines come newest first, with what touched you on top, and a place to show for each", () => {
    const { g, u, reports } = played(10);
    const n = namer(g.ctx, u.view);
    const turns = chronicleLines(g.ctx, reports.map(chronicleOf), n);
    expect(turns.length).toBeGreaterThan(3);
    expect(turns.map((t) => t.turn)).toEqual([...turns.map((t) => t.turn)].sort((a, b) => b - a));
    for (const t of turns) {
      const firstNotMine = t.lines.findIndex((l) => !l.mine);
      if (firstNotMine >= 0) expect(t.lines.slice(firstNotMine).every((l) => !l.mine)).toBe(true);
      for (const l of t.lines) if (l.kind === "battle" || l.kind === "fate" || l.kind === "fallen") expect(l.at).not.toBeNull();
    }
  });

  it("only what you were allowed to see: fighting in the fog is just a battle somewhere in a province", () => {
    const { g, u, reports } = played(10);
    const n = namer(g.ctx, u.view);
    const surfaces = reports.flatMap((r) => r.events).filter((e) => e.type === "surface" && e.what === "battle");
    const lines = chronicleLines(g.ctx, reports.map(chronicleOf), n).flatMap((t) => t.lines);
    // One line per province a turn: "A battle in Mistreach (in the fog)", or "Battles in Mistreach ×3 (in the fog)".
    if (surfaces.length) expect(lines.some((l) => /^(A battle|Battles) in .* \(in the fog\)$/.test(l.text))).toBe(true);
    expect(lines.filter((l) => / \(in the fog\)$/.test(l.text)).every((l) => !/\d+ troop/.test(l.text))).toBe(true);
    // Every battle line is from a battle in your own report.
    const battles = reports.flatMap((r) => r.events).filter((e) => e.type === "battle").length;
    expect(lines.filter((l) => l.kind === "battle").length).toBeLessThanOrEqual(battles + surfaces.length);
  });
});

describe("louder Fate and Fallen moments (session 16)", () => {
  const g = new LocalGame(maps.embervale!, settings, "loud");
  const view = g.update().view;
  const n = namer(g.ctx, view);
  const me = view.me.id;
  const spot = view.me.capital;
  const plague = { type: "worldEvent", step: 1, event: "plague", target: spot, against: me, by: ["bot1"], spent: 6, losses: [{ territory: spot, troops: 2 }] } as unknown as ReplayEvent;
  const fate = { type: "fate", step: 2, drawer: "bot2", card: "fire", at: spot, holder: me, tone: "bad", shrugged: false, land: [] } as unknown as ReplayEvent;

  it("the Fallen aiming at you say so, at the top of the report", () => {
    const r = groupReport(g.ctx, [{ type: "turnStart", step: 0, turn: 1, seats: [] } as unknown as ReplayEvent, fate, plague], n);
    expect(r.yours[0]!.text).toMatch(/^Fate|^A |fire/i);
    expect(r.yours.some((l) => l.text.startsWith(`The Fallen have turned on you: a plague in ${n.place(spot)}.`))).toBe(true);
    expect(r.yours.slice(0, 2).map((l) => l.tone)).toEqual(["bad", "bad"]);
  });

  it("an event on your land is a banner in the replay", () => {
    expect(toastFor(g.ctx, view, plague)).toMatchObject({ banner: true, text: `The Fallen have turned on you: a plague in ${n.place(spot)}` });
    expect(toastFor(g.ctx, view, fate)).toMatchObject({ banner: true });
    expect(toastFor(g.ctx, view, { ...fate, holder: "bot1" } as ReplayEvent)?.banner).toBeUndefined();
  });
});
