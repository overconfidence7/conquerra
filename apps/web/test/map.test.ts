import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { createGame, resolveTurn, viewFor, type GameContext, type PlayerView } from "@conquerra/engine";
import { describe, expect, it } from "vitest";
import { clampCamera, fitCamera, toMap, toScreen, zoomAt } from "../src/map/camera";
import { seenAgo, territoryCard } from "../src/map/card";
import { HOUSES, houseOf } from "../src/map/houses";
import { layoutMarkers, markerMetrics, MIN_PILL_HEIGHT, pillHeight, type MarkerBox, type MarkerContent } from "../src/map/layout";
import { groupOutlines, hitTester, insideRings } from "../src/map/shapes";
import { markerContent, territoryStatus } from "../src/map/status";
import { detailMix, MID_FROM_PX, NEAR_FROM_PX, typicalTerritorySize, zoomDetail } from "../src/map/zoom";

const ctx: GameContext = { map: maps.embervale!, rules: defaultRules };
const geo = ctx.map.geometry!;

describe("zoom levels (Far / Mid / Near)", () => {
  const size = typicalTerritorySize(ctx.map);

  it("measures a typical territory sensibly (Embervale: about 100-140 map units)", () => {
    expect(size).toBeGreaterThan(100);
    expect(size).toBeLessThan(140);
  });

  it("picks the level from how big a territory looks on screen", () => {
    expect(zoomDetail((MID_FROM_PX * 0.6) / size, size).level).toBe("far");
    expect(zoomDetail((MID_FROM_PX * 1.5) / size, size).level).toBe("mid");
    expect(zoomDetail((NEAR_FROM_PX * 1.3) / size, size).level).toBe("near");
  });

  it("fades smoothly: no jumps, fully Far well below Mid, fully Near well above it", () => {
    let prev = zoomDetail(0.05, size);
    expect(prev.far).toBe(1);
    for (let s = 0.05; s < 6; s *= 1.02) {
      const z = zoomDetail(s, size);
      expect(Math.abs(z.far - prev.far)).toBeLessThan(0.1);
      expect(Math.abs(z.near - prev.near)).toBeLessThan(0.1);
      expect(z.far).toBeLessThanOrEqual(prev.far);
      expect(z.near).toBeGreaterThanOrEqual(prev.near);
      prev = z;
    }
    expect(prev.near).toBe(1);
    // Mid itself shows neither Far nor Near extras.
    const mid = zoomDetail(Math.sqrt(MID_FROM_PX * NEAR_FROM_PX) / size, size);
    expect(mid.far).toBe(0);
    expect(mid.near).toBe(0);
  });

  it("shows what the art direction says at each level", () => {
    const far = detailMix({ far: 1, near: 0 }, false), mid = detailMix({ far: 0, near: 0 }, false), near = detailMix({ far: 0, near: 1 }, false);
    // Far: illustration dimmed, House tint stronger, numbers only, province names large.
    expect(far.dim).toBeGreaterThan(0.2);
    expect(far.tint).toBeGreaterThan(mid.tint);
    expect(far.icons).toBe(0);
    expect(far.provinceNames).toBe(1);
    // Mid: full illustration, banners and building icons, no Near extras.
    expect(mid.dim).toBe(0);
    expect(mid.icons).toBe(1);
    expect(mid.nearDetail).toBe(0);
    expect(mid.names).toBe(0);
    // Near: specialists, culture, gold and names; province names gone.
    expect(near.nearDetail).toBe(1);
    expect(near.names).toBe(1);
    expect(near.provinceNames).toBe(0);
    // Tactical: every detail at every zoom, no dimming.
    const tac = detailMix({ far: 1, near: 0 }, true);
    expect(tac).toMatchObject({ dim: 0, icons: 1, nearDetail: 1 });
  });
});

const content = (over: Partial<MarkerContent> = {}): MarkerContent => ({ label: "12", owned: true, crown: false, building: false, specialists: 0, culture: 0, name: "Ravengate", capital: false, ...over });

describe("army markers", () => {
  it("never get smaller than the minimum on screen, at any zoom", () => {
    for (let px = 1; px < 2000; px *= 1.3) expect(pillHeight({ territoryPx: px })).toBeGreaterThanOrEqual(MIN_PILL_HEIGHT);
    // And the whole marker is at least a comfortable tap target.
    const m = markerMetrics(content(), { territoryPx: 5 }, detailMix({ far: 1, near: 0 }, false));
    expect(m.h).toBeGreaterThanOrEqual(MIN_PILL_HEIGHT);
    expect(m.w).toBeGreaterThanOrEqual(MIN_PILL_HEIGHT);
  });

  it("grow to fit what they show (banner, building, specialists, names)", () => {
    const z = { territoryPx: 300 };
    const plain = markerMetrics(content(), z, detailMix({ far: 0, near: 0 }, false));
    const busy = markerMetrics(content({ building: true, crown: true, specialists: 2, culture: 3 }), z, detailMix({ far: 0, near: 1 }, false));
    expect(busy.w).toBeGreaterThanOrEqual(plain.w);
    expect(busy.h).toBeGreaterThan(plain.h);
  });

  const overlap = (a: { x: number; y: number; w: number; h: number; dy?: number }, b: typeof a) =>
    Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.y + (a.dy ?? 0) - b.y - (b.dy ?? 0)) * 2 < a.h + b.h;

  it("shift aside so none overlap, keeping the most important ones in place", () => {
    const boxes: MarkerBox[] = [
      { id: "mine", x: 100, y: 100, w: 60, h: 24, priority: 3 },
      { id: "rival", x: 110, y: 104, w: 60, h: 24, priority: 2 },
      { id: "old", x: 95, y: 98, w: 50, h: 24, priority: 0 },
      { id: "far", x: 400, y: 400, w: 50, h: 24, priority: 1 },
    ];
    const out = layoutMarkers(boxes);
    expect(out.get("mine")).toMatchObject({ x: 100, y: 100, shifted: false });
    expect(out.get("far")).toMatchObject({ x: 400, y: 400, shifted: false });
    const shown = boxes.filter((b) => out.get(b.id)!.mergedInto === null).map((b) => ({ ...b, ...out.get(b.id)! }));
    for (const a of shown) for (const b of shown) if (a !== b) expect(overlap(a, b)).toBe(false);
    expect(out.get("rival")!.shifted).toBe(true);
  });

  it("merge into a neighbour (\"+1\") when there's no room nearby", () => {
    // A tight crowd: far more markers than fit in the space they're allowed to move in.
    const boxes: MarkerBox[] = Array.from({ length: 30 }, (_, i) => ({ id: `t${i}`, x: 200 + (i % 5) * 3, y: 200 + Math.floor(i / 5) * 3, w: 50, h: 22, priority: i === 0 ? 5 : 1 }));
    const out = layoutMarkers(boxes);
    const merged = boxes.filter((b) => out.get(b.id)!.mergedInto !== null);
    expect(merged.length).toBeGreaterThan(0);
    for (const b of merged) {
      const host = out.get(out.get(b.id)!.mergedInto!)!;
      expect(host.mergedInto).toBeNull();
      expect(host.merged).toContain(b.id);
    }
    const shown = boxes.filter((b) => out.get(b.id)!.mergedInto === null).map((b) => ({ ...b, ...out.get(b.id)! }));
    for (const a of shown) for (const b of shown) if (a !== b) expect(overlap(a, b)).toBe(false);
    // Every marker is accounted for exactly once.
    const counted = shown.length + shown.reduce((n, s) => n + s.merged.length, 0);
    expect(counted).toBe(boxes.length);
  });

  it("never overlap on the real map, at every zoom, on a phone and a laptop", () => {
    const s = createGame(ctx, { gameId: "m", seed: "markers", players: [1, 2, 3, 4, 5, 6].map((i) => ({ id: `p${i}`, name: `P${i}` })), settings: { fog: false } });
    const view = viewFor(ctx, s, "p1");
    const size = typicalTerritorySize(ctx.map);
    for (const vp of [{ width: 412, height: 560 }, { width: 1100, height: 800 }]) {
      const fit = fitCamera(geo, vp);
      for (const k of [1, 1.6, 2.5, 4, 7]) {
        const cam = { ...fit, scale: fit.scale * k };
        const z = zoomDetail(cam.scale, size);
        const mix = detailMix(z, false);
        const boxes = ctx.map.territories.map((t) => {
          const c = markerContent(ctx.map, view, territoryStatus(view, t.id))!;
          const m = markerMetrics(c, z, mix);
          const l = geo.territories.find((g) => g.id === t.id)!.label;
          const [x, y] = toScreen(cam, l.x, l.y);
          return { id: t.id, x, y, w: m.w, h: m.h, dy: m.dy, priority: 1 };
        });
        const out = layoutMarkers(boxes);
        const shown = boxes.filter((b) => out.get(b.id)!.mergedInto === null).map((b) => ({ ...b, ...out.get(b.id)! }));
        for (const a of shown) for (const b of shown) if (a !== b) expect(overlap(a, b), `${a.id}/${b.id} at x${k} on ${vp.width}px`).toBe(false);
        // Zoomed in on a laptop, every territory gets its own marker.
        if (vp.width > 1000 && k >= 2.5) expect(shown.length).toBe(boxes.length);
      }
    }
  });
});

/** A game where p1 has seen land that has since slipped into the fog. */
function fogGame(): PlayerView {
  let s = createGame(ctx, { gameId: "c", seed: "card", players: [{ id: "p1", name: "You" }, { id: "p2", name: "Lady Morwen" }] });
  const cap = s.players.find((p) => p.id === "p1")!.capital;
  // Give p1 a neighbour for a turn, then take it away again: what was beyond it is now remembered, not seen.
  const ns = ctx.map.borders.filter((b) => b.a === cap || b.b === cap).map((b) => (b.a === cap ? b.b : b.a));
  s.territories[ns[0]!]!.owner = "p1";
  s = resolveTurn(ctx, s, {}).state;
  s.territories[ns[0]!]!.owner = null;
  s = resolveTurn(ctx, s, {}).state;
  s = resolveTurn(ctx, s, {}).state;
  return viewFor(ctx, s, "p1");
}

describe("the tap card", () => {
  it("says how old last-seen intel is", () => {
    expect(seenAgo(5, 5)).toBe("Seen this turn");
    expect(seenAgo(5, 4)).toBe("Seen last turn");
    expect(seenAgo(5, 3)).toBe("Seen 2 turns ago");
  });

  it("shows remembered land with \"?\" and its age, and unexplored land as Unexplored", () => {
    const view = fogGame();
    const remembered = Object.entries(view.territories).find(([, t]) => t.detail === "fogged" && t.lastSeen)!;
    expect(remembered).toBeDefined();
    const card = territoryCard(ctx, view, remembered[0]);
    expect(card.uncertain).toBe(true);
    expect(card.intel).toBe(seenAgo(view.turn, (remembered[1] as { lastSeen: { turn: number } }).lastSeen.turn));
    expect(card.intel).toMatch(/^Seen (last turn|\d+ turns ago)$/);
    expect(card.lines.find((l) => l.label === "Troops")!.value).toMatch(/^\d+\?$/);
    expect(card.lines.find((l) => l.label === "Owner")!.value).toMatch(/\?$/);
    expect(card.lines.find((l) => l.label === "Building")!.value).toMatch(/\?$/);

    const never = Object.entries(view.territories).find(([, t]) => t.detail === "fogged" && !t.lastSeen)!;
    const c2 = territoryCard(ctx, view, never[0]);
    expect(c2.intel).toBe("Unexplored");
    expect(c2.lines.map((l) => l.label)).toEqual(["Gold"]);
  });

  it("shows everything, with no \"?\", on land you can see", () => {
    const view = fogGame();
    const card = territoryCard(ctx, view, view.me.capital);
    expect(card.intel).toBeNull();
    expect(card.subtitle).toMatch(/^Your capital/);
    expect(card.lines.map((l) => l.label)).toEqual(["Owner", "Troops", "Leader", "Building", "Culture", "Gold", "Specialists"]);
    expect(card.lines.every((l) => !l.value.endsWith("?"))).toBe(true);
  });
});

describe("map shapes", () => {
  it("finds the territory under a point (and nothing out at sea)", () => {
    const hit = hitTester(geo);
    for (const t of geo.territories) expect(hit.at(t.label.x, t.label.y)).toBe(t.id);
    expect(hit.at(2, 2)).toBeNull();
    const lake = geo.water.find((w) => w.kind === "lake")!;
    expect(hit.at(lake.label.x, lake.label.y)).toBeNull();
    expect(insideRings(geo.territories[0]!.rings, -10, -10)).toBe(false);
  });

  it("outlines a realm around its edge only, not between its own territories", () => {
    const [a, b] = [ctx.map.borders[0]!.a, ctx.map.borders[0]!.b];
    const both = groupOutlines(geo, (id) => (id === a || id === b ? "x" : null)).get("x")!;
    const aOnly = groupOutlines(geo, (id) => (id === a ? "x" : null)).get("x")!;
    const bOnly = groupOutlines(geo, (id) => (id === b ? "x" : null)).get("x")!;
    const len = (ls: number[][]) => ls.reduce((n, l) => n + l.length / 2 - 1, 0);
    // The shared border is counted in each alone but not in the pair.
    expect(len(both)).toBeLessThan(len(aOnly) + len(bOnly));
    expect(len(both)).toBeGreaterThan(Math.max(len(aOnly), len(bOnly)) * 0.8);
  });
});

describe("camera", () => {
  const vp = { width: 400, height: 600 };
  it("fits the map, and zooming keeps the point under the finger still", () => {
    const fit = fitCamera(geo, vp);
    expect(geo.width * fit.scale).toBeLessThanOrEqual(vp.width);
    const z = zoomAt(fit, 2, 120, 300, { min: 0.1, max: 10 });
    expect(toMap(z, 120, 300).map((v) => Math.round(v * 100))).toEqual(toMap(fit, 120, 300).map((v) => Math.round(v * 100)));
  });

  it("can't be dragged off the map", () => {
    const c = clampCamera({ x: 5000, y: -9000, scale: 2 }, geo, vp);
    const [cx, cy] = toMap(c, vp.width / 2, vp.height / 2);
    expect(cx).toBeGreaterThanOrEqual(0);
    expect(cy).toBeLessThanOrEqual(geo.height);
  });
});

describe("Houses", () => {
  it("each has its own colour and its own pattern (for colourblind players)", () => {
    expect(new Set(HOUSES.map((h) => h.color)).size).toBe(HOUSES.length);
    expect(new Set(HOUSES.map((h) => h.pattern)).size).toBe(HOUSES.length);
  });
  it("you are always the first House", () => {
    const view = fogGame();
    expect(houseOf(view, view.me.id).name).toBe("Azure");
    expect(houseOf(view, null).name).toBe("Neutral");
  });
});
