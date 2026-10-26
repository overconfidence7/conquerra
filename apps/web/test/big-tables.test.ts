import { describe, expect, it } from "vitest";
import { defaultRules } from "@conquerra/content";
import { bigTables } from "@conquerra/content/bigTables";
import { mapFiles, maps } from "@conquerra/content/maps";
import { createGame, viewFor } from "@conquerra/engine";
import { adjacency, allDistances, exposureOf, markHarder, randomVersionDef } from "@conquerra/mapgen";
import { MAX_PEOPLE, TABLE_TEXT } from "../src/host/roomCore";
import { BOT_NAMES } from "../src/host/names";
import type { RoomMessage, RoomStart } from "../src/host/protocol";
import { HOUSE_PLAIN, HOUSES, PEOPLE_HOUSES } from "../src/map/houses";
import { PANEL_TEXT, PHONE_ROWS, phoneOrder } from "../src/ui/PlayersPanel";
import { hostSeat, NATE, settings, testRoom } from "./roomHelpers";

/**
 * Session 34, bigger tables: Rootholm seats up to 20 and Krakenmere up to 13 (layouts made from each map's own capital
 * spots, kept beside the map files), up to 10 people at a table (the rest bots, harder spots to bots first), twenty
 * Houses a person can tell apart, nineteen bot names, and the Houses panel's "and 12 more" on a phone.
 */

describe("the big tables' capital layouts (session 34)", () => {
  it("the map files are untouched; the game's maps join the big tables: Rootholm to 20, Krakenmere to 13", () => {
    expect(mapFiles.rootholm!.maxPlayers).toBe(10);
    expect(mapFiles.krakenmere!.maxPlayers).toBe(10);
    expect(maps.rootholm!.maxPlayers).toBe(20);
    // (Session 35: Krakenmere 14 comes with layout version 3, beside the others; version 1's big tables stop at 13.)
    expect(maps.krakenmere!.maxPlayers).toBe(14);
    expect(bigTables.krakenmere!.maxPlayers).toBe(13);
    for (const id of ["rootholm", "krakenmere"]) {
      const m = maps[id]!;
      // The map's own layouts first, exactly as they were; then one for every count up to its new most.
      expect(m.capitalLayouts!.slice(0, mapFiles[id]!.capitalLayouts!.length)).toEqual(mapFiles[id]!.capitalLayouts);
      for (let n = m.minPlayers; n <= bigTables[id]!.maxPlayers; n++) expect(m.capitalLayouts!.filter((l) => l.players === n)).toHaveLength(1);
      // (Session 34b: and the later layout versions beside them, `layouts-v2.test.ts`.)
      const { layoutVersions: _later, ...rest } = m;
      expect({ ...rest, maxPlayers: 10, capitalLayouts: mapFiles[id]!.capitalLayouts }).toEqual(mapFiles[id]);
    }
    // Every other map as it is.
    for (const id of Object.keys(maps)) if (!bigTables[id]) expect(maps[id]).toBe(mapFiles[id]);
  });

  it("pinned: each new layout is the map's own capital spots, within the exposure band of 4.0, no two capitals side by side, and its head start is version 5's", () => {
    const v5 = randomVersionDef(5);
    for (const [id, big] of Object.entries(bigTables)) {
      const map = mapFiles[id]!;
      const d = allDistances(map), adj = adjacency(map);
      for (const l of big.layouts) {
        expect(l.slots).toHaveLength(l.players);
        for (const s of l.slots) expect(map.capitalSlots).toContain(s);
        expect(exposureOf(l.slots, d, adj, 4).fair).toBe(true);
        for (const a of l.slots) for (const b of l.slots) if (a !== b) expect(d.get(a)!.get(b)).toBeGreaterThanOrEqual(2);
      }
      // The head start, the market and the harder spots are exactly what version 5's rules make of these spots.
      const again = markHarder({ ...map, capitalLayouts: big.layouts.map((l) => ({ players: l.players, slots: l.slots })) }, 0, v5.grade, v5.start);
      expect(again.capitalLayouts).toEqual(big.layouts);
    }
    expect(Object.keys(bigTables).sort()).toEqual(["krakenmere", "rootholm"]);
  });

  it("the seat rule at 20: ten people and ten bots on Rootholm, no person on a harder spot while a bot holds an ordinary one", () => {
    const ctx = { map: maps.rootholm!, rules: defaultRules };
    const layout = maps.rootholm!.capitalLayouts!.find((l) => l.players === 20)!;
    const harder = new Set(layout.harder);
    expect(harder.size).toBeGreaterThan(0);
    for (const seed of ["s34-a", "s34-b", "s34-c", "s34-d"]) {
      const players = Array.from({ length: 20 }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}`, ...(i >= 10 ? { bot: true } : {}) }));
      const s = createGame(ctx, { gameId: seed, seed, players, startBonus: true, seatRule: "botsFirst" });
      expect(new Set(s.players.map((p) => p.capital)).size).toBe(20);
      expect(new Set(s.players.map((p) => p.house)).size).toBe(20);
      const peopleOnHarder = s.players.filter((p) => Number(p.id.slice(1)) <= 10 && harder.has(p.capital)).length;
      // Four harder spots, ten bots: every harder spot goes to a bot.
      expect(peopleOnHarder).toBe(0);
      // A 20-seat game's view is still one seat's: it knows its own capital, not the bots' levels or anyone's orders.
      expect(viewFor(ctx, s, "p1").me.id).toBe("p1");
    }
  });
});

describe("a table of 20 seats with 10 people (session 34)", () => {
  it("ten people sit, the eleventh is told the rest are bots; Start deals ten bots; each page gets its own seat's view", async () => {
    const t = testRoom();
    await t.room.createTable({ gameId: "big20", code: "b1g2t3a4b5", settings: { ...settings, mapId: "rootholm", bots: 19 }, seed: "big-seed", host: hostSeat(NATE, 0) });
    const people = Array.from({ length: 10 }, (_, i) => ({ user: `u-${i}`, name: `Friend ${i}`, colour: null }));
    await t.table(NATE);
    for (const [i, who] of people.slice(1).entries()) expect(t.tableOf(await t.act(who, { do: "sit", house: i + 1, leadersRun: true })).you.seat).toBe(i + 1);
    const eleventh = { user: "u-late", name: "Late", colour: null };
    expect(MAX_PEOPLE).toBe(10);
    expect(await t.act(eleventh, { do: "sit", house: 0, leadersRun: true })).toMatchObject({ ok: false, error: TABLE_TEXT.peopleFull });
    expect(TABLE_TEXT.peopleFull).toBe("Ten people are already sitting here. The other seats go to bots.");
    // A person can't take one of the bots' ten colours (the second ten).
    expect(await t.act(eleventh, { do: "sit", house: 15, leadersRun: true })).toMatchObject({ ok: false });
    t.clear();
    await t.act(NATE, { do: "start" });
    const startOf = (u: string) => t.inbox(u).flatMap((m: RoomMessage) => ("start" in m ? [m.start as RoomStart] : [])).at(-1)!;
    const first = startOf(NATE.user);
    expect(first.view.players).toHaveLength(20);
    expect(first.people).toHaveLength(10);
    expect(new Set(first.view.players.map((p) => p.house)).size).toBe(20);
    for (const [i, who] of people.slice(1).entries()) expect(startOf(who.user).view.me.id).toBe(`p${i + 2}`);
    expect(first.view.me.id).toBe("p1");
  }, 60_000);
});

describe("twenty Houses (session 34)", () => {
  // CIEDE2000, the difference a person sees between two colours.
  const lab = (h: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [number, number, number];
    const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047, y = r * 0.2126 + g * 0.7152 + b * 0.0722, z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
    return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))] as const;
  };
  const de2000 = (p: string, q: string) => {
    const [L1, a1, b1] = lab(p), [L2, a2, b2] = lab(q), rad = Math.PI / 180;
    const Cb = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2, G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
    const a1p = a1 * (1 + G), a2p = a2 * (1 + G), C1 = Math.hypot(a1p, b1), C2 = Math.hypot(a2p, b2);
    const hue = (x: number, y: number) => ((Math.atan2(y, x) / rad) + 360) % 360;
    const h1 = hue(a1p, b1), h2 = hue(a2p, b2);
    let dh = h2 - h1;
    if (C1 * C2 === 0) dh = 0;
    else if (dh > 180) dh -= 360;
    else if (dh < -180) dh += 360;
    const dH = 2 * Math.sqrt(C1 * C2) * Math.sin((dh * rad) / 2), Lb = (L1 + L2) / 2, Cp = (C1 + C2) / 2;
    let hb = h1 + h2;
    if (C1 * C2 !== 0) hb = (Math.abs(h1 - h2) > 180 ? (hb < 360 ? hb + 360 : hb - 360) : hb) / 2;
    const T = 1 - 0.17 * Math.cos((hb - 30) * rad) + 0.24 * Math.cos(2 * hb * rad) + 0.32 * Math.cos((3 * hb + 6) * rad) - 0.2 * Math.cos((4 * hb - 63) * rad);
    const RC = 2 * Math.sqrt(Cp ** 7 / (Cp ** 7 + 25 ** 7)), SL = 1 + (0.015 * (Lb - 50) ** 2) / Math.sqrt(20 + (Lb - 50) ** 2), SC = 1 + 0.045 * Cp, SH = 1 + 0.015 * Cp * T;
    const RT = -Math.sin(2 * 30 * Math.exp(-(((hb - 275) / 25) ** 2)) * rad) * RC;
    return Math.sqrt(((L2 - L1) / SL) ** 2 + ((C2 - C1) / SC) ** 2 + (dH / SH) ** 2 + RT * ((C2 - C1) / SC) * (dH / SH));
  };

  it("every pair of the twenty is at least 17 apart (CIEDE2000; the first ten's closest pair is 20.9), and none is the unowned land's", () => {
    expect(HOUSES).toHaveLength(20);
    let worst = 99;
    for (let i = 0; i < HOUSES.length; i++) {
      // (Argent, silver, is 16.1 from the unowned land's parchment; the second ten are all more than 17 from it.)
      expect(de2000(HOUSES[i]!.color, "#d8cdb0")).toBeGreaterThan(i >= 10 ? 17 : 16);
      for (let j = i + 1; j < HOUSES.length; j++) worst = Math.min(worst, de2000(HOUSES[i]!.color, HOUSES[j]!.color));
    }
    expect(worst).toBeGreaterThanOrEqual(17);
    expect(Math.min(...HOUSES.slice(0, 10).flatMap((h, i) => HOUSES.slice(i + 1, 10).map((k) => de2000(h.color, k.color))))).toBeCloseTo(20.9, 1);
  });

  it("each its own pattern (colour never carries a House alone), its own name and its plain word; people pick from the first ten", () => {
    expect(new Set(HOUSES.map((h) => h.pattern)).size).toBe(20);
    expect(new Set(HOUSES.map((h) => h.name)).size).toBe(20);
    expect(HOUSES.slice(10).map((h) => h.name)).toEqual(["Rose", "Sinople", "Verdigris", "Olive", "Chartreuse", "Cendrée", "Brunâtre", "Indigo", "Carnation", "Sanguine"]);
    expect(HOUSE_PLAIN).toHaveLength(20);
    expect(new Set(HOUSE_PLAIN).size).toBe(20);
    // In the voice: a tincture is one capitalised word, its plain word lower case.
    for (const h of HOUSES) expect(h.name).toMatch(/^\p{Lu}\p{Ll}+$/u);
    for (const w of HOUSE_PLAIN) expect(w).toMatch(/^[a-z]+( [a-z]+)?$/);
    expect(PEOPLE_HOUSES).toBe(10);
  });

  it("nineteen bots' names, all different (a 20-seat table is you and nineteen)", () => {
    expect(BOT_NAMES).toHaveLength(19);
    expect(new Set(BOT_NAMES).size).toBe(19);
  });
});

describe("the Houses panel at a big table on a phone (session 34)", () => {
  it("you, the people, the bots you have a deal with, then the rest by seat; the knocked out last; 'and 12 more'", () => {
    const players = Array.from({ length: 20 }, (_, i) => ({ id: `p${i + 1}`, eliminatedTurn: i === 2 ? 5 : null }));
    const view = { me: { id: "p4" }, players } as unknown as Parameters<typeof phoneOrder>[0];
    const order = phoneOrder(view, ["p1", "p4", "p9"], new Set(["p15"]));
    expect(order.slice(0, 5)).toEqual(["p4", "p1", "p9", "p15", "p2"]);
    expect(order.at(-1)).toBe("p3");
    expect(order).toHaveLength(20);
    expect(PHONE_ROWS).toBe(8);
    expect(PANEL_TEXT.more(12)).toBe("and 12 more");
    expect(PANEL_TEXT.fewer).toBe("Show fewer");
  });
});
