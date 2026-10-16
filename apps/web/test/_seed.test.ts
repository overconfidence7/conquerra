import { maps } from "@conquerra/content/maps";
import { it } from "vitest";
import { LocalGame } from "../src/host/localGame";
it("seeds", () => {
  const map = maps.embervale!;
  for (const base of ["lesson-raise-an-army"]) for (let i = 0; i < 6; i++) {
    const seed = i ? `${base}-${i}` : base;
    const g = new LocalGame(map, { mapId: "embervale", bots: 1, botLevel: "recruit", luck: 0.3, fog: true, mode: "classic", turnSeconds: null, fate: false, diplomacy: false }, seed, () => 0);
    console.log(seed, g.fullState.players.find((p) => p.id === "you")!.capital);
  }
});
