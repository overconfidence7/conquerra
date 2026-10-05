import { defaultRules, type MapDef } from "@conquerra/content";
import type { GameContext, PlayerView, TerritoryId } from "@conquerra/engine";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { scaleForPx, type ZoomLevel } from "../../map/zoom";
import type { IllustratedRenderer } from "../../render/pixi/PixiMapRenderer";
import type { MapScene } from "../../render/types";
import { chokeTerritories, labView } from "./core";

/** A typical territory's width on screen at each zoom (the same as `pnpm map-check`). */
export const ZOOM_PX: Record<ZoomLevel, number> = { far: 48, mid: 120, near: 260 };

export interface PreviewOptions {
  /** Capitals (and their Houses) for this many players. */
  players: number;
  capitals: boolean;
  names: boolean;
  chokes: boolean;
  tactical: boolean;
}

export interface MapPreviewHandle {
  zoom(level: ZoomLevel): void;
  fit(): void;
  snapshot(): string | null;
  renderer(): IllustratedRenderer | null;
}

interface Props {
  map: MapDef;
  options: PreviewOptions;
  /** A tap on a territory (null: the sea). */
  onPick?(id: TerritoryId | null): void;
  /** Show this view instead of a new game's (the art bench sets owners, buildings and culture itself). */
  given?: { ctx: GameContext; view: PlayerView };
  /** Start with this territory selected (its neighbours marked). */
  select?: TerritoryId | null;
}

/**
 * A finished map, drawn by the game's own renderer (painting, info layer, provinces and plaques, Far / Mid / Near,
 * Tactical), as a new game would start. Takes any MapDef, so the player map builder can reuse it.
 */
export const MapPreview = forwardRef<MapPreviewHandle, Props>(function MapPreview({ map, options, onPick, given, select = null }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const r = useRef<IllustratedRenderer | null>(null);
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<TerritoryId | null>(select);
  const pick = useRef(onPick);
  pick.current = onPick;
  const { ctx, view } = useMemo(() => given ?? labView(map, defaultRules, options.players, options.capitals), [given, map, options.players, options.capitals]);
  const chokes = useMemo(() => chokeTerritories(map), [map]);

  useImperativeHandle(ref, () => ({
    zoom(level) {
      const rr = r.current;
      if (!rr) return;
      const cam = rr.camera;
      const mx = (cam.vp.width / 2 - cam.cam.x) / cam.cam.scale, my = (cam.vp.height / 2 - cam.cam.y) / cam.cam.scale;
      cam.centreOn(mx, my, scaleForPx(ZOOM_PX[level], cam.territorySize), 300);
    },
    fit: () => r.current?.fit(),
    snapshot: () => r.current?.snapshot() ?? null,
    renderer: () => r.current,
  }));

  useEffect(() => {
    let cancelled = false;
    let made: IllustratedRenderer | null = null;
    setReady(false);
    setSelected(select);
    (async () => {
      const { createIllustratedRenderer } = await import("../../render/pixi/PixiMapRenderer");
      const rr = await createIllustratedRenderer({
        ctx,
        host: host.current!,
        tactical: options.tactical,
        focus: null,
        events: {
          tap: (t) => {
            setSelected(t);
            pick.current?.(t);
          },
          inspect: () => {},
        },
      });
      made = rr;
      if (cancelled) return rr.destroy();
      r.current = rr;
      (window as unknown as { __conquerraMap?: IllustratedRenderer }).__conquerraMap = rr;
      setReady(true);
    })();
    return () => {
      cancelled = true;
      made?.destroy();
      r.current = null;
    };
    // One renderer per map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    if (!ready || !r.current) return;
    const scene: MapScene = { view, selected, targets: [], glow: options.chokes ? chokes : [], arrows: [], arriving: [], odds: null };
    r.current.setScene(scene);
  }, [ready, view, selected, options.chokes, chokes]);

  useEffect(() => {
    if (ready) r.current?.setTactical(options.tactical);
  }, [ready, options.tactical]);
  useEffect(() => {
    if (ready) r.current?.setNamesVisible(options.names);
  }, [ready, options.names]);

  return (
    <div className="lab-preview map-host" ref={host} data-ready={ready ? "1" : "0"}>
      {!ready && <div className="map-loading">Painting the map…</div>}
    </div>
  );
});
