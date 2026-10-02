# Simulator Results: Milestone 1 (engine v0.2)

*October 2, 2026. "Recruit" bots, 70/30 skill/luck, fog on, classic mode (last one standing). Embervale test map (40 territories) for 2–6 players; Greatmarch (80 territories) for 10. Reproduce with `pnpm sim --games 1000 --players 2,4,6 --seed m1` and `pnpm sim --games 200 --players 2,6,10 --seed cpu`.*

## Balance and fairness (1,000 games per row)

| Players | Crashes | Win rate by seat (fair = equal) | Avg length | Median | Games in 15–25 turns | Winner locked in the lead at | Lead changes / game |
|---|---|---|---|---|---|---|---|
| 2 | 0 | 48.8 / 51.2% | 23.4 turns | 22 | 65% | 35% of the game | 2.4 |
| 4 | 0 | 24.2 / 23.3 / 26.1 / 26.4% | 23.3 turns | 22 | 70% | 36% | 3.4 |
| 6 | 0 | 18.0 / 16.1 / 15.5 / 18.9 / 15.7 / 15.8% | 25.4 turns | 24 | 61% | 39% | 4.4 |
| 10 (200 games, bigger map) | 0 | 7.5–12.5% each | 36.9 turns | 35 | 9% | 39% | 5.1 |

- **The game-length target is met** for 2–6 players: typical games run 22–24 turns (was 80–110 in the prototype). About 1 game in 10 runs past 35 turns, usually because the last two kingdoms are evenly matched and trade land back and forth.
- **10 players on the 80-territory map runs longer** (about 35 turns). That's mostly map size: 8 territories per player instead of 6–7. Bigger games will want a map sized to the player count, or conquest mode with a turn limit.
- **Seats are fair.** Every seat is within normal random variation of an equal share.
- **Winners aren't obvious early.** The eventual winner typically takes the lead for good about 35–40% of the way through. There are fewer lead changes than in the prototype (2–4 vs 10–14), but that's mostly because games are 4× shorter; per turn, the lead changes about as often.
- **Bots use the new systems:** about 60–67% of their orders carry a preset; they hire ~4–5 specialists and raise culture ~9–10 times per game. Around 10–14% of orders fizzle, mostly attacks cancelled by "Only if still stronger," which is the preset doing its job.

## What changed to get there (all in `rules.json`, plus a smarter bot)

| Setting | Prototype | Now |
|---|---|---|
| Troop cost | 3 | 2 |
| Starting troops / gold | 7 units / 10 | 12 troops / 20 |
| Neutral garrisons | 2 | 1 |
| Capital income | 4 | 8 |
| Attack kill rate / defense kill rate | 0.6 / 0.7 | 1.0 / 0.6 |
| Upkeep: free territories, rate | 6, 0.5 | 10, 0.35 |

In plain terms: armies are bigger, battles are more decisive, attacking is rewarded, and the early land grab is faster. The bot now concentrates its armies and builds barracks near the front instead of spreading one-troop garrisons everywhere.

## Turn-resolution CPU time (for Cloudflare sizing)

Measured on Nate's laptop, per turn, 200 games each. "Bots planning" is every AI seat planning its orders (each one builds its own fogged view first).

| Players | Engine resolves the turn: avg / worst | Bots planning (all seats): avg / worst | Total: avg / worst |
|---|---|---|---|
| 2 | 0.10 ms / 1.8 ms | 0.15 ms / 1.4 ms | 0.25 ms / 3.2 ms |
| 6 | 0.14 ms / 0.7 ms | 0.25 ms / 1.3 ms | 0.39 ms / 1.6 ms |
| 10 | 0.27 ms / 2.8 ms | 0.47 ms / 2.3 ms | 0.75 ms / 3.2 ms |

(Across the 1,000-game runs the single worst turn was 6.5 ms at 6 players.)

**What this means for hosting:**
- A typical turn takes well under 1 ms of CPU, so the engine itself is cheap.
- The "worst" numbers are one-off slow turns (the JavaScript engine warming up or cleaning memory), and they reach 3–6 ms. The Free plan's limit is 10 ms per request, and on the server a turn also has to load and save the game, and build a view and replay for every player.
- So 2–10 player games would *probably* fit on the Free plan, but with little room to spare, and the 50-player mode certainly won't. **The plan to switch to Workers Paid ($5/month) at the start of M4 still stands**; nothing needs to change before then.
