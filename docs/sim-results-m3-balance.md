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

## Part 3: the Fallen from their first turn, the small-map snowball, and runaways

### The Fallen act from their first turn out
- **The rule:** a player knocked out starts with **8 Influence** (`rules.fallen.startInfluence`), plus the turn's own Influence at its end: **9 or more on their first turn out**, enough for a storm (6), a famine (8) or mercenaries (9). The caps are unchanged (no capitals, no knock-outs, one event per living player per turn, each kind rests after it's played).
- **The Fallen bots** do the same: on their first turn out, with nobody clearly ahead, they strike whoever holds the most land with what they can afford (before, they saved up until someone ran away).
- **The screens:** the moment you're knocked out, the dialog says "You are one of the Fallen … **You have 9 Influence now: enough for a storm, a famine or mercenaries this very turn.** Queen Isolde holds the most land." with **Strike as one of the Fallen** (or Leave the game). The Fallen panel then starts with "**Ready now: Storm, Mercenaries. Pick one, then tap Lady Morwen's land (they hold the most).**" (or, when saving up, which event comes next and in how many turns). Screenshots: `docs/art/screens/s19-fallen-choice*.png`, `s19-fallen-first-turn*.png`.
- **What it does to the game** (Marshal tables, 500 games, `docs/sims/s19-fallen-first.txt`): nothing measurable. Embervale 4: 28.3 → 28.6 turns, halfway leader won 64.6% → 65.0%; Wyrmland 6: 43.4 → 43.2 turns, 75.6% → 75.8%; Greatmarch 10: 50.7 → 51.3 turns, comebacks 75.4% → 79.2%. Its job is keeping a knocked-out person playing, not balance.

### The small-map snowball (Part 1's capital guard did it)
4 Marshals on Embervale, 500 games:

| | Before this session | After |
|---|---|---|
| One player holds half the map by turn 10 | **71.2%** | **29.5%** |
| Game length | 20.7 turns | **28.6 turns** (median 26) |
| Knocked out by turn 6 | 23% | 3.6% |
| Halfway leader won | 81.6% | 65.0% |
| Comebacks (the turn-10 leader didn't win) | 21.9% | 45.1% |

No rule change was needed: the cause was the turn-1 walk into an emptied capital (Part 1).

### Runaways at every table
Tried on top (500 games a line, Embervale 4, Wyrmland 6, Greatmarch 10; `docs/sims/s19-runaway-tests.txt`): a stronger pull toward the runaway's land and joint-war targets (1.4/1.6 → 2.0/2.2: `judgement.pull`), and reading a runaway sooner (lower size and pace bars, sticking 5 turns). **Neither moved the measures beyond the noise** (halfway leader 65.0 → 62.2% / 69.2% on Embervale), and the earlier reading made 10-player games longer still. Both are left at session 17's values (`pull` stays a setting for later).

What did work: **the capital's opening guard on every table**, not only crowded ones (`docs/sims/s19-guard-all.txt`): players knocked out by turn 6 fell from 16% (Wyrmland 6), 24% (Wyrmland 8) and 15% (Twin Realms 6) to 1–2%, and the halfway leader won less (Wyrmland 6: 75.8% → 62.7%; Wyrmland 8: 53.5% → 47.0%; Twin Realms 6: 82.4% → 79.4%), for about 4 more turns a game. Nate (Oct 7): his own games run much shorter than the bots', so longer bot games are fine. It's now on everywhere.

**The three runaway measures, Marshal tables, before this session → after (500 games each):**

| Table | Half the map after turn 10 | Halfway leader won | Comebacks | Turns |
|---|---|---|---|---|
| Embervale 4 | 71.2% → **29.5%** | 81.6% → **65.0%** | 21.9% → **45.1%** | 20.7 → 28.6 |
| Twin Realms 6 | 25.2% → **5.8%** | 87.2% → **79.4%** | 30.2% → **45.9%** | 32.9 → 38.9 |
| Wyrmland 6 | 8.8% → **2.4%** | 80.6% → **62.7%** | 39.4% → **60.4%** | 43.1 → 48.0 |
| Wyrmland 8 | 0.8% → **0.2%** | 58.8% → **47.0%** | 68.4% → **76.9%** | 51.0 → 54.5 |
| Greatmarch 10 | 2.8% → **0.2%** | 67.4% → **53.0%** | 59.0% → **79.2%** | 45.0 → 51.3 |

*(Before: session 18's code, `docs/sims/s19-runaway-before.txt`. After: the "now" and "guard-all" lines.)* The halfway leader now wins 47–79% (it was 59–87%). The rest of the gap is mostly real: whoever leads halfway is usually ahead because they played better, and the bots can't tell more from the fog.

**If Nate wants runaways lower still, rule options (not built):**
- **Catch-up income:** +1 gold a turn for every 10% of the map you're below the leader. Not simulated yet; the obvious next lever.
- **Larger upkeep for big realms** (`economy.upkeepRate` 0.35 → 0.5): slows a runaway's army; it also lengthens every game.
- **The Fallen's Influence by the leader's lead** (more Influence the more one player holds): aims the knocked-out players at the runaway harder.

## Part 4: bigger maps

### Four new official maps (Nate's OK, Oct 7)
**Ashwing** (a phoenix, 160 territories, 6–8 players), **The Sundered Crowns** (twin continents, 160, 6–8), **Krakenmere** (a kraken, 200, 8–10) and **Rootholm** (a tree of life, 200, 8–10). How they were made, galleries, Far pictures and recipes: `docs/maps/candidates.md` (session 19 section). The lobby now has a line under the map choice for every map, saying who it suits and what it plays like.

### Sims on the new maps (Marshal tables, 500 games a line, `docs/sims/s19-new-maps.txt`)
| Map, players | Turns (median) | Within 40 | Half the map after turn 10 | Halfway leader won | Comebacks | Knocked out by turn 6 |
|---|---|---|---|---|---|---|
| Ashwing 6 | 57.8 (60) | 1.6% | 0.2% | 48.9% | 78.3% | 0.2% |
| Ashwing 8 | 58.5 (60) | 1.0% | 0.0% | 43.5% | 82.4% | 1.1% |
| The Sundered Crowns 6 | 46.6 (46) | 28.8% | 0.2% | 91.8% | 33.4% | 4.5% |
| The Sundered Crowns 8 | 54.3 (58) | 5.2% | 0.0% | 77.4% | 59.3% | 4.2% |
| Krakenmere 8 | 58.9 (60) | 0.0% | 0.0% | 53.7% | 79.5% | 0.1% |
| Krakenmere 10 | 59.4 (60) | 0.0% | 0.0% | 55.1% | 80.7% | 0.5% |
| Rootholm 8 | 59.4 (60) | 0.0% | 0.0% | 46.6% | 79.4% | 0.3% |
| Rootholm 10 | 59.9 (60) | 0.0% | 0.0% | 36.8% | 86.7% | 0.7% |

- **Bot games on the big maps run to the 60-turn cap** (then the best score wins). Nate (Oct 7): his own games run much shorter than the bots', so this is fine. In the lobby, 8 or more players defaults to **Conquest** (20 turns, the best score wins), so most 8–10 player games on these maps are 20-turn games unless the host picks Classic. **Question for Nate:** is 20 turns right for a 200-territory map, or should Conquest's default grow with the map (say 30 turns at 160–200)?
- **The Sundered Crowns** is decided by who wins their own continent (halfway leader 92% at 6 players): the strait is a real front line, as intended, but a runaway there is hard to stop. Fine for a 6–8 player "two halves" map; worth Nate's eye in play.

### Seat fairness: a finding that touches every map
The sims always reported win rate by seat number, but seats are dealt to the capital spots at random every game, so that hid something: **among equal bots, the capital spot decides a lot, on every map** (Marshal tables, 300 games, `docs/sims/s19-spots.txt`):

| Map, players | Best spot | Worst spot | Fair |
|---|---|---|---|
| Embervale 4 | Wolfcrest 53% | Embercrest 3% | 25% |
| Wyrmland 6 | Kingsholt 40% | Hallowstone 3% | 17% |
| Greatmarch 10 | Dawnhollow 25% | Galeford 2% | 10% |
| Ashwing 6 | Dunkeep 31% | Ambergate 2% | 17% |
| The Sundered Crowns 6 | Nettlehurst 76% | Northrest 1% | 17% |
| Rootholm 8 | Nettlehelm 35% | Larkfield 1% | 12.5% |
| Krakenmere 8 | Amberhelm 57% | Rookstone 0% | 12.5% |
| Krakenmere 10 | Rookton 47% | Moonford 0% | 10% |

It's the map, not a bot quirk: Captains, Recruits and Marshals with the fog off show the same spots on Embervale (Embercrest 0.4–5.4% for all of them). It's exaggerated by equal bots (whoever gets a small early edge snowballs, and every bot reacts the same way), but a person starting in Embercrest is at a real disadvantage. The map maker's own fairness check (each capital about as far from its nearest rival, and about as much gold within 2 steps) passes all of these; it doesn't see exposure (how many borders and rival capitals press on a spot) or what lies beyond 2 steps. The winning spot isn't simply the one with the most land around it (Krakenmere's Amberhelm has little; the land-rich centre never wins).

**What I tried:** a recipe can now pin capital layouts per table size, chosen from the map's own capital spots (`capitals` in `configs.ts`; `apps/sim/scripts/s19-fair-seats.ts` and `s19-fair-all.ts` search them with the simulator). On Embervale 4, swapping one spot at a time took the spread from 59 to 36 points; trying every layout is in `docs/sims/s19-fair-all-embervale4.txt` (see the next part for what was pinned).

**Pinned for Embervale with 4 players** (Nate's most-played table): trying all 43 layouts that pass the paper check (100 games each, the best five again on 600, `docs/sims/s19-fair-all-embervale4.txt`), the fairest is Eldermere, Wildford, Sunshire and Wolfcrest: **13–38%** a spot, against **1–53%** for the map maker's layout (fair 25%), and games 29.5 turns. It's now in Embervale's recipe (`capitals: {4: [...]}`); only that line of the map changed. Tests that replay fixed 4-player Embervale games keep the old capitals.

**Not done yet (session 20 or later):** the same search for the other maps and table sizes (the big maps take about a minute a layout at 100 games, and have tens of thousands of layouts, so it needs a smarter search than "try them all"), and a fairness check in the map maker that looks at exposure (borders and rival capitals within reach) as well as distance and gold. If even the best layout stays uneven, a small start bonus for the weaker spots (a few troops or gold) is the rule option.

### Speed and memory on a phone (`apps/web/scripts/s19-perf.mjs`, raw: `docs/art/screens/perf-s19.json`)
Laptop, and a 384 px phone with its processor slowed 4 times (session 16's way), fog off, panning around your capital:

| Map, players | Device | First picture | Fully painted | Texture memory | JS memory | Panning Mid / Near / deepest (fps) | Replay (fps) | Deepest zoom sharpens in |
|---|---|---|---|---|---|---|---|---|
| Wyrmland 6 (120) | phone | 2.8 s | 3.2 s | 91 MB | 133 MB | 138 / 118 / 119 | **84** | 0.16 s |
| Ashwing 8 (160) | phone | 3.1 s | 3.5 s | 64 MB | 225 MB | 105 / 86 / 89 | **59** | 0.16 s |
| Krakenmere 10 (200) | phone | 3.8 s | 4.3 s | 73 MB | 263 MB | 102 / 76 / 79 | **44** | 0.18 s |
| Rootholm 10 (200) | phone | 3.8 s | 4.4 s | 76 MB | 248 MB | 100 / 74 / 88 | **43** | 0.16 s |
| Wyrmland 6 | laptop | 1.8 s | 2.0 s | 92 MB | 183 MB | 262 / 449 / 255 | 222 | 0.15 s |
| Krakenmere 10 | laptop | 1.4 s | 1.5 s | 78 MB | 260 MB | 221 / 322 / 203 | 155 | 0.16 s |

*(A first run, straight after a build, gave numbers several times worse on every map, Wyrmland included; re-running session 16's own script on Wyrmland gave the same healthy numbers as these, so that run was disturbed by something else on the machine.)*

- **Painting and panning are fine on a phone:** the big maps paint at a little lower detail (0.96–1.05 pixels a map unit instead of Wyrmland's 1.32), so their texture memory is *lower* than Wyrmland's, and panning stays at 74–105 frames a second.
- **Two things to watch, with causes:**
  - **The replay at 10 players runs at 43–44 frames a second** (goal 50; Wyrmland at 6 players 84). The cause is how many armies and moves it draws at once with 10 players; the polish pass (session 20) rebuilds how the replay draws its lines and markers, so that's the place to fix it.
  - **JavaScript memory on the phone is 225–263 MB** on the big maps (Wyrmland 133). The causes: the map's data is 1.4–2.0 MB (413–552 KB to download, compressed; Wyrmland 1.15 MB, 321 KB) and is kept as plain objects (8,000+ decoration spots on a 200 map), and 10 players' views, memories and replays. A mid-range phone copes; an old 2–3 GB phone may struggle. **Suggested fix (not built):** keep the decorations and outlines as packed number arrays after loading instead of thousands of small objects, and drop the raw map file once the map is painted.
- **Planning time at 10 players** (Krakenmere and Rootholm, Marshals, every system on, 20 games each, `docs/sims/s19-speed.txt`): resolving a turn **6.5 ms on average, 95% under 12 ms, worst 25 ms**; all ten bots planning a turn together (diplomacy and the Fallen included) **7.6 ms, worst 33 ms**; one Marshal 0.7 ms (worst 8 ms).
