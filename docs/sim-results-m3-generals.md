# Sim results: generals, captured generals and the Fallen (session 12)

*All games are Captain bots (the lobby's default) on Embervale (4 and 6 players) or Greatmarch (10 players), luck 30%, fog on, classic. "Fair" win share is 1 ÷ players. With 200 games, a win share is good to about ±3 points; with 500, about ±2.*

## In one paragraph
A general writes about as good orders as the Captain itself: a seat that hands its Leader's army a standing instruction from turn 6 wins about as often as a plain Captain in that seat with **Hold**, **Push** or **Raid**. **Defend** wins less, because parking the main army on a border is a cautious plan in a free-for-all. Generals barely change game length. **The Fallen**, at the numbers now in `rules.fallen`, add a little to comebacks without deciding games. They lengthen games by **0.2 turns at 4 players, 2 at 6 and 3 at 10**, and that last one is a risk for Nate's 30–40 turn target.

## Generals

**How it was measured:** one seat plays as the Captain but hands its Leader's army a standing instruction from turn 6 (before that it's a plain Captain). The other seats are plain Captains, and the general seat rotates round the table. The instruction's target is picked from that seat's own view and kept while it makes sense:
- **Hold:** while its land is threatened
- **Defend:** the rival with the most troops facing it
- **Push:** the nearest rival capital it has seen, else the nearest rival land it knows
- **Raid:** the weakest rival it borders

`pnpm --filter @conquerra/sim exec tsx scripts/generals.ts --games 200 --players 4,6`. These runs were before the Fallen existed, so knocked-out seats did nothing.

| Instruction | 4 players: win share | 4p: its Leader fell per game (a Captain seat's) | 6 players: win share | 6p: Leader fell per game | General's attacks that took their target | General's orders that didn't happen |
|---|---|---|---|---|---|---|
| (none: plain Captain in that seat) | 21.0% | 2.94 (2.98) | 14.0% | 3.06 (3.00) | n/a | n/a |
| Hold here | 21.5% | 2.87 | 15.0% | 2.92 | none (it never attacks) | 0% |
| Defend this border | **13.5%** | 2.71 | **11.5%** | 2.63 | 97–98% | 7–8% |
| Push toward a place | 17.5% | **3.40** (2.81) | 16.0% | 3.31 (3.13) | 98–99% | 3% |
| Raid a rival | 22.5% | 3.02 | 15.5% | 2.93 | 99% | 6–7% |

(A bigger 400-game run at 4 players, before the last fix, gave: plain 27.3%, Hold 26.3%, Raid 24.8%, Push 22.5%, Defend 18.5%. Same picture.)

**Game length:** the general seat's games ran 21.0–21.6 turns at 4 players and 26.6–27.4 at 6, the same as all-Captain tables.

### Things a general did that looked dumb, and what was done
1. **It sent everything, recruits included, out of the capital and left 1 troop behind**, so the capital fell. *Fixed:* a general moves the troops that were with it when it planned, by number. Troops recruited there that turn stay and guard the place, and it never leaves a threatened capital bare.
2. **It pushed into a spot right next to a much bigger enemy army**, and lost the army and the Leader the next turn. *Fixed:*
   - it never attacks, hops or marches into land that a visible rival army next door would likely take straight back;
   - stranded on such land (and not at the capital), it falls back a step to land it can hold.
3. **A Leader alone (with just the garrison) tried to march to its post** (a third of Defend's failed orders). *Fixed:* with no army it holds where it is.
4. **On turn 1, a Push toward a far place took the whole starting army three hops into the fog**, next to a rival it couldn't see, and was wiped out. This is the fog working, not cheating. In the sim, a person wouldn't hand out that instruction before meeting anyone, so the seat starts using its general from turn 6. **Worth saying in the rules:** a general sees only what you see.
5. **Hold here on the capital holds your main army there all game.** That's what the instruction says, and it's a losing plan if left on forever (0% win share when the sim did exactly that). In the sim the seat now holds only while threatened. **Use Hold on a border, not on the capital.**
6. **Still true:** a pushing general's Leader falls more often (3.4 vs 2.8 a game at 4 players). It's at the front with the army. It comes back free at the capital next turn, and the general then commands the army there.
7. **Defend wins least.** It walks the main army to the border it's told to guard and holds it. It hits back only with troops it doesn't need there.

Nothing a general does uses information its owner couldn't see (a test changes land in the fog and checks the orders don't change). It never spends gold. The same view and instruction always give the same orders.

### Tap counts (384 px phone, `node apps/web/scripts/tap-count.mjs`)
- **Basic turn: 6 taps**, unchanged (Recruit, attack, add, attack, add, Lock in).
- **Giving your Leader an instruction: 3 taps** after selecting its territory: Command, Push toward a place, the place on the map. (Hold here is 2. Raid and Defend are 3: Command, the instruction, the rival.)

## Captured generals
Bots don't command captured generals (they already plan every army). The engine keeps the two nearest the front when a third arrives and nobody chooses. So captured generals change nothing in all-bot games, and there's no separate sim. Tests cover:
- captured on a knock-out
- the cap of 2 and the choice
- no fighting bonus
- lost for good when its land falls or its army is wiped out

## The Fallen

**The numbers now in `rules.fallen`** (tuned in this session; Nate can change any of them):
- **Influence:** 1 a turn, plus 0.5 for each other Fallen player.
- **Strength:** pooling more than the cost makes an event up to 1.5 times stronger.

| Event | Cost | Rests for (turns) | What it does |
|---|---|---|---|
| Plague | 12 | 4 | 25% of the target player's troops in one province die. It never takes the last troop, and capitals are spared. |
| Storm | 6 | 3 | One border is closed for the turn. |
| Uprising | 12 | 5 | 4 rebels rise against land held by 4 or fewer troops. If they're more, the land turns neutral. |
| Mercenaries | 9 | 4 | 6 neutral troops appear next to the target's land. |
| Famine | 8 | 5 | The target loses 25% of the turn's income. |

The orchestrator's first numbers (Influence 2 + 1 per other Fallen, costs 4–8, cooldowns 2–4, plague and famine 25% and 50%, strength up to 2x) were **far too strong**. At 6 players games ran 10 turns longer (26.6 → 36.7), with 24 events a game, and the halfway leader won only 58%. Famine did most of that: cutting the leader's income in half every few turns stops it recruiting, and the endgame drags. Switching each event off in turn showed famine alone was worth about 4 turns.

**500 games each, the Fallen off → on** (`pnpm sim --games 500 --players 4,6,10 --fallen off|on`):

| Players | Game length (turns) | Within 40 turns | One player on half the map by turn 10 | Halfway leader wins | Comebacks | World events per game |
|---|---|---|---|---|---|---|
| 4 | 20.8 → 21.0 | 98% → 99% | 41% → 40% | 83% → 84% | 19% → 20% | 3.2 |
| 6 | 27.7 → 29.8 | 91% → 85% | 25% → 25% | 74% → 73% | 37% → 41% | 11.4 |
| 10 (Greatmarch) | 35.2 → 38.3 | 79% → 65% | 1% → 1% | 75% → 71% | 52% → 55% | 21.2 |

- **Comebacks are a little more likely** (+1 to +4 points), and the halfway leader wins a little less often at 6 and 10 players. At 4 players there are few Fallen and few turns left once someone's out, so it hardly matters.
- **They don't decide games:** the half-the-map-by-turn-10 runaway is unchanged (it happens before anyone is out).
- **How often the eventual winner was the player hit hardest:** 98% (4p), 98% (6p), 96% (10p). The Fallen aim at whoever is leading, and the leader usually still wins: the events slow it down without taking the game away.
- **Length is the cost:** +2 turns at 6 players and +3 at 10. At 10 players, games within 40 turns drop from 79% to 65%. Slowing how fast Influence grows with more Fallen (0.25 instead of 0.5) didn't help (38.5 turns, 300 games), because the cooldowns, not Influence, set how many events there are. If 10-player length matters more than the comeback effect, the levers are longer cooldowns or a cap of one event per turn for everyone. That's for Nate and the balance pass.
- **Pledges that came to nothing** (several Fallen bots aimed at the same player with different events, and only one may land a turn): 0.1, 3.9 and 13 a game. They cost nothing.

## Reproduce
- Generals: `pnpm --filter @conquerra/sim exec tsx scripts/generals.ts --games 200 --players 4,6`
- One table with a general seat: `pnpm sim --mix general-push,captain,captain,captain --games 200`
- The Fallen: `pnpm sim --games 500 --players 4,6,10 --fallen off`, then `--fallen on`; tune any number with `--rules fallen.events.famine.share=0.2,...`
- The Captain is unchanged by the refactor: `pnpm --filter @conquerra/sim exec tsx scripts/captain-fingerprint.ts` prints `eea18922b89830eb (12187 orders)` before and after.
