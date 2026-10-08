# Sim results: leaders you delegate to (M3, session 18)

*How good are your leaders, what does the default Steward do, and how fast are they? Fog on, diplomacy on, 300 games per line, seats rotated every game. Raw outputs: `docs/sims/s18-*.txt`. Scripts: `apps/sim/scripts/s18-sims.ts` (the tables below), `s18-variant.ts` (one seat, A/B), `s18-leaders.ts` (orders a turn), `s18-speed.ts` (worst-case speed), `s18-captain-same.ts` (the Captain is unchanged).*

## The seats
- **A delegating player** (`delegate-80`): hands everything to their leaders. Their Leader is on **Run the military** with 80% of the income; their Steward is on **Run the realm** with 20%. Their own orders are only what a person would still do: spend the treasury they start with (and the small change budgets round off) on troops at the capital. `delegate-65` and `delegate-50` split the income 65/35 and 50/50.
- **A Captain with the default Steward** (`captain-steward-20`): plays exactly like the Captain from its treasury, while its Steward runs the realm on 20% of the income. This is what a person gets if they never open the Leaders panel.

## 1. Are the leaders as good as a Marshal?
One delegating seat against a table of Marshals:

| Table | Leader / Steward split | Won | Fair | × fair |
|---|---|---|---|---|
| Embervale, 4 | 80 / 20 | **37.0%** | 25.0% | **1.48** |
| Embervale, 4 | 65 / 35 | 25.0% | 25.0% | 1.00 |
| Embervale, 4 | 50 / 50 | 8.7% | 25.0% | 0.35 |
| Wyrmland, 6 | 80 / 20 | **24.3%** | 16.7% | **1.46** |
| Wyrmland, 6 | 65 / 35 | 20.3% | 16.7% | 1.22 |
| Wyrmland, 6 | 50 / 50 | 8.3% | 16.7% | 0.50 |

**Yes, and then some, as long as most of the income goes to the military.** A player whose leaders do everything, with 80% to the Leader, wins about 1.5 times their fair share against Marshals on both maps. A Marshal against Marshals wins its fair share by definition, so the leaders are at least as good. They have one edge a Marshal doesn't: the split is fixed, so a fifth of the income always goes to buildings that last.

The more you give the Steward, the worse it goes: half and half wins a third to a half of the fair share. That matches session 17's finding: under today's rules, troops win and buildings and culture don't pay back. It's a rule question for the balance pass (session 19), not something the leaders can fix.

What the 80/20 seat built by turn 10 (Embervale / Wyrmland): about 2 forts, 2.4 / 4.7 markets, and hardly any culture.

## 2. The default Steward: does it build now, and how does it fare?
| Table | Seat | Won | Fair | Forts by turn 10 | Markets by turn 10 | Culture levels by turn 10 | Gold on buildings | Gold on culture |
|---|---|---|---|---|---|---|---|---|
| Embervale, 4 | Captain (plain) | 23.0% | 25.0% | 1.1 | 0.0 | 1.3 | 25 | 14 |
| Embervale, 4 | Captain + Steward 20% | **16.0%** | 25.0% | 2.8 | 1.5 | 1.0 | 68 | 15 |
| Wyrmland, 6 | Captain (plain) | 17.3% | 16.7% | 0.5 | 0.0 | 1.3 | 37 | 25 |
| Wyrmland, 6 | Captain + Steward 20% | **18.3%** | 16.7% | 2.9 | 4.1 | 1.3 | 172 | 28 |
| Embervale, 4 vs Marshals | Captain + Steward 20% | 9.7% | 25.0% | 2.0 | 1.5 | 0.9 | 49 | 9 |
| Wyrmland, 6 vs Marshals | Captain + Steward 20% | 12.3% | 16.7% | 1.9 | 3.9 | 1.1 | 145 | 22 |

**It builds now:** about 2.5 times the forts and a few markets by turn 10, where the plain Captain builds no markets at all. Nate's "I played the whole game without building a building" can't happen any more.

**How it fares:** on Wyrmland (a big map, long games) the Steward pays for itself: 18.3% against 17.3%. On Embervale (small, fast games) 20% of the income spent on buildings costs a Captain about a third of its wins (16% against 23%), because the game is decided before buildings pay back.

**What I changed because of this.** The first version of "Run the realm" also bought culture for its income, ranked by payback. That made it much worse: 11.0% on Embervale and 12.3% on Wyrmland. Session 17 had found the same thing: culture on safe land loses games. So "Run the realm" now buys, in order:
1. an urgent fort (a threatened capital, choke points facing an army)
2. markets where they pay
3. a barracks where there's nowhere to recruit
4. one level of culture a turn, only where it protects (the capital and choke points facing an army)

Culture for its own sake is left to "Raise culture here" and "Grow the economy". Variants tried, Captain + Steward on Embervale:

| Variant | Won |
|---|---|
| Culture by payback (the first version) | 11.0% |
| Culture where it holds, plus markets | 14.0% |
| Forts and markets only | 18.7% |
| **Forts, markets, and culture only where it protects (built)** | **16.0%** |

On Wyrmland the built variant reaches 18.3% (forts and markets only: 19.0%). The built one keeps some culture because "Run the realm" means all building and culture.

**The default stays at 20%** (the orchestrator's default), but this is a real cost on small maps until culture and buildings pay more. **For Nate:** keep 20%, or start at 10% until the balance pass?

## 3. How many orders do leaders write?
From `s18-leaders.ts` (a delegating seat):

| Table | Leader on Run the military | Steward on Run the realm | Most in one turn (both) |
|---|---|---|---|
| Embervale, 4 | 7.8 a turn | 1.5 a turn | 16 |
| Wyrmland, 10 | 6.9 a turn | 0.7 a turn | 26 |

The Leader's orders are attacks, chain hops, recruits and the moves that bring troops to the front. The Steward's are buildings and culture. It saves up between purchases, so most turns it writes nothing and every few turns it writes one or two.

With all eight leaders commanded (4 Leaders, 4 Stewards, `s18-speed.ts`), one plan wrote up to 38 orders.

## 4. Speed
The goal: all the leaders' plans for one player stay well under 50 ms a turn at 10 players on Wyrmland.

| Case | Average | 95th percentile | Worst |
|---|---|---|---|
| A delegating seat (2 leaders), 10 players, Wyrmland, whole games | 0.7 ms | 1.4 ms | 6.3 ms |
| All 8 leaders commanded, 10 players, Wyrmland, turns 20–30 | 3.2 ms | 6.7 ms | 8.1 ms |

## 5. The Captain is unchanged
Govern is gone. The Captain used to set captured generals to Govern; now it keeps them and plans its whole realm itself. Apart from that, its games are identical to session 17's with Govern switched off: the same board, gold, deals and dice on three fixed games (`s18-captain-same.ts`). Its fingerprint test is pinned again with that note.

# Session 20: leaders that finish the job, the Marshal plays like a person

*Nate's play test (Rootholm, 9 Marshals): with 95% of the map his Leader on "Run the military" hoarded gold, moved troops away from the fight and wrote few orders, and a 2-territory rival won back a chunk of the map. Fog on, diplomacy on, 300–500 games a line, seats rotated. "Before" is session 19's brain (commit `91b7588`) run through the same scripts and seeds as "after". Raw outputs: `docs/sims/s20-*.txt`. Scripts: `apps/sim/scripts/s20-mopup.ts` (the mop-up fixtures), `s20-leaders.ts` (purses and orders), `s20-marshal.ts` (one change at a time, the tables, the headline), `s20-nohoard.ts`, `s20-trace.ts`.*

## Why the leaders didn't finish (what the traces showed)
- **The capital's army was frozen.** Captured Leaders arrive at your capital with no command, and "a leader with no command keeps its army for you" meant Run the military never touched the biggest army in the realm (864 troops idle for five turns in one trace). Now only your own Leader with no command keeps its army; a captured one is just standing there.
- **Recruits all went to one site**, which a rival sometimes took before the recruit ran: the whole purse sat unspent that turn (a purse of 176 spent 0).
- **Reinforcements moved one step a turn**, and front stacks shifted sideways toward a spearhead (away from the remnant's army). A remnant's army then broke out through land held by 1 troop and chained through four or five territories a turn.
- **Strikes landed late:** recruits queued first gave the remnant four rounds to recruit (1 troop became 7, and a 6-troop strike called itself off).
- Also found: **a turn changed the game it started from** (the replay's board shared the leaders' purses), which made purses look fuller than they were in the old measure. Fixed in the engine, with a test.

## Finishing: the mop-up fixtures
20 positions from real Marshal games (7 Embervale 4, 7 Wyrmland 6, 6 Rootholm 9), each at the moment one seat passed 85% with two or three rivals left (`packages/bots/test/fixtures/mopup/`). The leading seat is played by a delegating player (Leader on Run the military with 80%, Steward on Run the realm with 20%), by its own Marshal, or with every military leader on Clean up. A wider set (60 positions, each played with 3 sets of dice: 180 runs) checks the numbers aren't luck. Turns until every rival is out:

| Seat | Set | Before: median | within 2 | within 4 | not in 15 | After: median | within 2 | within 4 | not in 15 |
|---|---|---|---|---|---|---|---|---|---|
| Leader (Run the military) | 20 fixtures | 7 | 20% | 30% | 2 | **3** | 30% | **80%** | 0 |
| Marshal | 20 fixtures | 6 | 20% | 45% | 1 | **3** | 30% | **80%** | 0 |
| Clean up (every leader) | 20 fixtures | — | — | — | — | **3** | 50% | 80% | 0 |
| Leader | 180 runs | 6 | 6% | 28% | 6 | **3** | 41% | **85%** | 1 |
| Marshal | 180 runs | 6 | 9% | 29% | 8 | **3** | 41% | **84%** | 1 |
| Clean up | 180 runs | — | — | — | — | 3 | 36% | 73% | 0 |

**The target ("2 turns or fewer in most, never more than 4") isn't met:** about 40% finish within 2 turns and 80–85% within 4. The slow ones are real fights, not mop-ups: positions where the rivals' armies match ours (Embervale at turn 17: our 70 troops spread over 35 territories against their 71 in three stacks), or two armies of 354 and 234 on Wyrmland. The structural limit is the round order: a remnant's army moves in round 1 half the time, so it slips a strike unless the ring is already standing from the turn before. Clean up with several leaders is as fast in the median and slower in the tail (each leader takes only its share of your land, and captured leaders have no purse unless you give them one).

## Never hoarding, and orders a turn
A delegating seat (80/20) against Marshals, 300 games a line. Unspent gold is what's left in its military purses once that turn's orders have run.

| Table | Unspent a turn (before → after) | Turns with a troop's worth or more left | Leader's orders a turn | Marshal in the same seat, same view, same gold |
|---|---|---|---|---|
| Embervale 4 | 3.5 → **1.7** gold | 10.8% → 8.0% | 5.6 → **7.2** | 5.8 → 7.6 |
| Wyrmland 6 | 5.4 → **1.5** | 10.5% → 6.3% | 8.0 → **10.8** | 8.4 → 11.2 |
| Rootholm 9 | 8.4 → **2.0** | 9.5% → 6.4% | 9.6 → **15.5** | 10.2 → 16.0 |

The Leader matches or beats the Marshal's count on **90–92% of turns**; on average it's about 0.4 orders behind (the Marshal also turns in Spoils and sends spies). The turns still ending with gold are recruit sites captured mid-turn along with their fallback (a plan can't see that coming), or a leader with nowhere to recruit, which now says so ("Saving 32 gold: nowhere to recruit until the barracks at Galeholt is up"). Finishing a rival, a Leader writes dozens of orders a turn (21 in the screenshot position; up to about 60 on Rootholm).

## Anticipate and counter
Leaders on Run the military with it against without (500 games, against Marshals): Embervale 27.8% → **30.8%** (fair 25), Wyrmland 6 25.0% → 25.6% (fair 16.7); land lost a turn unchanged (2.49 / 3.89). A small gain on the small map, none measurable on the big one. It's in the shared judgement, so Marshals use it too (one Marshal against Captains on Wyrmland: 29.2% without, 33.4% with).

## Push back and Clean up in play
- **Push back** on each of the 20 fixtures (the first rival): every attack it plans is on that rival's land or the empty land next to it, never a third party's (a test), and its panel line names what it's going for and the army it keeps clear of.
- **Clean up**: the leaders on it share the rivals out (on every fixture with a captured Leader, the two take different rivals; a test). Its numbers are in the table above.

## The Marshal: one change at a time (500 games)
| Change | Embervale 4 (fair 25%) | Wyrmland 6 (fair 16.7%) | Kept? |
|---|---|---|---|
| **Build like the Steward** (every Marshal; the delegating player's rate against them) | 27.2% → 32.4% (worse for the Marshals) | 28.8% → **18.4%** | **Yes, on roomy tables only** (more than 12 territories a player); on Embervale it's off |
| Twice the Steward's share | — | 13.0% (overshoots) | No |
| **Hold what matters** (one changed Marshal against unchanged: guard, reach, fort) | 24.8% | **19.4%** | **Yes, on roomy tables** (on Embervale it cost 3 points against Captains) |
| Fort only | 25.6% | 18.2% | (part of the above) |
| **Pick the best region** (one changed Marshal, from a third of the map) | 26.8% | 16.6% | **No**: doesn't cost, doesn't win |
| Lean on crowded tables (no markets, culture or spies; delegate-100's rate) | 34.6% → 41.2% | — | No |
| The Leader goes with the main attack (one changed Marshal) | 29.0% | 16.0% | No (didn't move the delegating seats) |
| Multi-hop marches (6 hops a turn; a delegating seat's rate) | 29.3% | 20.7% | No |
| While cleaning up (75% of the map): no building, no border guards | — | — | Yes (one mop-up fixture went from unfinished to 7 turns) |

## The delegating player against Marshals (500 games)
| Seat | Embervale 4 (fair 25%) | Wyrmland 6 (fair 16.7%) |
|---|---|---|
| delegate-80, before | 32.4% (1.30×) | 28.8% (1.73×) |
| **delegate-80, after** | **27.2% (1.09×)** | **16.8% (1.01×)** |
| delegate-100, before | 40.6% (1.62×) | 16.8% (1.01×) |
| **delegate-100, after** | **34.6% (1.38×)** | **10.4% (0.62×)** |

delegate-80 is within 3 points of fair on both maps. **delegate-100 on Embervale is still above the 1.2× target.** What it isn't (each tested at 500 games): the personalities' styles (Marshals in your leaders' neutral style: 37.0%), the Leader's +20% (its Leader staying home: 36.2%), how it talks (as a Marshal: 36.2%), or the Marshals' Leader going along (37.2%). It shows only on the crowded 4-player map; on Wyrmland it's 0.62×. The next thing to try is the Spoils and missions (a delegating seat never spends on missions and turns Spoils in only at the hand limit).

## Finishing games, and the opening (tables of Marshals, 500 games)
| Table | Median length | At the 60-turn cap | Half the map by turn 10 | Halfway leader won |
|---|---|---|---|---|
| Embervale 4 | 27 → **24** | 2.4% → 0.8% | 37.8% → 35.2% | 70.8% → **57.4%** |
| Wyrmland 6 | 48 → **40** | 28.8% → **16.2%** | 4.6% → 1.0% | 63.5% → **52.0%** |
| Wyrmland 8 | 60 → **47** | 57.0% → **28.6%** | 0% → 0% | 44.8% → 45.8% |
| Rootholm 8 | 60 → **48** | 85.2% → **31.4%** | 0% → 0% | 51.3% → 52.9% |
| Rootholm 10 | 60 → 58 | 93.8% → **45.0%** | 0% → 0% | 38.1% → 41.6% |

The opening isn't faster (half the map by turn 10 is the same or lower everywhere) and the halfway leader wins less on the smaller tables; on the 8–10 player tables it's within the noise (about ±2.5 points). Bot games on the big maps now mostly end before the cap (Rootholm 10 still has 45% at the cap: ten Marshals ganging up on whoever leads is slow).

## The headline re-run (500 games a line)
**One Marshal of each personality against Captains** (before → after):

| Table (fair) | Conqueror | Blitzer | Turtle | Schemer | Opportunist | Merchant | Average |
|---|---|---|---|---|---|---|---|
| Embervale 4 (25%) | 43.2 → 44.2% | 41.2 → 43.0% | 30.8 → 30.6% | 35.6 → 36.8% | 43.8 → 42.0% | 39.2 → 38.6% | **39.0 → 39.2%** |
| Wyrmland 6 (16.7%) | 26.6 → 31.4% | 27.0 → 27.2% | 32.2 → 34.8% | 26.4 → 28.6% | 29.6 → 28.4% | 36.0 → 41.2% | **29.6 → 31.9%** |

**The strong stand-in** (the Conqueror planning with fog off) against 5 Marshals on Wyrmland: 22.4% → 23.6% (fair 16.7%; within the noise). No table is weaker beyond the noise.

## Speed (Krakenmere, 10 players, `s19-speed.ts`)
Resolving a turn 6.5 → 7.6 ms on average (worst 25 → 29 ms); all ten bots planning a turn 7.6 → 10.9 ms (worst 33 → 34 ms); one Marshal 0.7 → 1.3 ms (worst 8 → 16.5 ms). More orders cost a little time; nothing near the 50 ms goal.
