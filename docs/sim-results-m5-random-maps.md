# Sim results, M5: random maps (session 30, Oct 15)

*All-Marshal tables (personalities dealt from each game's seed), fog on, the Fallen, Spoils, Fate, diplomacy and spies on, one game per map. 100 seeds a size in a row (`seedWords(0..99)`), the five shapes in turn (island, archipelago, twin continents, crescent, inland sea). Run with `npx tsx apps/sim/scripts/s30-sims.ts --random <size>:all:100 <players> --seed s30r` (19 processes on Nate's laptop). Raw numbers: this file; the script prints the same lines.*

## How the seeds fared

A seed gets six tries (the first and five rerolls) to pass `checkMap`, the map maker's fair capital layouts for every table size the map suits, and the exposure band (no spot more than 5.5 times as exposed as the safest: no worse than the worst layout among the twelve official maps). Then the player reads "That seed didn't make a fair map. Try another."

| Size | Players simmed | Seeds that made a map | Crescents that did | Time a game (map made + played, one process) |
|---|---|---|---|---|
| 40 | 4 | 86 of 100 | 11 of 20 | 6.5 s |
| 80 | 4 | 83 | 8 of 20 | 15.7 s |
| 120 | 6 | 83 | 7 of 20 | 26.7 s |
| 200 | 8 | 76 | 7 of 20 | 75 s |

Crescents fail most (a scrap of land cut off with no ordinary border to join a province by, or no fair layout at 5+ players). The other four shapes pass 80 to 100% of seeds.

## Win rates

"By seat" is the seat's number (seats are dealt to capital spots at random, so it's mostly noise at this many games: one standard error is about 4.5 points at 4 players). "By exposure" ranks each game's winner's capital spot in its layout by the map maker's exposure check, safest first: this is the measure of whether random maps are fair.

| Size | Fair | By seat | Furthest from fair | By exposure (safest first) | Furthest from fair |
|---|---|---|---|---|---|
| 40, 4 players | 25.0% | 23.3 / 30.2 / 26.7 / 19.8 | 5.2 | 30.2 / 20.9 / 25.6 / 23.3 | 5.2 |
| 80, 4 players | 25.0% | 20.5 / 21.7 / 38.6 / 19.3 | 13.6 | 37.3 / 22.9 / 26.5 / 13.3 | 12.3 |
| 120, 6 players | 16.7% | 16.9 / 20.5 / 18.1 / 14.5 / 9.6 / 20.5 | 7.0 | 19.3 / 14.5 / 19.3 / 19.3 / 16.9 / 10.8 | 5.9 |
| 200, 8 players | 12.5% | 11.8 / 15.8 / 11.8 / 10.5 / 7.9 / 15.8 / 10.5 / 15.8 | 4.6 | 23.7 / 15.8 / 14.5 / 13.2 / 3.9 / 5.3 / 17.1 / 6.6 | 11.2 |

**The harder spots** (a random map's layout marks the spots at least 1.5 times as exposed as its middle spot, a third of the table at most; the seat rule deals them to bots before people):

| Size | Maps with a harder spot | Harder spots' wins | Their fair share |
|---|---|---|---|
| 40 | 24 of 86 | 12.5% | 25.0% |
| 80 | 10 of 83 | 0.0% | 25.0% |
| 120 | 21 of 83 | 4.8% | 21.4% |
| 200 | 20 of 76 | 5.0% | 15.0% |

**Against the ±5 bar** (the seat rule's write-up): 40 territories is inside it (5.2 at most), 120 just outside (5.9), 80 and 200 well outside (12.3 and 11.2): the safest spot wins about one and a half to two times its share, the most exposed about half.

**Is a start bonus wanted?** Yes, by these numbers: the marked harder spots win 0 to 12.5% of games against a fair 15 to 25%, as the official maps' weak spots did before session 23's bonus (which gives them +2 to +6 troops). The seat rule already keeps a person off them; the bots that sit there lose more than their share. Two ways, for the orchestrator: (1) a start bonus on a random map's harder spots (+4 is the official maps' middle; one rule for every random map, no per-map sims), or (2) a tighter exposure band at generation (3.0 instead of 5.5: fairer layouts, but more seeds fail, roughly another one in five at 80 and up, measured by the twelve's own layouts: nine in ten within 4.0, the median 2.3).

## Game length

| Size | Avg turns | Median | Within 40 | Ended by the 60-turn cap |
|---|---|---|---|---|
| 40, 4 players | 19.7 | 19 | 99% | 1% |
| 80, 4 players | 26.3 | 24 | 95% | 1% |
| 120, 6 players | 35.0 | 33 | 73% | 7% |
| 200, 8 players | 44.0 | 43 | 46% | 20% |

By shape the inland sea and the island run longest (120: 37.6 and 37.8 turns; 200: 46.5 and 42.2), the crescent shortest. **200 territories at 8 players runs long** (only 46% within 40 turns): the lobby suggests 7 to 10 players there and Conquest from big tables (`conquestSuggestedFromPlayers`), which caps it at 20 turns; a Classic game at 8 on a 200 random map will often be a long one. Nate's own games run far shorter than the bots' (his note), so this is a ceiling, not a forecast.

## The twelve official maps, before and after

The stage split leaves the twelve exactly as they were: the same committed files (a test pins each map's fingerprint), and the same games. `npx tsx apps/sim/scripts/s30-sims.ts --digest 4 20 --seed s30d` (20 all-Marshal games on each official map, 4 players) gives the same digest before session 30's Part 2, after Part 3 and after Part 4: **`dc8962d4f8ba3bc6`**; `pnpm sim --bots marshal --players 4 --games 60 --seed s29` and `--bots captain --players 6` give the same games, seats and deals as session 29's (Marshal 23.8 turns, seats 20/20/35/25%).

## Blackout fog against standard fog

300 all-Marshal games each (`--fog blackout` and `--fog on`, seed `s30b`): **Embervale 4: 23.1 turns, 96% within 40, seats 21.3 / 22.3 / 24.7 / 31.7%** (furthest from fair 6.7); **Wyrmland 6: 39.9 turns, 62% within 40, 11% at the 60-turn cap, seats 17.7 / 16.3 / 13.0 / 21.0 / 17.3 / 14.7%** (4.3 off). Blackout and standard fog give **the same games, game for game**: blackout changes only what a view shows, the bots read the map's shape from the map as they always have, and fogged land with no memory looks the same to them either way. So the bots don't stall; they also don't explore. Whether they should is a design call (a person under blackout knows less than a bot does).

## Session 31 (Oct 16): the start bonus and the tighter band

*The orchestrator's call from the table above (Nate can overrule): a random map's harder spots start with **+4 troops** (the official maps' middle bonus, session 23), and the exposure band at generation tightens from **5.5 to 4.0**. Both are **random map version 3**: a game pins its map's version, and version 2 (session 30's: 5.5, no bonus) still builds exactly as before, so games already running keep their maps. Same run as above: 100 seeds a size (`seedWords(0..99)`), the five shapes in turn, all Marshals, `--seed s30r`, 19 processes. The twelve official maps are untouched: the 240-game digest is still **`dc8962d4f8ba3bc6`**.*

**Version 3 as shipped** (the bonus, the band of 4.0, and the fatter crescent below):

| Size | Seeds that made a map | Crescents | By exposure (safest first) | Furthest from fair | Harder spots' wins (fair) | Avg turns (within 40) |
|---|---|---|---|---|---|---|
| 40, 4 players | 83 of 100 | 17 of 20 | 27.7 / 28.9 / 25.3 / 18.1 | 6.9 | 17.6% (25.0) | 21.7 (98%) |
| 80, 4 players | 70 | 14 of 20 | 31.4 / 27.1 / 24.3 / 17.1 | 7.9 | 20.0% (25.0) | 24.9 (97%) |
| 120, 6 players | 91 | 20 of 20 | 29.7 / 8.8 / 15.4 / 17.6 / 15.4 / 13.2 | 13.0 | 13.6% (19.7) | 36.9 (69%) |
| 200, 8 players | 72 | 14 of 20 | 25.0 / 18.1 / 11.1 / 8.3 / 11.1 / 6.9 / 11.1 / 8.3 | 12.5 | 0.0% (16.4) | 44.7 (38%) |

**Before the crescent change** (the bonus and the band of 4.0 alone): 72, 60, 75 and 63 maps; by exposure 4.2, 10.0, 10.0 and 12.9 points off; crescents 6, 4, 4 and 5 of 20.

**The band at 3.0** for the sizes still outside ±5 (80, 120, 200), as asked: **80 made a map from only 17 seeds of 100** (by exposure 29.4 / 17.6 / 29.4 / 23.5, too few games to read), **120 from 53** (7.3 off), **200 from 39** (10.6 off). No size comes inside the bar and most seeds fail, so the band stays at **4.0 for every size**.

**What the numbers say:**
- **The harder spots do better with the bonus** at 40, 80 and 120 (17.6, 20.0 and 13.6% against 12.5, 0 and 4.8% in session 30), short of their fair share. At 200 they still won none of 16 games.
- **The bar is still missed, and the reason is the safest spot, not the harder ones.** By exposure the safest spot wins 27.7, 31.4, 29.7 and 25.0% against a fair 25, 25, 16.7 and 12.5: about 1.1 times its share at 4 players and up to twice it at 8. A bonus on the most exposed third of the table doesn't reach that. One standard error is about 4 to 5 points at these game counts, so a single size moves a few points from run to run (40 read 4.2 off before the crescent change and 6.9 after, with almost the same maps); the safest spot's lead shows at every size in every run.
- **The tighter band costs seeds:** one in six to three in ten seeds now gives "That seed didn't make a fair map. Try another." (session 30: one in six to one in four). 120 fares best (9 in 100) since its crescents now always pass.
- **For the orchestrator:** the next lever is a graded head start by exposure rank (every spot but the safest gets something, the most exposed the most) rather than a tighter band. That's a balance session with its own sims.

**Crescents (Step 0's small fix):** at version 3 a crescent's bay is smaller and a little further off centre (0.5 of the land's size instead of 0.7, offset 0.5 instead of 0.4), with one isle in it instead of two, sea lanes up to 1.6 times as long (to reach across the bay), and one choke point for every 18 territories asked for (at least 4) instead of one for every 12. Tried on 24 seeds a size with `scripts/try-random.ts`'s way: **80 of 96 pass** at the band of 4.0 (40: 20, 80: 20, 120: 21, 200: 19 of 24), about 6.7 seeds in 8, against 2.5 in 8 with session 30's crescent at the same band. The 100-seed run above agrees (65 of 80). Five other variants were tried first (no isles, a bay of 0.45 to 0.6, rougher and smoother coasts); the sea lanes and choke points were what failed most. Official crescents (The Moon Coast) are unchanged.

## Session 33 (Oct 18): the graded head start

*Nate's call (Oct 16): a head start graded by exposure rank, every spot but the safest gets something, the most exposed the most. **Random map version 4** (`packages/content/data/random-maps.json`): the band stays 4.0, so the same seeds pass and the land is the same as at version 3; only the troops differ. For each layout the spots are ranked by the map maker's exposure check; a spot more exposed than the safest (exposure e, the safest's e₀) gets `round(k × (e − e₀) / e₀)` extra troops, at least 1, at most 6 (the official maps' top bonus). The harder spots (the most exposed third, for the seat rule: bots take those first) are as before. All Marshals, one game a map, the five shapes in turn, maps `seedWords(0..299)`, seed `s33`: `docs/sims/run-s33-random.sh <tag> <start> <count> --grade '{"k":8}'` (or `--version 3`), put together with `npx tsx apps/sim/scripts/s33-combine.ts <tag>`; each run's games are in `docs/sims/s33-random-*.json`.*

**First, the noise.** At 100 maps a size (about 70 to 90 games once the failing seeds are out) one standard error on a rank's win rate is about 4.5 points at 4 players, so the ±5 bar is about one standard error, and two settings can't be told apart. Worse, the maps themselves vary a lot: on maps 0 to 99 k = 5 and version 3 gave almost the same 40-territory table (27.7 / 33.7 / 20.5 / 18.1 against 28.9 / 33.7 / 19.3 / 18.1), and maps 100 to 299 favoured the safest spot much more for both. So every setting below is on **the same 300 maps a size** (200 to 270 games), and "on average" (the mean distance from fair over the ranks) is read beside "furthest", which one unlucky rank decides.

**By exposure rank (safest first) against fair, 300 maps a size:**

| Setting | 40, 4 players (fair 25) | 80, 4 players (25) | 120, 6 players (16.7) | 200, 8 players (12.5) |
|---|---|---|---|---|
| version 3 (+4 on the harder spots) | 36.7 / 28.2 / 18.1 / 16.9: **11.7** furthest, 7.5 on average | 40.6 / 21.7 / 23.7 / 14.0: **15.6**, 7.8 | 26.7 / 21.6 / 18.7 / 15.8 / 9.5 / 7.7: **10.1**, 5.7 | 23.8 / 17.5 / 12.1 / 10.8 / 15.2 / 8.5 / 4.9 / 7.2: **11.3**, 4.8 |
| k = 5 | 37.1 / 31.0 / 15.3 / 16.5: **12.1**, 9.1 | 35.7 / 28.0 / 19.3 / 16.9: **10.7**, 6.9 | 22.7 / 20.5 / 16.1 / 17.9 / 12.1 / 10.6: **6.0**, 3.7 | 23.0 / 13.5 / 9.5 / 16.7 / 11.7 / 8.6 / 8.1 / 9.0: **10.5**, 3.9 |
| **k = 8 (shipped)** | 29.4 / 29.0 / 23.0 / 18.5: **6.5**, 4.2 | 38.6 / 26.6 / 16.4 / 18.4: **13.6**, 7.6 | 23.8 / 23.1 / 15.8 / 12.8 / 13.2 / 11.4: **7.1**, 4.5 | 19.7 / 17.5 / 13.5 / 13.9 / 11.7 / 8.1 / 7.2 / 8.5: **7.2**, 3.6 |

k = 3 (the brief's first setting) was run on maps 0 to 99 only: 8.7 / 13.6 / 6.8 / 6.9 furthest, between version 3 and k = 5 where the two can be told apart; its extension to 300 maps was stopped for time once k = 5 and k = 8 showed bigger was better.

**The head start each rank got** (average troops, safest first): **k = 8:** 40: 0 / 2.5 / 4.3 / 5.4; 80: 0 / 2.4 / 3.7 / 5.0; 120: 0 / 2.2 / 3.5 / 4.3 / 5.1 / 5.6; 200: 0 / 2.1 / 3.2 / 4.0 / 4.7 / 5.3 / 5.7 / 5.9. **k = 5** (maps 100 to 299): 40: 0 / 1.8 / 3.3 / 4.6; 200: 0 / 1.5 / 2.2 / 2.7 / 3.4 / 4.1 / 4.9 / 5.5. **Version 3:** only a marked harder spot, +4 (on average 0.5 troops for the most exposed rank at 40, 1.5 at 200, since many maps mark none).

| Setting | Harder spots' wins (fair) at 40 / 80 / 120 / 200 | Avg turns at 40 / 80 / 120 / 200 |
|---|---|---|
| version 3 | 7.7% (25) / 0.0% (25) / 8.2% (19) / 1.4% (16) | 21.7 / 26.1 / 36.0 / 44.6 |
| k = 5 | 7.7% / 7.1% / 4.9% / 12.3% | 20.8 / 26.6 / 37.1 / 45.0 |
| k = 8 | 10.3% / 14.3% / 9.8% / 8.2% | 20.7 / 26.6 / 37.4 / 46.1 |

**Against the middle spot instead** (the brief's fallback, since with k = 8 the safest spot still leads at 200: 19.7% against 12.5%): only the spots above the middle get a start (on average 0 / 0 / 0 / 0 / 0 / 1.2 / 2.0 / 3.3 troops at 200), so the safest spot's nearest rivals get nothing. 200 territories, the same 300 maps: 20.6 / 10.8 / 15.7 / 12.1 / 15.7 / 9.4 / 9.0 / 6.7, **8.1** furthest, 3.6 on average, the harder spots 2.7% of their games (fair 15.6). Graded from the safest wins (7.2, 3.6, 8.2%), so that's what ships.

**Shipped: version 4, k = 8, at least 1, at most 6, graded from the safest spot.** The lobby's random-map card says "Exposed spots start with extra troops (up to 6)."; the first turn's report says yours and everyone else's ("Head starts for the exposed spots: Kit +5, Lady Morwen +2."). Versions 2 and 3 still build exactly their maps (a test pins a seed of each, taken before the session), so running games and saves keep theirs.

**What the numbers say:**
- **No setting brings every size inside ±5.** k = 8 is the best overall (on average 4.2 / 7.6 / 4.5 / 3.6 points from fair, against version 3's 7.5 / 7.8 / 5.7 / 4.8) and the only one within about 7 at three sizes; the furthest rank is still 6.5, 13.6, 7.1 and 7.2.
- **80 territories at 4 players is the stubborn one:** the safest spot wins 36 to 41% whatever the others get (version 3, k = 5, k = 8). Why: a spot is "safe" because it has the most room (land nearest to it, within four steps) and the fewest rivals close by. Room is income every turn for the whole game; a head start is troops once, on turn 1. Troops close the gap where the game is short and crowded (40 territories, 4 players: half the gap closed) and on big tables where one safe spot is one of eight; they can't buy back room on a roomy 4-player map.
- **The harder spots win more with the grade** (k = 8: 8 to 14% of their games against version 3's 0 to 8%), still short of their share.
- **Turns** are about the same (k = 8 within 1.5 turns of version 3 at every size: a turn shorter at 40, up to 1.5 longer at 120 and 200).
- **Seeds:** the band is unchanged, so the same seeds pass as at version 3 (session 31: one in six to three in ten fail; the lobby rerolls by itself since session 32).
- **The twelve official maps are unchanged:** the 240-game digest is still `dc8962d4f8ba3bc6` (below, the guardrails).

**For the orchestrator:** the next lever for the roomy 4-player sizes isn't more troops. Options: a tighter band at 80 only (session 31's 3.0 cost most seeds), a fairer layout rule for 4 players (room within a band, not only exposure), or a lasting head start (a market or a level of culture at the exposed capitals, income instead of troops). Each is a new version and its own sim.

**The orchestrator's re-run (Oct 18, its own seed `o12r`, 100 maps at 40 territories, 4 players, all Marshals, 83 played):** by exposure rank 22.9 / 30.1 / 21.7 / 25.3 (furthest 5.1, 2.9 on average), the head start 0 / 2.7 / 4.5 / 5.6 a rank, the harder spots 11.8% of their games, 22.3 turns. Within noise of the session's 300-map table (one standard error at 100 maps is about 4.5 points), and the head starts match. **Nate's calls (Oct 18):** version 4 stands; an income head start for the exposed spots is tried in session 33b against the same 300 maps, and random maps get sizes 300 and 400 in the same session.

## Session 33b (Oct 19): the income head start

*Nate's call (Oct 18): the most exposed capitals earn more, since their gap is room (income every turn), not troops on turn 1. **Random map version 5** (`packages/content/data/random-maps.json`): version 4's troops stay (k = 8, at least 1, at most 6), the band stays 4.0 (the same seeds pass, the same land), and a `start` block adds an income head start at the capital, finished on turn 1. All Marshals, one game a map, on **session 33's own 300 maps a size with its own game seeds** (`seedWords(0..299)`, seed `s33`), so each game pairs with session 33's k = 8 game on the same map: `docs/sims/run-s33b-random.sh <tag> --version 5 --income '<start block>'`, tabled with `npx tsx apps/sim/scripts/s33-combine.ts --prefix s33b <tag>`; every game is in `docs/sims/s33b-random-*.json`.*

**By exposure rank (safest first) against fair, furthest from fair and on average** (the session 33 row is the same maps and game seeds without the income head start):

| Setting | 40, 4 players (fair 25) | 80, 4 players (25) | 120, 6 players (16.7) | 200, 8 players (12.5) |
|---|---|---|---|---|
| session 33, k = 8 (troops only) | 29.4 / 29.0 / 23.0 / 18.5: **6.5**, 4.2 | 38.6 / 26.6 / 16.4 / 18.4: **13.6**, 7.6 | 23.8 / 23.1 / 15.8 / 12.8 / 13.2 / 11.4: **7.1**, 4.5 | 19.7 / 17.5 / 13.5 / 13.9 / 11.7 / 8.1 / 7.2 / 8.5: **7.2**, 3.6 |
| 1: a market, the more exposed half | 23.4 / 29.4 / 24.6 / 22.6: **4.4**, 2.2 | 34.8 / 24.2 / 24.6 / 16.4: **9.8**, 4.9 | 25.6 / 21.6 / 13.2 / 14.3 / 12.1 / 13.2: **9.0**, 4.6 | 21.1 / 13.0 / 9.9 / 13.5 / 13.9 / 12.6 / 9.9 / 6.3: **8.6**, 2.9 |
| 2: a market, every spot but the safest | 24.2 / 30.6 / 25.8 / 19.4: **5.6**, 3.2 | 31.9 / 30.9 / 16.9 / 20.3: **8.1**, 6.4 | 18.3 / 22.7 / 19.4 / 15.4 / 13.2 / 11.0: **6.0**, 3.5 | 19.7 / 14.8 / 10.8 / 15.2 / 14.3 / 12.1 / 7.6 / 5.4: **7.2**, 3.5 |
| **3: a market and culture 1, the more exposed half (shipped)** | 26.2 / 25.4 / 26.6 / 21.8: **3.2**, 1.6 | 34.8 / 26.6 / 18.4 / 20.3: **9.8**, 5.7 | 22.8 / 22.1 / 15.4 / 16.2 / 10.7 / 12.9: **6.1**, 3.8 | 17.0 / 13.9 / 14.3 / 12.1 / 15.2 / 13.9 / 8.5 / 4.9: **7.6**, 3.0 |
| 4: a market for every spot but the safest, culture 1 for the more exposed half | 26.6 / 26.6 / 23.4 / 23.4: **1.6**, 1.6 | 33.8 / 26.6 / 19.3 / 20.3: **8.8**, 5.2 | 21.2 / 26.7 / 16.1 / 13.2 / 12.8 / 9.9: **10.1**, 4.9 | 19.4 / 15.8 / 12.6 / 11.3 / 14.4 / 12.6 / 7.7 / 6.3: **6.9**, 3.1 |

"The more exposed half" is the ranks above the middle (2 and 3 of 4, 3 to 5 of 6, 4 to 7 of 8). Games: 248 / 207 / 273 / 223 a size (the seeds that made a map), the same in every row.

| Setting | Harder spots' wins (fair) at 40 / 80 / 120 / 200 | Avg turns at 40 / 80 / 120 / 200 | Over before the 60-turn cap |
|---|---|---|---|
| session 33, k = 8 | 10.3% (25) / 14.3% (25) / 9.8% (19) / 8.2% (16) | 20.7 / 26.6 / 37.4 / 46.1 | 99 / 99 / 91 / 76% |
| 1 | 15.4% / 14.3% / 9.8% / 5.5% | 21.0 / 26.3 / 36.1 / 45.2 | 99 / 99 / 93 / 79% |
| 2 | 15.4% / 14.3% / 9.8% / 1.4% | 22.1 / 26.8 / 36.1 / 44.9 | 98 / 98 / 94 / 78% |
| **3 (shipped)** | 17.9% / 21.4% / 8.3% / 5.5% | 20.8 / 25.8 / 36.7 / 45.3 | 100 / 99 / 90 / 77% |
| 4 | 20.5% / 7.1% / 13.1% / 4.1% | 21.1 / 25.7 / 35.4 / 44.2 | 100 / 99 / 95 / 76% |

**The head start each rank got** is the same troops in every row (40: 0 / 2.5 / 4.3 / 5.4; 80: 0 / 2.4 / 3.7 / 5.0; 120: 0 / 2.2 / 3.5 / 4.3 / 5.1 / 5.6; 200: 0 / 2.1 / 3.2 / 4.0 / 4.7 / 5.3 / 5.7 / 5.9), and the market (and culture) went to every spot of the ranks the setting names, on every map (100% of them; none elsewhere). A market is +2 gold a turn while the capital holds (a building the capital could have bought for 6 gold); culture 1 is +1 gold a turn and +6% defence there.

**Shipped: version 5, setting 3.** The more exposed half of the table start with a market and a level of culture at their capital, on top of version 4's troops. It is the best or the joint best on "furthest from fair" at every size (3.2 / 9.8 / 6.1 / 7.6) and the best on average over the four sizes (3.5 points, against 3.7 for settings 1 and 4, 4.2 for 2, and 5.0 for session 33's troops alone). The lobby's card says "Exposed spots start with extra troops (up to 6), the most exposed with a market and a level of culture."; turn 1's report says yours ("Stoneshire starts with 6 extra troops, a market and a level of culture (an exposed spot).") and everyone else's ("Head starts for the exposed spots: Baron Krell +2, Queen Isolde +2. Queen Isolde also starts with a market and a level of culture.", as seen live; the first version said "Queen Isolde +2 with a market...", which read as if both had one, and was changed in Part 2); the capital's card shows the market as any building.

**What the numbers say:**
- **40 territories is inside ±5 now** (3.2 at most, 1.6 on average; it was 6.5 and 4.2). **120 and 200 are closer** (6.1 and 7.6 at the furthest rank, 3.8 and 3.0 on average) but one rank still sits a little outside: the most exposed at 200 (4.9% against 12.5) and the 5th of 6 at 120.
- **80 territories at 4 players is still outside, and no setting brought it in.** The safest spot wins 32 to 35% under every setting (38.6% with troops alone): the income head start takes about 4 points off it, and a market for the second safest spot too (setting 2) only moves the lead to that spot (31.9 / 30.9). What the safest spot still has is room: on a roomy 4-player map it has the most land it can take without a fight, so it grows fastest for the whole game, and +3 gold a turn at two rivals' capitals is a few points of that. The next levers are the layout itself (a rule that the four spots' room is within a band, not only their exposure) or a size-specific band at 80; both are a new version and their own sims.
- **The harder spots win more** at 40 and 80 (17.9% and 21.4% of their games, against 10.3% and 14.3% with troops alone), still short of 25%.
- **Turns barely move** (within a turn of session 33's at every size).
- **Noise:** one standard error on a rank's win rate is about 3 points at 4 players with 200 to 250 games. The rows share maps and game seeds, so they're closer than that to each other, but a single rank still moves a few points between settings; read "on average" beside "furthest".

## Session 33b (Oct 19): 300 and 400

*Nate's call (Oct 18): random maps of 300 and 400 territories, for session 34's 10-player tables and the battle royale later. New in version 5 (no game was made on one before, so their recipe can differ from the smaller sizes' without a new version): 300 suits 4 to 10 players (8 to 10 suggested), 400 suits 6 to 10 (10 suggested). All Marshals with version 5's head start, 100 maps a run (`seedWords(0..99)`, the five shapes in turn), one game each, seed `s33b`: `docs/sims/run-s33b-sizes.sh`, tabled with `s33-combine.ts --prefix s33b big bigbo`; every game in `docs/sims/s33b-random-big*-*.json`.*

**How the seeds fare** (10 seeds of each shape a size, `scripts/try-random.ts 10 300,400`; six tries a seed, the band 4.0):

| | 300 | 400 |
|---|---|---|
| As the smaller sizes are made (20 layout starts, a range per 28 territories) | 31 of 50 pass | 22 of 50 |
| **60 layout starts and at most 10 ranges (shipped)** | **42 of 50** (island 9, archipelago 8, twins 6, crescent 9, inland 10) | **42 of 50** (island 10, archipelago 5, twins 9, crescent 9, inland 9) |
| The sims' own 100 seeds (shipped) | 90 of 100 | 80 of 100 |

Why tries were rejected, before: mostly **no fair capital layout for 8 to 10 players** (the layout search gave up in a local best after its 20 random starts, not for want of a fair layout), then **a territory with no border to join a province by** (a small island, or a cluster of islets linked only to each other, that no sea lane reaches) and **a pass too narrow** (14 ranges at 400, each with passes). After: narrow passes and unreached islets are most of what's left, and the **archipelago at 400** is the weak shape (5 of 10: the exposure band and too few choke points between its 14 big islands). Overall 16% of seeds fail at both sizes, under the three in ten the brief set; the band stays 4.0 at both. For the orchestrator: the 400 archipelago could ask for fewer choke points, or more islands; not done here.

**By exposure rank (safest first) against fair, version 5's head start:**

| Size, players | Games | By exposure | Furthest from fair | On average | Harder spots' wins (fair) |
|---|---|---|---|---|---|
| 300, 8 (fair 12.5) | 90 | 17.8 / 8.9 / 15.6 / 10.0 / 12.2 / 20.0 / 11.1 / 4.4 | 8.1 | 4.0 | 7.1% (16.1) |
| 300, 10 (fair 10) | 90 | 12.2 / 13.3 / 7.8 / 11.1 / 10.0 / 13.3 / 8.9 / 11.1 / 5.6 / 6.7 | **4.4** | 2.2 | 6.5% (12.3) |
| 400, 10 (fair 10) | 80 | 12.5 / 8.8 / 13.8 / 12.5 / 8.8 / 12.5 / 13.8 / 7.5 / 2.5 / 7.5 | 7.5 | 3.0 | 10.0% (12.3) |
| 400, 10, blackout | 80 | 11.3 / 17.5 / 16.3 / 18.8 / 8.8 / 3.8 / 6.3 / 8.8 / 1.3 / 7.5 | 8.8 | 4.8 | 10.0% (12.3) |

The head start by rank: 300 at 8, 0 / 1.7 / 2.6 / 3.4 / 3.9 / 4.8 / 5.4 / 5.7 troops; at 10 and 400 at 10, 0 to 5.9; the market and culture on the more exposed half (every map). **300 at 10 is inside ±5; 300 at 8 and 400 at 10 are inside on average (4.0 and 3.0 points) but one rank sits outside** (at 8, the 6th spot at 20% and the most exposed at 4.4%; at 400, the 9th at 2.5%). One standard error at 80 to 90 games is about 3.2 to 3.5 points at these shares, so one rank 7 or 8 points off is about two errors: worth watching, not yet a pattern (at 300 with 10 the same ranks are within 4.4).

**Turns** (the sim's cap is 60; Classic, all Marshals):

| Size, players | Avg | Median | Within 40 | Over before the cap |
|---|---|---|---|---|
| 300, 8 | 45.7 | 46 | 39% | 72% |
| 300, 10 | 49.7 | 52 | 26% | 64% |
| 400, 10 | 52.0 | 58 | 19% | 58% |
| 400, 10, blackout | 55.9 | 60 | 5% | 43% |

**A Classic 400 at 10 runs long:** 52 turns on average with 42% of games stopped by the 60-turn cap (under blackout 56, more than half at the cap), so its true average is past 60 under blackout and close to it with standard fog. Nate's rule is 30 to 40 turns. **The lever already in place: Conquest** (a turn limit, highest score wins), which the lobby suggests from 8 players, so a 300 or a 400 at its suggested table starts as Conquest with 20 turns. A Classic big game is the player's choice, and the card says so: "A long game in Classic: plan on 50 turns or more." Proposed for the orchestrator if big Classic games should end sooner: the Fallen's events scaled with the map (they knock out the leader's spare troops), or the economy's scale (more gold a turn on bigger maps, so armies grow with the room).

**Blackout at 400:** a seat has seen half the map by **turn 34.9** on average (26% of seats ever get there; most are knocked out first), all of it by turn 50.6 (4%). With standard fog the same measure reads 30.6 (it counts land seen through fog).

**CPU per turn** (one process, as the room is: the turn's resolution and every bot's planning): 300 at 8 avg **181 ms**, worst turn 1.29 s; 300 at 10 avg **185 ms**, worst 1.15 s; **400 at 10 avg 243 ms, worst 1.17 s** (the worst game's average 418 ms); blackout 236 ms, worst 1.33 s. The room's limit is 30 s: a turn on the biggest table uses under 5% of it at worst.

**Building the map** (Nate's desktop):
- **In Node** (one try): 400 in 4.0 s, 300 in 3.3 s, 200 in 1.5 s. Before this session's speed-ups a 400 try took 35 s with the sims running (the same try 7 s after them, on the same busy machine: the territories stage worked out every cell's distance to every seed, and the border noise again in each of 15 rounds), and a 200 5.5 s in the tests. The speed-ups make the same maps, byte for byte.
- **In the page's worker** (the lobby's picture, the built-in Chromium): a one-try 400 in **3.7 s**, a one-try 300 in 2.7 s, a 400 whose sixth try passes in 21.7 s. (The Chrome tab the browser extension drives ran about four times slower, about 15 s a try: its debugger slows the page, so those aren't Nate's numbers.)
- **On a phone** (estimate: a mid phone is 3 to 5 times slower than this desktop, session 16's profile is 4 times): a one-try 400 in about 11 to 19 s, a six-try seed in the lobby about 1 to 2 minutes (the lobby's line says big maps take a while, longer on a phone).
- **The room** (`wrangler dev`, `apps/web/scripts/s33b-room-build.mjs`): a one-try 400 in 3.5 s; a 400 whose sixth try passes **22.6 s** when the room made all six tries, too close to its 30 s. So the room and the online pages are now **told which try passed** (the host's page knows it from the lobby's picture): the room makes that one try (**4.6 s** for the same map), sends it with the map's version, and each page makes one try too. The same map either way, byte for byte (a test); a hint that isn't one of the six tries is ignored.

**The painting at 400** (`400-island-quiet-heron`, 3,540 × 2,441 map units): Mid detail 1.27 pixels a unit on a desktop and 0.96 on a phone (the budget is the same pixels whatever the size, so a bigger map paints a little softer), in 1,024-pixel tiles (20 of them); the Far image is capped at 2,048 pixels wide (2,048 × 1,413); the ground data 338 × 233; the ground atlas as on every map. No texture is over 2,048 pixels, under the 4,096 most Android phones allow, so a 400 paints smaller, never blank. The game started 4.6 s after Start (the map unrolled) on the desktop.
