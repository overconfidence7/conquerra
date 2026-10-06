/**
 * Session 16: why nobody ganged up on Nate. One "fast expander" seat (the Captain with its caution turned down: it
 * chains on whenever a hop is likely to win, and doesn't hold passes cheaply, gather before a breakthrough, build
 * forts or raise culture) against 5 Captains on Wyrmland, the table Nate played. Each turn it records:
 *  - the expander's true share of the land, and whether it is truly a runaway by the Captains' own rule (on the truth);
 *  - how many living Captains' runaway rule, run on their own (fogged) view, names it;
 *  - joint wars aimed at it (and when), and the Fallen's world events aimed at it (and when there were any Fallen).
 *   npx tsx apps/sim/scripts/s16-runaway.ts [games=100] [fog=on|off] [tuned]
 * `tuned`: the Captains use the session 16 fix (see docs/decisions.md), to compare.
 */
import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { agreedIn, CAPTAIN_CHAIN_MARGIN, fallenBot, landEstimates, makeCaptainBot, negotiate, runawayLeader, withAgreed, type Bot } from "@conquerra/bots";
import { createGame, indexMap, replayFor, resolveTurn, viewFor, type GameContext, type OrdersByPlayer, type PlayerView, type ReplayEvent } from "@conquerra/engine";

const games = Number(process.argv[2] ?? 100);
const fog = (process.argv[3] ?? "on") !== "off";
const ctx: GameContext = { map: maps.wyrmland!, rules: defaultRules };
const idx = indexMap(ctx.map);
const expander: Bot = { ...makeCaptainBot({ chainMargin: 1, off: ["chokes", "breakthrough", "forts", "culture"] }), id: "expander" };
const captain = makeCaptainBot({ chainMargin: CAPTAIN_CHAIN_MARGIN });
const bots = [expander, captain, captain, captain, captain, captain];

/** Who a seat thinks is running away, from its own view (exactly the Captain's priority 8). */
function seesRunaway(view: PlayerView): string | null {
  const known = new Map<string, number>();
  let mine = 0;
  for (const t of idx.ids) {
    const v = view.territories[t]!;
    const o = v.detail === "full" ? v.owner : (v.lastSeen?.owner ?? null);
    if (o === view.me.id) mine++;
    else if (o) known.set(o, (known.get(o) ?? 0) + 1);
  }
  const alive = view.players.filter((p) => p.eliminatedTurn === null);
  return runawayLeader(landEstimates(known, alive.map((p) => p.id)), mine, idx.ids.length, alive.length);
}

interface Row {
  won: boolean;
  turns: number;
  /** First turn the expander truly was a runaway (by the rule, on the true land), and first turn a Captain saw it. */
  trueAt: number | null;
  seenAt: number | null;
  /** Turns it was truly a runaway, and on those, Captain-turns that saw it out of Captain-turns alive. */
  trueTurns: number;
  seeing: number;
  looking: number;
  /** Its true land share at its peak, and on turn 12 (Nate's game ended on turn 12). */
  peak: number;
  at12: number;
  wars: number[];
  warsOnOthers: number;
  fallenTurns: number;
  fallenOnIt: number;
  fallenOnOthers: number;
  /** World events while it was the true runaway: on it, on others. */
  fallenWhileRunawayOnIt: number;
  fallenWhileRunawayOnOthers: number;
}

const rows: Row[] = [];
for (let g = 0; g < games; g++) {
  const players = bots.map((_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}` }));
  // Rotate the start: the expander takes every seat in turn (capitals are shuffled by the seed anyway).
  let s = createGame(ctx, { gameId: `rw-${g}`, seed: `runaway-${g}`, players, settings: { fog } });
  const ex = "p1";
  const row: Row = { won: false, turns: 0, trueAt: null, seenAt: null, trueTurns: 0, seeing: 0, looking: 0, peak: 0, at12: 0, wars: [], warsOnOthers: 0, fallenTurns: 0, fallenOnIt: 0, fallenOnOthers: 0, fallenWhileRunawayOnIt: 0, fallenWhileRunawayOnOthers: 0 };
  let lastTurn = new Map<string, ReplayEvent[]>();
  while (!s.winner) {
    const views = new Map(s.players.filter((p) => p.eliminatedTurn === null).map((p) => [p.id, viewFor(ctx, s, p.id)]));
    // The truth: land held now.
    const land = new Map<string, number>();
    for (const t of idx.ids) {
      const o = s.territories[t]!.owner;
      if (o) land.set(o, (land.get(o) ?? 0) + 1);
    }
    const alive = s.players.filter((p) => p.eliminatedTurn === null);
    const exLand = land.get(ex) ?? 0;
    const truth = runawayLeader(landEstimates(land, alive.map((p) => p.id)), 0, idx.ids.length, alive.length);
    const isRunaway = truth === ex;
    row.peak = Math.max(row.peak, exLand / idx.ids.length);
    if (s.turn === 12) row.at12 = exLand / idx.ids.length;
    if (isRunaway) {
      row.trueTurns++;
      row.trueAt ??= s.turn;
      for (const p of alive)
        if (p.id !== ex) {
          row.looking++;
          if (seesRunaway(views.get(p.id)!) === ex) (row.seeing++, (row.seenAt ??= s.turn));
        }
    }
    if (s.players.some((p) => p.eliminatedTurn !== null)) row.fallenTurns++;
    const talk = s.settings.diplomacy ? negotiate(ctx, s.players.flatMap((p) => (p.eliminatedTurn === null ? [{ id: p.id, level: "captain" as const }] : [])), (id) => views.get(id)!, (id) => lastTurn.get(id), null) : null;
    const agreed = talk ? agreedIn(talk.orders) : [];
    const orders: OrdersByPlayer = {};
    for (const [seat, p] of s.players.entries())
      if (p.eliminatedTurn === null) orders[p.id] = [...(talk?.orders[p.id] ?? []), ...bots[seat]!.plan(ctx, withAgreed(views.get(p.id)!, agreed), lastTurn.get(p.id))];
      else orders[p.id] = fallenBot.plan(ctx, viewFor(ctx, s, p.id));
    const before = s;
    const r = resolveTurn(ctx, s, orders);
    for (const e of r.events) {
      if (e.type === "dealStarted" && e.deal.terms.kind === "war") {
        if (e.deal.terms.target === ex) row.wars.push(before.turn);
        else row.warsOnOthers++;
      }
      if (e.type === "worldEvent") {
        if (e.against === ex) (row.fallenOnIt++, isRunaway && row.fallenWhileRunawayOnIt++);
        else (row.fallenOnOthers++, isRunaway && row.fallenWhileRunawayOnOthers++);
      }
    }
    s = r.state;
    lastTurn = new Map(s.players.filter((p) => p.eliminatedTurn === null).map((p) => [p.id, replayFor(ctx, before, r, p.id)]));
  }
  row.won = s.winner === ex;
  row.turns = s.turn;
  rows.push(row);
  if ((g + 1) % 10 === 0) process.stderr.write(`${g + 1} `);
}

const avg = (f: (r: Row) => number, of = rows) => (of.length ? of.reduce((a, r) => a + f(r), 0) / of.length : 0);
const pct = (x: number) => `${Math.round(x * 100)}%`;
const ran = rows.filter((r) => r.trueAt !== null);
console.log(`\n=== Wyrmland, 6 players: one fast expander (seat 1) vs 5 Captains, ${games} games, fog ${fog ? "on" : "off"} ===`);
console.log(`Expander wins ${pct(avg((r) => +r.won))} (fair 17%); games last ${avg((r) => r.turns).toFixed(1)} turns; its land at turn 12 ${pct(avg((r) => r.at12))}, at its peak ${pct(avg((r) => r.peak))}`);
console.log(`It became a true runaway (the Captains' rule on the real land) in ${pct(ran.length / games)} of games, first on turn ${avg((r) => r.trueAt!, ran).toFixed(1)} on average`);
console.log(`While it was: the Captains' rule (from their own fogged view) named it in ${pct(ran.reduce((a, r) => a + r.seeing, 0) / Math.max(1, ran.reduce((a, r) => a + r.looking, 0)))} of Captain-turns; some Captain saw it in ${pct(ran.filter((r) => r.seenAt !== null).length / Math.max(1, ran.length))} of those games, ${avg((r) => r.seenAt! - r.trueAt!, ran.filter((r) => r.seenAt !== null)).toFixed(1)} turns after it truly was one`);
console.log(`Joint wars against it: ${avg((r) => r.wars.length).toFixed(2)} a game (in ${pct(avg((r) => +(r.wars.length > 0)))} of games; first on turn ${avg((r) => r.wars[0]!, rows.filter((r) => r.wars.length)).toFixed(1)}); against anyone else: ${avg((r) => r.warsOnOthers).toFixed(2)} a game`);
console.log(`The Fallen: present on ${avg((r) => r.fallenTurns).toFixed(1)} turns a game; world events on it ${avg((r) => r.fallenOnIt).toFixed(2)} a game, on others ${avg((r) => r.fallenOnOthers).toFixed(2)}; while it was the true runaway: on it ${avg((r) => r.fallenWhileRunawayOnIt).toFixed(2)}, on others ${avg((r) => r.fallenWhileRunawayOnOthers).toFixed(2)}`);
console.log(`Games ending by turn 15: ${pct(avg((r) => +(r.turns <= 15)))}; of those the expander won ${pct(avg((r) => +r.won, rows.filter((r) => r.turns <= 15)))}`);
