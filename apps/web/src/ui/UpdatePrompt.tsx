import { useEffect, useState } from "react";
import { Frame } from "./Frame";

/**
 * "Update ready": when a new version of the game has been downloaded, say so and let the player choose when to
 * switch (a reload). Never reloads by itself, so a game in progress is never broken.
 */
export function UpdatePrompt() {
  const [update, setUpdate] = useState<null | ((reload?: boolean) => Promise<void>)>(null);
  useEffect(() => {
    if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;
    let live = true;
    void import("virtual:pwa-register").then(({ registerSW }) => {
      const updateSW = registerSW({
        onNeedRefresh: () => live && setUpdate(() => updateSW),
      });
    });
    return () => {
      live = false;
    };
  }, []);
  if (!update) return null;
  return (
    <Frame className="slim" style={{ position: "fixed", zIndex: 60, left: "50%", bottom: 96, transform: "translateX(-50%)", display: "flex", gap: 10, alignItems: "center" }} role="status">
      <span>Update ready.</span>
      <button className="primary" onClick={() => void update(true)}>
        Update now
      </button>
      <button onClick={() => setUpdate(null)}>Later</button>
    </Frame>
  );
}
