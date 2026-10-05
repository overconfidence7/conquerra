# Conquerra Rules Reference (Milestone 3, session 8)

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
- The host also sets: the **turn timer** (see §3), an optional **turn limit**, the **luck level** (30% by default), **fog** (on by default), and how the **bots** play: **Captain** (the default) or **Recruit** (easy).

## 3. A turn
1. **Orders (the timer runs).** Everyone writes as many orders as they like, in secret.
2. **Resolution.** The game shuffles the seat order, then plays orders **one per player at a time, round-robin**: everyone's 1st order, then everyone's 2nd, and so on. A chained hop (§4) is just another order in your list, so it waits its turn like the rest.
3. **Replay.** Everyone watches what happened on the map, trimmed to what they could see (see §11).
4. **End of turn.** Buildings finish, fallen Leaders come back (see §9), gold comes in, upkeep is paid.

**The turn timer**
- The host picks it in the lobby: **1, 3, 5 (default) or 10 minutes**, or **No timer** for relaxed solo play. (Longer timers, up to a week, come with online games.)
- The countdown is kept by the game host (your browser's background game today, the server from M4), not by the rules engine.
- It turns **gold at 1 minute** left and **red at 15 seconds**.
- **When it runs out, your orders lock in as they are**, exactly as if you had pressed Lock in. (Orders you haven't finished adding, such as an attack you're still choosing troops for, don't count.)
- Lock in early and the turn plays straight away: the bots have already locked in.
- The next countdown starts when the replay ends, plus 3 seconds to glance at the report.

**The replay**
- After Lock in, the turn plays out on the map in the order it happened: armies march along their arrows, each battle shows a short clash and then the result (who holds the land, and the losses on each side), captured land changes colour, and recruits and buildings pop in.
- A short pop-up names the big moments ("Gules captures Oakcrest"). Something in the fog shows only as a soft pulse on its province and "A battle in Northreach", with no names and no numbers.
- **The fog lifts as you go:** when your army takes a territory, the fog fades off the land around it right then, so you can watch a chain push into land you couldn't see. Land you lose fogs over from that moment (see §11).
- A typical turn takes about 10–20 seconds; very busy turns are sped up. **Skip** jumps to the end. There's no pause, play or speed control (decided).
- Then the **turn report** lists it all in words: your gains and losses first, then what you saw, then **what came out of the fog** (rival armies, capitals and Leaders you spotted during the turn, and fighting you couldn't see). **Watch again** replays the turn from the fog you started with.

**Leader timing tricks** (only while your Leader is alive):
- **Seize the Initiative**: one order goes before everyone else's. Then it rests for 3 turns.
- **Lie in Wait**: one order goes after everyone else's. Then it rests for 2 turns.

## 4. Orders
| Order | What it does |
|---|---|
| **Recruit** | Buy troops (2 gold each) at your capital or a barracks. Ask for more than you can afford and you get as many as you can pay for. New troops can act the same turn. |
| **Hire** | Buy a specialist at your capital or a barracks (see §6). |
| **Move / attack** | Send troops to a neighbouring territory. If it's yours, they move in; if not, they attack. You choose **how many** as a share (below). |
| **Build** | Put a building on a territory you hold (one per territory). |
| **Raise culture** | Spend gold to raise a territory's culture by 1 (see §7). |
| **Retreat** | Pull an army back to the safest neighbouring territory you hold. |

**How many troops go: shares**
You don't type a number. You pick a **share of the army that's there when the order plays**:

| Choice | What it sends |
|---|---|
| **Just enough** | The fewest troops likely to win, plus a small safety margin. Attacks only. **A first attack starts with this.** |
| **All** | Everyone except the 1 troop that must stay. **Moves and chained hops start with this.** |
| **3/4, 1/2, 1/4** | That share of the army, rounded to the nearest troop. |
| **Exactly…** (under More) | A set number (or everyone who can go, if fewer are there). |

- Shares are worked out **when the order plays**, not when you write it. Troops you recruited earlier that turn count, and so does an army that arrived from an earlier order.
- A share always sends **at least 1** and always **leaves 1** behind. (An army of 2 sends 1 whatever you pick; an army of 1 can't move.)
- If even everyone wouldn't likely win, "Just enough" sends All.
- The order screen shows an estimate ("about 9, 3/4"). It says "about" when the army depends on a battle earlier in your list.

**Rules of movement**
- Every territory you hold keeps **at least 1 troop** behind; you can't empty it.
- **Chained attacks:** an army that moved into or captured a territory earlier in your order list **can go again from there** in a later order the same turn. There's no limit on hops.
  - Each hop is its **own order** and waits for **its own slot** in the round-robin. Everyone else's next order plays in between, so a rival can hit the land you just took before you push on.
  - Every hop leaves **1 troop behind**, so a long chain thins out as it goes.
  - If a hop **fails**, its survivors fall back to where that hop started (as with any failed attack).
  - If an earlier hop fails or fizzles, a later hop from land you **don't hold** when its turn comes **fizzles**, or runs its backup if it has one.
  - The survivors of a **failed attack** rest for the rest of the turn: they can't go again.
- **Cavalry** still moves **2 territories inside one order** (the middle one must be yours), so a cavalry army covers more ground per hop.

**Planning a chain on the map:** after you queue an attack on B, B shows a faint **"≈18" arriving marker**: the army expected to get there. Tap B, then one of its neighbours, to queue the next hop. Or save a tap: with your army still selected, tap a neighbour of B straight away. The arrows of a chain show their **hop numbers** (①②③) on gold. If the first attack was set to "Just enough", adding a hop raises it to All so there's an army to push on with (the order screen says so). A hop's odds are marked **"estimate"** because they depend on how the battle before it goes. A hop into land you can't see shows "Can't see": no peeking.

## 5. Backups and presets
Any order can have **conditions** ("only if…") and a **backup** order that runs if the conditions fail or the order is no longer possible. If there's no backup, the order just **fizzles** and your next order carries on.

To keep turns fast, you normally pick a **one-tap preset** instead of building conditions by hand:

| Preset | What it means |
|---|---|
| **Only if still stronger** | Attack only if the odds are still at least "likely" when the order comes up. **New attacks start with this switched on**; one tap turns it off. |
| **Hold if threatened** | Cancel the move if enemy armies next to the launch point grew this turn. |
| **Retreat if outnumbered** | If a bigger enemy army is next door, pull back to the safest territory you hold instead. |
| **Follow through** | The automatic chained attack: if the attack captures its target, push on in your next slot. You pick where, or the army picks the weakest neighbour it can likely take. **If you queue your own next hop from there, Follow through steps aside** (one army is never sent twice). |
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
- Each territory has **one culture number, from 0 to 5**. Raise it one level at a time with gold: **3, 4, 6, 8, 10** gold for levels 1–5 (was 4, 6, 8, 10, 12 before session 9).
- **What it does ("loyal land"):**
  - **Defense:** each level makes that territory defend **6% better** (+30% at level 5). It multiplies with terrain and forts (§9).
  - **Holding bonus:** +0.5 gold per turn per level on that territory, and a full province's bonus grows by 0.5 per level of its average culture.
  - **Protection:** each level blocks 15% of bad effects there (up to 75%). Today that means **unrest** (§8). Fate events and uprisings (Milestone 3) will use the same protection.
  - **Unlocks** the fancier specialists in that province (§6).
- **Captured culture passes to the conqueror.** Investing in a border region is a gamble.
- **On screen:** small gold laurels on the troop pill (one per level, at Mid and Near zoom). The territory card says what it does in one line, for example "Culture 2: defends +12%, shrugs off 30% of unrest, +1 gold, unlocks Siege and Engineers in Pinemark", or "No culture yet: raising it costs 3 gold". Before you tap Culture, the panel (and the button's tooltip) says what the next level adds.
- **Where it pays:** where you mean to hold and a rival army is next door, with a real garrison (the bonus is a share of the defenders). The Captain bot buys it at its capital and choke points on those terms.
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
- **Defense strength** = defending troops × terrain (plains ×1.0, forest ×1.2, hills ×1.3, mountains ×1.6, swamp ×1.1) × finished fort (×1.6, unless siege cancels it) × culture (+6% a level, §7) × Leader bonus (+20% if their Leader is there).
- On average, each point of attack strength kills **1.0** defender, and each point of defense strength kills **0.6** attackers. Healers reduce their own side's losses.
- **Luck** spreads each side's actual losses up to 30% either way around that average (most results land near the middle). The host can set luck from 0% to 100%. Luck is rolled on the full average losses before they're capped at the troops actually there, so an attack the preview calls **guaranteed always captures** (fixed in session 9: a 35-against-1 attack could fail before).
- The attacker **captures** the territory if every defender dies and at least one attacker survives. Survivors move in; buildings and culture stay with the land.
- If **both sides are wiped out**, the last defender holds on: the land keeps 1 troop. (Land is never left owned with 0 troops.)
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
  - Your memory updates at the end of every turn from what you can see then (and when the game starts), and **also from everything you saw during the turn** (see "The fog lifts during the replay" below). Land you only saw part-way through a turn reads "Seen last turn" on the next one.
  - **Land you lose:** you see it fall, so your memory records who took it and with how many, even if it's deep in the fog afterwards.
  - It only ever holds what you really saw, so it goes **stale**: the enemy may have moved on since.
  - Each player's memory is kept in the game itself, so it's the same on every device. In M3, a spy who is **fooled** brings back false intel that goes into this same memory, and looks just like the real thing.
- **The fog lifts during the replay.** What you can see is worked out step by step through the turn, not just at the start and the end:
  - When the turn starts, you see exactly what you saw while planning.
  - Each time something changes what you can see (you take land, you lose land, a watchtower is finished, scouts move), your vision is worked out again from the game as it is at that moment.
  - **Take a territory** and from that moment you see it and its neighbours in full detail as they are then: owner, troops, specialists, building, culture, Leader. So a chain pushing into the fog reveals the land hop by hop.
  - **Lose a territory** and from that moment land you can no longer see fogs over, showing what you last saw.
  - Everything you saw along the way goes into your "last seen" memory, as it was when you saw it. That includes land you took and lost again in the same turn.
  - On screen, the fog fades off newly seen land (about a third of a second) and its troop numbers and borders appear. Land that fogs over takes the "last seen" look. By the end of the replay the map is exactly your view for the new turn.
- **What the replay shows:**
  - You always see your own actions and every battle you were part of.
  - Anyone else's action shows in full **if you could see its territory at the moment it happened** (just before or just after it).
  - **Changed in session 8:** land that only came into view *later* in the turn doesn't count. If a rival moved troops on a hill you only spotted three hops into your chain, you don't see the move; you just see the hill as it is when your army gets there. (The old rule showed anything on land you could see at the start or the end of the turn.)
  - A Leader coming back shows to its owner, and to anyone who can see where it reappears.
  - A battle in the fog shows only as a **surface detail**: "a battle in Northreach." No names, no numbers. The same goes for a Leader falling in the fog.
  - Quiet things in the fog (moves, recruiting, building, culture) don't show at all.
  - Eliminations and the end of the game are announced to everyone.
- Eliminated players see the whole board. (In the turn you're knocked out, the fog lifts off everything as that turn's replay starts.)
- With fog off, none of this applies: everyone sees everything, all the time. When you're knocked out you choose **Watch to the end** (the bots play on; you see every turn's report and can skip ahead) or **See the result**.

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

## 13. Bots
Bots play by exactly the same rules as people, and only from their own view (including their "last seen" memory). They never peek.
- **Recruit (easy):** grabs the most valuable land it can probably take, piles troops at the front and rarely plans ahead.
- **Captain (the default):** a short list of priorities:
  1. **Holds choke points cheaply.** On a pass or sea-lane landing facing a rival, it keeps just enough troops to hold (the crossing penalty does the rest) and builds a fort there when it can afford one.
  2. **Breaks through with force.** It only attacks through a pass or across a sea lane with a real army (half as much again as the attack needs), gathering at the crossing until it has one, and brings siege for a fort when it can hire it. Once through, it chains on.
  3. **Lands from the sea** where the far side is weak.
  4. **Finishes what it starts.** It goes after a rival with only a few territories left. With 3 or fewer players left it concentrates on the weakest rival it borders: one spearhead front (where that rival is weakest, nearer its capital), with the rest of its front line holding and sending spare troops there.
  5. **Defends its capital** when a big army stands next to it: it keeps enough there to hold, recruits there and builds a fort.
  6. **Chains like a person.** It hops on when the army that should arrive is comfortably more (1.25 times) than the next hop needs, into the fog too, on its best guess of what's there. Every hop keeps "Only if still stronger", so a bad guess just stops the chain.
  7. **Loyal land.** It raises culture at its capital and at choke points it holds, but only where a rival army is next door and enough troops stand there for the bonus to be worth the gold, and never while a choke point is short of troops.
  8. **Gangs up on a runaway leader.** When one rival looks to hold about **40% of the land**, or at least a quarter of it and **1.75 times anyone else's** (judged only from what the bot sees and remembers: nobody is shown land counts), with at least two rivals left:
     - that rival becomes its main target, and its fronts with that rival come first and keep honest garrisons
     - it stops attacking weaker rivals whose land touches the leader's (they're holding it off)
  9. **Turns on a fast attacker.** If last turn's replay (exactly what that seat watched) showed one rival taking **2 or more of its territories**, that rival becomes its target (a chain is thinly held behind it): it recruits on that front, marches nearby troops there, keeps the choke points facing it held, and armies within two steps stop grabbing neutral land. (Just digging in was tried first: it cut runaways too, but Recruit bots then beat the Captain far more often.)
- The same rules apply to every seat: nobody gangs up on you because you're human, only because you're ahead.
- If a realm loses its capital and has no barracks, it builds one straight away.

## Not in yet (later milestones)
Spies, generals and standing instructions, Spoils and Fate decks, diplomacy, the Fallen, factions.
