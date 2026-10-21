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

**The orchestrator's re-run (Oct 20, seed `o12t`, 20 Marshals on Rootholm, 30 games, 2 cores):** 53.6 turns on average (the median at the 60-turn cap, 7% within 40), the halfway leader wins 37%, comebacks 90%, CPU per turn 54 ms on average and 225 ms at worst (the session's 299 ms and 1.65 s on a laptop running 19 workers): the 5 s bar holds with room. **Nate's calls (Oct 20):** 20 seats on the random 400s and Krakenmere as far as its spots allow, with a looser band above 12 seats and the seat rule unsaid in the game; the 200s' layouts chosen with the simulator; both in session 34b.

## Session 34b: the 200s' layouts (Oct 20)

*Nate's call (Oct 20): the official 200s' capital layouts chosen with the simulator at 8 to 20 seats, as session 20b did for the smaller maps, and session 23's start bonus on them. Script: `npx tsx apps/sim/scripts/s34b-layouts.ts rootholm:8,...,krakenmere:13 --games 300 --budget 12` (all nine tables at once on one shared set of 19 workers, `apps/sim/src/pool.ts`), then `s34b-confirm.ts` (a second proof) and `s34b-pin.ts` (writes the pins). Raw: `docs/sims/s34b-layouts-<map><n>.txt`, `s34b-confirm.txt`.*

**How, per table:** all-Marshal tables, personalities dealt, fog and diplomacy on, **no head start at all** while searching (the spots themselves). (1) Each spot's share of wins on the current layout (its own at 8 and 10, session 34's above), 300 games, seed s34bF, the same games for every layout. (2) Session 20b's search: move the most uneven spots, one at a time and then two, to other castle spots that keep the paper check (10 and under), the exposure band (no looser than the start's) and no two capitals side by side; keep a move that narrows the gap between the best and the worst spot; 12 layouts at most. (3) **Fresh games** (s34bC, 300): the current layout and the best, bare; the best is pinned only if at least **5 points fairer** there. (4) **The start bonus, session 23's way**, on the layout that ships: every spot under half of fair gets +2, +4, +6 (the same fresh games), each keeps the smallest that brings it to half of fair without passing fair (else +6). (5) **The proof** on fresh games again (s34bP, 300): today's layout with today's head start against the new layout with its bonus; and (6) **a second proof** (s34bQ, 600) for every table the pin would change. A new layout ships where the proofs don't say it's worse; a kept layout changes its bonus only where the proofs (averaged) say at least 5 points fairer.

**The spread on fresh games** (the best spot's share of wins minus the worst's; "today" is each table as it shipped before this session, with its head start):

| Table (fair) | The search: start, best (s34bF) | Check, bare (s34bC) | Layout | Proof: today, new (s34bP, 300) | Second proof (s34bQ, 600) | Shipped |
|---|---|---|---|---|---|---|
| Rootholm 8 (12.5%) | 31.3, 24.3 | 28.7, 24.3 | kept (4.4 points) | 27.7, 27.7 | | **as before** |
| Rootholm 10 (10%) | 23.7, 21.7 | 27.3, 22.0 | **new** (5.3) | 24.3, 24.0 | 24.7, 21.8 | **new spots and bonus** |
| Rootholm 12 (8.3%) | 29.7, 26.3 | 27.7, 31.0 | kept | 32.3, 32.0 | | **as before** |
| Rootholm 16 (6.3%) | 33.7, 24.0 | 26.3, 19.0 | **new** (7.3) | 28.7, 17.7 | 24.8, 16.0 | **new spots and bonus** |
| Rootholm 20 (5%) | 12.0 (no move inside the band was fairer; 5 measured) | 15.7 | kept | 20.0, 14.7 | 15.2, 15.0 | **as before** (the bonus's gain didn't hold) |
| Krakenmere 8 (12.5%) | 54.0, 42.7 | 48.7, 52.3 | kept | 53.0, 53.0 | | **as before** |
| Krakenmere 10 (10%) | 50.0, 44.3 | 52.3, 47.0 | **new** (5.3) | 51.3, 48.0 | 49.8, 44.8 | **new spots and bonus** |
| Krakenmere 12 (8.3%) | 31.0, 29.7 | 27.3, 27.3 | kept | 40.0, 29.3 | 41.5, 28.7 | **its spots, session 23's bonus** |
| Krakenmere 13 (7.7%) | 25.0, 23.7 | 26.0, 32.3 | kept | 22.7, 26.3 | | **as before** |

(One standard error on a spot's share is about 1.9 points at 300 games and 12.5% fair, 1.3 at 5%; the spread, the best of many spots minus the worst, carries more. That's why a layout needs 5 points on fresh games, and why the changes got a second proof.)

**By spot, the four tables that changed** (the proof's fresh games, s34bP, in %; the start bonus in brackets):

| Table | Today (its layout and head start) | New (version 2) |
|---|---|---|
| Rootholm 10 | Wolfhold 24.0, Emberwick 7.3, Hallowmarch (+6) 1.3, Mistmark 9.7, Nettlehold (+6) 3.0, Kingshelm 10.7, Silverfield (+6) 0.7, Deepton 25.0, Kingsmarch 11.7, Fenbury 6.7 | Yewcrest 24.0, Glenleigh (+2) 3.7, Hallowmarch (+6) 2.3, Mistmark 16.3, Nettlehold (+6) 2.0, Frosthaven 11.7, Silverfield (+6) 0.3, Deepton 24.3, Kingsmarch 11.3, Fenbury 4.0 |
| Rootholm 16 | Wolfhold (+1) 1.3, Emberwick (+6) 9.7, Greyfield (+6) 1.7, Mistwell (+2) 10.7, Yewmouth (+1) 1.3, Mistmark (+1) 0.7, Frosthaven (+1) 3.3, Nettlehold (+1) 1.3, Coldreach (+6) 7.7, Kingshelm (+6) 9.0, Brighthaven (+6) 0.0, Roseton (+3) 1.7, Silverfield 3.0, Deepton (+2) 2.3, Brightfield (+4) 17.3, **Fenbury (+1) 28.7** | Wolfhold 1.3, Emberwick 6.0, Greyfield (+6) 1.3, Mistwell 14.3, Yewmouth (+2) 3.0, Mistmark (+6) 2.0, Frosthaven 3.3, Nettlehold 3.0, Coldreach 10.7, Kingshelm (+6) 6.3, Coldwick 4.3, Roseton (+6) 0.3, Silverfield (+6) 0.3, Deepton 16.0, Brightfield 9.7, Nettlehelm 18.0 |
| Krakenmere 10 | Dundale (+6) 1.7, Moonford (+6) 0.3, Willowfall 6.3, Rookstone (+6) 0.3, Oldfell (+2) 7.7, Stagwood (+6) 0.7, Glenby 3.3, **Rookton 51.7**, Coldwick 3.7, Emberfall 24.3 | Dundale (+6) 1.0, Moonford (+6) 0.3, Willowfall 8.7, Willowstead (+6) 0.0, Oldfell 7.3, Stagwood (+6) 1.7, Glenby 4.0, **Amberhaven 48.0**, Coldwick 5.3, Emberfall 23.7 |
| Krakenmere 12 | Winterhold 5.7, Moonford (+1) 3.0, Rookstone (+2) 1.0, Stagwood (+6) 0.0, Harrowhurst (+4) 6.7, Northshire (+4) 0.3, Goldrest (+6) 2.3, Glenby (+6) 3.3, Rushdale (+6) 6.7, Redstead (+4) 30.0, **Amberhaven (+6, a market and culture) 40.0**, Deepdale (+6) 1.0 | Winterhold 4.3, Moonford (+6) 4.3, Rookstone (+6) 0.7, Stagwood (+6) 0.7, Harrowhurst 17.7, Northshire (+6) 3.0, Goldrest (+6) 1.7, Glenby (+6) 6.3, Rushdale 4.3, Redstead 25.7, Amberhaven 30.0, Deepdale (+6) 1.3 |

**What it found:**
- **Rootholm 16 is the clear win** (the spread from about 26 to 17 points on two sets of fresh games): Fenbury, the spot that won 29%, is off the table; the best spot now wins 16 to 18%.
- **Krakenmere 12's head start was feeding its strongest spot.** Session 34 graded the big layouts' head start by the exposure check, and Amberhaven, which the check calls exposed, got +6 troops, a market and culture and won 40%. Session 23's bonus goes by the spots' measured wins instead: Amberhaven gets nothing and wins 30%; the spread from about 41 to 29.
- **Krakenmere 10 and Rootholm 10 gain a little** (4 and 2 points on average over the two proofs). On Krakenmere 10 the search swapped Rookton (52%) for a castle nearby, Amberhaven, which wins 48%: one corner of Krakenmere wins about half the 10-seat games whichever castle sits there. **The spots are what they are** (session 20b's finding): no layout from Krakenmere's 28 castles comes near the bars at 8 or 10.
- **Five tables stay as they were:** at Rootholm 8, 12 and 20 and Krakenmere 8 and 13 no layout the checks allow was 5 points fairer on fresh games, and the bonus sized on today's spots wasn't 5 points fairer than today's head start (Rootholm 20 looked 5 points fairer in the first proof and the same in the second).
- **The bars** (the best spot under 2 × fair, the worst above half of fair): **no table reaches them**, before or after. The best spot runs 2.3 to 4.8 times fair, the worst 0 to 0.7%. At 16 and 20 seats the worst-spot bar can't be read from 300 games anyway: with 16 or 20 spots at 5 or 6% each, even a perfectly fair table usually shows its weakest spot under half of fair by chance. A +6 start bonus rarely lifts a spot that wins 0 to 2% (session 23 found the same): the lever after this one is the maps' own castle spots (a map change, Nate's call).
- **The seat rule** deals the bonus spots to bots first, as before (version 2's layouts mark them by their bonus, as the 8 and 10 layouts always did).
- **Turns and CPU didn't move:** the proofs' tables ran 46.5 to 54.6 turns against today's 47.2 to 54.2 (Rootholm 16: 52.5 against 48.9, a fairer table running a little longer), CPU per turn 53 to 107 ms on average against 54 to 112 ms, the worst turn under 0.9 s (one process of 19).

**Where they live, and how a running game keeps its spots:** version 2 sits beside the map files in `packages/content/data/maps/layout-versions.json` (as `big-tables.json` does); `withBigTables` attaches it to the map as `layoutVersions`, and the engine's `layoutFor(map, players, version)` picks the layout. A new game's setup records `layouts: 2`; a setup with none (every game made before this session, and its history) is dealt from version 1's layouts and head start, so a game already running on the server keeps its spots across the deploy, and its turns replay exactly.
