import { makeCaptainBot } from "@conquerra/bots";
import { defaultRules, type MapDef } from "@conquerra/content";
import type { Recipe } from "@conquerra/mapgen";
import { runGame, simReport, type GameSummary } from "@conquerra/simcore";
import { makeLabMap, type LabMade } from "./core";

/** The map lab's background worker: makes maps and runs "Sim this map", so the page never freezes. */
export type LabRequest =
  | { id: number; type: "make"; recipe: Recipe }
  | { id: number; type: "gallery"; recipes: Recipe[] }
  | { id: number; type: "sim"; map: MapDef; players: number; games: number; seed: string };

export type LabResponse =
  | { id: number; type: "made"; made: LabMade }
  | { id: number; type: "galleryItem"; index: number; made: LabMade }
  | { id: number; type: "progress"; done: number; total: number }
  | { id: number; type: "simDone"; report: ReturnType<typeof simReport>; ms: number; crashed: number }
  | { id: number; type: "error"; error: string };

const scope = self as unknown as { onmessage: ((e: MessageEvent<LabRequest>) => void) | null; postMessage(msg: LabResponse): void };

scope.onmessage = (e) => {
  const req = e.data;
  try {
    if (req.type === "make") scope.postMessage({ id: req.id, type: "made", made: makeLabMap(req.recipe, defaultRules) });
    else if (req.type === "gallery") req.recipes.forEach((r, index) => scope.postMessage({ id: req.id, type: "galleryItem", index, made: makeLabMap(r, defaultRules) }));
    else {
      const ctx = { map: req.map, rules: defaultRules };
      const t0 = performance.now();
      const results: GameSummary[] = [];
      let crashed = 0;
      for (let i = 0; i < req.games; i++) {
        try {
          // Captain bots at every seat (the lobby's default), fog on, normal luck, Classic: the same as `pnpm sim`.
          results.push(runGame(ctx, `${req.seed}-${req.players}p-${i}`, req.players, { luck: defaultRules.combat.luck, fog: true, mode: "classic" }, false, makeCaptainBot()));
        } catch {
          crashed++;
        }
        if (i % 2 === 1 || i === req.games - 1) scope.postMessage({ id: req.id, type: "progress", done: i + 1, total: req.games });
      }
      scope.postMessage({ id: req.id, type: "simDone", report: simReport(results, req.players), ms: performance.now() - t0, crashed });
    }
  } catch (err) {
    scope.postMessage({ id: req.id, type: "error", error: err instanceof Error ? err.message : String(err) });
  }
};
