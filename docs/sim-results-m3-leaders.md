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


# Session 20c: mass and sweep, the security blanket, and leaders with personalities

*Nate's second note on session 20: late in a game our recruiting dwarfs theirs, so a remnant's army should never match ours where they meet, and anything they take should be taken straight back. Fog on, diplomacy on, seats rotated. "Before" is session 20's code (commit `215c15b`) run through the same scripts and seeds as "after". Raw outputs: `docs/sims/s20c-*.txt`. Scripts: `apps/sim/scripts/s20c-mopup.ts` (the mop-up fixtures with Nate's measures), `s20c-play.ts` (whole games: retakes, land lost, troops' distance from the action, the Leader on the main chain, what each seat buys and how it chains), `s20c-kept.ts` and `s20c-why.ts` (tracing what the remnants kept), `s20c-at.ts`, `s20c-rider.ts`, `s20c-sig.ts` (session 17's personality signatures over 100 games).*

## What the traces showed (why the remnants got away)
- **A remnant's army roamed through our 1-troop interior** while our strikes landed where it had been: one 60-troop army on Embervale chained through five of our territories a turn for four turns.
- **Each order plays in its own round, and a remnant writes only a few**, so its army moves in the first rounds: whatever we queue first plays before it moves, the rest after. Session 20's ring was built from marches that played too late.
- **A remnant recruits its whole income and chains out the same turn** from a territory showing 1 troop (its recruit site: a capital, a barracks, or a province it holds whole, sometimes with land we'd never seen).
- **Recruits at full-province sites fizzled** when the remnant took one territory of the province earlier in the turn, so the purse went unspent.
- Smaller causes: a staging territory next to their army fell before the mass arrived; a storm had closed the crossing a strike needed; a remnant's last land was remembered under a House already knocked out, which the sweep treated as off limits; the remnant's last territories were in land we'd never seen.

## Finishing: the mop-up fixtures (before → after)
The 20 fixtures (85–95% held, two or three rivals left) and the wide set (60 positions, 3 sets of dice each: 180 runs). The leading seat as a delegating player (Leader on Run the military 80%, Steward on Run the realm 20%), as its Marshal, or with every military leader on Clean up. 15 turns at most.

| Seat | Set | Median turns | Within 2 | Within 3 | Within 5 | Past 5 |
|---|---|---|---|---|---|---|
| Leader | 20 fixtures | 3 → **2** | 30% → **90%** | 60% → **100%** | 85% → **100%** | 3 → **0** |
| Marshal | 20 fixtures | 3 → **2** | 30% → **90%** | 65% → **100%** | 90% → **100%** | 2 → **0** |
| Clean up | 20 fixtures | 3 → **2** | 50% → **90%** | — → **100%** | — → **100%** | 0 |
| Leader | 180 runs | 3 → **2** | 41% → **77%** | 69% → **92%** | 92% → **99%** | 14 → **1** (6 turns) |
| Marshal | 180 runs | 3 → **2** | 41% → **74%** | 72% → **92%** | 93% → **99%** | 13 → **1** (6 turns) |
| Clean up | 180 runs | — → **2** | — → **76%** | — → **92%** | — → **99%** | **1** (6 turns) |

**Targets met:** median 2 turns, 90% within 3 (92% on the wide set, 100% on the fixtures). **One run past 5** on the wide set (6 turns, `wyrmland-6-140` with one set of dice; its other two finish in 5): a rival there still held two real armies (the position is a fight, not a mop-up) and our mass reached the second only on the next turn.

**Nate's measures, the Leader (20 fixtures / 180 runs), before → after:**

| Measure | 20 fixtures | 180 runs |
|---|---|---|
| "Got away": a rival still held land it took from us when the turn ended | 65% → **25%** of positions (6.4 → **0.40** territories a position) | 52% → **17%** (3.0 → **0.62**) |
| A rival took any territory at all (even one taken back the same turn) | 95% → 80% (14.9 → 6.2 a position) | 79% → 69% (7.6 → 4.8) |
| Orders a turn while finishing | 55 → **134** (most 131 → 320) | 49 → **105** (most 160 → 277) |
| Spare troops more than 3 steps from where the rivals were, as the turn ended | 22% → **14%** | 26% → **8%** |
| The purse recruited within 2 steps of a rival's land | 87% → 71% | 78% → 63% |

**The "got away" target (under 10%) isn't met: 17% on the wide set, 25% on the fixtures** (the Marshal: 18% and 30%). What they still keep, traced on the fixtures (`s20c-kept.ts`): in 8 territories over 20 positions, (1) **real armies breaking out**: an army of 11 to 81 troops chains 6 or 7 hops through land we couldn't hold in the first rounds and stops where our sweep can't safely follow that turn (half the cases); (2) **one fixture is a war, not a mop-up** (`wyrmland-6-24`: the two rivals' armies of 354 and 234 together outnumber our 537), where a 228-troop army takes a territory and keeps it; (3) a few transfers too small to retake (the blanket's 3 troops against 4–5). Everything the remnants took and *didn't* keep was taken straight back the same turn by the sweep or the blanket.

**Recruiting near the fight fell** (87% → 71% within 2 steps) on purpose: a full-province site next to their land can be lost before its recruit runs, so sites that can't be lost that turn come first (the capital, a barracks, a province not touching their land), and the troops then march as many hops as it takes. The purse is still spent every turn.

**Why each change is there** (the 20 fixtures with the Leader, one change at a time as the planner was built, within 2 / within 3 / kept a position): the first mass and sweep 25% / 45% (worse: recruits fizzling, no pounce); robust recruit sites and the pounce on an army that marches out 40% / 65%; holds from two steps away, reach worked out from army strength, the Initiative only on ready strikes 55% / 70% / 1.9; recruit sites as armies 55% / 70% / 3.0 (within the noise of 20 positions); the blanket drawn from land they can't reach 50% / 65% / 1.75; unseen land counted as theirs for recruit sites, 8-hop reach 60% / 80% / 1.0; staging out of their reach 65% / 85% / 1.1; one shared blanket flow (orders 1339 → 293 at most) 60% / 90% / 1.0; storms and the main mass sweeping every remnant 70% / 85% / 0.45; unseen land joining theirs swept 80% / 95%; a fallen House's land read as its conqueror's, the main remnant never ringed 95% / 95%; the Leader recruited an army where it stands 95% / 100% / 0.40.

## Planning time
Krakenmere, 10 players, 20 games, every system on (`s19-speed.ts`, run alone): **all ten bots planning a turn 11.7 → 12.5 ms on average** (95% of turns 22.7 → 24.2 ms; the worst single turn 43 → 67 ms); one Marshal 1.4 → 1.5 ms (worst 17 → 35 ms); resolving a turn 8.0 → 9.9 ms. The average is far inside the 50 ms limit; one turn in 981 went over it (a Marshal's finishing turn with a long sweep). A Leader finishing on Rootholm plans in about 30 ms (single-threaded), writing up to about 300 orders.

## Part 2: defensible pauses, the sweep of our own land, troops near the action, the Leaders used
**One change at a time** (300 games; one changed Marshal among unchanged Marshals, and a delegating seat's leaders with the change against Marshals; fair 25% / 16.7%). Single-seat lines at 300 games swing about ±4 points: "carry", which can't touch the delegating seat at all, shows it.

| Change | Changed Marshal (Embervale / Wyrmland 6) | Delegating seat | Kept? |
|---|---|---|---|
| Defensible pauses, 1 hop back | 25.3% / 17.7% | 26.7% / 17.7% (lost a turn 2.32 → 2.20, 3.70 → 3.57) | **Yes** (not the Blitzer) |
| Pauses, 2 hops back | 24.3% / 16.3% | 24.0% / 21.3% | No (mixed) |
| Home sweep queued first | **20.0%** / 14.3% | 24.0% / 12.7% | No (costs wins) |
| **Home sweep after the attacks** | 24.7% / 13.0% | 27.3% / 16.0% (retaken within a turn 28 → 33% on Wyrmland) | **Yes** |
| Marches as far as they need (20 hops) | 23.0% / 14.0% | 26.3% / 16.7% (troops 2.00 → 1.89 steps from a rival army) | **Yes** |
| The Leader with the main effort from turn 1 | 23.7% / 13.7% (Leader on the main chain 2.8 → 55.8%, 0.9 → 38.0%) | 27.0% / 15.0% | From turn 15 (below) |
| Captured leaders carried | 27.0% / 13.0% | (no effect: 28.0% / 13.3%, as without) | **Yes** |

**The opening:** with everything on and the Leader leading from turn 1, tables of four Marshals on Embervale reached half the map by turn 10 in **50%** of games (session 20: 35%). Switching each change off found the cause: the Leader going with the main attack (+20%) in the opening made the strongest opener snowball. From turn 15 it's back to 35.7%; the pauses and long marches alone moved it only within the noise.

**With everything on (final code), before → after:**

| Measure (300 games) | Embervale 4 | Wyrmland 6 |
|---|---|---|
| Territories of ours retaken within a turn of being lost (a table of Marshals) | 31.3% → 30.3% | 28.7% → **31.4%** |
| … the delegating seat | 33.6% → 32.5% | 28.3% → **31.1%** |
| Land lost a turn (Marshals) | 2.43 → 2.33 | 3.74 → 3.76 |
| … the delegating seat | 2.36 → 2.22 | 3.71 → 3.66 |
| Spare troops' distance from the nearest rival army, in steps (Marshals) | 1.62 → **1.54** | 2.06 → **1.87** |
| … the delegating seat | 1.68 → 1.59 | 1.94 → 1.83 |
| The Marshal's Leader on its main chain (share of turns it attacked) | 0% → 15% (**46% from turn 15**) | 0% → 14% (**30% from turn 15**) |
| … the delegating seat's Leader | 33% → 39% (47% from turn 15) | 24% → 28% (31% from turn 15) |
| Orders a turn (Marshals) | 8.3 → 10.1 | 12.5 → 20.6 |

The sweep of our own land shows mainly on the big map (more retaken within a turn); land lost a turn is flat or a little lower. The point Nate made (troops at the front, nothing exposed behind) shows in the distance measure, not in win rate, as he expected.

**Captured leaders work together:** with your Leader and a captured Leader both on Clean up, the captured one writes nothing of its own but the troops its purse pays for, its army moves under your Leader's orders with its portrait on them, and both say "Finishing them off" (a test, on every fixture with a captured Leader standing on troops). On the mop-up fixtures Clean up is now as fast as one Leader running the military (above); session 20's Clean up split our land between leaders and was slower in the tail.

## Nothing else got weaker (500 games a line)
**One Marshal of each personality against Captains** (session 20 → 20c):

| Table (fair) | Conqueror | Blitzer | Turtle | Schemer | Opportunist | Merchant | Average |
|---|---|---|---|---|---|---|---|
| Embervale 4 (25%) | 44.2 → 41.8% | 43.0 → 42.6% | 30.6 → 30.0% | 36.8 → 39.8% | 42.0 → 42.0% | 38.6 → 37.2% | **39.2 → 38.9%** |
| Wyrmland 6 (16.7%) | 31.4 → 31.0% | 27.2 → 28.0% | 34.8 → 39.0% | 28.6 → 31.0% | 28.4 → 27.8% | 41.2 → 38.6% | **31.9 → 32.6%** |

Within the noise (about ±2 points a cell) on Embervale and a little stronger on Wyrmland. **The strong stand-in** against 5 Marshals on Wyrmland: 23.6% → 26.2%.

**A delegating player against Marshals:** 80/20: 27.2% → **27.0%** on Embervale, 16.8% → **18.2%** on Wyrmland 6 (fair 25 / 16.7). All-in (100/0): 34.6% → **38.6%** on Embervale (1.54×, the open item Nate accepted until 20b), 10.4% → 9.6% on Wyrmland.

**Tables of Marshals (the opening and the finish):**

| Table | Median length | At the 60-turn cap | Half the map by turn 10 | Halfway leader won |
|---|---|---|---|---|
| Embervale 4 | 24 → 22 | 0.8% → 0.2% | 35.2% → 37.2% | 57.4% → **55.2%** |
| Wyrmland 6 | 40 → **36** | 16.2% → **11.4%** | 1.0% → 1.4% | 52.0% → 52.6% |
| Wyrmland 8 | 47 → 44 | 28.6% → **22.6%** | 0% → 0% | 45.8% → **37.7%** |
| Rootholm 8 | 48 → 43 | 31.4% → **18.8%** | 0% → 0% | 52.9% → **46.0%** |
| Rootholm 10 | 58 → 50 | 45.0% → **30.0%** | 0% → 0% | 41.6% → 41.0% |

The opening is unchanged within the noise (Embervale's half-map 37.2% against 35.2%, about one standard error), the halfway leader wins less or the same everywhere, and bot games end sooner (fewer at the cap on every table). **The Captain is unchanged** (its fingerprint tests).

## Leaders with personalities (300 games, a delegating seat against Marshals)
The seat's Leader (on Run the military, 80%) or Steward (Run the realm, 20%) with a personality; Neutral is today's. "Spent" is gold a game.

| Seat | Embervale 4 (fair 25%) | Wyrmland 6 (fair 16.7%) | How it plays differently |
|---|---|---|---|
| Neutral | 28.3% | 16.7% | (hops 2.43 / 3.50 a turn; retreats 0.10 / 0.21; buildings 64 / 121, culture 34 / 104) |
| Leader: the Conqueror | 26.7% | 18.0% | more orders (11.4 / 22.1 a turn, Neutral 10.9 / 20.7), its troops massed on its main front |
| Leader: the Blitzer | 27.7% | 16.7% | **never pulls back** (retreats 0.00 a turn) and never stops a chain short |
| Leader: the Opportunist | 27.7% | 18.3% | goes for whoever just fought: different orders in a few positions in 10 |
| Leader: the Schemer | 28.7% | 18.7% | a little more chaining (hops 2.49 / 3.54) |
| Steward: the Turtle | 25.0% | 15.3% | **forts and culture first**: buildings 49 / 98, culture 53 / 164 |
| Steward: the Merchant | **34.3%** | 20.0% | **markets first**: buildings 66 / 125, troops 600 / 1604 (Neutral 533 / 1466) |

**Within 3 points of Neutral:** every Leader personality, and the Turtle (−3.3 / −1.4). **The Merchant isn't (+6.0 / +3.3).** Its first version (markets first, and culture for its income at a lower bar) was +10 / +7; with Neutral's culture bar it was +7 / +4, and fortifying a threatened capital first it's +6 / +3.3. What's left is the order itself: Neutral's Steward stops and saves up whenever it can't yet afford an urgent fort, and the Merchant keeps buying markets that pay back. That points at Neutral's saving, not the Merchant (a question for Nate).

**How visible each is:** the Steward personalities are plainly different (what they buy). The Leader personalities differ less than the Marshal's do, because what made the Marshals differ is mostly what they buy and their deals, which a military leader doesn't do, and every Marshal (and leader) attacks at least as hard as the shared floor (chain margin, hops, troops sent). What's left: the Blitzer never pulls back or pauses, the Conqueror masses on one front, the Opportunist and Schemer go for whoever just fought or is weakened. On the mop-up fixtures all of them finish the same way (mass and sweep). A Neutral leader's orders are pinned unchanged (a fingerprint over the 20 fixtures, the same as after Part 2).

## Personality signatures (session 17's test, now over 24 games)
Every Marshal now pauses and marches far, which put the Conqueror's fronts a turn at the Blitzer's edge in the test's 8 fixed games. Over 100 games the signatures are as before (`s20c-sig.ts`): fronts a turn Conqueror 1.21 / Blitzer 1.27 (before 1.21 / 1.28), land taken by turn 8 Blitzer 20.8 (others 14.9–19.5), forts and culture by turn 10 Turtle 7.6 (Blitzer 1.0). The test now plays 24 games.


# Session 20d: no hoarding for real, a sweep that covers the fog, and the Steward's walls

*Nate's play test of session 20b's build: his Leader on Run the military kept gold turn over turn, the finish's sweep skipped land in the fog, and his Steward should build with a plan and wall up fast. Fog on, diplomacy on, 300 games a line, seats rotated. "Before" is the code as the session started (commit `7642cda`), run through the same scripts and seeds as "after" (`546d74c` and its two small follow-ups). Raw outputs: `docs/sims/s20d-*.txt`. Scripts: `apps/sim/scripts/s20d-purse.ts` (the purse turn by turn, and the unspent share), `s20c-mopup.ts` (now with the "never ordered" count and `FOG=off`), `s20d-walls.ts` (the Steward's walls), `s20-marshal.ts` (fairness, the tables, the headline).*

## Part 1: what was keeping the gold (the trace)
A delegating seat played the way Nate plays (Leader on Run the military with 20%, 50% or 80% of the income, Steward on Run the realm, the treasury spent on troops at the capital) against 5 Marshals on Wyrmland and 8 on Rootholm, traced turn by turn for 10 turns (`s20d-purse.ts trace`). A typical Wyrmland game at 50%:

| Turn | Purse as the turn starts | Its orders spent | Kept | Why |
|---|---|---|---|---|
| 2 | 7 | 6 (3 troops) | 1 | an odd gold coin (a troop costs 2) |
| 3–4 | 10 | 10 | 0 | |
| 5 | 17 | 16 | 1 | odd coin |
| 6–9 | 22–34 | all | 0 | |
| 10–13 | 28–45 | all but 1 | 0–1 | odd coin |

**What we found, in plain words:**
1. **The planner was already spending the purse** (on 94–97% of turns in the sims). **What Nate saw was the panel:** it showed the purse *as the turn started*, before the Leader's own orders spent it. The purse is refilled with its budget at the end of every turn, so during planning it always looked full ("Purse 46g"), turn after turn, and so did the top bar ("46 in purses"). **Fixed:** the panel, its header and the top bar now show what's left once this turn's orders are paid for: "Purse 0g · 50% of income · 9 orders this turn (18g)".
2. **A recruit whose site was lost before it ran** (a rival took the territory earlier in the turn) fell back to one other site; if that was lost too, the gold stayed. **Fixed:** a leader's recruit now tries up to four other sites of yours, safest first.
3. **Saving for a barracks** with nowhere at all to recruit (the capital lost, no barracks, no province held whole): it waited until it had 14 gold before building one. **Fixed:** with nowhere at all to recruit it builds the barracks as soon as it can pay for it (6 gold), and it names a reason only when it really keeps gold (it said "Saving 0 gold" once in the browser check).
4. **An odd gold coin** can't buy anything (a troop costs 2) and waits for next turn. That's most of the "kept" turns at a 20% budget, where purses are small.

**The unspent share at the end of each turn's orders, before → after** (300 games, every turn the Leader had a purse):

| Table | Budget | Under a troop's cost unspent (0–1 gold) | Under 10% of the purse unspent | Average unspent share |
|---|---|---|---|---|
| Wyrmland 6 | 20% | 96.5% → **97.5%** | 71.1% → 70.4% | 9.9% → 9.4% |
| Wyrmland 6 | 50% | 95.4% → **96.8%** | 87.2% → 87.7% | 7.0% → 5.8% |
| Wyrmland 6 | 80% | 93.8% → **96.2%** | 92.8% → **95.3%** | 7.2% → 4.9% |
| Rootholm 9 | 20% | 95.3% → **96.7%** | 72.4% → 73.0% | 10.3% → 9.1% |
| Rootholm 9 | 50% | 93.5% → **96.2%** | 89.8% → **92.0%** | 8.0% → 5.6% |
| Rootholm 9 | 80% | 93.2% → **95.4%** | 92.4% → **94.4%** | 7.2% → 5.2% |

**Against the target:** "never more than one troop's cost unspent when a recruit site exists" holds on every turn but the few where every site it tried was lost before its recruit ran (about 1 turn in 500) or it truly had nowhere to recruit (named in the panel). "Under 10% of the purse on 9 turns in 10" is met at 80% (94–95%) and on Rootholm at 50% (92%), nearly on Wyrmland at 50% (88%); at 20% it's 70–73%, all of it the odd coin: with a purse under 10 gold, the 1 gold it can't spend is more than 10%. Counting that coin as spent, every budget is at 96–98%.

**In the browser** (the built game, a Wyrmland 6 game against Marshals, Aldric on Run the military with 50%, turns 1–12, read off the Leaders panel each turn): "Purse 0g" or "Purse 1g" after its orders on every turn, its orders spending 6–26 gold a turn (purses of 9–21 gold as each turn started).

**The mop-up fixtures don't finish slower:** the 20 fixtures median 2 turns, 90% within 2, all within 3, before and after (below).

## Part 2: the sweep covers the fog
**The new count, "never ordered":** of every territory a rival held as each finishing turn was planned (the true board; rivals under a truce or joint war with the leading seat left out), the share no order of ours went for that turn, and the same for those in the leading seat's fog.

**What the traces showed was left out** (the 20 fixtures and the wide set, fog on): (1) land in the fog the chain visited last and never reached once its troops ran out; (2) **land we'd never seen at all** that didn't touch anything we knew was theirs (whole pockets of the remnant: most of the misses on the wide set); (3) on the first finishing turn, smaller groups' masses that found no spare troops left; (4) armies far too big to strike (234 and 354 troops in `wyrmland-6-24`, a war rather than a mop-up); (5) one bug: while cleaning up, a rival bordering whoever the planner read as running away was skipped as a "shield".

**What changed:** the sweep's set is everywhere the remnant **is**, **might be** (all land never seen, and fog within 2 steps of theirs or of never-seen land that was empty, theirs or ours when last seen) and **could move to**; the fogged parts take their turn by distance; **more chains** sweep what the first ones didn't reach, from the spare troops left, strongest first; the blanket covers our land next to the fog; while cleaning up every rival is one to finish (deals still hold).

**Before → after, the Leader on Run the military** (20 fixtures; 60 wide positions × 3 sets of dice = 180 runs):

| Measure | 20 fixtures, fog on | 20 fixtures, fog off | 180 runs, fog on | 180 runs, fog off |
|---|---|---|---|---|
| Rival land never ordered (all of it) | 10.3% → **5.1%** | 9.8% → 6.8% | 12.4% → **8.7%** | 10.5% → 10.6% |
| … of it in the fog | 22.0% → **13.0%** | — | 23.5% → **12.5%** | — |
| Median turns to finish | 2 → 2 | 2 → 2 | 2 → 2 | 2 → 2 |
| Within 3 turns | 100% → 100% | 90% → 90% | 91% → 94% | 94% → 94% |
| "Got away" (kept land it took) | 20% → 20% | 30% → 30% | 18% → 18% | 23% → 23% |
| Orders a turn while finishing (most) | 133 (320) → 133 (320) | 127 (290) → 124 (290) | 104 (277) → 107 (277) | 104 (303) → 104 (303) |

(The "before" column is the session-start sweep played through this session's harness, so both sides count the same way; the Marshal's own finish gets the same sweep and its numbers are in `docs/sims/s20d-mopup-*.txt`.)

**Against the target:** the sweep under fog now misses about as much as it does with the fog lifted (**5.1%** against 6.8% on the fixtures, **8.7%** against 10.6% on the wide set), which was the point: fogged land is no longer left out. **It isn't near zero:** what's left is (1) the first finishing turn on the big maps, when the spare troops can't reach everything yet (the next turn sweeps the rest), and (2) armies too big to strike yet (struck once they march out). Two levers tried and dropped: capping the main mass so more troops are left for the other chains (no fewer misses, more orders), and a 2-troop blanket (a little fewer misses, more troops left behind and more land kept by the remnant).

## Part 3: the Steward's walls
**The plan, as built:** see the rules reference §14 ("Run the realm with a plan"): markets and barracks deep inside; forts on choke points facing a rival and on wall candidates; several culture levels in a turn; threatened (a rival army of 4+ within 2 steps of the capital's province, or a runaway whose land touches ours), everything into the wall; the Leader keeps 4 troops in walled land facing a rival. **The culture rule didn't change:** the engine and the queue always allowed several levels in one territory in one turn (one order a level).

**A delegating seat (Leader 80%, Steward 20%) against Marshals, 300 games, before → after:**

| Table (fair) | Win rate | Walled in | First wall (median turn) | Walled territories a game | Walled land holding more than 1 troop | Attacks on its walls a game (held) |
|---|---|---|---|---|---|---|
| Embervale 4 (25%) | 26.0% → **31.0–33.3%** | — → 66% of games | — → 13 | — → 1.4 | — → 77% | — → 0.06 (none held) |
| Wyrmland 6 (16.7%) | 20.7% → 19.0% (21.0% → 22.3% on the fairness seeds) | 20% → **77%** | 24 → **13** | 0.2 → **6.7** | 80% → 54% | 0.02 → 0.86 (2%) |
| Rootholm 8 (12.5%) | 13.0–14.0% → **10.3–11.7%** | 18% → **72%** | 27 → **12** | 0.2 → **8.4** | 50% → 40% | 0.00 → 1.08 (1.5%) |

**What it means:**
- **Walls go up early and often now** (from turn 12–13 in three games in four), and the capital's province is walled first.
- **They get attacked** on the big maps (about once a game) and **nearly always fall to that attack**: a Marshal attacks a wall only when it's sure, counting the garrison. What a wall buys is the attacks it puts off, which the sims can't count directly.
- **Fairness moved by map:** stronger on the smaller tables (Embervale +5 to +7 points, 1.24–1.33× fair), about the same or a little stronger on Wyrmland, and **weaker on Rootholm 8** (two seeds: 10.3% and 11.7%, against 14.0% and 13.0% with the plan off; 0.88× fair on average). On the big 8-player table the gold that goes into walls that then fall is gold not spent on markets.

**One change at a time on Rootholm 8 (300 games each, the delegating seat):**

| Change | Win rate | Walled territories a game |
|---|---|---|
| Plan off (session 20b's Steward) | 14.0% / 13.0% (two seeds) | 0.2 |
| Plan as first built (a runaway anywhere counts as a threat) | 10.3% | 8.5 |
| No runaway trigger at all | 12.0% | 7.6 |
| ... and steady walls only on the capital's province | 10.7% | 4.8 |
| ... and the rush only on the capital's province | 10.3% | 4.0 |
| ... steady on the capital's province, a 6-troop garrison | 11.3% | 4.6 |
| **A runaway counts only if its land touches ours (kept)** | **10.3% / 11.7%** (two seeds) | 8.4 / 8.6 |
| ... with no garrison (1 troop) | 9.3% | 7.8 |

The 4-troop garrison helps (9.3% without it). With no runaway trigger the seat was 32.7% / 24.7% / 12.0% on the three tables (more lopsided on Wyrmland); "a runaway that touches us" was kept because it matches Nate's rule while ignoring a runaway on the far side of the map. **A question for Nate below.**

**The two leaders together:** the Steward walls the province your Leader stands in (after the capital's), and the Leader keeps its garrison inside the wall. **The Marshal doesn't build this way yet** (its own realm share keeps session 20b's way): a Steward that makes delegating beat the Marshals on the smaller tables is, by Nate's rule, a behaviour the Marshal should adopt; that fits session 22's "the Marshal adopts the Merchant's lesson".

## Nothing else got weaker
**One Marshal of each personality against Captains** (300 games, before → after):

| Table (fair) | Conqueror | Blitzer | Turtle | Schemer | Opportunist | Merchant | Average |
|---|---|---|---|---|---|---|---|
| Embervale 4 (25%) | 41.3 → 41.3% | 44.7 → 44.7% | 27.3 → 27.3% | 38.0 → 38.0% | 44.0 → 44.0% | 35.3 → 35.3% | **38.4 → 38.4%** |
| Wyrmland 6 (16.7%) | 39.0 → 39.0% | 22.0 → 22.0% | 47.7 → 47.7% | 33.7 → 33.7% | 30.7 → 30.7% | 47.7 → 47.7% | **36.8 → 36.8%** |

Exactly the same games: the Marshal plays as before until it cleans up (its sweep changed with your leaders'), and by then those games are decided.

**Tables of Marshals:**

| Table | Median length | At the 60-turn cap | Half the map by turn 10 | Halfway leader won |
|---|---|---|---|---|
| Embervale 4 | 22 → 22 | 0.3% → 0.3% | 35.3% → 35.3% | 55.3% → 55.3% |
| Wyrmland 6 | 36 → 36 | 10.3% → 10.3% | 0% → 0% | 41.0% → 40.3% |
| Rootholm 8 | 44 → 44 | 21.0% → 20.3% | 0% → 0% | 47.3% → 47.0% |

The opening and the middle game are untouched (half the map by turn 10 the same everywhere); the finish's new sweep ends a few big games a turn or two sooner.

**The Captain is unchanged** (its fingerprint tests), and so is the Recruit.

## Planning time
Krakenmere, 10 players, 20 games, every system on (`s19-speed.ts`, run alone). **This machine was about 2.3 times slower today than in session 20c's measurement**: session 20c's own code (`776427d`), run today, plans in 29.1 ms where it measured 12.5 ms then (resolving a turn 24.0 ms against 9.9). Side by side today:

| Code | All ten bots planning a turn (average / 95% / worst) | Resolving a turn (average) |
|---|---|---|
| Session 20c (`776427d`) | 29.1 / 54.8 / 105.6 ms | 24.0 ms |
| Session start (`7642cda`) | 30.3 / 52.3 / 105.9 ms | 28.1 ms |
| **Session 20d** | **31.5 / 55.2 / 109.6 ms** | 28.5 ms |

So 20d plans about 4% slower than the session start (the Marshal is unchanged until it cleans up; the rest is noise and the finish's wider sweep), about 13 ms on session 20c's yardstick: the 50 ms average limit holds. (The Leaders and Stewards aren't in this measure: a seat of yours plans them once a turn.)

**Finishing turns** (the leading seat's whole plan, the Leader on Run the military, today's machine): the 20 fixtures 36.6 → **34.9 ms** on average (worst 85 → 69 ms); the 60 wide positions 68.5 → **25.4 ms** (worst 257 → 72 ms; the two runs are noisy, but not slower), with about 106–108 orders a turn (most 277). The orchestrator measured about 290 ms for a finishing turn on its own machine in session 20c.

# Session 23: your leaders' last fixes, and what the Marshal learned from them

*Raw runs: `docs/sims/s23-*.txt`. Scripts: `apps/sim/scripts/s23-tables.ts` (the delegating seat, all-Marshal tables with each personality's win rate and style, the Recruit), `s23-handout.ts` (the turn-54 save). "Before" is the code at the start of the session, run on the same games side by side (a copy of the Step 0 commit). 300 games a line, about ±2.5 points.*

## Part 1: idle gold handed back, a remnant judged honestly

**The handout** (Nate, Oct 10). A Steward with nothing more worth building keeps two turns of its budget, or what it would spend over the next two turns if that's more (it asks its own planner, with this turn's purchases made and its budget paid in each turn), and hands back the rest at the end of the turn, after every order. Under 5 gold isn't worth a report line. On the turn-54 save (`s20c-save.json`: Odo, the Turtle, Run the realm at 20%, 1,157 gold in its purse):

| Turn | Purse at the start | Bought | Kept | Handed back |
|---|---|---|---|---|
| 54 | 1,157 | 37 levels of culture (walls and income) | 110 | **916** |
| 55 | 170 | 2 | 120 | 43 |
| 56 | 181 | 2 | 122 | 51 |

In the browser (the same save, one turn on so your leaders plan afresh): the panel said "about 908 gold goes back", and 908 came back.

**A remnant judged honestly.** The "Duke Varric (17 territories left)" line in session 20d's screenshot was turn 54, cleaning up at 80% of the map (every rival is one to finish then), not turn 6. Before turn 15 the opening blocks finishing altogether. The rule is built anyway for what it was meant for: before cleaning up, a rival is down to a handful only when its known land plus the fogged land it could hold (land never seen that joins up with theirs, and fog within two steps) is a handful. **It applies to your leaders, not to the Marshal's own turn:** judged that way, the Marshals finished rivals later and all-Marshal games on Rootholm 8 ran about 3 turns longer (44.4 to 47.6 on average, 19% to 24% at the 60-turn cap, seed s23p2), over the session's limit. Counting less of the fog (never-seen land within two steps only) didn't change that (47.7).

**Part 1 alone** (seed s23p1): the delegating seat on Embervale 4 28.0% to 27.7% (1.12 to 1.11 times fair), Rootholm 8 10.0% to 13.3% (0.80 to 1.07 times). The Leader's purse is unchanged (Wyrmland 6 at 50%: 6.3% to 5.9% unspent; Rootholm 9 at 80%: 5.2% to 4.6%).

## Part 2: what the Marshal learned

**The Merchant's lesson** (on, for the Marshal and your Neutral Steward): a market that pays for itself before the game is likely to end comes before a fort that isn't urgent. Urgent: a rival army next door could take the land next turn (or a military leader asked for it), or the fort is the last piece of a wall. The game's likely length comes from the map's size (`leaders.steward.lesson`: 40 territories 22 turns, 120 territories 36, 200 territories 44, the straight line in between), and a market pays when its build turn, its price over its income and a spare turn fit in what's left. The Turtle keeps its forts first; the Merchant already builds markets first. Markets now stop when they'd no longer pay back (before: up to 4 turns before the 60-turn cap).

**The Steward's plan for the Marshal: tried, and left off.** Six ways, 300 games each on the same games (seed s23p2, `s23-part2-ab.txt` and `s23-part2-ab2.txt`):

| Marshals | Delegating seat, Embervale 4 / Wyrmland 6 / Rootholm 8 | All-Marshal Rootholm 8: length, at the cap | Games walled on Wyrmland, Conqueror / Merchant |
|---|---|---|---|
| Today (Part 1) | 1.17 / 1.02 / 0.91 | 47.6, 24% | 13% / 31% |
| The lesson | 1.12 / 1.06 / 0.85 | 48.0, 23% | 13% / 30% |
| The plan | 1.17 / **1.42** / **1.15** | **50.5, 37%** | **57% / 82%** |
| Both | 1.12 / **1.48** / 1.04 | **50.7, 38%** | **59% / 82%** |
| The plan, no wall garrison | 1.11 / 1.32 / 1.07 | 51.0, 37% | |
| The plan, walls round the capital only | 1.11 / 1.32 / 0.99 | | |

With the plan the Marshals got weaker against the delegating seat (Wyrmland 1.02 to 1.42 times fair), games on Rootholm got 3 turns longer with more than a third at the turn cap, and every personality walled up (the Conqueror in 57 to 69% of games instead of 13%), so they played more alike. Taking away the 4-troop garrison or walling only the capital didn't change that. **By Nate's own rule (a behaviour that beats the Marshals is one they adopt), the plan doesn't qualify for the Marshal:** it helps a seat whose Leader runs the military on 80% and whose Steward builds on 20%, but in the Marshal's single budget the wall money comes out of its army. It stays a switch (`judgement.realmPlan`, off). A question for Nate in PROGRESS.

## The delegating seat at fair (seed s23p2b, before and after)

| Table | Fair | Before | After |
|---|---|---|---|
| Embervale 4 | 25% | 33.0% (1.32x) | 31.3% (**1.25x**) |
| Wyrmland 6 | 16.7% | 21.7% (1.30x) | 22.7% (**1.36x**) |
| Rootholm 8 | 12.5% | 10.0% (0.80x) | 11.7% (**0.93x**) |
| The Moon Coast 6 (80) | 16.7% | 17.0% (1.02x) | 18.3% (**1.10x**) |
| The Crownlands 8 (100) | 12.5% | 16.7% (1.33x) | 14.3% (**1.15x**) |
| Ashwing 7 (160) | 14.3% | 11.3% (0.79x) | 13.3% (**0.93x**) |

Four of six tables are inside 0.85 to 1.2 times fair. **Embervale 4 and Wyrmland 6 are still above** (1.25 and 1.36 times; on another seed, s23p2, they were 1.17 and 1.02, so they move about 0.15 either way with the seed). What's left between your leaders and the Marshals there is the Steward's plan: walls up fast around the capital and the Leader's province, a garrison inside them. It's what makes the delegating seat strong on small and middle tables, and the Marshal can't use it without starving its army (above). The big tables (Rootholm, Ashwing) moved up to about 0.93 times with the handout (the gold goes into troops).

## All-Marshal tables (seed s23p2b, before and after)

| Table | Average length | Median | At the 60 cap | Halfway leader won |
|---|---|---|---|---|
| Embervale 4 | 22.9, 22.9 | 21, 21 | 0.7%, 0.7% | 56.0%, 55.3% |
| Wyrmland 6 | 41.1, 41.0 | 39, 39 | 17.3%, 15.0% | 43.0%, 41.1% |
| Rootholm 8 | 44.1, 43.7 | 43, 42 | 15.7%, 15.7% | 45.7%, 43.0% |
| The Moon Coast 6 | 31.3, 31.2 | 29, 29 | 3.3%, 2.7% | 58.0%, 57.5% |
| The Crownlands 8 | 34.7, 35.1 | 32, 33 | 6.7%, 7.0% | 60.3%, 58.2% |
| Ashwing 7 | 47.2, 46.9 | 47, 47 | 29.3%, 28.0% | 39.6%, 40.3% |

No table got longer.

## Each personality (all-Marshal, seed s23p2b, before and after: win rate as times fair; games walled and attacks a turn after)

| | Embervale 4 | Wyrmland 6 | Rootholm 8 |
|---|---|---|---|
| Blitzer | 1.22, 1.24 (0%, 3.3) | 0.38, 0.34 (1%, 4.0) | 0.34, 0.28 (1%, 4.3) |
| Conqueror | 0.88, 0.88 (2%, 3.0) | 1.06, 1.00 (14%, 4.5) | 1.02, 0.97 (13%, 4.9) |
| Merchant | 0.86, 0.82 (1%, 2.4) | 1.42, 1.40 (26%, 4.5) | 1.27, 1.37 (29%, 4.8) |
| Opportunist | 0.97, 0.97 (1%, 2.9) | 0.54, 0.66 (7%, 4.2) | 0.78, 0.72 (5%, 4.5) |
| Schemer | 1.11, 1.15 (5%, 3.1) | 0.90, 0.84 (13%, 4.0) | 0.66, 0.64 (13%, 4.3) |
| Turtle | 0.95, 0.93 (16%, 2.2) | 1.70, 1.74 (55%, 4.6) | 1.94, 2.03 (60%, 5.6) |

They still play differently (the Turtle walls in 55 to 60% of games on the big maps, the Blitzer almost never; the Turtle spends 49 gold on buildings on Embervale, the Blitzer 23). On the big maps the builders (Turtle, Merchant) still win most and the Blitzer least, as at the start of the session.

**Seen on the way:** your Leader with the Opportunist's or the Schemer's personality often plays like a Neutral one in the middle of a game under fog. Most of their attack traits are floored to the shared style, and the Opportunist's own (going for whoever just fought) rarely changes an order when most fights are in the fog. A mop-up test that looked for a difference at turn 16 had been finding it only through the old remnant quirk; it now looks at turn 28.

## The Captain, the Recruit, planning time
- **The Captain's fingerprint is unchanged:** `232617a30b1f8b47` (15,639 orders), at the start and the end.
- **The Recruit is still easy:** one Recruit against three Captains on Embervale wins 8.7% before and after (0.35 times fair).
- **The Marshals plan as fast as before** (Krakenmere 10, 20 games, every system on, run alone, side by side): all ten bots 10.9 and 11.5 ms (session start, two runs), 11.4 ms now; one Marshal 1.2 to 1.3 ms either way.
- **Your own leaders plan about 0.5 ms a turn slower** (a delegating seat on Wyrmland 6, 40 games: 1.5 ms to 2.1 ms): the handout's look-ahead (the Steward's planner run for the next two turns). That's over the 20% guideline in relative terms; reusing the board and the realm's shape didn't help (the Steward's own list is the cost). It runs once a turn for your seat, not for the bots.

## Session 25: the Steward's plan for the Marshal, re-tested with walls that pay back
*With the wall's bonus on as shipped (+10% a walled territory beyond the first, at most +40%), session 23's closest variant (`judgement.realmPlan`: the plan with its wall garrison, walls rushed and built steadily round the capital only) on Wyrmland 6 and Rootholm 8, 300 games, seed s25, against the same games without it (`docs/sims/s25-part4-realmplan.txt`, against `s25-sweep-B.txt`).*

| Marshals | Delegating seat, Wyrmland 6 / Rootholm 8 | All-Marshal length, Wyrmland / Rootholm | Halfway leader won | Top personality | Games walled, Conqueror (Wyrmland / Rootholm) |
|---|---|---|---|---|---|
| As shipped | 1.28 / 1.04 | 41.1 / 45.4 | 47.0% / 46.3% | Turtle 1.80 / Turtle 1.56 | 11% / 16% |
| The plan, round the capital | **1.68 / 1.49** | 42.9 / 46.9 | 46.3% / 45.3% | Turtle 1.68 / Merchant 1.89 | **64% / 73%** |

**Not adopted.** A wall that pays didn't change session 23's finding: with the plan the Marshals got much weaker against the delegating seat (by 0.40 and 0.45 times fair, well past the noise and the stop rule), games got 1.5 to 1.8 turns longer, and every personality walled up (the Conqueror in two games in three, the Opportunist and the Schemer in about half), so they played more alike. By Nate's rule (the Marshal must be at least as good as your leaders) it doesn't qualify. It stays a switch, off. The wall money still comes out of the Marshal's army in its single budget, and with the bonus the attackers just bring more.
