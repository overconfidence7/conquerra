# Sim results: the Spoils and Fate decks (session 13)

*All-Captain tables, luck 0.3, classic, fog on, the Fallen on. 500 games per row (same seeds in every row). Embervale for 4 and 6 players, Greatmarch for 10. Run with `pnpm sim --games 500 --players N [--spoils off] [--fate off]`.*

## After Nate's calls (session 14)
*Bigger Spoils windfalls again (three Swords 8 troops, three Towers a fort + 3 troops, one of each 4 troops + 6 gold) and the first Fate draw at the end of turn 3. Same tables and seeds as below; 500 games per row; `pnpm sim --games 500 --players 4,6,10 [--spoils off --fate off]`.*

| Players | Length: no decks → both decks | Within 40 turns | Half the map by turn 10 | Halfway leader wins | Comebacks |
|---|---|---|---|---|---|
| 4 | 21.0 → **23.6** (session 13's tuned decks: 22.9) | 98.8% → 97.2% | 40% → 32% | 84% → 82% | 20% → 25% |
| 6 | 29.8 → **31.8** (31.0) | 85.4% → 82.0% | 25% → 21% | 73% → 69% | 41% → 45% |
| 10 | 38.3 → **40.8** (39.6) | 65.2% → 54.4% | 1.2% → 0.4% | 71% → 74% | 55% → 55% |

- **Length:** the bigger windfalls cost about 1 more turn than session 13's tuned numbers (+0.7, +0.8, +1.2), as Nate expected. The quiet opening (no Fate until turn 4's planning) changes little. 10-player games now average 40.8 turns, just over the 30–40 guide: one for the balance pass (session 16).
- **Runaways:** no worse. Fewer games have one player on half the map by turn 10, and comebacks hold or rise.
- **Decided by the decks? Still no.**
  - Spoils: the winner took the lead for good on a turn it turned in a set in 23% / 30% / 29% of games, against 27% / 28% / 30% by chance.
  - Fate: the winner got 61% / 50% / 37% of the good events, against 60% / 51% / 44% of the land they could land on; its luck beyond its land was +0.3 / +1.0 / −0.2 events a game.
- **Seat fairness (both decks):** 4 players 21.6 / 25.0 / 24.6 / 28.8%; 6 players 14.0 / 16.2 / 17.8 / 17.8 / 14.4 / 19.8%; 10 players 9.0 / 9.8 / 9.0 / 9.0 / 10.8 / 12.6 / 8.4 / 10.0 / 11.2 / 10.2%.

## In short (session 13)
- **The decks add colour without deciding games.** The winner takes the lead for good on a turn it turned in a Spoils set about as often as chance says it would (28% vs 27% at 4 players; 32% vs 30% at 10). It gets fewer good Fate events than its land would draw (58% vs 60%; 36% vs 45% at 10 players); net of the bad ones, its Fate luck is +0.3 to +1.0 events over a whole game of 45 to 157 events.
- **Games run about 1 to 2 turns longer** with both decks (4 players 21.0 → 22.9, 6 players 29.8 → 31.0, 10 players 38.3 → 39.6). The orchestrator's first Spoils numbers added about 3 turns at every size, so the windfalls were tuned down (below).
- **Runaways don't grow:** the halfway leader wins about as often as without the decks, and comebacks hold (4 players 20 → 23%, 6 players 41 → 42%, 10 players 55 → 51%).
- **Seat fairness is unchanged** (every seat within a couple of points of fair).

## Game length (turns)

| Players | No decks | Spoils only | Spoils + Fate | Within 40 turns (no decks → both) |
|---|---|---|---|---|
| 4 | 21.0 | 22.8 | **22.9** | 98.8% → 97.6% |
| 6 | 29.8 | 31.6 | **31.0** | 85.4% → 84.8% |
| 10 | 38.3 | 40.2 | **39.6** | 65.2% → 60.0% |

Fate on its own pulls a little length back (bad events, closed crossings and uprisings unsettle defenders as much as attackers).

**The first numbers, before tuning** (Swords 8 troops, Towers a fort + 3 troops, one of each 4 troops + 6 gold): Spoils only 24.2 / 33.3 / 41.5 turns, both decks 23.3 / 31.6 / 40.3. The extra length came from the windfalls' size (forts and garrisons on threatened fronts, more troops on every side): with smaller windfalls 6-player Spoils games went from 34.0 to 31.2 turns in a 300-game check. **Tuned to:** Swords 6 troops, Towers a fort + 1 troop, one of each 3 troops + 5 gold (Laurels unchanged). Nate can change any of them in `packages/content/data/rules.json` (`spoils`).

**Risk (10 players):** games within 40 turns drop from 65% to 60% (the Fallen had already taken it from 79% to 65% in session 12).

## Runaways (the three measures)

| Players | Half the map by turn 10 | Halfway leader wins | Comebacks (winner wasn't leading at turn 10) |
|---|---|---|---|
| 4: none / Spoils / both | 40% / 40% / 36% | 84% / 85% / 85% | 20% / 21% / 23% |
| 6: none / Spoils / both | 25% / 17% / 21% | 73% / 71% / 71% | 41% / 46% / 42% |
| 10: none / Spoils / both | 1.2% / 0.6% / 0.6% | 71% / 73% / 72% | 55% / 52% / 51% |

Windfalls don't grow and everyone who takes land earns at the same pace (one card a turn at most), so the leader gets no more from them than a challenger.

## Seat fairness (win rate by seat, both decks)
- 4 players (fair 25%): 24.4 / 24.8 / 25.6 / 25.2
- 6 players (fair 16.7%): 14.2 / 16.6 / 19.8 / 16.6 / 14.6 / 18.2
- 10 players (fair 10%): 9.4 / 9.6 / 8.2 / 10.8 / 9.6 / 10.4 / 8.4 / 12.8 / 12.0 / 8.8

## How often the decks decided a game

| | 4 players | 6 players | 10 players |
|---|---|---|---|
| Spoils sets per game (by the game at the hand limit) | 15.9 (0.1) | 27.6 (0.1) | 60.2 (0.2) |
| Winner took the lead for good on a set turn (chance) | 28% (27%) | 29% (28%) | 32% (30%) |
| Fate events per game (good / bad on players' land / strong) | 45 (21 / 20 / 6) | 77 (37 / 35 / 10) | 157 (77 / 70 / 21) |
| Winner's share of good Fate events vs its share of the land | 58% vs 60% | 46% vs 52% | 36% vs 45% |
| Winner's Fate luck beyond its land (events per game) | +0.6 | +1.0 | +0.3 |
| Winner was the luckiest player (chance) | 41% (25%) | 39% (17%) | 30% (10%) |
| Missions drawn / done per game | 19 / 10 | 33 / 17 | 66 / 35 |
| Missions done: the winner / each other player | 4.1 / 1.9 | 6.0 / 2.3 | 7.4 / 3.0 |

How to read it:
- **"Lead on a set turn"** matches chance: a set doesn't swing the lead.
- **Fate events land on random territories**, so whoever holds the most land catches the most events, good and bad. Against its land the winner gets slightly *fewer* good events than its share. Its net luck (good minus bad, beyond what its land would draw) is under one event a game.
- **"The luckiest player"** looks high, but the player with the most land always has the widest swings either way, so being the extreme is partly size, not luck. With a net edge under one event a game, Fate isn't what wins.
- **Missions:** the winner completes 2 to 3 times as many, because it has more fronts and more attacks to finish them with. Rewards are small (a few gold, a few troops, 1 culture), worth about 1 gold a turn over a game: a consequence of winning more than a cause.
- **70/30 skill to luck:** the decks add events, but the "decided by the decks" measures sit at chance, so the balance stays with play.

## The Captain with the decks
- It turns its own sets in (the game had to do it at the hand limit about once in 10 games) and finishes about half its missions.
- The mission pull is modest (×1.3 on attacks it already judged likely to win), so it never chases a mission it can't win.
- Its play is otherwise unchanged; the bots tests check its choices.
