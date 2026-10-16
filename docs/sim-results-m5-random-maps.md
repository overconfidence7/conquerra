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

The stage split leaves the twelve exactly as they were: the same committed files (a test pins each map's fingerprint), and the same games. `npx tsx apps/sim/scripts/s30-sims.ts --digest 4 20 --seed s30d` (20 all-Marshal games on each official map, 4 players) gives the same digest before session 30's Part 2 and after Part 4: **`dc8962d4f8ba3bc6`**; `pnpm sim --bots marshal --players 4 --games 60 --seed s29` gives the same games, seats and deals as session 29's (23.8 turns, seats 20/20/35/25%).
