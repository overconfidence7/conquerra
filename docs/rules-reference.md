# Conquerra Rules Reference (Milestone 3, session 25)

*A 10-minute read. This is how the engine actually plays today. Numbers are the current balance settings from `packages/content/data/rules.json`. They will change as we tune.*

---

## 1. The goal
- **Classic** (default): be the last kingdom standing. A player is out when they hold no territory.
- **Conquest**: the game ends after a set number of turns (20 unless the host picks another), and the highest score wins. Score = territories + 3 per full province + 1 per 10 gold.
- The lobby suggests **Conquest for 8 or more players** (big tables would otherwise run long) and Classic below that. The host can change it.
- Classic games also stop at turn 60 as a safety net (highest score wins). In testing, fewer than 1 in 100 games got there.

## 2. Setting up
- Each player starts with a **capital**, **12 troops** there, **20 gold**, and their **Leader**.
- Capitals come from the map's **fair layout** for that many players: every capital is about as far from its nearest rival as the others, has land around it worth about the same, and stands on plains (see §12).
- **Fair seats (sessions 19 and 20b):** among equal bots some capital spots won far more often than others on every map. So the layouts for each official map's suggested table sizes were checked by simulation, and 14 were replaced by fairer ones the simulator found (Embervale 4 in session 19. 13 more in 20b: `docs/sim-results-m3-balance.md`, "Fair seats"). Most maps still have a weaker spot.
- **A head start for a harder spot (session 23, Nate):** a capital spot that wins under half its fair share among equal bots starts with **extra troops at its capital** (2, 4 or 6, never more than 6), the smallest head start that brought it to at least half of fair in the simulator without taking it above fair. It belongs to the spot, so whoever sits there gets it, person or bot. You see it as the game starts ("Rookhome starts with 4 extra troops (a harder spot)"), on your capital's card on turn 1 and in the first turn's report. Which spots get one, map by map: `docs/sim-results-m3-balance.md`, "The start bonus (session 23)". Equal bots exaggerate how weak a spot is, so the bonuses are on the small side. How it feels to a person is Nate's call after playing.
- **Harder spots go to bots first (session 25, Nate):** a person is dealt a harder spot (one with a head start) only when no bot is left on an ordinary one. Seats are shuffled as before, and a bot swaps in. A table of bots only is dealt exactly as before. Always, in every new game: there is no lobby row for it (session 25 had one, Nate took it out in 25b). The sims can still deal at random. Whoever does land on a harder spot (only when the table has more of them than bots) gets the "(an exposed spot)" notice (session 33; on a random map most spots have a head start, so a person can have one on a spot that isn't a harder one). Every pinned layout has exactly as many spots as players, so a weak spot is already used only when the table needs it. Random maps (M5) will have to keep that true.
- Every other territory starts neutral with **1 troop**.
- **Your House colour** (session 16): you are **Gules (red)** unless you pick another of the ten in the lobby (it's remembered on your device and kept in saves). The bots take the other colours. Colours never change how the game plays. (Online, each player picks: M4.)
- The host also sets: the **turn timer** (see §3), an optional **turn limit**, the **luck level** (30% by default), **fog** (on by default), the **Fate deck** (on by default, §19), **diplomacy** (on by default, §20), and how the **bots** play: **Marshal** (hard, the default), **Captain** (medium), **Recruit** (easy), or **Mixed** (some Marshals and the rest Captains, see §13).
- **The lobby** (redesigned in session 25b, Nate): up top the title and version, **Continue** and **Load a saved game**, then the **Map** (a small picture of its land and sea and its name: tap it to pick another) and **Opponents** (how many bots and how hard, in two dropdowns, with the Marshal count for a mixed table). Two blocks start folded, each showing its choices in one line, and the device remembers which you opened: **Your House** (colour, your Leader's and Steward's names and personalities) and **Rules** (luck, fog, the Fate deck, diplomacy, victory, the turn timer, Show personalities). **Start** sits under them and stays at the bottom of the screen while they're open. A default game is one tap (Start). A custom one takes a few (the map 2, the bots 2 each, a rule 3: open Rules, then the dropdown). Online games get their own block in session 26.

## 3. A turn
1. **Orders (the timer runs).** Everyone writes as many orders as they like, in secret.
2. **Resolution.** The game shuffles the seat order, then plays orders **one per player at a time, round-robin**: everyone's 1st order, then everyone's 2nd, and so on. A chained hop (§4) is just another order in your list, so it waits its turn like the rest.
3. **Replay.** Everyone watches what happened on the map, trimmed to what they could see (see §11).
4. **End of turn.** Buildings finish, fallen Leaders come back (see §9), gold comes in, upkeep is paid. Then the card decks: missions are checked (§19), Spoils cards are earned (§18), and everyone draws a Fate card for the coming turn (§19).

**The turn timer**
- The host picks it in the lobby: **1, 3, 5 (default) or 10 minutes**, or **No timer** for relaxed solo play. (Longer timers, up to a week, come with online games.)
- The countdown is kept by the game host (your browser's background game today, the server from M4), not by the rules engine.
- It turns **gold at 1 minute** left and **red at 15 seconds**.
- **Pause** (single player, session 13): with a timer on, the round button next to it stops the clock and the timer reads **Paused**. You can keep planning while it's paused (the map dims a little so you notice). Nothing locks in until you resume, and the clock carries on from where it stopped. Without a timer there's no button. (Online games pause by vote: §25.)
- **When it runs out, your orders lock in as they are**, exactly as if you had pressed Lock in. (Orders you haven't finished adding, such as an attack you're still choosing troops for, don't count.)
- Lock in early and the turn plays straight away: the bots have already locked in.
- The next countdown starts when the replay ends, plus 3 seconds to glance at the report.

**The replay**
- After Lock in, the turn plays out on the map in the order it happened: armies march along their arrows, each battle shows a short clash and then the result (who holds the land, and the losses on each side), captured land changes colour, and recruits and buildings pop in.
- A short pop-up names the big moments ("Gules captures Oakcrest"). Something in the fog shows only as a soft pulse on its province and "A battle in Northreach", with no names and no numbers.
- **The fog lifts as you go:** when your army takes a territory, the fog fades off the land around it right then, so you can watch a chain push into land you couldn't see. Land you lose fogs over from that moment (see §11).
- A typical turn takes about 10 to 20 seconds. Very busy turns are sped up. **Skip** jumps to the end. There's no pause, play or speed control (decided).
- **How it looks** (session 21, the polish pass): the replay is letterboxed with a soft vignette and a warmer light. Armies march as the House's soldiers with their banner (ships on sea lanes) behind an inked campaign line, and meet **at the border**, where the fight is (dust, smoke, sparks, the defenders' arrows, a Siege stone). A capture topples the old banner and raises the new one. A capital falling gets smoke, flames and a gentle push-in of the camera. Building, culture, Spoils, Fate, the Fallen, deals and your spies each have a short signature. None of it changes what happened: the numbers, results and pop-ups say the same as before, and the fog still shows only the soft pulse.
- **Title cards** for the moments that matter, at most two a turn, only for what you saw: a capital falling ("Whitemarch falls to you", "Your capital, Rookhome, falls to House Purpure"), a House knocked out ("House Azure is no more"), a deal broken ("Lady Morwen breaks the truce").
- **Settings, Effects: Full / Light / Off** (remembered on the device). Light halves the particles and drops the camera shake and flashes. Off keeps only the information (armies' numbers, battles, results, pop-ups). A phone that can't keep the replay smooth on Full moves to Light by itself and says so once. "Reduce motion" on the device starts on Light. The replay's length doesn't depend on the setting.
- **Sound** (session 24, simpler since 25b): the replay has its own sounds (drums for an army of 20 or more on the march, one short clash in a fight, a bright drum tap when you take land and a low drum hit when a rival takes yours, a heavy hit and a bell for a capital, a fading drum for a House knocked out), never more than two at once and one of each kind per moment, and planning has quiet music, the seal's press when you lock in, coins, and soft ticks in the timer's last 10 seconds. Anything in the fog is the same distant rumble, whatever it was. **Settings, Sound:** Master (70%), Music (25%, so the music sits well under everything) and Sound effects (80%) volumes, and Mute, remembered on the device. A slider sets the level at once. Sound is separate from Effects (Effects Off keeps the sound, and Mute keeps the effects), and nothing in the game is told only by sound. Phones play sound after your first tap. **Settings, Credits** lists the free sound packs it comes from.
- Then the **turn report** lists it all in words: your gains and losses first, then what you saw, then **what came out of the fog** (rival armies, capitals and Leaders you spotted during the turn, and fighting you couldn't see). **Watch again** replays the turn from the fog you started with.

**Leader timing tricks** (only while your Leader is alive):
- **Seize the Initiative**: one order goes before everyone else's. Then it rests for 3 turns.
- **Lie in Wait**: one order goes after everyone else's. Then it rests for 2 turns.
- **On screen** (session 16): two plain buttons on the attack panel (under More…), **Initiative** and **Wait**. Hover (desktop) or press and hold (phone) for the full explanation.

## 4. Orders
| Order | What it does |
|---|---|
| **Recruit** | Buy troops (2 gold each) at your capital, any barracks, or **any territory in a province you hold completely** (session 9). Choose how many with the same chips as attacks: All, 3/4, 1/2 or 1/4 of your gold (an exact number under More, All by default). You can queue several recruits to split troops across sites, and edit them in the queue. While Recruit is open, every place you can recruit glows. Ask for more than you can afford and you get as many as you can pay for. New troops can act the same turn. |
| **Hire** | Buy a specialist at your capital or a barracks (see §6). Hiring doesn't use the province rule. |
| **Move / attack** | Send troops to a neighbouring territory. If it's yours, they move in. If not, they attack. You choose **how many** as a share (below). |
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
- A share always sends **at least 1** and always **leaves 1** behind. (An army of 2 sends 1 whatever you pick, and an army of 1 can't move.)
- If even everyone wouldn't likely win, "Just enough" sends All.
- The order screen shows an estimate ("about 9, 3/4"). It says "about" when the army depends on a battle earlier in your list.

**Rules of movement**
- Every territory you hold keeps **at least 1 troop** behind. You can't empty it.
- **Chained attacks:** an army that moved into or captured a territory earlier in your order list **can go again from there** in a later order the same turn. There's no limit on hops.
  - Each hop is its **own order** and waits for **its own slot** in the round-robin. Everyone else's next order plays in between, so a rival can hit the land you just took before you push on.
  - Every hop leaves **1 troop behind**, so a long chain thins out as it goes.
  - If a hop **fails**, its survivors fall back to where that hop started (as with any failed attack).
  - If an earlier hop fails or fizzles, a later hop from land you **don't hold** when its turn comes **fizzles**, or runs its backup if it has one.
  - The survivors of a **failed attack** rest for the rest of the turn: they can't go again.
- **Cavalry** still moves **2 territories inside one order** (the middle one must be yours), so a cavalry army covers more ground per hop.
- **Your Leader goes with the army** (session 16). An attack or move from where your Leader stands takes it along **by default** (+20%). One tap on **Stays home**, right on the attack panel, leaves it behind. It **carries on through a chain**: each hop you add from where it should arrive takes it on too, and so does **Follow through**. If an attack fails, it falls back with the survivors. If the army is wiped out, it falls (and comes back next turn, §9). The report says "with N troops and your Leader".

**Orders along a path** (session 16): select your land, tap **Path…** (or "Further? Path…" on the attack panel), then tap a place further away. A box offers two ways and draws the chain on the map:
- **Shortest way:** the fewest steps there, through your own land where it can, then the weakest land it knows of.
- **Full sweep** (reworked in session 20, Nate: "no unclaimed land between the two points"): every territory it can take in a **band about 3 territories wide** between the two (every territory within a step of a shortest way there, `rules.path.sweepWidth`), plus the last one or two territories of a province the band nearly covers (taking them completes it), taken in an order that moves steadily toward the end (never doubling back further than it must), then on to the end. A sweep across the whole of Wyrmland or Rootholm clears its band in one chain (up to 120 orders).

It says what it adds ("7 orders: take 6 territories, end at Old March"), and Confirm adds exactly that many. **Confirm** puts the orders in your queue as one chain of ordinary hops (each sends All and attacks only if still stronger. Your Leader goes along if it starts with the army), so you can change or delete any step. It walks through your own land and land taken earlier on the path (moves), marches through a partner's land you have right of passage through (at most 3 territories in one move), and **never attacks the land of anyone you have a truce or joint war with**. It plans only from what you see and remember: land you've never seen counts as lightly held. On a phone: 4 taps for the shortest way, 5 for the full sweep.

**Keys** (session 20, Nate): with an attack, move or path box open, **Enter** confirms it exactly as shown (the amount, the Leader going or staying, Initiative or Wait as set, the way picked) and **Esc** cancels it. The buttons are still there for changing anything first. In a leader's command menu, the arrow keys move the highlight and Enter picks the command. Keys never interrupt typing (a leader's name, an exact amount) or a shortcut held with Ctrl, Alt or Shift. On a laptop the confirm button shows a small **↵**. A phone has no keyboard, so it doesn't.

**Planning a chain on the map:** after you queue an attack on B, B shows a faint **"≈18" arriving marker**: the army expected to get there. Tap B, then one of its neighbours, to queue the next hop. Or save a tap: with your army still selected, tap a neighbour of B straight away. The arrows of a chain show their **hop numbers** (①②③) on gold. If the first attack was set to "Just enough", adding a hop raises it to All so there's an army to push on with (the order screen says so). A hop's odds are marked **"estimate"** because they depend on how the battle before it goes. A hop into land you can't see shows "Can't see": no peeking.

## 5. Backups and presets
Any order can have **conditions** ("only if…") and a **backup** order that runs if the conditions fail or the order is no longer possible. If there's no backup, the order just **fizzles** and your next order carries on.

To keep turns fast, you normally pick a **one-tap preset** instead of building conditions by hand:

| Preset | What it means |
|---|---|
| **Only if still stronger** | Attack only if the odds are still at least "likely" when the order comes up. **New attacks start with this switched on**. One tap turns it off. |
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
| **Rangers** (session 15) | 9 | 1 | 4 | When this army **attacks**, forest, hills and swamp **defend like plains** (mountains still count). Siege's counterpart for terrain. |
| **Standard-bearer** (session 15) | 12 | 1 | 6 | This army **attacks 10% stronger**. Two in one army don't stack. |

**Culture needed** = the total culture you hold in that province (see §7). It's how culture "unlocks the fancier specialists". The odds preview counts Rangers and the Standard-bearer, exactly as the battle will.

**What happens to specialists when their army is destroyed:** they're **lost**. That's true whether the army dies attacking or its territory is captured. They're never captured or handed to the winner. If an attack fails but some troops survive, the specialists come home with the survivors.

## 7. Culture (light)
- Each territory has **one culture number, from 0 to 5**. Raise it one level at a time with gold: **3, 4, 6, 8, 10** gold for levels 1 to 5 (was 4, 6, 8, 10, 12 before session 9). **Several levels in one turn are fine** (each tap of Culture queues the next level at its own price. Session 20d checked: the engine and the queue always allowed it), so a territory can go from 0 to 5 in a single turn for 31 gold.
- **What it does ("loyal land"):**
  - **Defense:** each level makes that territory defend **6% better** (+30% at level 5). It multiplies with terrain and forts (§9).
  - **Holding bonus:** **+1 gold per turn per level** on that territory (session 19, was +½. Pending Nate's pick of the three levers tested), and a full province's bonus grows by 0.5 per level of its average culture.
  - **Protection:** each level blocks 15% of bad effects there (up to 75%): **unrest** (§8), the Fallen's world events (§16) and bad **Fate events** (§19). An all-or-nothing event (a fire, a flooded ford) is shrugged off with that chance.
  - **Unlocks** the fancier specialists in that province (§6): **the culture ladder** below.
  - **Walls** (session 20b): culture 5 and a fort make a territory walled, and touching walled territories share their spare defenders (§24).
- **Culture is lost when land changes hands** (session 16, Nate): a captured territory drops to **culture 0** for its new owner. So does land traded in a deal, or taken by rebels. **Buildings stay** (a fort keeps standing for the new owner). Culture is an investment in land you mean to keep. The territory card says so on someone else's land ("Lost if you take it"), and the report says when a capture wiped some out. (The share kept is `rules.culture.keptOnCapture`, 0.)

**The culture ladder (session 15).** Culture still unlocks only specialists (no tree, no new resource). Each step uses the total culture you hold in the province:

| Culture in the province | Unlocks |
|---|---|
| 0 | Cavalry, Scouts |
| 2 | Siege, Engineers |
| 3 | Healers |
| 4 | **Rangers** |
| 6 | **Standard-bearer** |

- **On screen:** the territory card's culture line names the province's step and the next one: "Culture 2: defends +12%, shrugs off 30% of unrest, +1 gold. Culture 4 in Pinemark: Rangers. Next: Standard-bearer at 6". The Hire menu shows the locked specialists greyed, with the culture they need ("Needs 6 culture in this province"). Before you raise culture, the panel says what the next level newly unlocks.
- **The Captain** hires them with its existing judgement: Rangers when a rival army stands on forest, hills or swamp next to where it hires, a Standard-bearer for a big army (20 or more).
- **On screen:** small gold laurels on the troop pill (one per level, at Mid and Near zoom). The territory card says what it does in one line, for example "Culture 2: defends +12%, shrugs off 30% of unrest, +1 gold, unlocks Siege and Engineers in Pinemark", or "No culture yet: raising it costs 3 gold". Before you tap Culture, the panel (and the button's tooltip) says what the next level adds.
- **Where it pays:** where you mean to hold and a rival army is next door, with a real garrison (the bonus is a share of the defenders). The Captain bot buys it at its capital and choke points on those terms.
- No culture victory, no culture tree. Military first.

## 8. Gold, upkeep and unrest
**Income each turn:**
- Each territory: plains 2, forest 1, hills 1, mountains 1, swamp 0, plus its culture bonus.
- Your capital (if you still hold it): +8.
- Each full province you hold: its bonus (2 to 3), plus the culture boost.
- A market: +2.

**Upkeep each turn:**
- **Land:** your first 10 territories are free. After that, upkeep climbs faster than your land does (0.35 × extra territories^1.25, rounded). This is the main brake on runaway leaders.
- **Specialists:** their upkeep from the table above.

**Leaders' purses (session 18, §14):** each turn, after upkeep, each leader's budget is paid from your treasury into its purse. If you can't pay your upkeep, the purses pay it first (the fullest first), before anyone deserts.

**Unrest:** if you can't pay (and your leaders' purses are empty), one troop deserts for every gold you're short, starting with your lowest-culture land. Culture talks some of them out of it (its protection share is forgiven). Every territory still keeps its 1-troop garrison.

## 9. Combat (about 70% skill, 30% luck)
- **Attack strength** = attacking troops × border (river crossing ×0.8, mountain pass ×0.85, sea lane ×0.75) × Leader bonus (+20% if your Leader goes along). See §12.
- **Defense strength** = defending troops × terrain (plains ×1.0, forest ×1.2, hills ×1.3, mountains ×1.6, swamp ×1.1) × finished fort (×1.6, unless siege cancels it) × culture (+6% a level, §7) × Leader bonus (+20% if their Leader is there).
- On average, each point of attack strength kills **1.0** defender, and each point of defense strength kills **0.6** attackers. Healers reduce their own side's losses.
- **Luck** spreads each side's actual losses up to 30% either way around that average (most results land near the middle). The host can set luck from 0% to 100%. Luck is rolled on the full average losses before they're capped at the troops actually there, so an attack the preview calls **guaranteed always captures** (fixed in session 9: a 35-against-1 attack could fail before).
- The attacker **captures** the territory if every defender dies and at least one attacker survives. Survivors move in. Buildings and culture stay with the land.
- If **both sides are wiped out**, the last defender holds on: the land keeps 1 troop. (Land is never left owned with 0 troops.)
- A Leader in a captured territory, or in an attacking army that's wiped out, **falls**.
- **Leaders come back for free.** At the end of the turn it fell, your Leader returns at your capital, or at your strongest territory (most troops) if you've lost the capital. So it's waiting for you when you plan your next turn. Seize the Initiative and Lie in Wait cooldowns carry on as before.
- When a player is knocked out, the game records **who knocked them out**, and that player gets the loser's **Leader and Steward** (§15). The knocked-out player becomes one of **the Fallen** (§16).
- **Odds preview:** before you commit, the game shows "guaranteed / likely / possible / impossible" from the same math the engine uses.
- **Provably fair:** the game's secret random seed is fingerprinted when the game starts and revealed when it ends, so anyone can re-run the game and check every roll.

## 10. Buildings
| Building | Cost | Build time | Effect |
|---|---|---|---|
| **Fort** | 8 | Ready at the end of next turn | Defense ×1.6 |
| **Market** | 6 | Ready at the end of this turn | +2 gold per turn |
| **Barracks** | 6 | Ready at the end of this turn | Recruit and hire here |
| **Watchtower** | 4 | Ready at the end of this turn | See 1 territory further |

Engineers make any of these ready immediately. A building under construction gives nothing yet. If the territory is captured, the conqueror inherits it.

**A fort on culture-5 land makes a wall** (session 20b, §24): walled territories that touch share their spare defenders. A territory holds one building, so the fort is the building there.

**On the map** (session 9): buildings stand next to the army marker, about the size of a capital's castle, and never under the marker. Since session 21 they stand up off the land like the walls: a cast shadow down and to the right, a low stone plinth, lit and shaded edges (the capitals' castles too). One being built shows behind a wooden scaffold, and the marker's building icon carries a small hourglass ("ready next turn"). Buildings you only remember (in the fog) are greyed.

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
  - **Changed in session 8:** land that only came into view *later* in the turn doesn't count. If a rival moved troops on a hill you only spotted three hops into your chain, you don't see the move. You just see the hill as it is when your army gets there. (The old rule showed anything on land you could see at the start or the end of the turn.)
  - A Leader coming back shows to its owner, and to anyone who can see where it reappears.
  - A battle in the fog shows only as a **surface detail**: "a battle in Northreach." No names, no numbers. The same goes for a Leader falling in the fog, and for a Fate event ("something stirs in Northreach", §19).
  - Quiet things in the fog (moves, recruiting, building, culture) don't show at all.
  - Eliminations and the end of the game are announced to everyone.
- **Knocked-out players are the Fallen (§16) and see the political map:** who holds what everywhere, and the capitals, but no troop numbers, buildings or armies (so nothing about armies reaches a living friend). Their replay shows the public events and the world events, then who holds what at the end of the turn. In the turn you're knocked out you keep your own vision to the end, and the replay ends on the political map.
- With the Fallen switched off (a setting, on by default), knocked-out players see the whole board, as before.
- With fog off, none of this applies: everyone sees everything, all the time.
- **Blackout (session 30, in Rules: Fog of war, Blackout):** "the map is hidden until you explore it." Land you have **never seen** is under thick painted clouds, the sea around it too: no terrain, no name, no borders, no gates, no sea or range names, and you can't tap it. It's "seen" exactly as fog works: next to your land, in sight of a watchtower or scouts, in a spy's report, or taken by your army during the replay (the clouds lift as your army reaches it). Once seen it behaves as ordinary fog, with "last seen". Fog news ("a battle in Northreach") reaches you only from land you've seen at some point. The minimap is clouded the same way. Blackout changes only what you're shown, never the game. Tactical view paints the clouds over rivers too (session 31). A province you can't see all of says "you hold 2 of ?" (session 32: once any of its land you know borders the cloud, it may go on into it).
- **What the bots know under blackout (session 32):** exactly what you'd see in their seat. Each bot plans from the land its seat has seen (in sight now, remembered as "last seen", or in a spy's report), with that land's terrain, names, provinces and borders, and the borders that lead from it into the cloud (as the map draws them: a river, a pass, a sea lane, never what's across). It knows how many territories the map has (the lobby says so) and nothing else about the land under the cloud: it can't order an army into it, it values land that would open the cloud up (Scouts early, spies sent toward the cloud when there's nobody to watch), and it guesses who holds the unseen land from who holds the land at its edge. Its "last seen" memory is the same as yours. Nothing it does needs land you couldn't see.

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
  - **Embervale**: 40 territories, 8 provinces, suits 4 to 6 players. 3 passes, 3 sea lanes.
  - **Greatmarch**: 80 territories, 20 provinces, suits 8 to 10 players. 8 passes, 3 sea lanes.
  - Both were rebuilt in session 9 (map maker v2) from the same seeds: same coasts, lakes, islands and ranges, but no hairline borders, wider passes, and new place names.
- **The bigger maps (session 19, Nate's OK):** **Ashwing** (a phoenix, 160 territories, suits 6 to 8), **The Sundered Crowns** (twin continents, 160, suits 6 to 8), **Krakenmere** (a kraken, 200, suits 8 to 10) and **Rootholm** (a tree of life, 200, suits 8 to 10). The lobby shows a line under the map choice saying who each map suits and what it plays like. Details: `docs/maps/candidates.md`.
- **Random maps (session 30):** the last choice in **Change map** is **Random map**. Pick a **size** (40, 80, 120 or 200 territories) and a **shape** (one island, an archipelago, twin continents, a crescent, an inland sea), and the map comes from its **seed**: two words like **quiet-heron**. **Reroll** for new words, or type a seed you were given: the same size, shape and seed always make the same map, on any device, so you can share one. The card says what you get ("80 territories, a crescent, seed quiet-heron") and shows its picture once it's drawn (big maps take a few seconds, longer on a phone). Every random map passes the same checks as the official ones (connected, even sizes, passes, sea lanes, choke points, fair capitals for every table size it suits, and no capital spot far more exposed than the others). A seed gets six tries, and if none passes you read "That seed didn't make a fair map. Try another." Its weaker capital spots are marked (at least 1.5 times as exposed as the middle spot, a third of the table at most), deal to bots first, as on the official maps. **Exposed spots start with extra troops (up to 6)** (session 33, random map version 4): every capital spot but the safest gets a head start that grows with how exposed it is, the most exposed the most, and the first turn's report says who got what (session 31's version 3 gave the marked spots 4 each, and a game made then keeps it). **The most exposed also start with a market and a level of culture at their capital** (session 33b, random map version 5: the more exposed half of the table, +3 gold a turn and +6% defence there for as long as they hold it, standing from turn 1). A game made before keeps its own head start. No capital spot is more than 4 times as exposed as the safest (session 31: 5.5 before). Who each size suits: 40 territories, 2 to 6 players (an archipelago 2 to 5). 80 and 120, 2 to 8. 200, 2 to 10. A save or an online game keeps only the map's id and its version and rebuilds the map (session 31: a game made before the start bonus keeps its own map, built the old way). A game made by an older map maker says so plainly. Building a big map shows "Making the map…" with how far it's got. Online, the lists say "Random, 80 territories (quiet-heron)".
- **Map shapes and sizes (session 10):** the map maker can now make island chains (every island joined by sea lanes), twin continents, land ringing an inland sea, a crescent, or land in a silhouette (a dragon, a shield, a crown), from 40 to 120 territories, with provinces sized to match and fair capitals for every player count a map claims. Candidates are in `docs/maps/candidates.md`. None is in the lobby until Nate picks.

## 13. Bots
Bots play by exactly the same rules as people, and only from their own view (including their "last seen" memory). They never peek.
- **The lobby (session 17):** Recruit (easy), Captain (medium), **Marshal (hard, the default)**, or **Mixed**: choose how many Marshals with − and + ("2 Marshals and 3 Captains"). They're seated at random. A saved game keeps each bot's level, personality and memory.
- **Recruit (easy):** grabs the most valuable land it can probably take, piles troops at the front and rarely plans ahead.
- **Marshal (hard, the default, session 17):** the Captain's priorities below, with what the simulator found wins, and a personality.
  - **What every Marshal does** (whatever its personality): it **attacks hard**, chaining on whenever the next hop is likely to win, up to 6 hops, and throws every spare troop in. It doesn't hold troops back on quiet fronts (it still holds choke points, a threatened capital and its fronts with a runaway). It **expands hardest in the first 14 turns**. It goes for **whole provinces** (land that would complete one is worth more). And it prefers to **end a chain on defensible ground** (where few open borders face it).
  - **It reads a runaway better than the Captain, without cheating:** it estimates land it can't see (land it remembers stays whose it was. A knocked-out player's land goes to whoever knocked them out. Land it knows nothing about goes partly to whoever holds the nearest land it knows of and partly evenly to everyone), and names a runaway by **size** (as the Captain from 4 to 5 players. From 6 players a third of the map, or 22% and 1.6 times anyone else), by **pace** (it gained the most land in the last 3 turns, twice as fast as the next, and holds 18% already), and keeps naming it for 3 turns. Then it proposes a **joint war** against it at once, for 6 turns, and again as soon as one ends. Every Marshal accepts one. Its fronts with the runaway come first.
  - **What it learned in session 19:** it queues troops first, then its armies' moves, then everything else it buys (each order takes a round, so a purchase queued first lets rivals move first). It doesn't hire cavalry on a whim. And it keeps a **guard at its capital**: half of the biggest rival army it knows of within 3 steps, and for the first 3 turns half its own stack (capitals on Embervale are 3 steps apart: without the guard, 14% of Marshals were knocked out on turn 1). A Leader you put on "Run the military" keeps the same guard.
  - **What it learned in session 20** (Nate's play test and his playbook):
    - **It finishes rivals off.** When a rival is down to a handful of territories (6 or fewer, or a tenth of its own, and it holds at least three times as much. `rules.leaders.finish`. Not in the opening's first 14 turns. Judged honestly under fog, session 23: the land it knows they hold plus the fogged land they could hold, land never seen that joins up with theirs and fog within two steps, must be a handful), it goes and ends them: recruits at the sites nearest them, marches troops through its own land (one order a hop) to every territory next to theirs, strikes their armies first with half as much again as it takes (counting what they could recruit before the strike lands. Seize the Initiative on the biggest), chains on through the rest of their land and the empty land they could run to, keeps every territory next to their armies strong enough to hold, and brings spare troops up for next turn. Once it holds 75% of the map it treats every rival that way (as **Clean up** does, §14). A strike that's ready before anyone can move goes first in its queue.
    - **It anticipates and counters.** For each rival army of 3 or more it can see next to its land, it guesses that army's next move (the territory of ours it would most likely take: worth the most for the fewest troops) and strikes the army first where it can, else sends troops there and builds a fort.
    - **It builds like your Steward** on a roomy table (more than 12 territories a player): a share of its treasury goes to what "Run the realm" would buy (forts where an army masses, markets and culture where they pay back, a barracks where there's nowhere to recruit), in its own style: your Steward's default share times 1 (Conqueror, Schemer), 1.5 (Turtle, Merchant), 0.75 (Opportunist) or 0.25 (Blitzer). On a crowded table it builds as before (buildings don't pay back there before the game's decided).
    - **It holds what matters** on a roomy table: land in a province it holds whole keeps enough troops to hold against the army next to it, that land and its capital draw reinforcements when a rival army two steps away could strike, and it builds a fort there.
    - **It never retreats** away from a rival it's finishing off (that border is the ring).
  - **What it learned in session 20c** (Nate's second note, your leaders do all of this too):
    - **It finishes the game by mass and sweep** once it holds 75% of the map (§14, "Finishing").
    - **It pauses on defensible ground:** a chain that would stop where a rival army next to it would likely throw it straight back out stops a hop earlier instead (`judgement.pause`). The Blitzer never does: it never stops.
    - **It sweeps its own land before the fight:** when a rival army it can see could chain behind its front this turn (through land held by a troop or two), it moves 3 troops into each territory of its own that army could take, from land the army can't reach, each move attacking only if still stronger, so anything that steps in is taken straight back. They're queued after its attacks (queued before them, they cost it wins in the sims).
    - **Its troops march to the front in one turn:** reinforcements go as many hops through its own land as they need (one order a hop).
    - **Its Leader goes with its main effort from turn 15:** it marches with its spare troops to where the biggest attack sets out, goes with that attack (+20%) and puts the Initiative on it. (From turn 1 it made the strongest opener snowball on a crowded map, so the opening plays as before.) The leaders it captured go with its armies too.
  - **It never cheats:** it judges only from its own view, what it remembers of the replays it watched, and public facts. No pooled sight between bots.
  - **Personalities** (each game deals them from its seed, no two the same until all six are used. Hidden while you play, revealed at the end, or shown all along with "Show personalities" in the lobby). Style only: every one plays by the same rules and gold.
    - **The Conqueror:** picks one front and masses there, holds its other borders with just enough.
    - **The Blitzer:** expands as fast as it can and chains everything. Builds nothing and defends little.
    - **The Turtle:** forts, culture and markets first. Takes only safe land and attacks rivals only with a big edge until turn 14, then strikes.
    - **The Schemer:** lives on deals (truces it may break when the gain is worth the Oathbreaker penalty, joint wars that serve itself) and up to 3 spies.
    - **The Opportunist:** a vulture: hits whoever just fought (as it watched in the replays), the weakened and the overstretched.
    - **The Merchant:** markets from turn 1, trades and peace early, attacks rivals only with an edge until turn 10, then a rich push.
  - **In its own voice:** every answer to a deal still has one plain reason. When its style decides, it says so its way ("Peace suits me, my walls aren't finished.").
- **Captain (medium):** a short list of priorities:
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
- **Bots don't use leaders** (they already plan every army and all their spending): their Steward has no command and no budget, and they keep the leaders they capture (a captured Leader goes with its armies since session 20c, and is lost if its land falls) so that knocking a bot out still gives you its Leader and Steward. **A Marshal's Leader and Steward carry its personality** (session 20c): knock out the Turtle and you get "Wynn, the Turtle". (Session 15's Govern for captured generals is gone with session 18. The Captain plays exactly as before otherwise.)
- **Your leaders plan with the Marshal's brain** (session 18, §14): its shared judgement (attack hard, chain on, whole provinces, end on defensible ground) in a neutral style, steered by each command, from your view only.
- **Knocked-out bots are Fallen bots** (§16), whatever their level (the Fallen see the whole political map, so they don't need the Marshal's estimates): on their **first turn out they strike whoever holds the most land** with what they can afford (session 19). After that they aim world events at whoever looks to be leading, by the same runaway rule as priority 8, judged from their political map. With fewer than three players left, they aim at the leader once it holds 1.25 times the land of the next. They pick, best first: an uprising in the leader's quietest land, a plague where it holds the most of a province, a famine, mercenaries next to its land that borders neutral land, a storm on its border with another player. Every Fallen bot judges the same way, so they often pool.
- If a realm loses its capital and has no barracks, it builds one straight away.
- **Cards (session 13):** bots judge cards only from their own view (their own hand, how many cards rivals hold, their own missions). See §18 and §19.

## 14. Leaders and Stewards (session 18)
You have **two leaders from the start**, and you can hand either of them a command, a budget, or both. They write their orders every turn with the Marshal's brain (§13), from your view only, and they're good at it.

- **Your Leader** (military) stands on the map with an army and goes with it. It keeps its **+20%** in battle and its timing tricks (Seize the Initiative, Lie in Wait), and comes back for free when it falls (§9). You name it in the lobby (a sensible name is filled in, and remembered on your device), and can give it a personality (below).
- **Your Steward** runs culture, buildings, forts and the economy. It never stands on the map and can't be lost. Naming it is optional. Left blank, it gets a name from the game's seed. Until Steward portraits are made, it shows as your House's shield with a quill.
- **Purses.** Each leader has a purse: your gold, set aside.
  - **Its budget** is paid in each turn as income comes in: **a share of the turn's income** (after upkeep, rounded down) or **an exact amount** (up to 99 gold a turn). Budgets are paid in order (your Leader, your Steward, then captured ones) and never more than your treasury holds.
  - **It saves up:** gold it doesn't spend stays in the purse for bigger things.
  - **It pays for its leader's orders** (troops, specialists, buildings, culture), never your treasury, and your gold never pays for them. If the purse is short, the order waits like any order you can't afford.
  - **Take back** brings a purse home in one tap. It arrives as the turn starts, in time for your own orders that turn.
  - **A Steward with nothing more worth building hands gold back** (session 23, Nate). It keeps two turns of its budget, or what it will spend over the next two turns if that's more (it never hands back gold it's saving for something), and the rest goes to your treasury as the turn ends, after every order. Less than 5 gold isn't worth the trip. The Leaders panel says so while you plan ("Nothing more worth building, so about 908 gold goes back to you as the turn ends. It keeps 102."), and the report says what came back ("Odo handed 908 gold back from its purse as the turn ended"). Now and then your Steward has a word about it.
  - **No dodging costs:** if you can't pay your upkeep, the purses pay it (the fullest first) before anyone deserts (§8). Purses also count as your gold in the score.
- **Personalities** (session 20c, Nate): next to your Leader's name in the lobby (under Your House since 25b), a dropdown picks **Neutral** (the default: the balanced way, as before), **the Conqueror** (picks one front and masses there), **the Blitzer** (never stops a chain short, never pulls back), **the Opportunist** (goes for whoever just fought) or **the Schemer** (picks off the weakened). Next to your Steward's, **Neutral**, **the Turtle** (forts wherever an army of 3 or more stands next door, and up to 3 levels of culture a turn where they protect, before markets) or **the Merchant** (markets first, then the urgent forts, then culture for its income). Remembered on your device like the names. A leader with a personality plans with that Marshal personality's weights and switches (`personalities.json`) under its command. It **keeps its personality for life**, including when captured. The Leaders panel says "Aldric, the Conqueror", and the report and the Chronicle give it a line in its own voice when it took land ("Aldric, the Conqueror: “Took Ashfell and Pinemark, morwen's lot ran.”"). A Neutral leader says nothing and plays exactly as before.
- **Defaults:** your **Steward starts on "Run the realm" with 20% of your income** (session 19: **10% on a crowded table**, 12 or fewer territories a player, such as Embervale with 4 or more or Greatmarch with 8 to 10, where buildings pay back too slowly for more), so building and culture happen even if you never open the Leaders panel. "Run the realm" buys urgent forts, markets, a barracks where needed, culture where it protects, and (session 19) culture for its income where a level pays back as well as a market. Your **Leader starts with no command and no budget**: you order its army yourself, as before.
- **The commands** (with the taps on a 384 px phone, from your Leader's portrait):

| Leader | What it does | Taps |
|---|---|---|
| **Hold here** | Keeps the territory it stands in, pulling in spare troops from next door if a rival army could take it. Never attacks. | 3 |
| **Defend this border** | Toward a rival, or a place you pick: marches to the most threatened stretch through your land, holds it, and hits back with troops it doesn't need there. | 4 |
| **Push toward a place** | Marches toward the place, taking land on the way (every hop closer), never stopping next to an army that would throw it out. | 4 |
| **Raid a rival** | Takes that rival's weakly held land and chains on, keeping clear of its big armies (never a partner). | 4 |
| **Expand our empire in this direction** (Nate's) | Pick a target territory. It commands its own army and yours in the provinces on the way. Through empty, weak land it chains fast. Where rival armies stand it's careful (only where what arrives would hold, with honest garrisons behind it). It takes and secures whole provinces on the way rather than a thin line. At the target it stops and holds. | 4 |
| **Command this front** | Mark provinces on the map, then Confirm: it commands every army of yours there and recruits for them (with nowhere to recruit, it builds a barracks). | 4 + 1 a province |
| **Run the military** | Every army and all the recruiting, except armies another leader commands or that you order. Only one leader at a time. Once you hold 75% of the map it cleans up unasked. | 3 |
| **Push back <rival>** (session 20, Nate) | Pick a rival: it takes that rival's weakly held land (the less there, the better), breaking its chains, keeps clear of its big armies until it can beat them, and never touches anyone else (empty land only on the way to theirs, never a partner). It commands its own army and yours facing that rival. One plain reason a turn in the panel ("Going for Pinemark. Baron Krell's main army at Galeholt (40) is too big for now"). | 4 |
| **Clean up** (session 20, Nate) | Offered once you hold 75% of the map (`rules.leaders.cleanUpShare`). Every leader on Clean up works as one team (session 20c. Before, they shared the rivals out): the senior runs the mass and sweep (below, "Finishing") with all their armies and purses. The panel says "Finishing them off: Lady Morwen (3 territories left)". | 3 |
| **Report to <Leader>** (session 20, Nate) | Works under another of your Leaders who runs the military, expands, commands a front, pushes back or cleans up: its army is the senior's to direct (its portrait rides on the senior's orders that move it) and its budget, and anything in its purse, goes into the senior's purse each turn. The panel says "Reports to Aldric". Take back, or a new command, ends it. | 4 |

| Steward | What it does | Taps |
|---|---|---|
| **Run the realm** | Builds with a plan (session 20d, below): markets and barracks deep inside the realm, forts on choke points and where walls will go, the wall up fast when you're threatened. Urgent forts first (a threatened capital, choke points facing an army). It saves up for an urgent fort rather than buy lesser things. Only one Steward at a time. | 4 |
| **Build up this province** | Forts where a rival threatens it, a barracks if it has nowhere to recruit near its front, markets on its quiet land, then culture where it holds. | 5 |
| **Fortify this frontier** | Facing anyone, or one rival: forts where you're most threatened, then garrisons (troops recruited at the nearest recruit site and marched in where the border is short). | 5 |
| **Raise culture here** | Culture across a province you pick: where it protects first, then the lowest. | 5 |
| **Grow the economy** | Markets and culture, whichever pays back fastest, on land that's safe. | 4 |
| **Report to <Steward>** (session 20) | Works under the Steward running the realm: its budget, and its purse, go into the senior's each turn. Take back, or a new command, ends it. | 5 |

  A budget takes 3 taps for your Leader (its portrait, Budget, a share) and 4 for your Steward. On a laptop the Leaders panel is always open, so every count is one less.
- **Budgets add up to at most 100% of your income** (session 20, Nate found he could give more): the share chips offer only what's left (with 80% given away, 0, 10 and 20%), the exact-amount box stops at the income that's left, and the top of the Leaders panel says "Budgets: 80% of income". Shares over 100% are trimmed in roster order (your Leader first), and so are older saves as they load.
- **They never hoard** (session 20. Session 20d, Nate's third note): a leader with a military command spends its whole purse on troops (and the specialists and barracks it needs) every turn it can recruit anywhere. Recruits are shared out across the sites that need them, and a recruit whose site is lost before it runs **tries up to four other sites of yours** in turn, the safest first (any of yours: the troops are still the leader's to march). The only reason it keeps gold is one it names in the panel ("Saving 4 gold: nowhere to recruit until the barracks at Galeholt is up"). With nowhere at all to recruit it builds that barracks as soon as it can pay for it (6 gold). An odd gold coin it can't spend (a troop costs 2) waits in the purse for next turn.
  - **The Leaders panel shows the purse once this turn's orders are paid for** (session 20d): "Purse 0g · 50% of income · 9 orders this turn (18g)". It used to show the purse as the turn started, before its orders spent it, so it always looked full: that's what read as hoarding in Nate's game. The top bar's "N in purses" and the panel's header count the same way. Take back still brings home the whole purse (and the leader's orders are written again with an empty one).
- **Finishing: mass and sweep, with a security blanket** (session 20c, Nate's second note). Once you hold 75% of the map (or on Clean up), a leader finishes the game this way, every turn until it's over:
  1. **Before anything else plays**, a strike that's ready right now (the Initiative on their biggest army), and the ring held: troops step into each territory of yours next to one of their armies that couldn't hold it, from up to two steps away, where that's enough (their attack is then called off).
  2. **The whole purse becomes troops** at recruit sites that can't be lost before the recruit runs (the capital, a barracks, a province none of whose land touches theirs), some where your Leader stands if it has no army there, so it marches with them.
  3. **Mass:** every spare troop (all but the 1 that holds each territory, and the capital's guard) marches through your land to **one staging territory** next to the remnant's biggest army (or a step back, out of their reach, if it couldn't be made to hold first), as many hops as it takes, your Leader with it.
  4. **Sweep:** from there one chain strikes their army and walks on through **everywhere they are and everywhere their armies could get to this turn** (worked out from each army's strength against what stands in its way, and from their recruit sites: their capital, a barracks, a province they hold whole, or one whose land you've never seen), nearest first, back through your own land where it must, and on into unseen land that joins theirs. Your Leader on it. An army too big to strike yet is struck only once it has marched out (each hop attacks only if still stronger), and the chain follows its trail. With what's left it goes on to the other remnants' land.
  5. **The security blanket:** transfers from land they can't reach bring 3 troops into every territory of yours their armies could reach, queued last, each attacking only if still stronger, so anything they took is taken straight back.

  A small remnant elsewhere (3 territories or fewer) that can be struck everywhere at once gets the ring instead (a strike from next door on each). It plans only from your view: hidden positions never count. It respects storms that close a crossing. **Many orders:** about 100 a turn while finishing on Wyrmland, up to about 300 on Rootholm.
  - **The sweep covers the fog** (session 20d, Nate's third note). Its set is everywhere the remnant **is** (what you see and remember of theirs), **might be** (land you've never seen at all, and land in the fog within 2 steps of theirs, or of never-seen land, that was empty, theirs or yours when you last saw it: they could have taken it since. Land a third House held stays that House's as far as you know), and **could move to** (their armies' reach). The fogged parts take their turn by distance like the rest (they used to be visited last). **More chains:** what the first chains didn't reach is swept by more, from the spare troops left, strongest first, each from the territory of yours next to it that can gather the most within 3 steps. The blanket also covers your land next to where they might be. Every hop attacks only if still stronger, so nothing in the fog is attacked blind: the engine checks the real odds when it plays. Settings: `judgement.sweep.fog` (2) and `more`.
  - **Cleaning up, every rival is one to finish** (session 20d): a rival that borders whoever the planner reads as running away is no longer left alone as a "shield" once you hold 75% of the map. Deals still hold: a truce partner, or a joint war's, is never attacked.
- **They write as many orders as the realm needs** (session 20): finishing a rival, a Leader on Run the military writes a march for every hop through your land, a strike for every territory of theirs, and the chains on (dozens a turn on a big map). It matches or beats a Marshal planning the same seat on 9 turns in 10.
- **How they decide:** every command is planned by the Marshal's planner with the command's scope (which armies, which places, what it may buy) and the leader's purse. They write **several orders a turn** where it fits: a chain of attacks, recruits that march with the army, building in several places. The same view and command always give the same orders.
- **Overlaps:** a narrower command keeps its armies over a wider one: a leader's own army first (a junior's goes to its senior), then fronts, then the land facing a Push back rival, then Clean up's shares, then the way an Expand leader is taking, then Run the military. **Your own Leader with no command keeps its army for you**: Run the military never moves it. A captured Leader with no command is just standing there (session 20: they arrive at your capital and used to freeze its army), so its army is Run the military's.
- **Your orders come first:** an order of yours out of a territory takes that army back from its leader for the turn (a leader leading just its own army, on Hold, Defend, Push or Raid, steps aside altogether). A build or culture of yours on a place takes that place back from your Steward. Seize the Initiative and Lie in Wait stay yours.
- **Seeing their orders:** they're written into your order queue as planning starts, each with its leader's portrait, and you can change or delete any of them. **"Leaders' orders: Mixed in / After mine"** (in Settings, and at the top of the queue, mixed in by default) chooses where they play: one of yours, then one of theirs, or all of yours first. If the timer runs out, they go in as they are.
- **On screen:** the **Leaders panel** (laptop: the right column. Phone: the Leaders sheet, from your Leader's portrait by the map buttons) lists every leader with its portrait, name, kind, what it's doing, its purse and budget, and how many orders it wrote this turn. Tap one for **Command**, **Budget** (chips: 0, 10, 20, 30, 50%, or an exact amount) and **Take back**. While a leader is open, its command shows on the map: the target glows and the provinces it works in get a gold band. The top bar shows your treasury, and the purses' total beside it, smaller.
- **The report and the Chronicle** tell their story: "Your Leader, Aldric, expanding toward Old March, took three territories: Ashfell, Galeholt and Pinemark (you lost 4, they lost 9)." "Your Steward, Odo, running the realm, finished a market at Pinemark (6 gold)." "Into purses: 2 gold to your Steward." "Your Leader, Aldric, finished House Azure." (session 20: when a leader's order takes a rival's last territory)
- **Run the realm with a plan** (session 20d, Nate's third note):
  - **Where it builds:** it scores your land by **interior-ness** (steps from the nearest land that isn't yours) and **choke-ness** (a territory on a pass or sea lane, either end of a land bridge, or one whose loss would cut your realm in two). **Markets and barracks go deep inside**, never on a fort's plot. **Forts go on choke points facing a rival and on wall candidates**: your capital's province, every province you hold whole that borders a rival, and the province your Leader stands in (the two leaders work together).
  - **Walls up fast:** the fort first (it takes two turns to build), then as many levels of culture as the purse holds, in the same turn. With 40 gold a Steward takes your capital from culture 0 to 5 and starts its fort in one turn (31 + 8 gold). The wall stands when the fort does, at the end of the next turn.
  - **Threatened** (a rival army of 4 or more within 2 steps of your capital's province, or a runaway whose land touches yours): **everything goes into the wall** (after a threatened capital's fort) until it stands. Otherwise markets come first and what's left goes into the wall, a few turns at a time. (In the first version a runaway anywhere on the map counted: on the big tables it walled up against runaways too far away to matter.) Settings: `leaders.steward.plan`.
  - **A real garrison inside the wall:** your Leader on Run the military keeps **4 troops in each walled territory of a wall that faces a rival** (the wall lends all but 1 of them to any attack on it) and marches troops in where it's short (not while it cleans up). Setting: `judgement.wallGarrison`.
  - The Turtle and the Merchant keep their order of things inside the plan (the Turtle walls before its markets. The Merchant buys its markets first). The Marshal's own building keeps session 20b's way for now (session 22 looks at the Marshal adopting it).
- **Anticipate and counter** (session 20): your military leaders guess where a rival army they can see will strike next, strike it first where they can, else send troops there and ask your Steward for a fort there (it builds those first).
- **Govern this province** (session 15) is gone: the Steward does it better. In older saves a governing general becomes a Leader on Hold here, with the gold it was saving in its purse.

- **What your leaders say** (session 22, the language pass): after each turn your Leader, your Steward and the leaders you captured can say a line about it in the report (under **Your leaders**), the Chronicle and the Leaders panel, in their personality's voice (a Neutral leader is dry and brief). They speak only from your own view: nothing they say gives away anything you couldn't see. At most **one line per leader a turn and three a report**, the big moments first: your capital falling, a rival finished, a capital taken, a rival army within 2 steps of your capital's province, a captured leader's first report. Your Leader also comments on **your own** orders that went badly (with the turn's real numbers, at most once every 4 turns, never on an order a leader wrote, and not while you hold 4 territories or fewer), and it remembers a grudge (a rival who burned your fort, took home land or wiped out your army) and brings it up later. Words only: none of this changes what anyone does. `packages/content/data/lines.json` (`limits`).

## 15. Captured leaders (sessions 12 and 18)
- **Knock a player out and their Leader and their Steward join you**, with no command and no budget. The Leader appears at your capital (your strongest territory if you've lost it), with no army until troops are there or move with it.
- **Up to 4 of each kind, your own included** (`rules.leaders.maxOfKind`). Take over two players and you command three military leaders and three Stewards. With one too many, you choose who goes. If you don't, the military leaders nearest your front stay, and the Stewards with the most in their purses. A leader let go sends its purse home.
- **Working together** (session 20c, Nate): with several of your leaders on **Clean up**, or one running the military, they finish as one team: the senior (the one running the military, else your own Leader, else the first on Clean up) runs the mass and sweep, the others' armies join its mass (their portraits on the moves out of where they stand) and their purses pay for its troops. A captured Leader on **Report to** works the same way under its senior.
- **A captured leader keeps its personality** (session 20c): Lady Morwen's Leader that was the Opportunist is still the Opportunist, working for you.
- **A captured Leader commands only:** no +20% and no timing tricks (only your own Leader has those). It's **gone for good** if its army is wiped out attacking or the land it stands in is taken (its purse comes home). Only your own Leader comes back. **Stewards can't be lost.**
- A knocked-out player's own captured leaders are gone with them. Only their own two pass on.

## 16. The Fallen (session 12)
- **When you're knocked out you become one of the Fallen,** and you can act **from your very first turn out** (session 19, Nate): you start with **8 Influence**, and with the turn's own Influence you have 9 or more on your first turn, enough for a storm, a famine or mercenaries. The dialog says so ("You have 9 Influence now: enough for a storm, a famine or mercenaries this very turn", and who holds the most land) with **Strike as one of the Fallen** or **Leave the game** (the others play on and you see who won). You see the political map (§11).
- **Influence:** you start with 8 (`rules.fallen.startInfluence`). Each of the Fallen earns 1 Influence a turn, plus 0.5 for each other Fallen player. Several Fallen aiming the same event at the same place pool their Influence. Putting more than the cost toward an event makes it stronger, up to 1.5 times.
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
  - your Influence.
  - a line on what you can do now ("Ready now: Storm, Mercenaries. Pick one, then tap Lady Morwen's land (they hold the most)"), or, while saving up, which event comes next and in how many turns.
  - the five events as cards (cost, what it does, ready or resting).
  - tap a card, then the land (a storm takes a second tap, across the border).
  - "Stronger" to put more toward it.
  - Next turn.
- **Numbers** are all in `rules.fallen` (`packages/content/data/rules.json`). The events are built so a Fate deck could draw them later (session 13 decides).

## 17. Saved games (session 13)
- **The game saves itself** at the start of every turn's planning, on this device. Close the tab whenever you like: the lobby's **Continue** button (map, players, turn and when it was saved) picks it up on that turn, **with the orders you'd queued but not locked in** (session 14): they're saved a moment after you stop changing them, and at once when the tab closes or the phone puts it in the background. A finished game is no longer offered.
- **Save game** (Settings): three slots, each showing map, players, turn and date. **Load game** (Settings, or "Load a saved game" in the lobby): the autosave or a slot. Loading leaves the game you're in, so save it to a slot first if you want to come back.
- **Save to a file / Load a file:** the same save as a file, to keep, move to another device, or attach to a bug report. `pnpm sim --replay <file>` plays it back move by move (it also still reads the old "Save this game" files).
- **Saves never leave the device.** If the browser can't store them (a private window, storage switched off, a full disk), you get a plain message and the game goes on. Save to a file still works.
- **What a save is:** a snapshot of the game as it stands, with a version number, not a list of every turn's orders. So a save keeps loading after the rules or the bots change: the game carries on under the new rules. When the game's own shape changes, a small built-in update brings older saves up to date (a game saved before the card decks carries on without them). One we can't load says so plainly ("This save is from an older version of Conquerra and can't be loaded"). A test loads a save made in session 13 every time, so later sessions keep it working.
- Tutorials and scenarios (M5) will be saves shipped with the game.

## 18. The Spoils deck (session 13)
- **Earning:** at the end of any turn you took at least one territory, you earn **one Spoils card** (at most one a turn). Each shows one mark, **Sword**, **Tower** or **Laurel**, drawn from the game's seed.
- **Sets: collect three: three alike, or one of each (the best).** Every set gives gold (session 16, Nate):

| Set | Windfall |
|---|---|
| Three Swords | 8 troops, spread over your most threatened territories, and 4 gold |
| Three Towers | a finished fort on land you choose (land without a building), 2 troops there, and 4 gold |
| Three Laurels | +1 culture on 3 territories in a province you choose, and 4 gold |
| **One of each (the best)** | 6 troops spread over your front, a finished building of your choice (fort, market, barracks or watchtower) on land you choose, and 10 gold |

- **Spread over your front:** one troop at a time to whichever of your territories is worst off (the biggest rival army next door, less what's there and what it's been given so far). With no rival next to you, the land facing neutral land. With none, your capital.
- Earlier versions: session 13's first windfalls, Nate's bigger ones (Oct 6), then this rework (session 16). With it, games are about as long as before (`docs/sim-results-s16.md`).
- **Windfalls never grow** with each set you turn in (unlike Risk), so they can't feed a runaway.
- **Turning in** is an order: it takes its slot with your others, and the windfall shows in the replay and the report. Your capital means your strongest territory if you've lost it.
- **Hand limit 5:** at 5 cards you must turn in a set that turn (five cards always hold one). The sensible set is already first in your queue when the turn starts (one of each, else Swords, else a fort where you're most threatened, else Laurels at home). Change it or delete it if you like. If no set goes in, the game turns one in for you as the turn ends.
- **What others see:** how many Spoils cards you hold, never which marks (bots too). A set you turn in shows to those who can see the land it changes.
- **On screen:** a small card stack with its count on your Leader card (on a phone, by the map buttons), saying "Collect three: three alike, or one of each (best)". Tap it, then a set: 2 taps. The Spoils sheet always shows the table above, with the sets your hand can make lit. One of each comes first, with chips to pick its building (a fort unless you pick another). A building, fort or culture goes on the territory you have selected if it can. The report says what a set gave ("You turned in one of each: a market at Galeholt, 6 troops (4 at Ashfell, 2 at Ravenmoor) and 10 gold"). The stack glows red when your hand is full.
- **Bots:** they turn a set in as soon as they have one, one of each first: the Captain puts its fort on the front it most needs to hold (or, with no front needing one, a market on safe land), then a Tower set on that front, Laurels where it means to hold, else Swords.
- Numbers: `rules.spoils`.

## 18b. The Chronicle, and the moments you mustn't miss (session 16)
- **The Chronicle** is a log of every turn so far: battles you saw, Fate events (yours, those on your land, those you saw, and "something stirs" in the fog), the Fallen's events, deals made, broken and ended, your spies' news, and your leaders' work. Newest turn first. In each turn, what touched you first. A switch shows only what touched you. **Tap a line to see the place on the map.**
- It's built from your own turn reports, so it holds only what you were allowed to see (fighting in the fog is just "A battle in Northreach"). It's kept with the game, so Continue and saved games bring it back.
- **Where:** the Chronicle button in the top bar (desktop). The scroll button with the map buttons (phone).
- **The comeback** (session 23, Nate): if your House falls to a quarter of the most land it ever held (8 territories or more at its height) and later climbs back above half of it, a title card plays as that turn's replay ends ("House Gules is back", with a dry line under it). Once a game. Only for your own House: a rival's land size is hidden, so a card about a rival's comeback would give away what the fog hides.
- **Louder notices:** a Fate or Fallen event on your own land gets a big banner in the replay (it stays longer), the replay camera goes to it, and it's the first line of your report. When the Fallen aim at you, they say so: "The Fallen have turned on you: a plague in Old March."

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
| A flooded ford / A rockslide / Squalls at sea | bad | A river crossing / a pass / a sea lane there is closed for all of the next turn (everyone who can see it knows while planning, and an order across it won't go) |
| Fire in the works | bad | A building going up there burns down |
| Camp fever | bad | 25% of the troops there die (the garrison stays) |
| Blight | bad | The holder loses 4 gold |
| Plague (strong) | bad | The Fallen's plague: 25% of the holder's troops in that province |
| An uprising (strong) | bad | The Fallen's uprising: 4 rebels against land held by 4 or fewer. If they're more, it turns neutral |

- **Caps:** never on a capital. Never takes a player's last territory or knocks anyone out. At most one Fate event per territory a turn. Culture protects (§7).
- **What players see:** the holder of the land always sees the event. Others see it in full only if they can see the land. Otherwise only "something stirs in Northreach" (whoever drew it too).
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

  - At most 2 missions open. A third draw becomes an event. A mission lapses at its deadline, or the moment you lose the land you were to hold.
  - **On screen:** your missions are on your Leader card with their deadline. Tap one to light its target up on the map.
- **The Fate deck: On / Off** is a lobby switch (on by default) for players who want less luck. The Fallen keep their own event menu (§16).
- **Bots:** the Captain gives open missions a modest pull: an attack that would complete one scores a little higher (×1.3), but only among attacks it already judged likely to win. It builds a mission's fort or raises its culture only with gold to spare.
- Numbers and every card: `rules.fate`.

## 20. Diplomacy (session 14)
Preset deals between two players. Every number is in `rules.diplomacy`.

- **Diplomacy: On / Off** is a lobby switch next to the Fate deck's (on by default, nate, session 15). Off means no Propose, no offers and no deals: every House fights alone, and the bots play exactly as they did before diplomacy. The setting is part of the game, so a save keeps it.

**Making a deal**
- Tap a rival in the Players panel, then **Propose a deal**. The card comes with a plain truce ready to send (4 taps from opening the Players panel on a phone). Change the card or its terms if you like, pick **Handshake** or **Binding** (its gold price shows), then **Send**.
- A bot answers at once, with one plain reason ("I need my army in the east."). It may send a counteroffer instead: the same card with the changes marked.
- **Offers to you** arrive as a small toast as planning starts, with the bot's reason for asking. Tap it, then **Accept** (one tap), **Counter** or **Decline**.
- **The re-confirm rule:** a deal starts only if both sides confirm during the same planning phase. It starts as the turn plays, **before any move**. An offer nobody confirmed lapses as the turn plays. One between two players who fought each other that turn is void.
- Offers, answers and broken deals are orders that take no slot, so a saved game and `pnpm sim --replay` reproduce them exactly. Continue keeps them too.

**The deal cards**

| Card | What it does |
|---|---|
| **Truce** | No attacks between you across the borders it covers: everywhere (the default), a whole province, or borders you pick on the map. For 2 to 8 turns (3 by default), or until a player you name is knocked out (8 turns at most). |
| **Trade** | Gold now, gold each turn (for up to 5 turns), or land (up to 3 territories in a deal, never a capital or land with a Leader in it. It must border the other side's land). The giver's troops there step back to its own strongest neighbouring territory, one of the receiver's troops moves in from its strongest neighbouring army, and buildings stay with the land (its culture is lost, §7). A trade with nothing paid each turn is done at once. |
| **Joint war** | You both name the same rival for 2 to 6 turns (4 by default), with a truce everywhere between you while it lasts. Attacking your partner, or making a truce with the target, breaks it. It ends early if the target is knocked out. A partner who never attacks the target hasn't broken it, but bots remember. Partners don't share what they see. |
| **Right of passage** | Your armies may march through their land (both ways if you pick **Both ways**) for 2 to 6 turns (4 by default). See below. |

**Right of passage (session 15)**
- **One order marches through:** select your army, then tap land beyond the partner's land (the land you may reach glows as usual). The army marches through **up to 3** of the partner's territories (`rules.diplomacy.passage.maxThrough`) to your own land, or to an attack beyond. It **never stops or fights** in the partner's land, and never attacks the partner whose land it crossed.
- The order panel says "From Ashfell through Galeholt, Pinemark (right of passage: it can't stop there)", the arrow follows the way, and the replay shows the army marching along it.
- The odds use the last border it crosses (a river or pass at the end counts as usual). Every border on the way must be open (a storm or a flood closes the way).
- **Land on the way that changed hands** when the order comes up: the army stops at your last territory before it (if there is one on the way, or the order doesn't go). The report says so.
- A failed attack's survivors fall back to where they started, never into the partner's land. A capture chains on like any other attack.
- **When the deal ends** (it expires, or a side is knocked out), the way closes.
- **On the map:** passage land shows as a gold dashed ring just inside its outline, where you can see it (brighter where you may pass yourself), at every zoom. Deals agreed this turn show fainter, and you can march through at once (they start before any move).
- **Everyone sees** who gave whom passage (Players panel, ↝). The partner whose land you cross always sees you march through.

**Handshake and binding**
- **Handshake:** free. You can break one, by attacking across it, missing a payment, or making a truce with your joint war's target. Breaking it brings a public **Oathbreaker** mark for 5 turns, a gold fine and unrest (troops desert from your land next to the player you wronged, culture protects as usual). All three scale with the deal's size: how much land it covers, how long it runs, how much it trades. "until X is knocked out" counts as big. **The fine is 4 gold + 1.4 per point of size, and up to 0.8 troops per point desert** (Nate doubled both in session 15). A truce everywhere for 3 turns over 6 territories (size 9) costs about 17 gold and 7 troops. The offer card says it in plain words: "Handshake: free. Breaking it brings the Oathbreaker mark, about 17 gold and unrest."
- **Binding:** each side pays gold up front, more for longer and bigger deals. The game won't let you queue an attack across it (the order panel says why), and any attack that would cross it the turn it starts is called off with a line in the report. Gold owed each turn is taken automatically. If you're short, troops desert for it as with upkeep. It can't be broken.
- **Limits:** every deal ends after 8 turns at most. One deal of each kind between the same two players at a time. When a player is knocked out, their deals end. The Fallen don't make deals. A leader can't be told to raid a partner.

**What everyone sees**
- Who has which deal with whom, for how long, and a joint war's target: a small mark next to each player in the Players panel (a seal on a binding one) with the turns left, and the Oathbreaker mark.
- A trade's terms only reach its two sides. Others see "Lady Morwen and Baron Krell made a trade" and any land that changed hands where they can see it.
- Truce borders show on the map as a white stitched band (gold studs on a binding pact), only where you can see both sides.
- An attack you're drafting across a handshake truce warns you: "This breaks your truce with Lady Morwen: Oathbreaker, about 17 gold and unrest."

**The bots**
- They judge every offer from their own view only, for one plain reason: their fronts and where their armies are needed, who's ahead (by the Captain's runaway rule), what the deal frees up or costs, and their trust in you ("You broke our truce at Old March.").
- They never help a runaway leader, or the clear leader as far as they can tell: no truce, trade or passage that helps it grow. They're always open to a joint war against one.
- **Trust** is worked out from the record of how past deals ended (part of the saved game): down a lot when you broke a deal with them, a little when a joint war fell through, up slowly with deals kept, down for an Oathbreaker mark. With low trust they ask for a binding pact instead of a handshake.
- **The Captain proposes:** a joint war against a runaway leader, right of passage through a neighbour's land toward a rival it wants a front with but doesn't border (the runaway leader first, then a rival it could finish off, or anyone in the endgame), a truce on a front it can't afford while fighting elsewhere, a trade for land that completes a province or when it's short of gold. With passage, it marches through to that front when the attack beyond looks likely ("Only if still stronger" checks when it plays).
- **Passage offers:** judged like any other deal. Never for a runaway ("You're running away with the map. I won't let you through.") or the clear leader, never for someone attacking a partner of the bot's ("You're at war with Lady Morwen, who has a deal with me. I won't let you through."), gladly toward a rival it wants beaten, and a counteroffer for the usual 4 turns when it's asked for longer. Each bot makes at most one offer a turn, and you get at most one offer a turn from all of them together. They make deals with each other too.
- **They keep their word,** except the Captain may break a handshake deal for a rival's capital it's sure to take (or the win, with fog off), when the gain is at least twice the penalty, and it says so in the report. With the harsher Oathbreaker that now happens mostly with small deals (a truce on a few borders). A 3-turn truce everywhere is usually kept even for a capital.
- **The Recruit:** takes a truce when it's weaker, refuses when it's stronger, and never proposes trades.
- Numbers: `docs/sim-results-m3-diplomacy.md`.

## 21. Spies (session 15)
Spies see deep behind the lines. They never fight and never change a battle: they're only about information. Every number is in `rules.spies`.

**Hiring**
- **Hire** a spy at your capital or a barracks (in Spend, next to the specialists): **8 gold**. **Upkeep only while it's away** (session 16, Nate): nothing while it stays in your own land (at home, or guarding a province you hold), **1 gold a turn** while it's travelling (sent somewhere) or inside land you don't hold (paid with your specialists. If you can't pay, troops desert as with any upkeep. `rules.spies.upkeep` and `upkeepAtHome`). You may have **up to 5**.
- A spy is its **own piece**, not part of an army. **Only you ever see your spies**: other players never see them on the map, and bots never learn of them.
- With fog off there's nothing to spy on, so there are no spies.

**Sending and recalling** (Send takes 3 taps: the spy's territory, **Send…**, then a province on the map)
- Sending a spy, or calling it home (**Recall**), takes no slot. It shows in your Orders list. Send it again to change your mind.
- **Spies act between turns**, after every army's move: a called-home spy is back at your capital as the next turn starts. The others travel **2 territories** toward the province you sent them to.
- **Travelling:** while a spy stands in a province no single player holds whole, the fog lifts **2 territories** around it.
- **Infiltrating:** entering a province one player holds whole is an attempt to get into it (the spy stops there). If it gets in, the fog stays lifted on the **whole province every turn**, until the spy is killed or recalled, or the defence changes (then the contest runs again).

**Defending and spy against spy**
- Only a player who holds a **whole province** can defend it, by stationing spies in it (send them there). Defenders hold their post and block other spies.
- At most **3 spies a side** count in one province. Each attacking spy beyond the first cancels one defender. What's left decides:

| Defence left | What happens to the incoming spies |
|---|---|
| 0 | **Infiltrate:** you see the true province |
| 1 | **Blocked:** they come home |
| 2 | **Killed:** every spy in that attempt dies |
| 3 (3 defenders against 1 spy) | **Fooled:** the spy thinks it got in, and brings back a false picture |

  Examples: 2 defenders against 1 spy: killed. 2 against 3: in. 3 against 2: killed. 1 against 2: in.
- **What you're told:** "Your spy slipped into the Oak Downs", "Your spy was turned back at Old March", "Your spy was killed in Rush March". The defender is told when a spy is blocked or killed ("A spy was caught in Old March and turned back"), never whose it was, and **never when one is fooled**.

**Fooled**
- A fooled spy's news reads exactly like a real infiltration, and its province shows exactly like one: nothing in your game says it's false.
- The false picture is close to the truth: **who holds each territory is right** (and buildings), but troops, culture, Leaders and where the armies stand are wrong or moved. It's made from the true game with the game's own seeded random numbers, so a saved game plays back exactly.
- **What you see yourself always wins.** Your own land and the land bordering it are always shown as they truly are (so a fooled spy can never touch the odds preview, and "guaranteed" always captures). You find out the truth when you fight there.

**What spies show you**
- Your spies report as the turn ends: their land shows in full on your map (marked "what your spy reported as the last turn ended"), and goes into your last-seen memory like anything else you saw. When a spy leaves, its land fogs over and shows what it last reported.
- Spy reports aren't live: in the replay, a battle in a province your spy watches shows only as "a battle in ..." (the same whether your spy got in or was fooled). The report at the end of the replay brings the map up to date.
- **On the map**, only for you: a small badge where each of your spies stands: an **eye** inside a rival's province, a **shield** on guard, a **hood** travelling.

**The bots**
- **The Captain** hires one spy when it has gold to spare (from turn 6, keeping 24 gold for troops). It goes into the province of its main target (the runaway leader, its focus, a fast attacker, else the strongest rival next to it). It judges from its own view, including what its spy reports, false reports and all. (With two, it would station the second on guard in a whole province a rival borders.) So bots block spies but never kill or fool one: that takes 2 or 3 defenders. People can.
- **Numbers:** `docs/sim-results-m3-spies.md`. Spies don't make games longer, and leave runaways and seat fairness where they were. One spy about pays for itself.
- **The Recruit** doesn't use spies.

## 22. Seeing the map (session 16)
- **Fully zoomed out, the whole map is clear of the menus** (desktop: the top bar, the map buttons, the right column, the selected-territory panel and the dock. Phone: the top bar, the action bar and an open sheet). You can pan any edge of the map into the clear part at every zoom.
- **Provinces on demand:** at Far zoom each province's name and bonus show small, without a plaque, and only where they fit: bigger provinces first, never over an army, another name or the edge of the screen (session 17: a crowded map shows fewer names, not a pile of them). At every zoom, **tap any territory** (yours, a rival's, or fogged land) and its whole province lights up with a bright band round its border and its plaque ("The Oak Downs +3"), until you tap elsewhere. The card's province chip says the same: "The Oak Downs +3: you hold 2 of 5". The province's shape, name and bonus are public. "you hold" counts only your own land.
- **Sharp at every zoom:** zoom in past the Mid detail and the land where you're looking is painted again at up to three times the detail (a moment after you stop, nearest the middle first), with bigger copies of the art that arrive after the game is on screen.

## 23. The end of the game (session 16)
- **The power graph:** each House's share of the map, turn by turn, from the start. One line per House in its colour, with its banner's pattern as the line's dash (so you can tell Houses apart without colour) and the winner's line strongest. Names at the ends of the lines (on a phone, the winner's), a legend, a readout as you move along it, and the numbers as a table.
- **The awards**, each with the winner's portrait: **Best Military** (most battles won: land taken plus attacks held off), **Best Culture** (most culture raised), **Master Builder** (most buildings finished), **Spymaster** (most spies into a rival's province), **Diplomat** (most deals kept to the end), **Survivor** (of everyone but the winner, who held out longest), and **Iron Wall** (most attacks held off), **Kingslayer** (most rival Leaders felled), **Fortune's Favourite** (most good Fate on their land), **Quartermaster** (most troops recruited) and **Oathbreaker** (most handshake deals broken). Ties are shared. An award nobody earned isn't given.
- Both come from the game's own record, kept every turn (and in saved games). **Nobody sees it until the game is over**, when everything is revealed: during play, land counts stay hidden.

## 24. Walls (session 20b, Nate's idea)
The reward at the end of the culture and building path: defence only, no gold, no new resource or building.
- **Walled:** a territory with **culture 5 and a fort** is walled from the end of the turn its last piece is finished (`rules.walls.culture`, `needsFort`). It stays walled while it keeps both and its owner. Culture is lost when land changes hands (§7), so **a captured, traded or rebelled territory leaves its wall at once**. The rest of the wall stands.
- **One wall:** walled territories of one House that touch (over land, not a sea lane) form **one wall**.
- **Shared defenders:** when a walled territory is attacked, **every other territory of its wall** (at any distance along it, Nate's call. `reach`) lends its **spare troops** (all but the 1 that holds its land. `lendAll`) to the defence. Nate's example: three walled territories with 4 troops each, one attacked: **the attacker faces 10**. The attacked territory's terrain, fort, culture and Leader count for all of them.
  - **Every attack:** a wall lends to every attack on it in a turn (Nate's call. `oneBattleATurn: false`), and **its losses are real and carry over**: an attack later in the turn faces what's left. A 1-troop decoy first gains nothing. The way to break a wall is several real attacks in one turn.
  - **Losses:** they fall on the attacked territory first (down to its last troop), then on the lenders in proportion to what they lent. The attacked territory's last troop goes only when everyone else is gone (that's the capture), so a wall can be worn down.
  - **Siege engines** cut the fort's bonus as ever. They don't cut the shared defenders (or the wall's bonus, below). **Walls never attack:** a walled army attacks with its own troops.
- **Bigger walls defend better (session 25, Nate):** every walled territory **defends +10% for each other territory in its wall, with no cap** (a wall of 2: +10%, of 3: +20%, of 5: +40%, of 8: +70%. Uncapped since session 26, Nate's call, Oct 12), on top of the fort and culture 5, against every attack (`walls.stackPerTerritory`. `stackMax` is null, and can be set to bring a cap back). The card says it: "Walled: 10 defend (with Pinemark and Ashfell), +20% for 3 walled", and the odds count it. A wall of 5 with 10 troops in each takes about 81 attackers to break, not 58.
- **Fair and readable:** a wall is a big visible structure, so **anyone who can see any part of a wall sees all of it and its shared garrison**. The card says "Walled: 10 defend (with Pinemark and Ashfell)", the attack panel counts them ("defenders: 10"), and the odds preview uses the same number, so **"guaranteed" still always wins**. If you see no part of a wall, you see nothing of it (only what you remember).
- **On screen:** a grey stone wall round the outside of each wall's whole footprint, standing up off the land, with the House's glow round it. From Mid zoom in, battlements and square towers at its corners and along long stretches, each flying a pennant in the House colour (Nate's picture). A wall you only remember is greyed like a remembered building. Drawn in code until a painted wall piece comes in an art batch. Before you buy the last piece, the culture and build panels say "Completes a wall". The report says when land becomes walled.
- **The bots:** your Steward on Run the realm walls with a plan (session 20d, §14): forts on choke points and wall candidates, the wall up fast (several culture levels in a turn), everything into it when you're threatened. Your Leader keeps 4 troops in walled land facing a rival. (Build up this province still finishes a wall where a territory worth holding needs at most 18 gold more, session 20b's way.) The Marshal builds walls in its own style (the Turtle from scratch, the Blitzer never. Only on roomy tables, where it builds like the Steward). The Captain and the Recruit don't. Every bot counts a wall's garrison when it attacks, and its own walls' lenders when it guards.
- **How it plays (the sims, `docs/sim-results-m3-walls.md`. Session 20d in `docs/sim-results-m3-leaders.md`):** since session 20d your Steward walls in about three games in four, from about turn 13, several territories a game. Those walls are attacked about once a game on the big maps and nearly always fall to that attack (a Marshal attacks a wall only when it's sure, counting the garrison), so a wall's real work is the attacks it puts off. Game length and runaways are the same with walls on and off. With the wall's bonus (session 25) that's still so: bots count the bonus and bring more, so walls are attacked a little less and hold about as often. The bonus pays most on a wall with troops behind it (`docs/sim-results-m3-walls.md`, "Walls that pay back").

## 25. Online (sessions 26 to 29, M4)
An online game is played on the server, so you can close the tab and come back on any device, and friends play at the same table. Sign-in is the preview's own (Cloudflare Access with Google): only people on the guest list can open the preview at all. Single player is unchanged: on your device, offline, with pause and saved games.
- **Making one (session 27):** the lobby's **Online** block, under the local game: **Make a game link**. It uses the map, opponents, House and rules above, with its own timer: **3, 5 or 10 minutes, or long turns of 1, 8 or 24 hours** (no "No timer" online). The table has one seat for you and one for each opponent you picked. You land on the **table screen**: the link to send your friends (Copy the link, or Share on a phone), the seats, and Start.
- **Joining:** a friend opens the link (`?join=...`), signs in (their Google email has to be on the guest list first: Nate adds it in Cloudflare), types the name the table sees, picks a House colour that's still free and takes a seat. Everyone at the table screen sees it at once. A friend can get up again before the start. The host can take someone off the table before the start (that person can't sit again), never after. The link gives a seat at that one table, nothing more.
- **Colours:** each of the ten House colours goes to one person at most (the host picks first, then first come first served). The colour you last picked is your usual one: it's what you start with at the next table, if it's free. The bots take the colours left.
- **Starting:** the host presses **Start** once at least one friend is seated (or **Start now with bots in every other seat**, to try it alone). Empty seats become bots at the table's level, the capitals are dealt with the seat rule (harder spots to bots first), and everyone seated goes straight into turn 1. Someone with the link who arrives after the start is told the game has started: games can't be joined once they're under way. The host can also **Cancel the table** before the start.
- **Your name:** your email's first part to begin with. Change it in the Online block or in Settings during an online game, or on the table screen before you sit. A game under way keeps the name it started with.
- **Your online games:** tables waiting to start ("Waiting for players, 2 of 4 seated"), games in play (turn, who it's waiting on, time left, and Continue), and **Finished** (folded): games that ended, and ones you left, kept for a week. A game's address (`?game=...`) opens it too, so a refresh lands back in it.
- **The clock is the server's.** The planning window opens when the turn starts. The page counts down to the server's deadline (moved onto your device's clock, so a phone whose clock is off still counts right). Online there's no pause button: the table pauses by vote (below).
- **Lock in:** the turn resolves when everyone still playing has locked in, or when the clock runs out, whichever is first. With one person and bots, your lock-in ends the turn. The players panel ticks each person who has locked in ("✓ locked in"): who, never what.
- **After a turn:** everyone watches their own replay (only what they could see). The next window's clock starts after the **longest replay at the table plus 10 seconds**, so nobody plans while another is still watching. Skipping your replay doesn't move the clock.
- **A missed turn:** when the clock runs out, your queue **as you left it** goes in. If you sent no orders at all that turn and chose **"If I miss a turn with no orders, my leaders run my House"** (on by default, chosen when you make the game), your Leader runs the military on 80% of your income and your Steward the realm on 20% for that turn, and the turn report says "Your leaders ran your House this turn". That 80/20 only stands in for the turns you missed (session 27): when you're back, your own commands and budgets are waiting as changes in your queue, and they apply when you play the turn. With the choice off, your House holds still that turn.
- **Three missed turns in a row (session 27):** a Marshal takes your seat for the rest of the game, playing the Neutral way (your own leaders' style). Everyone else is told ("Kit missed three turns in a row. Kit's seat is a Marshal's now."), the players panel shows "(bot)" after the name in the seat's colour, and the table stops waiting on that seat. Come back before the third miss and the count starts again. After it you can still open the game and watch it from your seat (no orders), and it moves to Finished in your list. Your leaders' purses come home to the treasury the Marshal plays from.
- **Resign (session 27):** **Resign** in Settings (with a second tap to be sure), or **Leave this game** in the lobby's list. A Marshal takes your seat at once, the table is told, and you can watch. If everyone else had already locked in, the turn resolves then. With nobody left playing (everyone resigned, taken over or knocked out), the bots play on by themselves, a turn after each replay and its 10 seconds, until someone wins.
- **Coming back:** open the game (Continue, or its address) and the server says where things stand: the planning window with your queue as you left it, or the replay you missed. A replay you've already had plays again only while the table's replay is still on. A lost connection (a phone changing networks, a laptop waking up) reconnects by itself and says "Reconnected". Opening the game in a second tab or on another device moves you there: the first one says the game is open somewhere else.
- **Leaving for now:** **Leave** in Settings takes you to the lobby. The game goes on without you here (your leaders play your missed turns if you chose that). Open it again from the lobby.
- **After the game (session 27):** a finished online game opens on its result. **Watch a turn again** plays any turn's replay as you saw it from your seat, then comes back to the result.
- **Fair:** the server rolls every die, so nothing can be cheated from a page, and each page only ever gets its own player's view and replay (a test checks every message). The dice come from a secret seed fixed before turn 1. Settings shows its fingerprint (a SHA-256 hash) during the game, and the game-over screen shows the seed itself, so anyone can check the two match.
- **The players panel** marks who at the table is a person, who has locked in, and seats a Marshal has taken ("(bot)"). Nothing else about anyone: no land counts, never orders.
- **Deals with people (session 28):** tap a person in the Houses panel, then **Propose a deal**, as with a bot: the same cards (truce, trade, joint war, passage), handshake or binding, and a note of your own if you like (120 characters at most). The other person gets it at once (a small card at the top of their map) and answers in their own planning window: **Accept**, **Counter** (their own terms back to you, once: you can accept or decline a counter, never counter it again) or **Decline** ("Kit said no", no reason needed). You're told each answer at once. Until you lock in you can **Withdraw** an offer (the deal card, or the Houses panel), and the other side is told. An offer still unanswered when the other person locks in lapses, and you're told. Someone who has locked in takes no new offers ("Kit has locked in, so offers to them wait for next turn."), and you can make at most three offers to one person a turn. The deal starts as the turn plays, before any move, when both sides said yes. As with bots, who agreed what is public once the turn plays (the report, the Chronicle, the players panel's marks), a trade's terms only to its two sides, and the offers themselves only ever reach their two sides. Your leaders never answer an offer for you: if you're away, it lapses.
- **Chat (session 28):** the **💬** button in the top bar (with how many messages you haven't read) opens your chats: **the table** (everyone sitting at it), **one-to-one** with anyone at the table (the bubble beside their name in the Houses panel), and **groups** anyone makes (**Group…** under the Houses panel, or **New group…** in chat): tick who's in it, and give it a name if you like (24 characters). A group is private: only its members see it, or know it exists. Any member can add people (they read what was said before them) or rename it. On a desktop a panel lists your chats on the left (bold when unread: the table first, then groups, then one-to-one) with the chat you picked on the right. On a phone chat opens in the bottom sheet: the list, then the chat, with a back arrow. A message that comes in while chat is closed shows for 6 seconds at the top of the map (who, and the first words: tap it to open that chat), never during the replay (it waits for the replay to end). The table chat starts on the table screen, so friends can talk while they wait, and carries into the game. Messages are plain text as you wrote them, 300 characters at most, one every 2 seconds. The game keeps a game's last 2,000 messages. Someone who resigned or whose seat a Marshal took still reads their chats but can't write ("You've left the game.").
- **Bots in the chat (session 29):** a bot speaks in the table chat only when something calls for it: it took your land (a brag), you took its land (a needle, never nasty), a deal between you started or broke, it took a capital in a fight you saw, it finished a rival, or it took its own capital back. Each line is written for you, from your own replay: a bot never mentions land in your fog, never a troop count, and two people can read different lines from the same bot. Not every turn: at most one line from a bot to you a turn, two from all the bots, and the same bot at least three turns apart unless a deal between you was made or broken. A Marshal speaks in its personality's voice, a seat a Marshal took over in the dry Neutral one, the Captain plainly and only about big things, and the Recruit never chats. A bot's line about a turn waits until you've watched that turn's replay.
- **Talking to a bot (session 29):** the 💬 bubble beside a bot in the Houses panel opens a one-to-one. Bots don't read free text: you pick. **Say something** offers three lines of yours for the moment (after it took your land, after you took its, while you have a deal, or just a greeting), and the bot answers in character. A bot answers two of your lines a turn, then "Lady Morwen has nothing more to say this turn." A bot's offer to you shows in this chat too, the same card as the Deals panel (Accept, Counter, Decline: one answer counts in either place), and it answers your choice in a line. **Propose a deal** opens the Deals panel. The Recruit doesn't chat: deals only.
- **A bot in a group (session 29):** any member can add a bot to a group (it's in the list when you make one, or **Add people**). In a group with bots you can ask **Join us against…** (pick a rival who isn't in the group) or **Peace among us?**, and each bot answers in its own voice with the deal ready to send ("Make it a deal and I'm in.", and **Send this deal** under it, for whoever asked). Its words never bind it: it joins a scheme only by accepting the deal, which it judges as it judges any offer. A bot in a group says nothing about what happened in a turn, so its lines hold nothing one member could see and another couldn't.
- **Your council (session 29):** the first chat in your list, and only you have it: your Leader, your Steward and the leaders you captured. After each turn their lines from the report pile up here as a conversation (your Leader first, names in their House colour). Now and then one asks you something, and you answer by picking. After a rival wiped out its army or took your home province: "Do we go after Lady Morwen?" (**Yes, take it back** sets Push back, **Raid them** sets Raid, **Hold for now** sets Hold). A rival army newly near your capital: "Shall I hold Rookhome?" (**Yes, hold it** sets Defend Rookhome, or **Stay as you are**). A Steward with nothing worth building: "Fortify the border or raise culture?" (Fortify, culture in your capital's province, or **Your call** for Run the realm). An empty purse and no budget: **Give it 10% of income**, **20%**, or **Leave it**. Your pick goes through the Leaders panel, which shows it as your change, like any command you set there. At most one question a turn, none in the first two turns, at least three turns apart, and the same kind of question at most once in ten turns. Unanswered when you lock in, it lapses, and the leader says so next turn ("No answer. I took that as a no."). A leader who asked about a grudge and saw you not go after them brings it up again now and then ("Still not going after Morwen? Fine."). It works in single player too.
- **Notifications (session 29):** in the game, quiet news (a deal's answer, "Reconnected", "Turn 12 is open for orders.") shows one at a time at the top, waits behind a warning, and waits for the replay to end. A chat message's pop-up plays a soft sound. **Tell me when it's my turn** (Settings, online) sends a notification to this device when a new turn opens and the game isn't open here, once a turn, with every timer: "Your turn in Conquerra: Embervale, turn 12", nothing else. It works in Chrome on a computer and in the installed app on Android. Elsewhere Settings says to install the app. **Email me when it's my turn in a long game** (1 hour turns or longer) sends the same line to your email, with a link to the game. For now, email reaches only addresses set up in the game's account.
- **Pause by vote (session 28):** during the planning window (not the replay), **Ask for a pause** in Settings, or tap the clock at the top. Everyone else still playing gets a card ("Kit asks for a pause, 15 minutes at most. Agree?") with **Agree** and **No**. Bots agree at once, and your leaders never answer for you. The pause starts only if everyone agrees within a minute. One No, or the minute running out, and it doesn't ("Not everyone agreed." or "Wren didn't answer in time."). Paused, the clock stops (the top says "Paused by Kit, 12:40 left" for everyone), for 15 minutes at most. You can still set and change orders, but **Lock in** says you're **Ready** instead, and the pause ends early when everyone is ready. The turn's time left carries on from where it stopped. Each player may start three pauses a game (a pause that didn't start doesn't count). Someone who comes back during a pause sees it.

## 26. Learn (session 31)
- **Learn** is a fold in the lobby under Start (open on your first visit, folded after unless you open it): **seven short lessons**, about 5 minutes each, each a small game already set up to teach one thing: **Take the field** (chained attacks), **Raise an army** (recruiting, the province rule and upkeep), **Build and grow** (markets, culture and your Steward), **Hold the wall** (walls), **Fate and Spoils** (cards and missions), **Make a deal** (truces, trades and the Oathbreaker mark), **Your leaders** (commands, budgets and your council). A tick shows beside each you've finished on this device. Tap one to start it. It never touches your own game (Continue still has it).
- **In a lesson:** a goal card (top left of the map on a desktop, the sheet's first tab on a phone, folds with a tap) with the lesson's opening, the goal and the turn it's due by, and this turn's hint, which also shows as the quiet notice (one a turn). There's no timer. Each turn's report starts with the goal's state ("Goal: Westermore has 25 troops or more. Done." or "Goal: not yet, 2 turns left"). Met: a card with the lesson's last line, **Next lesson** or **Back to the lobby**. Missed: **Try again** (the same game from the start) or **Back**.
- **The guided first game:** your first game against the bots on a new device (no saved games, no lesson done) shows three small cards on turn 1, each pointing at what to tap: your capital, Recruit, then Lock in. Each waits for its tap and blocks nothing else. **Skip the guide** ends it with one tap. Turn 1's report has one line about the report itself, and that's the end of it: it never shows again on that device. Learn's last line starts it on purpose.
- **Scenarios:** set pieces in the same format with no hints, listed under Learn: **The Siege of Highmouth** (take Highmouth and all of Rush March from a Captain in 10 turns). **Load a file** reads a scenario file the same way it reads a saved game.
- **Someone who has never played** sees Learn open and one line under Start: "Or jump in: a 4-player game on Embervale" (the lobby's own table).

## Not in yet (later milestones)
Steward portraits (a later art batch. Until then the House shield with a quill), the leaders' full voices (session 22's language pass: today one line when they take land), a painted wall piece (the wall is drawn in code until an art batch), a start bonus for weaker capital spots (listed, not built: `docs/sim-results-m3-balance.md`), the polish pass with replay effects and art batch 4 (session 21), the language pass (session 22), sound (its own session after). Catch-up rules for a runaway (options listed in `docs/sim-results-m3-balance.md`, not built). Factions, tutorials and scenarios (M5). Bots that chat about anything beyond their lines, and leaders' temperaments: later. Not planned: shared vision between partners, and spies that sabotage or affect combat.
