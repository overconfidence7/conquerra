import { readFileSync } from "node:fs";
import { defaultRules } from "@conquerra/content";
import { maps } from "@conquerra/content/maps";
import { indexMap, replaySavedGame, stateFingerprint, type GameContext, type GameMode, type SaveFile, type SavedGameV1 } from "@conquerra/engine";
import { CAPTAIN_CHAIN_MARGIN, makeCaptainBot, makeGeneralSeat, makeRecruitBot, type Bot, type CaptainFeature } from "@conquerra/bots";
import type { InstructionKind } from "@conquerra/engine";
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
 *   pnpm sim --replay game.json                play a saved game (Settings → "Save to a file") turn by turn
 *   pnpm sim --mix general-push,captain,captain,captain   one seat's Leader runs on a standing instruction
 *                                              (general-hold, -defend, -push or -raid); the rest play as the Captain
 * Options: --fallen on|off (knocked-out seats play world events; on by default), --rules a.b=1,c.d=2 (any rule number),
 *          --spoils on|off, --fate on|off (the card decks; both on by default), --diplomacy on|off (deals; on by default),
 *          --spies on|off (spies; on by default),
 *          --reasons N (print N of the bots' reason lines from the games),
 *          --map embervale|greatmarch (default: Embervale up to 6 players, Greatmarch above),
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
/** The Fallen (session 12): knocked-out seats play world events (on by default; --fallen off to compare). */
const fallen = arg("fallen", "on") !== "off";
/** The card decks (session 13): Spoils and Fate (both on by default; --spoils off / --fate off to compare). */
const spoils = arg("spoils", "on") !== "off";
const fate = arg("fate", "on") !== "off";
/** Diplomacy (session 14): the bots make deals with each other (on by default; --diplomacy off to compare). */
const diplomacy = arg("diplomacy", "on") !== "off";
/** Spies (session 15): the Captain hires and sends them (on by default; --spies off to compare). */
const spies = arg("spies", "on") !== "off";
const seedPrefix = arg("seed", "sim");
const settings = { luck, mode, fog, fallen, spoils, fate, diplomacy, spies, ...(turnLimit ? { turnLimit } : {}) };
const botKind = arg("bots", "captain");
const marginArg = arg("chain-margin", "");
/** Tuning the Captain's runaway rule (priority 8): --runaway-share 0.4 --runaway-lead 1.75. */
const runawayTuning = { ...(arg("runaway-share", "") ? { runawayShare: Number(arg("runaway-share", "")) } : {}), ...(arg("runaway-lead", "") ? { runawayLead: Number(arg("runaway-lead", "")) } : {}) };
const makeBot = (kind: string): Bot => {
  // --chain-margin tunes the bot under test (--bots, Captain by default); other bots at a mixed table keep theirs.
  const margin = marginArg && kind === botKind ? Number(marginArg) : null;
  if (kind === "recruit") return makeRecruitBot({ chainMargin: margin ?? 2 });
  if (kind === "captain") return makeCaptainBot({ ...runawayTuning, chainMargin: margin ?? CAPTAIN_CHAIN_MARGIN, off: (arg("captain-off", "") ? arg("captain-off", "").split(",") : []) as CaptainFeature[] });
  // "captain-no-culture" etc.: a Captain with one priority switched off, under its own name (for mixed tables).
  if (kind.startsWith("captain-no-")) return { ...makeCaptainBot({ chainMargin: margin ?? CAPTAIN_CHAIN_MARGIN, off: [kind.slice("captain-no-".length) as CaptainFeature] }), id: kind };
  // "general-push" etc.: a Captain whose Leader's army runs on that standing instruction (session 12).
  if (kind.startsWith("general-")) return makeGeneralSeat(kind.slice("general-".length) as InstructionKind, { chainMargin: margin ?? CAPTAIN_CHAIN_MARGIN });
  throw new Error(`Unknown bot "${kind}" (recruit, captain, captain-no-<priority>, or general-hold|defend|push|raid)`);
};
const mix = arg("mix", "") ? arg("mix", "").split(",").map((k) => k.trim()) : null;
const label = mix ? `mixed table (${mix.join(", ")})` : `${botKind === "captain" ? "Captain" : "Recruit"} bots${marginArg ? ` (chain margin ${marginArg})` : ""}`;

/** Balance experiments: --culture-defense 0.08 (defense per culture level), --culture-costs 3,4,5,6,7. */
const rules = JSON.parse(JSON.stringify(defaultRules)) as typeof defaultRules;
if (arg("culture-defense", "")) rules.culture.defensePerLevel = Number(arg("culture-defense", ""));
if (arg("culture-costs", "")) rules.culture.investCost = arg("culture-costs", "").split(",").map(Number);
/** Any number in the rules: --rules fallen.influenceBase=1,fallen.events.plague.cost=10 (for tuning; dots are the JSON path). */
for (const kv of arg("rules", "").split(",").filter(Boolean)) {
  const [path, value] = kv.split("=");
  const keys = path!.split(".");
  let o = rules as unknown as Record<string, unknown>;
  for (const k of keys.slice(0, -1)) o = o[k] as Record<string, unknown>;
  if (!(keys[keys.length - 1]! in o)) throw new Error(`No rule ${path}`);
  o[keys[keys.length - 1]!] = Number(value);
}
const tuned = arg("culture-defense", "") || arg("culture-costs", "") ? `, culture +${Math.round(rules.culture.defensePerLevel * 100)}%/level costing ${rules.culture.investCost.join("/")}` : "";

function ctxFor(players: number): GameContext {
  const name = arg("map", players > 6 ? "greatmarch" : "embervale");
  const map = maps[name];
  if (!map) throw new Error(`Unknown map. Available: ${Object.keys(maps).join(", ")}`);
  return { map, rules };
}

if (arg("replay", "")) {
  // Both kinds of file: today's save (a snapshot, with the game's history when it has one) and the old "Save this
  // game" file (version 1: the setup and every turn's orders).
  const file = JSON.parse(readFileSync(arg("replay", ""), "utf8")) as SaveFile | SavedGameV1;
  if (file.format !== "conquerra-save") throw new Error("That file isn't a saved Conquerra game.");
  const game =
    file.version === 1
      ? { setup: file.setup, rules: file.rules, turns: file.turns, fingerprint: file.fingerprint }
      : file.history
        ? { ...file.history, fingerprint: stateFingerprint(file.state) }
        : null;
  if (!game) {
    console.log(`This save has no history to play back (it was carried on under newer rules). It's ${(file as SaveFile).summary.mapName}, turn ${(file as SaveFile).state.turn}.`);
    process.exit(1);
  }
  const map = maps[file.mapId];
  if (!map) throw new Error(`Unknown map ${file.mapId}`);
  if ((map.generator?.version ?? null) !== file.mapVersion)
    console.log(`Warning: this game was played on ${map.name} made by map maker v${file.mapVersion}; this copy is v${map.generator?.version}. The replay will go differently.`);
  const ctx: GameContext = { map, rules: game.rules };
  const idx = indexMap(map);
  const names = new Map(game.setup.players.map((p) => [p.id, p.name]));
  const name = (id: string | null) => (id ? (names.get(id) ?? id) : "neutral");
  const place = (id: string) => idx.byId.get(id)?.name ?? id;
  console.log(`Replaying ${game.setup.gameId} on ${map.name}: ${game.setup.players.map((p) => p.name).join(", ")}; ${game.turns.length} turns${file.notes ? ` (${Object.entries(file.notes).map(([k, v]) => `${k} ${v}`).join(", ")})` : ""}`);
  const { matches, state } = replaySavedGame(ctx, game, game.fingerprint, (r) => {
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
/** Rough real-time estimate (Nate, Oct 5): minutes per turn. */
const SOLO_TURN_MIN = 1.5, REPLAY_MIN = 0.5, ONLINE_TURN_MIN = 5;
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
  // Nate's target (Oct 5): games may run up to 30–40 turns.
  const upTo40 = results.filter((g) => g.turns <= 40).length, in30to40 = results.filter((g) => g.turns >= 30 && g.turns <= 40).length;
  const resolve = stats(results.flatMap((g) => g.resolveMs));
  const plan = stats(results.flatMap((g) => g.planMs));
  const total = stats(results.flatMap((g) => g.resolveMs.map((r, i) => r + g.planMs[i]!)));

  console.log(`\n=== ${players} players — ${ctx.map.name}, ${label}, luck ${luck}, ${mode}${turnLimit ? ` (${turnLimit} turns)` : ""}, fog ${fog ? "on" : "off"}, the Fallen ${fallen ? "on" : "off"}, Spoils ${spoils ? "on" : "off"}, Fate ${fate ? "on" : "off"}, diplomacy ${diplomacy ? "on" : "off"}, spies ${spies ? "on" : "off"}${tuned} ===`);
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
  console.log(`Game length (turns): avg ${avg((g) => g.turns).toFixed(1)}, median ${turns[Math.floor(turns.length / 2)] ?? "-"}, min ${turns[0] ?? "-"}, max ${turns[turns.length - 1] ?? "-"}; ${pct(upTo40)} within 40, ${pct(in30to40)} in 30–40`);
  // Real time, roughly: a typical single-player turn takes about 1.5 minutes to plan plus about half a minute of
  // replay; a live online game with the 5-minute timer, about 5.5 minutes a turn if people use most of the timer.
  const t = avg((g) => g.turns);
  console.log(`Real time, roughly: single player about ${Math.round(t * (SOLO_TURN_MIN + REPLAY_MIN))} minutes (${SOLO_TURN_MIN} min a turn + ${REPLAY_MIN} min replay); live online with the 5-minute timer up to about ${((t * (ONLINE_TURN_MIN + REPLAY_MIN)) / 60).toFixed(1)} hours`);
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
  const won = results.filter((g) => g.winner !== "draw");
  const half = won.filter((g) => g.leaderHalfway !== null);
  const long = won.filter((g) => g.leaderTurn10 !== null);
  console.log(`Runaway, two clearer measures: the leader at the halfway point went on to win ${pct2(half.filter((g) => g.leaderHalfway === g.winner).length, half.length)} of games; comebacks (the winner was not the leader after turn 10) ${pct2(long.filter((g) => g.leaderTurn10 !== g.winner).length, long.length)} of games that went past turn 10`);
  if (fallen) {
    const withEvents = results.filter((g) => g.worldEvents > 0);
    const judged = results.filter((g) => g.winnerHitHardest !== null);
    console.log(`The Fallen: ${avg((g) => g.worldEvents).toFixed(1)} world events per game (${avg((g) => g.worldEventsFailed).toFixed(1)} pledges came to nothing); events in ${pct(withEvents.length)} of games; the eventual winner was the player hit hardest in ${pct2(judged.filter((g) => g.winnerHitHardest).length, judged.length)} of games with events`);
  }
  if (spoils || fate) {
    // How often the decks decided a game (session 13).
    const fmt = (x: number) => x.toFixed(1);
    if (spoils) {
      const judged = won.filter((g) => g.winnerLeadOnSet !== null);
      const chance = won.filter((g) => g.winnerSetTurnShare !== null);
      console.log(
        `Spoils: ${fmt(avg((g) => g.spoilsSets))} sets turned in per game (${fmt(avg((g) => g.spoilsAuto))} by the game at the hand limit); the winner took the lead for good on a turn it turned in a set in ${pct2(judged.filter((g) => g.winnerLeadOnSet).length, judged.length)} of games (by chance: ${(100 * (chance.reduce((a, g) => a + g.winnerSetTurnShare!, 0) / Math.max(1, chance.length))).toFixed(0)}%)`,
      );
    }
    if (fate) {
      const shares = won.filter((g) => g.winnerGoodShare !== null);
      const lucky = won.filter((g) => g.winnerLuckiest !== null);
      console.log(
        `Fate: ${fmt(avg((g) => g.fateEvents))} events per game (${fmt(avg((g) => g.fateGood))} good and ${fmt(avg((g) => g.fateBad))} bad on players' land, ${fmt(avg((g) => g.fateStrong))} strong), ${fmt(avg((g) => g.missionsDrawn))} missions drawn, ${fmt(avg((g) => g.missionsDone))} done`,
      );
      const share = (f: (g: GameSummary) => number) => (100 * (shares.reduce((a, g) => a + f(g), 0) / Math.max(1, shares.length))).toFixed(0);
      const luck = won.filter((g) => g.winnerLuck !== null);
      console.log(
        `Fate and the winner: the winner got ${share((g) => g.winnerGoodShare!)}% of the good events, against ${share((g) => g.winnerLandShare!)}% of the land they could land on (its fair share); its luck beyond its land: ${(luck.reduce((a, g) => a + g.winnerLuck!, 0) / Math.max(1, luck.length)).toFixed(2)} events a game; it was the luckiest player in ${pct2(lucky.filter((g) => g.winnerLuckiest).length, lucky.length)} of games (by chance ${(100 / players).toFixed(0)}%); missions done: the winner ${fmt(won.reduce((a, g) => a + g.winnerMissions, 0) / Math.max(1, won.length))}, the others ${fmt(won.reduce((a, g) => a + g.othersMissions, 0) / Math.max(1, won.length))} each`,
      );
    }
  }
  if (spies) {
    const tries = avg((g) => g.spyIn + g.spyFooled + g.spyBlocked + g.spyKilled);
    console.log(
      `Spies: ${avg((g) => g.spiesHired).toFixed(1)} hired per game (${pct(results.filter((g) => g.spiesHired > 0).length)} of games); attempts per game ${tries.toFixed(1)}: infiltrated ${avg((g) => g.spyIn).toFixed(2)}, blocked ${avg((g) => g.spyBlocked).toFixed(2)}, killed ${avg((g) => g.spyKilled).toFixed(2)}, fooled ${avg((g) => g.spyFooled).toFixed(2)}; spy gold per game (hire + upkeep) ${avg((g) => g.spyGold).toFixed(1)}`,
    );
  }
  if (diplomacy) {
    const sum = (f: (g: GameSummary) => number) => results.reduce((a, g) => a + f(g), 0);
    const offers = sum((g) => g.offers);
    const kinds = ["truce", "trade", "war", "passage"].map((k) => `${k} ${(sum((g) => g.dealsByKind[k] ?? 0) / Math.max(1, results.length)).toFixed(1)}`).join(", ");
    console.log(
      `Diplomacy: ${avg((g) => g.offers).toFixed(1)} offers between bots per game, ${pct2(sum((g) => g.accepted), offers)} accepted, ${pct2(sum((g) => g.countered), offers)} countered; ${avg((g) => g.dealsMade).toFixed(1)} deals made per game (${kinds}; ${avg((g) => g.dealsBinding).toFixed(1)} binding), ${avg((g) => g.dealsBroken).toFixed(2)} broken; joint wars against the player then holding the most land: ${avg((g) => g.warsVsLeader).toFixed(2)} per game; marches through a partner's land: ${avg((g) => g.marchesThrough).toFixed(2)} per game`,
    );
    const want = Number(arg("reasons", "0"));
    if (want > 0) {
      const lines = results.flatMap((g) => g.reasons.map((r) => `  [${g.seed}] ${r}`));
      const step = Math.max(1, Math.floor(lines.length / want));
      console.log(["Sample reason lines:", ...lines.filter((_, i) => i % step === 0).slice(0, want)].join("\n"));
    }
  }
  console.log(`CPU per turn (this machine): resolve avg ${ms(resolve.avg)}, p95 ${ms(resolve.p95)}, worst ${ms(resolve.max)} | bots planning (all seats) avg ${ms(plan.avg)}, worst ${ms(plan.max)} | total avg ${ms(total.avg)}, worst ${ms(total.max)}`);
  if (errors.length) {
    console.log(`CRASHES (first 3):`);
    for (const e of errors.slice(0, 3)) console.log(`  seed ${e.seed}:\n${e.error}`);
  }
}
if (crashed) process.exit(1);
