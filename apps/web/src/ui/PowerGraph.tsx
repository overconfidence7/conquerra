import type { PlayerId, PlayerView } from "@conquerra/engine";
import { useEffect, useRef, useState } from "react";
import { powerSeries } from "../logic/awards";
import { houseOf, type Pattern } from "../map/houses";

/**
 * The power graph on the game-over screen (session 16, Nate #11): each House's share of the map, turn by turn. One
 * line per House in its colour, with its banner's pattern as the line's dash (so Houses never differ by colour
 * alone) and a halo that keeps dark and light Houses visible on the dark page; the winner's line strongest; names
 * at the ends of the lines, a legend, a readout under the pointer, and the numbers as a table.
 */

const DASH: Record<Pattern, string> = {
  plain: "",
  chevron: "10 4",
  pale: "2 4",
  bend: "10 4 2 4",
  fess: "16 4",
  saltire: "6 3",
  cross: "1.5 3.5",
  chief: "12 3 3 3",
  bordure: "4 2",
  quarterly: "8 2 2 2 2 2",
  // Session 34: the second ten.
  perPale: "14 2 2 2",
  perFess: "3 6",
  perBend: "20 3",
  chequy: "5 5",
  barry: "2 2",
  paly: "6 2 6 6",
  lozenge: "12 2 2 2 2 2 2 2",
  pile: "1 6",
  gyronny: "9 3 1 3",
  orle: "4 4 12 4",
};

/** A halo behind a line: light behind dark Houses (Sable, Murrey), dark behind the rest. */
function haloFor(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  return lum < 0.12 ? "rgba(233, 226, 207, 0.85)" : "rgba(8, 12, 18, 0.9)";
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

export function PowerGraph({ view, territories }: { view: PlayerView; territories: number }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.max(280, el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const series = powerSeries(view, territories);
  const turns = series[0]?.points.map((p) => p.turn) ?? [];
  if (turns.length < 2) return null;
  const narrow = width < 520;
  const H = narrow ? 220 : 280;
  // On a narrow screen the names at the ends of the lines don't fit: the legend names every House, and only the
  // winner's name sits on the chart, inside it above its line.
  const M = { left: 36, right: narrow ? 12 : 104, top: narrow ? 22 : 10, bottom: 26 };
  const maxShare = Math.min(1, Math.max(0.2, ...series.flatMap((s) => s.points.map((p) => p.share))) * 1.08);
  const x = (turn: number) => M.left + ((turn - turns[0]!) / Math.max(1, turns.at(-1)! - turns[0]!)) * (width - M.left - M.right);
  const y = (share: number) => M.top + (1 - share / maxShare) * (H - M.top - M.bottom);
  const name = (p: PlayerId) => (p === view.me.id ? "You" : (view.players.find((x) => x.id === p)?.name ?? p));
  const winner = view.winner;
  // Draw the winner last (on top).
  const order = [...series].sort((a, b) => Number(a.player === winner) - Number(b.player === winner));
  // Names at the ends of the lines, nudged apart so they never overlap.
  const ends = series.map((s) => ({ player: s.player, y: y(s.points.at(-1)!.share), share: s.points.at(-1)!.share })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) ends[i]!.y = Math.max(ends[i]!.y, ends[i - 1]!.y + 13);
  const shift = Math.max(0, (ends.at(-1)?.y ?? 0) - (H - M.bottom));
  for (const e of ends) e.y -= shift;
  const ticks = [0, 0.25, 0.5, 0.75, 1].filter((t) => t <= maxShare);
  const every = Math.max(1, Math.ceil(turns.length / (narrow ? 5 : 10)));
  const at = hover === null ? null : turns[hover]!;
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    let best = 0;
    for (let i = 0; i < turns.length; i++) if (Math.abs(x(turns[i]!) - px) < Math.abs(x(turns[best]!) - px)) best = i;
    setHover(best);
  };
  const readout = at === null ? null : series.map((s) => ({ player: s.player, share: s.points[hover!]!.share })).sort((a, b) => b.share - a.share);
  return (
    <div className="power-graph" ref={box}>
      <h3>Power by turn: each House's share of the map</h3>
      <div className="graph-wrap">
        <svg width={width} height={H} role="img" aria-label={`Each House's share of the map over ${turns.at(-1)} turn${turns.at(-1) === 1 ? "" : "s"}. ${series.map((s) => `${name(s.player)}: ${pct(s.points.at(-1)!.share)} at the end`).join("; ")}.`} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} className="grid" />
              <text x={M.left - 6} y={y(t)} className="axis" textAnchor="end" dominantBaseline="middle">
                {pct(t)}
              </text>
            </g>
          ))}
          {turns.map((t, i) =>
            i % every === 0 || i === turns.length - 1 ? (
              <text key={t} x={x(t)} y={H - 8} className="axis" textAnchor="middle">
                {t === 0 ? "Start" : t}
              </text>
            ) : null,
          )}
          {order.map((s) => {
            const house = houseOf(view, s.player);
            const pts = s.points.map((p) => `${x(p.turn).toFixed(1)},${y(p.share).toFixed(1)}`).join(" ");
            const w = s.player === winner ? 3.5 : 2;
            return (
              <g key={s.player}>
                <polyline points={pts} fill="none" stroke={haloFor(house.color)} strokeWidth={w + 3} strokeLinejoin="round" strokeLinecap="round" />
                <polyline points={pts} fill="none" stroke={house.color} strokeWidth={w} strokeDasharray={DASH[house.pattern]} strokeLinejoin="round" strokeLinecap="round" opacity={s.player === winner ? 1 : 0.9} />
              </g>
            );
          })}
          {narrow
            ? winner && winner !== "draw" && (
                <text x={width - M.right} y={y(series.find((s) => s.player === winner)!.points.at(-1)!.share) - 9} className="end-label win" textAnchor="end">
                  {name(winner)} {pct(series.find((s) => s.player === winner)!.points.at(-1)!.share)}
                </text>
              )
            : ends.map((e) => (
                <text key={e.player} x={width - M.right + 6} y={e.y} className={`end-label ${e.player === winner ? "win" : ""}`} dominantBaseline="middle">
                  {name(e.player)} {pct(e.share)}
                </text>
              ))}
          {at !== null && <line x1={x(at)} x2={x(at)} y1={M.top} y2={H - M.bottom} className="crosshair" />}
        </svg>
        {readout && (
          <div className="graph-tip" style={{ left: Math.min(width - 170, Math.max(0, x(at!) + 10)) }}>
            <b>{at === 0 ? "Start" : `Turn ${at}`}</b>
            {readout.map((r) => (
              <span key={r.player}>
                <Swatch view={view} player={r.player} /> {name(r.player)} {pct(r.share)}
              </span>
            ))}
          </div>
        )}
      </div>
      <ul className="graph-legend">
        {series.map((s) => (
          <li key={s.player} className={s.player === winner ? "win" : ""}>
            <Swatch view={view} player={s.player} /> {name(s.player)}
            {s.player === winner ? " ♛" : ""}
          </li>
        ))}
      </ul>
      <details className="small">
        <summary>As a table</summary>
        <div className="table-scroll">
          <table className="graph-table">
            <thead>
              <tr>
                <th>Turn</th>
                {series.map((s) => (
                  <th key={s.player}>{name(s.player)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {turns.map((t, i) => (
                <tr key={t}>
                  <th>{t === 0 ? "Start" : t}</th>
                  {series.map((s) => (
                    <td key={s.player}>{pct(s.points[i]!.share)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

/** A short sample of a House's line: its colour, halo and dash. */
function Swatch({ view, player }: { view: PlayerView; player: PlayerId }) {
  const house = houseOf(view, player);
  return (
    <svg width="26" height="10" aria-hidden className="swatch">
      <line x1="2" x2="24" y1="5" y2="5" stroke={haloFor(house.color)} strokeWidth="5" strokeLinecap="round" />
      <line x1="2" x2="24" y1="5" y2="5" stroke={house.color} strokeWidth="2.5" strokeDasharray={DASH[house.pattern]} strokeLinecap="round" />
    </svg>
  );
}
