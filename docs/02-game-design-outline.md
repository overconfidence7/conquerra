# Conquerra: Game Design Outline v0.1

*This is the "paper prototype": the main ideas in plain language, no formulas. Each section ends with what's in v1 and what comes later.*

---

## 1. The pitch

A fantasy strategy game of rival kingdoms, played online in async turns. Every player plans a whole chain of moves in secret; then all the plans play out at once, one action per player at a time, in a shuffled order. You win by out-planning people, not by out-rolling them.

**Three things make it different:**
1. **Queued, interleaved orders.** You don't take a turn, you write a battle plan, with backup plans.
2. **Low-luck combat (70% skill / 30% luck).** Upsets still happen, but a good plan almost always beats a bad one.
3. **Eliminated players don't leave, they haunt.** The more players who fall, the more chaos they can unleash on the survivors.

---

## 2. How a turn works

**Plan phase** (the timer runs: 5 minutes for a live game up to 24 hours for async)
- Everyone queues as many orders as they want: recruit, build, move, attack, sign a deal, use a hero ability.
- Any order can carry **conditions** ("only if Ashford still has 5+ troops") and **fallbacks** ("otherwise, reinforce Ashford instead").
- You can lock in early. When everyone has locked in, the turn resolves immediately.

**Resolve phase** (automatic)
- The game shuffles the seat order (fairly; see §4).
- It walks round-robin: player A's 1st order, player B's 1st order, player C's 1st, then everyone's 2nd, and so on.
- Before running an order, the engine checks its conditions. If they fail, it tries the fallback. If there's no valid fallback, the order **fizzles** and the queue moves on.
- **Initiative effects** bend the order: some cards and abilities say "your first action goes before everyone's," others say "your last action resolves after everyone's" (good for ambushes and reinforcements).

**Replay**
- Everyone watches the turn play out as an animated replay, step by step, with a written log. This is the "show" moment that replaces dice-rolling drama.

> **Why this works:** it fixes the waiting problem (everyone plans at once), rewards foresight over reflexes, and makes order of operations a real strategic layer.

**Decision (Oct 1):** orders are unlimited for now. If testing shows that whoever has the most free time wins, we add a command-point budget later.

---

## 3. The map

- A **territory graph**: irregular regions connected by borders, as in Risk or War.app. Some borders are special (river crossings, mountain passes, sea lanes).
- Territories group into **provinces**; holding a full province pays a bonus.
- Territories have **terrain** (plains, forest, hills, mountains, swamp) that changes combat and movement.
- **Fog of war:** you see your own land and what borders it. Watchtowers, scouts and hero abilities see further.
- Hand-made maps at first; a map editor and random generation later.

---

## 4. Combat: 70% skill, 30% luck

- Every fight has an **expected result** based on troop counts, unit types, terrain, forts, heroes and attacker/defender bonuses.
- The final result is about 70% that expected value and 30% a random swing. A small edge rarely flips; a big edge almost never does.
- **Before you commit**, the order screen shows the odds: "Likely: take the territory, lose 4–6 troops."
- **Provably fair:** each game's random seed is locked in (as a published fingerprint) when the game starts and revealed when it ends, so anyone can verify that no roll was tampered with. This is aimed directly at the #1 complaint about Hasbro's app.
- The luck dial is a lobby setting (0% to 50%), with 30% as the default.

---

## 5. Economy and buildings

- Territories produce **gold** each turn; province bonuses add more.
- **Upkeep grows with size.** Big empires pay more to hold what they have. This is the main brake on snowballing.
- Buildings (one per territory to start):
  - **Fort:** defense bonus
  - **Market:** extra gold
  - **Barracks:** recruit here (otherwise you recruit only at your capital and province seats)
  - **Watchtower:** sees further through fog

---

## 6. Units and heroes

- **Infantry:** cheap, solid on defense.
- **Cavalry:** moves 2 territories, strong on the attack in open terrain, weak in forests and hills.
- **Siege:** slow, wrecks forts and buildings, weak in a field battle.
- A light rock-paper-scissors: cavalry beats siege, infantry holds against cavalry, siege breaks infantry in forts.
- **Leader (hero):** one per player, moves with an army, boosts it, and has a unique ability. Losing your leader hurts (lost bonuses, a morale hit), but it doesn't knock you out. You can raise a new one at a cost.

---

## 7. Factions

- **v1:** everyone plays the same kingdom, so balance is easy to judge.
- **Later:** 3–4 **asymmetric factions** as an option. Each gets a unique unit, a passive bonus and a different leader. Examples:
  - **Horse clans:** fast and fragile.
  - **Mountain holds:** slow, heavily fortified.
  - **Merchant league:** rich, buys mercenaries.
  - **Old forest:** hides in fog, ambush initiative.

This gives the light RTS flavor without RTS complexity.

---

## 8. Diplomacy

All deals are formal, in-game and visible on the map. **Every deal expires.** There's no shared victory except in team modes set up at the start.

**Handshake deals:** cheap or free to propose; can be broken.
- Breaking one triggers a penalty that **scales with how big the deal was**: a two-territory border truce costs a little; a "peace until Player X is dead" pact costs a lot.
- Penalties: a public **Oathbreaker** mark (everyone sees it), a gold fine, and a short-term debuff (e.g., unrest in your border territories).

**Binding pacts:** cost gold up front; the engine enforces them. You physically can't attack through a binding pact until it ends.

**Deal types:**
- Border truce (named territories)
- Ceasefire (N turns)
- Non-aggression until a condition is met, such as "until Player X is eliminated" (always with a maximum length)
- Right of passage
- Gold or territory trades

Bots will propose and accept deals too, with simple and predictable logic.

---

## 9. The Fallen: eliminated players keep playing

When you're eliminated you become one of **the Fallen**.
- The Fallen earn **Influence** every turn. The more Fallen there are, the faster it grows.
- They spend it on **world events** targeted at the living:
  - Plague (troop loss in a province)
  - Storm (closes a border for a turn)
  - Uprising (flips a territory to neutral rebels)
  - Mercenaries (a neutral army spawns next to the leader)
  - Famine (cuts a player's gold)
- Several Fallen can pool Influence for bigger events.
- Events are capped so they can't single-handedly decide a game, but they keep the endgame unpredictable and give the losers a small taste of revenge.

> **Why this works:** it solves "eliminated means sitting out," and it's an anti-snowball tool that grows exactly when the game is consolidating.

---

## 10. Game modes and ending the game

The host picks the mode when setting up a game:
- **Classic:** last one standing (the default).
- **Conquest:** turn limit; the highest score wins (land, gold, provinces, objectives).
- **Secret objectives:** hidden goals; the first to complete theirs wins.
- **Battle royale:** up to 50 players, free-for-all, last one standing; a big map, and Fallen events matter a lot.
- **Team game:** teams fixed at the start (the only way to share a win).

**Settings:** turn timer, turn limit, luck %, fog level, factions on or off, starting gold, bots fill empty seats.

---

## 11. Bots and quitters

- We build our own rule-based AI. No hidden bonuses; it plays by exactly the same rules.
- Difficulty tiers: Recruit, Captain, Warlord.
- **Single player:** play any mode against bots.
- **Quitters and timeouts:** a bot takes the seat after missed turns, so the game keeps going. Players get a reliability score (used in matchmaking later).

---

## 12. Accounts, access and money

- Web first (an installable PWA), then iOS and Android apps.
- Google sign-in.
- **One-time purchase** unlocks all maps and features; free tier TBD (e.g., one map plus bots plus join friends' games). A cosmetics store comes later. **We never sell power.**

---

## 13. Scope by release

| Feature | Alpha (local) | Friends beta (cloud) | Public 1.0 | Later |
|---|---|---|---|---|
| Queued orders + interleaved resolution | ✅ | | | |
| Conditions + fallbacks | basic | full | | |
| 70/30 combat, odds preview, fair seed | ✅ | | | |
| Gold, upkeep, 4 buildings | ✅ | | | |
| Infantry / cavalry / siege + leader | ✅ | | | |
| Fog of war | ✅ | | | |
| Bots | ✅ (1 tier) | 3 tiers | | |
| Diplomacy: handshake + binding | | ✅ | | |
| The Fallen + world events | | ✅ | | |
| Modes: classic, conquest | ✅ | | | |
| Secret objectives, team games | | | ✅ | |
| Battle royale (50) | | | ✅ | |
| Asymmetric factions | | | ✅ | more factions |
| Tech tree | | | | ✅ |
| Map editor / random maps | | | | ✅ |
| Ranked matchmaking | | | ✅ | |
| One-time purchase | | | ✅ | |
| Native apps | | | | ✅ |
| Cosmetics store | | | | ✅ |
