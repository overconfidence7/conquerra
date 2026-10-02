import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { useGame } from "./store";
import { GameOver } from "./ui/GameOver";
import { GameScreen } from "./ui/GameScreen";
import { Lobby } from "./ui/Lobby";
import "@fontsource/manrope/800.css";
import "@fontsource/cinzel/600.css";
import "@fontsource/cinzel/700.css";
import "./styles.css";

function App() {
  const screen = useGame((s) => s.screen);
  if (screen === "game") return <GameScreen />;
  if (screen === "over") return <GameOver />;
  return <Lobby />;
}

// For the perf / screenshot script (scripts/map-check.ts): drive the game from outside.
(window as unknown as { __conquerraStore?: typeof useGame }).__conquerraStore = useGame;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
