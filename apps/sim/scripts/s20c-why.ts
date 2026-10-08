/** Session 20c: on one mop-up fixture, every territory a rival takes from the leading seat, and what happened after (debugging "got away"). */
import { readFileSync } from "node:fs";
import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { playTable } from "@conquerra/simcore";
import type { GameContext, GameState, Order } from "@conquerra/engine";
import { botFor } from "../src/tournament";
import type { MopupFixture } from "./s20-mopup";

const [name, how = "delegate-80", turns = "4"] = process.argv.slice(2);
const fx = JSON.parse(readFileSync(new URL(`../../../packages/bots/test/fixtures/mopup/${name}.json`, import.meta.url), "utf8")) as MopupFixture;
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
const top = fx.top;
let ours: Order[] = [];
const bots = kinds.map((k, i) => {
  const b = botFor(k);
  return i !== seat ? b : { ...b, plan: (c: GameContext, v: any, lt: any) => ((ours = b.plan(c, v, lt)), ours) };
});
const fmt = (o: Order) => (o.kind === "move" ? `${o.from}>${o.to}(${o.troops})${o.preset ? "?" : ""}${o.timing ? "!" : ""}` : o.kind === "recruit" ? `R@${o.territory}(${o.count})` : o.kind);
playTable(ctx, `${fx.name}-run`, bots, {
  start,
  maxTurns: start.turn + Number(turns) - 1,
  onEvents: (before: GameState, ev) => {
    const own = new Map<string, number>();
    for (const t of Object.keys(before.territories)) if (before.territories[t]!.owner && before.territories[t]!.owner !== top) own.set(t, before.territories[t]!.troops);
    console.log(`T${before.turn}: rivals ${[...own].map(([t, n]) => `${t}:${before.territories[t]!.owner}(${n})`).join(" ")}; we wrote ${ours.length}`);
    let i = 0;
    for (const e of ev) {
      i++;
      if (e.type !== "battle") continue;
      if (e.player !== top && e.defender === top) {
        const touch = ours.map((o, k) => [o, k] as const).filter(([o]) => o.kind === "move" && (o.to === e.to || o.from === e.to)).map(([o, k]) => `#${k}:${fmt(o)}`);
        console.log(`  ev${i} ${e.player} took? ${e.captured} ${e.from}>${e.to} ${e.attackers.troops}v${e.defenders.troops}; our orders there: ${touch.join(" ")}`);
      }
      if (e.player === top && before.territories[e.to]?.owner === top) console.log(`  ev${i} we retake ${e.from}>${e.to} ${e.attackers.troops}v${e.defenders.troops} ${e.captured ? "+" : "-"}`);
    }
  },
});
