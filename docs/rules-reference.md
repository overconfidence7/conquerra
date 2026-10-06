# Conquerra Rules Reference (Milestone 3, session 14)

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
- The host also sets: the **turn timer** (see §3), an optional **turn limit**, the **luck level** (30% by default), **fog** (on by default), the **Fate deck** (on by default, §19), and how the **bots** play: **Captain** (the default) or **Recruit** (easy).

## 3. A turn
1. **Orders (the timer runs).** Everyone writes as many orders as they like, in secret.
2. **Resolution.** The game shuffles the seat order, then plays orders **one per player at a time, round-robin**: everyone's 1st order, then everyone's 2nd, and so on. A chained hop (§4) is just another order in your list, so it waits its turn like the rest.
3. **Replay.** Everyone watches what happened on the map, trimmed to what they could see (see §11).
4. **End of turn.** Buildings finish, fallen Leaders come back (see §9), gold comes in, upkeep is paid. Then the card decks: missions are checked (§19), Spoils cards are earned (§18), and everyone draws a Fate card for the coming turn (§19).

**The turn timer**
- The host picks it in the lobby: **1, 3, 5 (default) or 10 minutes**, or **No timer** for relaxed solo play. (Longer timers, up to a week, come with online games.)
- The countdown is kept by the game host (your browser's background game today, the server from M4), not by the rules engine.
- It turns **gold at 1 minute** left and **red at 15 seconds**.
- **Pause** (single player, session 13): with a timer on, the round button next to it stops the clock and the timer reads **Paused**. You can keep planning while it's paused (the map dims a little so you notice); nothing locks in until you resume, and the clock carries on from where it stopped. Without a timer there's no button. (Online games will pause by vote, in M4.)
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
| **Recruit** | Buy troops (2 gold each) at your capital, any barracks, or **any territory in a province you hold completely** (session 9). Choose how many with the same chips as attacks: All, 3/4, 1/2 or 1/4 of your gold (an exact number under More; the default is All). You can queue several recruits to split troops across sites, and edit them in the queue. While Recruit is open, every place you can recruit glows. Ask for more than you can afford and you get as many as you can pay for. New troops can act the same turn. |
| **Hire** | Buy a specialist at your capital or a barracks (see §6). Hiring doesn't use the province rule. |
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
  - **Protection:** each level blocks 15% of bad effects there (up to 75%): **unrest** (§8), the Fallen's world events (§16) and bad **Fate events** (§19). An all-or-nothing event (a fire, a flooded ford) is shrugged off with that chance.
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
- When a player is knocked out, the game records **who knocked them out**, and that player gets the loser's Leader as a **captured general** (§15). The knocked-out player becomes one of **the Fallen** (§16).
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

**On the map** (session 9): buildings stand next to the army marker, about the size of a capital's castle, on a soft ground shadow, and never under the marker. One being built shows behind a wooden scaffold, and the marker's building icon carries a small hourglass ("ready next turn"). Buildings you only remember (in the fog) are greyed.

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
  - A battle in the fog shows only as a **surface detail**: "a battle in Northreach." No names, no numbers. The same goes for a Leader falling in the fog, and for a Fate event ("something stirs in Northreach", §19).
  - Quiet things in the fog (moves, recruiting, building, culture) don't show at all.
  - Eliminations and the end of the game are announced to everyone.
- **Knocked-out players are the Fallen (§16) and see the political map:** who holds what everywhere, and the capitals, but no troop numbers, buildings or armies (so nothing about armies reaches a living friend). Their replay shows the public events and the world events, then who holds what at the end of the turn. In the turn you're knocked out you keep your own vision to the end, and the replay ends on the political map.
- With the Fallen switched off (a setting, on by default), knocked-out players see the whole board, as before.
- With fog off, none of this applies: everyone sees everything, all the time.

## 12. The map: water, mountains, passes, sea lanes and choke points
Maps are made by the **map maker** (same seed, same map) and look like a real place, not a grid.

- **Territories** have natural, irregular shapes of about the same size. Two territories border each other only where they actually touch (or where a sea lane joins them).
- **No hairline borders** (map maker v2, session 9): two neighbours always share a border you can see, at least a quarter of a typical one. Where two territories would only have touched at a corner, the corner goes to a third neighbour, so they simply aren't neighbours.
- **Selecting a territory shows what it's connected to:** a small gilded chevron across each shared border (blue water ripples for a river, a cairn for a pass), and its sea lanes light up.
- **Seas and lakes** are never territories. You can't stand on water, and you can only cross it by a **sea lane**.
- **Sea lanes** are the dashed lines drawn across water. They join two coastal territories as if they bordered each other, but attacking across one is hard: attack strength ×0.75 (an army landing from boats). Every island has at least one.
- **Mountain ranges** (grey bands) are impassable. The only way through is a **pass**: an opening at least about a third of a territory wide, with a road and a stone gate drawn across it. Attacking through a pass: ×0.85.
- **Mountains territories** are different: they're ordinary land you can hold, just very easy to defend (defense ×1.6).
- **Rivers** run from high ground down to a sea or lake, along the borders between territories. Attacking across a river: ×0.8.
- The attack panel tells you when an attack crosses a river, a pass or a sea lane, and the odds already include it.
- **Choke points:** every map has a few places where a small army can hold off a big one: passes, sea lanes, and narrow land bridges. A fort on a pass or a sea-lane landing (defense ×1.6, and the attacker pays the crossing penalty too) is very hard to break without siege.
- **Provinces** don't straddle mountain ranges or seas, so a range is often a province's natural wall.
- **Our test maps** (both made by the map maker):
  - **Embervale**: 40 territories, 8 provinces, suits 4–6 players. 3 passes, 3 sea lanes.
  - **Greatmarch**: 80 territories, 20 provinces, suits 8–10 players. 8 passes, 3 sea lanes.
  - Both were rebuilt in session 9 (map maker v2) from the same seeds: same coasts, lakes, islands and ranges, but no hairline borders, wider passes, and new place names.
- **Map shapes and sizes (session 10):** the map maker can now make island chains (every island joined by sea lanes), twin continents, land ringing an inland sea, a crescent, or land in a silhouette (a dragon, a shield, a crown), from 40 to 120 territories, with provinces sized to match and fair capitals for every player count a map claims. Candidates are in `docs/maps/candidates.md`; none is in the lobby until Nate picks.

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
- **Bots don't use generals** (they already plan every army). A bot that knocks someone out still gets a captured general; it just stands where it was placed, and goes if its land falls.
- **Knocked-out bots are Fallen bots** (§16): they aim world events at whoever looks to be leading, by the same runaway rule as priority 8, judged from their political map. With fewer than three players left, they aim at the leader once it holds 1.25 times the land of the next. They pick, best first: an uprising in the leader's quietest land, a plague where it holds the most of a province, a famine, mercenaries next to its land that borders neutral land, a storm on its border with another player. Every Fallen bot judges the same way, so they often pool.
- If a realm loses its capital and has no barracks, it builds one straight away.
- **Cards (session 13):** bots judge cards only from their own view (their own hand, how many cards rivals hold, their own missions). See §18 and §19.

## 14. Generals (session 12)
- **A general leads one army:** the troops in the territory where it stands. It goes with them when they move.
- **Your Leader is your first general.** You can order its army yourself, as always, or hand it a **standing instruction**. It keeps its +20% (it goes along on its attacks) and its timing tricks either way: as a general it uses Seize the Initiative on its first attack on a rival when that's ready.
- **The four instructions:**
  - **Hold here:** keep this territory. If a rival army next door could take it, the general pulls spare troops in from your land next to it. It never attacks.
  - **Defend this border:** toward a rival, or toward a place you pick. It marches to the most threatened stretch of that border through your own land and holds it like Hold here. It hits back at that rival's armies next door with troops it doesn't need there; the general itself stays at its post.
  - **Push toward a place:** it marches toward the place and takes land along the way, with the Captain's odds and chaining, but every hop must get closer. It never stops next to a rival army that would throw it straight back out. Blocked, it waits and gathers spare troops from your quiet land behind it. If it's stranded somewhere it can't hold, it pulls back a step. Once there, it holds.
  - **Raid a rival:** it takes that rival's weakly held land next to it and chains on through more of it. It never goes into land next to one of that rival's armies big enough to throw it out. Not touching that rival yet, it marches toward the rival's nearest land you know of, taking neutral land on the way (never a third player's).
- **How it decides:**
  - It writes its orders with the Captain bot's brain, judging only from your view (it can't see through fog), and the same view and instruction always give the same orders.
  - **Its army is the troops with it when it plans:** it moves them by number, so troops you recruit there that turn stay behind.
  - It never leaves a threatened capital bare.
  - **It never spends gold:** you still recruit, build and raise culture yourself.
- **When its orders are written:** as planning starts, from your view. They show at the top of your queue with the general's portrait, before you lock in, and you can delete any of them. If the timer runs out, they go in as they are.
- **Taking control back:** give an order of your own to the general's army (anything out of the territory it stands in) and its orders all step aside for the turn. Its instruction is still there next turn. An order of yours out of a territory it meant to pull troops from just drops that one order. One tap ("You give the orders") switches the instruction off.
- **On screen:**
  - Select the territory where your Leader stands: the panel shows what it's doing and **Command**. Command, an instruction, then a rival or a place on the map: 3 taps at most. (On a phone, the sheet folds away while you pick a place, with a banner saying what to tap.)
  - The Leader card says what it's doing ("Pushing toward Old March").
  - The replay and the report tell its story ("Your Leader, pushing toward Old March, took Ashfell"; "Your Leader, holding Galeholt, drove back Lady Morwen's attack").

## 15. Captured generals (session 12)
- **Knock a player out and their Leader joins you** as a captured general. It appears at your capital (your strongest territory if you've lost it), with no army until troops are there or move with it.
- It takes instructions exactly like your Leader, and goes with its army.
- **Command only:** it adds no +20% fighting bonus and has no timing tricks.
- **You keep at most 2** (`rules.generals.maxCaptured`). When a third arrives, you choose which to let go. If you don't choose, the two nearest your front stay (bots always keep those two).
- **Gone for good** if its army is wiped out attacking, or the territory it stands in is taken. Only your own Leader comes back.
- **On screen:** the knocked-out Leader's portrait on a gold ring above its army's marker, and a line under your Leader in the right column (click it to go there).

## 16. The Fallen (session 12)
- **When you're knocked out you become one of the Fallen.** You see the political map (§11) and choose **Watch to the end** or **Leave the game** (the others play on and you see who won).
- **Influence:** each of the Fallen earns 1 Influence a turn, plus 0.5 for each other Fallen player. Several Fallen aiming the same event at the same place pool their Influence. Putting more than the cost toward an event makes it stronger, up to 1.5 times.
- **Five world events, each aimed at a living player's land:**

| Event | Cost | Rests for | What it does |
|---|---|---|---|
| **Plague** | 12 | 4 turns | 25% of the target's troops in one province die. |
| **Storm** | 6 | 3 turns | One border is closed for the turn: no moves or attacks across it either way. An order that can't cross says so in the report. |
| **Uprising** | 12 | 5 turns | 4 rebels rise against land held by 4 or fewer troops. If they're more, it turns neutral, held by the rebels. A Leader standing there falls. |
| **Mercenaries** | 9 | 4 turns | 6 neutral troops appear in neutral land next to the target, blocking its way. |
| **Famine** | 8 | 5 turns | The target loses 25% of this turn's income. |

- **Caps, so events can't decide the game:**
  - No event takes or aims at a capital, or knocks a player out: a plague never takes the last troop, and an uprising never takes a player's last territory.
  - **At most one event lands on each living player per turn.**
  - Each event rests for its cooldown after it's played, for all the Fallen.
  - **Culture protects:** each level blocks 15% of the effect where the event lands (for a famine, the culture of the target's capital), as with unrest.
- **When they land:** as the turn starts, before anyone's orders. An event that can't happen costs nothing, and its Fallen are told why.
- **What the living see:** an event on your own land is always in your replay and report. Anyone else's shows only if you could see where it happened.
- **On screen (the Fallen):**
  - your Influence;
  - the five events as cards (cost, what it does, ready or resting);
  - tap a card, then the land (a storm takes a second tap, across the border);
  - "Stronger" to put more toward it;
  - Next turn.
- **Numbers** are all in `rules.fallen` (`packages/content/data/rules.json`). The events are built so a Fate deck could draw them later (session 13 decides).

## 17. Saved games (session 13)
- **The game saves itself** at the start of every turn's planning, on this device. Close the tab whenever you like: the lobby's **Continue** button (map, players, turn and when it was saved) picks it up on that turn, **with the orders you'd queued but not locked in** (session 14): they're saved a moment after you stop changing them, and at once when the tab closes or the phone puts it in the background. A finished game is no longer offered.
- **Save game** (Settings): three slots, each showing map, players, turn and date. **Load game** (Settings, or "Load a saved game" in the lobby): the autosave or a slot. Loading leaves the game you're in, so save it to a slot first if you want to come back.
- **Save to a file / Load a file:** the same save as a file, to keep, move to another device, or attach to a bug report. `pnpm sim --replay <file>` plays it back move by move (it also still reads the old "Save this game" files).
- **Saves never leave the device.** If the browser can't store them (a private window, storage switched off, a full disk), you get a plain message and the game goes on; Save to a file still works.
- **What a save is:** a snapshot of the game as it stands, with a version number, not a list of every turn's orders. So a save keeps loading after the rules or the bots change: the game carries on under the new rules. When the game's own shape changes, a small built-in update brings older saves up to date (a game saved before the card decks carries on without them). One we can't load says so plainly ("This save is from an older version of Conquerra and can't be loaded"). A test loads a save made in session 13 every time, so later sessions keep it working.
- Tutorials and scenarios (M5) will be saves shipped with the game.

## 18. The Spoils deck (session 13)
- **Earning:** at the end of any turn you took at least one territory, you earn **one Spoils card** (at most one a turn). Each shows one mark, **Sword**, **Tower** or **Laurel**, drawn from the game's seed.
- **Sets:** three alike, or one of each, turn in for a windfall:

| Set | Windfall |
|---|---|
| Three Swords | 8 troops at your capital |
| Three Towers | A finished fort and 3 troops on land you choose (land without a building) |
| Three Laurels | +1 culture on up to 3 of your territories in the province you choose |
| One of each | 4 troops at your capital and 6 gold |

- These are the bigger windfalls Nate chose (Oct 6). Session 13 had tried smaller ones (6 troops, a fort + 1, 3 troops + 5 gold) that kept games about a turn shorter; the balance pass (session 16) looks at length.
- **Windfalls never grow** with each set you turn in (unlike Risk), so they can't feed a runaway.
- **Turning in** is an order: it takes its slot with your others, and the windfall shows in the replay and the report. Your capital means your strongest territory if you've lost it.
- **Hand limit 5:** at 5 cards you must turn in a set that turn (five cards always hold one). The sensible set is already first in your queue when the turn starts (Swords, else one of each, else a fort where you're most threatened, else Laurels at home); change it or delete it if you like. If no set goes in, the game turns one in for you as the turn ends.
- **What others see:** how many Spoils cards you hold, never which marks (bots too). A set you turn in shows to those who can see the land it changes.
- **On screen:** a small card stack with its count on your Leader card (on a phone, by the map buttons). Tap it, then a set: 2 taps. A Tower or Laurel set goes on the territory you have selected if it can. The stack glows red when your hand is full.
- **Bots:** the Captain turns a set in as soon as it has one: a Tower set on the front it most needs to hold, Laurels where it means to hold, else Swords, else one of each.
- Numbers: `rules.spoils`.

## 19. The Fate deck (session 13)
- **The opening turns stay quiet:** the first draw comes at the end of turn 3 (`rules.fate.firstDrawTurn`), so nothing from Fate happens and no missions arrive before turn 4's planning.
- **Everyone still in draws one Fate card a turn** from then on, automatically, as the turn ends, so it's there when the next turn's planning starts: a line in the turn report and a toast in the replay. No tap. Draws come from the game's seed: provably fair, and a saved game replays exactly.
- **Because Fate lands between turns, you always plan with it in front of you:** no Fate event can make an attack the preview called "guaranteed" fail.
- **About 7 in 10 are events.** An event lands on a random territory anywhere on the map, not near whoever drew it:

| Event | Good or bad | What it does |
|---|---|---|
| A bountiful harvest | good | The holder gains 4 gold |
| A wandering band | good | 3 troops join whoever holds the land (neutral land too) |
| Pilgrims | good | +1 culture there |
| Master masons | good | A building going up there is finished at once |
| A hidden hoard (strong) | good | The holder gains 10 gold |
| Veterans return (strong) | good | 6 troops join the holder there |
| A flooded ford / A rockslide / Squalls at sea | bad | A river crossing / a pass / a sea lane there is closed for all of the next turn (everyone who can see it knows while planning; an order across it won't go) |
| Fire in the works | bad | A building going up there burns down |
| Camp fever | bad | 25% of the troops there die (the garrison stays) |
| Blight | bad | The holder loses 4 gold |
| Plague (strong) | bad | The Fallen's plague: 25% of the holder's troops in that province |
| An uprising (strong) | bad | The Fallen's uprising: 4 rebels against land held by 4 or fewer; if they're more, it turns neutral |

- **Caps:** never on a capital; never takes a player's last territory or knocks anyone out; at most one Fate event per territory a turn; culture protects (§7).
- **What players see:** the holder of the land always sees the event. Others see it in full only if they can see the land; otherwise only "something stirs in Northreach" (whoever drew it too).
- **About 3 in 10 are missions**, for whoever drew them (only you see yours): a goal, a deadline (2 to 4 turns) and a reward.

| Mission | Reward |
|---|---|
| Take any territory in a province next to you | +8 gold |
| Take a territory from a rival next to you | +5 troops at your capital |
| Take 3 territories | +10 gold |
| Win a battle across a mountain pass | A free Siege at your capital |
| Win a battle across a river | +6 gold |
| Hold a frontier territory (2 turns) | +1 culture there |
| Lose no land (2 turns) | +6 gold |
| Hold all of a province you mostly hold (4 turns) | +10 gold |
| Build a fort on a frontier territory | +4 troops there |
| Raise culture in a province you hold | +1 more culture there |

  - At most 2 missions open; a third draw becomes an event. A mission lapses at its deadline, or the moment you lose the land you were to hold.
  - **On screen:** your missions are on your Leader card with their deadline; tap one to light its target up on the map.
- **The Fate deck: On / Off** is a lobby switch (on by default) for players who want less luck. The Fallen keep their own event menu (§16).
- **Bots:** the Captain gives open missions a modest pull: an attack that would complete one scores a little higher (×1.3), but only among attacks it already judged likely to win; it builds a mission's fort or raises its culture only with gold to spare.
- Numbers and every card: `rules.fate`.

## 20. Diplomacy (session 14)
Preset deals between two players. Every number is in `rules.diplomacy`.

**Making a deal**
- Tap a rival in the Players panel, then **Propose a deal**. The card comes with a plain truce ready to send (4 taps from opening the Players panel on a phone). Change the card or its terms if you like, pick **Handshake** or **Binding** (its gold price shows), then **Send**.
- A bot answers at once, with one plain reason ("I need my army in the east."). It may send a counteroffer instead: the same card with the changes marked.
- **Offers to you** arrive as a small toast as planning starts, with the bot's reason for asking. Tap it, then **Accept** (one tap), **Counter** or **Decline**.
- **The re-confirm rule:** a deal starts only if both sides confirm during the same planning phase. It starts as the turn plays, **before any move**. An offer nobody confirmed lapses as the turn plays; one between two players who fought each other that turn is void.
- Offers, answers and broken deals are orders that take no slot, so a saved game and `pnpm sim --replay` reproduce them exactly. Continue keeps them too.

**The deal cards**

| Card | What it does |
|---|---|
| **Truce** | No attacks between you across the borders it covers: everywhere (the default), a whole province, or borders you pick on the map. For 2 to 8 turns (3 by default), or until a player you name is knocked out (8 turns at most). |
| **Trade** | Gold now, gold each turn (for up to 5 turns), or land (up to 3 territories in a deal, never a capital or land with a Leader in it; it must border the other side's land). The giver's troops there step back to its own strongest neighbouring territory, one of the receiver's troops moves in from its strongest neighbouring army, and buildings and culture stay with the land. A trade with nothing paid each turn is done at once. |
| **Joint war** | You both name the same rival for 2 to 6 turns (4 by default), with a truce everywhere between you while it lasts. Attacking your partner, or making a truce with the target, breaks it. It ends early if the target is knocked out. A partner who never attacks the target hasn't broken it, but bots remember. Partners don't share what they see. |
| **Right of passage** | Coming in session 15 (it shows as "soon" on the card). |

**Handshake and binding**
- **Handshake:** free. You can break one, by attacking across it, missing a payment, or making a truce with your joint war's target. Breaking it brings a public **Oathbreaker** mark for 5 turns, a gold fine and unrest (troops desert from your land next to the player you wronged; culture protects as usual). All three scale with the deal's size: how much land it covers, how long it runs, how much it trades; "until X is knocked out" counts as big. A truce everywhere for 3 turns over 6 territories costs about 8 gold.
- **Binding:** each side pays gold up front, more for longer and bigger deals. The game won't let you queue an attack across it (the order panel says why), and any attack that would cross it the turn it starts is called off with a line in the report. Gold owed each turn is taken automatically; if you're short, troops desert for it as with upkeep. It can't be broken.
- **Limits:** every deal ends after 8 turns at most. One deal of each kind between the same two players at a time. When a player is knocked out, their deals end; the Fallen don't make deals. A general can't be told to raid a partner.

**What everyone sees**
- Who has which deal with whom, for how long, and a joint war's target: a small mark next to each player in the Players panel (a seal on a binding one) with the turns left, and the Oathbreaker mark.
- A trade's terms only reach its two sides; others see "Lady Morwen and Baron Krell made a trade" and any land that changed hands where they can see it.
- Truce borders show on the map as a white stitched band (gold studs on a binding pact), only where you can see both sides.
- An attack you're drafting across a handshake truce warns you: "This breaks your truce with Lady Morwen: Oathbreaker, about 8 gold and unrest."

**The bots**
- They judge every offer from their own view only, for one plain reason: their fronts and where their armies are needed, who's ahead (by the Captain's runaway rule), what the deal frees up or costs, and their trust in you ("You broke our truce at Old March.").
- They never help a runaway leader, or the clear leader as far as they can tell: no truce, trade or passage that helps it grow. They're always open to a joint war against one.
- **Trust** is worked out from the record of how past deals ended (part of the saved game): down a lot when you broke a deal with them, a little when a joint war fell through, up slowly with deals kept, down for an Oathbreaker mark. With low trust they ask for a binding pact instead of a handshake.
- **The Captain proposes:** a joint war against a runaway leader, a truce on a front it can't afford while fighting elsewhere, a trade for land that completes a province or when it's short of gold. Each bot makes at most one offer a turn, and you get at most one offer a turn from all of them together. They make deals with each other too.
- **They keep their word,** except the Captain may break a handshake deal for a rival's capital it's sure to take (or the win, with fog off), and it says so in the report.
- **The Recruit:** takes a truce when it's weaker, refuses when it's stronger, and never proposes trades.
- Numbers: `docs/sim-results-m3-diplomacy.md`.

## Not in yet (later milestones)
Spies, right of passage's moves, and the "Govern this province" general instruction (session 15), factions, pause by vote and deals between people in online games (M4), tutorials and scenarios (M5).
