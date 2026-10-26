import { describe, expect, it } from "vitest";
import type { MapDef } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import type { PlayerView } from "@conquerra/engine";
import { farPills, THIN_FAR_ABOVE, thinsAtFar } from "../src/map/farPills";
import { DESKTOP_ROWS, foldRows, landSeen, PANEL_TEXT, PHONE_ROWS, phoneOrder } from "../src/ui/PlayersPanel";

/**
 * Session 35, the screens at big tables: the desktop's Houses panel folds past ten (so the Leaders panel keeps its
 * place under it), and a 300 or 400 at Far shows a pill only where it reads at a glance.
 */
const seen = (owner: string | null, extra: Record<string, unknown> = {}) => ({ detail: "full", owner, troops: 3, building: null, construction: null, specialists: [], culture: 0, leaders: [], generals: [], capitalOf: null, seenBy: [], ...extra });
const players = (n: number, out: number[] = []) => Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}`, eliminatedTurn: out.includes(i + 1) ? 5 : null, house: i }));

describe("the Houses panel on a desktop past ten Houses (session 35)", () => {
  // Land on your map: p20 holds the most of the bots you see, then p12, then p5; the rest none in sight.
  const territories: Record<string, unknown> = {};
  const give = (who: string, n: number) => {
    for (let i = 0; i < n; i++) territories[`${who}-${i}`] = seen(who);
  };
  give("p20", 9);
  give("p12", 6);
  give("p5", 4);
  // (Land you last saw counts as yours to know; the cloud doesn't.)
  territories["old"] = { detail: "fogged", lastSeen: { owner: "p12", troops: 2, building: null, turn: 3 } };
  territories["cloud"] = { detail: "fogged", unknown: true };
  const viewOf = (n: number) => ({ me: { id: "p1" }, players: players(n, n > 3 ? [3] : []), territories }) as unknown as PlayerView;

  it("the order: you, the people, the bots you deal with, then the other bots by the land you see (most first), the knocked out last", () => {
    const view = viewOf(20);
    expect(landSeen(view).get("p12")).toBe(7);
    const order = phoneOrder(view, ["p1", "p9"], new Set(["p15"]), landSeen(view));
    expect(order.slice(0, 6)).toEqual(["p1", "p9", "p15", "p20", "p12", "p5"]);
    // Then the rest in seat order, and the knocked out last.
    expect(order.slice(6, 8)).toEqual(["p2", "p4"]);
    expect(order.at(-1)).toBe("p3");
    // The phone's order is session 34's (seat order after the deals): no land.
    expect(phoneOrder(view, ["p1", "p9"], new Set(["p15"])).slice(0, 5)).toEqual(["p1", "p9", "p15", "p2", "p4"]);
  });

  it("20 Houses: the first ten, then 'and 10 more' (opened: all twenty, 'Show fewer')", () => {
    const order = phoneOrder(viewOf(20), ["p1"], new Set(), landSeen(viewOf(20)));
    expect(DESKTOP_ROWS).toBe(10);
    const shown = foldRows(order, DESKTOP_ROWS, false);
    expect(shown).toHaveLength(10);
    expect(PANEL_TEXT.more(order.length - shown.length)).toBe("and 10 more");
    expect(foldRows(order, DESKTOP_ROWS, true)).toHaveLength(20);
    // The phone's eight (session 34): "and 12 more".
    expect(PANEL_TEXT.more(20 - foldRows(order, PHONE_ROWS, false).length)).toBe("and 12 more");
  });

  it("11 Houses: all eleven (a fold would only hide one); 12: ten and 'and 2 more'; ten or fewer never fold", () => {
    expect(foldRows(phoneOrder(viewOf(11), ["p1"], new Set()), DESKTOP_ROWS, false)).toHaveLength(11);
    expect(foldRows(phoneOrder(viewOf(12), ["p1"], new Set()), DESKTOP_ROWS, false)).toHaveLength(10);
    for (const n of [4, 8, 10]) expect(foldRows(players(n), DESKTOP_ROWS, false)).toHaveLength(n);
  });
});

/** A made-up map of `cols` x 15 squares, each touching the four beside it. */
function grid(cols: number): MapDef {
  const territories = [] as MapDef["territories"];
  const borders = [] as MapDef["borders"];
  const id = (x: number, y: number) => `t${x}-${y}`;
  for (let x = 0; x < cols; x++)
    for (let y = 0; y < 15; y++) {
      territories.push({ id: id(x, y), name: id(x, y), province: "p", terrain: "plains" } as MapDef["territories"][number]);
      if (x > 0) borders.push({ a: id(x - 1, y), b: id(x, y), type: "normal" });
      if (y > 0) borders.push({ a: id(x, y - 1), b: id(x, y), type: "normal" });
    }
  return { id: "grid", territories, borders } as unknown as MapDef;
}

describe("the pills at Far on a big map (session 35)", () => {
  it("only maps over 200 territories thin: the twelve official maps and the 200s are unchanged", () => {
    expect(THIN_FAR_ABOVE).toBe(200);
    for (const m of Object.values(maps)) expect(thinsAtFar(m)).toBe(false);
    expect(thinsAtFar(grid(14))).toBe(true); // 210
    const view = { me: { id: "me" }, players: [], territories: Object.fromEntries(maps.embervale!.territories.map((t) => [t.id, seen("me")])) } as unknown as PlayerView;
    expect(farPills(maps.embervale!, view)).toBeNull();
  });

  it("keeps capitals, your Leader, your land on its border and a rival's where it meets another House; never neutral or interior land, never the cloud", () => {
    const map = grid(20); // 300 squares
    const territories: Record<string, unknown> = {};
    // You hold columns 0 to 4, the rival columns 10 to 14, a third House columns 15 to 19; 5 to 9 are neutral.
    for (const t of map.territories) {
      const x = Number(t.id.slice(1).split("-")[0]);
      territories[t.id] = seen(x <= 4 ? "me" : x >= 15 ? "third" : x >= 10 ? "rival" : null);
    }
    territories["t2-7"] = seen("me", { capitalOf: "me" });
    territories["t12-7"] = seen("rival", { capitalOf: "rival" });
    territories["t1-1"] = seen("me", { leaders: [{ id: "L" }] });
    // A corner you've never seen.
    territories["t19-14"] = { detail: "fogged", unknown: true };
    const keep = farPills(map, { me: { id: "me" }, players: [], territories } as unknown as PlayerView)!;
    expect(keep.has("t2-7") && keep.has("t12-7") && keep.has("t1-1")).toBe(true);
    // Your border with the neutral land (column 4), and the rival's border with the third House (columns 14 and 15).
    for (let y = 0; y < 15; y++) {
      expect(keep.has(`t4-${y}`)).toBe(true);
      expect(keep.has(`t14-${y}`)).toBe(true);
      if (y < 14) expect(keep.has(`t15-${y}`)).toBe(true);
    }
    // Interior land (yours and theirs), neutral land, the rival's edge on neutral land, and the cloud: no pill at Far.
    for (const t of ["t0-0", "t3-3", "t12-0", "t7-7", "t5-5", "t9-9", "t10-3", "t18-3", "t19-14"]) expect(keep.has(t)).toBe(false);
    // About one pill in five, not three hundred.
    expect(keep.size).toBeLessThan(60);
  });

  it("reads only what the seat knows: a rival's land last seen counts as theirs, a territory in the cloud as no one's", () => {
    const map = grid(14);
    const territories: Record<string, unknown> = Object.fromEntries(map.territories.map((t) => [t.id, { detail: "fogged", unknown: true }]));
    territories["t0-0"] = seen("me");
    territories["t1-0"] = { detail: "fogged", lastSeen: { owner: "rival", troops: 4, building: null, turn: 2 } };
    territories["t2-0"] = { detail: "fogged", lastSeen: { owner: "rival", troops: 1, building: null, turn: 2 } };
    const keep = farPills(map, { me: { id: "me" }, players: [], territories } as unknown as PlayerView)!;
    expect([...keep].sort()).toEqual(["t0-0", "t1-0"]);
  });
});
