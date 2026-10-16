import type { MapDef } from "@conquerra/content";
import { indexMap, type PlayerId, type TerritoryId } from "@conquerra/engine";
import type { Board } from "../board";
import { knownExtras } from "../known";

/**
 * The shape of the realm (session 20d, Nate's third note): where a Steward with a plan builds what.
 *
 *  - **Interior-ness:** how many steps a territory of ours is from the nearest land that isn't ours (0 on the border).
 *    Markets and barracks go deep inside, where they're safe.
 *  - **Choke-ness:** a territory of ours on a pass or sea lane, at either end of a land bridge (the map maker's choke
 *    points: a single border holding two big parts of the map together), or one whose loss would cut our realm in two.
 *    Forts go there.
 *  - **Wall candidates:** the capital's province, and every province we hold whole that borders a rival. Forts go there
 *    too (a fort is half a wall), and a threatened Steward walls them first.
 *  - **Threatened:** a rival army (at least `army` troops) within 2 steps of the capital's province, or a runaway on
 *    the map (`runawayToo`: anywhere, only one whose land touches ours, or never). Then a Steward puts everything into
 *    the wall until it stands.
 *
 * Everything here is worked out from the map and the owner's own view (the board): nothing hidden.
 */
export interface RealmShape {
  interior: ReadonlyMap<TerritoryId, number>;
  choke: ReadonlySet<TerritoryId>;
  /** Wall candidates, best first: the capital, the rest of its province, then provinces held whole facing a rival. */
  wallCandidates: readonly TerritoryId[];
  threatened: boolean;
  /** The rival armies that make it so (for the panel's reason). */
  threat: { at: TerritoryId; troops: number; rival: PlayerId } | null;
}

/** The map's own choke territories (passes, sea lanes, both ends of a land bridge), worked out once a map. */
const mapChokes = new WeakMap<MapDef, ReadonlySet<TerritoryId>>();
export function chokeTerritories(map: MapDef): ReadonlySet<TerritoryId> {
  const hit = mapChokes.get(map);
  if (hit) return hit;
  const out = new Set<TerritoryId>();
  const land = new Map<TerritoryId, TerritoryId[]>(map.territories.map((t) => [t.id, []]));
  // Session 32, blackout: a pass or sea lane from known land into the cloud shows on the map, so its known end counts.
  for (const [t, kinds] of knownExtras(map).cloud) if (kinds.includes("pass") || kinds.includes("sea")) out.add(t);
  for (const b of map.borders) {
    if (b.type === "pass" || b.type === "sea") (out.add(b.a), out.add(b.b));
    if (b.type !== "sea") (land.get(b.a)!.push(b.b), land.get(b.b)!.push(b.a));
  }
  // Land bridges: bridges of the land graph (Tarjan's low-link) whose two sides each hold 3 territories or more.
  const disc = new Map<TerritoryId, number>();
  const low = new Map<TerritoryId, number>();
  const size = new Map<TerritoryId, number>();
  const comp = new Map<TerritoryId, number>();
  let time = 0;
  const bridges: [TerritoryId, TerritoryId][] = [];
  for (const root of [...land.keys()].sort()) {
    if (disc.has(root)) continue;
    const members: TerritoryId[] = [];
    const stack: { t: TerritoryId; parent: TerritoryId | null; i: number }[] = [{ t: root, parent: null, i: 0 }];
    disc.set(root, time), low.set(root, time++), size.set(root, 1), members.push(root);
    while (stack.length) {
      const top = stack[stack.length - 1]!;
      const nbs = land.get(top.t)!;
      if (top.i < nbs.length) {
        const nb = nbs[top.i++]!;
        if (nb === top.parent) continue;
        if (!disc.has(nb)) {
          disc.set(nb, time), low.set(nb, time++), size.set(nb, 1), members.push(nb);
          stack.push({ t: nb, parent: top.t, i: 0 });
        } else low.set(top.t, Math.min(low.get(top.t)!, disc.get(nb)!));
      } else {
        stack.pop();
        if (top.parent !== null) {
          low.set(top.parent, Math.min(low.get(top.parent)!, low.get(top.t)!));
          size.set(top.parent, size.get(top.parent)! + size.get(top.t)!);
          if (low.get(top.t)! > disc.get(top.parent)!) bridges.push([top.parent, top.t]);
        }
      }
    }
    for (const m of members) comp.set(m, members.length);
  }
  for (const [a, b] of bridges) {
    const below = size.get(b)!;
    if (below >= 3 && comp.get(a)! - below >= 3) (out.add(a), out.add(b));
  }
  mapChokes.set(map, out);
  return out;
}

/** Territories of ours whose loss would cut our realm in two (articulation points of our own land, borders of any kind). */
export function cutPoints(b: Board): Set<TerritoryId> {
  const { idx, owned, mine } = b;
  const out = new Set<TerritoryId>();
  const disc = new Map<TerritoryId, number>();
  const low = new Map<TerritoryId, number>();
  let time = 0;
  for (const root of mine) {
    if (disc.has(root)) continue;
    let rootKids = 0;
    const stack: { t: TerritoryId; parent: TerritoryId | null; i: number }[] = [{ t: root, parent: null, i: 0 }];
    disc.set(root, time), low.set(root, time++);
    while (stack.length) {
      const top = stack[stack.length - 1]!;
      const nbs = idx.neighbors.get(top.t)!;
      if (top.i < nbs.length) {
        const nb = nbs[top.i++]!;
        if (!owned(nb) || nb === top.parent) continue;
        if (!disc.has(nb)) {
          disc.set(nb, time), low.set(nb, time++);
          if (top.t === root) rootKids++;
          stack.push({ t: nb, parent: top.t, i: 0 });
        } else low.set(top.t, Math.min(low.get(top.t)!, disc.get(nb)!));
      } else {
        stack.pop();
        const p = top.parent;
        if (p !== null) {
          low.set(p, Math.min(low.get(p)!, low.get(top.t)!));
          if (p !== root && low.get(top.t)! >= disc.get(p)!) out.add(p);
        }
      }
    }
    if (rootKids > 1) out.add(root);
  }
  return out;
}

export function realmShape(b: Board, army = 4, runawayToo: boolean | "near" = true): RealmShape {
  const { idx, owned, mine, rivalAt, troopsAt, capital, runaway } = b;
  // Interior-ness: steps from the nearest land of ours touching land that isn't ours.
  const interior = new Map<TerritoryId, number>();
  const q = mine.filter((t) => idx.neighbors.get(t)!.some((x) => !owned(x)));
  for (const t of q) interior.set(t, 0);
  for (let h = 0; h < q.length; h++)
    for (const nb of idx.neighbors.get(q[h]!)!) if (owned(nb) && !interior.has(nb)) (interior.set(nb, interior.get(q[h]!)! + 1), q.push(nb));
  for (const t of mine) if (!interior.has(t)) interior.set(t, 99);
  // Choke-ness: the map's choke points we hold, and land whose loss would cut the realm.
  const mapChoke = chokeTerritories(b.ctx.map);
  const choke = new Set<TerritoryId>([...mine.filter((t) => mapChoke.has(t)), ...cutPoints(b)]);
  // Wall candidates.
  const provinceOf = (t: TerritoryId) => idx.byId.get(t)!.province;
  const members = (p: string) => idx.provinceMembers.get(p) ?? [];
  const capProv = capital ? provinceOf(capital) : null;
  const facesRival = (t: TerritoryId) => idx.neighbors.get(t)!.some((x) => !!rivalAt(x));
  const facing = (t: TerritoryId) => idx.neighbors.get(t)!.reduce((m, x) => Math.max(m, rivalAt(x) ? troopsAt(x) : 0), 0);
  const wholeFacing = [...new Set(mine.map(provinceOf))].filter((p) => p !== capProv && members(p).every(owned) && members(p).some(facesRival));
  const rank = (t: TerritoryId) => (t === capital ? 0 : capProv && provinceOf(t) === capProv ? 1 : 2);
  const wallCandidates = [...(capProv ? members(capProv).filter(owned) : []), ...wholeFacing.flatMap(members)].sort(
    (a, c) => rank(a) - rank(c) || facing(c) - facing(a) || Number(choke.has(c)) - Number(choke.has(a)) || (a < c ? -1 : 1),
  );
  // Threatened: a rival army within 2 steps of the capital's province, or a runaway on the map.
  let threat: RealmShape["threat"] = null;
  if (capProv) {
    const d = new Map<TerritoryId, number>(members(capProv).filter(owned).map((t) => [t, 0]));
    const qq = [...d.keys()];
    for (let h = 0; h < qq.length; h++) {
      const cur = qq[h]!;
      const r = rivalAt(cur);
      if (r && troopsAt(cur) >= army && (!threat || troopsAt(cur) > threat.troops || (troopsAt(cur) === threat.troops && cur < threat.at))) threat = { at: cur, troops: troopsAt(cur), rival: r };
      if (d.get(cur)! >= 2) continue;
      for (const nb of idx.neighbors.get(cur)!) if (!d.has(nb)) (d.set(nb, d.get(cur)! + 1), qq.push(nb));
    }
  }
  return { interior, choke, wallCandidates, threatened: !!threat || (!!runawayToo && !!runaway && runaway !== b.me.id && (runawayToo !== "near" || b.facing.has(runaway))), threat };
}
