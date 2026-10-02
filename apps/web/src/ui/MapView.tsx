import type { GameContext, Order, PlayerView, TerritoryId } from "@conquerra/engine";
import { useEffect, useMemo, useRef, useState } from "react";
import { isAttack, isMine, moveTargets, oddsFor, type MoveDraft } from "../logic/orders";
import { territoryCard } from "../map/card";
import type { MapRenderer, MapScene, OrderArrow } from "../render/types";

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

const TACTICAL_KEY = "conquerra.tactical";
const readTactical = () => {
  try {
    return localStorage.getItem(TACTICAL_KEY) === "1";
  } catch {
    return false;
  }
};

/** Builds what the map shows from the game screen's state. */
export function buildScene(ctx: GameContext, view: PlayerView, queue: readonly Order[], selected: TerritoryId | null, draft: MoveDraft | null, showTargets: boolean): MapScene {
  const arrows: OrderArrow[] = [
    ...queue.flatMap((o, i) => (o.kind === "move" ? [{ key: o.id, from: o.from, to: o.to, ...(o.via ? { via: o.via } : {}), n: i + 1, troops: o.troops, attack: !isMine(view, o.to), draft: false }] : [])),
    ...(draft ? [{ key: "draft", from: draft.from, to: draft.to, ...(draft.via ? { via: draft.via } : {}), n: 0, troops: draft.troops, attack: isAttack(view, draft), draft: true }] : []),
  ];
  return {
    view,
    selected,
    targets: showTargets && selected ? moveTargets(ctx, view, selected).map((t) => t.to) : [],
    arrows,
    odds: draft && isAttack(view, draft) ? { target: draft.to, odds: oddsFor(ctx, view, draft) } : null,
  };
}

interface CardState {
  id: TerritoryId;
  x: number;
  y: number;
  how: "hover" | "hold";
}

export function MapView({ ctx, view, queue, selected, draft, showTargets, onTap, onBackground }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const renderer = useRef<MapRenderer | null>(null);
  const [tactical, setTactical] = useState(readTactical);
  const [kind, setKind] = useState<MapRenderer["kind"] | null>(null);
  const [card, setCard] = useState<CardState | null>(null);
  const scene = useMemo(() => buildScene(ctx, view, queue, selected, draft, showTargets), [ctx, view, queue, selected, draft, showTargets]);
  // Latest handlers and scene, for the renderer's callbacks and its async start.
  const live = useRef({ onTap, onBackground, scene });
  live.current = { onTap, onBackground, scene };

  useEffect(() => {
    const el = host.current!;
    let cancelled = false;
    let made: MapRenderer | null = null;
    const opts = {
      ctx,
      host: el,
      tactical: readTactical(),
      focus: view.me.capital,
      events: {
        tap: (t: TerritoryId | null) => {
          setCard(null);
          if (t) live.current.onTap(t);
          else live.current.onBackground?.();
        },
        inspect: (t: TerritoryId | null, at: { x: number; y: number }, how: "hover" | "hold") => setCard(t ? { id: t, x: at.x, y: at.y, how } : null),
      },
    };
    (async () => {
      const { webglAvailable, createIllustratedRenderer } = await import("../render/pixi/PixiMapRenderer");
      let r: MapRenderer;
      if (webglAvailable()) {
        try {
          r = await createIllustratedRenderer(opts);
        } catch (e) {
          console.warn("Illustrated map failed to start; using the Tactical map", e);
          const { createSvgRenderer } = await import("../render/svg/SvgMapRenderer");
          r = createSvgRenderer(opts);
        }
      } else {
        const { createSvgRenderer } = await import("../render/svg/SvgMapRenderer");
        r = createSvgRenderer(opts);
      }
      made = r;
      if (cancelled) return r.destroy();
      renderer.current = r;
      // For the perf/screenshot script and a quick look in the browser console.
      (window as unknown as { __conquerraMap?: MapRenderer }).__conquerraMap = r;
      setKind(r.kind);
      r.setScene(live.current.scene);
    })();
    return () => {
      cancelled = true;
      made?.destroy();
      renderer.current = null;
    };
    // One renderer per map; everything else is passed through setScene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.map]);

  useEffect(() => {
    renderer.current?.setScene(scene);
  }, [scene, kind]);

  useEffect(() => {
    renderer.current?.setTactical(tactical);
    try {
      localStorage.setItem(TACTICAL_KEY, tactical ? "1" : "0");
    } catch {
      // Private browsing: the choice just isn't remembered.
    }
  }, [tactical, kind]);

  const info = card ? territoryCard(ctx, view, card.id) : null;
  const hostW = host.current?.clientWidth ?? 800;

  return (
    <div className="map-host" ref={host} data-renderer={kind ?? "loading"}>
      {!kind && <div className="map-loading">Unrolling the map…</div>}
      <div className="map-tools">
        <button onClick={() => renderer.current?.zoomBy(1.4)} aria-label="Zoom in" title="Zoom in">
          +
        </button>
        <button onClick={() => renderer.current?.zoomBy(1 / 1.4)} aria-label="Zoom out" title="Zoom out">
          −
        </button>
        <button onClick={() => renderer.current?.fit()} aria-label="Fit the whole map" title="Fit the whole map">
          ⤢
        </button>
        {kind === "illustrated" && (
          <button className={tactical ? "on" : ""} onClick={() => setTactical((t) => !t)} aria-pressed={tactical} title="Tactical view: flat colours, every detail">
            Tactical
          </button>
        )}
      </div>
      {info && card && (
        <div
          className={`tcard ${info.uncertain ? "uncertain" : ""}`}
          role="tooltip"
          style={{ left: Math.min(card.x + 14, hostW - 236), top: Math.max(8, card.y - (card.how === "hold" ? 150 : -14)) }}
        >
          <div className="tcard-title">{info.title}</div>
          <div className="tcard-sub">{info.subtitle}</div>
          {info.intel && <div className="tcard-intel">{info.intel}</div>}
          <dl>
            {info.lines.map((l) => (
              <div key={l.label}>
                <dt>{l.label}</dt>
                <dd>
                  {l.color && <span className="swatch" style={{ background: l.color }} />}
                  {l.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
