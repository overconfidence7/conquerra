# Simulator Results: Milestone 1

*October 2, 2026. Embervale test map, "Recruit" bots, 70/30 skill/luck, fog on, classic mode (last one standing). 1,000 games per row.*

| Players | Crashes | Win rate by seat (fair = equal) | Avg length | Winner locked in the lead at | Lead changes / game |
|---|---|---|---|---|---|
| 2 | 0 | ~48–51% each | 81 turns | 37% of the game | 10.2 |
| 4 | 0 | 23.0 / 26.4 / 26.5 / 23.7% | 93 turns | 39% | 13.0 |
| 6 | 0 | ~16% each | 111 turns | 39% | 14.4 |

## What this tells us

- **The engine is solid.** 3,000 full games, plus 250 runs of random and malformed orders, with zero crashes or rule violations. Every game replays identically from its seed.
- **Turn order is fair.** Shuffling seats each turn means no seat has a built-in advantage.
- **Games are far too long.** 80–110 turns would be months at one turn a day. The M3 target is 15–30 turns.
  - Part of this is the bots: they spread one-unit garrisons everywhere, so territory flips back and forth.
  - Part is balance: low starting armies, weak catch-up for leaders, and upkeep that doesn't bite hard enough.
- **Games aren't predictable, which is good.** The eventual winner typically doesn't lock in the lead until about 40% of the way through, and the lead changes hands 10–14 times. That's the opposite of the "obvious winner early" complaint about Risk.

## Levers for the M3 balance pass

1. Smarter bots (concentrate forces, defend chokepoints, finish off weakened rivals).
2. Faster economy: more starting gold and units, higher province bonuses.
3. Steeper upkeep on large empires.
4. Conquest mode with a turn limit as the default for async games, with classic as an option.
5. The Fallen's world events, to add pressure on whoever is leading late in the game.
