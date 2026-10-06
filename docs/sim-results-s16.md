# Session 16 sim results

Captain bots, Embervale (4 and 6 players) unless it says otherwise, with everything on (fog, the Fallen, both decks, diplomacy, spies). 300 games per row. "Before" is the same code with the old rule switched back on through `--rules`.

## Culture lost when land changes hands (Part 1)

`pnpm sim --games 300 --players 4,6` against `--rules culture.keptOnCapture=1` (the old rule: the conqueror keeps it).

| | Culture kept (old) | Culture lost (new) |
|---|---|---|
| 4 players: average turns | 27.9 | 27.7 |
| 4 players: within 40 turns | 91.3% | 90.3% |
| 6 players: average turns | 37.1 | 37.4 |
| 6 players: within 40 turns | 66.7% | 65.7% |

No real change in length: the Captain spends little on culture except at its capital and choke points it means to hold, so not much culture changes hands. (The bots now value a rival's culture only as what taking it denies them.)

## The Spoils rework (Part 4)

After Part 1 → after the rework (one of each is the best set; every set gives gold; troops spread over the front).

| | Before | After |
|---|---|---|
| 4 players: average turns | 27.7 | 27.5 |
| 4 players: sets turned in a game | 18.8 | 18.1 |
| 6 players: average turns | 37.4 | 36.7 |
| 6 players: sets turned in a game | 32.3 | 30.5 |
| "The winner took the lead for good on a turn it turned in a set" (by chance about 26%) | 25% / 23% | 21% / 31% |

The new windfalls don't make games longer, and the decks still don't decide games (the 6-player 31% against 26% by chance is within the noise of 300 games). Sets at the hand limit turned in by the game: 0.1–0.2 a game.

## Why nobody ganged up on Nate (Part 4)

`npx tsx apps/sim/scripts/s16-runaway.ts 100 on|off`: Wyrmland, 6 players, the table Nate played. Seat 1 is a **fast expander**, the best stand-in for a person running away: the Captain with its caution turned down (it chains on whenever a hop is likely to win, and doesn't hold passes cheaply, gather before a breakthrough, build forts or raise culture). The other five are Captains. "A true runaway" means the Captains' own rule (about 40% of the land, or a quarter and 1.75 times anyone else) applied to the real map.

| 100 games each | Fog on (as Nate played) | Fog off |
|---|---|---|
| The expander wins | 16% (fair 17%) | 14% |
| It became a true runaway | in 27% of games, first on turn 15.9 | in 28%, first on turn 13.8 |
| While it was, the Captains' rule (each from its own view) named it | **21%** of Captain-turns | **100%** |
| A Captain noticed at all | in 59% of those games, **8.6 turns late** | in all of them, at once |
| Joint wars against it | **0.63 a game** (16% of games), first on turn 27 | **4.31 a game**, first on turn 14 |
| The Fallen's world events on it while it ran away | 1.61 a game (0.03 on everyone else) | 1.59 (0.00) |
| The Fallen exist (someone knocked out) | from turn ~14 on average | about the same |

**What this says:**
- **People and bots are judged the same way.** No bot rule looks at whether a seat is a person; the runaway rule, the deal rules ("never help the clear leader") and the Fallen's targeting all count land the same way for every seat.
- **The Fallen do turn on a runaway**, once there are Fallen. They see the political map (who holds what everywhere), so they recognise it at once. In Nate's 12-turn game, few or no players were knocked out early enough to matter.
- **Under fog the Captains can't tell.** Each one counts only the land it sees or remembers. On a 120-territory map it sees a slice of a big empire, so a runaway rarely looks like 40% of the map to any one of them. With fog off the same rule catches it at once and the joint wars follow within the turn. In Nate's game (12 turns, ended by turn 12), the bots most likely never saw him as a runaway at all.
- **The stand-in is far weaker than Nate.** It wins 16% and only becomes a runaway in about a quarter of games, around turn 14–16; Nate won in 12 turns. A person who expands well gets there sooner, so the bots' delay matters even more against a person.

**Not fixed here (a judgement problem, not a bug): for session 17, the Marshal.** Ideas to test there:
1. **Estimate land you can't see:** from the public facts (how many players are left, Spoils card counts, who has been knocked out and by whom, the land you've watched a rival take in the replays, its Leader's and armies' sizes), not just the land you remember.
2. **Share what bots see:** a joint war is already a conversation; bots in a deal (or proposing one) could pool their sightings of the leader.
3. **React to pace, not only size:** a rival that took the most land over the last few turns (as the replays showed it) is a threat before it's 40% of the map.
4. **Lower the bar on big maps:** 40% of 120 territories is 48; a quarter and 1.75 times anyone else may suit better at 6+ players.
5. **The Fallen earlier:** they're the one force that sees everything; the balance pass could let them act sooner (their Influence starts at 0).
