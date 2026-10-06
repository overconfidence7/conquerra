import type { GameContext, PlayerView, TerritoryId } from "@conquerra/engine";
import type { Odds } from "../logic/orders";
import type { Camera, Insets, Viewport } from "../map/camera";
import type { ReplayFrame } from "../replay/timeline";
import type { ZoomLevel } from "../map/zoom";

/** A queued (or being-drafted) move or attack, drawn as an arrow. */
export interface OrderArrow {
  key: string;
  from: TerritoryId;
  to: TerritoryId;
  via?: TerritoryId;
  /** Right of passage: the partner's land it marches through (the arrow follows the way). */
  through?: TerritoryId[];
  /** Position in the order list (0 for the draft). */
  n: number;
  /** For a chain of hops (an army pushing on from where it arrived): this arrow's hop number. Null otherwise. */
  hop: number | null;
  attack: boolean;
  draft: boolean;
}

/** A faint "arriving" marker where a queued order should land an army (the size is a guess until the turn plays). */
export interface Arrival {
  territory: TerritoryId;
  troops: number;
}

/** Everything the map shows that changes during a game. The UI builds this; the renderer just draws it. */
export interface MapScene {
  view: PlayerView;
  selected: TerritoryId | null;
  /** Territories the selected army can reach (highlighted). */
  targets: TerritoryId[];
  /** Recruit sites, glowing gold while the Recruit panel is open. */
  glow: TerritoryId[];
  arrows: OrderArrow[];
  /** Where queued orders should land armies this turn. */
  arriving: Arrival[];
  /** The odds badge (four pips) on the target of the attack being drafted. An estimate when its army depends on an earlier battle. */
  odds: { target: TerritoryId; odds: Odds; estimate: boolean } | null;
  /**
   * Truce borders (session 14): every border a truce (or a joint war's truce) covers, where you can see it. Info
   * layer only: the painting never carries game state. `pending`: agreed this turn, starts as it plays.
   */
  truces?: { a: TerritoryId; b: TerritoryId; bond: "handshake" | "binding"; pending: boolean }[];
  /**
   * Passage land (session 15): territories armies may pass through under right of passage, where you can see them.
   * `open`: you may pass through it yourself. Info layer only.
   */
  passage?: { territory: TerritoryId; open: boolean; pending: boolean }[];
}

export interface MapEvents {
  /** A tap or click on a territory, or on the sea / empty map (null). */
  tap(territory: TerritoryId | null): void;
  /** Mouse hover, or tap-and-hold on a phone: show the card for this territory at this screen point; null hides it. */
  inspect(territory: TerritoryId | null, at: { x: number; y: number }, how: "hover" | "hold"): void;
  zoomChanged?(level: ZoomLevel): void;
  /** The part of the map on screen moved (map units), for the minimap. */
  viewMoved?(rect: { x: number; y: number; width: number; height: number }): void;
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
  /** Glide to a map point (the minimap's tap), keeping the zoom. */
  centreOn(x: number, y: number): void;
  /** The camera now and the screen it's for, plus a count of the player's own pans and zooms (the replay camera). */
  viewState(): { cam: Camera; vp: Viewport; userMoves: number };
  /** Glide to a camera over `ms` (the replay camera). */
  glideTo(cam: Camera, ms: number): void;
  /** One moment of the animated replay to draw over the map, or null when there's no replay. */
  setReplay(frame: ReplayFrame | null): void;
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
