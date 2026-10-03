import { maps } from "@conquerra/content/maps";
import { describe, expect, it } from "vitest";
import { clampCamera, fitCamera, landFrame, toMap, toScreen } from "../src/map/camera";
import { colourDistance } from "../src/map/colorblind";
import { HOUSES } from "../src/map/houses";
import { glyphAlphas } from "../src/map/layout";
import { dashes } from "../src/map/shapes";

const geo = maps.embervale!.geometry!;

describe("province names give way to army markers", () => {
  it("letters under a marker fade almost away, their neighbours half, the rest stay", () => {
    const glyphs = [0, 1, 2, 3, 4, 5].map((i) => ({ x: i * 10, y: 0, r: 3 }));
    const a = glyphAlphas(glyphs, [{ x: 30, y: 0, w: 8, h: 8 }]);
    expect(a[3]).toBeLessThan(0.15);
    expect(a[2]).toBeGreaterThan(0.3);
    expect(a[2]).toBeLessThan(1);
    expect(a[4]).toBeLessThan(1);
    expect(a[1]).toBe(1);
    expect(a[5]).toBe(1);
  });
  it("no markers, no fading", () => {
    expect(glyphAlphas([{ x: 0, y: 0, r: 3 }], [])).toEqual([1]);
  });
  it("uses the marker's vertical offset", () => {
    const g = [{ x: 0, y: 20, r: 2 }];
    expect(glyphAlphas(g, [{ x: 0, y: 0, w: 10, h: 10 }])[0]).toBe(1);
    expect(glyphAlphas(g, [{ x: 0, y: 0, w: 10, h: 10, dy: 18 }])[0]).toBeLessThan(0.15);
  });
});

describe("fit map fills the screen", () => {
  const frame = landFrame(geo);
  it("frames the land, not the wide band of sea round the map", () => {
    expect(frame.x).toBeGreaterThanOrEqual(0);
    expect(frame.x + frame.width).toBeLessThanOrEqual(geo.width);
    // Every territory is inside the frame.
    for (const t of geo.territories)
      for (const r of t.rings)
        for (let i = 0; i < r.length; i += 2) {
          expect(r[i]!).toBeGreaterThanOrEqual(frame.x - 1e-6);
          expect(r[i + 1]!).toBeLessThanOrEqual(frame.y + frame.height + 1e-6);
        }
  });
  it("on a laptop the land fills the free screen space edge to edge in one direction", () => {
    const vp = { width: 1440, height: 900, insets: { top: 56, right: 300, bottom: 110, left: 0 } };
    const fit = fitCamera(frame, vp);
    const [x0, y0] = toScreen(fit, frame.x, frame.y);
    const [x1, y1] = toScreen(fit, frame.x + frame.width, frame.y + frame.height);
    const freeW = 1440 - 300, freeH = 900 - 56 - 110;
    expect(Math.max((x1 - x0) / freeW, (y1 - y0) / freeH)).toBeGreaterThan(0.97);
    // Centred in the space the menus leave.
    expect(Math.abs((x0 + x1) / 2 - freeW / 2)).toBeLessThan(1);
    expect(Math.abs((y0 + y1) / 2 - (56 + freeH / 2))).toBeLessThan(1);
  });
  it("panning stops a small margin past the land's edge", () => {
    const vp = { width: 412, height: 915 };
    const scale = fitCamera(frame, vp).scale * 3;
    const c = clampCamera({ x: 99999, y: 99999, scale }, frame, vp);
    const [left] = toScreen(c, frame.x, frame.y);
    expect(left).toBeLessThanOrEqual(412 * 0.06 + 1e-6);
    const far = clampCamera({ x: -99999, y: -99999, scale }, frame, vp);
    const [mx, my] = toMap(far, 412, 915);
    expect(mx).toBeLessThanOrEqual(frame.x + frame.width + (412 * 0.06) / scale + 1e-6);
    expect(my).toBeLessThanOrEqual(frame.y + frame.height + (915 * 0.06) / scale + 1e-6);
  });
});

describe("House colours", () => {
  const by = (n: string) => HOUSES.find((h) => h.name === n)!.color;
  it("Teal replaced Celeste", () => {
    expect(HOUSES.map((h) => h.name)).toContain("Teal");
    expect(HOUSES.map((h) => h.name)).not.toContain("Celeste");
  });
  it("Teal is clearly apart from Azure and Vert, also with protanopia and deuteranopia", () => {
    for (const v of ["normal", "deuteranopia", "protanopia"] as const)
      for (const other of ["Azure", "Vert"]) expect(colourDistance(by("Teal"), by(other), v)).toBeGreaterThan(35);
  });
});

describe("dashed lines", () => {
  it("splits a line into dashes of the right length", () => {
    const d = dashes([0, 0, 100, 0], 10, 5);
    expect(d.length).toBe(7);
    expect(d[0]).toEqual([0, 0, 10, 0]);
    expect(d[1]![0]).toBeCloseTo(15);
  });
  it("closes rings", () => {
    const d = dashes([0, 0, 10, 0, 10, 10, 0, 10], 4, 4, true);
    const total = d.reduce((n, l) => n + Math.hypot(l[l.length - 2]! - l[0]!, l[l.length - 1]! - l[1]!), 0);
    expect(total).toBeGreaterThan(14);
  });
});
