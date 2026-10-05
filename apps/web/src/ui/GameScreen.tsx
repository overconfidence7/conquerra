import type { GameContext, Order, PlayerView } from "@conquerra/engine";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { incomeEstimate } from "../logic/actions";
import { planQueue, queueFor } from "../logic/orders";
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
import { MapView, readTactical, saveTactical } from "./MapView";
import { Minimap, type ViewRect } from "./Minimap";
import { OrderQueue } from "./OrderQueue";
import { Panel } from "./Panel";
import { PlayersPanel } from "./PlayersPanel";
import { TerritoryCard } from "./TerritoryCard";
import { Toasts, type ShownToast } from "./Toasts";
import { TopBar } from "./TopBar";
import { ReportBody, TurnReportDialog } from "./TurnReport";
import { useReplay } from "./useReplay";
import { moreCue } from "./moreCue";
import { useLayout, useLayoutChoice } from "./useLayout";
import { BUILD, VersionLine } from "./Diagnostics";
import type { LayoutChoice } from "../logic/layout";

/** One shared empty list: a new [] on every render made the map rebuild its whole info layer many times a second during the replay (and freeze on big realms). */
const NO_ORDERS: readonly Order[] = [];


/** Screen space the menus cover, so "fit map" uses the rest. */
const DESKTOP_INSETS: Insets = { top: 72, right: 336, bottom: 216, left: 8 };
const PHONE_INSETS: Insets = { top: 56, right: 0, bottom: 84, left: 0 };

/** Shown once when you're knocked out while the game goes on. */
function KnockedOutChoice({ view }: { view: PlayerView }) {
  const { watch, seeResult, busy } = useGame();
  const me = view.players.find((p) => p.id === view.me.id)!;
  const by = me.eliminatedBy ? view.players.find((p) => p.id === me.eliminatedBy)?.name : null;
  return (
    <div className="overlay">
      <Frame className="dialog" role="dialog" label="You have been knocked out" title="You've been knocked out">
        <p>
          {by ? `${by} took your last territory` : "You lost your last territory"} on turn {me.eliminatedTurn}. The others fight on.
        </p>
        <div className="choice">
          <button className="primary wide" onClick={watch} disabled={busy} autoFocus>
            Watch to the end
          </button>
          <p className="muted small">See the whole map and each turn's replay. You can skip ahead any time.</p>
          <button className="wide" onClick={seeResult} disabled={busy}>
            {busy ? "The bots are finishing the game…" : "See the result"}
          </button>
        </div>
      </Frame>
    </div>
  );
}

/** While watching after being knocked out: next turn, skip ahead, and the last turn's report. */
function WatchPanel({ ctx, view, replaying }: { ctx: GameContext; view: PlayerView; replaying: boolean }) {
  const { report, watchNext, seeResult, busy } = useGame();
  return (
    <Frame className="watch-panel" title={`Watching · turn ${view.turn}`}>
      <p className="muted small">You're out, so you see the whole map. The bots play on.</p>
      <button className="primary wide" onClick={watchNext} disabled={busy || replaying}>
        {busy ? "Playing…" : "Next turn ▶"}
      </button>
      <button className="wide" onClick={seeResult} disabled={busy}>
        Skip to the end ⏭
      </button>
      {report && !replaying && (
        <div className="watch-report">
          <ReportBody ctx={ctx} view={view} report={report} />
        </div>
      )}
    </Frame>
  );
}

/**
 * Settings → "Save this game": downloads a small file (the setup, the seed and every turn's orders) that
 * `pnpm sim --replay <file>` plays back exactly. For bug reports: attach a strange game and we can see what happened.
 */
async function saveThisGame() {
  const { host, view } = useGame.getState();
  if (!host || !view) return;
  const save = await host.save({ app: BUILD });
  const url = URL.createObjectURL(new Blob([JSON.stringify(save)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `conquerra-${save.setup.gameId}-turn${view.turn}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function Settings({ tactical, onTactical, onFit, onReport, onLeave, onClose }: { tactical: boolean; onTactical(): void; onFit(): void; onReport: (() => void) | null; onLeave(): void; onClose(): void }) {
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
      <button className="menu-item" onClick={() => void saveThisGame()}>
        Save this game <span className="muted">for bug reports</span>
      </button>
      <LayoutSetting />
      <hr className="rule" />
      <button className="menu-item" onClick={onLeave}>
        Leave this game
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
  const [spendOpen, setSpendOpen] = useState(false);
  const [sheet, setSheet] = useState<SheetSize>("closed");
  const [tab, setTab] = useState("army");
  const [playersOn, setPlayersOn] = useState(false);
  const [minimapOn, setMinimapOn] = useState(false);
  const [rect, setRect] = useState<ViewRect | null>(null);
  const [toasts, setToasts] = useState<ShownToast[]>([]);

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
  const shownQueue = useMemo(() => queueFor(queue, draft), [queue, draft]);
  const plan = useMemo(() => (ctx && view ? planQueue(ctx, view, shownQueue) : null), [ctx, view, shownQueue]);
  const income = useMemo(() => (ctx && view ? incomeEstimate(ctx, view) : 0), [ctx, view]);

  // On a phone, choosing a territory or drafting an attack opens the army sheet.
  useEffect(() => {
    if (!phone) return;
    if (draft) {
      setTab("army");
      setSheet((s) => (s === "closed" ? "half" : s));
    }
  }, [draft, phone]);
  useEffect(() => setSpendOpen(false), [selected]);

  if (!ctx || !view || !plan) return null;
  const out = knockedOut(view);
  const replaying = !!replay;
  const shownView = rp.view ?? view;
  // On a phone the open sheet covers the lower part of the map: the map keeps what you're looking at above it.
  const sheetPx = !phone || replaying || out || sheet === "closed" ? 0 : Math.round(window.innerHeight * (sheet === "half" ? 0.46 : 0.86));
  const insets = phone ? { ...PHONE_INSETS, bottom: PHONE_INSETS.bottom + sheetPx } : DESKTOP_INSETS;
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
        showTargets={act && (plan.free.get(selected ?? "") ?? 0) > 0}
        onTap={(t) => {
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
      onSettings={() => setSettings((s) => !s)}
    />
  );
  const minimap = <Minimap ctx={ctx} view={shownView} rect={rect} onJump={(x, y) => renderer.current?.centreOn(x, y)} />;
  const overlays = (
    <>
      {showReport && report && !replaying && (
        <TurnReportDialog ctx={ctx} view={view} report={report} autoLocked={autoLocked} onClose={() => g.setShowReport(false)} onWatchAgain={() => g.watchAgain()} />
      )}
      {out && !watching && !replaying && <KnockedOutChoice view={view} />}
      {error && (
        <Frame className="slim" style={{ position: "absolute", zIndex: 40, left: 8, top: phone ? 60 : 72 }}>
          <p className="warn">{error}</p>
        </Frame>
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
      <div className="game phone">
        {map}
        {topbar}
        <div className="map-tools" style={{ top: 62, left: 8 }}>
          <button className={`icon-btn ${minimapOn ? "on" : ""}`} onClick={() => setMinimapOn((m) => !m)} aria-label="Minimap" aria-pressed={minimapOn}>
            <Icon.map />
          </button>
          <button className={`icon-btn ${playersOn ? "on" : ""}`} onClick={() => setPlayersOn((p) => !p)} aria-label="Players" aria-pressed={playersOn}>
            <Icon.people />
          </button>
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
        {out && watching && <WatchPanel ctx={ctx} view={view} replaying={replaying} />}
        {!out && (
          <BottomSheet size={replaying ? "closed" : sheet} onSize={setSheet} bottom={76} tabs={tabs} tab={tab} onTab={setTab}>
            {tab === "army" && army}
            {tab === "orders" && <OrderQueue ctx={ctx} view={view} plan={plan} queue={shownQueue} bare />}
            {tab === "card" && (selected ? <TerritoryCard ctx={ctx} view={view} id={selected} /> : <p className="muted">Tap a territory to see its card. Tap and hold anywhere for a quick look.</p>)}
            {tab === "card" && <LeaderCard ctx={ctx} view={view} queue={queue} />}
            {tab === "report" && report && <ReportBody ctx={ctx} view={view} report={report} />}
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

  return (
    <div className="game desktop">
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
        {selected && act && <TerritoryCard ctx={ctx} view={view} id={selected} />}
        {!out && <LeaderCard ctx={ctx} view={view} queue={queue} />}
      </aside>
      {settingsMenu}
      <Toasts toasts={toasts} />
      {replayBar}
      {out ? (
        watching && <WatchPanel ctx={ctx} view={view} replaying={replaying} />
      ) : (
        <div className="dock">
          <Frame className="slim">{minimap}</Frame>
          <div className="army-cell">
            <Frame className="army slim" boxRef={moreCue}>
              {actions}
              {army}
            </Frame>
          </div>
          <OrderQueue ctx={ctx} view={view} plan={plan} queue={shownQueue} />
          <div className="seal-wrap">{seal}</div>
        </div>
      )}
      {overlays}
    </div>
  );
}
