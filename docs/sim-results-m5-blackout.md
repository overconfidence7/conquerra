# Sim results, M5: bots that explore under blackout (session 32, Oct 16)

*All-Marshal tables (personalities dealt from each game's seed), the Fallen, Spoils, Fate, diplomacy and spies on, 300 games a table, seed `s32`, 19 processes on Nate's laptop. Headline runs: `npx tsx apps/sim/scripts/s30-sims.ts <map>:<players> 300 --fog blackout|on --seed s32` (add `--explore '{"weight":1}'` to try other settings). Personalities: `npx tsx apps/sim/src/tournament.ts --table embervale:4 --seats marshal-turtle,marshal,marshal,marshal --games 300 --seed s32 --fog blackout`. The delegating seat: `npx tsx apps/sim/scripts/s23-tables.ts delegate 300 wyrmland:6 s32 --fog blackout`. `MARSHAL_PATCH='{"explore":{...}}'` tries other explore settings in those two.*

## First, a correction to session 30

Session 30 reported 300 blackout games on Embervale 4 and Wyrmland 6 "game for game the same as standard fog". The script's worker processes never got `--fog` (each read it from its own command line, which only says `--worker`), so every one of those games was played with standard fog. The conclusion happened to be true anyway (the engine plays identically either way and the bots then read the whole map), but the run didn't show it. Fixed in session 32: the fog now travels with each job. The 240-game digest is unaffected (it runs standard fog): still `dc8962d4f8ba3bc6`.

## What changed for the bots

- **Part 1, the known map:** every bot plans from the land its seat has seen. Land never seen has no terrain, name, province or borders of its own; a known territory's borders into the cloud are known by kind only (the page draws each one). The map's size stays known (the lobby's card says it). The scrambled-unknown test makes up the unseen land afresh and every bot kind gives the same orders and lines.
- **Part 2, the scout's drive** (`packages/content/data/personalities.json`, `explore`): land whose borders lead into the cloud is worth `weight` more per such border, times the share of the map still cloud (so it fades); up to turn `scoutTurn`, while at least `scoutCloud` of the map is cloud, the Marshal hires Scouts (vision +1) with the army it recruits into; idle spies head for the cloud. All zero with standard fog.

## The headline: by seat, turns, comebacks, explore pace (shipped: weight 2, scoutTurn 4, scoutCloud 0.5)

| Table | Fog | By seat (fair) | Furthest from fair | Turns | Within 40 | Comebacks | Half the map seen by | All of it by |
|---|---|---|---|---|---|---|---|---|
| Embervale 4 | standard | 24.7 / 24.7 / 25.0 / 25.7 (25.0) | 0.7 | 23.0 | 96% | 44% | turn 6.2 | turn 19.0 (32% of seats) |
| Embervale 4 | blackout, known map only (Part 1) | 25.7 / 23.3 / 29.7 / 21.3 | 4.7 | 21.7 | 97% | 36% | turn 7.1 | turn 19.0 (31%) |
| Embervale 4 | **blackout, exploring (Part 2)** | 24.3 / 25.3 / 23.7 / 26.7 | **1.7** | **22.1** | 96% | 43% | **turn 4.8** | turn 19.3 (31%) |
| Wyrmland 6 | standard | 12.7 / 13.7 / 19.7 / 18.3 / 19.0 / 16.7 (16.7) | 4.0 | 39.7 | 61% | 66% | turn 15.1 | turn 37.1 (7%) |
| Wyrmland 6 | blackout, known map only (Part 1) | 13.3 / 16.7 / 15.7 / 18.0 / 15.7 / 20.7 | 4.0 | 42.2 | 50% | 61% | turn 16.5 | turn 38.4 (14%) |
| Wyrmland 6 | **blackout, exploring (Part 2)** | 14.7 / 18.3 / 13.0 / 17.7 / 18.7 / 17.7 | **3.7** | **42.2** | 51% | 69% | turn 15.5 | turn 40.1 (7%) |

("Half the map seen by": the average turn a seat had seen or remembered half the territories, over the seats that got there. Under standard fog "seen" means seen in full at least once, so the two fogs are measured the same way.)

**Against the bars:** every seat within ±5 of fair under blackout on both tables (1.7 and 3.7): **met**. Game length within about 3 turns of standard (Embervale 0.9 shorter, Wyrmland 2.5 longer): **met**. Comebacks about as often as with standard fog.

## Three settings tried (what each did)

| Setting | Embervale 4: worst seat, turns | Wyrmland 6: worst seat, turns | Turtle (its mix, Embervale 4) | Opportunist (its mix) | Delegating seat (Wyrmland 6) |
|---|---|---|---|---|---|
| standard fog (the reference) | 0.7, 23.0 | 4.0, 39.7 | 22.5% | 20.9% | **1.54x fair** |
| off (weight 0, no Scouts): Part 1 | 4.7, 21.7 | 4.0, 42.2 | 14.5% | 31.6% | 1.14x |
| weight 1, Scouts to turn 4 | 3.0, 22.7 | **6.3**, 42.4 | 14.0% | 28.6% | 1.34x |
| **weight 2, Scouts to turn 4 (shipped)** | **1.7, 22.1** | **3.7, 42.2** | 14.7% | 30.1% | 1.28x |
| weight 0.5, Scouts to turn 6 (cloud 0.4) | 5.0, 22.4 | 4.0, **44.5** | 17.4% | 24.0% | 1.10x |

- **Weight 1** helps Embervale but leaves one Wyrmland seat 6.3 off fair.
- **Weight 2** is the best on the headline bars, and the explore pace improves most on Embervale (half the map by turn 4.8, against 7.1 without the drive and 6.2 with standard fog).
- **Weight 0.5 with Scouts to turn 6** brings the Turtle and the Opportunist closest to their standard numbers but makes Wyrmland games 4.8 turns longer than standard and the delegating seat weakest.

## The bars not met

- **The personalities** (each within 0.2 x fair of its standard number, fair 25%, so within 5 points): under blackout the **Turtle** wins 14.7% (standard 22.5%: 7.8 points, 0.31 x fair) and the **Opportunist** 30.1% (standard 20.9%: 9.2 points, 0.37 x fair). **Not met.** The setting that came closest (weight 0.5) still had the Turtle 5.1 points down. The explore weight barely moves it: with the drive off the Turtle wins 14.5% and the Opportunist 31.6%. So it's blackout itself: the Turtle stays "calm" until turn 14 (its chains need 2.2 times the odds), and under blackout every chain already stops at the cloud's edge, so it sees the least and grows the slowest; the Opportunist feeds on the fights it finds. A personality-level fix (the Turtle's calm margin under blackout, say) is a change to a personality, not to the drive, so it's left for a balance session.
- **The delegating seat** (a person's leaders against dealt Marshals, Wyrmland 6; within 0.2 of its standard number): **1.28x fair under blackout against 1.54x with standard fog** (0.26 down; 300 games, one standard error about 0.15). **Not met**, just. It still wins more than its share: your leaders still play well for you under blackout, a little less well than with the map in view.

**So the Rules fold keeps its label** (session 32's rule: the label comes off only when every bar is met), even though what it says is no longer true: the bots now play from what they've seen. That's a question for Nate (see `PROGRESS.md`).

## Honesty, tested

- **The scrambled-unknown test** (`apps/sim/test/blackout-honest.test.ts`): blackout games with Marshals on a random 40, a random 80 crescent and all twelve maps; at several turns, for every living seat with land it hasn't seen, the unseen land is made up afresh (new ids, names, terrain and provinces; borders among it rewired; each border out of the known land led somewhere new; the order of it all shuffled; the map's size kept, as the lobby shows it). The Recruit, the Captain, the Marshal in all six personalities, the four general seats, the delegating, Steward and leader-path seats, your leaders under seven commands, every level's offers and answers to four kinds of offer: identical orders, answers, offers and lines. With the bots planted back on the full map the test fails on all 14 maps at once.
- **Orders never name land never seen** (the same file), and a spy is never sent to a province with no known land.
- **The view itself:** a replay can name land at the cloud's edge without showing it (a rival army marching out of the cloud into sight, a Fate closure on a border into the cloud). The bots use those only as player ids and border pairs; the test renames them with everything else, so a bot that looked behind them would plan differently.
- **Standard fog unchanged:** the 240-game digest `dc8962d4f8ba3bc6`, the Captain fingerprint `232617a30b1f8b47` (15,639 orders) and `pnpm sim --games 40 --players 6 --map wyrmland --bots marshal --seed o32` are identical at the commit before the session and after each part.

## Session 33 (Oct 18): the personalities and your leaders

*Embervale 4, one seat given the personality and three dealt Marshals, seats rotated, seed `s33`: `npx tsx apps/sim/src/tournament.ts --table embervale:4 --seats marshal-<p>,marshal,marshal,marshal --games 900 --fog blackout|on --seed s33`, a try's values with `--tweak '{"personalities":{"turtle":{"blackout":{...}}}}'`. The number is the win rate of every seat playing that personality (fair 25%); the bar is each within 0.2 x fair (5 points) of its standard number. The delegating seat: `npx tsx apps/sim/scripts/s23-tables.ts delegate 600 wyrmland:6 s33 --fog blackout|on`. The runner: `docs/sims/run-s33-blackout.sh`; every run's output is in `docs/sims/s33-bo-*.txt`.*

**First, the noise.** At 300 games one standard error on a personality's number is about 2.5 points, and session 32's numbers moved a lot with the seed: with `s33` the Turtle under blackout read 20.9% at 300 games (session 32's `s32`: 14.7%) and 17.5% at 900. The delegating seat swings more: seed `s32` gives 1.54x fair with standard fog (exactly session 32's number, so its standard-fog games are unchanged), seed `s33` 1.22x. So the decisions below are on 900 games a personality (one standard error about 1.4 points) and 600 for the delegating seat.

**What blackout does, before any change (900 games, s33):** the Turtle 22.8% → **17.5%** (5.3 down: misses), the Opportunist 25.8% → **31.0%** (5.2 up: misses). The other four, with standard fog: the Conqueror 25.6%, the Blitzer 27.5%, the Schemer 23.8%, the Merchant 25.0%.

**Why the attack values do nothing for the Turtle.** Every Marshal attacks at least as hard as the shared judgement's floor (`attackFloor`: chain on at 1.0 times the odds, send everything, six hops), so a personality's own chain odds, send share and hops never bind; its front garrison is scaled to zero for everyone too (`garrisonScale` 0). What's left of the Turtle's own play is its calm (attacks on rivals held back until its strike turn: under blackout it rarely meets a rival that early anyway) and its building (it spends like the Steward on 1.5 times the usual share, markets and culture from turn 2, walls with up to 39 gold to go). Under blackout the others race into the cloud with the scout's drive while it builds.

| The Turtle under blackout (900 games; standard 22.8%) | Win rate | Off its standard |
|---|---|---|
| before (session 32's values) | 17.5% | 5.3 |
| attack: calm 1.6, strike turn 10 (the brief's first try) | 17.6% | 5.2 |
| attack: as above, chains at 1.3, sends half | 17.7% | 5.1 |
| attack: calm 1.2, strike turn 6, chains at 1.25, sends 0.6, four hops | 17.6% | 5.2 |
| build: realm 0.75, walls from 18 | 17.4% | 5.4 |
| **build: markets and culture from turn 6, realm 1 (shipped)** | **18.8%** | **4.0** |
| build: as above, realm 0.5, walls from 10, one fort | 18.9% | 3.9 |

| The Opportunist under blackout (900 games; standard 25.8%) | Win rate | Off its standard |
|---|---|---|
| before (vulture 2) | 31.0% | 5.2 |
| vulture 1 (the brief's half) | 30.4% | 4.6 |
| **vulture 0.5 (shipped)** | **29.5%** | **3.7** |
| vulture 0 | 27.8% | 2.0 |

Vulture 0 is closest, but it takes away what makes the Opportunist the Opportunist; 0.5 meets the bar and keeps it a vulture.

**Shipped** (`packages/content/data/personalities.json`, each personality's `blackout` block, read in one place, `forFog` where the Marshal's plan takes its personality; a block can now hold attack, defend and build values): **the Turtle** builds markets and culture from turn 6 (not 2) and spends like the Steward on its usual share (realm 1, not 1.5) under blackout; **the Opportunist**'s vulture is 0.5 (not 2) under blackout. Nothing else changes, and nothing with standard fog.

**Every personality with the shipped values (900 games each):**

| Personality | Standard fog | Blackout | Off | Bar (5) |
|---|---|---|---|---|
| Turtle | 22.8% | 18.5% | 4.3 | met |
| Opportunist | 25.8% | 29.5% | 3.7 | met |
| Conqueror | 25.6% | 28.5% | 2.9 | met |
| Blitzer | 27.5% | 32.0% | 4.5 | met |
| Schemer | 23.8% | 24.8% | 1.0 | met |
| Merchant | 25.0% | 25.4% | 0.4 | met |

(The Turtle's 18.5% here and 18.8% in the try above are the same values with other seats' blackout values in place; within noise.) **Found:** the Blitzer gains most from blackout (32.7% with session 32's values, 32.0% now, against 27.5%): it never pauses a chain, and the cloud rewards whoever reaches it first. Inside the bar, so left alone.

**The headline again (300 all-Marshal games, s33, shipped values):** Embervale 4 under blackout 20.0 / 28.3 / 28.3 / 23.3 (5.0 off fair; standard fog with the same seed 20.0 / 30.0 / 27.0 / 23.0, also 5.0), 21.5 turns (standard 22.7), 96% within 40, half the map seen by turn 4.9 (standard 6.2; session 32: 4.8); Wyrmland 6 under blackout 21.3 / 14.0 / 14.7 / 18.7 / 16.0 / 15.3 (4.7 off; standard 3.7), 44.1 turns (standard 41.6). **Met:** ±5 by seat, turns within 3, the explore pace where session 32 left it.

**Your leaders under blackout (the delegating seat: your Leader runs the military on 80% of the income, your Steward the realm on 20%, against dealt Marshals, Wyrmland 6, 600 games, s33):**

| Setting | Standard fog | Blackout | Down | Bar (0.2) |
|---|---|---|---|---|
| before (session 32's personalities; 300 games) | 1.22x fair | 1.20x | 0.02 | met |
| the brief's first personality try (300 games) | | 1.06x | 0.16 | met, just |
| **shipped personalities, your leaders with the Marshal's drive** | **1.34x** | **1.24x** | **0.10** | **met** |
| the same, and your Steward keeps a watchtower near the cloud's edge to turn 6 | | 1.19x | 0.15 | met |

Your leaders already had the scout's drive: their plans read the same board as the Marshal's, and its land values carry the explore term, and your Leader on Run the military hires Scouts early as the Marshal does (session 32). Session 33 gives them their own content values (`explore.leaders` in `personalities.json`: the drive's weight, the Scouts' turn and cloud share, and a Steward's watchtowers), set to the Marshal's, with the watchtowers off: the one new thing tried, a watchtower near the cloud's edge, didn't help (1.19x against 1.24x). The council's lines don't change. With standard fog none of it does anything (a test plays the delegating seat with every `explore.leaders` value changed: the same orders).

**So every bar is met under blackout:** the six personalities within 5 points of their standard numbers, the delegating seat within 0.2, the headline within ±5 by seat with turns within 3. (The Rules fold's label came off in Step 0 by Nate's call.)

**Standard fog unchanged:** see `PROGRESS.md`, session 33 (the digest, the Captain fingerprint, the seeded sim at the commit before and after each part).
