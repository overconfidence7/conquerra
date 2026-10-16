import { maps } from "@conquerra/content/maps";
import { tutorialById } from "@conquerra/content/tutorials";
import { viewFor } from "@conquerra/engine";
import { it } from "vitest";
import { LocalGame } from "../src/host/localGame";
import { buildTutorial, ordersOf } from "../src/tutorials/build";
it("dbg", () => {
  const def = tutorialById(process.env.T ?? "raise-an-army")!;
  const map = maps[def.recipe.map]!;
  const game = LocalGame.restore(map, buildTutorial(def, map), () => 0);
  const show = (tag: string) => { const s = game.fullState; const me = s.players.find(p=>p.id==="you")!; console.log(tag, "turn", s.turn, "gold", me.gold, Object.entries(s.territories).filter(([,t])=>t.owner==="you").map(([id,t])=>`${id}:${t.troops}${t.building?"/"+t.building:""}${t.culture?"/c"+t.culture:""}`).join(" "), "steward purse", JSON.stringify(me.leaders.map(l=>[l.kind,l.purse,l.budget]))); };
  show("start");
  for (const [i, turn] of def.solution.entries()) { const u = game.lockIn(ordersOf(turn, i + 1), game.turn); show(`after ${i+1}`); console.log(JSON.stringify(u.report?.events?.filter((e: any)=>e.player==="you"||e.by==="you").slice(0,12))); }
});
