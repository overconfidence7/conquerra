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

Session 16 found why nobody ganged up on Nate: under fog each Captain counts only the land it sees or remembers, so on a big map it named a runaway in about a fifth of its turns, about 8 turns late. The Marshal reads it its own way, still never cheating (only its own view, its memory and public facts):

1. **Land it can't see is estimated** from what it can: land it last saw stays whose it was (land last seen neutral only counts as neutral for 4 turns, since that's what everyone takes first); a knocked-out player's land goes to whoever knocked them out (public); land it knows nothing about goes 40% to whoever holds the nearest land it knows of and 60% spread evenly among the living rivals, scaled by how much of the land it can see is held by anyone.
2. **Pace, not only size:** the rival that gained the most land over the last 3 turns (on its estimates, and what it watched them take in the replays), twice as fast as the next and already holding 18% of the map, is a runaway before it holds 40%.
3. **A lower bar at big tables:** from 6 players, a third of the map, or 22% and 1.6 times anyone else (4–5 players: the Captain's 40%, or a quarter and 1.75 times).
4. **Joint wars come early and stick:** once it names a runaway it keeps naming it for 3 turns unless the runaway falls back; it proposes a joint war against it first, for the longest a war can run (6 turns), with a rival that borders it, and again as soon as one ends; every Marshal accepts one; its fronts with the runaway come first and the runaway's land is worth 1.4 times as much (its joint war's target 1.6 times).

**The strong stand-in:** session 16's "fast expander" won only 16% against Captains; Nate won in 12 turns. The new stand-in is the strongest personality on this table, **the Conqueror, playing with fog off** (it plans from the whole board, as a sharp person piecing things together would), with the Marshal's attack-hard judgement. Wyrmland, 6 players, the stand-in rotated through every seat, 300 games each, everything on:

| | Stand-in vs 5 Captains | Stand-in vs 5 Marshals | Fast expander vs 5 Captains | Fast expander vs 5 Marshals |
|---|---|---|---|---|
| **It wins** (fair 17%) | **35%** | **24%** | 23% | 5% |
| It became a true runaway (the Captain's rule on the real land) | 39% of games, from turn 19.1 | 34%, from turn 17.1 | 29%, from turn 16.3 | 18%, from turn 19.1 |
| While it was, the others named it | 29% of their turns | **77%** | 23% | 79% |
| Someone named it, how late | in 94% of those games, **8.5 turns late** | in 100%, **0.5 turns late** | 87%, 10.1 turns late | 100%, 0.1 turns late |
| Joint wars against it | 1.27 a game (36% of games), first on turn 29 | **2.14 a game (60% of games), first on turn 10** | 0.77 (25%), turn 28 | 1.84 (60%), turn 10 |
| The Fallen's world events on it | 3.83 a game (others, all five together, 10.81) | 3.88 (15.57) | 3.13 (11.61) | 1.51 (15.86) |
| Seat-turns naming a runaway when nobody truly was one | 1% | 23% | 0% | 31%* |
| Game length (turns) | 47.5 | 44.9 | 45.6 | 43.9 |

\* Before the stricter bar below.

- **The Marshals spot a runaway at once** (77% of their turns while it is one, half a turn late, against the Captains' 29% and 8.5 turns late) and **gang up early** (the first joint war on turn 10, not 29).
- **The strong stand-in still wins 24%** against Marshals (fair 17%), down from 35% against Captains. That's the same strength as a strong player against a table that fights back; not quite fair yet. Against session 16's weaker stand-in, Marshals hold it to 5%.
- **"False alarms":** Marshals name someone in about a quarter of their turns when nobody yet meets the Captain's strict rule. Most of these are the leader caught early on pace or the big-table bar (that's the point); a stricter bar (`bigShare` 0.33, `bigMinShare` 0.22, `bigLead` 1.6, `paceLead` 2, `paceMinShare` 0.18, now the default) cut them from 29% to 23% with no loss of spotting. Each false alarm costs the Marshal a little (on the tight 80-territory maps the first, looser rule cost it 3 points of win rate).
- **The Fallen** were left as they are (rule changes go to the balance pass). They do turn on the runaway: about 3.9 world events a game on the stand-in, against about 3 on each other player; they only exist once someone is knocked out (around turn 14), so they act late. Switching the Fallen bots to the Marshal wouldn't help: they already see the whole political map, which is better than any estimate.


## 5. The headline numbers (Part 5)

<!-- PART5 -->
