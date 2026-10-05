import { readFileSync } from "node:fs";
import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { indexMap, replaySavedGame, type GameContext, type GameMode, type SavedGame } from "@conquerra/engine";
import { CAPTAIN_CHAIN_MARGIN, makeCaptainBot, makeRecruitBot, type Bot, type CaptainFeature } from "@conquerra/bots";
import { narrate } from "./narrate";
import { runGame, type GameSummary } from "./runGame";

/**
 * Bot-vs-bot simulator.
 *   pnpm sim                                   500 games, 4 players
 *   pnpm sim --games 1000 --players 2,4,6      several table sizes in one run
 *   pnpm sim --games 50 --players 2,6,10       includes CPU timing (10 players uses the Greatmarch map)
 *   pnpm sim --watch --seed demo               print one game turn by turn in plain English
 *   pnpm sim --bots recruit                    all-Recruit tables (the default is all-Captain, the lobby's default)
 *   pnpm sim --mix captain,recruit,recruit,recruit   mixed tables: one bot per seat, rotated each game so no bot
 *                                              keeps a lucky seat; prints each bot's win rate
 *   pnpm sim --replay game.json                play a saved game (Settings → "Save this game") turn by turn
 * Options: --map embervale|greatmarch (default: Embervale up to 6 players, Greatmarch above),
 *          --luck 0.3, --mode classic|conquest, --turn-limit N, --fog on|off, --seed prefix,
 *          --chain-margin N (bots chain on when the arriving army is this many times what the next target needs;
 *          default 2 for Recruit, 1.25 for Captain; 1 = chain whenever the hop is likely to win)
 */
const args = process.argv.slice(2);
const arg = (name: string, dflt: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1]!.startsWith("--") ? args[i + 1]! : dflt;
};
const flag = (name: string) => args.includes(`--${name}`);

const playerCounts = arg("players", "4").split(",").map(Number);
const games = Number(arg("games", "500"));
const luck = Number(arg("luck", String(defaultRules.combat.luck)));
const mode = arg("mode", "classic") as GameMode;
const turnLimit = arg("turn-limit", "") ? Number(arg("turn-limit", "")) : null;
const fog = arg("fog", "on") !== "off";
const seedPrefix = arg("seed", "sim");
const settings = { luck, mode, fog, ...(turnLimit ? { turnLimit } : {}) };
const botKind = arg("bots", "captain");
const marginArg = arg("chain-margin", "");
const makeBot = (kind: string): Bot => {
  // --chain-margin tunes the bot under test (--bots, Captain by default); other bots at a mixed table keep theirs.
  const margin = marginArg && kind === botKind ? Number(marginArg) : null;
  if (kind === "recruit") return makeRecruitBot({ chainMargin: margin ?? 2 });
  if (kind === "captain") return makeCaptainBot({ chainMargin: margin ?? CAPTAIN_CHAIN_MARGIN, off: (arg("captain-off", "") ? arg("captain-off", "").split(",") : []) as CaptainFeature[] });
  // "captain-no-culture" etc.: a Captain with one priority switched off, under its own name (for mixed tables).
  if (kind.startsWith("captain-no-")) return { ...makeCaptainBot({ chainMargin: margin ?? CAPTAIN_CHAIN_MARGIN, off: [kind.slice("captain-no-".length) as CaptainFeature] }), id: kind };
  throw new Error(`Unknown bot "${kind}" (recruit, captain, or captain-no-<priority>)`);
};
const mix = arg("mix", "") ? arg("mix", "").split(",").map((k) => k.trim()) : null;
const label = mix ? `mixed table (${mix.join(", ")})` : `${botKind === "captain" ? "Captain" : "Recruit"} bots${marginArg ? ` (chain margin ${marginArg})` : ""}`;

/** Balance experiments: --culture-defense 0.08 (defense per culture level), --culture-costs 3,4,5,6,7. */
const rules = JSON.parse(JSON.stringify(defaultRules)) as typeof defaultRules;
if (arg("culture-defense", "")) rules.culture.defensePerLevel = Number(arg("culture-defense", ""));
if (arg("culture-costs", "")) rules.culture.investCost = arg("culture-costs", "").split(",").map(Number);
const tuned = arg("culture-defense", "") || arg("culture-costs", "") ? `, culture +${Math.round(rules.culture.defensePerLevel * 100)}%/level costing ${rules.culture.investCost.join("/")}` : "";

function ctxFor(players: number): GameContext {
  const name = arg("map", players > 6 ? "greatmarch" : "embervale");
  const map = maps[name];
  if (!map) throw new Error(`Unknown map. Available: ${Object.keys(maps).join(", ")}`);
  return { map, rules };
}

if (arg("replay", "")) {
  const save = JSON.parse(readFileSync(arg("replay", ""), "utf8")) as SavedGame;
  if (save.format !== "conquerra-save") throw new Error("That file isn't a saved Conquerra game.");
  const map = maps[save.mapId];
  if (!map) throw new Error(`Unknown map ${save.mapId}`);
  if ((map.generator?.version ?? null) !== save.mapVersion)
    console.log(`Warning: this game was played on ${map.name} made by map maker v${save.mapVersion}; this copy is v${map.generator?.version}. The replay will go differently.`);
  const ctx: GameContext = { map, rules: save.rules };
  const idx = indexMap(map);
  const names = new Map(save.setup.players.map((p) => [p.id, p.name]));
  const name = (id: string | null) => (id ? (names.get(id) ?? id) : "neutral");
  const place = (id: string) => idx.byId.get(id)?.name ?? id;
  console.log(`Replaying ${save.setup.gameId} on ${map.name}: ${save.setup.players.map((p) => p.name).join(", ")}; ${save.turns.length} turns${save.notes ? ` (${Object.entries(save.notes).map(([k, v]) => `${k} ${v}`).join(", ")})` : ""}`);
  const { matches, state } = replaySavedGame(ctx, save, (r) => {
    for (const e of r.events) console.log(narrate(ctx, e, name, place));
  });
  console.log(matches ? `\nThe replay matches the saved game exactly (turn ${state.turn}).` : `\nThe replay ended somewhere different from the saved game (the rules or the engine have changed since).`);
  process.exit(matches ? 0 : 1);
}

if (flag("watch")) {
  const ctx = ctxFor(playerCounts[0]!);
  const g = runGame(ctx, seedPrefix, playerCounts[0]!, settings, true, makeBot(botKind));
  const idx = indexMap(ctx.map);
  const name = (id: string | null) => (id ? `Bot ${id.slice(1)}` : "neutral");
  const place = (id: string) => idx.byId.get(id)?.name ?? id;
  for (const turn of g.log ?? []) for (const e of turn) console.log(narrate(ctx, e, name, place));
  process.exit(0);
}

const stats = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const avg = s.reduce((a, b) => a + b, 0) / Math.max(1, s.length);
  return { avg, p95: s[Math.floor(s.length * 0.95)] ?? 0, max: s[s.length - 1] ?? 0 };
};
const ms = (x: number) => `${x.toFixed(2)} ms`;
const pct2 = (k: number, of: number) => `${((100 * k) / Math.max(1, of)).toFixed(0)}%`;
let crashed = 0;

for (const players of playerCounts) {
  const ctx = ctxFor(players);
  const t0 = Date.now();
  const results: GameSummary[] = [];
  const errors: { seed: string; error: string }[] = [];
  for (let i = 0; i < games; i++) {
    const seed = `${seedPrefix}-${players}p-${i}`;
    try {
      // Mixed tables: rotate who sits where each game, so seat luck evens out.
      const bots = mix ? Array.from({ length: players }, (_, k) => makeBot(mix[(k + i) % mix.length]!)) : makeBot(botKind);
      results.push(runGame(ctx, seed, players, settings, false, bots));
    } catch (e) {
      errors.push({ seed, error: e instanceof Error ? (e.stack ?? e.message) : String(e) });
    }
  }
  const wall = Date.now() - t0;
  crashed += errors.length;

  const avg = (f: (g: GameSummary) => number) => results.reduce((a, g) => a + f(g), 0) / Math.max(1, results.length);
  const pct = (k: number) => `${((100 * k) / Math.max(1, results.length)).toFixed(1)}%`;
  const wins = Array.from({ length: players }, (_, i) => results.filter((g) => g.winnerSeat === i).length);
  const draws = results.filter((g) => g.winner === "draw").length;
  const reasons = new Map<string, number>();
  for (const g of results) reasons.set(String(g.endReason), (reasons.get(String(g.endReason)) ?? 0) + 1);
  const decided = results.filter((g) => g.decidedTurn !== null);
  const turns = results.map((g) => g.turns).sort((a, b) => a - b);
  const inBand = results.filter((g) => g.turns >= 15 && g.turns <= 25).length;
  const resolve = stats(results.flatMap((g) => g.resolveMs));
  const plan = stats(results.flatMap((g) => g.planMs));
  const total = stats(results.flatMap((g) => g.resolveMs.map((r, i) => r + g.planMs[i]!)));

  console.log(`\n=== ${players} players — ${ctx.map.name}, ${label}, luck ${luck}, ${mode}${turnLimit ? ` (${turnLimit} turns)` : ""}, fog ${fog ? "on" : "off"}${tuned} ===`);
  console.log(`Games: ${results.length} finished, ${errors.length} crashed, in ${(wall / 1000).toFixed(1)}s`);
  console.log(`Win rate by seat (fair ≈ ${(100 / players).toFixed(1)}% each): ${wins.map((w) => pct(w)).join(" / ")}   draws ${pct(draws)}`);
  if (mix) {
    const kinds = [...new Set(mix)];
    // Each kind's share of seats, so "fair" is clear (1 Captain at a 4-player table: fair = 25%).
    console.log(`Win rate by bot: ${kinds.map((k) => `${k} ${pct(results.filter((g) => g.winnerBot === k).length)} (fair ${((100 * mix.filter((x) => x === k).length) / mix.length).toFixed(0)}%)`).join(", ")}`);
  }
  const perBot = new Map<string, number[]>();
  for (const g of results) for (const [k, v] of Object.entries(g.planMsByBot)) perBot.set(k, [...(perBot.get(k) ?? []), ...v]);
  console.log(`Planning time per bot per turn: ${[...perBot].map(([k, v]) => { const st = stats(v); return `${k} avg ${ms(st.avg)}, p95 ${ms(st.p95)}, worst ${ms(st.max)}`; }).join(" | ")}`);
  console.log(`How games ended: ${[...reasons.entries()].map(([k, v]) => `${k} ${pct(v)}`).join(", ")}`);
  console.log(`Game length (turns): avg ${avg((g) => g.turns).toFixed(1)}, median ${turns[Math.floor(turns.length / 2)] ?? "-"}, min ${turns[0] ?? "-"}, max ${turns[turns.length - 1] ?? "-"}; ${pct(inBand)} within 15–25`);
  console.log(`Per game: ${avg((g) => g.battles).toFixed(1)} battles, ${avg((g) => g.captures).toFixed(1)} captures, ${avg((g) => g.hires).toFixed(1)} specialists hired, ${avg((g) => g.invests).toFixed(1)} culture raises, ${avg((g) => g.leadersKilled).toFixed(1)} leaders killed`);
  const inv = (k: keyof GameSummary["investsAt"]) => results.reduce((a, g) => a + g.investsAt[k], 0);
  const invTotal = results.reduce((a, g) => a + g.invests, 0);
  console.log(`Culture: bought in ${pct(results.filter((g) => g.invests > 0).length)} of games; raises went to the capital ${pct2(inv("capital"), invTotal)}, choke points ${pct2(inv("choke"), invTotal)}, other frontier ${pct2(inv("frontier"), invTotal)}, interior ${pct2(inv("interior"), invTotal)}`);
  const rec = (k: keyof GameSummary["recruitsAt"]) => results.reduce((a, g) => a + g.recruitsAt[k], 0);
  const recTotal = rec("capital") + rec("barracks") + rec("province");
  console.log(`Recruits by site (troops): capital ${pct2(rec("capital"), recTotal)}, barracks ${pct2(rec("barracks"), recTotal)}, fully held province ${pct2(rec("province"), recTotal)}`);
  const lop = results.reduce((a, g) => a + g.lopsided, 0), lopFail = results.reduce((a, g) => a + g.lopsidedFailed, 0);
  console.log(`Lopsided attacks (8 times the defenders or more): ${avg((g) => g.lopsided).toFixed(1)} per game, ${lop ? ((100 * lopFail) / lop).toFixed(2) : "-"}% failed (${lopFail} of ${lop})`);
  const kinds = ["normal", "river", "pass", "sea"];
  console.log(`Battles by border (per game, % that captured): ${kinds.map((k) => { const b = results.reduce((a, g) => a + (g.byBorder[k]?.battles ?? 0), 0), c = results.reduce((a, g) => a + (g.byBorder[k]?.captures ?? 0), 0); return `${k} ${(b / Math.max(1, results.length)).toFixed(1)} (${b ? ((100 * c) / b).toFixed(0) : "-"}%)`; }).join(", ")}`);
  console.log(`Orders per game: ${avg((g) => g.orders).toFixed(0)} (${((100 * results.reduce((a, g) => a + g.presets, 0)) / Math.max(1, results.reduce((a, g) => a + g.orders, 0))).toFixed(0)}% with a preset), fizzled: ${((100 * results.reduce((a, g) => a + g.fizzles, 0)) / Math.max(1, results.reduce((a, g) => a + g.orders, 0))).toFixed(1)}%`);
  console.log(`Predictability (lower = more exciting): winner locked in the lead at ${(100 * (decided.reduce((a, g) => a + g.decidedTurn! / g.turns, 0) / Math.max(1, decided.length))).toFixed(0)}% of the game; ${avg((g) => g.leadChanges).toFixed(1)} lead changes per game`);
  const hops = results.reduce((a, g) => a + g.hops, 0);
  console.log(`Chained hops per game: ${avg((g) => g.hops).toFixed(1)} (${hops ? ((100 * results.reduce((a, g) => a + g.hopCaptures, 0)) / hops).toFixed(0) : "-"}% captured)`);
  const at10 = results.filter((g) => g.topShareTurn10 !== null);
  console.log(`Runaway check: one player held more than half the map after turn 10 in ${pct(at10.filter((g) => g.topShareTurn10! > 0.5).length)} of games (${pct(results.length - at10.length)} were already over by then)`);
  console.log(`CPU per turn (this machine): resolve avg ${ms(resolve.avg)}, p95 ${ms(resolve.p95)}, worst ${ms(resolve.max)} | bots planning (all seats) avg ${ms(plan.avg)}, worst ${ms(plan.max)} | total avg ${ms(total.avg)}, worst ${ms(total.max)}`);
  if (errors.length) {
    console.log(`CRASHES (first 3):`);
    for (const e of errors.slice(0, 3)) console.log(`  seed ${e.seed}:\n${e.error}`);
  }
}
if (crashed) process.exit(1);
