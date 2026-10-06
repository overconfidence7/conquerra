import { recruitSitesIn, type GameContext, type Order, type PlayerView } from "@conquerra/engine";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { missionTargets } from "../logic/cards";
import { passageLines, passageNow, truceLines, waitingOffers } from "../logic/deals";
import { colorOf } from "./colors";
import { incomeEstimate } from "../logic/actions";
import { planQueue, queueFor } from "../logic/orders";
import { asIfYouOrderFrom } from "../logic/generals";
import type { Insets } from "../map/camera";
import type { Beat } from "../replay/timeline";
import { toastFor } from "../replay/toasts";
import type { MapRenderer } from "../render/types";
import { knockedOut, useGame } from "../store";
import { ActionBar, LockSeal } from "./ActionBar";
import { BottomSheet, type SheetSize } from "./BottomSheet";
import { Frame } from "./Frame";
import { Icon } from "./icons";
import { LeaderCard } from "./LeaderCard";
import { CardStack } from "./CardStack";
import { influencePerTurn } from "../logic/fallen";
import { MapView, readTactical, saveTactical } from "./MapView";
import { Minimap, type ViewRect } from "./Minimap";
import { OrderQueue } from "./OrderQueue";
import { Panel } from "./Panel";
import { PlayersPanel } from "./PlayersPanel";
import { TerritoryCard, vistaFor } from "./TerritoryCard";
import { useArtUrl } from "./art";
import { Toasts, type ShownToast } from "./Toasts";
import { TopBar } from "./TopBar";
import { useReplay } from "./useReplay";
import { moreCue } from "./moreCue";
import { useLayout, useLayoutChoice } from "./useLayout";
import { VersionLine } from "./Diagnostics";
import type { LayoutChoice } from "../logic/layout";

/** Save game / Load game: loaded the first time it's opened (it isn't needed to play a turn). */
const SavesDialog = lazy(() => import("./Saves"));
/** Screens few players see every game, loaded the first time they're needed: being knocked out (the choice, the
 * Fallen's panel, watching) and choosing which captured generals to keep. */
const KnockedOutChoice = lazy(() => import("./Out").then((m) => ({ default: m.KnockedOutChoice })));
const OutPanel = lazy(() => import("./Out").then((m) => ({ default: m.OutPanel })));
const KeepGenerals = lazy(() => import("./KeepGenerals"));
/** Your cards (Spoils and missions): loaded the first time you open them. */
const CardsSheet = lazy(() => import("./Cards"));
/** The deal card (session 14): loaded the first time you propose a deal or open an offer. */
const DealSheet = lazy(() => import("./Deals"));
/** The turn report and its wording (session 14): loaded once the first turn has played (it isn't needed before). */
const TurnReportDialog = lazy(() => import("./TurnReport").then((m) => ({ default: m.TurnReportDialog })));
const ReportBody = lazy(() => import("./TurnReport").then((m) => ({ default: m.ReportBody })));

/** One shared empty list: a new [] on every render made the map rebuild its whole info layer many times a second during the replay (and freeze on big realms). */
const NO_ORDERS: readonly Order[] = [];
const NO_GLOW: readonly string[] = [];


/** Screen space the menus cover, so "fit map" uses the rest. */
/** Desktop: the right column (players, your Leader) and the bottom pieces; the folded dock leaves the map more room. */
const DESKTOP_INSETS: Insets = { top: 72, right: 300, bottom: 224, left: 8 };
const DESKTOP_INSETS_FOLDED: Insets = { ...DESKTOP_INSETS, bottom: 128 };
const DOCK_KEY = "conquerra.dock";
const readDockOpen = () => {
  try {
    return localStorage.getItem(DOCK_KEY) !== "folded";
  } catch {
    return true;
  }
};
const PHONE_INSETS: Insets = { top: 56, right: 0, bottom: 84, left: 0 };

function Settings({ tactical, onTactical, onFit, onReport, onSaves, onLeave, onClose }: { tactical: boolean; onTactical(): void; onFit(): void; onReport: (() => void) | null; onSaves(mode: "save" | "load"): void; onLeave(): void; onClose(): void }) {
  return (
    <Frame className="popover" title="Settings" extra={<button className="link" onClick={onClose}>Close</button>}>
      <button className="menu-item" onClick={onTactical} aria-pressed={tactical}>
        Tactical view <span className="muted">{tactical ? "On" : "Off"}</span>
      </button>
      <button className="menu-item" onClick={onFit}>
        Fit the whole map
      </button>
      {onReport && (
        <button className="menu-item" onClick={onReport}>
          Last turn's report
        </button>
      )}
      <button className="menu-item" onClick={() => onSaves("save")}>
        Save game <span className="muted">a slot, or a file</span>
      </button>
      <button className="menu-item" onClick={() => onSaves("load")}>
        Load game
      </button>
      <LayoutSetting />
      <hr className="rule" />
      <button className="menu-item" onClick={onLeave}>
        Leave this game <span className="muted">Continue picks it up</span>
      </button>
      <VersionLine />
    </Frame>
  );
}

/** Settings → Layout: Auto (from the screen), or always Phone / Desktop. Remembered on this device. */
function LayoutSetting() {
  const { choice, set } = useLayoutChoice();
  const options: [LayoutChoice, string][] = [
    ["auto", "Auto"],
    ["phone", "Phone"],
    ["desktop", "Desktop"],
  ];
  return (
    <div className="menu-item" role="radiogroup" aria-label="Layout">
      <span>Layout</span>
      <span className="seg">
        {options.map(([c, label]) => (
          <button key={c} role="radio" aria-checked={choice === c} className={choice === c ? "on" : ""} onClick={() => set(c)}>
            {label}
          </button>
        ))}
      </span>
    </div>
  );
}

let toastId = 0;

export function GameScreen() {
  const g = useGame();
  const { ctx, view, queue, selected, draft, report, showReport, watching, busy, error, replay, clock, autoLocked } = g;
  const phone = useLayout().layout === "phone";
  const renderer = useRef<MapRenderer | null>(null);
  const [tactical, setTactical] = useState(readTactical);
  const [settings, setSettings] = useState(false);
  const [saves, setSaves] = useState<"save" | "load" | null>(null);
  const [cardsOpen, setCardsOpen] = useState(false);
  const [spendOpen, setSpendOpen] = useState(false);
  const [sheet, setSheet] = useState<SheetSize>("closed");
  const [tab, setTab] = useState("army");
  const [playersOn, setPlayersOn] = useState(false);
  const [minimapOn, setMinimapOn] = useState(false);
  const [dockOpen, setDockOpenState] = useState(readDockOpen);
  const setDockOpen = (open: boolean) => {
    setDockOpenState(open);
    try {
      localStorage.setItem(DOCK_KEY, open ? "open" : "folded");
    } catch {
      // Private window: it just won't be remembered.
    }
  };
  const [rect, setRect] = useState<ViewRect | null>(null);
  const [toasts, setToasts] = useState<ShownToast[]>([]);
  /** The turn you closed the "keep two captured generals" choice on (it shows again next turn if still over). */
  const [keptOn, setKeptOn] = useState(0);

  const pushToast = useCallback((t: Omit<ShownToast, "id">) => {
    const id = ++toastId;
    setToasts((list) => [...list.slice(-3), { ...t, id }]);
    setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), 3600);
  }, []);

  const onBeat = useCallback(
    (b: Beat) => {
      if (!ctx || !view) return;
      let n = 0;
      for (const e of b.events) {
        const t = toastFor(ctx, view, e);
        if (t && n++ < 2) pushToast(t);
      }
    },
    [ctx, view, pushToast],
  );
  const onEnd = useCallback(() => {
    useGame.getState().endReplay();
    if (useGame.getState().autoLocked) pushToast({ text: "Time's up: your orders were locked in", tone: "info", house: null });
  }, [pushToast]);
  const rp = useReplay(ctx, replay, renderer, onBeat, onEnd);

  // While a hop is being drafted, show the queue as it will be once it's added (its Just-enough attack raised to All).
  // (A draft out of a general's territory shows that army as yours: its general's orders step aside once you add it.)
  const shownQueue = useMemo(() => queueFor(view && draft ? asIfYouOrderFrom(view, queue, draft.from) : queue, draft), [view, queue, draft]);
  const plan = useMemo(() => (ctx && view ? planQueue(ctx, view, shownQueue) : null), [ctx, view, shownQueue]);
  const income = useMemo(() => (ctx && view ? incomeEstimate(ctx, view) : 0), [ctx, view]);

  // On a phone, choosing a territory, drafting an attack or opening Recruit opens the army sheet.
  const recruitOpen = !!g.recruit;
  useEffect(() => {
    if (!phone) return;
    if (draft || recruitOpen) {
      setTab("army");
      setSheet((s) => (s === "closed" ? "half" : s));
    }
  }, [draft, recruitOpen, phone]);
  // Choosing a place for a general: on a phone the sheet folds away so the whole map can be tapped.
  const picking = g.picking;
  useEffect(() => {
    if (phone && picking) setSheet("closed");
  }, [phone, picking]);
  // Recruit sites glow while the Recruit panel is open; a mission you tapped lights up its target.
  const missionId = g.mission;
  const glow = useMemo(() => {
    if (!ctx || !view) return NO_GLOW;
    if (recruitOpen) return recruitSitesIn(ctx, view);
    const m = missionId ? view.me.missions.find((x) => x.id === missionId) : undefined;
    return m ? missionTargets(ctx, view, m) : NO_GLOW;
  }, [ctx, view, recruitOpen, missionId]);
  useEffect(() => setSpendOpen(false), [selected]);
  // Diplomacy: truce borders on the map (in force, and agreed this turn), and offers to you still waiting.
  const { diplomacy, answers, offers, deal } = g;
  const truces = useMemo(() => truceLines(g.pageDeals()), [view, diplomacy, answers, offers]); // eslint-disable-line react-hooks/exhaustive-deps
  // Right of passage (session 15): the land armies may pass through, and whose land you may march through yourself.
  const passage = useMemo(() => (view ? passageLines(view, g.pageDeals()) : []), [view, diplomacy, answers, offers]); // eslint-disable-line react-hooks/exhaustive-deps
  const open = useMemo(() => (view ? passageNow(view, g.pageDeals()) : []), [view, diplomacy, answers, offers]); // eslint-disable-line react-hooks/exhaustive-deps
  const waiting = useMemo(() => waitingOffers(offers, diplomacy), [offers, diplomacy]);

  if (!ctx || !view || !plan) return null;
  const out = knockedOut(view);
  const replaying = !!replay;
  const shownView = rp.view ?? view;
  // On a phone the open sheet covers the lower part of the map: the map keeps what you're looking at above it.
  const sheetPx = !phone || replaying || out || sheet === "closed" ? 0 : Math.round(window.innerHeight * (sheet === "half" ? 0.46 : 0.86));
  const insets = phone ? { ...PHONE_INSETS, bottom: PHONE_INSETS.bottom + sheetPx } : dockOpen ? DESKTOP_INSETS : DESKTOP_INSETS_FOLDED;
  const toggleTactical = () =>
    setTactical((t) => {
      saveTactical(!t);
      return !t;
    });
  const act = !out && !replaying;

  const map = (
    <div className="map-layer">
      <MapView
        ctx={ctx}
        view={shownView}
        queue={act ? shownQueue : NO_ORDERS}
        selected={act ? selected : null}
        draft={act ? draft : null}
        showTargets={act && !recruitOpen && (plan.free.get(selected ?? "") ?? 0) > 0}
        glow={act ? glow : NO_GLOW}
        truces={truces}
        passage={passage}
        open={open}
        onTap={(t) => {
          // One of the Fallen, aiming a world event: a tap picks its target.
          if (out && g.aiming && !replaying) return g.tap(t);
          if (!act) return;
          g.tap(t);
          if (phone) {
            setTab("army");
            setSheet((s) => (s === "closed" ? "half" : s));
          }
        }}
        onBackground={() => {
          g.clearSelection();
          if (phone) setSheet("closed");
        }}
        tactical={tactical}
        insets={insets}
        rendererRef={renderer}
        onViewMoved={setRect}
      />
    </div>
  );

  const army = <Panel ctx={ctx} view={view} plan={plan} queue={queue} selected={selected} draft={draft} spendOpen={spendOpen} />;
  const seal = <LockSeal count={queue.length} busy={busy} disabled={!act} onLock={() => void g.lockIn()} />;
  const actions = (
    <ActionBar
      ctx={ctx}
      view={view}
      plan={plan}
      spendOpen={spendOpen}
      disabled={!act}
      onSpend={() => {
        setSpendOpen((o) => !o);
        if (phone) {
          setTab("army");
          setSheet((s) => (s === "closed" ? "half" : s));
        }
      }}
      onMove={() => {
        setSpendOpen(false);
        if (phone) {
          setTab("army");
          setSheet((s) => (s === "closed" ? "half" : s));
        }
      }}
    />
  );
  const replayBar = replaying && (
    <Frame className="replay-bar slim">
      <span className="what">Turn {replay!.report.turn}</span>
      <span className="progress">
        <i style={{ width: `${Math.round(rp.progress * 100)}%` }} />
      </span>
      <button onClick={rp.skip}>Skip ▸▸</button>
    </Frame>
  );
  const settingsMenu = settings && (
    <Settings
      tactical={tactical}
      onTactical={toggleTactical}
      onFit={() => renderer.current?.fit()}
      onReport={report && !replaying ? () => (setSettings(false), g.setShowReport(true)) : null}
      onSaves={(mode) => (setSettings(false), setSaves(mode))}
      onLeave={() => g.playAgain()}
      onClose={() => setSettings(false)}
    />
  );
  const topbar = (
    <TopBar
      view={view}
      gold={view.me.gold}
      goldAfter={plan.goldLeft}
      income={income}
      clock={out ? null : clock}
      replaying={replaying}
      phone={phone}
      fallen={out ? { influence: view.me.influence, perTurn: influencePerTurn(ctx, view) } : null}
      onPause={out || view.winner ? null : () => void g.togglePause()}
      onSettings={() => setSettings((s) => !s)}
    />
  );
  const minimap = <Minimap ctx={ctx} view={shownView} rect={rect} onJump={(x, y) => renderer.current?.centreOn(x, y)} />;
  const pickBanner = picking && act && (
    <Frame className="pick-banner slim" role="status">
      <span>Tap the place to {picking.kind === "push" ? "push toward" : "defend toward"}</span>
      <button className="link" onClick={() => g.cancelPick()}>
        Cancel
      </button>
    </Frame>
  );
  const overlays = (
    <>
      {pickBanner}
      {showReport && report && !replaying && (
        <Suspense fallback={null}>
          <TurnReportDialog ctx={ctx} view={view} report={report} autoLocked={autoLocked} onClose={() => g.setShowReport(false)} onWatchAgain={() => g.watchAgain()} />
        </Suspense>
      )}
      {out && !watching && !replaying && (
        <Suspense fallback={null}>
          <KnockedOutChoice view={view} />
        </Suspense>
      )}
      {act && !showReport && view.me.captured.length > ctx.rules.generals.maxCaptured && keptOn !== view.turn && (
        <Suspense fallback={null}>
          <KeepGenerals ctx={ctx} view={view} onDone={() => setKeptOn(view.turn)} />
        </Suspense>
      )}
      {error && !saves && (
        <Frame className="slim" style={{ position: "absolute", zIndex: 40, left: 8, top: phone ? 60 : 72 }}>
          <p className="warn">{error}</p>
        </Frame>
      )}
      {g.notice && (
        <Frame className="slim notice" style={{ position: "absolute", zIndex: 40, left: 8, right: 8, top: phone ? 60 : 72 }} role="status">
          <p className="warn small">{g.notice}</p>
          <button className="link" onClick={() => g.dismissNotice()}>
            OK
          </button>
        </Frame>
      )}
      {saves && (
        <Suspense fallback={null}>
          <SavesDialog mode={saves} inGame onClose={() => setSaves(null)} />
        </Suspense>
      )}
      {cardsOpen && act && (
        <Suspense fallback={null}>
          <CardsSheet ctx={ctx} view={view} onClose={() => setCardsOpen(false)} onShowMission={(id) => (setCardsOpen(false), g.showMission(id))} />
        </Suspense>
      )}
      {deal && act && (
        <Suspense fallback={null}>
          <DealSheet ctx={ctx} view={view} />
        </Suspense>
      )}
      {/* Offers to you: a small toast as planning starts; tap it to open (Accept is one tap). */}
      {act && !deal && !showReport && waiting.length > 0 && (
        <div className="offer-toasts" style={{ top: phone ? 104 : 80 }}>
          {waiting.map((o) => (
            <button key={`${o.from}-${o.id}`} className="offer-toast" onClick={() => g.openOffer(o)}>
              <i className="house-dot" style={{ background: colorOf(view, o.from) }} aria-hidden />
              {view.players.find((p) => p.id === o.from)?.name ?? o.from} offers {o.terms.kind === "war" ? "a joint war" : o.terms.kind === "passage" ? "right of passage" : `a ${o.terms.kind}`}
              {o.counterTo ? " (a counteroffer)" : ""} ›
            </button>
          ))}
        </div>
      )}
    </>
  );

  if (phone) {
    const tabs = [
      { id: "army", label: "Army" },
      { id: "orders", label: `Orders (${queue.length})` },
      { id: "card", label: "Card" },
      ...(report ? [{ id: "report", label: "Report" }] : []),
    ];
    return (
      <div className={`game phone ${clock?.pausedLeft !== undefined ? "timer-paused" : ""}`}>
        {map}
        {topbar}
        <div className="map-tools" style={{ top: 62, left: 8 }}>
          <button className={`icon-btn ${minimapOn ? "on" : ""}`} onClick={() => setMinimapOn((m) => !m)} aria-label="Minimap" aria-pressed={minimapOn}>
            <Icon.map />
          </button>
          <button className={`icon-btn ${playersOn ? "on" : ""}`} onClick={() => setPlayersOn((p) => !p)} aria-label="Players" aria-pressed={playersOn}>
            <Icon.people />
          </button>
          {act && <CardStack ctx={ctx} view={view} onOpen={() => setCardsOpen(true)} compact />}
        </div>
        {minimapOn && <Frame className="mini-float slim">{minimap}</Frame>}
        {playersOn && (
          <div className="popover">
            <PlayersPanel view={view} />
          </div>
        )}
        {settingsMenu}
        <Toasts toasts={toasts} />
        {replayBar}
        {out && watching && (
          <Suspense fallback={null}>
            <OutPanel ctx={ctx} view={view} replaying={replaying} />
          </Suspense>
        )}
        {!out && (
          <BottomSheet size={replaying ? "closed" : sheet} onSize={setSheet} bottom={76} tabs={tabs} tab={tab} onTab={setTab}>
            {tab === "army" && army}
            {tab === "orders" && <OrderQueue ctx={ctx} view={view} plan={plan} queue={shownQueue} bare />}
            {tab === "card" && (selected ? <TerritoryCard ctx={ctx} view={view} id={selected} /> : <p className="muted">Tap a territory to see its card. Tap and hold anywhere for a quick look.</p>)}
            {tab === "card" && <LeaderCard ctx={ctx} view={view} queue={queue} onCards={() => setCardsOpen(true)} />}
            {tab === "report" && report && (
              <Suspense fallback={null}>
                <ReportBody ctx={ctx} view={view} report={report} />
              </Suspense>
            )}
            {tab === "report" && report && <button onClick={() => g.watchAgain()}>Watch again</button>}
          </BottomSheet>
        )}
        {!out && (
          <Frame className="phonebar slim">
            {actions}
            <button className="icon-btn orders-btn" aria-label="Orders" onClick={() => (setTab("orders"), setSheet((s) => (s === "closed" || tab !== "orders" ? "half" : "closed")))}>
              {queue.length}
            </button>
            {seal}
          </Frame>
        )}
        {overlays}
      </div>
    );
  }

  // The vista for the selected territory: a slim strip at the top of its panel.
  const vista = selected && act && !draft && !recruitOpen ? <SelectedVista ctx={ctx} id={selected} /> : null;
  return (
    <div className={`game desktop ${dockOpen ? "dock-open" : "dock-folded"} ${clock?.pausedLeft !== undefined ? "timer-paused" : ""}`}>
      {map}
      {topbar}
      <div className="map-tools" style={{ top: DESKTOP_INSETS.top + 4, right: DESKTOP_INSETS.right + 4 }}>
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
      <aside className="rightcol" ref={moreCue}>
        <PlayersPanel view={view} />
        {!out && <LeaderCard ctx={ctx} view={view} queue={queue} onCards={() => setCardsOpen(true)} />}
      </aside>
      {settingsMenu}
      <Toasts toasts={toasts} />
      {replayBar}
      {out ? (
        watching && (
          <Suspense fallback={null}>
            <OutPanel ctx={ctx} view={view} replaying={replaying} />
          </Suspense>
        )
      ) : (
        <>
          {/* One panel for the selected territory: the round action buttons, then who holds it, troops, chips,
              buildings and culture, then what you can do there. It's only as tall as what's in it. */}
          <div className="selcell">
            <Frame className="sel slim" boxRef={moreCue}>
              {actions}
              {vista}
              {army}
            </Frame>
          </div>
          <div className={`dock ${dockOpen ? "open" : "folded"}`}>
            {dockOpen ? (
              <>
                <Frame className="slim mini">{minimap}</Frame>
                <OrderQueue ctx={ctx} view={view} plan={plan} queue={shownQueue} onFold={() => setDockOpen(false)} />
              </>
            ) : (
              <button className="dock-bar" onClick={() => setDockOpen(true)} aria-label="Show the order queue and minimap" aria-expanded={false}>
                <span className="dock-caret" aria-hidden>
                  ▴
                </span>
                Orders ({queue.length})<span className="cost">{plan.goldLeft}g left</span>
              </button>
            )}
            <div className="seal-wrap">{seal}</div>
          </div>
        </>
      )}
      {overlays}
    </div>
  );
}

function SelectedVista({ ctx, id }: { ctx: GameContext; id: string }) {
  const url = useArtUrl(vistaFor(ctx, id));
  return url ? <div className="sel-vista" style={{ backgroundImage: `url(${url})` }} aria-hidden /> : null;
}
