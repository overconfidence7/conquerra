# Simulator results: session 9's fixes (Oct 5)

*How games play after session 9: the combat fix, province recruiting, culture that defends ("loyal land"), Captains that gang up on a runaway leader and turn on a fast attacker, and the rebuilt maps (map maker v2). 1,000 games at each table size, normal luck (30%), fog on, Classic mode, seed `m2` (the same games as sessions 7 and 8). Embervale for 2, 4 and 6 players; Greatmarch for 10.*

Commands (anyone can re-run them):
```
pnpm sim --games 1000 --players 2,4,6,10 --seed m2                                   (all Captain: the lobby default)
pnpm sim --games 1000 --players 2,4,6,10 --seed m2 --captain-off runaway,raider      (the same, without Part 2's bot changes)
pnpm sim --games 1000 --players 4 --seed m2 --mix captain,recruit,recruit,recruit
pnpm sim --games 1000 --players 2 --seed m2 --mix captain,recruit
pnpm sim --games 3000 --players 4 --seed c9 --mix captain,captain-no-culture,captain,captain-no-culture
```

## In one paragraph
Games are a little longer than at the start of session 9 (4 players: 19.3 → 20.8 turns; 6 players: 21.0 → 27.7) and **runaways are much rarer**: one player on half the map by turn 10 went from 82% to 38% of 4-player games and from 71% to 22% of 6-player games. About a third of that comes from the bots (Part 2) and the rest from the rebuilt Embervale, whose capitals now start a border closer. The leader at the halfway point still usually wins (83% at 4 players), so a big lead is still hard to overturn. Seats stay fair, culture is now a fair buy (buyers win 50% against Captains that never buy it), and no lopsided attack failed. In real time a single-player game is still a bit short of Nate's 45–90 minutes at 4 players (about 42 minutes), and inside it at 6 and 10.

## The orchestrator's measurements (400 Captain games per step, seed m2)
| 4 players | Avg turns | One player on half the map by turn 10 |
|---|---|---|
| Session 8 (`4dd3ba2`) | 23.9 | 54% |
| + combat fix (`16bcb84`) | 20.2 | 80% |
| + province recruiting (`acca11d`) | 18.6 | 85% |
| + culture (`afc0296`) | 19.3 | 80% |

6 players moved the same way: 48% → 64% → 73% → 66%. Most of the jump came from the combat fix: attacks now work as they should.

## Game length (target 15–25 turns; Nate's real-time targets: single player 45–90 minutes, live online 2 hours or more)
Real time is rough: turns × (1.5 minutes to plan a typical single-player turn + about half a minute of replay); online, turns × (up to 5 minutes on the timer + the replay).

| Players | Session 8 | Session 9 start (old maps) | **Now** | Share inside 15–25: session 8 → now | Single player, now | Online (5-minute timer), now |
|---|---|---|---|---|---|---|
| 2 | 22.3 | 19.4 | **19.3** | 69% → 76% | about 39 min | up to 1.8 h |
| 4 | 24.0 | 19.3 | **20.8** | 59% → 65% | about 42 min | up to 1.9 h |
| 6 | 25.0 | 21.0 | **27.7** | 59% → 47% | about 55 min | up to 2.5 h |
| 10 | 39.8 | 33.4 | **35.1** | 4% → 10% | about 70 min | up to 3.2 h |

**In plain words:** 2- and 4-player games are about 4 turns shorter than in session 8 (the combat fix), 6-player games about 3 turns longer (Captains now gang up and hit back, and the 6-player capitals on the rebuilt map are closer). In real time, a 4-player game against Captains is a little under Nate's 45-minute floor and an online one a little under 2 hours; 6 and 10 players are inside both targets. Nate's first game against Recruit bots took about 30 minutes (Recruit games now: 21.6 turns at 4 players). No rules were changed for length: cards, generals, diplomacy and bigger maps (sessions 10–15) all add time.

## Seat fairness (each seat should win about the same share)
| Players | Session 8 | Now |
|---|---|---|
| 2 (fair 50%) | 50.4 / 49.6 | 50.0 / 50.0 |
| 4 (fair 25%) | 23.7–25.6 | 23.4–26.7 |
| 6 (fair 16.7%) | 15.3–18.2 | 14.9–18.4 |
| 10 (fair 10%) | 8.8–11.6 | 8.6–12.1 |

Still fair.

## Runaways: three measures
1. **Half the map by turn 10:** how often one player holds more than half the territories after turn 10.
2. **Halfway leader wins:** how often the player with the most land at the halfway point goes on to win. (Lower means a lead can still be overturned.)
3. **Comebacks:** how often the eventual winner was *not* the leader after turn 10 (games that went past turn 10).

| Players | Measure | Session 8 | Session 9 start (old maps, before Part 2) | New maps, without Part 2 | **New maps, with Part 2 (now)** |
|---|---|---|---|---|---|
| 2 | half the map by turn 10 | 73% | 84% | 82% | **71%** |
| | halfway leader wins | – | 88% | 87% | **89%** |
| | comebacks | – | 11% | 12% | **13%** |
| 4 | half the map by turn 10 | 55% | 82% | 49% | **38%** |
| | halfway leader wins | – | 91% | 85% | **83%** |
| | comebacks | – | 10% | 18% | **20%** |
| 6 | half the map by turn 10 | 46% | 71% | 29% | **22%** |
| | halfway leader wins | – | 84% | 78% | **74%** |
| | comebacks | – | 19% | 33% | **37%** |
| 10 | half the map by turn 10 | 0.3% | 3.1% | 2.8% | **0.6%** |
| | halfway leader wins | – | 80% | 75% | **76%** |
| | comebacks | – | 41% | 49% | **49%** |

(Session 8 didn't measure the two new ones.)

**In plain words:**
- **Part 2 helps on every measure at 4 and 6 players** (same maps, same games, only the bots differ): fewer early runaways (49% → 38%, 29% → 22%), a little less "the halfway leader always wins", and more comebacks.
- **The rebuilt Embervale helped more than the bots.** Its fair capital layout for 4 players puts rivals 3 borders apart instead of 4, so neighbours meet sooner and nobody gets a long free run through neutral land.
- **A big lead at halfway is still hard to overturn** (74–89%). Bots can only do so much: once a realm is twice everyone else's size, its income keeps it ahead. Options are below.

### What the two Part 2 behaviours do (and one that was dropped)
- **Ganging up on a runaway leader** (priority 8): when a rival looks to hold about 40% of the land, or a quarter and 1.75 times anyone else's (from the bot's own view and memory), it becomes the main target, those fronts keep honest garrisons, and the bot leaves alone weaker rivals who are holding the leader off. On its own it mostly makes games longer; switching it off makes little difference to the runaway numbers.
- **Turning on a fast attacker** (priority 9): when last turn's replay showed a rival taking 2 or more of its territories, that rival becomes its target (a chain is thinly held behind it), and the bot recruits and marches troops to that front instead of grabbing neutral land nearby. This does most of Part 2's work.
- **Dropped: digging in.** The first version reacted to any rival capturing land near its border by keeping honest garrisons and stopping all other attacks nearby. It cut runaways too, but it made Captains passive: one Captain against three Recruits fell from 28.8% to 20.9% wins, and head to head from 92% to 76%. Hitting back works better on both counts (below).

## Is the Captain still the stronger bot?
| Table | Session 8 | Session 9 start | **Now** | Fair share |
|---|---|---|---|---|
| 1 Captain + 3 Recruits (4 players) | 37.4% | 31.0% | **33.5%** | 25% |
| 1 Captain vs 1 Recruit (2 players) | 77.0% | 75.6% | **92.4%** | 50% |

Yes, clearly. The combat fix took a little of its edge at 4 players (attacks that should win now always do, which helps the Recruit's simple style too); Part 2 gave some back.

## Culture ("loyal land")
**Chosen:** each culture level makes that territory defend **6% better** (+30% at level 5), and the costs are **3, 4, 6, 8, 10** gold (was 4, 6, 8, 10, 12).

**Tuning** (Captains that buy culture against Captains that don't, 4 players, buyers' win rate, fair = 50%):

| Setting | Old Captain (buys wherever it means to hold) | New Captain (only where it pays) |
|---|---|---|
| +4%/level, 4/6/8/10/12 | 36.5% | – |
| +5%/level, 4/6/8/10/12 (session 9's first try) | 37.7% | 50.9% |
| +6%/level, 4/6/8/10/12 | 37.4% | – |
| +8%/level, 4/6/8/10/12 | 37.3% | – |
| +4%/level, 3/4/6/8/10 | 40.4% | – |
| +5%/level, 3/4/6/8/10 | – | 51.0% |
| **+6%/level, 3/4/6/8/10** | 40.3% | **51.0%** (6 players: 50.6%) |
| +8%/level, 3/4/6/8/10 | 40.7% | 50.6% |

**In plain words:** the size of the bonus barely changed anything; **where the Captain bought was the problem.** It used to raise culture at its capital, choke points and forted frontier whenever it had gold to spare, mostly in places nobody attacked, so it simply had fewer troops. Now it buys only at its capital or a choke point it holds, with a rival army next door, enough troops there for the bonus to be worth the gold, and no choke point short of troops. That brought buyers from 37.7% to an even 50%. With the final bots and maps: **50.0%** at 4 players and **49.0%** at 6 (3,000 games each; 47.8% in the 1,000 `m2` games), so culture is a fair buy, not a must-buy. +6% was picked over +5% because it's easier to notice in play (+30% at level 5) and cost the same.

**How often, and where (Captain tables now):** culture is bought in nearly every game (9.0 raises a game at 4 players, 11.2 at 6). Where the raises go:

| Players | Capital | Choke points | Other frontier | Interior |
|---|---|---|---|---|
| 2 | 4% | 25% | 0% | 71% |
| 4 | 21% | 42% | 0% | 37% |
| 6 | 32% | 23% | 0% | 45% |
| 10 | 26% | 27% | 0% | 47% |

The interior raises are the old "a little culture in safe land when comfortably rich" habit, which every Captain still has.

## Recruits by site (troops recruited)
| Players | Capital | Barracks | A territory in a province you hold completely |
|---|---|---|---|
| 2 | 7% | 60% | 33% |
| 4 | 23% | 54% | 23% |
| 6 | 27% | 55% | 18% |
| 10 | 19% | 56% | 25% |

Province recruiting is used a lot: a quarter to a third of all troops.

## Lopsided attacks (8 times the defenders or more) that failed
**0 of about 330,000** across all four table sizes (before the combat fix: 5.3%). An attack the preview calls guaranteed always captures.

## The rebuilt maps play about the same (400 games, final bots)
| | Embervale, 4 players: old → new | Greatmarch, 10 players: old → new |
|---|---|---|
| Average turns | 19.9 → 20.9 | 33.5 → 34.9 |
| Seats | 19.8–28.5% → 23.3–28.8% | 7.8–12.8% → 7.3–13.8% |
| Half the map by turn 10 | 73.5% → 42.3% | 0.5% → 0.3% |
| Halfway leader wins | 92% → 84% | 85% → 75% |
| Comebacks | 13% → 20% | 40% → 49% |

Length and fairness: about the same. Runaways: fewer on the new maps (see above).

## Options for Nate (no rules were changed for these)
1. **A big lead is still hard to overturn** (the halfway leader wins 74–89%). The bots now gang up, but income still snowballs. Rule brakes stay on file for the balance pass (session 16): tired troops after several hops, a hop limit, or upkeep that starts earlier for big realms. Cards, generals and diplomacy (sessions 12–14) also give a trailing player new ways back.
2. **4-player games in real time** (about 42 minutes single player, under 2 hours online) are a little under your targets. Nothing to do now: sessions 10–15 add turns and decisions. If it's still short after the card decks, the balance pass can slow expansion.
3. **6-player games got longer** (27.7 turns, 47% inside 15–25). That suits your real-time targets better than the 15–25 band. Worth deciding in the balance pass which target wins: turns or minutes.
