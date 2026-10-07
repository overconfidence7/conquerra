# Sim results: the balance pass (M3, session 19)

*Fog on, diplomacy on, every system on unless a line says otherwise, seats rotated every game. Raw outputs: `docs/sims/s19-*.txt`. Scripts: `apps/sim/scripts/s19-lines.ts` (one seat against a table, one line per test), `s19-early.ts` (early knock-outs), `s19-compare.ts` (two seats side by side), `s19-levers.ts` (Part 2), and the session 17 tournament script for the headline.*

## What changed and why (short)
PART-SUMMARY

## Part 1: why a delegating player beat the Marshals, and the fix

### The question
Session 18 found that a player who hands everything to their leaders (`delegate-80`: Leader on "Run the military" with 80% of the income, Steward on "Run the realm" with 20%) beat a table of Marshals 37% of the time on Embervale (fair 25%) and 1.46 times its fair share on Wyrmland. The leaders plan with the Marshal's own brain on less gold, so something differed.

### One change at a time (Embervale, 4 players, 1,000 games a line; about ±3 points is noise)
| Test | Won | What it shows |
|---|---|---|
| `delegate-80` against Marshals (today) | 30.1% | the starting point on this set of seeds (session 18's seeds: 37%) |
| `delegate-100`: no Steward, the Leader gets everything | **43.1%** | the Steward's 20% *costs*; the Leader alone plans better than a Marshal |
| `delegate-80`, but it talks as a Marshal (not as a Captain) | 29.7% | not diplomacy |
| `delegate-80`, but its Leader stays home (no +20% in attacks) | 31.6% | not the Leader going along |
| `delegate-80`, its Steward's purchases first in the queue | 27.9% | where purchases sit in the queue matters |
| A Marshal whose own Leader goes with its attacks | 22.5% (plain: 22.6%) | the Leader's +20% makes no difference |
| A Marshal that queues troops and armies before its purchases | **27.6%** | **+5 points**: each order takes a round, so every purchase queued before the attacks let rivals move first |
| A Marshal in the leaders' plain style (no personality) | **31.8%** | **+9 points**: the personalities cost power (the Turtle most: 12.7% in a table of Marshals) |
| A Marshal that plans exactly like a Leader on "Run the military", from its treasury | 36.5% | the remaining gap to 43% is gold and timing on turn 1 (next lines) |
| … and keeps its first turn's gold as troops at home | 38.5% | a guard at home on turn 1 helps |
| A Marshal in the plain style, armies first, no specialists, forts or barracks | 39.4% | on a small map every gold not spent on troops costs |
| A Marshal without its cavalry bought on a whim | +3 points | the Captain's 30% chance of cavalry doesn't pay |

Switching off the Marshal's other purchases one at a time (Spoils turned in by hand, missions, forts, barracks, breaking deals, marching through partners' land, recruiting at a threatened capital) each made no difference beyond the noise.

### The big one: Marshals knocked out on turn 1
Looking at why a guard at home helped, the sims showed **14% of Marshals were knocked out on turn 1** on Embervale (16% by turn 3). Embervale's four capitals are only 3 steps apart, and the Marshal's all-out opening (chain up to 6 hops, send every spare troop) left 1 troop at home: a rival's chain walked straight in. A delegating player's starting gold became 10 troops that stayed at the capital on turn 1 (its Leader's purse was still empty), which protected it by accident.

| Capitals' closest distance (steps) | 3 players | 4 | 6 | 8 | 10 |
|---|---|---|---|---|---|
| Embervale (40) | 5 | **3** | | | |
| The Twin Realms (80) | | | 4 | **3** | |
| Wyrmland (120) | | | 6 | 4 | |
| Greatmarch (80) | | | | **3** | **3** |

### The fix (all in the bots and `packages/content/data/personalities.json`, no rule changes)
1. **Armies first** (`judgement.queue: "armies"`): the Marshal queues the Spoils and recruits, then its armies' moves, then everything else it buys (buildings, specialists, culture, spies). A test checks the order.
2. **No cavalry on a whim** (the Captain still does it; its fingerprint is unchanged).
3. **A guard at the capital** (`judgement.capitalGuard`): the capital keeps half of the biggest rival army the Marshal knows of within 3 steps; and on a crowded table (12 or fewer territories a player, where capitals start 3 steps apart) half its own stack for the first 3 turns. A Leader on "Run the military" keeps the same guard (it runs the whole realm); narrower commands (Expand, a front) don't. On roomy tables the opening guard only slowed games down (Wyrmland 6: 42.7 → 48.0 turns), so it's off there.

Each was tried as one change against unchanged Marshals; none makes one Marshal stronger than its table by itself beyond the noise (the guard: 24.6–27.1%), but a table of guarded Marshals stops the turn-1 knock-outs.

### After
| | Before | After |
|---|---|---|
| `delegate-80` against Marshals, Embervale (fair 25%) | 30.1% (session 18's seeds: 37.0%) | **20.1%** |
| `delegate-80` against Marshals, Wyrmland 6 (fair 16.7%) | 1.46× fair | **18.2% (1.09×)** |
| `delegate-100` (all to the Leader), Embervale | 43.1% | 30.4% (1.22×) |
| `delegate-100`, Wyrmland 6 | n/a | 19.2% (1.15×) |
| Marshals knocked out on turn 1, Embervale 4 | 14.0% | 0.0% |
| Marshals knocked out by turn 6, Embervale 4 | 23.4% | about 5% |

The fully delegating player (80/20) is now at or below its fair share on both maps. A player who gives the Leader everything and builds nothing is still a little above fair on Embervale (1.22×): on a small map troops win and the Marshals' personalities spend on other things. Part 2 (culture and buildings that pay) is the lever for that.

### The tournament again: one Marshal against Captains (500 games a line)
| Table (fair) | Conqueror | Blitzer | Turtle | Schemer | Opportunist | Merchant | Average |
|---|---|---|---|---|---|---|---|
| Embervale 4 (25%) | 37.0 → 39.4% | 36.8 → 41.6% | 21.2 → 36.0% | 33.4 → 37.0% | 32.8 → 41.4% | 30.0 → 44.0% | **31.9 → 39.9%** |
| Twin Realms 6 (16.7%) | 28.2 → 30.0% | 31.0 → 39.6% | 12.2 → 21.2% | 21.4 → 30.2% | 23.8 → 32.2% | 23.4 → 27.4% | **23.3 → 30.1%** |
| Wyrmland 6 (16.7%) | 34.2 → 37.4% | 30.6 → 37.2% | 24.4 → 34.0% | 26.6 → 29.8% | 27.6 → 32.6% | 27.4 → 36.0% | **28.5 → 34.5%** |
| Wyrmland 8 (12.5%) | 29.2 → 35.4% | 23.2 → 31.6% | 24.2 → 31.4% | 21.8 → 26.2% | 22.4 → 28.0% | 26.2 → 30.2% | **24.5 → 30.5%** |
| Greatmarch 10 (10%) | 11.8 → 20.0% | 12.2 → 20.4% | 10.2 → 14.6% | 10.0 → 21.2% | 11.6 → 23.2% | 9.6 → 23.8% | **10.9 → 20.5%** |

**The Marshal is no weaker anywhere; it's stronger on every table**, by the most at 10 players (it used to be barely above fair there).

**The strong stand-in for a person** (the Conqueror planning with fog off) on Wyrmland, 6 players, 500 games: against 5 Captains 32.4% → 42.2%; **against 5 Marshals 24.2% → 19.6%** (fair 16.7%): the Marshals hold a sharp player down better.

## Part 2: culture and buildings that pay (three levers; Nate picks)

Each lever on its own and in pairs, after Part 1's Marshal (`apps/sim/scripts/s19-levers.ts`, raw: `docs/sims/s19-levers.txt`). Every line: a Captain with the default Steward (`captain-steward-20`) against plain Captains (500 games), and a table of Marshals (Embervale 1,000 games, Wyrmland 500). About ±2 points is noise.

| Lever | Steward seat, Embervale 4 (fair 25%) | Steward seat, Wyrmland 6 (fair 16.7%) | Turtle E / W | Merchant E / W | Turns E / W | Halfway leader won E / W |
|---|---|---|---|---|---|---|
| Today (culture +½ gold a level, market 6 gold for +2, fort 8 gold in 2 turns) | 14.4% | 17.6% | 27.6 / 16.8% | 31.8 / 23.8% | 28.5 / 42.8 | 68 / 77% |
| **1. Culture +1 gold a level** | 17.0% | 20.6% | 29.7 / **20.4%** | 33.9 / 22.2% | 28.7 / 43.1 | 69 / 77% |
| 2a. Markets +3 gold a turn | 16.8% | 21.6% | 29.4 / 17.0% | 34.7 / 24.6% | 28.4 / 42.2 | 69 / 79% |
| 2b. Markets cost 4 | **19.6%** | 21.0% | 30.6 / 15.2% | 35.2 / 22.6% | 28.4 / 43.2 | 70 / 78% |
| 3a. Forts cost 5 | 16.4% | 21.4% | 25.0 / 18.6% | 30.5 / 22.2% | 28.9 / 44.0 | 69 / 73% |
| 3b. Forts built in 1 turn | 12.2% | 17.6% | 27.0 / 17.2% | 34.2 / 21.8% | 29.2 / 43.2 | 68 / 76% |
| 1 + 2a | 16.8% | 22.0% | 32.5 / 22.0% | **39.4** / 22.6% | 28.2 / 43.2 | 66 / 77% |
| 1 + 3a | 14.4% | 21.6% | 29.8 / 19.2% | 37.0 / 24.2% | 28.4 / 43.4 | 69 / 77% |
| 2a + 3a | 18.8% | **22.4%** | 29.4 / 20.0% | 36.7 / 25.4% | 27.7 / 42.2 | 70 / 79% |

**What it shows:**
- **Every lever but quick forts makes building pay on a big map:** the default Steward goes from break-even (1.06×) to 1.24–1.34× its fair share on Wyrmland.
- **No lever makes 20% on buildings pay on small Embervale** against plain Captains (best: cheaper markets, 0.78×). On a 4-player map of 40 territories the game is decided before buildings pay back.
- **The market levers make the Merchant too strong** (35–39% in a table of four Marshals, fair 25%): it's the personality that lives on markets.
- **The culture lever lifts the Turtle**, the culture personality, from fair to above fair on Wyrmland (16.8% → 20.4%), and the default Steward now buys culture where it pays (culture levels by turn 10: 1.1 → 3.2 on Wyrmland).
- **Game length and runaways don't move** with any lever (within a turn and a few points).
- **What wins** (win rate by what a seat built by turn 10, Marshal tables, seats still in at turn 10): markets 0 → 4+: 17.5% → 48.8% today, 17.8% → 51.4% with culture; culture levels 0 → 6+: 25% → 51% today, 22% → 54% with culture. Both pay "at the right moment" now in the sense that winners build; but this is partly the other way round (rich players build more), so the one-seat tests above are the real measure.

**My pick (pending Nate's): lever 1, culture +1 gold a level** (`rules.culture.incomePerLevel`: 0.5 → 1). It's the thing Nate felt was missing ("I played the whole game without building a building or doing any culture"), it pays on big maps (+3 points for the default Steward on Wyrmland), it lifts the culture personality, and it doesn't feed the Merchant the way the market levers do. **If Nate wants more for buildings:** cheaper markets (4 gold) helps the small map most; cheaper forts (5 gold) is the safest pair with culture for runaways on Wyrmland (halfway leader 73%).

### The default Steward's share
With culture at +1 a level, a Captain with the default Steward against plain Captains (`docs/sims/s19-steward-share.txt`):

| Share | Embervale 4 (fair 25%) | Wyrmland 6 (fair 16.7%) | Greatmarch 10 (fair 10%) |
|---|---|---|---|
| 10% | 20.4% (0.82×) | 19.7% (1.18×) | **10.0% (1.00×)** |
| 15% | 18.2% | 19.3% | |
| 20% | 17.1% (0.68×) | **20.6% (1.24×)** | 9.0% (0.90×) |
| 30% | | 20.7% (1.24×) | |

Taking forts off the Steward's list on Embervale gained only 2 points (19.4% at 20%, 21.9% at 10%): on a crowded map any early gold not spent on troops costs.

**The default now depends on the table** (`rules.leaders.stewardShare` 20%, `stewardShareCrowded` 10%, `crowdedTerritories` 12): **20% where there's room** (Wyrmland, the Crownlands, the Ringsea, Embervale with 3), **10% on a crowded table** (12 or fewer territories a player: Embervale with 4 or more, the Twin Realms with 8, Greatmarch with 8–10). Someone who never opens the Leaders panel is ahead of a plain Captain on roomy maps, level at 10 players, and a little behind (0.82×) on Embervale with 4, against 0.58× before this session. They still build and raise culture everywhere.

The Steward's "Run the realm" now also buys culture for its income where a level pays back as well as a market (`leaders.steward.culturePays` 0.3 gold a turn per gold): under the old rules that never happened; with +1 a level it buys first levels on safe land.
