# Simulator results: chained attacks (session 7, Oct 4)

*How chained attacks changed bot-vs-bot games. 1,000 games at each table size, Recruit bots, normal luck (30%), fog on, Classic mode. Embervale for 2, 4 and 6 players; Greatmarch for 10. Same game seeds before and after, so the only difference is the rule (and the bots using it).*

Three runs:
- **Before:** the old rule (an army that moved or fought can't move again this turn).
- **After:** chained attacks. The Recruit bot chains on by hand only when the army that should arrive is **at least twice** what the next target needs (up to 3 hops).
- **Stress test:** the same rule, but bots chain on whenever the next hop is merely *likely* to win. This is closer to an eager human chainer, so it shows the worst case.

Commands (anyone can re-run them):
```
pnpm sim --games 1000 --players 2,4,6,10 --seed m2
pnpm sim --games 1000 --players 2,4,6,10 --seed m2 --chain-margin 1
```

## Game length (target: 15–25 turns)

| Players | Before: avg / median | After: avg / median | Stress test: avg / median |
|---|---|---|---|
| 2 | 23.9 / 23 | 23.5 / 23 | 22.2 / 21 |
| 4 | 25.9 / 25 | 24.9 / 23 | 24.1 / 23 |
| 6 | 26.4 / 25 | 26.0 / 25 | 25.0 / 23 |
| 10 | 36.3 / 35 | 36.0 / 35 | 35.0 / 34 |

Share of games inside 15–25 turns at 4 players: 54% before, 61% after, 62% stress test.

**In plain words:** chaining makes games a little shorter, about one turn at 4–6 players. That nudges 4- and 6-player games toward the 15–25 target, which they were just over. **10-player games are still about 35 turns**, well over target. Chaining doesn't fix that. (Conquest mode, which the lobby suggests for 8+ players, caps those games at 20 turns.)

## Seat fairness (each seat should win about the same share)

| Players | Before | After | Stress test |
|---|---|---|---|
| 2 (fair 50%) | 50.4 / 49.6 | 52.3 / 47.6 | 49.0 / 51.0 |
| 4 (fair 25%) | 23.3 / 24.9 / 24.0 / 27.8 | 23.1 / 24.0 / 27.9 / 25.0 | 23.9 / 24.5 / 25.6 / 26.0 |
| 6 (fair 16.7%) | 15.7–17.3 | 14.0–17.7 | 13.6–18.1 |
| 10 (fair 10%) | 8.5–11.5 | 8.5–10.9 | 8.3–12.1 |

**In plain words:** still fair. With 1,000 games a seat drifts about ±1.5 points by chance alone. The lowest seat at 6 players (14.0% after, 13.6% stress) is at the edge of that, and it's a different seat each run, so it looks like chance, not a built-in edge. Worth watching in the session 13 balance pass.

## Runaway check: one player holds more than half the map after turn 10

| Players | Before | After | Stress test |
|---|---|---|---|
| 2 | 71% | 76% | 81% |
| 4 | 40% | 45% | 48% |
| 6 | 24% | 27% | 29% |
| 10 | 0% | 0% | 0.3% |

(At 2 players someone usually holds half the map by turn 10 anyway; it's the 4- and 6-player numbers that matter.)

**In plain words:** chaining makes early runaways a bit more common: +5 points at 4 players, +3 at 6, and up to +8 at 4 players with very eager chaining. That's a real but modest effect, not a blitz problem. The brakes are working: each hop waits for its own slot, rivals act in between, and a hop into land you can't see is a gamble.

**One thing that was already true before chaining:** at 4 players, in 40% of games one bot already held half of Embervale by turn 10. Chaining didn't create that, but it adds to it.

## How much the bots chain

| Players | Chained hops per game: before* | After | Stress test |
|---|---|---|---|
| 4 | 38 | 44 | 58 |
| 6 | 39 | 46 | 64 |

\*"Before" counts Follow through and armies marching on through their own land, which the old rules already allowed. About 82–86% of chained attacks captured their target in every run.

## Balance concern, and options for Nate

Chaining is **not** causing a problem big enough to change the rules now. Game length improved slightly, fairness held, and runaways rose a little. The concern is **early runaways at 4 players** (40% before, 45% now, maybe higher with skilled human chainers). Options, none applied (rules don't change without you):

1. **Do nothing yet (recommended).** Bots are a weak stand-in for people. Play some games with chaining and see whether it *feels* like blitzing. Session 8's smarter bots will also defend better (holding passes and choke points).
2. **A gentle brake on hops:** each hop after the first fights at −10% strength ("tired troops"). Simple to explain, and it keeps long chains possible but costly.
3. **A hop limit:** at most 2 or 3 hops per army per turn. Very easy to understand, but it's the cap we decided against.
4. **Look at the runaway itself, not chaining:** land upkeep already brakes big realms. It could start earlier (after 8 territories instead of 10). This would also help 10-player game length a little.
