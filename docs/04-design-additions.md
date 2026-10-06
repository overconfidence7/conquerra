# Design Additions v0.2 (from Nate, Oct 2)

*Nate's new ideas, organized, with the planner's take. Items marked **DECIDE** need Nate's call before they go into the build.*

## 0. The guiding rule: "simple to play, deep to master"
- A new player should be able to finish a turn in about a minute using defaults and one-tap presets.
- An experienced player uses the full **5-minute** order window for deeper plays.
- Depth comes from how a few simple systems combine, not from more menus.
- **Test for every feature:** does it add a decision without adding a screen? If it needs its own complicated screen, simplify it or cut it.

## 1. Turn rhythm (correction)
- **Order phase: 5 minutes.** Everyone sets orders at the same time. Lock in early to speed things up.
- **Replay phase:** everyone watches the turn play out together. You see full detail in your visible area; fogged areas show only surface details ("a battle happened somewhere in the north").
- Implications:
  - A 20-turn game is about 2 hours, plus replay time. The early prototype's 80–110-turn games would be 7–9 hours, so the balance target is now **about 15–25 turns**.
  - The hosting choice still fits: Cloudflare Durable Objects run the 5-minute timers with alarms and push live updates over WebSockets.
- **DECIDED (Oct 2):** 5 minutes is the default. The host can set longer turn timers for extended campaigns.

## 2. Diplomacy: menu of preset deals
- Deal types are pre-built cards you click through:
  - border truce (specific territories, or a whole province or region)
  - trade land for land
  - trade resources for land
  - coordinated attacks ("you hit X, I hit Y")
  - multi-turn team-up
  - non-aggression until a condition is met
- **Counteroffers:** one tap to tweak the terms and send back.
- **Offer length:** an offer expires after 1 turn, or is an ongoing negotiation either side can end any time.
- **Anti-exploit rule (Nate's):** if a turn resolves while a deal is still pending, both sides must re-confirm before it takes effect. You can't accept an offer *after* attacking someone so they can't hit back.
  - Planner's version: a deal only takes effect if both sides confirm during the same order phase. Any attack between the two players during the replay voids every pending offer between them.
- Binding vs. handshake deals and scaled break penalties carry over from v0.1.
- **Bots and treaties (Nate, Oct 6): strong logic behind every yes and no.**
  - A bot accepts or declines a deal for reasons it could explain in one plain line ("I need my army in the west", "you're the one running away with the map").
  - It judges only from its own view: its fronts, who's ahead, and what the deal frees up or costs.
  - It remembers who broke a deal with it, and is slower to trust them again.
  - It never accepts something that helps a runaway leader, and it isn't a pushover or a wall: the sims check acceptance rates for good, bad and neutral offers.
  - Same brain for generals and bots.
- **DECIDED (Nate, Oct 6), first version for session 14:**
  - **All four kinds of deal:** truces, trades, joint wars and right of passage.
  - **Deals are public:** everyone sees who has a deal with whom (the Players panel, and the map where you can see it). The terms of trades stay between the two sides.
  - **Handshake deals and binding pacts both,** as decided Oct 1: handshake deals are free and can be broken (with a penalty that scales with the deal); binding pacts cost gold up front and the game blocks the attack.
- **First version for session 14 (orchestrator's defaults, Oct 6; every number in `packages/content`; Nate can change any of them):**
  - **Making a deal:** tap a player in the Players panel, then **Propose**. Pick a deal card; its terms come filled in with sensible defaults; change them if you like; choose Handshake or Binding; Send. A plain truce takes **4 taps or fewer**.
  - **Answering:** **Accept**, **Counter** (the same card with its terms open to change, sent back) or **Decline**. Bots answer at once, with a one-line reason. An offer to you arrives as a small toast as planning starts; Accept is one tap once it's open.
  - **When a deal starts (the re-confirm rule):** both sides must confirm during the same planning phase. The deal starts as the turn resolves, before any move. An offer nobody confirmed lapses when the turn resolves. Any attack between the two players during the replay voids every open offer between them.
  - **The deal cards:**
    - **Truce:** no attacks between you across the named borders, a whole province, or everywhere. For 2–8 turns (3 by default), or "until Player X is knocked out" (8 turns at most).
    - **Trade:** gold now, gold each turn (5 turns at most), or land. Land must border the receiver's land; no capitals; at most 3 territories in one deal. The giver's troops there step back to its own neighbouring land (it must hold one); one of the receiver's troops moves in from its strongest neighbouring territory; buildings stay; culture goes as it does on conquest. A payment you can't make breaks the deal.
    - **Joint war:** both sides name the same third player for 2–6 turns (4 by default). It includes a truce between the two partners while it lasts. Attacking your partner, or making a truce with the target, breaks it. A partner who never attacks the target hasn't broken it, but bots remember. Partners don't share what they see: fog stays.
    - **Right of passage:** your armies may move through their land for 2–6 turns, but can't stop or fight there. A move through land that changed hands stops at your last territory before it.
  - **Handshake and binding:**
    - **Handshake:** free. **Breaking one** brings a public **Oathbreaker** mark (5 turns), a gold fine and unrest on your land next to the player you wronged (culture protects as usual), all scaled by the deal's size (how much land it covers, how long it runs, how much it trades; "until X is knocked out" counts as big).
    - **Binding:** each side pays gold up front, more for longer and bigger deals. The game won't let you queue an attack across it, and calls off any that would cross it the turn it starts (with a report line). Gold owed each turn is taken automatically. A binding pact can't be broken; it runs until it ends.
    - **Every deal expires** (8 turns at most). Between the same two players, one deal of each kind at a time. When a player is knocked out, their deals end; the Fallen don't make deals.
  - **Public:** the Players panel shows a small mark between players for each deal (a seal on a binding one), and an Oathbreaker mark on anyone who broke one. The map shows truce borders and passage land to those who can see them. The target of a joint war is told who's coming. A trade shows as "Azure and Gules made a trade"; land that changes hands shows where it's seen.
  - **Bots judge every offer from their own view,** for reasons they can say in one plain line:
    - their fronts and where their armies are needed ("I need my army in the west")
    - who's ahead, by the Captain's runaway rule ("You're running away with the map")
    - what the deal frees up or costs (troops held on that border, gold)
    - trust in the proposer ("You broke our truce at Old March")
  - **Bots never accept a deal that helps a runaway leader** (a truce that frees it to grow, a trade that gives it land), and they're always open to a joint war against one. When an offer is close, a bot may counter once (more gold, a shorter truce), with its reason.
  - **Trust:** each bot keeps a trust score for every player. It drops a lot when that player breaks a deal with it, a little when a joint war falls through, and climbs slowly with deals kept. An Oathbreaker mark lowers everyone's trust in that player.
  - **Bots propose deals too:** a truce on the front they can't afford, a joint war against a runaway, a trade when they're short of gold or want land that completes a province. Bots also make deals with each other. The Recruit uses simpler rules: it takes a truce when it's weaker and refuses when it's stronger, and it never proposes trades.
  - **Bots keep their word,** except that the Captain may break a handshake deal when the gain clearly outweighs the penalty (a capital it's sure to take, or the win), and it says so in its reason.
  - **Generals respect every deal:** a general never attacks across a truce or breaks a deal, and "Raid a rival" can't name a partner.
  - **The sims check the bots aren't pushovers or walls:** acceptance rates on a fixed set of good, neutral and bad offers; deals and breaks per game; and game length, runaways and seat fairness with diplomacy on and off.
- **BUILT (session 14, Oct 6):** truces, trades and joint wars as above, handshake and binding, the Oathbreaker penalty, and bots that judge, counter, propose and keep their word (right of passage is stored but its moves come in session 15). Details settled while building:
  - Offers carry a one-line note: a bot's offer to you says why it's asking ("My army is needed in the west; let's have peace on our border.").
  - Trust is worked out from the record of how past deals ended, kept in the game state (so it's in every save).
  - Bots refuse to help the clear leader as far as they can tell, not only a runaway they can see, because under fog a runaway often doesn't look like one.
  - The Captain breaks its word only for a capital it's sure to take (or the win, with fog off).
  - Acceptance rates: good offers 94%, neutral 26% (70% countered), bad 2%. Games run longer with diplomacy (about 4, 5 and 7 turns at 4, 6 and 10 players) while runaways fall; the balance pass looks at it.
  - Rules: `docs/rules-reference.md` §20. Numbers: `docs/sim-results-m3-diplomacy.md`.

## 3. Contingency presets
- Order backups come from a short list of one-tap templates instead of being built by hand. Examples:
  - **Only if still stronger:** attack only if my odds are still at least "likely."
  - **Hold if threatened:** cancel the attack if an enemy stack next to my launch point grew.
  - **Retreat if outnumbered:** pull back to the nearest safe territory.
  - **Follow through:** if the capture succeeds, push on to the next target.
  - **Reinforce if hit:** if this territory was attacked earlier this turn, send reserves.
- Players pick a preset and the game fills in the details. Building a custom condition stays available behind an "Advanced" toggle.

## 4. Generals: commanders you give instructions to
- Generals are AI commanders. You give them a standing instruction; each turn they write their own orders, which resolve in the same turn cycle as everyone else's.
- Example instructions:
  - "Hold this region; send me 10% of its income." The general keeps 90% to strengthen it.
  - "Expand east."
  - "Defend this border."
  - "Raid enemy land."
- Capturing other players (or their capitals) gives you their generals, so a growing empire can still be run inside the 5-minute window.
- **Planner's take:** this is the best idea in the batch.
  - It solves the late-game problem in every Risk-like game: too much board to manage in the time you have.
  - It reuses the same bot AI that plays opponents and takes over for quitters, so we build one brain and use it three ways.
  - Risk 1: if generals make bad calls, players will feel cheated. They need to be good, and their instructions must be clear.
  - Risk 2: power creep. More generals means more free actions, so cap them or give them upkeep.
- **DECIDED (Oct 2): your Leader is a general.**
  - You can order your Leader's army directly, or hand it a standing instruction and let it command itself.
  - Capturing other players (or their capitals) adds their leaders to your roster as generals.
- **DECIDED (Oct 2): Leaders don't stay dead.** A fallen Leader comes back for free at the start of its owner's next turn, at the capital (or the strongest territory if the capital is lost). Eliminating a player adds their Leader to your pool as a general.
- **DECIDED (Oct 5, Nate): the first version of generals (session 12).**
  - **A general leads one army:** the troops in the territory where it stands, wherever they go. It has four standing instructions:
    - **Hold here**
    - **Defend this border** (toward a rival or a place)
    - **Push toward** a place
    - **Raid** a rival
  - It writes that army's orders each turn with the Captain bot's brain, judging only from your view.
  - **One treasury:** generals never spend gold. You still recruit, build and raise culture yourself.
  - **Your Leader is your first general:** order it directly, or hand it an instruction (one tap to take control back).
  - **Captured generals:** knocking a player out gives you their Leader as a general. **Captured generals command only:** they don't add the +20% fighting bonus (only your own Leader does). **You keep at most 2**; when a third comes, you choose which to keep.
- **BUILT (session 12, Oct 6):** the four instructions as decided. Details settled while building:
  - A general's army is the troops with it when it plans: it moves them by number, so that turn's recruits stay home.
  - It never stops next to an army that would throw it straight back out.
  - Your Leader as a general uses Seize the Initiative on its first attack on a rival.
  - Any order of yours out of its territory takes control back for the turn.
  - Captured generals appear at your capital; with a third, the two nearest the front stay unless you choose.

  Rules: `docs/rules-reference.md` §14–15. Numbers: `docs/sim-results-m3-generals.md`.
- **ON FILE (Oct 5, Nate likes both): "Govern this province".** A general that runs a province and keeps a share of its income to build it up, sending the rest home (the original "send me 10% of its income" idea). It comes after the army general has been played, as a fifth instruction, and must not add a second gold pot the player has to track: the province's share is spent by the general on that province and shown as one line.

## 5. Military vs. culture
- Income can go to **military** (troops, forts) or **culture**.
- Culture protects against events (uprisings, plague, storms) and against the Fallen's revenge events, and it boosts holding bonuses.
- Going all-military is faster but leaves you exposed.
- Culture you build up can be captured. Someone who invested in culture risks a military player taking over and reaping the benefit.
- **Planner's take:** this creates a real strategic choice ("tall vs. wide") and gives the Fallen system a counterweight. Keep it to **one culture number per territory**, not a separate tech tree, or it bloats.
- **DECIDED (Oct 2): military and conquest first, with a cultural flair.** Culture must stay light; this is not Civilization. No culture victory, no culture tech tree.

## 6. Cards: three systems, consolidation suggested
Nate's three ideas:
1. **Holding rewards:** a bonus for each territory, a bigger one for a whole province ("country"), and more if you've invested culture there. Conquerors inherit them.
2. **Spoils cards:** Risk-style cards earned by conquering, stacking up until you turn them in for a windfall. There's a small luck element, and the rewards vary: troops, a fort, culture.
3. **Fate deck:** one draw per turn. Either an instant event, with surface details only for players under fog, or a mission, with an expiry and offensive, defensive or culture rewards.

**Planner's suggestion:** keep these as **two decks plus passive bonuses**:
- **Holding bonuses** are shown on the map, not as cards, so there's nothing to manage.
- **Spoils** (earned).
- **Fate** (drawn): events and missions. The **Fallen** can influence Fate draws, which links the revenge system to the deck instead of a separate menu.
- **DECIDED (Oct 2): two decks plus map bonuses.**
  - Holding bonuses (territory, province, culture) show on the map.
  - **Spoils** cards are earned by conquest and turned in for a windfall.
  - **Fate** cards are drawn each turn.
- **Fate draw (DECIDED):** every player draws one card per turn.
  - **Events** land on a completely random spot on the board, not necessarily near the player who drew them. Most are mildly good or bad; a few are very good or very bad. Players under fog see only surface details.
  - **Missions** go to the player who drew them.
- **First version for session 13 (orchestrator's defaults, Oct 6; every number in `packages/content`; Nate can change any of them):**
  - **Spoils:**
    - **Earning:** at the end of any turn you took at least one territory, you earn one Spoils card (at most one a turn). Each card shows one of three marks: Sword, Tower or Laurel.
    - **Turning in:** three cards make a set. Three alike give a big windfall of that kind (Sword: troops at your capital; Tower: a free fort with a small garrison; Laurel: culture in a province you hold). One of each gives troops and gold.
    - **Windfalls don't grow** with each set turned in (unlike Risk), so they can't feed a runaway.
    - **Hand limit:** at 5 cards you must turn in a set.
    - **On screen:** a small card stack on your Leader card. Turning in is 2 taps, and nothing changes a basic turn.
  - **Fate:**
    - **Drawing:** every player draws one card each turn, automatically at the start of planning, shown as a line in the turn report (no extra tap).
    - **About 7 in 10 are events.** They land on a random spot (seeded, provably fair) and use the same event engine as the Fallen's world events, with culture's protection. Most are mild, good or bad (a bountiful harvest, a flooded ford, a wandering band that joins whoever holds the land); a few are strong. No event takes a capital or knocks anyone out. Under fog you see only a surface detail.
    - **About 3 in 10 are missions,** for the player who drew them, with a deadline and a reward: offensive, defensive or culture. For example: "Take any territory in Old March within 3 turns: +8 gold", or "Hold Ravencrest for 2 turns: +1 culture there". At most 2 missions open at once; a third becomes an event instead.
    - **A lobby switch** ("Fate deck: on/off", on by default) for players who want less luck.
  - **The Fallen keep their own event menu (Nate, Oct 6).** Fate events reuse the same engine; Influence doesn't move into Fate draws.
- **BUILT (session 13, Oct 6):** both decks as above, with these details settled while building:
  - **Spoils windfalls tuned down** (the first numbers made games about 3 turns longer): three Swords 6 troops, three Towers a finished fort + 1 troop, three Laurels +1 culture on up to 3 territories in a province, one of each 3 troops + 5 gold. A full hand has the sensible set already first in your queue.
  - **Fate lands between turns:** you draw as the turn ends, so the card is in the report when you plan, and no event can make a "guaranteed" attack fail. Closed crossings (a flooded ford, a rockslide, squalls at sea) are closed for all of the next turn and everyone who can see them knows.
  - **14 events, 10 missions,** all in `rules.fate`. Missions sit on your Leader card; tap one to light its target.
  - Rules: `docs/rules-reference.md` §18–19. Numbers: `docs/sim-results-m3-cards.md`.
- **Nate's calls after session 13 (Oct 6), built in session 14:**
  - **Spoils go back to the bigger rewards:** three Swords 8 troops, three Towers a fort + 3 troops, one of each 4 troops + 6 gold (Laurels unchanged). Games run about 1–2 turns longer; the balance pass looks at length.
  - **The first Fate draw comes at the end of turn 3** (`rules.fate`), so the opening turns stay quiet.

## 7. Troop types: the analysis Nate asked for (DECIDE)

**Option A: one troop type** (like Risk and War.app)
- ➕ Fastest orders ("move 10 to X"). Easiest map to read. Easiest to balance. Best fit for 5-minute turns and 50-player games.
- ➖ Less tactical flavor. Every fight is a numbers game, so positioning and economy carry all the depth.

**Option B: three types in a rock-paper-scissors** (infantry, cavalry, siege; what the prototype has)
- ➕ Real composition choices, counters and scouting value. Feels distinct from Risk.
- ➖ Every recruit and every move needs a "how many of each" choice, which slows turns.
- ➖ Each stack shows three numbers, so the map is harder to read.
- ➖ Balancing triples in difficulty, and it gets worse with factions.
- ➖ Bots and generals must reason about composition.
- ➖ The 5-minute budget suffers most here.

**Option C: troops + specialists (recommended)**
- Every army is one number of **troops**. That's what you recruit and move 95% of the time.
- Armies can also carry **specialists**: a few one-off attachments you buy and assign to a stack (max 1–2 per army). Each specialist is a visible badge on the stack:
  - **Cavalry:** the stack can move 2.
  - **Siege:** breaks forts.
  - **Scouts:** see further into fog.
  - **Engineers:** build a fort in 1 turn.
  - **Healers:** fewer losses.
- ➕ Orders stay fast; specialists travel with the stack automatically. The map stays readable (a number plus icons). Depth emerges naturally ("their stack has siege, my fort won't hold"). Bots and generals stay simple. It's easy to add faction-unique specialists later.
- ➖ Less granular than full unit types, and specialists need clear rules for capture and loss.

**Option D: one troop type, flavored by factions and terrain**
- ➕ Simplest of all.
- ➖ Too close to Risk, which works against the "less predictable" goal.

**DECIDED (Oct 2): Option C, troops + specialists.** Players get specialists three ways:
- buy them with gold at a barracks
- a little culture in a province unlocks the fancier types
- Spoils cards sometimes give one free

It matches "simple at first, deep later" and the 5-minute turn, and it plugs neatly into generals, cards ("Spoils: a free Siege specialist") and factions.
- **DECIDED (Oct 2):** specialists are **lost** when their army is destroyed. They are never captured.

## 8. Fog of war and spies (DECIDED, Oct 2)

### Fog (lobby setting; on by default)
- **You see full details** on your own territories and the territories bordering them: owner, troops, specialists, culture, buildings, leaders.
- **Everywhere else you see only the map:** territory and province outlines, terrain, and the holding bonuses each territory and province is worth. You do **not** see who owns it, troops, culture or anything else.
- The replay follows the same rule: full detail where you can see, surface details elsewhere ("a battle in the north").
- **Last seen (DECIDED Oct 2):** land you saw before but can't see now shows what you last saw there (owner, troops, building), marked "?" with its age ("seen 2 turns ago"). Each player's memory is kept in the game state. A fooled spy (M3) writes false intel into this memory.
- **Players panel:** shows each House, its name, Leader portrait and whether it's still in. No territory counts, troops or gold.
- Scouts (the specialist) extend what an army can see. Spies, below, are the way to see deep behind the lines.

### Spies
- **What a spy is:** a specialist that can travel on its own (not attached to an army). Bought with gold. **Each player can have only a few** (start at 5, tunable).
- **Traveling:** while moving through land that no single player fully holds, a spy lifts the fog **2 territories** around itself.
- **Infiltrating a country (province):** a spy can enter a country to spy on it. While it stays there, the fog stays lifted for that whole country **every turn**, until the spy is killed or recalled, or the defense changes.
- **Defending:** only a player who holds an **entire country** can defend it, by stationing spies at its capital. Defenders hold the position and also block other spies.
- **Spy vs spy (max 3 spies per side per country):** compare defenders to attackers. Each attacking spy beyond the first cancels one defender. What's left decides the outcome:

| Defense left | What happens to the incoming spy |
|---|---|
| 0 (no defenders, or cancelled) | **Infiltrates:** the attacker sees the true state of the whole country |
| 1 | **Blocked:** the attempt fails and the spy returns |
| 2 | **Killed:** all attacking spies in that attempt die |
| 3 (only 3 defenders vs 1 spy) | **Fooled:** the attacker *thinks* they got in, but sees false information that's close to the truth. The owner is correct, but troop counts, culture, leaders and positions are wrong or moved. The attacker isn't told. |

  - Examples: 2 defenders vs 1 spy = killed. 2 defenders vs 3 spies = 0 left = infiltrates. 3 defenders vs 2 spies = 2 left = killed. 1 defender vs 2 spies = infiltrates.
- **Spies do not affect combat.** Forts are Siege's job; spies are purely about information.
- **Design note:** this gives holding whole countries a second payoff (spy defense), and makes the 3-defender deception a real mind game. Because the fake intel is generated from the true state with the seeded RNG, it stays deterministic and replayable.
- **Open for the M3 build (orchestrator/Claude Code proposes, Nate approves):** spy movement speed, cost and the exact cap; whether "recall" is instant; and whether the defender learns that a spy was blocked or killed (planner suggests: yes for blocked and killed, no for fooled).

## 9. Maps: real geography (from Nate, Oct 2)
- **Look and feel:** like War.app and the better Risk variants. Territories have organic, irregular borders, not hexes or straight-edged cells.
- **Obstacles shape the fighting:**
  - **Seas and lakes:** not territories. Crossing water uses a **sea lane** drawn on the map, and only where one exists.
  - **Mountain ranges:** impassable, except through a **pass**.
  - **Rivers:** drawn along borders; attacking across one is harder (already in the rules).
- **Choke points on purpose:** every map should have a few places (passes, narrow land bridges, sea lanes) where a small army can hold off a big one. That gives forts, siege and positioning real meaning.
- **Map maker:** maps come from a seeded map maker (same seed, same map), then get hand-tuned names and touches. Because it's seeded, **random maps on the spot** become a lobby option later.
- **Later, with the big game modes (M5):**
  - **Random maps** generated when the game starts.
  - **Blackout fog** (a lobby option, likely for massive games): anything not next to your land is completely hidden, including the map itself, until you explore it. Standard fog, which shows the geography but not who holds it, stays the default. (Look: standard fog is desaturated land with drifting mist; blackout fog is thick painted clouds. See `docs/06-art-direction.md`.)

## 10. Pause, saved games, tutorials and scenarios (from Nate, Oct 6)
- **Single player: pause and saved games (session 13).**
  - Pause stops the turn timer.
  - The game saves itself at the start of every turn, so closing the tab is safe, and the lobby's **Continue** button picks it up.
  - A few named save slots, plus "Save to a file" / "Load a file" (today's "Save this game" grows into this).
  - Saves stay on the device. A save from an older version either loads or says plainly why it can't.
- **BUILT (session 13, Oct 6):** Pause (planning goes on while paused), autosave every turn with Continue, three slots, Save to a file / Load a file. A save is a snapshot of the game with a version number, so it survives rule changes; older saves are brought up to date or say why they can't load. Rules: `docs/rules-reference.md` §3 and §17.
- **Multiplayer: pause by vote (M4).** One player asks for a pause; everyone else confirms or declines. The pause starts only if all agree, and it has a limit (how long, how many times).
- **Tutorials (before the public launch, M5).**
  - A tutorial is a short game already in progress: a saved game with goals and hints, played out over a couple of turns to teach one thing.
  - Subjects: chaining attacks, recruiting, culture, buildings, cards, treaties, generals.
  - Built on saved games, once the rules have settled.
- **Scenarios (M5 or later):** set-piece games (a fixed map, starting positions and goals), on the same saved-game format.

