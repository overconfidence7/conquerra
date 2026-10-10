// Session 22's screenshot saves: Wyrmland games (you and 5 Marshals) with your Leader, Aldric, on Run the military
// (50% of your income) and your Steward, Odo, on Run the realm (50%).
//  - docs/art/screens/s22-broken.json: saved as planning starts on a turn in which a bot breaks a deal with a line of
//    its own ("Our deal was lovely while it lasted..."), so the report after it shows the broken deal.
//   pnpm --filter web exec tsx scripts/make-s22-save.ts
import { writeFileSync } from "node:fs";
import { maps } from "@conquerra/content/maps";
import type { GameState, Order } from "@conquerra/engine";
import { HUMAN_ID, LocalGame } from "../src/host/localGame";

const want = new Set(["broken"]);
for (let seed = 0; seed < 20 && want.size; seed++) {
  let t = Date.UTC(2026, 9, 10, 12, 0, 0);
  const g = new LocalGame(maps.wyrmland!, { mapId: "wyrmland", bots: 5, botLevel: "marshal", luck: 0.3, fog: true, mode: "classic", turnSeconds: null, leaderName: "Aldric", stewardName: "Odo" }, `s22-shots-${seed}`, () => t);
  let u = g.update();
  console.log(`seed ${seed}`);
  for (let i = 0; i < 60 && !u.view.winner && want.size; i++) {
    const state = (g as unknown as { state: GameState }).state;
    const turn = state.turn;
    const setup: Order[] =
      turn === 1
        ? [
            { id: "cmd", kind: "instruct", general: HUMAN_ID, instruction: { kind: "military" } },
            { id: "bl", kind: "budget", general: HUMAN_ID, budget: { share: 0.5 } },
            { id: "bs", kind: "budget", general: HUMAN_ID, role: "steward", budget: { share: 0.5 } },
          ]
        : [];
    const before = JSON.stringify(g.snapshot({ app: "session-22 screenshots" }));
    const own: Order[] = state.players.find((p) => p.id === HUMAN_ID)!.gold >= 2 ? [{ id: `t${turn}`, kind: "recruit", territory: u.view.me.capital, count: "all" }] : [];
    t += 1000;
    try {
      u = g.lockIn([...setup, ...own, ...(u.generalOrders ?? [])]);
    } catch {
      break;
    }
    const broke = (u.report?.events ?? []).find((e) => e.type === "dealBroken" && e.note);
    if (broke && want.has("broken")) {
      writeFileSync("../../docs/art/screens/s22-broken.json", before);
      console.log(`  s22-broken.json: seed ${seed}, turn ${turn}: "${broke.type === "dealBroken" ? broke.note : ""}"`);
      want.delete("broken");
    }
  }
}
if (want.size) console.log(`not found: ${[...want].join(", ")}`);
