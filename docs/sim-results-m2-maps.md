# Simulator Results: the new maps (session 3)

*October 2, 2026. "Recruit" bots, 70/30 skill/luck, fog on. The new map-maker versions of Embervale (40 territories, 8 provinces) and Greatmarch (80 territories, 20 provinces). Rules as before, plus the new sea lane penalty (attack ×0.75). Reproduce with `pnpm sim --games 1000 --players 2,4,6 --seed m2maps` and `pnpm sim --games 200 --players 10 --mode conquest --seed m2maps`.*

## Results

| Players | Map, mode | Games | Crashes | Win rate by seat | Avg length (before) | Median | In 15–25 turns |
|---|---|---|---|---|---|---|---|
| 2 | Embervale, classic | 1,000 | 0 | 52.4 / 47.6% | 23.8 (23.7) | 22 | 67% |
| 4 | Embervale, classic | 1,000 | 0 | 22.6–27.6% | 25.8 (23.9) | 24 | 57% |
| 6 | Embervale, classic | 1,000 | 0 | 15.3–17.5% | 26.3 (25.6) | 25 | 52% |
| 10 | Greatmarch, Conquest | 200 | 0 | 6.5–13.0% | 20.0 (20.0) | 20 | 100% |

"Before" is the session 2 re-check on the old hand-made maps.

- **Seats are still fair.** Every seat is within normal random variation of an equal share. Capitals now come from the map maker's fair layouts (similar distance to rivals, similar nearby income, always on plains).
- **Games got a little longer at 4–6 players**: about 1–2 turns on average. The typical (median) game is still 22–25 turns, but the average at 4 and 6 players is now just over 25.
- **Speed is unchanged:** about 0.3 ms per turn on average (worst 7 ms, at 10 players).

## What the choke points changed

| Border crossed | Battles per game (4 players) | Share of battles | Attacks that captured |
|---|---|---|---|
| Ordinary | 224.8 | 86.5% | 83% |
| River | 22.6 | 8.7% | 90% |
| Mountain pass | 4.5 | 1.7% | 91% |
| Sea lane | 7.8 | 3.0% | 86% |

(10-player Greatmarch: 419.5 ordinary, 52.2 river, 21.8 pass, 6.1 sea lane battles per game.)

- **Choke points work as walls.** Fewer than 1 battle in 20 crosses a pass or a sea lane, even though passes and sea lanes are about 1 border in 16. Bots go around them and fight on open ground.
- **When bots do cross, they win more often**, because "Only if still stronger" and "Just enough" only send an attack across a penalty border when it's clearly winning.
- **What the bots don't do yet:** deliberately park a small army on a pass to hold off a big one, or plan a sea-lane landing. That's the "small army holds off a big one" play the maps now allow. The bot (and Generals) should learn it in the M3 balance pass.
- **Why the 4–6 player games run longer:** endgames. The last two or three kingdoms often sit on opposite sides of a range, and the bots only attack through the pass when clearly stronger, so finishing takes a few extra turns.

## Tuning tried (and why `rules.json` is unchanged apart from sea lanes)

The 4- and 6-player averages (25.8 and 26.3) sit just above the 15–25 target, so I tried four `rules.json` changes, 1,000 games each:

| Change | 2 players | 4 players | 6 players |
|---|---|---|---|
| None (kept) | 23.8 | 25.8 | 26.3 |
| River attack ×0.8 → ×0.85 | 23.9 | 25.6 | 26.2 |
| Capital income 8 → 9 | 23.9 | 25.7 | 26.3 |
| Upkeep-free territories 10 → 12 | 23.5 | 25.2 | 26.4 |
| Attack kill rate 1.0 → 1.1 | 23.4 | 25.7 | 26.1 |

None of them moves game length by more than about half a turn. The extra turns come from how the bots play endgames around the new choke points, not from the economy or combat numbers. So I left the rules as they were rather than weaken rivers or the economy for no real gain. The right fix is bot behavior (attacking through a pass with enough force, using sea lanes), which belongs in the M3 bot and balance work.
