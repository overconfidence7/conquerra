import { pursesTotal, recruitSitesIn, type GameContext, type Order, type PlayerView } from "@conquerra/engine";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { missionTargets } from "../logic/cards";
import { passageLines, passageNow, truceLines, waitingOffers } from "../logic/deals";
import { colorOf } from "./colors";
import { incomeEstimate } from "../logic/actions";
import { planQueue, queueFor } from "../logic/orders";
import { arrangeQueue, asIfYouOrderFrom, overCap, standing } from "../logic/generals";
import { commandArea } from "../logic/leaderArea";
import { planPath } from "../logic/paths";
import { clearInsets, landFrame, type Insets, type Rect } from "../map/camera";
import type { Beat } from "../replay/timeline";
import { toastFor } from "../replay/toasts";
import type { MapRenderer } from "../render/types";
import { knockedOut, useGame } from "../store";
import { ActionBar, LockSeal } from "./ActionBar";
import { BottomSheet, type SheetSize } from "./BottomSheet";
import { Frame } from "./Frame";
import { Icon } from "./icons";
import { LeaderPortrait, LeadersPanel, PlacementSwitch } from "./LeadersPanel";
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
import { FX_LEVELS, useFx } from "../replay/fx/settings";
import { useSound } from "../sound/settings";
import { mixer } from "../sound/mixer";
import { music } from "../sound/music";
import { ambience, closenessOf, waterInView } from "../sound/ambience";
import { typicalTerritorySize } from "../map/zoom";
import { houseOf } from "../map/houses";
import { namer, startBonusLine } from "../logic/text";
import "./replay.css";

/** Save game / Load game: loaded the first time it's opened (it isn't needed to play a turn). */
const SavesDialog = lazy(() => import("./Saves"));
/** Screens few players see every game, loaded the first time they're needed: being knocked out (the choice, the
 * Fallen's panel, watching) and choosing which captured generals to keep. */
const KnockedOutChoice = lazy(() => import("./Out").then((m) => ({ default: m.KnockedOutChoice })));
const OutPanel = lazy(() => import("./Out").then((m) => ({ default: m.OutPanel })));
const KeepGenerals = lazy(() => import("./KeepGenerals"));
/** Your cards (Spoils and missions): loaded the first time you open them. */
const CardsSheet = lazy(() => import("./Cards"));
/** Settings → Credits (session 24): loaded the first time it's opened. */
const SoundCredits = lazy(() => import("./SoundCredits"));
/** The Chronicle (session 16): loaded the first time it's opened. */
const ChronicleSheet = lazy(() => import("./Chronicle"));
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

/** The menus that sit over the map, by layout (measured on screen, session 16). */
const COVERS_DESKTOP = ".game .topbar, .game > .map-tools, .game .rightcol, .game .dock";
// (On a phone the two small map buttons float over the sea at the top left; counting them would shrink the whole map.)
const COVERS_PHONE = ".game .topbar, .game .phonebar";

/**
 * Where the menus sit over the map, measured on screen whenever they change size (session 16), so "fit map" and
 * panning keep the whole map clear of them. On a desktop the selected territory's panel (bottom left) is kept clear
 * at its full height whether or not it's showing much, so the map doesn't jump as you tap from place to place. On a
 * phone the open sheet counts too.
 */
function useCovered(active: boolean, phone: boolean, reserveSelPanel: boolean, sheetPx: number, key: string): Rect[] | null {
  const [covered, setCovered] = useState<Rect[] | null>(null);
  useEffect(() => {
    if (!active) return;
    const measure = () => {
      const els = [...document.querySelectorAll<HTMLElement>(phone ? COVERS_PHONE : COVERS_DESKTOP)];
      const rects: Rect[] = els.map((el) => el.getBoundingClientRect()).map((r) => ({ x: r.left, y: r.top, width: r.width, height: r.height }));
      const h = window.innerHeight, w = window.innerWidth;
      const top = Math.max(0, ...rects.filter((r) => r.y < 20 && r.width > w / 2).map((r) => r.y + r.height));
      const sel = document.querySelector<HTMLElement>(".game .selcell");
      if (!phone && reserveSelPanel && sel) {
        const r = sel.getBoundingClientRect();
        rects.push({ x: r.left, y: top, width: r.width, height: h - top - 8 });
      }
      if (phone && sheetPx > 0) rects.push({ x: 0, y: h - PHONE_INSETS.bottom - sheetPx, width: w, height: sheetPx + PHONE_INSETS.bottom });
      setCovered((old) => (old && JSON.stringify(old) === JSON.stringify(rects) ? old : rects));
    };
    measure();
    const ro = new ResizeObserver(measure);
    for (const el of document.querySelectorAll<HTMLElement>(phone ? COVERS_PHONE : COVERS_DESKTOP)) ro.observe(el);
    window.addEventListener("resize", measure);
    return () => (ro.disconnect(), window.removeEventListener("resize", measure));
  }, [active, phone, reserveSelPanel, sheetPx, key]);
  return covered;
}

function Settings({ tactical, onTactical, onFit, onReport, onSaves, onLeave, onClose }: { tactical: boolean; onTactical(): void; onFit(): void; onReport: (() => void) | null; onSaves(mode: "save" | "load"): void; onLeave(): void; onClose(): void }) {
  const [credits, setCredits] = useState(false);
  if (credits)
    return (
      <Suspense fallback={null}>
        <SoundCredits onClose={() => setCredits(false)} />
      </Suspense>
    );
  return (
    <Frame className="popover" title="Settings" extra={<button className="link" onClick={onClose}>Close</button>}>
      <PlacementSwitch />
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
      <EffectsSetting />
      <SoundSetting />
      <button className="menu-item" onClick={() => setCredits(true)}>
        Credits <span className="muted">sound and music</span>
      </button>
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

/**
 * Settings → Effects (session 21): Full, Light (half the particles, no camera shake or flashes) or Off (the replay's
 * information only: who moved, who fought, who holds what). Remembered on this device.
 */
function EffectsSetting() {
  const { level, setLevel } = useFx();
  return (
    <div className="menu-item" role="radiogroup" aria-label="Effects">
      <span>Effects</span>
      <span className="seg">
        {FX_LEVELS.map(([c, label]) => (
          <button key={c} role="radio" aria-checked={level === c} className={level === c ? "on" : ""} onClick={() => setLevel(c)}>
            {label}
          </button>
        ))}
      </span>
    </div>
  );
}

/**
 * Settings → Sound (session 24): Master, Music and Sound effects volumes, and Mute, remembered on this device.
 * Separate from Effects: Effects Off doesn't silence sound, and Mute doesn't change what you see.
 */
function SoundSetting() {
  const s = useSound();
  const slider = (label: string, key: "master" | "music" | "effects") => (
    <label className="menu-item sound-row">
      <span>{label}</span>
      <input type="range" min={0} max={100} step={5} value={Math.round(s[key] * 100)} disabled={s.muted} aria-label={`${label} volume`} onChange={(e) => s.set({ [key]: Number(e.target.value) / 100 })} />
    </label>
  );
  return (
    <div className="sound-settings" role="group" aria-label="Sound">
      <button className="menu-item" onClick={() => s.set({ muted: !s.muted })} aria-pressed={!s.muted}>
        Sound <span className="muted">{s.muted ? "Muted" : "On"}</span>
      </button>
      {slider("Master", "master")}
      {slider("Music", "music")}
      {slider("Sound effects", "effects")}
    </div>
  );
}

/** Orders that spend gold as they're added (the coins' sound). */
const COSTS_GOLD = new Set<string>(["recruit", "hire", "hireSpy", "build", "invest"]);

let toastId = 0;

const NO_AREA: readonly string[] = [];
/** What the pick banner says while you choose on the map for a leader's command (a front counts its provinces). */
const PICK_WORDS: Record<string, (n: number) => string> = {
  push: () => "Tap the place to push toward",
  defend: () => "Tap the place to defend toward",
  expand: () => "Tap the territory to expand toward",
  front: (n) => (n ? `${n} province${n === 1 ? "" : "s"} marked: tap more, or Confirm` : "Tap the provinces of the front"),
  buildUp: () => "Tap the province to build up",
  culture: () => "Tap the province to raise culture in",
};

export function GameScreen() {
  const g = useGame();
  const { ctx, view, queue, selected, draft, report, showReport, watching, busy, error, replay, clock, autoLocked } = g;
  const phone = useLayout().layout === "phone";
  const renderer = useRef<MapRenderer | null>(null);
  const [tactical, setTactical] = useState(readTactical);
  const [settings, setSettings] = useState(false);
  // The replay moved itself to Light (it was running slowly): say so, once.
  const movedToLight = useFx((s) => s.movedToLight);
  const fxLevel = useFx((s) => s.level);
  const sweepEmblem = useArtUrl("emblem");
  const [sweepTurn, setSweepTurn] = useState<number | null>(null);
  const sweptTurn = useRef<number | null>(null);
  useEffect(() => {
    // Once per new turn, after its replay (not on the game's first turn or a loaded game's).
    if (!view || replay || sweptTurn.current === view.turn) return;
    const first = sweptTurn.current === null;
    sweptTurn.current = view.turn;
    if (first) return;
    setSweepTurn(view.turn);
    mixer.play("turn-sweep");
    const t = setTimeout(() => setSweepTurn(null), 1500);
    return () => clearTimeout(t);
  }, [view, replay]);
  // The music (session 24): the planning loop while you plan, the replay loop while it plays (crossfading, carrying on
  // where each was: it never starts over each turn).
  const replayOn = !!replay;
  useEffect(() => music.play(replayOn ? "replay" : "planning"), [replayOn]);
  // The ambience bed under the map while you plan (Part 4): wind, the sea where the camera shows coast, birds now and
  // then, a little louder closer in. It fades out for the replay.
  useEffect(() => {
    if (replayOn || !ctx) return void ambience.set(null);
    const size = typicalTerritorySize(ctx.map);
    const look = () => {
      const v = renderer.current?.viewState();
      if (v) ambience.set({ closeness: closenessOf(v.cam, size), water: waterInView(ctx.map, v.cam, v.vp) });
    };
    look();
    const id = setInterval(look, 500);
    return () => (clearInterval(id), ambience.set(null));
  }, [replayOn, ctx]);
  // A notice, softly (at most one every 1.5 s).
  useEffect(() => {
    if (g.notice) mixer.play("notice");
  }, [g.notice]);
  // The sound effects load with the game screen (session 24), once it's up (never with the lobby).
  useEffect(() => {
    const idle = (window as { requestIdleCallback?: (f: () => void) => number }).requestIdleCallback ?? ((f: () => void) => setTimeout(f, 300));
    idle(() => void mixer.load(mixer.allEffects()));
  }, []);
  useEffect(() => {
    if (movedToLight) useGame.setState({ notice: "Heads up, the replay was running slowly, so Effects are on Light now. You can change it in Settings." });
  }, [movedToLight]);
  const [saves, setSaves] = useState<"save" | "load" | null>(null);
  const [cardsOpen, setCardsOpen] = useState(false);
  const [chronicleOpen, setChronicleOpen] = useState(false);
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
  // The map's shape (its land, with a little sea), for fitting it into the clear part of the screen.
  const aspect = useMemo(() => {
    const f = ctx?.map.geometry ? landFrame(ctx.map.geometry) : null;
    return f ? f.width / f.height : 1.4;
  }, [ctx]);
  const [toasts, setToasts] = useState<ShownToast[]>([]);
  /** The turn you closed the "keep two captured generals" choice on (it shows again next turn if still over). */
  const [keptOn, setKeptOn] = useState(0);

  const pushToast = useCallback((t: Omit<ShownToast, "id">) => {
    const id = ++toastId;
    setToasts((list) => [...list.slice(-3), { ...t, id }]);
    // A banner (Fate or the Fallen on your land) stays longer.
    setTimeout(() => setToasts((list) => list.filter((x) => x.id !== id)), t.banner ? 6500 : 3600);
  }, []);

  // The start bonus (session 23): a harder spot's head start, said as the first turn's planning starts (once a game).
  const bonusSaid = useRef<string | null>(null);
  useEffect(() => {
    if (!ctx || !view || view.turn !== 1 || bonusSaid.current === view.gameId) return;
    bonusSaid.current = view.gameId;
    const line = startBonusLine(view, namer(ctx, view).place);
    if (line) pushToast({ text: line, tone: "info", house: view.me.id, banner: true });
  }, [ctx, view, pushToast]);

  const onBeat = useCallback(
    (b: Beat, carded: ReadonlySet<unknown>) => {
      if (!ctx || !view) return;
      let n = 0;
      for (const e of b.events) {
        // A title card already says it (session 22): one headline per event.
        const t = carded.has(e) ? null : toastFor(ctx, view, e);
        // Banners always show; at most two other toasts a beat.
        if (t && (t.banner || n++ < 2)) pushToast(t);
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
  // Orders along a path (session 16): while the path box is open, its orders show on the map as a numbered chain.
  const pathBox = g.path;
  const pathPlan = useMemo(() => (ctx && view && pathBox ? planPath(ctx, view, queue, g.pageDeals(), passageNow(view, g.pageDeals()), pathBox) : null), [ctx, view, queue, pathBox]); // eslint-disable-line react-hooks/exhaustive-deps
  // Your queue in the order it plays: your leaders' orders mixed in with yours, or after yours (the setting).
  const placement = g.leaderPlacement;
  const arranged = useMemo(() => arrangeQueue(queue, placement), [queue, placement]);
  const shownQueue = useMemo(() => queueFor(view && draft ? asIfYouOrderFrom(view, arranged, draft.from) : arranged, draft), [view, arranged, draft]);
  /** What the map draws: your orders, plus the path being planned (not in your order list until you confirm). */
  const mapQueue = useMemo(() => (pathPlan ? [...shownQueue, ...pathPlan.orders.map((o, i) => ({ ...o, id: `path-preview-${i}` }) as Order)] : shownQueue), [shownQueue, pathPlan]);
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
  // Choosing a place for a general, or a province for a spy: on a phone the sheet folds away so the whole map can be tapped.
  const picking = g.picking;
  const spyPicking = !!g.spyPick || !!g.pathPick;
  useEffect(() => {
    if (phone && (picking || spyPicking)) setSheet("closed");
  }, [phone, picking, spyPicking]);
  // Enter confirms an open attack, move or path box as shown; Esc cancels it (session 20, Nate).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (useGame.getState().pressKey(e as unknown as Parameters<ReturnType<typeof useGame.getState>["pressKey"]>[0])) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // The path box opens the sheet again on a phone.
  useEffect(() => {
    if (phone && pathBox) (setTab("army"), setSheet((s) => (s === "closed" ? "half" : s)));
  }, [phone, pathBox]);
  // Recruit sites glow while the Recruit panel is open; a mission you tapped lights up its target.
  const missionId = g.mission;
  // The leader open in the Leaders panel (or the one you're picking for): its command's target glows and the
  // provinces it works in are outlined (session 18).
  const leaderKeyShown = g.picking?.general ?? g.leaderOpen;
  const area = useMemo(() => {
    if (!ctx || !view || !leaderKeyShown) return null;
    const command = leaderKeyShown in g.instructions ? g.instructions[leaderKeyShown]! : standing(view, leaderKeyShown);
    return commandArea(ctx, view, leaderKeyShown, command, g.picking);
  }, [ctx, view, leaderKeyShown, g.instructions, g.picking]);
  const glow = useMemo(() => {
    if (!ctx || !view) return NO_GLOW;
    if (recruitOpen) return recruitSitesIn(ctx, view);
    const m = missionId ? view.me.missions.find((x) => x.id === missionId) : undefined;
    if (m) return missionTargets(ctx, view, m);
    return area?.glow.length ? area.glow : NO_GLOW;
  }, [ctx, view, recruitOpen, missionId, area]);
  useEffect(() => setSpendOpen(false), [selected]);
  // Diplomacy: truce borders on the map (in force, and agreed this turn), and offers to you still waiting.
  const { diplomacy, answers, offers, deal } = g;
  const truces = useMemo(() => truceLines(g.pageDeals()), [view, diplomacy, answers, offers]); // eslint-disable-line react-hooks/exhaustive-deps
  // Right of passage (session 15): the land armies may pass through, and whose land you may march through yourself.
  const passage = useMemo(() => (view ? passageLines(view, g.pageDeals()) : []), [view, diplomacy, answers, offers]); // eslint-disable-line react-hooks/exhaustive-deps
  const open = useMemo(() => (view ? passageNow(view, g.pageDeals()) : []), [view, diplomacy, answers, offers]); // eslint-disable-line react-hooks/exhaustive-deps
  const waiting = useMemo(() => waitingOffers(offers, diplomacy), [offers, diplomacy]);
  const out = !!view && knockedOut(view);
  const replaying = !!replay;
  // Coins when an order that costs gold is added; a very soft page when a panel opens (session 24).
  const queued = useRef(queue.length);
  useEffect(() => {
    const last = queue[queue.length - 1];
    if (queue.length > queued.current && last && COSTS_GOLD.has(last.kind)) mixer.play("coins-spend", queue.length);
    queued.current = queue.length;
  }, [queue]);
  const opened = [settings, chronicleOpen, cardsOpen, !!saves, phone && sheet !== "closed"].filter(Boolean).length;
  const wasOpen = useRef(opened);
  useEffect(() => {
    if (opened > wasOpen.current) mixer.play("panel", opened);
    wasOpen.current = opened;
  }, [opened]);
  // On a phone the open sheet covers the lower part of the map: the map keeps what you're looking at above it.
  const sheetPx = !phone || replaying || out || sheet === "closed" ? 0 : Math.round(window.innerHeight * (sheet === "half" ? 0.46 : 0.86));
  // The menus over the map, measured (session 16): the map fits, and pans, within the biggest clear part of the screen.
  const covered = useCovered(!!view, phone, !out, sheetPx, `${dockOpen}|${out}|${playersOn}`);
  const insets = useMemo(
    () => (covered ? clearInsets(window.innerWidth, window.innerHeight, covered, aspect) : phone ? { ...PHONE_INSETS, bottom: PHONE_INSETS.bottom + sheetPx } : dockOpen ? DESKTOP_INSETS : DESKTOP_INSETS_FOLDED),
    [covered, aspect, phone, sheetPx, dockOpen],
  );

  if (!ctx || !view || !plan) return null;
  const shownView = rp.view ?? view;
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
        queue={act ? mapQueue : NO_ORDERS}
        selected={act ? selected : null}
        draft={act ? draft : null}
        showTargets={act && !recruitOpen && (plan.free.get(selected ?? "") ?? 0) > 0}
        glow={act ? glow : NO_GLOW}
        area={act && area ? area.provinces : NO_AREA}
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
      {/* The replay is the story (session 21): letterbox, a soft vignette and a warmer grade ease in and out. */}
      <div className={`cine ${replaying && fxLevel !== "off" ? "on" : ""}`} aria-hidden>
        <i className="cine-bar top" />
        <i className="cine-bar bottom" />
      </div>
    </div>
  );

  const army = <Panel ctx={ctx} view={view} plan={plan} queue={queue} selected={selected} draft={draft} spendOpen={spendOpen} />;
  const seal = <LockSeal count={queue.length} busy={busy} disabled={!act} onLock={() => (mixer.play("seal"), void g.lockIn())} />;
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
  // "Turn 8" sweeps across with the compass emblem as a new turn's planning starts (session 21), briefly.
  const turnSweep = !replaying && sweepTurn === view.turn && (
    <div className="turn-sweep" key={`sweep-${view.turn}`} aria-hidden>
      {sweepEmblem && <img src={sweepEmblem} alt="" />}
      <span>Turn {view.turn}</span>
    </div>
  );
  // A title card for the moment that matters (session 21), across the top of the map.
  const titleCard = replaying && rp.card && (
    <div className="title-card" key={rp.card.at} role="status" style={{ "--card-ms": `${rp.card.ms}ms`, "--house": rp.card.house ? houseOf(view, rp.card.house).color : "#c9a45c" } as React.CSSProperties}>
      <span className="title-card-text">{rp.card.text}</span>
      {rp.card.sub && <span className="title-card-sub">{rp.card.sub}</span>}
    </div>
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
      purses={plan ? [...plan.pursesLeft.values()].reduce((a, x) => a + Math.max(0, x), 0) : pursesTotal(view.me)}
      goldAfter={plan.goldLeft}
      income={income}
      clock={out ? null : clock}
      replaying={replaying}
      phone={phone}
      fallen={out ? { influence: view.me.influence, perTurn: influencePerTurn(ctx, view) } : null}
      onPause={out || view.winner ? null : () => void g.togglePause()}
      onChronicle={() => setChronicleOpen(true)}
      onSettings={() => setSettings((s) => !s)}
    />
  );
  const minimap = <Minimap ctx={ctx} view={shownView} rect={rect} onJump={(x, y) => renderer.current?.centreOn(x, y)} />;
  const pickBanner = (picking || g.spyPick || g.pathPick) && act && (
    <Frame className="pick-banner slim" role="status">
      <span>{g.pathPick ? "Tap where the army should go" : g.spyPick ? "Tap a province to send your spy there" : PICK_WORDS[picking!.kind]!(picking!.provinces?.length ?? 0)}</span>
      {picking?.kind === "front" && (
        <button className="primary" onClick={() => g.confirmPick()} disabled={!picking.provinces?.length}>
          Confirm
        </button>
      )}
      <button className="link" onClick={() => (g.pathPick ? g.cancelPath() : g.spyPick ? g.cancelSpyPick() : g.cancelPick())}>
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
          <KnockedOutChoice ctx={ctx} view={view} />
        </Suspense>
      )}
      {act && !showReport && (overCap(ctx, view).leader > 0 || overCap(ctx, view).steward > 0) && keptOn !== view.turn && (
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
      {chronicleOpen && (
        <Suspense fallback={null}>
          <ChronicleSheet
            ctx={ctx}
            view={view}
            onClose={() => setChronicleOpen(false)}
            onShow={(at) => {
              // Show the place: select it (its province lights up) and bring it to the middle of the map.
              setChronicleOpen(false);
              if (act) g.select(at);
              const t = ctx.map.geometry!.territories.find((x) => x.id === at);
              if (t) renderer.current?.centreOn(t.label.x, t.label.y);
            }}
          />
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
      { id: "leaders", label: "Leaders" },
      ...(report ? [{ id: "report", label: "Report" }] : []),
    ];
    const myLeader = view.me.leaders.find((l) => l.kind === "leader" && l.of === view.me.id);
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
          <button className="icon-btn" onClick={() => setChronicleOpen(true)} aria-label="Chronicle" title="Chronicle: every turn so far">
            <Icon.scroll />
          </button>
          {act && <CardStack ctx={ctx} view={view} onOpen={() => setCardsOpen(true)} compact />}
          {act && myLeader && (
            <button className="icon-btn leader-btn" onClick={() => (setTab("leaders"), g.leaderOpen || g.openLeader(`leader:${view.me.id}`), setSheet((s) => (s === "closed" || tab !== "leaders" ? "half" : "closed")))} aria-label="Leaders" title="Your leaders">
              <LeaderPortrait view={view} l={myLeader} size={34} />
            </button>
          )}
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
        {titleCard}
        {turnSweep}
        {out && watching && (
          <Suspense fallback={null}>
            <OutPanel ctx={ctx} view={view} replaying={replaying} />
          </Suspense>
        )}
        {!out && (
          <BottomSheet size={replaying ? "closed" : sheet} onSize={setSheet} bottom={76} tabs={tabs} tab={tab} onTab={setTab}>
            {tab === "army" && army}
            {tab === "orders" && <OrderQueue ctx={ctx} view={view} plan={plan} queue={shownQueue} bare />}
            {tab === "leaders" && <LeadersPanel ctx={ctx} view={view} queue={queue} pursesLeft={plan?.pursesLeft} onShow={(t) => g.select(t)} onCards={() => setCardsOpen(true)} />}
            {tab === "card" && (selected ? <TerritoryCard ctx={ctx} view={view} id={selected} /> : <p className="muted">Tap a territory to see its card. Tap and hold anywhere for a quick look.</p>)}
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
    <div className={`game desktop ${dockOpen ? "dock-open" : "dock-folded"} ${replaying ? "replaying" : ""} ${clock?.pausedLeft !== undefined ? "timer-paused" : ""}`}>
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
        {!out && <LeadersPanel ctx={ctx} view={view} queue={queue} pursesLeft={plan?.pursesLeft} onShow={(t) => g.select(t)} onCards={() => setCardsOpen(true)} />}
      </aside>
      {settingsMenu}
      <Toasts toasts={toasts} />
      {replayBar}
      {titleCard}
      {turnSweep}
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
