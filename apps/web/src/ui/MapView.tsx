import { indexMap, type GameContext, type Order, type PlayerView, type TerritoryId } from "@conquerra/engine";
import { useMemo } from "react";
import { buildGeometry } from "../map/geometry";
import { isMine, moveTargets, type MoveDraft } from "../logic/orders";
import { BUILDING_ICON, SPECIALIST_ICON, TERRAIN_ICON } from "../logic/text";
import { colorOf } from "./colors";

interface Props {
  ctx: GameContext;
  view: PlayerView;
  queue: readonly Order[];
  selected: TerritoryId | null;
  draft: MoveDraft | null;
  /** Show who could be reached from the selected territory. */
  showTargets: boolean;
  onTap(t: TerritoryId): void;
  onBackground?(): void;
}

export function MapView({ ctx, view, queue, selected, draft, showTargets, onTap, onBackground }: Props) {
  const geo = useMemo(() => buildGeometry(ctx.map), [ctx.map]);
  const idx = indexMap(ctx.map);
  const targets = useMemo(
    () => new Set(showTargets && selected ? moveTargets(ctx, view, selected).map((t) => t.to) : []),
    [ctx, view, selected, showTargets],
  );
  const [vx, vy, vw, vh] = geo.viewBox;
  const arrows = [
    ...queue.flatMap((o, i) => (o.kind === "move" ? [{ key: o.id, from: o.from, to: o.to, via: o.via, n: i + 1, troops: o.troops, draft: false }] : [])),
    ...(draft ? [{ key: "draft", from: draft.from, to: draft.to, via: draft.via, n: 0, troops: draft.troops, draft: true }] : []),
  ];

  return (
    <svg
      className="map"
      viewBox={`${vx} ${vy} ${vw} ${vh}`}
      role="img"
      aria-label="Game map"
      onClick={(e) => e.target === e.currentTarget && onBackground?.()}
    >
      <defs>
        <pattern id="fog" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="8" height="8" fill="var(--fog)" />
          <line x1="0" y1="0" x2="0" y2="8" stroke="var(--fog-line)" strokeWidth="3" />
        </pattern>
        <marker id="arrow-move" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0,0L10,5L0,10z" fill="var(--move)" />
        </marker>
        <marker id="arrow-attack" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0,0L10,5L0,10z" fill="var(--attack)" />
        </marker>
      </defs>
      <rect x={vx} y={vy} width={vw} height={vh} fill="var(--sea)" onClick={() => onBackground?.()} />

      {/* Territories */}
      {ctx.map.territories.map((t) => {
        const v = view.territories[t.id]!;
        const fogged = v.detail !== "full";
        const fill = fogged ? "url(#fog)" : colorOf(view, v.owner);
        const cls = ["cell", fogged ? "fogged" : "", targets.has(t.id) ? "target" : "", selected === t.id ? "selected" : ""].join(" ");
        return (
          <path key={t.id} d={geo.cells.get(t.id)} fill={fill} className={cls} data-id={t.id} role="button" aria-label={t.name} onClick={() => onTap(t.id)} />
        );
      })}

      {/* Borders */}
      <path d={geo.provinceEdges} className="province-edge" />
      {geo.specialEdges.map((e) => (
        <path key={`${e.a}${e.b}`} d={e.d} className={e.type === "river" ? "river" : "pass"} />
      ))}
      {geo.connectors.map((c) => {
        const [x1, y1] = geo.centers.get(c.a)!;
        const [x2, y2] = geo.centers.get(c.b)!;
        return <line key={`${c.a}${c.b}`} x1={x1} y1={y1} x2={x2} y2={y2} className="connector" />;
      })}
      {selected && geo.cells.get(selected) && <path d={geo.cells.get(selected)} className="selected-outline" />}

      {geo.provinceLabels.map((p) => (
        <text key={p.id} x={p.x} y={p.y + 4} className="province-label">
          {p.name}
        </text>
      ))}

      {/* Queued moves and attacks */}
      {arrows.map((a) => {
        const pts = [a.from, ...(a.via ? [a.via] : []), a.to].map((id) => geo.centers.get(id)!);
        const attack = !isMine(view, a.to);
        const [ex, ey] = pts[pts.length - 1]!;
        const [sx, sy] = pts[pts.length - 2]!;
        const len = Math.hypot(ex - sx, ey - sy) || 1;
        const end: [number, number] = [ex - ((ex - sx) / len) * 22, ey - ((ey - sy) / len) * 22];
        const start = pts[0]!;
        const via = pts.length > 2 ? pts[1]! : null;
        const line = via ? [start, via, end] : [start, end];
        const mid = via ?? [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
        return (
          <g key={a.key} className={`arrow ${attack ? "attack" : "move"} ${a.draft ? "draft" : ""}`}>
            <polyline points={line.map((p) => p.join(",")).join(" ")} markerEnd={`url(#arrow-${attack ? "attack" : "move"})`} />
            <text x={mid[0]} y={mid[1] - 5} className="arrow-label">
              {a.draft ? "" : `${a.n}·`}
              {a.troops}
            </text>
          </g>
        );
      })}

      {/* Labels: troops, badges, terrain */}
      {ctx.map.territories.map((t) => {
        const v = view.territories[t.id]!;
        const [x, y] = geo.centers.get(t.id)!;
        const def = idx.byId.get(t.id)!;
        const income = ctx.rules.terrain[def.terrain].income;
        if (v.detail !== "full")
          return (
            <g key={t.id} className="label fogged-label" pointerEvents="none">
              <text x={x} y={y + 4} className="terrain-big">
                {TERRAIN_ICON[def.terrain] || "·"}
              </text>
              <text x={x} y={y + 24} className="value">
                +{income}
              </text>
            </g>
          );
        const leader = v.leaders.length > 0;
        const badges = [
          ...v.specialists.map((s) => SPECIALIST_ICON[s.type]),
          ...(v.building ? [BUILDING_ICON[v.building]] : v.construction ? ["🚧"] : []),
        ];
        return (
          <g key={t.id} className="label" pointerEvents="none">
            <text x={x} y={y - 24} className="tname">
              {t.name}
            </text>
            <circle cx={x} cy={y} r={15} className="troop-bg" stroke={colorOf(view, v.owner)} />
            <text x={x} y={y + 5.5} className="troops">
              {v.troops}
            </text>
            {leader && (
              <text x={x + 15} y={y - 9} className="badge">
                👑
              </text>
            )}
            {t.id === view.me.capital && v.owner === view.me.id && (
              <text x={x - 16} y={y - 9} className="badge">
                ★
              </text>
            )}
            {badges.length > 0 && (
              <text x={x} y={y + 30} className="badge">
                {badges.join("")}
              </text>
            )}
            {TERRAIN_ICON[def.terrain] && (
              <text x={x + 21} y={y + 14} className="terrain-small">
                {TERRAIN_ICON[def.terrain]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
