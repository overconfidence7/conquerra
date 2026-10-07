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
