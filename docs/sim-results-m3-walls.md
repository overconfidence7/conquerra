# Walls in play (session 20b)

*Nate's idea (design additions §16): max out a territory's culture and put a fort on it and it gets a wall; touching walls join up and share their spare defenders. Built exactly as designed, every number in `rules.walls`. All numbers below are bot games: tables of Marshals (personalities dealt from each game's seed), every system on, fog on, seats rotated, 500 games a line unless it says otherwise. Raw outputs: `docs/sims/s20b-walls-*.txt`. Script: `apps/sim/scripts/s20b-walls.ts` (and `s20b-wall-battles.ts` for what a battle at a wall looks like).*

## What Walls does in play (short)
- **Walls get built, mostly by the Turtle and by your Steward, and mostly on roomy maps.** On Wyrmland (6 players) some wall stands in 69% of Marshal games, on Rootholm (8) in 88%, on Embervale (4) in 19%. The first one goes up around turn 17–18 on the big maps, turn 14 on Embervale.
- **They're rarely attacked.** The bots count a wall's garrison before they attack, so they go elsewhere: 0.12–0.13 battles at a wall per game on Wyrmland and Rootholm, none on Embervale. When a wall is attacked it's by an army big enough to take it (on average 95 attackers against 14 defenders, 6 of them lent), and it falls about 19 times in 20.
- **Bot walls are small and thinly held:** 1–3 territories (the Turtle's peak 2.6–3.2), and the median walled territory holds **1 troop**, so it has nothing to lend. The bots don't yet keep a reserve inside their walls the way a person would.
- **Walling pays where there's room:** a delegating seat whose Steward walls its core (`+walls39`: any land worth holding, from scratch) wins 29.6% against 26.0% for the same seat that never walls on Embervale, 19.0% against 15.4% on Wyrmland; a walling Marshal 16.2% against 9.2% on Rootholm. Elsewhere it's about even (below). That's the "culture and building worth going all the way on" Nate asked for, from the bots alone; part of it is culture's own income on the way to 5.
- **Nothing runs away behind walls:** game length, the opening snowball and comebacks are the same with walls on and off, and the player leading at halfway has about half a percent of their land walled.

## Who builds walls, and when (Marshal tables, `s20b-walls-tables.txt`)
Share of Marshal seats of each personality that ever walled land (the median turn of their first wall, and their most walled land at once):

| Personality | Embervale 4 | Wyrmland 6 | Rootholm 8 |
|---|---|---|---|
| Turtle (walls from scratch) | 16% (turn 14, 1) | 45% (turn 17, 2.6) | 56% (turn 16, 3.2) |
| Merchant (24 gold left at most) | 1% | 25% (turn 24, 1.5) | 34% (turn 25, 1.6) |
| Schemer (18) | 8% | 13% (turn 29) | 16% (turn 32) |
| Conqueror (18) | 7% | 10% (turn 28) | 13% (turn 30) |
| Opportunist (10) | 0% | 5% (turn 35) | 5% (turn 39) |
| Blitzer (never) | 0% | 1% (by accident: culture and a fort bought for other reasons) | 1% |

(On a crowded table like Embervale at 4 the Marshal doesn't build like the Steward at all, session 20's finding: what walls appear there come from its own culture at a threatened capital and a fort.)

**Your Steward** (Run the realm) walls land worth holding (the capital, a choke point, a province held whole, land next to one of your walls) once at most 18 gold is left to pay, after the markets that pay, and keeps the plot free for the fort there. In the A/B games below, a delegating seat on the default Steward walled something in about a quarter of games, first around turn 20.

## A seat that walls its core against one that doesn't (`s20b-walls-ab.txt`)
One delegating seat (Leader 80%, Steward 20% on Run the realm) whose Steward walls any land worth holding (`+walls39`) and one that never walls (`+nowalls`), at the same table as dealt Marshals:

| Table | Walls its core | Never walls | Marshals | Fair |
|---|---|---|---|---|
| Embervale 4 | **29.6%** | 26.0% | 22.2% | 25% |
| Wyrmland 6 | **19.0%** | 15.4% | 16.4% | 16.7% |
| Rootholm 8 | 12.2% | 12.4% | 12.6% | 12.5% |

And two Marshals of dealt personalities, one walling whatever it can (`marshal+walls39`) and one never (`marshal+nowalls`), with four more:

| Table | Walls its core | Never walls | The other Marshals | Fair |
|---|---|---|---|---|
| Wyrmland 6 | 18.0% | 20.0% | 15.4% | 16.7% |
| Rootholm 8 | **16.2%** | 9.2% | 12.4% | 12.5% |

So walling pays where there's room to build and hold (Embervale and Wyrmland for a person's Steward, Rootholm for a Marshal), and is about even elsewhere (±2–3 points is noise at 500 games). *(Before that fix the Steward sometimes put a market on its capital at culture 5, which blocks the fort, and so the wall, for good; walling seats then won no more than the others.)*

## Game length and the runaway measures, walls on and off (`s20b-walls-tables.txt`)

| Table | Turns (median) | At the 60 cap | Half the map by turn 10 | Halfway leader won | Comebacks |
|---|---|---|---|---|---|
| Embervale 4, walls on | 23.3 (21) | 0.4% | 35.3% | 51.0% | 49.7% |
| Embervale 4, walls off | 23.3 (21) | 0.4% | 35.3% | 51.0% | 49.7% |
| Wyrmland 6, walls on | 38.0 (35) | 12.4% | 1.0% | 53.4% | 53.0% |
| Wyrmland 6, walls off | 37.8 (35) | 11.0% | 0.6% | 53.7% | 50.7% |
| Rootholm 8, walls on | 45.2 (44) | 23.2% | 0.0% | 46.0% | 69.2% |
| Rootholm 8, walls off | 45.1 (45) | 23.2% | 0.0% | 46.8% | 70.8% |

All within the noise (about ±2–3 points at 500 games). Every seat still wins its fair share.

## Does a walled runaway become impossible to stop?
**No, not in these games.** The player leading at halfway has **0.3–0.5%** of their land walled then (0.4–0.6% at the end), and no halfway leader in 1,500 games had even a tenth of its land walled. Even at a stress table where **every** Marshal walls whatever it can (`s20b-walls-stress.txt`: walls in every game, first around turn 9–10), the halfway leader has about 2% of its land walled and wins 47% (Wyrmland) and 43% (Rootholm), against 54% and 47% with walls off: if anything walls slow leaders down a little there.

## The limits (pending Nate's pick)
One change at a time, on the table where walls pay (Wyrmland 6: a walling delegating seat, a non-walling one, four Marshals; `s20b-walls-limits-final.txt`), and on the stress table (`s20b-walls-stress.txt`, every seat walls, Wyrmland 6 and Rootholm 8):

| Limit | Walling seat | Non-walling seat | Stress table: halfway leader won (Wyrmland / Rootholm) | Battles a wall held |
|---|---|---|---|---|
| Reach 3, lend all, one battle a turn (the design's defaults) | **19.0%** | 15.4% | 47.1% / 42.8% | 4% / 2% |
| Reach 2 | 19.4% | 15.4% | 47.1% / 43.2% | 4% / 2% |
| Reach unlimited | 19.0% | 15.4% | 47.1% / 43.0% | 4% / 2% |
| Lend half the spare troops | 20.0% | 16.0% | 47.4% / 42.7% | 3% / 2% |
| **Any number of battles a turn (with unlimited reach: Nate's pick, the rule now)** | 19.0% | 15.4% | 47.1% / 42.8% | 4% / 2% |
| Walls off | — | — | 53.7% / 46.8% | — |

**None of the limits changes anything measurable**, because bot walls are 1–3 territories and the lenders hold 1 troop: the reach never binds, and there's rarely a second battle at the same wall in a turn. My pick was the design's defaults; **Nate picked unlimited reach and lending to every attack**, and that's the rule now: with one battle a turn, a 1-troop decoy would use up the wall's help before the main attack. A wall's losses carry over within the turn, so several real attacks in one turn are how to break it. Where it will matter is a person holding a big reserve inside a big wall; Nate's play test is the real check.

**Two cheaper walls, for comparison** (`s20b-walls-cheaper.txt`, Wyrmland 6, before the fort-plot fix): culture 3 and a fort: walls in every game from turn 6, the walling Marshal 18.2% against 18.4%; culture 5 and no fort: the walling Marshal 13.8% against 17.6% (it walled cheap land that wasn't worth it). Neither is better than the design.

## The Steward personalities with walls on (`s20b-steward-personalities.txt`, 300 games a line)
A delegating seat (80/20) against Marshals:

| Steward | Embervale 4 (fair 25%) | Wyrmland 6 (fair 16.7%) |
|---|---|---|
| Neutral | 26.3% | 19.0% |
| Turtle | 22.3% | 18.0% |
| Merchant | **36.7%** | **26.0%** |

(Session 20c, before Walls and on other seeds: Neutral 28.3 / 16.7, Turtle 25.0 / 15.3, Merchant 34.3 / 20.0. With walls off on these seeds the Merchant was already 25.3% against Neutral's 18.0% on Wyrmland, so most of the gap isn't Walls.)

**The Merchant is still well over Neutral: 10.4 points on Embervale, 7.0 on Wyrmland.** Two levers tested (300 games each):
- **The Merchant, markets first but at most one or two a turn:** Wyrmland 15.7% (one) or 24.0% (two), but Embervale doesn't move (38.3% with one): on a crowded table it buys about one market every two or three turns anyway.
- **Neutral's Steward not saving up for a fort except at the capital** (it buys markets instead, as the Merchant does): Neutral rises to **34.7% on Embervale** (level with the Merchant) and 18.7% on Wyrmland. That's what closes the gap on Embervale, because the gap is Neutral stopping to save for urgent forts (session 20c's finding), but it makes a delegating player 1.39× fair against Marshals on Embervale.

So: to bring them level without losing "markets first", **cap the Merchant at one or two markets a turn** (levels Wyrmland) **and** either accept the Embervale gap or let Neutral save only for the capital's fort (which makes delegating stronger there). Nate's call; nothing changed by default (the Merchant's `markets` setting is in `personalities.json`, unset).

## Session 20d: your Steward walls with a plan
Since session 20d your Steward on Run the realm walls the capital's province (and provinces held whole facing a rival, and the province your Leader stands in) fast, several culture levels a turn, and everything into it when threatened; your Leader keeps 4 troops in walled land facing a rival. A delegating seat against Marshals (300 games): walls in 66% / 77% / 72% of games on Embervale 4 / Wyrmland 6 / Rootholm 8 (was about one in five), the first from turn 12–13 (was 24–27), 1.4 / 6.7 / 8.4 walled territories a game (was 0.2). On the big maps they're now attacked about once a game and nearly always fall to that attack. Win rates and the one-change tests are in `docs/sim-results-m3-leaders.md` ("Session 20d").
