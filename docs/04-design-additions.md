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
- **Nate's calls after session 14 (Oct 6):**
  - **A harsher Oathbreaker:** about double the fine and the unrest (`rules.diplomacy.oathbreaker`: fine 4 + 1.4 per size, unrest 0.8 per size; the mark still lasts 5 turns). Session 15.
  - **A lobby switch, "Diplomacy: On/Off"** (on by default), like the Fate deck's. Off means no deals and no offers. Session 15.
  - **BUILT in session 15:** the harsher Oathbreaker, the lobby switch, and right of passage's moves (one order marches through up to 3 of the partner's territories to your own land or a fight beyond; land on the way that changed hands stops it at your last territory before it; the Captain asks for passage toward a rival it wants a front with but doesn't border, and marches through). Rules: `docs/rules-reference.md` §20.
  - **Game length with diplomacy is fixed in the bots first:** the balance pass (session 16) has bots offer fewer truces at big tables (for example, fewer offers when many players are left, and no "peace costs me nothing" truces that only pad the count). No rule change for length.

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
- **First version for session 15 (orchestrator's defaults, Oct 6; numbers in `packages/content`; Nate can change any of them):**
  - **Govern this province** is a fifth instruction for any general (your Leader or a captured one) standing in a province where you hold most of the land.
  - The general's army stays in the province and defends it, as "Hold here" does across the whole province.
  - **The general keeps 25% of that province's income** (its territories and its holding bonus) and spends it on the province the same turn: a fort on the most threatened frontier territory first, else culture where the province is most exposed, else troops at the general's territory. The rest goes home as usual.
  - **No second pot:** what it can't spend yet is held toward its next purchase and shown only as progress on the province ("A fort at Pinemark: 5 of 10 gold"), never as a separate gold total. If the general leaves the province or is lost, that progress goes home.
  - One line on the Leader card and in the report: "Your Leader governs Old March: kept 3 gold, raised culture in Pinemark."
  - The Captain may use it for a captured general in a province it holds safely; its own play is otherwise unchanged.
- **BUILT (session 15, Oct 6)** exactly as above. Details settled while building: the share is taken as the turn's income comes in (rounded down), and the general may buy more than one thing in a turn if the gold is there (a fort, then culture). It buys a fort only where a rival army stands next to the province's land; culture goes where the most rival troops stand next door (lowest culture breaking ties). A seat whose Leader governs all game wins about as often as one that holds (19% at 4 players, against Hold here's 21.5% in session 12): it parks the main army, so it's for a captured general or a quiet province. Rules: `docs/rules-reference.md` §14.

- **REDESIGN (Nate, Oct 6, after his play test): leaders you delegate to, with their own purse.** Nate's notes: the generals "don't seem to do much with the orders I give them"; he played a whole game without a building or any culture. His direction, which replaces "one treasury" and "Govern this province"'s income share:
  - **Two leaders from the start:** your **Leader** (military) and a **Steward** (culture, buildings, forts, the economy). You **name your Leader** at the start of the game (a sensible name is filled in); naming the Steward is optional.
  - **Your own leaders work exactly like captured ones:** you command them the same way, and they're just as capable.
  - **Captured leaders:** knocking a player out gives you their Leader and their Steward. Nate's example: take over two players and you command three military leaders and up to three Stewards. The cap of 2 captured is lifted to fit (orchestrator's default: up to 4 of each kind, in `packages/content`).
  - **Budgets and purses:** each turn you give each leader a **budget**, as a share of your income or an exact amount. It goes into the leader's **own visible purse**; a leader can **save up** for bigger things (a fort, a run of culture). Unspent gold stays in the purse. This is a deliberate choice to pull gold away from your own recruiting and delegate it.
  - **A much larger command list,** with menus inside menus where needed. You can hand a leader anything, up to **running your whole military** (every army and the recruiting) or **all your building and culture**. Commands are not limited to the territory the leader stands in. Defaults for the first version:
    - **Military:** Hold here; Defend this border; Push toward a place; Raid a rival; **Expand our empire in this direction** (pick a target territory: the leader moves out that way, chaining through easy, undefended land quickly, or pushing the border out slowly where it's contested; not in a straight line: it takes and secures whole provinces on the way); **Command this front** (every army in a region you mark); **Run the military** (everything).
    - **Steward:** Build up this province (forts, markets, barracks where they help); Fortify this frontier; Raise culture here; Grow the economy (markets and culture where they pay most); **Run the realm** (all building and culture).
  - **They're very good at it:** leaders plan with the **Marshal's brain** (§11), from your view only, and write **several orders a turn** (chains of attacks or moves, building in several places).
  - **You see their orders:** they go into your order queue, marked with the leader's portrait, and you can edit or delete any of them. A setting chooses when they're written: **mixed in with yours as they're made, or after yours are done**.
  - **Your Leader still fights:** its +20% stays with your own Leader only; captured Leaders command (no bonus), as today.
  - **Why it helps:** a big empire stays playable in 5 minutes, culture and buildings happen through the Steward even for a military-minded player, and spending on leaders becomes a real choice.
  - **When:** session 18, after the Marshal (session 17), because the leaders use its brain.
  - **Orchestrator's defaults for session 18 (Nate can change any of them after playing):** the Steward doesn't stand on the map and can't be lost; your Steward starts on "Run the realm" with 20% of your income, so building and culture happen even if you never open the menu, while your Leader starts with no command or budget; you can take gold back from a purse at any time; purses pay upkeep before anyone deserts (no dodging costs); a narrower command keeps its armies and places over a wider one; leaders' orders go into your queue mixed in with yours by default (or after yours, a setting); bots keep the leaders they capture but plan their realm as one; Stewards show their House's shield with a quill until Steward portraits are made.

- **BUILT (session 18, Oct 7)** as above, with every orchestrator default. Details settled while building:
  - **Budgets:** a share is of the turn's income after upkeep (a bad turn pays shares nothing); an exact amount is at most 99 gold; budgets are paid in roster order (your Leader, your Steward, captured ones) and never more than the treasury holds. Take back arrives as the turn starts, in time for your own orders.
  - **Commands, by kind:** Leaders: Hold, Defend, Push, Raid (their own army, with recruits from the purse marching with it), **Expand our empire in this direction** (its own army and ours in the provinces on the way; fast chains through weak land, careful where rival armies stand, whole provinces on the way; it holds at the target), Command this front, Run the military. Stewards: Run the realm, Build up this province, Fortify this frontier (forts, then garrisons marched in), Raise culture here, Grow the economy.
  - **Run the realm buys what pays:** urgent forts, markets, a barracks where needed, a level of culture a turn where it protects (culture bought for its income cost a Captain half its wins in the sims).
  - **The Steward's portrait:** the House shield with a quill, drawn in the page.
  - **Sims** (`docs/sim-results-m3-leaders.md`): a player who hands everything to their leaders (80% Leader, 20% Steward) wins 1.48 and 1.46 times the fair share against Marshals (Embervale 4, Wyrmland 6). The default Steward builds 2.5 times the forts and a few markets by turn 10; it costs a Captain wins on Embervale (16% vs 23%) and pays for itself on Wyrmland (18.3% vs 17.3%).
  - **Taps** on a 384 px phone, from your Leader's portrait: Expand 4, a front 5, Run the military 3; the Steward's commands 4–5; a budget 3 (Leader) or 4 (Steward). The basic turn is still 6.

## 5. Military vs. culture
- Income can go to **military** (troops, forts) or **culture**.
- Culture protects against events (uprisings, plague, storms) and against the Fallen's revenge events, and it boosts holding bonuses.
- Going all-military is faster but leaves you exposed.
- Culture you build up can be captured. Someone who invested in culture risks a military player taking over and reaping the benefit.
- **Planner's take:** this creates a real strategic choice ("tall vs. wide") and gives the Fallen system a counterweight. Keep it to **one culture number per territory**, not a separate tech tree, or it bloats.
- **DECIDED (Oct 2): military and conquest first, with a cultural flair.** Culture must stay light; this is not Civilization. No culture victory, no culture tech tree.
- **Culture is lost when land changes hands (Nate, Oct 6 play test):** a captured territory's culture drops to 0; its buildings stay (a fort keeps standing for the new owner). Culture becomes an investment in land you mean to keep. This replaces "captured culture passes to the conqueror". Session 16.
  - **BUILT (session 16):** on a capture, a trade of land, or land taken by rebels (`rules.culture.keptOnCapture` = 0). No change in game length (4 players 27.9 → 27.7 turns, 6 players 37.1 → 37.4; `docs/sim-results-s16.md`).
- **A richer culture ladder (Nate, Oct 6), for session 15.** Culture still unlocks only specialists (no tree, no new resource). The ladder uses the total culture you hold in the province, as today. **Orchestrator's defaults** (numbers in `packages/content`; Nate can change any of them after playing):

| Culture in the province | Unlocks |
|---|---|
| 0 | Cavalry, Scouts (as today) |
| 2 | Siege, Engineers (as today) |
| 3 | Healers (as today) |
| **4** | **Rangers** (9 gold, upkeep 1): when this army attacks, forest, hills and swamp defend like plains (mountains still count). Siege's counterpart for terrain. |
| **6** | **Standard-bearer** (12 gold, upkeep 1): this army attacks 10% stronger. Two in one army don't stack. |

  - The territory card's culture line names what's unlocked and the next step ("Culture 4 in Pinemark: Rangers. Next: Standard-bearer at 6").
  - The Captain hires them with its existing judgement: Rangers for a forest or hill front, a Standard-bearer for a big push.
  - **BUILT (session 15, Oct 6)** exactly as above. Rangers are hired in about a quarter of 4-player games and two thirds of 10-player games; Standard-bearers in 16% and 60% (`docs/sim-results-m3-spies.md`).

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

- **Spoils rework (Nate, Oct 6 play test):** "Explain how the spoils work, because they're not making sense to me. One of each should give me the most." Small troop rewards in scattered places are fine, culture or buildings would be nice too, and **every set should include gold**. Orchestrator's defaults for session 16 (numbers in `rules.spoils`):

| Set | Windfall |
|---|---|
| Three Swords | 8 troops, spread over your most threatened territories, and 4 gold |
| Three Towers | a finished fort on land you choose, 2 troops there, and 4 gold |
| Three Laurels | +1 culture on 3 territories in a province you choose, and 4 gold |
| **One of each (the best)** | 6 troops spread over your front, a finished building of your choice (fort, market, barracks or watchtower) on land you choose, and 10 gold |

  - **Explained on screen:** the card stack says "Collect three: three alike, or one of each (best)". The Spoils sheet always shows this table, with the set you can make lit, and the report says what a set gave.
  - **BUILT (session 16)** exactly as the table. Troops go one at a time to whichever territory is worst off against the rival army next door; one of each's building defaults to a fort on the most threatened land without one (chips pick another). Bots turn in one of each first. Games about as long as before (4 players 27.7 → 27.5, 6 players 37.4 → 36.7).

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
- **BUILT (session 15, Oct 6):** as decided below. Details settled while building:
  - **Spies act between turns:** sending and recalling take no slot; spies travel and every contest runs as the turn ends, after every army's move.
  - **Spy intel is a report, not live vision:** each turn's report (what your spies see as the turn ends) shows in full on your map and goes into your last-seen memory. During the replay, a battle in a spied province shows only as "a battle in ...", whether your spy got in or was fooled; that's what stops the replay giving a fooled spy away.
  - **A fooled report** keeps owners, buildings and capitals true; troops and specialists are moved around the House's own land there and each army is off by up to 40%; culture is a level off half the time; Leaders stand elsewhere. Made with the game's own seeded numbers (a separate sequence, so spies never change a battle's dice).
  - A spy stops at the province it was sent to, or at the first province someone else holds whole (an attempt). A province that stops being whole has no defence. The contest runs again when the holder or the number of defenders changes.
  - With fog off there are no spies.
  - The Captain keeps one spy (tuned: two cost it more than they earned). Rules: `docs/rules-reference.md` §21. Numbers: `docs/sim-results-m3-spies.md`.
- **DECIDED (Nate, Oct 6), for session 15:** a spy costs **8 gold and 1 gold upkeep**, and you can have **up to 5**. It's hired at your capital or a barracks and **travels 2 territories a turn**. **Recall** brings it home to your capital at the start of the next turn. **The defender is told** when an incoming spy is blocked or killed, **never when it's fooled**. Defending spies are stationed anywhere in a province you hold whole. Other players never see your spies on the map.
- **Spy upkeep only while away (Nate, Oct 6, after session 15):** a spy costs nothing a turn while it's in your own land (at home or guarding a province), and 1 gold a turn while it's travelling or inside land you don't hold. Session 15's sims found that 1 gold every turn made a spy a small loss for the Captain (47%) and none made it a small win (53%); this makes guarding (and so fooling) worth doing. Session 16.

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

## 11. Bot personalities and the Marshal (Nate, Oct 6 play test)
Nate's notes: his test game on Wyrmland against 5 Captains lasted only 12 turns, the last 3 a mop-up. He ran away with it, and neither the bots nor the Fallen seemed to team up against him. "Bots should have different play styles and personalities… think through all the ways someone could win and make them distinct and random so a group of 5 feels different."
- **DECIDED: a new hard level, the Marshal,** built separately from the Captain. The Captain stays as it is (the sims' yardstick, and the medium level); the Recruit stays easy. If the Marshal wins more, it becomes the default.
- **Personalities, mixed at random each game** (orchestrator's first list; session 17 refines it):
  - **The Conqueror:** picks one front, masses there, outmanoeuvres the armies in front of it, holds its other borders.
  - **The Blitzer:** all-out expansion every turn, little defence, chains everything it can.
  - **The Turtle:** slow and sure; fortifies, builds culture and markets, expands only into safe land, then strikes late with a big army.
  - **The Schemer:** lives on deals (truces it means to break at the right moment, joint wars that serve itself), heavy on spies.
  - **The Opportunist:** a vulture; hits whoever just fought, the weakened and the overstretched, and the leader's exposed flank.
  - **The Merchant:** trades, markets and peace early, a rich late push.
- **Learn what wins:** session 17 runs the personalities against each other and the Captain across maps and table sizes, measures which behaviours win most (early expansion pace, when to fortify, focus on one front, culture timing, deals), and builds the winning behaviours into the Marshal's judgement on top of its personality.
- **Stops a runaway, including a person:** the Marshal reads a fast-growing player (human or bot) early, forms joint wars against them, and the Fallen aim at them. Session 17 first checks why that didn't happen in Nate's game.
- **Your leaders and captured leaders plan with the Marshal's brain** (§4, session 18).
- **Seeing a bot's personality (orchestrator's default for session 17; Nate can change it):** hidden while you play (you learn it from how it plays), revealed on the game-over screen ("Lady Morwen, the Turtle"), with a lobby option "Show personalities" (off by default).
- **The Marshal never cheats:** it judges only from what a person in its seat could know (its view and memory, what the replays showed, public facts). No pooled sight between bots.
- **BUILT (session 17):** the Marshal and the six personalities above, as data (`packages/content/data/personalities.json`: one block each, plus the shared judgement), dealt from each game's seed. Details settled while building:
  - **What wins, from about 30,000 simulated games** (`docs/sim-results-m3-marshal.md`): attack hard (chain whenever the next hop is likely to win, every spare troop in), don't hold troops back on quiet fronts, expand hardest in the first 14 turns, and choose targets on what you know. Built in under every personality. Culture on safe land loses games and markets make no difference: Nate wants culture and buildings worth doing, a rule question for the balance pass (session 19).
  - **Nate's additions during the session:** whole provinces and ending chains on defensible ground are in; reading the border and fortifying ahead of threats was tried and is off (it held troops back and cost wins), to try again after the balance pass.
  - **The runaway:** estimates of land it can't see (from what it remembers and who knocked out whom), pace, a lower bar at 6+ players, and joint wars at once that stick. Against the strong stand-in on Wyrmland at 6 players, Marshals name it half a turn after it runs away (Captains 8.5 turns late), start a joint war on turn 10 (29), and hold it to 24% (Captains 35%, fair 17%).
  - **The lobby:** Recruit, Captain, Marshal (the default) and Mixed (a count of Marshals, the rest Captains); personalities revealed at the end, or all along with "Show personalities".
  - **The planner takes a scope** (the realm, one army, one front, or the realm's building) **and a purse**, for session 18's leaders. Its memory is plain data, kept in saves.

- **Nate's calls after session 17 (Oct 7), for session 19:** the Marshal snowball on small maps is fixed in the bots first; culture and buildings must pay (the balance pass tests three levers and Nate picks); **the Fallen act from their first turn out** (to keep knocked-out players engaged and having fun).

## 12. Controls and map clarity (Nate, Oct 6 play test), for session 16
- **Your Leader goes with the attacking army by default** (one tap to leave it home), and **stays with the army through a chain** of attacks.
- **Seize the Initiative and Lie in Wait** become plain buttons, "Initiative" and "Wait", with the full explanation on hover (desktop) or long-press (phone).
- **Room at the map's edges:** fully zoomed out, the whole map is visible clear of the menus (the camera keeps a margin for the panels).
- **Provinces on demand:** province names no longer sit on the map at Mid and Near. Tapping any territory (yours or not) **lights up the border of its whole province** and shows the province's name and bonus there. Far zoom keeps the plaques.
- **Colours:** player 1 is **red** (Gules) by default, and you choose your House colour in the lobby (online games: each player chooses, M4).
- **Sharp at every zoom:** the map is painted at higher detail where you're looking when you zoom in, and the art is kept at a higher resolution, so Near zoom looks crisp instead of blurry.
- **Orders along a path:** pick the territory you're coming from and the one you're going to; the game offers **the shortest way** or **the full sweep** (snaking back and forth to take every territory in between), then a box says how many orders it will add, and you confirm.
- **A Chronicle:** a log of every turn (battles you saw, Fate and the Fallen's events, deals, spies), so nothing that touched you can be missed. Fate and the Fallen get louder notices now and full effects in the polish pass.
- **The end of the game:** a line graph of each House's power by turn, and awards (Best Military, Best Culture, Master Builder, Spymaster, Diplomat and the like).
- **BUILT (session 16):** everything above, the end of the game included, with these details: the Leader choice sits right under the troop chips; Initiative and Wait are under More…; on a phone the Chronicle is a scroll button with the map buttons (not a fifth sheet tab); the path box is reached with a **Path…** button (a long-press already shows the card on phones); Near tiles use bigger copies of the art loaded after the first paint. Details in `docs/decisions.md`.
- **Bigger maps (Nate):** Wyrmland (120) felt right but small for 6 players. Two new official maps: about **160 territories** (6–8 players) and **200** (8–10), made in the map lab, Nate OKs the Far picture, and speed-checked on phones (session 19).

## 13. Voice and chat (Nate, Oct 7; future)
### A language pass
- **Make every piece of writing in the game feel less like AI wrote it:** menus, tooltips, reports, the Chronicle, deal reasons, bot offers, the rules reference.
- **Written in Nate's own voice** (his writing-style skill, "nate-voice"), with **a different tone for each bot personality** (the Conqueror, Blitzer, Turtle, Schemer, Opportunist and Merchant each sound like themselves) and, later, for leaders' temperaments.
- **When:** session 22, after the polish pass (21) and before M4 (the chat below reuses these voices). Nate can move it.
- **The guide (Oct 10):** `docs/voice-guide.md`, built from Nate's writing-style skill: the hard rules (no dashes, semicolons, arrows in prose, AI filler or rhetorical questions), where humor is allowed (Nate: sarcastic humor and other humor wherever the game can take it; none where words do exact work, like rules, tooltips, odds and errors; always about what really happened, never at the player), a voice for each personality, and sample rewrites for Nate to mark up.

### BUILT (session 22, Oct 10): the language pass
- **The line library** (`packages/content/data/lines.json`): every bot's deal answers, offers and broken-deal lines in its personality's voice (3 to 5 versions each), the shared reasons (plain for the Captain and the Recruit, a personality's own versions of the common ones), the leaders' lines (six personalities and a dry Neutral), captured leaders, title-card sublines, game over, the awards' remarks and the waiting text. About 1,000 lines. The version said is picked from the game's public id, the turn and the speaker.
- **Your leaders speak** after each turn (the report's "Your leaders", the Chronicle, the Leaders panel): land taken, driven back, capitals taken and lost, a rival finished, a rival army near your capital, an empty purse, a wall, a first word; Nate's three running bits (captured leaders' loyalty, your Leader judging your own moves with the real numbers, the Steward's handout written for session 23); grudges with receipts. At most one line per leader a turn and three a report; worked out from your own view only.
- **Every other word** checked against the guide; the rules reference rewritten without dashes, semicolons or arrows.
- **The voice test** enforces the hard rules on every string it can reach; strict (no expected failures).
- **Words only:** the same seeded sims before and after give the same winners, turns and deal counts.
- **Reused by the chat later (M4):** one situation, several versions, the speaker's voice. Not built: the chat, multiple-choice replies, leaders asking questions, temperaments.

### Chat (with M4, the multiplayer milestone; it works in single player too)
- **People with people:** a normal chat. One-to-one chats, and group chats with the players you pick.
- **The look:** like any chat app. Open the chat and a **left sidebar lists your chats** (bold when unread), the **selected chat fills the main area**, and **a small pop-up notification** shows when a message comes in. Easy to bring up and to dismiss. On a phone, the list and the chat are two screens.
- **Your leaders' group chat:** your Leader, your Steward and any captured leaders tell you what they did, **in their own words and personality** ("Took Ashfell and Yewmarch. Morwen's lot ran before we got there.").
- **Bots and leaders never chat like an open-ended AI:** your replies are **multiple choice**, quick and light:
  - **negotiating a deal** when a bot asks for one (accept, counter, decline, a cheeky answer)
  - **directing a leader** when it asks you something ("Lady Morwen burned our fort at Pinemark. Do we go after her?" → "Yes, take everything she has" / "Hold for now" / "Only if it's easy")
  - each choice does something in the game (a deal, a command, a budget) or just sets the mood
- **Personality and variety, baked in:** a large library of situations and lines so every game feels different:
  - leaders **hold grudges** (a rival who wiped out their army or took their home province) and **ask to go after them**; they boast after a good turn, worry when the capital is threatened, grumble when their purse is empty, and needle captured leaders who used to be rivals
  - opponents **threaten** your land, **brag** when they've taken several of your territories, and answer your choices in character
  - **fun trash talk, never childish or nasty,** and **not every turn:** only when something happens that calls for it (a big capture, a broken truce, a comeback), with limits on how often each bot speaks
  - leaders get a temperament of their own (loyal, hot-headed, cautious, ambitious, dry), dealt from the game's seed
- **Fair:** a bot's message never gives away anything you couldn't know (no bragging about land in your fog), and every choice is an ordinary game action, so nothing in chat is extra power.
- **Not heavy:** reading and answering should add seconds to a turn, not minutes. Messages can be ignored; a deal offer left unanswered lapses as today.

## 14. The balance pass and bigger maps (session 19, Oct 7)
*What changed, in plain words. The numbers are in `docs/sim-results-m3-balance.md`.*
- **The Marshal plays at least as well as your leaders.** A player who handed everything to their leaders used to beat a table of Marshals (37% on Embervale, fair 25%). The reasons: the Marshal queued its purchases before its attacks (so rivals moved first), hired cavalry on a whim, and in its all-out opening left one troop at home, so on Embervale (capitals 3 steps apart) 14% of Marshals were knocked out on turn 1. Now it queues troops and attacks first, skips the whim cavalry, and keeps a guard at its capital (half of any rival army within 3 steps, and half its stack for the first 3 turns). A delegating player now wins 20% against Marshals on Embervale, and one Marshal beats Captains more often on every table.
- **Culture pays: +1 gold a turn a level** (was +½). Pending Nate's pick of three levers (more culture income, bigger or cheaper markets, cheaper or quicker forts): all but quick forts make building pay on big maps; on a 4-player Embervale nothing makes 20% on buildings pay before the game is decided; the market levers made the Merchant too strong.
- **Your Steward's default share depends on the table:** 20% where there's room, 10% on a crowded table (12 or fewer territories a player). "Run the realm" now buys culture for its income where it pays.
- **The Fallen act from their first turn out** (Nate): a knocked-out player starts with 8 Influence (9+ on the first turn: a storm, a famine or mercenaries), the dialog and panel say what you can do right now, and the Fallen bots strike the biggest realm on their first turn out.
- **The small-map snowball is gone, from the bots alone:** 4 Marshals on Embervale used to give one player half the map by turn 10 in 71% of games, in about 21 turns; now 30%, in about 29 turns. The halfway leader wins less at every table (59–87% → 47–79%). No rule change was needed; catch-up rules are listed as options only.
- **Long bot games are fine** (Nate): his own games run much shorter than bot-only sims, so 45–60 turns in sims at 8–10 players is acceptable.
- **Bigger maps (Nate's OK):** Ashwing (a phoenix, 160 territories, 6–8 players), The Sundered Crowns (twin continents, 160, 6–8), Krakenmere (a kraken, 200, 8–10) and Rootholm (a tree of life, 200, 8–10, redrawn at Nate's word: "more of a tree of life look"). The lobby says who each map suits.

## 15. Nate's play test after session 19 (Oct 7): leaders that finish the job, the Marshal that plays like a person, controls
*Nate's one game: Rootholm (200 territories) with 9 Marshals, Classic, 30–40 turns ("only because I dragged it out testing the generals"). A fair spot, a good size, the Marshals teamed up on him and he noticed. Troops still felt worth far more than culture; he set his Steward on Run the realm and liked watching it build. The end dragged: with 95% of the map and three rivals left (2, 3 and 6 territories), his Leader on "Run the military" hoarded gold, moved troops away from the fighting and wrote few orders (Nate writes 50+ a turn; all his leaders together about 20), and the 2-territory player recaptured a chunk of the map over 4 turns.*

### Leaders that finish the job (session 20)
- **Never hoard without a reason.** A leader with a military command spends its whole budget on troops every turn unless it is saving for something named (a fort it has asked for, one more turn to afford a decisive attack). The panel says what it's saving for; otherwise the purse is spent.
- **Many orders, at the fight.** A Leader on Run the military writes as many orders as the realm needs (chains, recruits at every useful site, marches toward the fronts), never fewer than a person would. It never moves troops away from a live front except to another front.
- **Finish them.** A leader with a military command always does whatever wins fastest: when a rival is down to a handful of territories, it goes and ends them: recruit around the remnant and close in from every side so nothing escapes, or mass on one territory with the Leader and sweep every territory in chains, guessing where the remnants will run (toward their nearest friendly land, or the richest empty land) and covering those exits.
- **"Clean up" (new command, Nate):** offered in the command list once you hold about **75% of the map** (`rules.leaders.cleanUpShare`). Every leader you put on Clean up works together: they split the remaining rivals between them, encircle, sweep in big chains, and cover the exits. Anyone already on Run the military does the same without being told. The panel says "Finishing them off: Lady Morwen (3 territories left)".
- **"Push back <player>" (new command, Nate):** pick one rival; the leader harasses and pushes that player only: takes their weakly held land, breaks their chains, keeps clear of their big stacks until it can beat them, and never touches anyone else except to pass through. One plain reason per turn in the panel ("Took Pinemark from Baron Krell; his main army is at Galeholt, too big for now").
- **Anticipate and counter (Nate):** leaders and Marshals look at the armies they can see and guess what they'll do next turn (which weak territory of ours they'd take, which chain they'd run), and block it where it makes sense: a few troops moved into the exposed territory, a fort asked of the Steward, or a strike on the stack before it moves. Judged only from their own view (no cheating).
- **"Report to <leader>" (new command, Nate):** a leader works under another. A reporting Leader's army is directed by its senior (a Run the military or Expand leader), and its budget flows into the senior's purse. A reporting Steward does the same under a Run the realm Steward. The panel shows the chain ("Reports to Aldric") and the senior's orders carry the reporting leader's portrait when it's their army moving.
- **Budgets add up to at most 100%** (Nate found he could give more): the share chips only offer what's left, and the exact-amount box caps at the remaining income. Today's saves that are over 100% are trimmed in roster order.

### The Marshal plays like a person (session 20)
Nate's own way to win, as the Marshal's playbook (in its shared judgement, each personality in its own style):
1. **Grab:** attack hard along the path of least resistance, finishing provinces on the way for their bonus (built in session 17).
2. **Hold what matters:** take a choke point, fortify it, then attack again once two turns of its income are in. Fortifying ahead of a threat was tried in 17 and cost wins; try it again now that culture pays and forts are the Steward's job.
3. **Pick the best region:** once the realm is big enough, work out which part of the map has the best bonuses and terrain, drive everyone else out of it, fortify it, then move carefully through the rest.
4. **Build like the Steward:** every Marshal buys culture and buildings the way the Steward's Run the realm does (where a level pays back, on land it means to keep), in its own style (the Turtle more, the Blitzer less). A player who hands everything to their leaders should sit at about its fair share against Marshals (1.19× on Embervale and 1.50× on Wyrmland today).
5. **Finish games:** the same "finish them" rule as the leaders, so bot games stop dragging at the end (bot games on the big maps run to the 60-turn cap today).

### Controls (session 20)
- **Keyboard confirms:** when an attack or move box is open, **Enter** confirms it as shown and **Esc** cancels; the buttons stay for changing the amount or the Leader. Also Enter on the path box and the command menus. A small "Enter ↵" hint on the confirm button on a laptop.
- **Full sweep reworked (Nate):** the sweep should leave no unclaimed land between the two points: it clears a band about **3 territories wide** along the way (`rules.path.sweepWidth`), and branches out further where that completes a province. The box still says how many orders it adds.
- **Fate and the Fallen are still easy to miss** (Nate): the polish pass (21) gives them their effects, title cards and the camera; the events themselves stay as they are (Nate: "the events are fine").

### BUILT (session 20, Oct 7)
Everything above except Walls and fair seats (session 20b). Numbers: `docs/sim-results-m3-leaders.md`, session 20. Settled while building:
- **Why the leaders didn't finish** (from traces of real positions): captured Leaders arrive at your capital with no command, and a leader with no command kept its army for you, so **Run the military never touched the capital's army** (864 troops idle in one trace); recruits all went to one site, and a lost site left the purse full; reinforcements moved a step a turn; the remnant's army broke out through 1-troop land. Now only **your own** Leader with no command keeps its army.
- **Finishing** (`rules.leaders.finish`: a rival with 6 or fewer territories, or a tenth of ours, while we hold three times its land; not in the opening's 14 turns unless cleaning up): recruit at the 6 sites nearest them; march through our own land (up to 12 hops, one order a hop) to every territory next to theirs; strike their armies first with 1.5 times what it takes (counting what they could recruit before the strike lands; the Initiative on the biggest); chain through the rest and the empty land they could run to; every territory next to their armies holds; spare troops come up for next turn. A strike that's ready right now goes first in the queue. Leaders and Marshals share it.
- **Mop-up fixtures:** 20 real positions (85–95% held, two or three rivals left). Turns to finish: median 7 → 3 (a Leader on Run the military), 6 → 3 (a Marshal); 80–85% within 4 turns, about 40% within 2. **The 2-turn target isn't met**: the slow positions are real fights (rivals' armies as big as ours), and half the time a remnant's army moves before our strike lands.
- **Never hoarding:** recruits shared across the sites that need them, each with a fallback site; the one named reason is a leader with nowhere to recruit until its barracks is up. Unspent gold a turn 3.5–8.4 → 1.5–2.0.
- **Clean up:** offered from 75% of the map, 3 taps; the rivals are shared out (each to the leader with the fewest so far, the nearest breaking ties) and each leader takes our land nearest its rivals. Run the military (and the Marshal) clean up unasked from 75%, and then stop building and guarding.
- **Push back:** 4 taps; its own army and our land within two steps of that rival; that rival's land only (the less there, the better), empty land only next to theirs, careful next to its armies of 4 or more. One line a turn in the panel.
- **Report to:** 4 taps (5 for a Steward); seniors are leaders on Run the military, Expand, a front, Push back or Clean up (Stewards: Run the realm); the junior's budget and purse go to the senior each turn; Take back or a new command ends it; nobody reports to someone who reports.
- **Anticipate and counter** (a rival army of 3 or more next to our land; strike it first worth 2.5 times as much; else a reinforcement goal and a fort request to the Steward): +3 points for a delegating player on Embervale, nothing measurable on Wyrmland; kept.
- **Budgets cap at 100%:** trimmed in roster order in the engine (so an old save over 100% is trimmed as it loads, and every turn); the chips offer only what's left (with the exact remainder as a chip); the exact box stops at the income that's left; "Budgets: 80% of income" heads the panel.
- **The Marshal:** builds like the Steward **on roomy tables only** (your Steward's default share times 1, 1.5 for the Turtle and Merchant, 0.75 for the Opportunist, 0.25 for the Blitzer); holds what matters on roomy tables (session 17's border reading now costs nothing and adds about 3 points on Wyrmland); the best region, lean crowded play, multi-hop marches and the Leader riding along were tried one at a time and not kept. A delegating player (80/20) now wins 27.2% on Embervale (fair 25) and 16.8% on Wyrmland 6 (fair 16.7); **delegate-100 on Embervale is still 1.38× fair** (not the styles, the +20%, or talk: open).
- **Bot games end:** at the 60-turn cap Rootholm 8 85% → 31%, Wyrmland 8 57% → 29%, Wyrmland 6 29% → 16%; the opening isn't faster and the runaway measures improve or hold.
- **Keys:** Enter confirms the attack, move or path box exactly as shown, Esc cancels, arrows and Enter in a command menu; never while typing or with a modifier; the ↵ hint shows only where there's a mouse.
- **The sweep:** the band is every territory within a step of any shortest way between the two points, plus the last one or two territories of a province it nearly covers; up to 120 orders (a sweep across all of Wyrmland is about 50–75).
- **Also fixed:** a turn changed the game it started from (the replay's board shared the leaders' purse records).

### Nate's second note (Oct 8, after reading session 20's results): sweeps, a security blanket, and leaders with personalities
Session 20 said the slow finishes were "real fights where the rivals' armies match ours" and that a remnant's army "moves in round 1 half the time, so it slips a strike". Nate's answer: that's the wrong picture of the late game, and the fix is in how the leaders move, not in the odds.
- **Late game is about how many more troops we field each turn.** With most of the map, our recruiting dwarfs theirs; the remnant's army should never be "as big as ours" at the point of contact. The leader's job is to turn income into troops at the sites nearest the fight, every turn, and bring them to bear in one place.
- **Mass and sweep, with a security blanket (Nate's preferred finish):** drop every army onto one territory with a Leader, then **sweep everywhere they are and everywhere they could possibly get to.** That means a great many orders: chains of transfers through our own land, moving troops along every route the remnant could slip into, so anything they take is taken straight back and the sweep eventually lands on their main force. The alternative (recruit a ring around them and close in) stays for small remnants.
- **Defensible pauses:** as a leader sweeps, it looks for defensible points to pause on (choke points, provinces it has just completed) so no rival army gets behind its lines. If there's a risk of that, **the next turn begins with a sweep through our own land before the attack**: a chain of transfers leading up to the front that "catches" any enemy creeping into our territory. Attack first then sweep the exposed areas is fine too; the point is that both happen every turn where it matters.
- **Use the rules to the full:** the game allows as many transfers and attacks a turn as you like. Leaders and Marshals should use that to keep as many troops near the action as possible and to make those sweeps. Session 20's "multi-hop marches" test (6 hops a turn, judged by win rate) measured the wrong thing: the aim is troops at the front and nothing exposed behind, not a higher win rate from marching alone.
- **Orders grow with the army.** Early in a game a leader's 7–15 orders a turn is fine; late in a game with a big army on a large map Nate expects **well over 50–75 orders a turn** from the sweeps above. Don't force a number; the sweeps and the security blanket should produce it.
- **The bots' Leaders are to be used.** A Marshal starts with a Leader like any player and should move it about the map with its main effort; session 20's "Leader rides along" test (no gain by win rate) doesn't change that. **Captured leaders work together** with the Leader that captured them (and with yours) toward the same goal: Clean up and Run the military split the work; a captured Leader on Report to joins the senior's sweep.
- **Leaders with personalities (new, Nate):** when you name your Leader and Steward in the lobby you can also **give each a personality**: the war-minded ones for the Leader (the Conqueror, Blitzer, Opportunist, Schemer), the building-minded ones for the Steward (the Turtle, Merchant). A leader **keeps its personality for life**, including when it's captured and works for the player who knocked you out. The Marshal's leaders carry their Marshal's personality the same way. Default: neutral (today's style) when you don't pick.
- **Planning may be slower.** Nate: "it will always be faster than people putting in orders." The 50 ms limit stands, but the sweeps may use more of it.

### BUILT (session 20c, Oct 8)
Everything in "Nate's second note" above. Numbers: `docs/sim-results-m3-leaders.md`, session 20c. Settled while building:
- **Mass and sweep with the security blanket** (`judgement.sweep`), once cleaning up: before anything else plays, a strike that's ready now (the Initiative on their biggest army) and the ring held from up to two steps away; the whole purse recruited at sites that can't be lost that turn (some where the Leader stands, so it has an army to go with); every spare troop to one staging territory (out of their reach unless it can be made to hold first) with the Leader; one sweep through everywhere they are and everywhere their armies could reach this turn (worked out from each army's strength, and from their recruit sites), on into unseen land joining theirs and the other remnants' land; an army too big to strike yet is struck only once it marches out, and followed; then the blanket: one shared flow of transfers from land they can't reach into every territory of ours they could reach, queued last, attacking only if still stronger. A small remnant elsewhere gets session 20's ring.
- **Results, the 20 mop-up fixtures (Leader):** median 3 → 2 turns, within 3 turns 60% → 100%, none past 5; the wide set (180 runs): 69% → 92% within 3, 99% within 5 (one run at 6). **"Got away" (a rival keeping land it took to the end of a turn): 65% → 25% of positions, 52% → 17% on the wide set**, not under 10%: what's left are real armies breaking out 6–7 hops through land that couldn't be held in the first rounds, and one fixture that's a war rather than a mop-up. Orders a turn while finishing 55 → 134 (up to about 320 on Rootholm); spare troops far from the fight 22% → 14% (26% → 8% on the wide set).
- **Defensible pauses** (`judgement.pause`, 1 hop back; the Blitzer never pauses), **a sweep of our own land queued after the attacks** (`judgement.homeSweep`, 3 troops into each territory a visible army could reach behind the front; queued first it cost wins), **marches as far as they need** (`judgement.march` 20). Retaken within a turn up on Wyrmland (29% → 31%), spare troops closer to rival armies (2.06 → 1.87 steps), win rates unchanged.
- **The bots' Leaders lead the main effort from turn 15** (`judgement.leaderGoesFrom`): on the Marshal's main chain 0% → 46% of its attacking turns on Embervale, 30% on Wyrmland (from turn 15). From turn 1 it made the strongest opener snowball on Embervale (half the map by turn 10 in 50% of games of four Marshals), so the opening plays as before.
- **Captured leaders work together:** Clean up is one team under a senior (the others' armies join its mass, their purses pay for its troops, their portraits ride on the moves); the Marshal carries the leaders it captured with its armies.
- **Leaders with personalities:** chosen in the lobby next to the names (Leader: Neutral, Conqueror, Blitzer, Opportunist, Schemer; Steward: Neutral, Turtle, Merchant), one tap, remembered on the device; the bots' leaders carry their Marshal's; kept for life (state version 11, older saves Neutral). A leader plans with its Marshal personality's block; the Turtle Steward forts (from an army of 3) and raises culture first, the Merchant buys markets first. "Aldric, the Conqueror" in the Leaders panel; one line in its own voice in the report and the Chronicle when it takes land. **Every Leader personality and the Turtle are within 3.3 points of Neutral; the Merchant is +6 on Embervale (+3 on Wyrmland)**, because Neutral's Steward saves up for urgent forts while the Merchant keeps buying markets (a question for Nate). The Leader personalities differ less than the Marshal's (the Blitzer never pulls back; the others differ in whom they go for).
- **Also:** the headline (one Marshal against Captains) 39.2% → 38.9% on Embervale, 31.9% → 32.6% on Wyrmland; a delegating player 27.0% / 18.2% (fair 25 / 16.7); bot games end sooner (Rootholm 10 at the 60-turn cap 45% → 30%); all ten bots plan a turn in 12.5 ms on average at 10 players (the worst single turn 67 ms).

### Nate's third note (Oct 9, after playing 20b's build): no hoarding for real, a sweep that covers the fog, the Steward's walls
- **The Leader still hoards.** On Run the military it kept gold turn over turn and recruited less than it could; the clean-up dragged, and in one game the remnant was coming back before Nate stepped in. Session 20's "never hoard" didn't hold in play. The rule stands and must be measured in his kind of game, not only in the fixtures: **a military leader's purse is spent on troops every turn it can recruit anywhere**; a "saving for" reason must be rare and named, and the panel must show it.
- **The sweep must cover the fog.** The finish sweeps **every territory the remnant is in, might be in (fogged land it could hold), or could move to.** Fogged land next to the remnant's last known position is not "visited last", it's part of the sweep. If that means more orders, that's intended.
- **Captured leaders report to yours by default:** confirmed in play.
- **The Steward (mostly good) builds with a plan:** markets and other buildings in the **centre** territories; **forts wherever we may want a wall, now or eventually, and at choke points.** When its purse allows, **a push to wall up as fast as possible**: culture can be raised more than once a turn in one territory, so a whole wall system can go up in a single turn from 0 if the gold is there. When building defences is the best thing to do in the moment, the Steward puts all its resources into it.
- **The two leaders work together on walls:** a Steward on Run the realm and a Leader on Run the military coordinate: the Steward walls what the Leader will hold, and the Leader puts armies on the wall (the wall lends spare troops, so a garrisoned wall is the point).
- **The Marshals feel harder** and can still be improved; **a better bot above the Marshal, later**, built from the leaders' tricks once the sims show they beat it (Nate, Oct 9: "yes, we build it later"). **Nate's saved games are the material:** Settings → Save game → Save to a file records every turn's orders; the simulator replays them (`pnpm sim --replay`). Nate drops his games in `docs/sims/nate-games/` and a later session studies how he wins.
- **Walls in play:** Nate walled areas himself but too late in the game to see them attacked; the sims show bots don't attack walls (they count the garrison first), so whether a walled core gets attacked at all is still open.

### BUILT (session 20d, Oct 9)
- **No hoarding, for real:** the trace (a delegating seat played the way Nate plays, turn by turn) showed the Leader's plan already spent the purse; **the panel was the problem**: it showed the purse as the turn started, before the Leader's orders spent it, so it always looked full. It now shows the purse once this turn's orders are paid for ("Purse 0g · 50% of income · 9 orders this turn (18g)"), and so do its header and the top bar. Smaller leaks fixed: a recruit whose site is lost tries up to four other sites; with nowhere at all to recruit, a barracks as soon as it can pay; a reason only when gold is really kept. Left with under a troop's cost on 95–98% of turns (Wyrmland 6 and Rootholm 9, budgets 20–80%); the odd gold coin is the rest. In the browser, 12 turns at 50%: "Purse 0g" or "1g" every turn.
- **The sweep covers the fog:** everywhere the remnant is, might be (all land never seen, and fog within 2 steps of theirs or of never-seen land that was empty, theirs or ours when last seen) and could move to; fogged land in its turn by distance; more chains for what the first ones don't reach; the blanket next to the fog; every rival finished while cleaning up. Rival land no order went for: on the fixtures 10.3% → 5.1% (in the fog 22% → 13%); on the wide set 12.4% → 8.7% (fog 23.5% → 12.5%), now about what it is with the fog lifted. Not near zero: the first finishing turn on the big maps can't reach everything yet, and armies too big to strike wait until they march out. Finishing is no slower (median 2 turns).
- **The Steward builds with a plan:** interior markets and barracks; forts on choke points and wall candidates (the capital's province, provinces held whole facing a rival, the province your Leader stands in); several culture levels a turn, so 40 gold walls the capital in one turn's orders (the fort stands at the end of the next turn); threatened (an army near the capital's province, or a runaway that touches us), everything into the wall. The culture rule didn't need changing. Walls now go up in about three games in four, from about turn 13 (was one in five, from turn 24–27).
- **The two leaders together:** the Steward walls the province the Leader stands in; the Leader keeps 4 troops in walled land facing a rival.
- **What the sims say about the walls:** on the big maps they're now attacked about once a game and nearly always fall to that attack (a Marshal only attacks a wall when it's sure); the delegating seat is stronger on the smaller tables (Embervale 1.24–1.33× fair) and a little weaker on Rootholm 8 (about 0.88×). **Not yet:** the Marshal building with the same plan (session 23, with the Merchant's lesson).

### Nate's calls after 20d (Oct 10)
- **The Steward's plan stays everywhere** (no smaller plan on the big tables); by Nate's rule it beats the Marshals on two map types, so **the Marshal adopts it** in the bots-and-balance session (23), and the delegating seat is re-checked at fair on every table.
- **The sweep's misses (5–9% of the remnant's land on a finishing turn) are acceptable**; Nate plays and tells.
- **A Steward with nothing worth building hands gold back:** whatever its purse holds over **two turns of its budget** goes back to your treasury at the end of its orders, with a reason in the panel and the report ("Odo returned 40 gold: nothing worth building"). Its purse is yours set aside, not a hoard. Session 23.
- **Session order:** 21 the polish pass, 22 the language pass, 23 bots and balance, then sound.
- **Orchestrator defaults for session 23** (seen in 20d's screenshots): a leader's "Finishing them off" on turn 6 about a rival it has barely seen. Before cleaning up, a rival counts as a remnant only when its land **plus the fogged land it could plausibly hold** (the sweep's "might be" set) is down to a handful; cleaning up (75% of the map, which is known exactly) is unchanged.

### BUILT (session 23, Oct 10 and 11): your leaders' last fixes, the Marshal learns, a head start for the weak spots
- **Idle gold handed back:** a Steward with nothing more worth building keeps two turns of its budget, or what it would spend over the next two turns if that's more (it asks its own planner), and the rest goes to your treasury at the end of the turn, after every order (its own `budget` order with `handBack`; the engine pays it out). Under 5 gold isn't worth a report line. The Leaders panel says so while you plan, the report says what came back, and the Steward says Nate's handout lines now and then. On the turn-54 save: 916 of 1,157 gold handed back, 110 kept, then about 45 to 50 a turn.
- **A remnant judged honestly under fog, for your leaders:** before cleaning up, a rival is down to a handful only when its known land plus the fogged land it could hold is a handful. The Marshal's own turn keeps the old judgement (judged honestly, all-Marshal games on Rootholm 8 ran about 3 turns longer). The turn-6 "Duke Varric (17 territories left)" was really turn 54, cleaning up.
- **The Merchant's lesson, adopted** (the Marshal and your Neutral Steward): a market that pays for itself before the game is likely to end comes before a fort that isn't urgent (an army next door that could take the land, a fort a leader asked for, or the last piece of a wall). The likely length from the map's size (`leaders.steward.lesson`). The Turtle keeps its forts first.
- **The Steward's plan for the Marshal: tried six ways, left off** (`judgement.realmPlan`). It made the Marshals weaker against the delegating seat (Wyrmland 1.02 to 1.42 times fair), Rootholm games 3 turns longer, and every personality walled up. A question for Nate.
- **The delegating seat** (Leader 80%, Steward 20%) against Marshals, before and after: Embervale 4 1.32 to 1.25, Wyrmland 6 1.30 to 1.36, Rootholm 8 0.80 to 0.93, Moon Coast 6 1.02 to 1.10, Crownlands 8 1.33 to 1.15, Ashwing 7 0.79 to 0.93 times fair. All-Marshal game length and the personalities as before; the Captain and the Recruit unchanged.
- **A head start for the weak capital spots** (Nate, Oct 9 and 10): extra troops at the capital (+2, +4 or +6) for a spot under half its fair share among equal Marshals, in the map maker's recipes beside the pinned layouts, applied at setup for new games (an old save's history replays as it was), carried in saves (state version 13), shown as turn 1 starts, on the card and panel on turn 1 and in the first report. Sized by the sims (`docs/sim-results-m3-balance.md`, "The start bonus (session 23)"). **The finding:** on most 6 to 10 player tables even +6 troops leaves the weakest spots under half of fair; start troops are a weak lever when the spot's position decides the game.
- **A comeback card** for your own House (down to a quarter of its most land, back above half; once a game), with a sarcastic subline.

## 16. Walls (Nate, Oct 7): the reward at the end of the culture and building path
*Nate: "if a territory has all of the culture and buildings maxed out they get a wall, and that wall gets shared with any other territory that has a wall … what walls do is allow all the connected territories to share defenders above the 1 needed to hold the land." A real defensive prize for going all the way on culture and building, and a visible one. Built in session 20 (Nate's call), tested in the sims first.*

**Orchestrator's defaults (Nate can cut or change any of these):**
- **A territory is walled** when its culture is at **5** (the maximum) **and it has a fort** (a territory holds one building, so the fort is the building). Cost today: 31 gold of culture plus an 8-gold fort. Nothing else to buy: the wall appears at the end of the turn the last piece is finished.
- **Walls join up:** walled territories that touch form **one wall**. On the map the wall is drawn around the outside of the whole walled footprint (around one territory, then two, then five…), in the House's colour, with battlements at Mid and Near.
- **What a wall does: shared defenders.** When a walled territory is attacked, every other territory in the same wall lends **its spare troops** (all but the 1 that holds its land) to the defence. Nate's example: three walled territories with 4 troops each, one attacked: the attacker faces 4 + 3 + 3 = **10**. Losses fall on the defenders in proportion (the attacked territory first, then the lenders), so a wall can be worn down.
- **Limits that keep it fair:**
  - Lenders must be in the same wall (connected through walled territories) and within **3 steps** of the attacked territory (`rules.walls.reach`); the sims test unlimited reach too, and Nate picks.
  - A territory lends to **one battle a turn** (its spare troops can't defend two places at once); if two walled territories are attacked in the same turn, each lender backs the one attacked first in the replay.
  - **Siege engines** work against walls as they do against forts (they cut the fort's bonus; they don't cut the shared defenders).
  - **The wall falls with the land:** culture is lost on capture, so a captured territory leaves the wall at once; the rest of the wall stands.
  - **Walls never attack:** shared defenders are defence only. A walled territory's own troops attack as usual.
- **Fair and readable:** a wall is a big visible structure, so **anyone who can see any part of a wall sees its shared garrison**: the plaque on a walled territory says "Walled: 10 defend" and the odds preview uses that number, so "guaranteed" still always wins. Under full fog you don't see the wall at all.
- **On screen:** the wall ring on the map; "Walled" on the territory card with the garrison it can call on; the Steward's "Run the realm" and "Build up this province" finish a wall where a territory is nearly there and the land is worth holding; the Marshal (the Turtle most) builds them.
- **Not in:** walls across water, walls that give gold, or any wall effect beyond defence. No new resource.
- **What the sims check before it ships (session 20):** does anyone build walls at all (Marshals, the Steward), how often and when; the win rate of a seat that walls its core against one that doesn't; the runaway measures and game length with walls on and off; whether a walled runaway becomes impossible to stop (if so, the reach or the share of lent troops comes down, with numbers for Nate).


### BUILT (session 20b, Oct 8)
- **As designed, every number in `rules.walls`:** culture 5 and a fort make a territory walled at the end of the turn its last piece finishes; touching walled land of one House (over land, not sea lanes) is one wall; every other territory of the wall lends all its spare troops, at any distance, to every attack in the turn (Nate's calls after the sims: with one battle a turn, a 1-troop decoy used up the wall's help); losses on the attacked land first (down to its last troop), then the lenders in proportion; Siege cuts the fort's bonus only; walls never attack; land that changes hands leaves its wall at once. Saves: state version 12 (land already at culture 5 with a fort is walled as it loads).
- **Fair and readable:** anyone who sees part of a wall sees all of it and its garrison (`view.walls`); the card, the side panel and the attack panel say "Walled: 10 defend (with Pinemark and Ashfell)"; the odds preview uses it, and the guarantee property test covers walls. Under fog, a wall you saw and can't see now is remembered, greyed.
- **On screen:** a code-drawn stone wall in Nate's style (his picture): grey stone standing off the land, battlements, towers with pennants in the House colour, the House's glow round it; a painted wall piece and tower can replace it in art batch 5. "Completes a wall" on the culture and fort buttons before the last piece.
- **The bots:** the Steward (Run the realm, Build up this province) finishes walls on land worth holding (the capital, choke points, provinces held whole, land next to a wall) once at most 18 gold is left, after its markets, and keeps the fort's plot free there; the Marshal in its own style (Turtle from scratch, Blitzer never; on roomy tables). Every bot counts a wall's garrison.
- **The limits (Nate picked unlimited reach and every attack):** in bot play none of reach 2 / 3 / unlimited, lend all / half, one battle / any changes anything measurable (bot walls stay small and thinly held, and are rarely attacked); `docs/sim-results-m3-walls.md`. Nate kept the qualification as built (culture 5 and a fort, the wall appears on its own).
- **Nate's note during the session:** make the buildings more 3D so they pop like the wall (a stronger shadow and outline in code in the polish pass, session 21; buildings with more height in art batch 5).

### Walls that pay back, and weak spots go to bots first (Nate, Oct 11; session 25, after his play test)
- **A stacking defense bonus on a wall** (Nate): every territory connected in a wall adds to the defense of each of its territories, on top of the fort and culture 5. Nate: "the walls need to have some payback for the investment to make it a good strategic option." **The orchestrator's read:** a walled territory already defends at about 2.1 times its troops (the fort ×1.6, culture 5 another +30%) and the whole wall lends its spare troops; bot walls fall because they're thinly held (a median of 1 troop), and a multiplier on a thin garrison changes little, while on a big wall a person has stocked with troops an uncapped stack could make it untakeable (and the Turtle Marshal is already the strongest personality, about 1.7 times fair). **So session 25 tests it with the sims, capped**, against stop rules: for example +10% per connected territory beyond the first, at most +40% (and an uncapped version for comparison); measured by how often a wall holds when attacked, all-Marshal game length (no more than 2 turns longer), the Turtle's win rate, the delegating seat at fair, and whether the Marshals now wall in the right places. Whether the Marshal then adopts the Steward's plan is re-tested with it.
- **The orchestrator's defaults for session 25 (Oct 11; Nate can change any):** the bonus is `rules.walls.stackPerTerritory` × (wall size − 1), capped at `rules.walls.stackMax` (0.10 and 0.40 to beat; 0.05/0.20, 0.10 uncapped and 0.15/0.60 for comparison); it multiplies the defence on top of the fort and culture; Siege cuts the fort's bonus only; it applies to every attack on the wall in a turn; the "Walled" line says it in words ("+20% for 3 walled") and the odds preview counts it. Stop rules: all-Marshal games no more than 2 turns longer; no personality above 2.0 × fair and the Turtle up by no more than 0.25; the delegating seat within 0.85 to 1.2 × fair or no worse; the halfway leader up by no more than 5 points. The payback it must show: the walling seat's edge over the non-walling seat grows, and walls hold more than today's 1 in 20 attacks. Nothing ships if nothing passes.
- **The seat rule** (Nate): a weak capital spot (under half of fair at that table size) is used only when the table is big enough that every other spot is taken, and **goes to a bot before a person** wherever a bot is at the table. In single player you never start at a weak spot when a stronger one is open; online (M4), bots take them first, then people, with the head start. Measure the delegating seat both ways (a random spot, as before, and the new rule) so the numbers stay comparable. **Orchestrator's defaults (session 25):** a `bot` flag on each seat at setup; weak slots (the ones with a start bonus) dealt to bots first after the seeded shuffle; a table of bots only dealt exactly as before; a lobby row "Harder spots: bots first / anyone" so Nate can still start at a weak spot on purpose. Every pinned layout has exactly as many spots as players, so "used only when every other spot is taken" is already true by construction; it matters for random maps (M5).

