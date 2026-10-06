import type { GameContext, Order, PlayerId, PlayerView, TerritoryId } from "@conquerra/engine";
import { useEffect, useMemo, useRef, useState } from "react";
import { isAttack, moveTargets, oddsAreEstimate, oddsFor, passageOpen, planQueue, type MoveDraft } from "../logic/orders";
import type { Insets } from "../map/camera";
import { TerritoryCard } from "./TerritoryCard";
import type { MapRenderer, MapScene, OrderArrow } from "../render/types";

interface Props {
  ctx: GameContext;
  /** Menus over the map: fit and panning use the rest of the screen. */
  insets?: Insets;
  /** Tactical view (owned by the game screen's settings). */
  tactical: boolean;
  /** Shared handle on the renderer (for the minimap and the replay). */
  rendererRef?: React.MutableRefObject<MapRenderer | null>;
  onViewMoved?(rect: { x: number; y: number; width: number; height: number }): void;
  /** Zoom buttons on the map (the game screen has its own). */
  tools?: boolean;
  view: PlayerView;
  queue: readonly Order[];
  selected: TerritoryId | null;
  draft: MoveDraft | null;
  /** Show who could be reached from the selected territory. */
  showTargets: boolean;
  /** Territories to glow gold (recruit sites while the Recruit panel is open). */
  glow?: readonly TerritoryId[];
  /** Truce borders to draw (where you can see them). */
  truces?: MapScene["truces"];
  /** Passage land to draw, and whose land you may march through (right of passage). */
  passage?: MapScene["passage"];
  open?: readonly PlayerId[];
  onTap(t: TerritoryId): void;
  onBackground?(): void;
}

const TACTICAL_KEY = "conquerra.tactical";
export const readTactical = () => {
  try {
    return localStorage.getItem(TACTICAL_KEY) === "1";
  } catch {
    return false;
  }
};
export const saveTactical = (on: boolean) => {
  try {
    localStorage.setItem(TACTICAL_KEY, on ? "1" : "0");
  } catch {
    // Private browsing: the choice just isn't remembered.
  }
};

/** Builds what the map shows from the game screen's state. */
export function buildScene(
  ctx: GameContext,
  view: PlayerView,
  queue: readonly Order[],
  selected: TerritoryId | null,
  draft: MoveDraft | null,
  showTargets: boolean,
  glow: readonly TerritoryId[] = [],
  truces: MapScene["truces"] = [],
  passage: MapScene["passage"] = [],
  open: readonly PlayerId[] = passageOpen(view),
): MapScene {
  // Walk the queue step by step, so each arrow is an attack or a move as it will be when it plays.
  const arrows: OrderArrow[] = [];
  queue.forEach((o, i) => {
    if (o.kind !== "move") return;
    const before = planQueue(ctx, view, queue.slice(0, i));
    arrows.push({ key: o.id, from: o.from, to: o.to, ...(o.via ? { via: o.via } : {}), ...(o.through?.length ? { through: o.through } : {}), n: i + 1, hop: null, attack: isAttack(view, o, before), draft: false });
  });
  const plan = planQueue(ctx, view, queue);
  for (const a of arrows) a.hop = plan.hop[a.n - 1] ?? null;
  if (draft) arrows.push({ key: "draft", from: draft.from, to: draft.to, ...(draft.via ? { via: draft.via } : {}), ...(draft.through ? { through: draft.through } : {}), n: 0, hop: null, attack: isAttack(view, draft, plan), draft: true });
  return {
    view,
    selected,
    targets: showTargets && selected ? moveTargets(ctx, view, selected, plan, open).map((t) => t.to) : [],
    glow: [...glow],
    arrows,
    // Only where an attack should capture (or a hop pushes on from): the plain moves already show on your own markers.
    arriving: [...plan.captured].map((t) => ({ territory: t, troops: plan.arriving.get(t) ?? 0 })),
    odds: draft && isAttack(view, draft, plan) ? { target: draft.to, odds: oddsFor(ctx, view, plan, draft), estimate: oddsAreEstimate(plan, draft) } : null,
    truces,
    passage,
  };
}

const NO_GLOW: readonly TerritoryId[] = [];
const NO_TRUCES: MapScene["truces"] = [];
const NO_PASSAGE: MapScene["passage"] = [];

interface CardState {
  id: TerritoryId;
  x: number;
  y: number;
  how: "hover" | "hold";
}

export function MapView({ ctx, view, queue, selected, draft, showTargets, glow = NO_GLOW, truces = NO_TRUCES, passage = NO_PASSAGE, open, onTap, onBackground, insets, tactical, rendererRef, onViewMoved, tools = false }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const ownRef = useRef<MapRenderer | null>(null);
  const renderer = rendererRef ?? ownRef;
  const [kind, setKind] = useState<MapRenderer["kind"] | null>(null);
  const [card, setCard] = useState<CardState | null>(null);
  const scene = useMemo(() => buildScene(ctx, view, queue, selected, draft, showTargets, glow, truces, passage, open), [ctx, view, queue, selected, draft, showTargets, glow, truces, passage, open]);
  // Latest handlers and scene, for the renderer's callbacks and its async start.
  const live = useRef({ onTap, onBackground, scene, onViewMoved, insets, tactical });
  live.current = { onTap, onBackground, scene, onViewMoved, insets, tactical };

  useEffect(() => {
    const el = host.current!;
    let cancelled = false;
    let made: MapRenderer | null = null;
    const opts = {
      ctx,
      host: el,
      tactical: live.current.tactical,
      focus: view.me.capital,
      ...(live.current.insets ? { insets: live.current.insets } : {}),
      events: {
        tap: (t: TerritoryId | null) => {
          setCard(null);
          if (t) live.current.onTap(t);
          else live.current.onBackground?.();
        },
        inspect: (t: TerritoryId | null, at: { x: number; y: number }, how: "hover" | "hold") => setCard(t ? { id: t, x: at.x, y: at.y, how } : null),
        viewMoved: (r: { x: number; y: number; width: number; height: number }) => live.current.onViewMoved?.(r),
      },
    };
    (async () => {
      const { webglAvailable, createIllustratedRenderer } = await import("../render/pixi/PixiMapRenderer");
      let r: MapRenderer;
      // "?plainmap" in the address forces the plain map (what browsers without WebGL get), for testing.
      const plain = new URLSearchParams(location.search).has("plainmap");
      if (webglAvailable() && !plain) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tactical, kind]);

  const insetKey = insets ? `${insets.top},${insets.right},${insets.bottom},${insets.left}` : "";
  useEffect(() => {
    if (insets) renderer.current?.setInsets(insets);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insetKey, kind]);

  const hostW = host.current?.clientWidth ?? 800;

  return (
    <div className="map-host" ref={host} data-renderer={kind ?? "loading"}>
      {!kind && <div className="map-loading">Unrolling the map…</div>}
      {tools && (
        <div className="map-tools" style={{ top: 8, right: 8 }}>
          <button onClick={() => renderer.current?.zoomBy(1.4)} aria-label="Zoom in">
            +
          </button>
          <button onClick={() => renderer.current?.zoomBy(1 / 1.4)} aria-label="Zoom out">
            −
          </button>
          <button onClick={() => renderer.current?.fit()} aria-label="Fit the whole map">
            ⤢
          </button>
        </div>
      )}
      {card && (
        <div
          className={`hovercard ${card.how === "hold" && card.y > 300 ? "above" : ""}`}
          role="tooltip"
          // Beside the mouse; above the finger on a phone (below it near the top), so it never hides the territory.
          style={{ left: Math.max(4, Math.min(card.x + (card.how === "hold" ? -118 : 14), hostW - 240)), top: card.how === "hold" ? (card.y > 300 ? card.y - 28 : card.y + 36) : card.y + 14 }}
        >
          <TerritoryCard ctx={ctx} view={view} id={card.id} compact={card.how === "hover"} />
        </div>
      )}
    </div>
  );
}
