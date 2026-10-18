import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { recruitBot } from "@conquerra/bots";
import { createGame, replayFor, resolveTurn, viewFor, type GameContext, type PlayerView, type ReplayEvent } from "@conquerra/engine";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { fateLine } from "../src/logic/cards";
import { narrateTurn } from "../src/logic/narrate";
import { groupReport } from "../src/logic/report";
import { namer } from "../src/logic/text";
import { groupOutlines } from "../src/map/shapes";
import { CLOUD, isUnknown } from "../src/map/status";
import { fxContext, marchStops } from "../src/replay/fx/plan";
import { toastFor } from "../src/replay/toasts";

/**
 * Session 33, Step 0: two blackout leaks on the page (the wire was clean): the province outline ran through the cloud,
 * and the replay's words and arrows could name or place land a person has never seen. Under blackout an unknown
 * territory in a line a person reads is "the cloud", an army's way out of it starts at its edge, and an outline stops
 * where the cloud starts. The replay's event data keeps the ids (the engine is unchanged); the words and the drawing don't.
 */
const here = dirname(fileURLToPath(import.meta.url));
const src = (p: string) => readFileSync(join(here, "../src", p), "utf8");
const ctx: GameContext = { map: maps.embervale!, rules: defaultRules };
const players = [1, 2, 3, 4].map((i) => ({ id: `p${i}`, name: `P${i}` }));
const byId = new Map(ctx.map.territories.map((t) => [t.id, t]));

/** A blackout game on Embervale with Recruits, each turn's replay for p1 and p1's view after it. */
function blackoutTurns(turns: number) {
  let s = createGame(ctx, { gameId: "s33", seed: "s33-cloud", players, settings: { fog: "blackout" } });
  const out: { events: ReplayEvent[]; before: PlayerView; after: PlayerView }[] = [];
  for (let t = 0; t < turns && !s.winner; t++) {
    const st = s;
    const orders = Object.fromEntries(st.players.filter((p) => p.eliminatedTurn === null).map((p) => [p.id, recruitBot.plan(ctx, viewFor(ctx, st, p.id))]));
    const r = resolveTurn(ctx, st, orders);
    out.push({ events: replayFor(ctx, st, r, "p1"), before: viewFor(ctx, st, "p1"), after: viewFor(ctx, r.state, "p1") });
    s = r.state;
  }
  return out;
}

/** The names of land p1 has never seen, as whole words (so "Ash" doesn't match "Ashfell"). */
const unknownNames = (v: PlayerView) => ctx.map.territories.filter((t) => isUnknown(v, t.id)).map((t) => new RegExp(`\\b${t.name}\\b`));

describe("session 33, Step 0: under blackout, nothing a person reads or sees names or places the cloud's land", () => {
  it("the report, the replay's log and its toasts never name land you've never seen (it's \"the cloud\")", () => {
    const turns = blackoutTurns(10);
    let lines = 0;
    for (const { events, before, after } of turns) {
      const n = namer(ctx, after, before);
      const g = groupReport(ctx, events, n);
      const texts = [...g.yours, ...g.seen, ...g.fog, ...narrateTurn(ctx, events, n)].map((l) => l.text);
      for (const e of events) {
        const t = toastFor(ctx, after, e);
        if (t) texts.push(t.text);
      }
      lines += texts.length;
      const hidden = unknownNames(after);
      for (const text of texts) for (const re of hidden) expect(text, `"${text}"`).not.toMatch(re);
    }
    expect(lines).toBeGreaterThan(30);
  });

  it("the namer says \"the cloud\" for unknown land, under blackout only", () => {
    const s = createGame(ctx, { gameId: "s33", seed: "s33-cloud", players, settings: { fog: "blackout" } });
    const v = viewFor(ctx, s, "p1");
    const far = ctx.map.territories.find((t) => isUnknown(v, t.id))!;
    expect(namer(ctx, v).place(far.id)).toBe(CLOUD);
    expect(namer(ctx, v).place(v.me.capital)).toBe(byId.get(v.me.capital)!.name);
    const std = createGame(ctx, { gameId: "s33", seed: "s33-cloud", players, settings: { fog: true } });
    expect(namer(ctx, viewFor(ctx, std, "p1")).place(far.id)).toBe(far.name);
  });

  it("a Fate closure on a border into the cloud: \"the river crossing from Dawnrest into the cloud is closed\"", () => {
    const s = createGame(ctx, { gameId: "s33", seed: "s33-cloud", players, settings: { fog: "blackout" } });
    const v = viewFor(ctx, s, "p1");
    const n = namer(ctx, v);
    // A border with one side seen and the other under the cloud (any kind will do for the words; a ford names a river).
    const edge = ctx.map.borders.find((b) => isUnknown(v, b.a) !== isUnknown(v, b.b))!;
    const [seen, cloud] = isUnknown(v, edge.a) ? [edge.b, edge.a] : [edge.a, edge.b];
    const e = { type: "fate", step: 1, drawer: "p2", card: "ford", at: seen, holder: null, tone: "bad", shrugged: false, land: [], border: [cloud, seen], until: 3 } as unknown as Extract<ReplayEvent, { type: "fate" }>;
    const line = fateLine(ctx, e, n);
    expect(line).toContain(`the river crossing from ${byId.get(seen)!.name} into the cloud is closed all of turn 3`);
    expect(line).not.toContain(byId.get(cloud)!.name);
    // Both sides seen: as before.
    const both = ctx.map.borders.find((b) => !isUnknown(v, b.a) && !isUnknown(v, b.b))!;
    expect(fateLine(ctx, { ...e, border: [both.a, both.b] }, n)).toContain(`between ${byId.get(both.a)!.name} and ${byId.get(both.b)!.name}`);
  });

  it("an army marching out of the cloud: \"out of the cloud\" in the words, and its way starts at the cloud's edge", () => {
    const s = createGame(ctx, { gameId: "s33", seed: "s33-cloud", players, settings: { fog: "blackout" } });
    const v = viewFor(ctx, s, "p1");
    const edge = ctx.map.borders.find((b) => b.type === "normal" && isUnknown(v, b.a) !== isUnknown(v, b.b))!;
    const [seen, cloud] = isUnknown(v, edge.a) ? [edge.b, edge.a] : [edge.a, edge.b];
    const moved = { type: "moved", step: 2, player: "p2", orderId: "", from: cloud, to: seen, army: { troops: 6, specialists: [] }, withLeader: false, retreat: false } as unknown as ReplayEvent;
    const [line] = narrateTurn(ctx, [moved], namer(ctx, v));
    expect(line!.text).toBe("P2 moved 6 troops out of the cloud to " + byId.get(seen)!.name + ".");
    // The way: from the border between the two (where the cloud ends), never the cloud land's own middle.
    const fx = fxContext(ctx.map, v.gameId, v.turn, [moved], () => 0, () => false, () => false, () => null, (id) => isUnknown(v, id));
    const end = fx.spot(seen)!;
    const stops = marchStops(fx, cloud, undefined, end, seen)!;
    expect(stops[0]).toEqual(fx.borderPoint(cloud, seen));
    expect(stops[0]).not.toEqual(fx.spot(cloud));
    expect(stops.at(-1)).toEqual(end);
    // With standard fog (nothing unknown), the way starts where the army stood, as before.
    const plain = fxContext(ctx.map, v.gameId, v.turn, [moved], () => 0, () => false, () => false);
    expect(marchStops(plain, cloud, undefined, end, seen)![0]).toEqual(plain.spot(cloud));
  });

  it("a province's outline stops at the cloud's edge: no line along land you've never seen", () => {
    const s = createGame(ctx, { gameId: "s33", seed: "s33-cloud", players, settings: { fog: "blackout" } });
    const v = viewFor(ctx, s, "p1");
    const g = ctx.map.geometry!;
    const unknown = (id: string) => isUnknown(v, id);
    // A province with land seen and land under the cloud.
    const prov = ctx.map.provinces.find((p) => {
      const m = ctx.map.territories.filter((t) => t.province === p.id);
      return m.some((t) => unknown(t.id)) && m.some((t) => !unknown(t.id));
    })!;
    const of = new Map(ctx.map.territories.map((t) => [t.id, t.province]));
    const clipped = groupOutlines(g, (id) => (unknown(id) ? null : (of.get(id) ?? null)), unknown).get(prov.id)!;
    const whole = groupOutlines(g, (id) => of.get(id) ?? null).get(prov.id)!;
    // Every point of a cloud territory's own outline that isn't also on seen land is out of the clipped outline.
    const pts = (rings: readonly (readonly number[])[]) => new Set(rings.flatMap((r) => r.flatMap((_, i) => (i % 2 ? [] : [`${r[i]},${r[i + 1]}`]))));
    const seenPts = pts(g.territories.filter((t) => !unknown(t.id)).flatMap((t) => t.rings));
    const cloudOnly = [...pts(g.territories.filter((t) => unknown(t.id) && of.get(t.id) === prov.id).flatMap((t) => t.rings))].filter((p) => !seenPts.has(p));
    const drawn = pts(clipped);
    expect(cloudOnly.length).toBeGreaterThan(0);
    expect(cloudOnly.filter((p) => drawn.has(p))).toEqual([]);
    expect(cloudOnly.some((p) => pts(whole).has(p))).toBe(true);
    // The page uses it: the lit province, a leader's command, a wall, the plain map, and the plaque's place.
    expect(src("render/pixi/info.ts")).toMatch(/groupOutlines\(this\.map\.geometry!, \(id\) => \(unknown\(id\) \? null : \(of\.get\(id\) \?\? null\)\), blackout \? unknown : undefined\)/);
    expect(src("render/pixi/info.ts")).toMatch(/groupOutlines\(this\.map\.geometry!, \(id\) => groupOf\.get\(id\) \?\? null, unknown\)/);
    expect(src("render/svg/SvgMapRenderer.ts")).toContain("if (unknown(t.id)) continue;");
    expect(src("render/pixi/markers.ts")).toContain("if (isUnknown(view, nearest.id))");
  });
});
