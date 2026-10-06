# Sim results: spies, right of passage and the culture ladder (session 15, Oct 6)

All-Captain tables, 500 games each, luck 0.3, classic, fog on, the Fallen, Spoils, Fate and diplomacy on. Embervale for 4 and 6 players, Greatmarch for 10. "Off" is `pnpm sim --spies off`; everything else is the same (right of passage and the culture ladder are in both).

```
pnpm sim --games 500 --players 4,6,10                 # spies on
pnpm sim --games 500 --players 4,6,10 --spies off     # spies off
pnpm sim --games 500 --players 4 --mix captain,captain-no-spies,captain,captain-no-spies
pnpm sim --games 500 --players 6 --mix captain,captain-no-spies,captain,captain-no-spies,captain,captain-no-spies
```

## Game length, runaways and seat fairness

| | 4 players off → on | 6 players off → on | 10 players off → on |
|---|---|---|---|
| Average length (turns) | 28.0 → **27.1** | 36.2 → **36.1** | 46.4 → **44.9** |
| Games within 40 turns | 87.8% → 91.8% | 68.6% → 69.4% | 31.0% → 35.0% |
| Halfway leader went on to win | 75% → 75% | 65% → 66% | 68% → 71% |
| Comebacks (winner wasn't leading after turn 10) | 35% → 36% | 49% → 50% | 62% → 59% |
| One player with over half the map after turn 10 | 24.0% → 22.6% | 10.2% → 9.0% | 0% → 0% |
| Win rate by seat (fair 25 / 16.7 / 10%) | 22–29% → 23–29% | 13–20% → 13–21% | 7–13% → 8–12% |

- **Spies don't make games longer.** If anything a little shorter (about 1 turn at 4 and 10 players): armies attack with a better picture of what's there.
- **Runaways and fairness are about where they were.** No measure moves by more than a few points, within the noise of 500 games.
- **Game length overall** is still long at big tables (10 players: 45 turns, 35% within 40). That's diplomacy's cost from session 14 (no rule change for length, as asked); the balance pass (session 16) has bots offer fewer truces at big tables.

## Spies

| Per game | 4 players | 6 players | 10 players |
|---|---|---|---|
| Spies hired | 2.7 | 3.4 | 6.9 |
| Attempts to get into a province | 6.6 | 10.3 | 31.6 |
| Infiltrated | 5.93 | 9.18 | 27.71 |
| Blocked | 0.72 | 1.07 | 3.91 |
| Killed | 0.00 | 0.00 | 0.00 |
| Fooled | 0.00 | 0.00 | 0.00 |
| Gold spent on spies, all players (hiring and upkeep) | 67 | 103 | 225 |

- **Blocked** happens when a bot's spy walks into a province whose owner has its own spy standing there (one at home in a whole province defends it).
- **Killed and fooled never happen between bots:** each Captain keeps one spy, and killing takes 2 defenders, fooling 3. People can do both: station 2 or 3 spies in a whole province. The rules and every row of the table are covered by the engine tests.

**Worth a little gold, not a must-buy.** Mixed tables, half the Captains using spies and half not (500 games each):

| Captain's spy use | 4 players: with / without | 6 players: with / without |
|---|---|---|
| First version: 2 spies, from turn 4, 16 gold kept for troops | 40.2% / 59.8% | 39.4% / 60.6% |
| **As tuned: 1 spy, from turn 6, 24 gold kept** | **47.0% / 53.0%** | **51.4% / 48.6%** |
| (For Nate) 1 spy as tuned, but no upkeep | 53.0% / 47.0% (300 games) | not run |

- The first version cost the bots too much: two spies at 8 gold plus 1 a turn each is about 60 gold over a game, and that's 30 troops. Tuned, one spy about pays for itself.
- **The upkeep decides it.** The intel is worth a little gold: with no upkeep, one spy is a small win (53%); with Nate's 1 gold a turn it's a small loss at 4 players and even at 6. Nate's numbers (8 gold, 1 upkeep) are unchanged; this is a question for him.
- Only the bots' use was tuned (`rules.spies.bots`): `max` 1, `fromTurn` 6, `reserve` 24.

## The culture ladder

| Hired per game (games with any) | 4 players | 6 players | 10 players |
|---|---|---|---|
| Rangers (culture 4) | 0.49 (26%) | 1.26 (50%) | 1.58 (67%) |
| Standard-bearer (culture 6) | 0.25 (16%) | 0.70 (39%) | 1.24 (60%) |
| For comparison: Healers (culture 3) | 1.11 (56%) | 2.38 (82%) | 4.21 (96%) |
| Siege (culture 2) | 5.32 (83%) | 14.74 (99%) | 24.62 (100%) |

- They're the top of the ladder, so they come late and less often, as intended: the Captain raises culture where it holds and only hires Rangers next to a forest, hill or swamp front and a Standard-bearer for an army of 20 or more.

## Right of passage

| Per game | 4 players | 6 players | 10 players |
|---|---|---|---|
| Passage deals made | 0.6 | 2.8 | 9.7 |
| Marches through a partner's land | 0.23 | 1.01 | 2.75 |

- The Captain asks for passage toward a rival it wants a front with but doesn't border (the runaway leader first). At 4 players almost everyone borders everyone, so passage is rare; it matters more at big tables.

## Other session 15 changes in these numbers
- The harsher Oathbreaker (fine 4 + 1.4 per size, unrest 0.8 per size): deals broken per game 0.8 / 2.3 / 4.8 (session 14: 0.8 / 2.4 / 5.1). The Captain now breaks mostly small deals.
