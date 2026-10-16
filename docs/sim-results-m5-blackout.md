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
