import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { useGame } from "./store";
import { GameOver } from "./ui/GameOver";
import { GameScreen } from "./ui/GameScreen";
import { Lobby } from "./ui/Lobby";
import { Diagnostics } from "./ui/Diagnostics";
import { UpdatePrompt } from "./ui/UpdatePrompt";
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
      <UpdatePrompt />
      <Diagnostics />
    </>
  );
}

// For the perf / screenshot script (scripts/map-check.ts): drive the game from outside.
(window as unknown as { __conquerraStore?: typeof useGame }).__conquerraStore = useGame;

if (new URLSearchParams(location.search).get("lab") === "houses") void import("./lab/houseLab").then((m) => m.runHouseLab(document.getElementById("root")!));
else
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
