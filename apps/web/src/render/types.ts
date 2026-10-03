import type { GameContext, PlayerView, TerritoryId } from "@conquerra/engine";
import type { Odds } from "../logic/orders";
import type { Insets } from "../map/camera";
import type { ZoomLevel } from "../map/zoom";

/** A queued (or being-drafted) move or attack, drawn as an arrow. */
export interface OrderArrow {
  key: string;
  from: TerritoryId;
  to: TerritoryId;
  via?: TerritoryId;
  /** Position in the order list (0 for the draft). */
  n: number;
  troops: number | "all";
  attack: boolean;
  draft: boolean;
}

/** Everything the map shows that changes during a game. The UI builds this; the renderer just draws it. */
export interface MapScene {
  view: PlayerView;
  selected: TerritoryId | null;
  /** Territories the selected army can reach (highlighted). */
  targets: TerritoryId[];
  arrows: OrderArrow[];
  /** The odds badge (four pips) on the target of the attack being drafted. */
  odds: { target: TerritoryId; odds: Odds } | null;
}

export interface MapEvents {
  /** A tap or click on a territory, or on the sea / empty map (null). */
  tap(territory: TerritoryId | null): void;
  /** Mouse hover, or tap-and-hold on a phone: show the card for this territory at this screen point; null hides it. */
  inspect(territory: TerritoryId | null, at: { x: number; y: number }, how: "hover" | "hold"): void;
  zoomChanged?(level: ZoomLevel): void;
}

/** The small interface the UI uses: "show this view, highlight this, draw these orders". */
export interface MapRenderer {
  readonly kind: "illustrated" | "svg";
  setScene(scene: MapScene): void;
  setTactical(on: boolean): void;
  fit(animate?: boolean): void;
  /** Screen space covered by menus over the map; fitting and panning use the rest. */
  setInsets(insets: Insets): void;
  zoomBy(factor: number): void;
  resize(): void;
  destroy(): void;
}

export interface RendererOptions {
  ctx: GameContext;
  host: HTMLElement;
  events: MapEvents;
  tactical: boolean;
  insets?: Insets;
  /** Where to look first (your capital). */
  focus?: TerritoryId | null;
}
