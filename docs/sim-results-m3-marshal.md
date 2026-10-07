# Sim results: the Marshal and its personalities (session 17, Oct 6)

Everything on in every game: fog, the Fallen, both decks, diplomacy, spies. Luck 0.3, classic. 300 games per row unless it says otherwise; seats rotate each game so nobody keeps a lucky seat. "Fair" is one seat's share (25% at 4 players, 16.7% at 6, 12.5% at 8, 10% at 10). With 300 games a win rate is good to about ±2.5 points (one personality), and an average of six personalities to about ±1 point.

```
pnpm tournament --table wyrmland:6 --seats marshal-turtle,captain,captain,captain,captain,captain --games 300
npx tsx apps/sim/scripts/s17-tournament.ts <out> 300                      # every table, every kind (Part 2)
npx tsx apps/sim/scripts/s17-ab.ts '<change as JSON>' 300 embervale:4,wyrmland:6   # one Marshal of each personality vs Captains
npx tsx apps/sim/src/behaviours.ts <out>/*.jsonl                         # behaviours: by kind, winners vs their table, by quarter
npx tsx apps/sim/scripts/s17-runaway.ts 300 sighted:marshal-blitzer marshal   # Part 3: the strong stand-in
```

The tables: **Embervale** (40 territories, 4 players), **the Twin Realms** (80, 6), **Wyrmland** (120, 6 and 8), **Greatmarch** (80, 10).

## 1. Before: the first Marshal (Part 1, as built)

**One Marshal of each personality against Captains** (its win rate; fair in brackets):

| Table | Conqueror | Blitzer | Turtle | Schemer | Opportunist | Merchant | Average |
|---|---|---|---|---|---|---|---|
| Embervale, 4 (25%) | 22.7% | **33.3%** | 10.3% | 19.3% | 24.3% | 23.3% | 22.2% |
| Twin Realms, 6 (16.7%) | 8.0% | 17.0% | 3.3% | 5.3% | 11.7% | 9.0% | 9.1% |
| Wyrmland, 6 (16.7%) | 17.0% | **32.3%** | 15.3% | 14.3% | 15.3% | 18.3% | 18.8% |
| Wyrmland, 8 (12.5%) | 15.0% | **20.0%** | 8.0% | 10.7% | 12.7% | 15.3% | 13.6% |
| Greatmarch, 10 (10%) | 6.0% | 8.7% | 5.0% | 7.0% | 4.7% | 7.0% | 6.4% |

**A table of Marshals** (personalities dealt from each game's seed; each personality's win rate per seat):

| Table | Conqueror | Blitzer | Turtle | Schemer | Opportunist | Merchant |
|---|---|---|---|---|---|---|
| Embervale, 4 | 24.0% | **38.5%** | 11.9% | 20.0% | 23.9% | 30.7% |
| Twin Realms, 6 | 16.7% | **26.0%** | 6.7% | 13.3% | 19.0% | 17.7% |
| Wyrmland, 6 | 17.7% | **29.7%** | 9.7% | 10.7% | 12.0% | 19.7% |
| Wyrmland, 8 | 12.4% | **16.4%** | 10.1% | 12.6% | 7.5% | 16.1% |
| Greatmarch, 10 | 7.9% | **19.2%** | 7.3% | 7.1% | 8.5% | 9.0% |

- **The first Marshal was no better than the Captain**, except the Blitzer. The personalities played differently, as meant to (the Turtle built the most forts and culture by turn 10, the Merchant markets from turn 1, the Blitzer held the most land by turn 8 and lost the most), but most styles cost wins.
- **Tables of Marshals ran long:** Wyrmland 6 52.2 turns (Captains 45.1), the Twin Realms 47.4 (33.8), Greatmarch 57.3 (46.5). Part 3 has why (it named runaways too often).


## 2. What wins

Two ways of looking, both plain:

**a) Behaviours of winners**, from every game above (all five tables; 12,000 games). For each behaviour: the winner's value minus the average of the rest of its table, and the win rate of seats split into four equal groups by how much of it they showed (least → most). Only behaviours from the first 8–10 turns count for gold, buildings and concentration, before who's winning decides what a seat can afford.

| Behaviour | Embervale 4 | Twin Realms 6 | Wyrmland 6 | Wyrmland 8 | Greatmarch 10 |
|---|---|---|---|---|---|
| Land at turn 5, win rate least → most | 2 · 12 · 31 · 56% | 1 · 7 · 18 · 40% | 4 · 7 · 11 · 46% | 3 · 5 · 15 · 27% | 2 · 6 · 10 · 22% |
| Captures by turn 8 | 5 · 16 · 26 · 53% | 3 · 11 · 19 · 34% | 4 · 6 · 13 · 43% | 4 · 8 · 16 · 22% | 4 · 6 · 10 · 20% |
| Land lost by turn 8 | 37 · 24 · 21 · 18% | 33 · 15 · 11 · 7% | 41 · 14 · 8 · 4% | 30 · 11 · 6 · 3% | 15 · 10 · 9 · 6% |
| Rivals attacked a turn | 5 · 22 · 32 · 41% | 4 · 14 · 19 · 29% | 3 · 9 · 16 · 39% | 2 · 5 · 10 · 32% | 2 · 6 · 12 · 20% |
| Gold on troops, turns 1–10 | 11 · 23 · 28 · 38% | 4 · 10 · 20 · 32% | 6 · 10 · 20 · 31% | 5 · 8 · 14 · 23% | 4 · 8 · 12 · 16% |
| Gold on buildings, turns 1–10 | 43 · 32 · 20 · 5% | 33 · 20 · 10 · 3% | 28 · 22 · 12 · 5% | 24 · 15 · 7 · 4% | 18 · 12 · 7 · 3% |
| Markets by turn 10 | 24 · 24 · 23 · 29% | 17 · 18 · 17 · 15% | 17 · 17 · 17 · 16% | 12 · 12 · 12 · 13% | 10 · 10 · 10 · 10% |
| Culture raised by turn 10 | 14 · 14 · 29 · 43% | 11 · 13 · 20 · 23% | 11 · 11 · 17 · 27% | 7 · 7 · 12 · 23% | 6 · 7 · 11 · 16% |
| Truces made | 22 · 29 · 27 · 22% | 11 · 22 · 21 · 13% | 10 · 18 · 21 · 18% | 3 · 14 · 18 · 16% | 1 · 8 · 16 · 16% |
| Joint wars | 30 · 32 · 21 · 17% | 18 · 24 · 14 · 11% | 21 · 20 · 15 · 10% | 11 · 17 · 11 · 10% | 7 · 13 · 11 · 8% |

Winners grow fastest early, lose the least land early, attack more than one rival at once, and put their gold into troops rather than buildings. Markets make no difference either way. Culture and truces lean with winning, but rich, safe seats can afford both, so these can't be read as causes on their own.

**b) Tests that change one thing (A/B).** The behaviours above can be cause or effect (a winner has more land, so it has more of everything). So each candidate was tried by changing just that, one Marshal against Captains on the same seeds (600 games each, a Marshal set to play like the Captain to start from):

| Change (from a Captain-like Marshal) | Embervale 4 (fair 25%) | Wyrmland 6 (fair 16.7%) |
|---|---|---|
| none (plays like the Captain) | 25.2% | 13.8% |
| **attack hard: chain whenever the next hop is likely to win, up to 6 hops, send every spare troop** | **31.5%** | **30.2%** |
| send 80% of spare troops with an attack (not 50%) | 24.5% | 19.5% |
| a 14-turn opening of hard expansion | 23.2% | 25.3% |
| keep 80% of what it takes to hold every front | 18.8% | 10.5% |
| culture on safe land too | 20.8% | 13.8% |
| a market from turn 3 | 25.3% | 16.2% |
| one front at a time | 26.0% | 14.7% |
| offering truces and joint wars | 24.7% | 14.2% |
| never pulling back | 24.2% | 13.8% |
| its estimate of land it can't see used for choosing targets (not only for spotting a runaway) | 23.3% | 13.7% |

**What wins, in plain words:**
1. **Attack hard and keep attacking:** chain on whenever the next hop is likely to win, and throw every spare troop in. This is worth more than anything else, on every map.
2. **Don't hold troops back** on quiet fronts: armies sitting at home lose games.
3. **Expand hardest in the first 14 turns** on big maps (land you take early pays every turn after).
4. **Choose targets on what you know**, not on guesses about the fog (guessing made neighbours look bigger than they were); keep the guesses for spotting a runaway.
5. **Culture and buildings don't pay back yet** (culture on safe land loses; markets are neutral): a rule question for the balance pass (Nate wants them worth doing).


## 3. Built in, and the tournament again

<!-- PART2-AFTER -->

## 4. Stopping a runaway (Part 3)

<!-- PART3 -->

## 5. The headline numbers (Part 5)

<!-- PART5 -->
