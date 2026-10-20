# Sim results, M5: bigger tables (session 34, Oct 19 to 20)

*All-Marshal tables (personalities dealt from each game's seed), fog on, the Fallen, Spoils, Fate, diplomacy and spies on, 100 games a run, seed `s34`, 19 processes on Nate's laptop. Two scripts: `pnpm sim --games 100 --players N --map M --bots marshal --seed s34` (by seat, the runaway rule, the Fallen, diplomacy, CPU) and `npx tsx apps/sim/scripts/s30-sims.ts M:N 100 --seed s34` (by spot, CPU per turn as the room would see it). Raw output: `docs/sims/s34-*.txt`.*

## What a big table is

- **Rootholm seats up to 20, Krakenmere up to 13.** The layouts for 11 and up are made from each map's own capital spots (32 and 28), so the map itself (its land, its castles, its file) doesn't change, and the map lab's fingerprint of every official map is the same. They live beside the map files (`packages/content/data/maps/big-tables.json`, made by `packages/mapgen/scripts/big-layouts.ts`) and every game joins them on load.
- **How they were chosen:** the map maker's capitals search (60 starts), then, because its paper check (every capital about as far from its nearest rival) can't hold for 12 or more capitals among a fixed set of spots, the layout whose exposure is most even (the random maps' own measure), never two capitals side by side. Each gets random map version 5's head start (troops graded by exposure, a market and a level of culture on the more exposed half) and its harder spots for the seat rule.

| Map, players | Exposure, most / least exposed (the band is 4.0) | Nearest rival (borders) |
|---|---|---|
| Rootholm 11 to 20 | 1.33, 1.52, 1.43, 1.69, 1.69, 2.00, 2.14, 2.57, 2.69, 3.86 | 2 to 6 |
| Krakenmere 11, 12, 13 | 2.06, 2.16, 2.73 | 3 to 7 |
| Krakenmere 14 | 5.71 (outside) | |
| Krakenmere 16 | 29.3 (a spot with almost no room) | |
| Krakenmere 18 to 20 | two capitals side by side | 1 |

So **Krakenmere stops at 13**. Seating it at 14 to 20 would need capitals off its 28 castle spots (a map change, Nate's call).

## Turns, CPU and the table (by seat)

"By seat" is the seat's number: seats are dealt to spots at random, so it's mostly noise (one standard error is about 2.2 points at 20 seats, 2.8 at 12).

| Table | Classic: avg turns, within 40, reached turn 60 | Conquest | By seat, fair, furthest | CPU per turn, avg / worst (one process) |
|---|---|---|---|---|
| Rootholm 12 | 47.4, 36%, 29% | | 8.3%, 15.0 (6.7 over) | 64 ms / 1.06 s |
| Rootholm 20 | 53.3 (median 60), 14%, 50% | 20 turns, 100% at its limit | 5.0%, 10.0 (2.0× fair); Conquest 9.0 | 73 ms / 0.43 s (Conquest 99 ms / 0.73 s) |
| Krakenmere 12 | 49.1, 23%, 31% | | 8.3%, 12.0 | 61 ms / 0.87 s |
| Krakenmere 13 | 48.9, 26%, 28% | 20 turns | 7.7%, 12.0 (1.6×) | 49 ms / 0.59 s |

**A 20-seat Classic on Rootholm runs 53 turns on average and half the games reach the engine's hard stop at turn 60** (it can't run past 60 on average: the cap ends it). Conquest is suggested from 8 players already and ends at its 20 turns. By the s30-sims CPU line (each game's turns, resolve plus all 20 bots' planning, one process): **Rootholm 20, 299 ms a turn on average, 1.65 s at the worst turn** (12 players 189 ms / 1.36 s; Krakenmere 13 230 ms / 1.13 s). The bar is the worst turn under 5 s; the room allows 30 s.

## By spot: the official 200s' layouts are uneven, the old ones too

On an official map the layout is the same every game, so "by exposure" is by spot: each spot's share of wins over 100 games.

| Table | Fair | The spots' shares (safest first by exposure) | Furthest |
|---|---|---|---|
| Rootholm 20 | 5.0% | 8 / 9 / 0 / 15 / 3 / 4 / 11 / 6 / 2 / 0 / 1 / 16 / 0 / 0 / 8 / 3 / 6 / 1 / 6 / 1 | 16% (3.2×) |
| Rootholm 20, no head start | 5.0% | 4 / 12 / 0 / 17 / 1 / 7 / 4 / 11 / 5 / 2 / 0 / 15 / 0 / 3 / 5 / 1 / 7 / 0 / 6 / 0 | 17% |
| Rootholm 12 | 8.3% | 3 / 2 / 2 / 2 / 19 / 9 / 3 / 29 / 1 / 27 / 2 / 1 | 29% (3.5×) |
| Krakenmere 12 | 8.3% | 4 / 3 / 1 / 0 / 29 / 6 / 1 / 2 / 9 / 41 / 1 / 3 | 41% (4.9×) |
| Krakenmere 12, no head start | 8.3% | 9 / 3 / 0 / 0 / 19 / 22 / 0 / 1 / 8 / 34 / 1 / 3 | 34% |
| Krakenmere 13 | 7.7% | 15 / 2 / 2 / 0 / 0 / 26 / 2 / 2 / 5 / 26 / 6 / 14 / 0 | 26% (3.4×) |
| *Rootholm 10 (its own, shipped since session 23)* | 10% | 28 / 23 / 10 / 7 / 15 / 0 / 7 / 0 / 6 / 4 | 28% (2.8×) |
| *Krakenmere 10 (its own)* | 10% | 50 / 4 / 8 / 6 / 23 / 6 / 2 / 1 / 0 / 0 | 50% (5×) |

**Reading:** a few spots on each of these maps win three to five times their share among equal Marshals, and it's the land around them (with or without the head start the same spots lead). The maps' own 10-seat layouts are as uneven, so this is older than the big tables. The seat rule deals harder spots to bots first, and people are dealt the rest at random. The fix is a layout chosen with the simulator, spot by spot (as session 20b did for the smaller maps), for the 200s at 8 to 20: a balance session of its own.

## The runaway rule, the Fallen, deals

| Table | Leader at halfway wins | Comebacks (winner not the leader after turn 10) | Joint wars on the leader a game | The Fallen's world events a game (and in % of games) | Deals a game |
|---|---|---|---|---|---|
| Rootholm 20 Classic | 29% | 82% | 20.7 | 32.8 (100%) | 146.5 |
| Rootholm 20 Conquest | 15% | 85% | 7.7 | 7.7 (100%) | 94.3 |
| Rootholm 12 | 43% | 76% | 13.9 | 28.9 | 70.4 |
| Krakenmere 13 | 44% | 78% | 16.7 | 28.5 | 87.3 |

The bots gang up on the leader more at bigger tables (21 joint wars a game at 20), and the leader at halfway wins less often (29% at 20, 43% at 12). The Merchant wins 35% of 20-seat Classic games (fair 16.7% a personality): the long game favours the gold-minded; in Conquest it's 23%.

## Random maps of 300 and 400 at big tables (random map version 6)

**How many seats.** A random map carries a capital layout for every table size it seats, and every one must pass, so each extra seat is one more way for a seed to fail. Seeds that make a fair map, of 50 (ten of each shape; `pnpm --filter @conquerra/mapgen exec tsx scripts/try-random.ts 10 300,400 all --seats N`, and `--paper 10` for the rule below):

| Seats | 300, paper check at every count | 300, paper check to 10 | 400, paper check at every count | 400, paper check to 10 |
|---|---|---|---|---|
| 10 (version 5) | 42 | | 42 | |
| 12 | 30 | 37 | 33 | 39 |
| 16 | 5 | 24 | 2 | 35 |
| 20 | | 9 | | 25 |

- **The paper check can't hold above 10** (every capital about as far from its nearest rival, gold within 30%): at 16 seats only 2 to 5 seeds in 50 passed. So **version 6 judges a layout for 11 and up by the exposure band alone** (4.0, as every random map), the same rule the official 200s' big layouts use; 10 and under are made exactly as version 5's (the same search and checks).
- **At 20 seats more than three in ten seeds fail** (the 300 passes 9 of 50, the 400 25 of 50, mostly "too unevenly exposed"). So version 6 seats **the 400 up to 16 (35 of 50 pass) and the 300 up to 12 (37 of 50)**. **Archipelagos stay at 10** at both sizes: at 16 seats none of ten passed, and a map carries every layout it seats, so it would fail a 10-player game too. Without the archipelagos, 35 of 40 pass at 400 and 33 of 40 at 300. The proposal for 20 seats on a 400 (Nate's call): a looser band for 13 and up (5.5, session 30's first band), measured the same way.
- **Making the map:** the extra layouts cost time on every 400, even for a 10-player game, so the search above 10 seats takes 6 starts instead of 60 (`BIG_STARTS`; the exposure band, not the paper check, decides those). One try (the one that passed, as the room and the pages are told it), this laptop: **400 at version 6 5.7 s (version 5 4.9 s), 300 3.8 s (3.6 s)**. With 60 starts it was 18.8 s. A phone is 3 to 5 times slower.

**The sims** (one game a map, the seeds as the 33b runs, archipelagos and failed seeds not played):

| Table | Played | Turns: avg, within 40, reached 60 | By seat, fair, furthest | By exposure (safest first) | Furthest | CPU per turn, avg / worst turn |
|---|---|---|---|---|---|---|
| 400, 16 players | 33 | 50.3, 18%, 30% | 6.3%, 15.2 | 12.1 / 6.1 / 15.2 / 15.2 / 3.0 / 6.1 / 9.1 / 9.1 / 9.1 / 0 / 3.0 / 0 / 3.0 / 3.0 / 0 / 6.1 | 15.2 (8.9 over, 2.4×) | 453 ms / **4.42 s** |
| 400, 12 players | 33 | 49.4, 27%, 36% | 8.3%, 18.2 | 15.2 / 15.2 / 9.1 / 15.2 / 3.0 / 3.0 / 9.1 / 18.2 / 6.1 / 3.0 / 3.0 / 0 | 18.2 (9.9 over) | 313 ms / 2.04 s |
| 300, 12 players | 34 | 47.1, 35%, 26% | 8.3%, 14.7 | 11.8 / 14.7 / 8.8 / 5.9 / 17.6 / 8.8 / 2.9 / 11.8 / 5.9 / 8.8 / 2.9 / 0 | 17.6 (9.3 over) | 254 ms / 1.11 s |

With 33 or 34 games a spot's share has a standard error of about 4.5 points, so these are wide; the head start by rank runs 0 / 1.7 / 2.6 ... 6.0 troops at 12. **The worst turn with 16 Marshals on a 400 was 4.42 s of CPU in one process**, under the 5 s bar and far under the room's 30 s, but the closest of any table; it's why 20 on a 400 waits for its own numbers.

## Live (wrangler dev, `node apps/web/scripts/big-table-harness.mjs 3 rootholm 20 10`)

Ten accounts at a 20-seat Rootholm table (Conquest): the table made in 74 ms, nine friends sat from the link, an eleventh was told "Ten people are already sitting here. The other seats go to bots.", everyone wrote a line in the table chat and every page read the other nine, Start pushed each page its own seat (18 ms), every page counted down to the same deadline, and the game was in all ten lists. Three turns, nine locking in early and the last a moment later (each page saw the nine ticks before it): **40, 49 and 77 ms from the last lock-in to all ten updates**, the room's own log 34, 41 and 66 ms for the turn's resolution and the next turn's planning; 137 to 151 KB a turn to the ten pages; a page's "where are we" 32 KB.
