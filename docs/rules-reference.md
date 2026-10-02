# Conquerra Rules Reference (Milestone 2, session 4)

*A 10-minute read. This is how the engine actually plays today. Numbers are the current balance settings from `packages/content/data/rules.json`; they will change as we tune.*

---

## 1. The goal
- **Classic** (default): be the last kingdom standing. A player is out when they hold no territory.
- **Conquest**: the game ends after a set number of turns (20 unless the host picks another), and the highest score wins. Score = territories + 3 per full province + 1 per 10 gold.
- The lobby suggests **Conquest for 8 or more players** (big tables would otherwise run long) and Classic below that. The host can change it.
- Classic games also stop at turn 60 as a safety net (highest score wins). In testing, fewer than 1 in 100 games got there.

## 2. Setting up
- Each player starts with a **capital**, **12 troops** there, **20 gold**, and their **Leader**.
- Capitals come from the map's **fair layout** for that many players: every capital is about as far from its nearest rival as the others, has land around it worth about the same, and stands on plains (see §12).
- Every other territory starts neutral with **1 troop**.
- The host also sets: the **turn timer** (5 minutes by default; anything from 1 minute up to a week), an optional **turn limit**, the **luck level** (30% by default), and **fog** (on by default).

## 3. A turn
1. **Orders (the timer runs).** Everyone writes as many orders as they like, in secret.
2. **Resolution.** The game shuffles the seat order, then plays orders **one per player at a time, round-robin**: everyone's 1st order, then everyone's 2nd, and so on.
3. **Replay.** Everyone watches what happened, trimmed to what they could see (see §9).
4. **End of turn.** Buildings finish, fallen Leaders come back (see §9), gold comes in, upkeep is paid.

**Leader timing tricks** (only while your Leader is alive):
- **Seize the Initiative**: one order goes before everyone else's. Then it rests for 3 turns.
- **Lie in Wait**: one order goes after everyone else's. Then it rests for 2 turns.

## 4. Orders
| Order | What it does |
|---|---|
| **Recruit** | Buy troops (2 gold each) at your capital or a barracks. Ask for more than you can afford and you get as many as you can pay for. New troops can act the same turn. |
| **Hire** | Buy a specialist at your capital or a barracks (see §6). |
| **Move / attack** | Send troops to a neighbouring territory. If it's yours, they move in; if not, they attack. |
| **Build** | Put a building on a territory you hold (one per territory). |
| **Raise culture** | Spend gold to raise a territory's culture by 1 (see §7). |
| **Retreat** | Pull an army back to the safest neighbouring territory you hold. |

**Rules of movement**
- Every territory you hold keeps **at least 1 troop** behind; you can't empty it.
- Troops that moved or fought this turn can't move again this turn.
- An army that attacks and fails falls back to where it came from.

## 5. Backups and presets
Any order can have **conditions** ("only if…") and a **backup** order that runs if the conditions fail or the order is no longer possible. If there's no backup, the order just **fizzles** and your next order carries on.

To keep turns fast, you normally pick a **one-tap preset** instead of building conditions by hand:

| Preset | What it means |
|---|---|
| **Only if still stronger** | Attack only if the odds are still at least "likely" when the order comes up. **New attacks start with this switched on**; one tap turns it off. |
| **Hold if threatened** | Cancel the move if enemy armies next to the launch point grew this turn. |
| **Retreat if outnumbered** | If a bigger enemy army is next door, pull back to the safest territory you hold instead. |
| **Follow through** | If the attack captures its target, push on to the next one in your next slot. You pick where, or the army picks the weakest neighbour it can likely take. |
| **Reinforce if hit** | Send these troops only if the destination was attacked earlier this turn (pairs well with Lie in Wait). |

Custom conditions stay available behind an "Advanced" toggle. **Conditions can't see through fog**: a condition about a territory you can't see counts as "no."

## 6. Armies and specialists
- An army is the stack in one territory: **one troop number**, plus **up to 2 specialists**.
- Specialists **travel with the army automatically**. You can choose to leave some behind.
- If you move specialists into an army that already has 2, the extras stay where they were.
- A specialist always needs at least 1 troop with it.

| Specialist | Cost | Upkeep/turn | Culture needed | Effect |
|---|---|---|---|---|
| **Cavalry** | 8 | 1 | none | The army can move **2 territories** in one order (the middle one must be yours). |
| **Scouts** | 5 | 0 | none | The army **sees 1 territory further** through fog. |
| **Siege** | 10 | 1 | 2 | **Cancels an enemy fort's bonus** when this army attacks it. |
| **Engineers** | 8 | 1 | 2 | Any building in this army's territory is **finished instantly**. |
| **Healers** | 10 | 1 | 3 | The army **loses 25% fewer troops** in battle (two healers: 40%, the cap). |

**Culture needed** = the total culture you hold in that province (see §7). It's how culture "unlocks the fancier specialists" for now.

**What happens to specialists when their army is destroyed:** they're **lost**. That's true whether the army dies attacking or its territory is captured. They're never captured or handed to the winner. If an attack fails but some troops survive, the specialists come home with the survivors.

## 7. Culture (light)
- Each territory has **one culture number, from 0 to 5**. Raise it one level at a time with gold: **4, 6, 8, 10, 12** gold for levels 1–5.
- **What it does:**
  - **Holding bonus:** +0.5 gold per turn per level on that territory, and a full province's bonus grows by 0.5 per level of its average culture.
  - **Protection:** each level blocks 15% of bad effects there (up to 75%). Today that means **unrest** (§8). Fate events and uprisings (Milestone 3) will use the same protection.
  - **Unlocks** the fancier specialists in that province (§6).
- **Captured culture passes to the conqueror.** Investing in a border region is a gamble.
- No culture victory, no culture tree. Military first.

## 8. Gold, upkeep and unrest
**Income each turn:**
- Each territory: plains 2, forest 1, hills 1, mountains 1, swamp 0, plus its culture bonus.
- Your capital (if you still hold it): +8.
- Each full province you hold: its bonus (2–3), plus the culture boost.
- A market: +2.

**Upkeep each turn:**
- **Land:** your first 10 territories are free; after that, upkeep climbs faster than your land does (0.35 × extra territories^1.25, rounded). This is the main brake on runaway leaders.
- **Specialists:** their upkeep from the table above.

**Unrest:** if you can't pay, one troop deserts for every gold you're short, starting with your lowest-culture land. Culture talks some of them out of it (its protection share is forgiven). Every territory still keeps its 1-troop garrison.

## 9. Combat (about 70% skill, 30% luck)
- **Attack strength** = attacking troops × border (river crossing ×0.8, mountain pass ×0.85, sea lane ×0.75) × Leader bonus (+20% if your Leader goes along). See §12.
- **Defense strength** = defending troops × terrain (plains ×1.0, forest ×1.2, hills ×1.3, mountains ×1.6, swamp ×1.1) × finished fort (×1.6, unless siege cancels it) × Leader bonus (+20% if their Leader is there).
- On average, each point of attack strength kills **1.0** defender, and each point of defense strength kills **0.6** attackers. Healers reduce their own side's losses.
- **Luck** spreads each side's actual losses up to 30% either way around that average (most results land near the middle). The host can set luck from 0% to 100%.
- The attacker **captures** the territory if every defender dies and at least one attacker survives. Survivors move in; buildings and culture stay with the land.
- A Leader in a captured territory, or in an attacking army that's wiped out, **falls**.
- **Leaders come back for free.** At the end of the turn it fell, your Leader returns at your capital, or at your strongest territory (most troops) if you've lost the capital. So it's waiting for you when you plan your next turn. Seize the Initiative and Lie in Wait cooldowns carry on as before.
- When a player is knocked out, the game records **who knocked them out**. (In Milestone 3 that player gets the loser's Leader as a general.)
- **Odds preview:** before you commit, the game shows "guaranteed / likely / possible / impossible" from the same math the engine uses.
- **Provably fair:** the game's secret random seed is fingerprinted when the game starts and revealed when it ends, so anyone can re-run the game and check every roll.

## 10. Buildings
| Building | Cost | Build time | Effect |
|---|---|---|---|
| **Fort** | 8 | Ready at the end of next turn | Defense ×1.6 |
| **Market** | 6 | Ready at the end of this turn | +2 gold per turn |
| **Barracks** | 6 | Ready at the end of this turn | Recruit and hire here |
| **Watchtower** | 4 | Ready at the end of this turn | See 1 territory further |

Engineers make any of these ready immediately. A building under construction gives nothing yet; if the territory is captured, the conqueror inherits it.

## 11. Fog of war
- With fog on, you see **full detail** (owner, troops, specialists, buildings, culture, Leaders) on **your own territories and the ones bordering them**. Watchtowers and scouts see 1 territory further.
- **Everywhere else** you see only the map itself: outlines, terrain, provinces and what each territory and province is worth. Not who owns it, not troops, not culture.
- Other players' gold is always hidden.
- **You can see a capital when you can see its land:** the map labels it "Capital".
- **Last seen:** land you saw before but can't see now shows what you **last saw** there: the owner, troops and building, marked **"?"** with its age ("seen 2 turns ago"). Land you've never seen says "Unexplored".
  - Your memory updates at the end of every turn from what you can see then (and when the game starts).
  - It only ever holds what you really saw, so it goes **stale**: the enemy may have moved on since.
  - Each player's memory is kept in the game itself, so it's the same on every device. In M3, a spy who is **fooled** brings back false intel that goes into this same memory, and looks just like the real thing.
- **The replay follows the same rule:**
  - You always see your own actions and every battle you were part of.
  - Anything touching a territory you could see (at the start or end of the turn) shows in full.
  - A Leader coming back shows to its owner, and to anyone who can see where it reappears.
  - A battle in the fog shows only as a **surface detail**: "a battle in Northreach." No names, no numbers. The same goes for a Leader falling in the fog.
  - Quiet things in the fog (moves, recruiting, building, culture) don't show at all.
  - Eliminations and the end of the game are announced to everyone.
- Eliminated players see the whole board. When you're knocked out you choose **Watch to the end** (the bots play on; you see every turn's report and can skip ahead) or **See the result**.

## 12. The map: water, mountains, passes, sea lanes and choke points
Maps are made by the **map maker** (same seed, same map) and look like a real place, not a grid.

- **Territories** have natural, irregular shapes of about the same size. Two territories border each other only where they actually touch (or where a sea lane joins them).
- **Seas and lakes** are never territories. You can't stand on water, and you can only cross it by a **sea lane**.
- **Sea lanes** are the dashed lines drawn across water. They join two coastal territories as if they bordered each other, but attacking across one is hard: attack strength ×0.75 (an army landing from boats). Every island has at least one.
- **Mountain ranges** (grey bands) are impassable. The only way through is a **pass**, marked on the map. Attacking through a pass: ×0.85.
- **Mountains territories** are different: they're ordinary land you can hold, just very easy to defend (defense ×1.6).
- **Rivers** run from high ground down to a sea or lake, along the borders between territories. Attacking across a river: ×0.8.
- The attack panel tells you when an attack crosses a river, a pass or a sea lane, and the odds already include it.
- **Choke points:** every map has a few places where a small army can hold off a big one: passes, sea lanes, and narrow land bridges. A fort on a pass or a sea-lane landing (defense ×1.6, and the attacker pays the crossing penalty too) is very hard to break without siege.
- **Provinces** don't straddle mountain ranges or seas, so a range is often a province's natural wall.
- **Our test maps** (both made by the map maker):
  - **Embervale**: 40 territories, 8 provinces, suits 4–6 players. 2 passes, 3 sea lanes.
  - **Greatmarch**: 80 territories, 20 provinces, suits 8–10 players. 7 passes, 3 sea lanes.

## Not in yet (later milestones)
Spies, generals and standing instructions, Spoils and Fate decks, diplomacy, the Fallen, factions.
