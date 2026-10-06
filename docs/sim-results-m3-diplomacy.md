# Sim results: diplomacy (session 14)

*All-Captain tables, luck 0.3, classic, fog on, the Fallen on, both card decks on. 500 games per row (the same seeds with diplomacy off and on). Embervale for 4 and 6 players, Greatmarch for 10. Run with `pnpm sim --games 500 --players 4,6,10 [--diplomacy off] [--reasons 40]`, and `pnpm tsx apps/sim/src/acceptance.ts 60` for the acceptance rates.*

## In short
- **The bots are neither pushovers nor walls.** Offers sorted beforehand (from the true game, not the bot's view) as good for the bot are accepted 94% of the time; bad ones 2%; neutral ones 26% (and 70% get a counteroffer).
- **Diplomacy is a strong brake on runaways.** Comebacks rise at every table size (4 players 25% → 36%, 6 players 45% → 51%, 10 players 55% → 62%), and the halfway leader wins less often. About 2 to 5 joint wars a game are aimed at whoever holds the most land.
- **Games get longer,** by about 4 turns at 4 players (23.6 → 27.8), 5 at 6 players (31.8 → 36.4) and 7 at 10 players (40.8 → 47.4). At 10 players only 27% of games end within 40 turns. **This is the main risk:** no rules were changed for length (as asked); the balance pass (session 16) should look at it. Most of it is truces: about 6 a game at 4 players, 15 at 6 and 44 at 10.
- **With diplomacy off, nothing changes:** every number matches the deck sims exactly (the Captain's play is unchanged; a test checks its fingerprint).

## Acceptance rates (the Captain, from its own view)
22,485 offers, made at turns 4, 8, 12 and 16 of 60 games each at 4 and 6 players. "Sorted beforehand" means the category comes from the true game (who really holds the most land, the real armies on each border); the bot judges only from what it can see.

| Category | Accepted | Countered | Declined |
|---|---|---|---|
| **Good** | **94%** | 2% | 4% |
| **Neutral** | **26%** | 70% | 4% |
| **Bad** | **2%** | 0% | 98% |

By offer:

| Offer | Yes | Counter | Most common reason |
|---|---|---|---|
| Good: a truce on a front it can't afford, while fighting on two | 88% | 2% | "I need my army in the west." |
| Good: a joint war on the runaway leader (one it borders) | 71% | 4% | "We both want Bot 3 beaten." / "Gladly: Bot 3 is the strongest of us." |
| Good: 12 gold for nothing | 98% | 2% | "12 gold, and nothing asked in return: gladly." |
| Neutral: a fair gold trade (10 now for 3 a turn for 4 turns) | 8% | 88% | "Make it 13 gold and it's a deal." |
| Neutral: a truce on a quiet, even border | 36% | 1% | "I'd rather keep my hands free." |
| Neutral: a truce with a rival it doesn't border | 98% | 1% | "We don't even share a border, so peace costs me nothing." |
| Bad: 15 gold for nothing (to them) | 0% | 0% | "I'd give 15 gold for too little: not enough." |
| Bad: a truce from the runaway leader, on their border | 32% | 1% | "You're running away with the map. I won't help you grow." |
| Bad: the runaway asks for border land for 5 gold | 0% | 0% | "You're running away with the map. I won't help you grow." |
| Bad: a truce from a rival it's crushing | 3% | 0% | "You're my target now; I'm not stopping." |

**Where the judgement and the sorting disagree, and why:**
- **A third of truces from the true runaway are accepted.** In those cases the bot can't see that the proposer is running away (under fog it only knows its own neighbourhood and what it remembers), so it judges the truce on its fronts: "I need my army in the east", "Your army at our border is bigger than mine". That's a fair call from its own view, which is the rule. To make it harder to fool, bots also refuse to help **the clear leader as far as they can tell** (the most land they know of, a good third more than anyone else, at least a fifth of the map): "You're the strongest of us. I won't help you grow." That took this from 38% to 32%.
- **Good offers declined:** mostly "I'd rather keep my hands free" (a two-front truce where the bot sees no real pressure), and joint wars from a rival the bot is itself attacking ("You're my target; I won't make peace with you."), which is sound.
- **Neutral offers are mostly countered** rather than accepted or declined: a fair gold trade gets "Make it 13 gold and it's a deal." (gold later is worth a little less than gold now), unless the bot is short of gold ("I could use the gold now.").

**Tuning done:** bots value land they'd give up more than land they'd get (it's income every turn), a truce needs a real reason ("I'd rather keep my hands free" otherwise), they wait 3 turns after a deal ends before proposing the same kind again, and they always accept a joint war against the leader they can see. All numbers are in `rules.diplomacy.bots` (trust) or at the top of `packages/bots/src/diplomacy.ts` (the few judgement constants).

## Diplomacy off vs on (500 games each)

| Players | Length (turns) | Within 40 | Half the map by turn 10 | Halfway leader wins | Comebacks |
|---|---|---|---|---|---|
| 4: off → on | 23.6 → **27.8** | 97.2% → 90.6% | 32% → 24% | 82% → 77% | 25% → 36% |
| 6: off → on | 31.8 → **36.4** | 82.0% → 69.0% | 21% → 10% | 69% → 63% | 45% → 51% |
| 10: off → on | 40.8 → **47.4** | 54.4% → 27.0% | 0.4% → 0.0% | 74% → 67% | 55% → 62% |

**Seat fairness (diplomacy on):** 4 players 22.8 / 22.6 / 26.0 / 28.6%; 6 players 13.6 / 16.8 / 14.8 / 17.4 / 18.2 / 19.2%; 10 players 7.2 / 8.6 / 12.8 / 7.6 / 8.8 / 9.0 / 11.8 / 11.4 / 11.4 / 11.4%. Within the usual spread for 500 games.

**Deals per game (diplomacy on):**

| Players | Offers between bots | Accepted | Deals made | Truces | Trades | Joint wars | Binding | Broken | Joint wars on the land leader |
|---|---|---|---|---|---|---|---|---|---|
| 4 | 25.9 | 42% | 10.5 | 6.0 | 2.6 | 1.9 | 0.4 | 0.79 | 1.76 |
| 6 | 54.4 | 43% | 21.6 | 15.1 | 2.7 | 3.8 | 1.1 | 2.35 | 3.38 |
| 10 | 142.8 | 45% | 62.1 | 43.8 | 12.7 | 5.6 | 2.4 | 5.05 | 4.64 |

Broken deals come from the Captain taking a capital it's sure of ("Your capital at Eldermere is mine for the taking; our truce isn't worth more than that."), joint wars broken by a truce with the target, and handshake payments that couldn't be made (this run doesn't count which is which).

**Decks with diplomacy on:** still not decided by them. The winner took the lead for good on a Spoils turn in 24 / 29 / 29% of games (26 / 27 / 29% by chance); its share of good Fate events was 57 / 46 / 34% against 58 / 49 / 42% of the land.

**Options for the balance pass (not done here):** fewer truces at big tables (bots propose less often when many players are left, or a truce costs a little gold even as a handshake), shorter default truces (2 turns), or a lobby switch so long games can play without diplomacy.

## Ten sample reason lines (real sim games)
1. Bot 3 → Bot 1, truce: yes, "I need my army in the south-west."
2. Bot 2 → Bot 4, joint war: yes, "Gladly: Bot 3 is running away with the map."
3. Bot 3 → Bot 1, truce: no, "You're running away with the map. I won't help you grow."
4. Bot 1 → Bot 3, truce: no, "I'm stronger on our border; I'd rather fight."
5. Bot 2 → Bot 1, truce: yes, "Your army is at my capital's door; I'll take peace."
6. Bot 3 → Bot 4, trade: counter, "Make it 19 gold and it's a deal."
7. Bot 3 → Bot 1, trade: counter, "You broke our truce at Sunshire. Make it binding and it's a deal."
8. Bot 4 → Bot 3, trade: no, "I'd give Thornton for 8 gold: not enough."
9. Bot 2 → Bot 4, joint war: no, "Bot 1 is too strong for me to take on right now."
10. Bot 4 → Bot 2, truce: no, "You're my target now; I'm not stopping."

And a break, as the Captain says it in the report: "Your capital at Eldermere is mine for the taking; our truce isn't worth more than that."
