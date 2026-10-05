import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { useGame } from "./store";
import { GameOver } from "./ui/GameOver";
import { GameScreen } from "./ui/GameScreen";
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
import { artUrl } from "./ui/art";

// Nate's gold filigree corner replaces the drawn corners on every gilded frame once it has loaded.
void artUrl("frame-corner").then((u) => {
  if (!u) return;
  document.documentElement.style.setProperty("--frame-corner", `url("${u}")`);
  document.documentElement.classList.add("corner-art");
});

function Screen() {
  const screen = useGame((s) => s.screen);
  if (screen === "game") return <GameScreen />;
  if (screen === "over") return <GameOver />;
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
else
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
