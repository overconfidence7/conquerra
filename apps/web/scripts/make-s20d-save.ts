// Session 20d's screenshot saves: Wyrmland games (you and 5 Marshals) played the way Nate delegates: your Leader,
// Aldric, on Run the military with 50% of your income, your Steward, Odo, on Run the realm with 50%; every order is
// your leaders' (your treasury, what the budgets round off, recruits at your capital).
//  - docs/art/screens/s20d-purse.json: turn 8 (the Leaders panel: the purse empty once its orders are paid for);
//  - docs/art/screens/s20d-wall-rush.json: the first turn your Steward raises one territory's culture 3 levels or more
//    in a turn (a wall going up fast), saved as that turn's planning starts;
//  - docs/art/screens/s20d-wall-garrison.json: the first turn you hold walled land facing a rival with 4 troops or more in it.
//   pnpm --filter web exec tsx scripts/make-s20d-save.ts
import { writeFileSync } from "node:fs";
import { maps } from "@conquerra/content/maps";
import type { GameState, Order } from "@conquerra/engine";
import { HUMAN_ID, LocalGame } from "../src/host/localGame";

const want = new Set(["purse", "rush", "garrison"]);
const save = (g: LocalGame, name: string, why: string) => {
  writeFileSync(`../../docs/art/screens/s20d-${name}.json`, JSON.stringify(g.snapshot({ app: "session-20d screenshots" })));
  console.log(`  s20d-${name}.json: ${why}`);
};
for (let seed = 0; seed < 40 && want.size; seed++) {
  let t = Date.UTC(2026, 9, 9, 12, 0, 0);
  const g = new LocalGame(maps.wyrmland!, { mapId: "wyrmland", bots: 5, botLevel: "marshal", luck: 0.3, fog: true, mode: "classic", turnSeconds: null, leaderName: "Aldric", stewardName: "Odo" }, `s20d-shots-${seed}`, () => t);
  let u = g.update();
  console.log(`seed ${seed}`);
  for (let i = 0; i < 60 && !u.view.winner && want.size; i++) {
    const state = (g as unknown as { state: GameState }).state;
    const ctx = g.ctx;
    const turn = state.turn;
    const setup: Order[] =
      turn === 1
        ? [
            { id: "cmd", kind: "instruct", general: HUMAN_ID, instruction: { kind: "military" } },
            { id: "bl", kind: "budget", general: HUMAN_ID, budget: { share: 0.5 } },
            { id: "bs", kind: "budget", general: HUMAN_ID, role: "steward", budget: { share: 0.5 } },
          ]
        : [];
    const leaders = u.generalOrders ?? [];
    if (want.has("purse") && turn === 8) (save(g, "purse", `seed ${seed}, turn ${turn}`), want.delete("purse"));
    const raised = new Map<string, number>();
    for (const o of leaders) if (o.kind === "invest" && o.steward) raised.set(o.territory, (raised.get(o.territory) ?? 0) + 1);
    const big = [...raised].find(([, n]) => n >= 3);
    if (want.has("rush") && big) (save(g, "wall-rush", `seed ${seed}, turn ${turn}: ${big[1]} levels at ${big[0]} (${ctx.map.territories.find((x) => x.id === big[0])?.name})`), want.delete("rush"));
    const walled = ctx.map.territories.filter((x) => {
      const s = state.territories[x.id]!;
      return s.owner === HUMAN_ID && s.walled && s.troops >= 4;
    });
    const facing = walled.some((x) => ctx.map.borders.some((bd) => (bd.a === x.id || bd.b === x.id) && ![HUMAN_ID, null].includes(state.territories[bd.a === x.id ? bd.b : bd.a]!.owner)));
    if (want.has("garrison") && facing) (save(g, "wall-garrison", `seed ${seed}, turn ${turn}: ${walled.map((x) => `${x.name} ${state.territories[x.id]!.troops}`).join(", ")}`), want.delete("garrison"));
    // Your treasury: troops at your capital, as a person would.
    const own: Order[] = state.players.find((p) => p.id === HUMAN_ID)!.gold >= 2 ? [{ id: `t${turn}`, kind: "recruit", territory: u.view.me.capital, count: "all" }] : [];
    t += 1000;
    try {
      u = g.lockIn([...setup, ...own, ...leaders]);
    } catch {
      break;
    }
  }
}
if (want.size) console.log(`not found: ${[...want].join(", ")}`);
