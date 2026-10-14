import { lazy, StrictMode, Suspense, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { useGame } from "./store";
import { Lobby } from "./ui/Lobby";
import { Diagnostics } from "./ui/Diagnostics";
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
      <Suspense fallback={null}>
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
 * Check pages for making maps and judging art (docs/07-map-tooling.md). They live on the private preview only,
 * load only when opened, and are never linked from the lobby. For the public launch, build with VITE_LABS=off:
 * this switch is then false when the game is built, and none of their code is in the build at all.
 */
const LABS = import.meta.env.VITE_LABS !== "off";
const lab = LABS ? new URLSearchParams(location.search).get("lab") : null;
const root = document.getElementById("root")!;
if (LABS && lab === "maps") void import("./lab/maps/MapLab").then((m) => m.runMapLab(root));
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
