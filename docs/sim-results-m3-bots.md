# Simulator results: the Captain bot (session 8, Oct 4)

*How the new Captain bot plays, compared with session 7's Recruit bots. 1,000 games at each table size, normal luck (30%), fog on, Classic mode. Embervale for 2, 4 and 6 players; Greatmarch for 10. Same game seeds as session 7 (`--seed m2`), so the only difference is the bots. No rules were changed.*

Commands (anyone can re-run them):
```
pnpm sim --games 1000 --players 2,4,6,10 --seed m2                        (all Captain: the new default)
pnpm sim --games 1000 --players 2,4,6,10 --seed m2 --bots recruit         (all Recruit: session 7's "after")
pnpm sim --games 1000 --players 4 --seed m2 --mix captain,recruit,recruit,recruit
pnpm sim --games 1000 --players 2 --seed m2 --mix captain,recruit
```
The Recruit run gives exactly session 7's numbers (23.5, 24.9, 26.0 and 36.0 turns), which also shows that this session's replay change didn't change how games play.

## What the Captain does differently (in one line each)
1. Holds passes and sea-lane landings with just enough troops, and builds a fort there.
2. Only attacks through a pass or across a sea lane with a real army (half as much again as it needs), gathering first.
3. Lands from the sea where the far side is weak.
4. Finishes weakened rivals; with 3 or fewer players left it picks one rival and one spearhead front, and the rest of its front line sends spare troops there.
5. Defends its capital when a big army is next to it.
6. Chains on when the next hop is comfortably likely to win (1.25 times what it needs), into the fog too, on its best guess.

## Game length (target: 15–25 turns; average 25 or under at 4–6 players)

| Players | Recruit (session 7): avg / median | Captain: avg / median | Share inside 15–25: Recruit → Captain |
|---|---|---|---|
| 2 | 23.5 / 23 | **22.3 / 21** | 70% → 69% |
| 4 | 24.9 / 23 | **24.0 / 23** | 61% → 59% |
| 6 | 26.0 / 25 | **25.0 / 24** | 55% → 59% |
| 10 | 36.0 / 35 | 39.8 / 39 | 4% → 4% |

**In plain words:** at 2–6 players, Captain games are about a turn shorter, and **4- and 6-player games are now on target** (24.0 and 25.0). 10-player games got about 4 turns *longer* (and 3.5% hit the turn-60 safety stop, against 1.5% before): with ten good defenders on Greatmarch, the last two or three big realms grind it out. Conquest mode (the lobby's suggestion for 8+ players) still caps those at 20 turns. That's for the session 14 balance pass.

## Seat fairness (each seat should win about the same share)

| Players | Recruit | Captain |
|---|---|---|
| 2 (fair 50%) | 52.3 / 47.6 | 50.4 / 49.6 |
| 4 (fair 25%) | 23.1–27.9 | 23.7–25.6 |
| 6 (fair 16.7%) | 14.0–17.7 | 15.3–18.2 |
| 10 (fair 10%) | 8.5–10.9 | 8.8–11.6 |

**In plain words:** still fair, a little tighter than before at 2 and 4 players.

## Runaway check: one player holds more than half the map after turn 10

| Players | Recruit | Captain |
|---|---|---|
| 2 | 76% | 73% |
| 4 | 45% | **55%** |
| 6 | 27% | **46%** |
| 10 | 0% | 0.3% |

**In plain words: runaways got more common at 4 and 6 players.** This is the cost of a bot that finishes what it starts: when one Captain gets ahead, it keeps pushing and doesn't stop to trade land. Games are still not decided early: the eventual winner only takes the lead for good 35% of the way into a 4-player game (40% for Recruit), and the lead changes hands about 3.4 times a game. See the options below.

## Chaining and choke points

| Players | Chained hops per game: Recruit → Captain | Battles across a pass or sea lane: Recruit → Captain |
|---|---|---|
| 2 | 36 → 57 | 5.8% → 5.0% |
| 4 | 44 → 67 | 4.9% → 3.7% (1 in 27) |
| 6 | 46 → 76 | 5.2% → 3.8% |
| 10 | 123 → 234 | 5.8% → 4.5% |

- **The Captain chains a lot more** (about 1.5 times as many hops), and 81% of its hops capture (Recruit: 84%). Many of its hops go into land it couldn't see when it planned them.
- **It crosses passes and sea lanes less often, but harder.** It no longer pokes at a choke point with "just enough"; it waits until it has a real army. Crossings still capture about 90% of the time (sea landings: 86% → 89%).
- So the "under 1 in 20" stays under 1 in 20. Choke points work as walls that a Captain breaks once, with force, rather than a place where small fights happen.

## Mixed tables (is it smarter?)

| Table | Captain wins | Fair share |
|---|---|---|
| 1 Captain + 3 Recruits (4 players) | **37.4%** | 25% |
| 1 Captain vs 1 Recruit (2 players) | **77.0%** | 50% |

Seats rotate every game, so seat luck evens out. **The Captain clearly beats the Recruit:** half as often again as its fair share at a 4-player table, and three games in four head to head.

## Tuning the chain margin

The Captain hops on when the army that should arrive is at least *margin* times what the next hop needs. 300 games at 4 players each (seed `abl`):

| Margin | Avg length | Runaways | Captain's win rate vs 3 Recruits |
|---|---|---|---|
| 1.0 (whenever likely) | 23.6 | 59% | 34.5% |
| **1.25 (chosen)** | **24.1** | **54%** | **38.0%** |
| 1.5 | 26.0 | 51% | 38.8% |
| 2.0 (Recruit's) | 25.8 | 51% | 35.5% |
| 3.0 | 28.5 | 32% | 32.7% |

1.25 gives the shortest games among the margins that win best. Runaways only really drop at 3.0, and then games run long and the Captain plays worse.

## What tuning taught us (things tried and dropped)
- **Refusing to fight anyone but the focused rival in the endgame** made the Captain lose more often: in an early version, switching the whole "focus" behaviour off raised its win rate from 27% to 33%. It now just prefers the focused rival's land instead of refusing everything else.
- **The first Captain made games longer (32 turns)**, because it could only plan hops into land it could see, so chains stopped at the fog. Planning hops on a best guess (with "Only if still stronger" as the safety net) fixed most of that.
- **Two big realms staring at each other** along a long front, neither attacking, caused games to hit the turn-60 stop. Fixed by picking a spearhead the enemy can't easily hold (never in front of a fort it can't break) and letting the front line shift troops sideways to it.
- **Recruiting next to the spearhead** made games about 4 turns longer. Dropped.
- **A realm that lost its capital and had no barracks** couldn't recruit at all and sat on its gold. It now builds a barracks straight away.

## Speed

Measured on Nate's laptop, which was running about 3 times slower than earlier in the session by then (the same Recruit command took 0.98 ms per turn instead of 0.30 ms), so real numbers are likely lower:

| | Recruit | Captain |
|---|---|---|
| One bot's turn, 4 players | 0.15 ms avg | 0.51 ms avg (worst 18 ms) |
| All bots' turn, 10 players | 2.1 ms avg | **3.5 ms avg, worst 27 ms** |

**Well inside the "about 20 ms" budget on average.** A single worst turn reached 27 ms for all nine bots together on the slowed-down laptop (one bot's worst: 16 ms). Bots plan in the browser's background game, so the screen doesn't stutter either way.

## Concerns and options for Nate (no rules were changed)

**Runaways at 4–6 players got worse with smarter bots** (4 players: 45% → 55%; 6 players: 27% → 46%). Options:
1. **Leave it for now (recommended).** Games are on target in length and the lead still changes hands; bots are a stand-in for people. Play a few games against Captains and see whether a runaway *feels* unstoppable.
2. **A bot fix, no rule change:** Captains could gang up on whoever holds 40% of the map (people do this). Untested; it might slow games down again. Could be tried in session 9 or 14.
3. **Rule options already on file for session 14** (`docs/sim-results-m2-chaining.md`): tired troops after the first hop (−10% per hop), or land upkeep starting earlier (8 territories instead of 10).

**10-player games got longer** (36 → 40 turns). Conquest stays the suggestion for 8+ players; the balance pass (session 14) should look at it, perhaps with a bigger map's fair layouts or Conquest as the 8+ default.
