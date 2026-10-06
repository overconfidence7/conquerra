import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { createGame, resolveTurn, viewFor, type GameContext, type PlayerView } from "@conquerra/engine";
import { describe, expect, it } from "vitest";
import { clampCamera, clearInsets, fitCamera, toMap, toScreen, zoomAt } from "../src/map/camera";
import { cultureLine, cultureNext, ladderLine, seenAgo, territoryCard } from "../src/map/card";
import { hireOptions, planQueue } from "../src/logic/orders";
import { DEFAULT_HOUSE, HOUSES, houseOf } from "../src/map/houses";
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

  it("province plaques never cover an army: they step aside, or are dropped (never folded into a marker)", () => {
    const army: MarkerBox = { id: "army", x: 200, y: 200, w: 60, h: 26, priority: 3 };
    const plaque: MarkerBox = { id: "plaque", x: 200, y: 205, w: 120, h: 18, priority: -1, optional: true };
    const out = layoutMarkers([plaque, army]);
    expect(out.get("army")!.shifted).toBe(false);
    const p = out.get("plaque")!;
    expect(p.mergedInto).toBeNull();
    if (!p.dropped) expect(Math.abs(p.y - 200) * 2).toBeGreaterThanOrEqual(26 + 18);
    // Boxed in on every side: dropped, and no army gets a "+1".
    const crowd: MarkerBox[] = Array.from({ length: 225 }, (_, i) => ({ id: `a${i}`, x: 200 + ((i % 15) - 7) * 30, y: 200 + (Math.floor(i / 15) - 7) * 20, w: 30, h: 20, priority: 2 }));
    const out2 = layoutMarkers([...crowd, plaque]);
    expect(out2.get("plaque")!.dropped).toBe(true);
    expect(crowd.some((c) => out2.get(c.id)!.merged.includes("plaque"))).toBe(false);
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
    expect(card.lines.find((l) => l.label === "Troops")!.value).toMatch(/^\d+ troops?\?$/);
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

  it("explains culture in plain words: what it does now, and what the next level adds", () => {
    const view = fogGame();
    const cap = view.me.capital;
    const r = ctx.rules;
    const province = ctx.map.provinces.find((p) => p.id === ctx.map.territories.find((t) => t.id === cap)!.province)!;
    expect(territoryCard(ctx, view, cap).lines.find((l) => l.label === "Culture")!.value).toBe(`No culture yet: raising it costs ${r.culture.investCost[0]} gold. Culture 0 in ${province.name}: Cavalry and Scouts. Next: Siege and Engineers at 2`);
    const v = view.territories[cap] as Extract<PlayerView["territories"][string], { detail: "full" }>;
    v.culture = 2;
    const step = Math.round(100 * r.culture.defensePerLevel);
    expect(cultureLine(ctx, view, cap, 2)).toBe(`Culture 2: defends +${2 * step}%, shrugs off 30% of unrest, +1 gold. Culture 2 in ${province.name}: Siege and Engineers. Next: Healers at 3`);
    expect(cultureNext(ctx, view, cap, 2)).toBe(`Culture 3 for ${r.culture.investCost[2]} gold: defends +${3 * step}% (was +${2 * step}%), shrugs off 45% of unrest, +1½ gold, newly unlocks Healers in ${province.name}`);
    expect(cultureNext(ctx, view, cap, r.culture.max)).toBeNull();
  });

  it("the culture ladder (session 15): the card names what the province's culture has unlocked and the next step", () => {
    const view = fogGame();
    const cap = view.me.capital;
    const province = ctx.map.provinces.find((p) => p.id === ctx.map.territories.find((t) => t.id === cap)!.province)!;
    expect(ladderLine(ctx, view, cap, 4)).toBe(`Culture 4 in ${province.name}: Rangers. Next: Standard-bearer at 6`);
    expect(ladderLine(ctx, view, cap, 5)).toBe(`Culture 5 in ${province.name}: Rangers. Next: Standard-bearer at 6`);
    // Two territories' culture adds up in a province (another of yours there, at 2, plus 4 here).
    const other = ctx.map.territories.find((t) => t.province === province.id && t.id !== cap)!;
    const v = view.territories[other.id]!;
    view.territories[other.id] = { ...(v.detail === "full" ? v : { detail: "full", seenBy: ["own"], specialists: [], building: null, construction: null, leaders: [], generals: [], capitalOf: null, troops: 1 }), owner: view.me.id, culture: 2 } as typeof v;
    expect(ladderLine(ctx, view, cap, 4)).toBe(`Culture 6 in ${province.name}: Standard-bearer, the top of the ladder`);
    expect(cultureNext(ctx, view, cap, 3)).toContain("newly unlocks Standard-bearer");
  });

  it("the Hire menu shows the locked specialists with the culture they need", () => {
    const view = fogGame();
    const cap = view.me.capital;
    const hires = hireOptions(ctx, { ...view, me: { ...view.me, gold: 100 } }, planQueue(ctx, { ...view, me: { ...view.me, gold: 100 } }, []), cap);
    expect(hires.map((h) => h.specialist)).toEqual(["cavalry", "scouts", "siege", "engineers", "healers", "rangers", "standardBearer"]);
    expect(hires.find((h) => h.specialist === "rangers")).toMatchObject({ cost: 9, ok: false, why: "Needs 4 culture in this province" });
    expect(hires.find((h) => h.specialist === "standardBearer")).toMatchObject({ cost: 12, ok: false, why: "Needs 6 culture in this province" });
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

describe("room at the map's edges (session 16)", () => {
  it("fits the map into the biggest clear part of the screen, clear of every menu", () => {
    // A desktop: top bar, right column, a bottom-left panel and a bottom-right dock.
    const menus = [
      { x: 8, y: 8, width: 1424, height: 58 },
      { x: 1148, y: 72, width: 284, height: 453 },
      { x: 8, y: 72, width: 452, height: 820 },
      { x: 812, y: 676, width: 620, height: 216 },
    ];
    const ins = clearInsets(1440, 900, menus, 1.3);
    const box = { x: ins.left, y: ins.top, width: 1440 - ins.left - ins.right, height: 900 - ins.top - ins.bottom };
    for (const m of menus) expect(box.x >= m.x + m.width || box.x + box.width <= m.x || box.y >= m.y + m.height || box.y + box.height <= m.y).toBe(true);
    // The whole map fits inside it, zoomed all the way out.
    const map = { width: 1300, height: 1000 };
    const vp = { width: 1440, height: 900, insets: ins };
    const cam = fitCamera(map, vp);
    const [x0, y0] = toScreen(cam, 0, 0);
    const [x1, y1] = toScreen(cam, map.width, map.height);
    expect(x0).toBeGreaterThanOrEqual(box.x);
    expect(y0).toBeGreaterThanOrEqual(box.y);
    expect(x1).toBeLessThanOrEqual(box.x + box.width);
    expect(y1).toBeLessThanOrEqual(box.y + box.height);
  });
  it("with no menus, it's the whole screen; a tall map prefers a tall clear strip", () => {
    expect(clearInsets(800, 600, [], 1.5)).toEqual({ left: 0, top: 0, right: 0, bottom: 0 });
    // A menu across the top-right: a tall map takes the full-height strip to its left.
    const ins = clearInsets(800, 600, [{ x: 400, y: 0, width: 400, height: 200 }], 0.5, 0);
    expect(ins).toEqual({ left: 0, top: 0, right: 400, bottom: 0 });
  });
  it("lets you pan every edge of a zoomed-in map into the clear part", () => {
    const ins = { left: 460, top: 70, right: 360, bottom: 230 };
    const vp = { width: 1440, height: 900, insets: ins };
    const map = { width: 1300, height: 1000 };
    // Push far past each edge: the clamp stops with the map's edge inside the clear part.
    const right = clampCamera({ x: -99999, y: 0, scale: 2 }, map, vp);
    expect(toScreen(right, map.width, 0)[0]).toBeLessThanOrEqual(1440 - ins.right);
    const left = clampCamera({ x: 99999, y: 0, scale: 2 }, map, vp);
    expect(toScreen(left, 0, 0)[0]).toBeGreaterThanOrEqual(ins.left);
    const bottom = clampCamera({ x: 0, y: -99999, scale: 2 }, map, vp);
    expect(toScreen(bottom, 0, map.height)[1]).toBeLessThanOrEqual(900 - ins.bottom);
  });
});

describe("House colours (session 16)", () => {
  it("each player shows the House they chose; older views fall back to their seat", () => {
    expect(houseOf({ players: [{ id: "you", house: 1 }, { id: "bot", house: 0 }] }, "you").name).toBe("Gules");
    expect(houseOf({ players: [{ id: "you", house: 1 }, { id: "bot", house: 0 }] }, "bot").name).toBe("Azure");
    expect(houseOf({ players: [{ id: "x" }, { id: "y" }] }, "y").name).toBe("Gules");
    expect(HOUSES[DEFAULT_HOUSE]!.name).toBe("Gules");
  });
});
