/** Session 20c: play a mop-up fixture to a given turn, then show the leading seat's sweep plan there (debugging). */
import { readFileSync } from "node:fs";
import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { playTable } from "@conquerra/simcore";
import { viewFor, type GameContext } from "@conquerra/engine";
import { botFor } from "../src/tournament";
import type { MopupFixture } from "./s20-mopup";
const [name, at, how = "delegate-80"] = process.argv.slice(2);
const dir = process.env.MOPUP_DIR ?? "packages/bots/test/fixtures/mopup";
const fx = JSON.parse(readFileSync(`${dir}/${name}.json`, "utf8")) as MopupFixture;
const ctx: GameContext = { map: maps[fx.map]!, rules: { ...defaultRules, game: { ...defaultRules.game, maxTurnsHard: 500 } } };
const seat = Number(fx.top.slice(1)) - 1;
const start = structuredClone(fx.state);
const kinds = [...fx.kinds];
const p = start.players[seat]!;
if (how !== "marshal") {
  kinds[seat] = how;
  for (const l of p.leaders) if (l.of === p.id) l.kind === "leader" ? ((l.command = { kind: "military" }), (l.budget = { share: 0.8 }), (l.purse = Math.floor(p.gold * 0.8))) : ((l.command = { kind: "realm" }), (l.budget = { share: 0.2 }), (l.purse = Math.floor(p.gold * 0.2)));
  p.gold -= p.leaders.filter((l) => l.of === p.id).reduce((a, l) => a + l.purse, 0);
}
const r = playTable(ctx, `${fx.name}-run`, kinds.map((k) => botFor(k)), { start, stop: (s) => s.turn >= Number(at) });
const s = r.final!;
const v = viewFor(ctx, s, fx.top);
for (const [t, tv] of Object.entries(v.territories)) if (tv.detail === "full" ? tv.owner && tv.owner !== fx.top : tv.lastSeen?.owner && tv.lastSeen.owner !== fx.top) console.log(t, JSON.stringify(tv).slice(0, 200), "truth", JSON.stringify(s.territories[t]).slice(0, 80));
console.log("deals", JSON.stringify(v.deals.map((d) => [d.kind, d.a, d.b])));
const o = botFor(how).plan(ctx, v);
console.log(o.length, "orders:", o.filter((x) => x.kind === "move").slice(0, 400).map((x: any) => `${x.from}>${x.to}(${x.troops})`).join(" ").slice(0, 3000));
