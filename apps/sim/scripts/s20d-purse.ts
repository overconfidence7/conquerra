/**
 * Session 20d, Part 1: does a Leader on Run the military spend its purse every turn, measured the way Nate plays?
 *
 *   npx tsx apps/sim/scripts/s20d-purse.ts trace <map:players> <leaderShare> <game> [turns]
 *     one game, turn by turn: the purse at the start, what it spent, what it kept, and why.
 *   npx tsx apps/sim/scripts/s20d-purse.ts run <map:players> <leaderShare> <games> [turns]
 *     the unspent share of the purse at the end of each turn's orders, by turn, over many games.
 *
 * The seat (always seat 1, the capital spot dealt by the seed) plays like Nate: its Leader runs the military on
 * `leaderShare` of the income, its Steward runs the realm on 20% (none at 80% and over: the rest), and it spends its own
 * treasury on troops at its capital. Everyone else is a Marshal (personalities dealt from the seed), fog and diplomacy
 * on. Unspent = the purse as the turn starts minus what the Leader's orders paid for (upkeep the purses pay comes after
 * the orders, so it isn't counted). "Reasons" sorts every turn that kept a troop's worth (2 gold) or more.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { defaultRules, marshalData } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { playTable } from "@conquerra/simcore";
import { dealPersonalities, makeDelegateSeat, makeMarshalBot } from "@conquerra/bots";
import { isRecruitSiteIn, leaderKey, type GameContext, type Order, type PlayerView } from "@conquerra/engine";

const args = process.argv.slice(2);
const self = fileURLToPath(import.meta.url);

export interface Turn {
  game: number;
  turn: number;
  purse: number;
  spent: number;
  left: number;
  planned: number;
  sites: number;
  note: string | null;
  fizzles: string[];
  why: string;
  cleaning: boolean;
}

export function playGame(table: string, share: number, g: number, turns: number, verbose = false): Turn[] {
  const [map, n] = table.split(":") as [string, string];
  const ctx: GameContext = { map: maps[map]!, rules: defaultRules };
  const key = leaderKey({ kind: "leader", of: "p1" });
  const seed = `s20d-purse-${map}-${n}-${g}`;
  const plans = new Map<number, { view: PlayerView; orders: Order[]; note: string | null }>();
  const seat = makeDelegateSeat(share, {
    stewardShare: share >= 0.8 ? Math.round((1 - share) * 100) / 100 : 0.2,
    cleanUp: false,
    trace: (view, plan) => {
      const nt = plan.notes[key];
      plans.set(view.turn, { view, orders: plan.orders.filter((o) => o.general === "p1"), note: nt ? (nt.kind === "saving" ? `saving ${nt.gold} for ${nt.for}` : nt.kind) : null });
    },
  });
  const dealt = dealPersonalities(seed, Array.from({ length: Number(n) - 1 }, (_, i) => `s${i + 1}`));
  const bots = [seat, ...Array.from({ length: Number(n) - 1 }, (_, i) => makeMarshalBot(dealt[`s${i + 1}`]!))];
  const out: Turn[] = [];
  let before = 0;
  playTable(ctx, seed, bots, {
    settings: { fog: true, diplomacy: true },
    maxTurns: turns,
    onTurn: (s) => {
      const p = s.players[0]!;
      before = p.leaders.find((l) => l.kind === "leader" && l.of === "p1")?.purse ?? 0;
    },
    onEvents: (s, ev) => {
      const turn = s.turn;
      const p = s.players[0]!;
      if (p.eliminatedTurn !== null) return;
      const plan = plans.get(turn);
      if (!plan) return;
      const by = (e: { by?: { kind: string; of: string } }) => e.by?.kind === "leader" && e.by.of === "p1";
      const spent = ev.reduce((a, e) => a + ("by" in e && by(e as never) ? ((e as { cost?: number }).cost ?? 0) : 0), 0);
      const ids = new Set(plan.orders.map((o) => o.id));
      const fizzles = ev.filter((e) => e.type === "fizzled" && ids.has((e as { orderId: string }).orderId)).map((e) => `${(e as { reason: string }).reason}`);
      const recruits = plan.orders.filter((o) => o.kind === "recruit");
      const planned = recruits.reduce((a, o) => a + (typeof (o as { count: unknown }).count === "number" ? (o as { count: number }).count * ctx.rules.troops.cost : 0), 0) + plan.orders.reduce((a, o) => a + (o.kind === "hire" ? ctx.rules.specialists[o.specialist].cost : o.kind === "build" ? ctx.rules.buildings[o.building].cost : 0), 0);
      const sites = Object.keys(plan.view.territories).filter((t) => isRecruitSiteIn(ctx, plan.view, t)).length;
      const left = before - spent;
      const held = Object.values(plan.view.territories).filter((t) => t.detail === "full" && t.owner === "p1").length;
      let why = "spent";
      if (left >= ctx.rules.troops.cost) {
        if (plan.note?.startsWith("saving")) why = plan.note;
        else if (!sites) why = "no recruit site";
        else if (planned < before - 1) why = recruits.length ? "planned less than the purse" : "planned no recruits";
        else if (fizzles.length) why = `fizzled: ${[...new Set(fizzles)].join(",")}`;
        else why = "other";
      }
      out.push({ game: g, turn, purse: before, spent, left, planned, sites, note: plan.note, fizzles, why, cleaning: held >= ctx.rules.leaders.cleanUpShare * ctx.map.territories.length });
      if (verbose)
        console.log(
          `T${turn}: purse ${before}, planned ${planned}, spent ${spent}, kept ${left}${before ? ` (${Math.round((100 * left) / before)}%)` : ""}; ${why}; sites ${sites}; note ${plan.note ?? "-"}; recruits ${recruits.map((o) => `${String((o as { count: unknown }).count)}@${o.territory}`).join(",")}${fizzles.length ? `; fizzled ${fizzles.join(",")}` : ""}`,
        );
    },
  });
  return out;
}

const pool = <T>(jobs: unknown[], workers = 19): Promise<T[]> => {
  const k = Math.min(workers, jobs.length);
  return Promise.all(
    Array.from({ length: k }, (_, w) =>
      new Promise<T[]>((resolve, reject) => {
        const child = spawn(process.execPath, ["--import", "tsx", self, "--worker", JSON.stringify(jobs.filter((_, i) => i % k === w))], { stdio: ["ignore", "pipe", "inherit"] });
        let out = "";
        child.stdout.on("data", (d) => (out += d));
        child.on("exit", (code) => (code === 0 ? resolve(out.split("\n").filter(Boolean).map((l) => JSON.parse(l) as T)) : reject(new Error(`worker ${w} exited ${code}`))));
      }),
    ),
  ).then((p) => p.flat());
};

type Job = { table: string; share: number; g: number; turns: number };
if (args[0] === "--worker") {
  for (const j of JSON.parse(args[1]!) as Job[]) process.stdout.write(`${JSON.stringify(playGame(j.table, j.share, j.g, j.turns))}\n`);
} else if (args[0] === "trace") {
  const [, table = "wyrmland:6", share = "0.5", g = "0", turns = "10"] = args;
  playGame(table, Number(share), Number(g), Number(turns) + 1, true);
} else if (args[0] === "run") {
  const [, table = "wyrmland:6", share = "0.5", games = "300", turns = "30"] = args;
  const all = (await pool<Turn[]>(Array.from({ length: Number(games) }, (_, g) => ({ table, share: Number(share), g, turns: Number(turns) })))).flat();
  report(table, Number(share), all);
}

export function report(table: string, share: number, all: Turn[]) {
  const live = all.filter((t) => t.purse >= 2);
  const pct = (k: number, of: number) => `${((100 * k) / Math.max(1, of)).toFixed(1)}%`;
  const under10 = live.filter((t) => t.left / t.purse < 0.1).length;
  const underTroop = live.filter((t) => t.left < 2).length;
  const shareSum = live.reduce((a, t) => a + t.left / t.purse, 0);
  console.log(`${table} Leader ${Math.round(share * 100)}%: ${live.length} turns with a purse; unspent share ${pct(shareSum, live.length)} on average; under 10% unspent on ${pct(under10, live.length)}; under a troop's cost on ${pct(underTroop, live.length)}; average purse ${(live.reduce((a, t) => a + t.purse, 0) / Math.max(1, live.length)).toFixed(1)}g, kept ${(live.reduce((a, t) => a + t.left, 0) / Math.max(1, live.length)).toFixed(1)}g`);
  const bands = [[1, 5], [6, 10], [11, 15], [16, 20], [21, 30], [31, 99]] as const;
  console.log(`  by turn: ${bands.map(([a, b]) => { const x = live.filter((t) => t.turn >= a && t.turn <= b); return `${a}-${b}: ${pct(x.reduce((s, t) => s + t.left / t.purse, 0), x.length)} unspent, <10% on ${pct(x.filter((t) => t.left / t.purse < 0.1).length, x.length)} (${x.length})`; }).join(" | ")}`);
  const why = new Map<string, number>();
  for (const t of live) if (t.left >= 2) why.set(t.why, (why.get(t.why) ?? 0) + 1);
  console.log(`  kept a troop's worth or more on ${pct(live.length - underTroop, live.length)}: ${[...why].sort((a, b) => b[1] - a[1]).map(([w, k]) => `${w} ${k}`).join("; ")}`);
}
