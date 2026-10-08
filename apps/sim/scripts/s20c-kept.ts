/** Session 20c: across the mop-up fixtures, every territory a rival took and still held as the turn ended, and why (debugging "got away"). */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { playTable } from "@conquerra/simcore";
import type { GameContext, GameState, Order } from "@conquerra/engine";
import { botFor } from "../src/tournament";
import type { MopupFixture } from "./s20-mopup";

const DIR = fileURLToPath(new URL("../../../packages/bots/test/fixtures/mopup/", import.meta.url));
const how = process.argv[2] ?? "delegate-80";
const cats = new Map<string, number>();
const add = (k: string) => cats.set(k, (cats.get(k) ?? 0) + 1);
for (const f of readdirSync(DIR).filter((f) => f.endsWith(".json"))) {
  const fx = JSON.parse(readFileSync(DIR + f, "utf8")) as MopupFixture;
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
  let pending: { t: string; troops: number; touched: boolean; tried: boolean; hop: number; rival: string; turn: number; why: string[] }[] = [];
  const settle = (s: GameState) => {
    for (const k of pending) {
      if (s.territories[k.t]!.owner === top) continue;
      const army = s.territories[k.t]!.troops;
      add(`kept: ${!k.touched ? "no order of ours went there" : k.tried ? "we struck and lost" : "our orders there didn't fire"}; ${army >= 8 ? "their army there (8+)" : "a small garrison"}`);
      if (k.touched && !k.tried) for (const w of k.why) add(`   didn't fire: ${w}`);
      if (process.env.V) console.log(`${fx.name} T${k.turn} ${k.rival} kept ${k.t} (${army}), hop ${k.hop}, touched ${k.touched}, tried ${k.tried}`);
    }
    pending = [];
  };
  playTable(ctx, `${fx.name}-run`, bots, {
    start,
    maxTurns: start.turn + 14,
    onTurn: (s) => settle(s),
    onEvents: (before: GameState, ev) => {
      const hops = new Map<string, number>();
      const byId = new Map(ours.map((o) => [o.id, o]));
      const fate = new Map<string, string>();
      let captured = new Set<string>();
      for (const e of ev) {
        if ((e.type === "moved" || e.type === "battle") && e.player === top && byId.has((e as any).orderId)) {
          const o = byId.get((e as any).orderId)! as any;
          if (!captured.has(o.to)) fate.set(o.id, "played before they took it");
        }
        if (e.type === "fizzled" && e.player === top && byId.has(e.orderId)) fate.set(e.orderId, `fizzled ${e.reason}`);
        if (e.type === "battle" && e.player !== top && e.defender === top && e.captured) captured.add(e.to);
      }
      captured = new Set();
      for (const e of ev) {
        if (e.type !== "battle") continue;
        if (e.player !== top && e.defender === top && e.captured) {
          const h = (hops.get(e.from) ?? 0) + 1;
          hops.set(e.to, h);
          const into = ours.filter((o) => o.kind === "move" && o.to === e.to);
          pending.push({ t: e.to, troops: e.attackers.troops, touched: into.length > 0, tried: false, hop: h, rival: e.player, turn: before.turn, why: into.map((o) => fate.get(o.id) ?? "no event") });
          add(`taken (all)`);
        }
        if (e.player === top) for (const k of pending) if (k.t === e.to) k.tried = true;
      }
    },
  });
}
for (const [k, n] of [...cats].sort()) console.log(`${String(n).padStart(4)}  ${k}`);
