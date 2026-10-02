import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { useGame } from "./store";
import { GameOver } from "./ui/GameOver";
import { GameScreen } from "./ui/GameScreen";
import { Lobby } from "./ui/Lobby";
import "./styles.css";

function App() {
  const screen = useGame((s) => s.screen);
  if (screen === "game") return <GameScreen />;
  if (screen === "over") return <GameOver />;
  return <Lobby />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
