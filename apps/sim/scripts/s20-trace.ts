/** Session 20: one mop-up fixture turn by turn with the leading seat delegating (what its Leader spends, writes, and where the rivals are). */
import { readFileSync } from "node:fs";
import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { playTable } from "@conquerra/simcore";
import type { GameContext } from "@conquerra/engine";
import { botFor } from "../src/tournament";
import type { MopupFixture } from "./s20-mopup";

const [name, how = "delegate-80"] = process.argv.slice(2);
const fx = JSON.parse(readFileSync(process.env.MOPUP_DIR ? `${process.env.MOPUP_DIR}/${name}.json` : new URL(`../../../packages/bots/test/fixtures/mopup/${name}.json`, import.meta.url), "utf8")) as MopupFixture;
const ctx: GameContext = { map: maps[fx.map]!, rules: { ...defaultRules, game: { ...defaultRules.game, maxTurnsHard: 500 } } };
const seat = Number(fx.top.slice(1)) - 1;
const start = structuredClone(fx.state);
const kinds = [...fx.kinds];
if (how !== "marshal") {
  kinds[seat] = how;
  const p = start.players[seat]!;
  for (const l of p.leaders) {
    if (l.of !== p.id) continue;
    if (l.kind === "leader") (l.command = { kind: "military" }), (l.budget = { share: 0.8 }), (l.purse = Math.floor(p.gold * 0.8));
    else (l.command = { kind: "realm" }), (l.budget = { share: 0.2 }), (l.purse = Math.floor(p.gold * 0.2));
  }
  p.gold -= p.leaders.filter((l) => l.of === p.id).reduce((a, l) => a + l.purse, 0);
}
const me = fx.top;
console.log(`${fx.name}: ${me} (${kinds[seat]}) holds ${(fx.share * 100).toFixed(0)}%; rivals ${fx.rivals.map((r) => `${r.id}:${r.land}`).join(" ")}`);
const bots = kinds.map((k, i) => {
  const b = botFor(k);
  return i !== seat || !process.env.ORD ? b : { ...b, plan: (c: GameContext, v: any, lt: any) => { const o = b.plan(c, v, lt); if (String(v.turn) === process.env.ORD) console.log("ORDERS", o.map((x: any) => `${x.id.split("-").pop()}:${x.kind}${x.from ? ` ${x.from}>${x.to}` : x.territory ? `@${x.territory}` : ""}${x.troops !== undefined ? `(${x.troops})` : x.count !== undefined ? `(${x.count})` : ""}${x.timing ? "!" + x.timing : ""}`).join(" ")); return o; } };
});
playTable(ctx, `${fx.name}-run`, bots, {
  start,
  maxTurns: start.turn + 9,
  onTurn: (s) => {
    const p = s.players.find((x) => x.id === me)!;
    const land = new Map<string, string[]>();
    for (const t of ctx.map.territories) {
      const o = s.territories[t.id]!.owner;
      if (o && o !== me) land.set(o, [...(land.get(o) ?? []), `${t.id}(${s.territories[t.id]!.troops})`]);
    }
    const troops = ctx.map.territories.filter((t) => s.territories[t.id]!.owner === me).map((t) => s.territories[t.id]!.troops);
    const deals = (s.deals ?? []).filter((d: any) => d.a === me || d.b === me).map((d: any) => `${d.kind ?? d.terms?.kind}:${d.a}-${d.b}`);
    console.log(`T${s.turn}: deals ${deals.join(",")} gold ${p.gold}, purses ${p.leaders.map((l) => `${l.kind[0]}${l.of}:${l.purse}`).join(",")}, troops ${troops.reduce((a, b) => a + b, 0)} (biggest ${Math.max(...troops)}) | ${[...land].map(([o, ts]) => `${o}: ${ts.join(" ")}`).join(" | ")}`);
  },
  onEvents: (_b, ev) => {
    const mine = ev.filter((e) => "player" in e && e.player === me);
    const k = new Map<string, number>();
    for (const e of mine) k.set(e.type, (k.get(e.type) ?? 0) + 1);
    const rec = mine.filter((e) => e.type === "recruited").map((e) => (e as { count: number; territory: string }).count + "@" + (e as { territory: string }).territory);
    const fz = mine.filter((e) => e.type === "fizzled").map((e) => JSON.stringify(e).slice(0, Number(process.env.FZ ?? 80)));
    const vs = mine.filter((e) => e.type === "battle").map((e) => `${(e as any).from}>${(e as any).to}${(e as any).captured ? "+" : "-"}(${(e as any).attackers.troops}v${(e as any).defenders.troops})`);
    console.log(`   events ${[...k].map(([a, b]) => `${a}:${b}`).join(" ")}; recruited ${rec.join(",")}; battles ${vs.join(" ")}; fizzles ${fz.join(",")}`);
  },
});
