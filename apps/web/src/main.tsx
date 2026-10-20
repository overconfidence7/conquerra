import { lazy, StrictMode, Suspense, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { useGame } from "./store";
import { Lobby } from "./ui/Lobby";
import { useDiagnostics } from "./ui/VersionLine";
import { UpdatePrompt } from "./ui/UpdatePrompt";
import { DesktopSiteTip } from "./ui/DesktopSiteTip";
import "@fontsource/manrope/800.css";
import "@fontsource/cinzel/600.css";
import "@fontsource/cinzel/700.css";
import "@fontsource/spectral/400.css";
import "@fontsource/spectral/600.css";
import "@fontsource/spectral/400-italic.css";
import "./styles.css";
// Phones allow sound only after a tap: the first tap anywhere wakes the audio (session 24).
import "./sound/unlock";
import { artUrl } from "./ui/art";
import { watchLoadFailures } from "./ui/loadFailure";

// A file from an old build that fails to load reloads the page once (session 28), never a blank page.
watchLoadFailures();

// Nate's gold filigree corner replaces the drawn corners on every gilded frame once it has loaded.
void artUrl("frame-corner").then((u) => {
  if (!u) return;
  document.documentElement.style.setProperty("--frame-corner", `url("${u}")`);
  document.documentElement.classList.add("corner-art");
});

/** The end of a game: loaded when it ends (with the turn report it shows). */
const GameOver = lazy(() => import("./ui/GameOver").then((m) => ({ default: m.GameOver })));
/**
 * The game screen (session 15): not in the start-up bundle. It's fetched quietly once the lobby is showing, so Start and
 * Continue don't wait for it.
 */
const loadGameScreen = () => import("./ui/GameScreen");
const GameScreen = lazy(() => loadGameScreen().then((m) => ({ default: m.GameScreen })));
/** The diagnostics view (five taps on the version line): loaded only when opened (session 28). */
const DiagnosticsPanel = lazy(() => import("./ui/Diagnostics").then((m) => ({ default: m.Diagnostics })));
function Diagnostics() {
  const open = useDiagnostics((s) => s.open);
  return open ? (
    <Suspense fallback={null}>
      <DiagnosticsPanel />
    </Suspense>
  ) : null;
}
/** The table screen (session 27): an online game waiting for its players. Loaded only when one opens. */
const TableScreen = lazy(() => import("./ui/TableScreen"));

function Screen() {
  const screen = useGame((s) => s.screen);
  useEffect(() => {
    const idle = (window as { requestIdleCallback?: (f: () => void) => number }).requestIdleCallback ?? ((f: () => void) => setTimeout(f, 300));
    idle(() => void loadGameScreen());
  }, []);
  if (screen === "game")
    return (
      <Suspense fallback={null}>
        <GameScreen />
      </Suspense>
    );
  if (screen === "table")
    return (
      // (Session 33b: a line while the table screen's code loads, not a blank page.)
      <Suspense fallback={<p className="muted loading-line">Opening the table…</p>}>
        <TableScreen />
      </Suspense>
    );
  if (screen === "over")
    return (
      <Suspense fallback={null}>
        <GameOver />
      </Suspense>
    );
  return <Lobby />;
}

function App() {
  return (
    <>
      <Screen />
      <DesktopSiteTip />
      <UpdatePrompt />
      <Diagnostics />
    </>
  );
}

// For the perf / screenshot script (scripts/map-check.ts): drive the game from outside.
(window as unknown as { __conquerraStore?: typeof useGame }).__conquerraStore = useGame;

/**
 * Check pages for making maps and judging art (docs/07-map-tooling.md): the map lab, what a bot knew, the art test
 * bench, the sound bench (`?lab=...`). Session 34: off in the deployed build (this switch is false when the game is
 * built, so none of their code is in it and `?lab=...` opens the lobby); on under `pnpm dev`, and in the build
 * `wrangler dev` serves when it's made with `pnpm build:labs` (`--mode labs`, `apps/web/.env.labs`).
 */
const LABS = import.meta.env.DEV || import.meta.env.VITE_LABS === "on";
const lab = LABS ? new URLSearchParams(location.search).get("lab") : null;
const root = document.getElementById("root")!;
if (LABS && lab === "maps") void import("./lab/maps/MapLab").then((m) => m.runMapLab(root));
else if (LABS && lab === "known") void import("./lab/maps/KnownMap").then((m) => m.runKnownMap(root));
else if (LABS && (lab === "bench" || lab === "houses")) void import("./lab/bench/Bench").then((m) => m.runBench(root));
else if (LABS && lab === "sound") void import("./lab/sound/SoundBench").then((m) => m.runSoundBench(root));
else {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  // Online (session 26): "?game=<id>" opens that online game (the online code loads only then).
  const game = new URLSearchParams(location.search).get("game");
  // Session 27: "?join=<code>", a friend's link to a table.
  const join = new URLSearchParams(location.search).get("join");
  if (game && /^[a-z0-9]{6,24}$/.test(game)) void import("./host/onlineActions").then((m) => m.openOnline(game));
  else if (join && /^[a-z0-9]{6,24}$/.test(join)) void import("./host/onlineActions").then((m) => m.joinTable(join));
}
