/** Session 20c: on each mop-up fixture, where the Leader stands and whether it goes with the main chain (debugging). */
import { readdirSync, readFileSync } from "node:fs";
import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { planLeaders } from "@conquerra/bots";
import { leaderKey, viewFor, type GameContext } from "@conquerra/engine";
for (const f of readdirSync("packages/bots/test/fixtures/mopup")) {
  const fx = JSON.parse(readFileSync(`packages/bots/test/fixtures/mopup/${f}`, "utf8"));
  const ctx: GameContext = { map: maps[fx.map]!, rules: defaultRules };
  const s = structuredClone(fx.state);
  const p = s.players.find((x: any) => x.id === fx.top);
  p.leaders.find((l: any) => l.kind === "leader" && l.of === p.id).purse = 60;
  const view = viewFor(ctx, s, fx.top);
  const r = planLeaders({ ctx, view, commands: { [leaderKey({ kind: "leader", of: fx.top })]: { kind: "military" } } });
  const at = p.leader.territory;
  const withL = r.orders.filter((o: any) => o.withLeader).map((o: any) => `${o.from}>${o.to}`);
  console.log(fx.name, "leader", p.leader.alive ? at : "dead", "troops", s.territories[at]?.troops, "capital", p.capital, "| rides:", withL.slice(0, 8).join(" "), withL.length);
}
